#!/bin/bash
# ============================================================
# LNAYCRM — Installation Asterisk 20 LTS sur Ubuntu 22.04/24.04
# Usage : sudo bash install-asterisk.sh
# ============================================================

set -euo pipefail

ASTERISK_VERSION="20"
AST_USER="asterisk"
LOG_FILE="/var/log/asterisk_install.log"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
die() { log "ERREUR: $*"; exit 1; }

[ "$EUID" -eq 0 ] || die "Lancer en root : sudo bash $0"

log "=== Installation Asterisk $ASTERISK_VERSION LTS ==="

# ── 1. Dépendances système ───────────────────────────────────
log "Installation des dépendances système..."
apt-get update -qq
apt-get install -y \
  build-essential wget curl git libssl-dev libncurses5-dev \
  libnewt-dev libxml2-dev linux-headers-$(uname -r) \
  libsqlite3-dev uuid-dev libjansson-dev libedit-dev \
  libsrtp2-dev libspandsp-dev libgsm1-dev \
  sox mpg123 ffmpeg \
  ufw fail2ban sngrep

# ── 2. Téléchargement Asterisk ───────────────────────────────
log "Téléchargement Asterisk $ASTERISK_VERSION..."
cd /usr/src
TARBALL="asterisk-${ASTERISK_VERSION}-current.tar.gz"
wget -q "https://downloads.asterisk.org/pub/telephony/asterisk/${TARBALL}" -O "$TARBALL"
tar -xzf "$TARBALL"
AST_DIR=$(ls -d asterisk-${ASTERISK_VERSION}.*/ | head -1)
cd "$AST_DIR"

# ── 3. Codecs OPUS + MP3 ────────────────────────────────────
log "Installation codec contrib..."
contrib/scripts/install_prereq install 2>&1 | tail -3
contrib/scripts/get_mp3_source.sh 2>/dev/null || true

# ── 4. Compilation ───────────────────────────────────────────
log "Configuration..."
./configure --with-pjproject-bundled --with-jansson-bundled \
            --with-ssl --with-srtp --with-spandsp \
            CFLAGS="-O2" 2>&1 | tail -5

log "Sélection des modules (menuselect)..."
make menuselect.makeopts
menuselect/menuselect \
  --enable res_pjsip \
  --enable res_pjsip_session \
  --enable res_pjsip_endpoint_identifier_ip \
  --enable res_pjsip_outbound_registration \
  --enable res_pjsip_transport_websocket \
  --enable chan_pjsip \
  --enable res_ari \
  --enable res_ari_channels \
  --enable res_ari_endpoints \
  --enable res_ari_bridges \
  --enable res_srtp \
  --enable codec_opus \
  --enable codec_g722 \
  --enable app_queue \
  --enable app_voicemail \
  --enable app_record \
  --enable app_mixmonitor \
  --enable app_dial \
  --enable cdr_csv \
  menuselect.makeopts

log "Compilation (cela prend ~10 minutes)..."
make -j"$(nproc)" 2>&1 | tail -5
make install 2>&1 | tail -3
make samples 2>&1 | tail -3
make config 2>&1 | tail -3
ldconfig

# ── 5. Utilisateur système ───────────────────────────────────
log "Création utilisateur $AST_USER..."
id "$AST_USER" &>/dev/null || useradd -r -s /sbin/nologin "$AST_USER"
chown -R "$AST_USER":"$AST_USER" /var/log/asterisk /var/lib/asterisk \
                                   /var/run/asterisk /var/spool/asterisk \
                                   /usr/lib/asterisk /etc/asterisk
sed -i "s/^;AST_USER=.*/AST_USER=\"$AST_USER\"/" /etc/default/asterisk
sed -i "s/^;AST_GROUP=.*/AST_GROUP=\"$AST_USER\"/" /etc/default/asterisk

# ── 6. Activation service ────────────────────────────────────
systemctl daemon-reload
systemctl enable asterisk
systemctl start asterisk

# ── 7. Firewall ──────────────────────────────────────────────
log "Configuration firewall UFW..."
ufw allow 5060/udp comment "SIP UDP"
ufw allow 5061/tcp comment "SIP TLS"
ufw allow 8088/tcp comment "ARI HTTP"
ufw allow 8089/tcp comment "ARI HTTPS/WS"
ufw allow 10000:20000/udp comment "RTP Media"

# ── 8. Fail2ban SIP ──────────────────────────────────────────
cat > /etc/fail2ban/filter.d/asterisk.conf <<'EOF'
[Definition]
failregex = ^%(__prefix_line)s(?:ERROR|NOTICE|WARNING)\[\d+\]\s\S+:\s.*(?:Registration from|INVITE|failed for) '<?([-\d+*.]+)>?'
ignoreregex =
EOF

cat > /etc/fail2ban/jail.d/asterisk.conf <<'EOF'
[asterisk]
enabled  = true
port     = 5060,5061
protocol = udp,tcp
filter   = asterisk
logpath  = /var/log/asterisk/full
maxretry = 5
bantime  = 3600
EOF

systemctl restart fail2ban

log ""
log "=== Installation terminée ! ==="
log "Version : $(asterisk -V)"
log "Statut  : $(systemctl is-active asterisk)"
log ""
log "Prochaine étape : copier les fichiers de config :"
log "  cp pjsip.conf       /etc/asterisk/pjsip.conf"
log "  cp extensions.conf  /etc/asterisk/extensions.conf"
log "  cp ari.conf         /etc/asterisk/ari.conf"
log "  cp manager.conf     /etc/asterisk/manager.conf"
log "  cp http.conf        /etc/asterisk/http.conf"
log "  asterisk -rx 'core reload'"
