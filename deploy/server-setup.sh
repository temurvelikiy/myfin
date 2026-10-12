#!/usr/bin/env bash
# MyFin — serverni sozlash va yangilash (Ubuntu 22.04 / 24.04, root).
# Qayta ishga tushirish xavfsiz: birinchi marta hammasini o'rnatadi, keyingi safar faqat yangilaydi.
# Odatda to'g'ridan-to'g'ri emas, kompyuterdan ./deploy/push.sh orqali chaqiriladi.
#
# Domen ulash uchun:  MYFIN_DOMAIN=fin.saytim.uz bash /opt/myfin/deploy/server-setup.sh
set -euo pipefail

APP=/opt/myfin
SEED=$APP/deploy/.seed
BACKUPS=/var/backups/myfin
export DEBIAN_FRONTEND=noninteractive

[ "$(id -u)" = 0 ] || { echo "Bu skript root sifatida ishga tushirilishi kerak"; exit 1; }
step() { printf '\n\033[1;32m▶ %s\033[0m\n' "$1"; }

# ---------- 1. Tizim paketlari (faqat birinchi marta) ----------
if ! command -v caddy >/dev/null || ! command -v node >/dev/null || ! command -v sqlite3 >/dev/null; then
  step "Paketlar o'rnatilmoqda (Node.js, Caddy, SQLite)"
  apt-get update -y
  apt-get install -y curl ca-certificates gnupg sqlite3 ufw openssl debian-keyring debian-archive-keyring apt-transport-https
  if ! command -v node >/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
  if ! command -v caddy >/dev/null; then
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
  fi
fi

# 1 GB RAM'li serverda `next build` xotiraga sig'masligi mumkin — swap qo'shamiz.
if [ -z "$(swapon --show --noheadings)" ]; then
  step "2 GB swap yaratilmoqda"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- 2. Foydalanuvchi, .env va baza ----------
id myfin >/dev/null 2>&1 || useradd --system --home-dir $APP --shell /usr/sbin/nologin myfin

# Kompyuterdan kelgan .env va baza faqat serverda hali yo'q bo'lsa ishlatiladi —
# keyingi yangilanishlar serverdagi ma'lumotlarning ustidan hech qachon yozmaydi.
if [ ! -f $APP/.env ] && [ "${MYFIN_CI:-}" = 1 ]; then
  # GitHub'dan kelgan kodda .env va baza yo'q — birinchi o'rnatish kompyuterdan bo'lishi kerak.
  echo "XATO: serverda hali .env yo'q. Birinchi marta kompyuterdan ./deploy/push.sh ni ishga tushiring."
  exit 1
fi
if [ ! -f $APP/.env ]; then
  if [ -f $SEED/env ]; then
    mv $SEED/env $APP/.env
  else
    printf 'DATABASE_URL="file:./dev.db"\nADMIN_LOGIN="admin"\nADMIN_PASSWORD="%s"\nTELEGRAM_BOT_TOKEN=""\n' \
      "$(openssl rand -base64 12 | tr -d '/+=')" > $APP/.env
  fi
fi
if [ ! -f $APP/prisma/dev.db ] && [ -f $SEED/dev.db ]; then
  mv $SEED/dev.db $APP/prisma/dev.db
  echo "Kompyuterdagi baza serverga ko'chirildi"
fi
rm -rf $SEED
chown -R myfin:myfin $APP
chmod 600 $APP/.env

# ---------- 3. Yig'ish ----------
# Sxema o'zgarishi bazaga tegishidan oldin zaxira nusxa.
mkdir -p $BACKUPS
if [ -f $APP/prisma/dev.db ]; then
  sqlite3 $APP/prisma/dev.db ".backup '$BACKUPS/pre-deploy-$(date +%F-%H%M%S).db'"
fi

step "Bog'lamalar o'rnatilmoqda va sayt yig'ilmoqda (bir necha daqiqa)"
runuser -u myfin -- bash -c "cd $APP && npm ci --no-audit --no-fund && npm run setup && npm run build"

# ---------- 4. Xizmatlar ----------
step "Xizmatlar sozlanmoqda"
cat > /etc/systemd/system/myfin-web.service <<EOF
[Unit]
Description=MyFin sayt
After=network.target

[Service]
User=myfin
WorkingDirectory=$APP
Environment=NODE_ENV=production
ExecStart=$APP/node_modules/.bin/next start -p 3100 -H 127.0.0.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/myfin-bot.service <<EOF
[Unit]
Description=MyFin Telegram bot
After=network-online.target
Wants=network-online.target

[Service]
User=myfin
WorkingDirectory=$APP
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run bot
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Kunlik zaxira: 14 kunlik nusxalar saqlanadi.
cat > /usr/local/bin/myfin-backup <<EOF
#!/usr/bin/env bash
set -euo pipefail
mkdir -p $BACKUPS
sqlite3 $APP/prisma/dev.db ".backup '$BACKUPS/myfin-\$(date +%F).db'"
find $BACKUPS -name '*.db' -mtime +14 -delete
EOF
chmod +x /usr/local/bin/myfin-backup

cat > /etc/systemd/system/myfin-backup.service <<EOF
[Unit]
Description=MyFin bazasini zaxiralash

[Service]
Type=oneshot
ExecStart=/usr/local/bin/myfin-backup
EOF

cat > /etc/systemd/system/myfin-backup.timer <<EOF
[Unit]
Description=MyFin kunlik zaxira

[Timer]
OnCalendar=*-*-* 22:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now myfin-backup.timer >/dev/null
systemctl enable myfin-web >/dev/null
systemctl restart myfin-web

if grep -Eq '^TELEGRAM_BOT_TOKEN="?[^"[:space:]]+' $APP/.env; then
  systemctl enable myfin-bot >/dev/null
  systemctl restart myfin-bot
  BOT="ishlayapti"
else
  systemctl disable --now myfin-bot >/dev/null 2>&1 || true
  BOT="o'chiq (.env da TELEGRAM_BOT_TOKEN yo'q)"
fi

# ---------- 5. HTTPS (Caddy) va firewall ----------
# Domen bo'lmasa, IP manzilga bog'langan bepul sslip.io nomi ishlatiladi:
# 1.2.3.4 -> 1-2-3-4.sslip.io. Shu nomga Caddy haqiqiy HTTPS sertifikat oladi.
IP=$(curl -4 -fsS --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')
HOST=${MYFIN_DOMAIN:-$(grep -m1 -oP '^\S+(?= \{ # myfin)' /etc/caddy/Caddyfile 2>/dev/null || echo "${IP//./-}.sslip.io")}

if ! grep -q "^$HOST { # myfin" /etc/caddy/Caddyfile 2>/dev/null; then
  [ -f /etc/caddy/Caddyfile ] && cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak-$(date +%s)"
  cat > /etc/caddy/Caddyfile <<EOF
$HOST { # myfin
	encode gzip
	reverse_proxy 127.0.0.1:3100
}
EOF
  systemctl reload caddy || systemctl restart caddy
fi

SSH_PORT=$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')
ufw allow "${SSH_PORT:-22}/tcp" >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

# ---------- 6. Natija ----------
sleep 3
systemctl is-active --quiet myfin-web || { echo "XATO: sayt ishga tushmadi. Log: journalctl -u myfin-web -n 50"; exit 1; }

printf '\n\033[1;32m✔ Tayyor\033[0m\n'
echo "  Sayt:    https://$HOST"
echo "  Login:   $(grep -oP '^ADMIN_LOGIN="?\K[^"]+' $APP/.env)"
echo "  Parol:   $APP/.env faylidagi ADMIN_PASSWORD (kompyuteringizdagi .env bilan bir xil)"
echo "  Bot:     $BOT"
echo "  Zaxira:  $BACKUPS (har kuni, 14 kun saqlanadi)"
