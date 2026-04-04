#!/bin/bash
# ============================================================
# LNAYCRM - Script d'installation Asterisk + SIP Trunk
# Usage : sudo bash install.sh
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASTERISK_ETC=/etc/asterisk
RECORDINGS_DIR=/var/spool/asterisk/monitor
SOUNDS_DIR=/var/lib/asterisk/sounds/lnaycrm

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Lance ce script en root : sudo bash install.sh"

# ─── 1. Installation ──────────────────────────────────────────────────────────
log "Installation d'Asterisk 20..."
apt-get update -qq
apt-get install -y asterisk asterisk-modules asterisk-voicemail \
  asterisk-mp3 sox libsox-fmt-mp3 2>/dev/null || true
log "Asterisk installé : $(asterisk -V)"

# ─── 2. Backup configs existantes ─────────────────────────────────────────────
BACKUP_DIR="${ASTERISK_ETC}/backup-$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
for f in pjsip.conf extensions.conf queues.conf manager.conf rtp.conf cdr.conf logger.conf; do
  [[ -f "${ASTERISK_ETC}/${f}" ]] && cp "${ASTERISK_ETC}/${f}" "$BACKUP_DIR/" && warn "Backup: $f → $BACKUP_DIR"
done
log "Configs sauvegardées dans $BACKUP_DIR"

# ─── 3. Copie des configs LNAYCRM ─────────────────────────────────────────────
for f in pjsip.conf extensions.conf queues.conf manager.conf rtp.conf cdr.conf cdr_custom.conf logger.conf; do
  if [[ -f "${SCRIPT_DIR}/${f}" ]]; then
    cp "${SCRIPT_DIR}/${f}" "${ASTERISK_ETC}/${f}"
    log "Copié: $f"
  fi
done

# ─── 4. Dossiers enregistrements ──────────────────────────────────────────────
mkdir -p "$RECORDINGS_DIR" "$SOUNDS_DIR"
chown -R asterisk:asterisk "$RECORDINGS_DIR" "$SOUNDS_DIR"
chmod 750 "$RECORDINGS_DIR"
log "Dossiers créés: $RECORDINGS_DIR, $SOUNDS_DIR"

# ─── 5. Certificat TLS auto-signé ─────────────────────────────────────────────
KEYS_DIR="${ASTERISK_ETC}/keys"
mkdir -p "$KEYS_DIR"
if [[ ! -f "${KEYS_DIR}/asterisk.crt" ]]; then
  warn "Génération certificat TLS auto-signé..."
  openssl req -new -x509 -days 365 -nodes \
    -out "${KEYS_DIR}/asterisk.crt" \
    -keyout "${KEYS_DIR}/asterisk.key" \
    -subj "/CN=$(hostname -f)/O=LNAYCRM/C=FR" 2>/dev/null
  chown asterisk:asterisk "${KEYS_DIR}/asterisk.crt" "${KEYS_DIR}/asterisk.key"
  chmod 640 "${KEYS_DIR}/asterisk.key"
  log "Certificat TLS créé"
fi

# ─── 6. Fichier son d'accueil (placeholder) ────────────────────────────────────
WELCOME_WAV="${SOUNDS_DIR}/welcome.wav"
if [[ ! -f "$WELCOME_WAV" ]]; then
  warn "Création son d'accueil placeholder (à remplacer par un vrai fichier)"
  # Génère un silence de 3s (remplace par ton vrai message)
  sox -n -r 8000 -c 1 "$WELCOME_WAV" trim 0.0 3.0 2>/dev/null || \
    cp /usr/share/asterisk/sounds/en/asterisk-cgi/asterisk-agitest.sln "$WELCOME_WAV" 2>/dev/null || true
  chown asterisk:asterisk "$WELCOME_WAV"
fi

# ─── 7. Firewall (UFW) ────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  warn "Configuration UFW..."
  ufw allow 5060/udp comment "SIP"
  ufw allow 5061/tcp comment "SIP TLS"
  ufw allow 8089/tcp comment "SIP WSS"
  ufw allow 10000:20000/udp comment "RTP"
  # Bloquer accès direct port AMI depuis l'extérieur (déjà bindé sur 127.0.0.1)
  log "UFW: ports SIP/RTP ouverts"
fi

# ─── 8. Permissions ───────────────────────────────────────────────────────────
chown -R asterisk:asterisk "${ASTERISK_ETC}"
chmod 640 "${ASTERISK_ETC}/manager.conf"  # manager.conf contient des secrets
log "Permissions configurées"

# ─── 9. Activer + démarrer ────────────────────────────────────────────────────
systemctl enable asterisk
systemctl restart asterisk
sleep 3

if systemctl is-active --quiet asterisk; then
  log "Asterisk démarré avec succès"
  asterisk -rx "pjsip show registrations"
else
  err "Asterisk n'a pas démarré — vérifie: journalctl -u asterisk -n 50"
fi

# ─── 10. Résumé ────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "${GREEN}INSTALLATION TERMINÉE${NC}"
echo "============================================================"
echo ""
echo "⚠️  ÉTAPES OBLIGATOIRES AVANT DE TESTER :"
echo ""
echo "1. Éditer /etc/asterisk/pjsip.conf et remplacer :"
echo "   <<OVH_USERNAME>>   → ton identifiant SIP OVH"
echo "   <<OVH_PASSWORD>>   → ton mot de passe SIP OVH"
echo "   <<OVH_SIP_HOST>>   → sip.ovh.net"
echo "   <<DID_NUMBER>>     → +33XXXXXXXXX"
echo "   <<AGENT101_PASSWORD>>, <<AGENT102_PASSWORD>>, ..."
echo ""
echo "2. Éditer /etc/asterisk/manager.conf :"
echo "   <<AMI_SECRET_CHANGE_ME>>       → mot de passe AMI backend"
echo "   <<SUPERVISOR_SECRET_CHANGE_ME>> → mot de passe AMI superviseur"
echo ""
echo "3. Modifier /etc/asterisk/extensions.conf :"
echo "   DID_NUMBER=33156XXXXXX → ton vrai numéro (sans +)"
echo ""
echo "4. Reload Asterisk : asterisk -rx 'core reload'"
echo ""
echo "5. Vérifier enregistrement OVH :"
echo "   asterisk -rx 'pjsip show registrations'"
echo ""
echo "6. Tester appel sortant (depuis console Asterisk) :"
echo "   asterisk -rx 'channel originate PJSIP/agent-101 extension 0033612345678@outbound'"
echo ""
echo "Logs : journalctl -u asterisk -f"
echo "Console Asterisk : asterisk -rvvv"
