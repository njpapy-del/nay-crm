#!/bin/bash
# ============================================================
# LNAYCRM — Setup Asterisk interactif complet
# Lance : sudo bash /home/strowger-supervisor/LNAYCRM/asterisk-config/setup_interactive.sh
# ============================================================

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
ask()  { echo -e "${CYAN}[?]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Lance en root : sudo bash $0"

ASTERISK_ETC=/etc/asterisk
RECORDINGS_DIR=/var/spool/asterisk/monitor
SOUNDS_DIR=/var/lib/asterisk/sounds/lnaycrm
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "============================================================"
echo "  LNAYCRM — Installation & Configuration Asterisk + OVH"
echo "============================================================"
echo ""

# ─── 1. Installation Asterisk ─────────────────────────────────────────────────
echo -e "${YELLOW}━━━ ÉTAPE 1 : Installation Asterisk ━━━${NC}"
if command -v asterisk &>/dev/null; then
  ok "Asterisk déjà installé : $(asterisk -V)"
else
  warn "Installation en cours..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    asterisk asterisk-modules asterisk-voicemail \
    sox libsox-fmt-mp3 openssl 2>/dev/null
  ok "Asterisk installé : $(asterisk -V)"
fi

# ─── 2. Collecte des credentials ──────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━ ÉTAPE 2 : Credentials OVH ━━━${NC}"
echo ""

ask "Identifiant SIP OVH (ex: 0033156XXXXXX ou votre numéro) :"
read -r OVH_USERNAME
[[ -z "$OVH_USERNAME" ]] && err "Identifiant OVH requis"

ask "Mot de passe SIP OVH :"
read -rs OVH_PASSWORD; echo ""
[[ -z "$OVH_PASSWORD" ]] && err "Mot de passe OVH requis"

ask "Hôte SIP OVH [sip.ovh.net] :"
read -r OVH_SIP_HOST
OVH_SIP_HOST="${OVH_SIP_HOST:-sip.ovh.net}"

ask "Numéro DDI entrant (format E.164 sans +, ex: 33156XXXXXX) :"
read -r DID_NUMBER
[[ -z "$DID_NUMBER" ]] && err "Numéro DDI requis"

echo ""
echo -e "${YELLOW}━━━ ÉTAPE 3 : Mots de passe agents ━━━${NC}"
echo ""

ask "Mot de passe agent 101 (softphone) [défaut: auto-généré] :"
read -r AGENT101_PWD
AGENT101_PWD="${AGENT101_PWD:-$(openssl rand -base64 12 | tr -d '=/+')}"

ask "Mot de passe agent 102 [défaut: auto-généré] :"
read -r AGENT102_PWD
AGENT102_PWD="${AGENT102_PWD:-$(openssl rand -base64 12 | tr -d '=/+')}"

ask "Mot de passe agent 103 [défaut: auto-généré] :"
read -r AGENT103_PWD
AGENT103_PWD="${AGENT103_PWD:-$(openssl rand -base64 12 | tr -d '=/+')}"

echo ""
echo -e "${YELLOW}━━━ ÉTAPE 4 : Secrets AMI ━━━${NC}"
AMI_SECRET_BACKEND=$(openssl rand -base64 20 | tr -d '=/+')
AMI_SECRET_SUPERVISOR=$(openssl rand -base64 20 | tr -d '=/+')
ok "Secrets AMI générés automatiquement"

# ─── 3. Backup ────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━ ÉTAPE 5 : Backup + copie configs ━━━${NC}"
BACKUP_DIR="${ASTERISK_ETC}/backup-$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
for f in pjsip.conf extensions.conf queues.conf manager.conf rtp.conf cdr.conf logger.conf; do
  [[ -f "${ASTERISK_ETC}/${f}" ]] && cp "${ASTERISK_ETC}/${f}" "$BACKUP_DIR/" 2>/dev/null || true
done
ok "Backup dans $BACKUP_DIR"

# ─── 4. Génération pjsip.conf ─────────────────────────────────────────────────
cat > "${ASTERISK_ETC}/pjsip.conf" << PJSIP_EOF
; ============================================================
; LNAYCRM - pjsip.conf — Généré le $(date '+%Y-%m-%d %H:%M:%S')
; ============================================================

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
; Si derrière NAT, décommenter et remplacer :
; external_media_address=TON_IP_PUBLIQUE
; external_signaling_address=TON_IP_PUBLIQUE
; local_net=192.168.0.0/24

[transport-tls]
type=transport
protocol=tls
bind=0.0.0.0:5061
cert_file=/etc/asterisk/keys/asterisk.crt
priv_key_file=/etc/asterisk/keys/asterisk.key

; ── Trunk OVH ──────────────────────────────────────────────

[ovh-auth]
type=auth
auth_type=userpass
username=${OVH_USERNAME}
password=${OVH_PASSWORD}

[ovh-aor]
type=aor
contact=sip:${OVH_SIP_HOST}
qualify_frequency=30
maximum_expiration=3600
minimum_expiration=60

[ovh-trunk]
type=endpoint
transport=transport-udp
context=from-trunk
disallow=all
allow=ulaw
allow=alaw
allow=g729
outbound_auth=ovh-auth
aors=ovh-aor
callerid="LNAYCRM" <${DID_NUMBER}>
direct_media=no
rtp_symmetric=yes
force_rport=yes
ice_support=no
dtmf_mode=rfc4733
qualify_frequency=30

[ovh-identify]
type=identify
endpoint=ovh-trunk
; IPs SIP OVH (France) — vérifie sur docs.ovh.com/fr/voip/
match=91.121.210.0/24
match=91.121.211.0/24
match=145.239.0.0/16
match=51.77.0.0/16

[ovh-registration]
type=registration
transport=transport-udp
outbound_auth=ovh-auth
server_uri=sip:${OVH_SIP_HOST}
client_uri=sip:${OVH_USERNAME}@${OVH_SIP_HOST}
contact_user=${OVH_USERNAME}
retry_interval=60
max_retries=10
expiration=3600

; ── Agents SIP ─────────────────────────────────────────────

[agent-template](!)
type=endpoint
transport=transport-udp
context=agents
disallow=all
allow=ulaw
allow=alaw
allow=g722
dtmf_mode=rfc4733
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes

[agent-101-auth]
type=auth
auth_type=userpass
username=agent101
password=${AGENT101_PWD}

[agent-101-aor]
type=aor
max_contacts=2
qualify_frequency=60
remove_existing=yes

[agent-101](agent-template)
auth=agent-101-auth
aors=agent-101-aor
callerid="Agent 101" <101>

[agent-102-auth]
type=auth
auth_type=userpass
username=agent102
password=${AGENT102_PWD}

[agent-102-aor]
type=aor
max_contacts=2
qualify_frequency=60
remove_existing=yes

[agent-102](agent-template)
auth=agent-102-auth
aors=agent-102-aor
callerid="Agent 102" <102>

[agent-103-auth]
type=auth
auth_type=userpass
username=agent103
password=${AGENT103_PWD}

[agent-103-aor]
type=aor
max_contacts=2
qualify_frequency=60
remove_existing=yes

[agent-103](agent-template)
auth=agent-103-auth
aors=agent-103-aor
callerid="Agent 103" <103>
PJSIP_EOF
ok "pjsip.conf écrit"

# ─── 5. Génération extensions.conf ────────────────────────────────────────────
cat > "${ASTERISK_ETC}/extensions.conf" << EXT_EOF
; ============================================================
; LNAYCRM - extensions.conf — Généré le $(date '+%Y-%m-%d %H:%M:%S')
; ============================================================

[globals]
DID_NUMBER=${DID_NUMBER}
TRUNK=ovh-trunk
RECORDINGS_DIR=${RECORDINGS_DIR}
MAX_CALL_DURATION=3600
VOICEMAIL_EXT=1000

[general]
static=yes
writeprotect=no
autofallthrough=yes

; ── Agents internes ────────────────────────────────────────

[agents]
exten => _1XX,1,NoOp(Appel interne vers \${EXTEN})
 same => n,Dial(PJSIP/\${EXTEN},30,tT)
 same => n,Hangup()

exten => _0.,1,NoOp(Appel sortant depuis agent \${CALLERID(num)})
 same => n,Set(DEST=\${EXTEN:1})
 same => n,Goto(outbound,\${DEST},1)

exten => *98,1,VoiceMailMain(\${CALLERID(num)}@default)
 same => n,Hangup()

exten => *1,1,PauseQueueMember(,PJSIP/\${CALLERID(num)})
 same => n,Playback(agent-loggedoff)
 same => n,Hangup()

exten => *2,1,UnpauseQueueMember(,PJSIP/\${CALLERID(num)})
 same => n,Playback(agent-loggedin)
 same => n,Hangup()

; ── Appels sortants ────────────────────────────────────────

[outbound]
exten => _0033.,1,NoOp(Sortant E.164 vers \${EXTEN})
 same => n,Set(CALLERID(num)=\${GLOBAL(DID_NUMBER)})
 same => n,MixMonitor(\${GLOBAL(RECORDINGS_DIR)}/\${STRFTIME(\${EPOCH},,%Y%m%d-%H%M%S)}-\${CALLERID(num)}-\${UNIQUEID}.wav,ab)
 same => n,Dial(PJSIP/\${EXTEN}@\${GLOBAL(TRUNK)},\${GLOBAL(MAX_CALL_DURATION)},gT)
 same => n,Hangup()

exten => _0[1-9]XXXXXXXX,1,NoOp(Numéro FR \${EXTEN})
 same => n,Set(DEST=0033\${EXTEN:1})
 same => n,Goto(outbound,\${DEST},1)

exten => _+33.,1,Set(DEST=0033\${EXTEN:3})
 same => n,Goto(outbound,\${DEST},1)

exten => _+.,1,Set(DEST=00\${EXTEN:1})
 same => n,Goto(outbound,\${DEST},1)

exten => _00[1-9].,1,NoOp(Sortant 00X \${EXTEN})
 same => n,Set(CALLERID(num)=\${GLOBAL(DID_NUMBER)})
 same => n,MixMonitor(\${GLOBAL(RECORDINGS_DIR)}/\${STRFTIME(\${EPOCH},,%Y%m%d-%H%M%S)}-\${CALLERID(num)}-\${UNIQUEID}.wav,ab)
 same => n,Dial(PJSIP/\${EXTEN}@\${GLOBAL(TRUNK)},\${GLOBAL(MAX_CALL_DURATION)},gT)
 same => n,Hangup()

; ── Appels entrants ────────────────────────────────────────

[from-trunk]
exten => ${DID_NUMBER},1,NoOp(Entrant depuis \${CALLERID(num)})
 same => n,Set(CDR(userfield)=inbound)
 same => n,MixMonitor(\${GLOBAL(RECORDINGS_DIR)}/\${STRFTIME(\${EPOCH},,%Y%m%d-%H%M%S)}-\${CALLERID(num)}-\${UNIQUEID}.wav,ab)
 same => n,Goto(ivr-main,s,1)

exten => s,1,Goto(\${GLOBAL(DID_NUMBER)},1)

exten => _.,1,Answer()
 same => n,Hangup()

; ── SVI ────────────────────────────────────────────────────

[ivr-main]
exten => s,1,Answer()
 same => n,Wait(1)
 same => n,Background(lnaycrm/welcome)
 same => n,WaitExten(5)

exten => t,1,Goto(queues,sales,1)
exten => 1,1,Goto(queues,sales,1)
exten => 2,1,Goto(queues,support,1)
exten => 0,1,VoiceMail(\${GLOBAL(VOICEMAIL_EXT)}@default,su)
 same => n,Hangup()
exten => i,1,Playback(invalid)
 same => n,Goto(s,1)

; ── Files d'attente ────────────────────────────────────────

[queues]
exten => sales,1,Queue(sales,tT,,,120)
 same => n,GotoIf(\$["\${QUEUESTATUS}"="TIMEOUT"]?vm)
 same => n,Hangup()
exten => sales,n(vm),VoiceMail(\${GLOBAL(VOICEMAIL_EXT)}@default,su)
 same => n,Hangup()

exten => support,1,Queue(support,tT,,,120)
 same => n,Hangup()

; ── Supervision ────────────────────────────────────────────

[supervision]
exten => _881.,1,ChanSpy(PJSIP/\${EXTEN:3},q)
 same => n,Hangup()
exten => _882.,1,ChanSpy(PJSIP/\${EXTEN:3},wq)
 same => n,Hangup()
exten => _883.,1,ChanSpy(PJSIP/\${EXTEN:3},Bq)
 same => n,Hangup()
EXT_EOF
ok "extensions.conf écrit"

# ─── 6. manager.conf ──────────────────────────────────────────────────────────
cat > "${ASTERISK_ETC}/manager.conf" << MGR_EOF
; ============================================================
; LNAYCRM - manager.conf — Généré le $(date '+%Y-%m-%d %H:%M:%S')
; ============================================================

[general]
enabled=yes
port=5038
bindaddr=127.0.0.1
displayconnects=yes
timestampevents=yes

[lnaycrm-backend]
secret=${AMI_SECRET_BACKEND}
permit=127.0.0.1/255.255.255.255
deny=0.0.0.0/0.0.0.0
read=all
write=all

[lnaycrm-supervisor]
secret=${AMI_SECRET_SUPERVISOR}
permit=127.0.0.1/255.255.255.255
deny=0.0.0.0/0.0.0.0
read=system,call,agent,user,queue
write=system,call,agent
MGR_EOF
chmod 640 "${ASTERISK_ETC}/manager.conf"
ok "manager.conf écrit (secret sécurisé)"

# ─── 7. Copie queues.conf + rtp.conf ──────────────────────────────────────────
for f in queues.conf rtp.conf cdr.conf logger.conf; do
  [[ -f "${SCRIPT_DIR}/${f}" ]] && cp "${SCRIPT_DIR}/${f}" "${ASTERISK_ETC}/${f}" && ok "Copié: $f"
done

# ─── 8. Dossiers ──────────────────────────────────────────────────────────────
mkdir -p "$RECORDINGS_DIR" "$SOUNDS_DIR"
chown -R asterisk:asterisk "$RECORDINGS_DIR" "$SOUNDS_DIR" 2>/dev/null || true
chmod 750 "$RECORDINGS_DIR"
ok "Dossiers créés"

# ─── 9. Certificat TLS ────────────────────────────────────────────────────────
KEYS_DIR="${ASTERISK_ETC}/keys"
mkdir -p "$KEYS_DIR"
if [[ ! -f "${KEYS_DIR}/asterisk.crt" ]]; then
  openssl req -new -x509 -days 365 -nodes \
    -out "${KEYS_DIR}/asterisk.crt" \
    -keyout "${KEYS_DIR}/asterisk.key" \
    -subj "/CN=$(hostname -f)/O=LNAYCRM/C=FR" 2>/dev/null
  chown asterisk:asterisk "${KEYS_DIR}/asterisk.crt" "${KEYS_DIR}/asterisk.key"
  chmod 640 "${KEYS_DIR}/asterisk.key"
  ok "Certificat TLS auto-signé généré"
fi

# ─── 10. Son d'accueil placeholder ────────────────────────────────────────────
WELCOME_WAV="${SOUNDS_DIR}/welcome.wav"
if [[ ! -f "$WELCOME_WAV" ]]; then
  sox -n -r 8000 -c 1 "$WELCOME_WAV" trim 0.0 3.0 2>/dev/null && chown asterisk:asterisk "$WELCOME_WAV" || true
fi

# ─── 11. Permissions ──────────────────────────────────────────────────────────
chown -R asterisk:asterisk "${ASTERISK_ETC}" 2>/dev/null || true

# ─── 12. Firewall UFW ────────────────────────────────────────────────────────
if command -v ufw &>/dev/null && ufw status | grep -q "active"; then
  ufw allow 5060/udp comment "SIP" >/dev/null
  ufw allow 5061/tcp comment "SIP TLS" >/dev/null
  ufw allow 10000:20000/udp comment "RTP" >/dev/null
  ok "UFW : ports SIP/RTP ouverts"
fi

# ─── 13. Démarrage ────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━ ÉTAPE 6 : Démarrage Asterisk ━━━${NC}"
systemctl enable asterisk 2>/dev/null
systemctl restart asterisk
sleep 4

if systemctl is-active --quiet asterisk; then
  ok "Asterisk démarré"
else
  warn "Asterisk ne répond pas — vérification des logs..."
  journalctl -u asterisk -n 20 --no-pager
  err "Asterisk n'a pas démarré"
fi

# ─── 14. Vérification enregistrement ─────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━ ÉTAPE 7 : Test enregistrement OVH ━━━${NC}"
sleep 3
REG_STATUS=$(asterisk -rx "pjsip show registrations" 2>/dev/null)
echo "$REG_STATUS"

if echo "$REG_STATUS" | grep -q "Registered"; then
  ok "Enregistrement OVH : SUCCÈS ✅"
elif echo "$REG_STATUS" | grep -q "Rejected\|Failed"; then
  warn "Enregistrement OVH : ÉCHEC — vérifier identifiants"
else
  warn "Enregistrement en cours (peut prendre 30s)..."
fi

# ─── 15. Sauvegarde credentials ───────────────────────────────────────────────
CREDS_FILE="/root/lnaycrm-asterisk-credentials.txt"
cat > "$CREDS_FILE" << CREDS_EOF
# LNAYCRM — Credentials Asterisk — $(date '+%Y-%m-%d %H:%M:%S')
# GARDER CONFIDENTIEL

OVH_USERNAME=${OVH_USERNAME}
OVH_SIP_HOST=${OVH_SIP_HOST}
DID_NUMBER=${DID_NUMBER}

AGENT_101: username=agent101  password=${AGENT101_PWD}
AGENT_102: username=agent102  password=${AGENT102_PWD}
AGENT_103: username=agent103  password=${AGENT103_PWD}

AMI_BACKEND_USER=lnaycrm-backend
AMI_BACKEND_SECRET=${AMI_SECRET_BACKEND}

AMI_SUPERVISOR_USER=lnaycrm-supervisor
AMI_SUPERVISOR_SECRET=${AMI_SECRET_SUPERVISOR}

# Variable .env backend LNAYCRM :
ASTERISK_AMI_HOST=127.0.0.1
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USER=lnaycrm-backend
ASTERISK_AMI_SECRET=${AMI_SECRET_BACKEND}
RECORDINGS_PATH=${RECORDINGS_DIR}
CREDS_EOF
chmod 600 "$CREDS_FILE"

# ─── Résumé final ─────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "${GREEN}INSTALLATION TERMINÉE${NC}"
echo "============================================================"
echo ""
echo -e "📋 ${YELLOW}Credentials sauvegardés dans :${NC} $CREDS_FILE"
echo ""
echo -e "🔧 ${YELLOW}Variables à ajouter dans .env backend :${NC}"
echo "   ASTERISK_AMI_HOST=127.0.0.1"
echo "   ASTERISK_AMI_PORT=5038"
echo "   ASTERISK_AMI_USER=lnaycrm-backend"
echo "   ASTERISK_AMI_SECRET=${AMI_SECRET_BACKEND}"
echo "   RECORDINGS_PATH=${RECORDINGS_DIR}"
echo ""
echo -e "📱 ${YELLOW}Softphones agents :${NC}"
echo "   Agent 101 → SIP: agent101 / ${AGENT101_PWD} @ $(hostname -I | awk '{print $1}'):5060"
echo "   Agent 102 → SIP: agent102 / ${AGENT102_PWD} @ $(hostname -I | awk '{print $1}'):5060"
echo "   Agent 103 → SIP: agent103 / ${AGENT103_PWD} @ $(hostname -I | awk '{print $1}'):5060"
echo ""
echo -e "🧪 ${YELLOW}Tests :${NC}"
echo "   asterisk -rx 'pjsip show registrations'    # Vérifier OVH"
echo "   asterisk -rx 'pjsip show endpoints'        # Voir agents"
echo "   asterisk -rx 'core show channels'          # Appels actifs"
echo "   asterisk -rvvv                             # Console debug"
echo ""
echo -e "🔊 ${YELLOW}Remplacer le son d'accueil :${NC}"
echo "   Copier ton MP3/WAV dans : ${SOUNDS_DIR}/welcome.wav"
echo "   (format 8kHz, mono, PCM)"
echo ""
