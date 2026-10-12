#!/usr/bin/env bash
# MyFin'ni serverga yuborish (kompyuterda, Git Bash'da ishlatiladi).
#
#   ./deploy/push.sh root@SERVER_IP
#
# Birinchi marta: serverni to'liq sozlaydi, kompyuterdagi .env + bazani ko'chiradi va
# GitHub Actions uchun deploy kalitini ulaydi — shundan keyin har `git push` o'zi deploy qiladi.
# Keyingi safar: faqat kodni yangilaydi — serverdagi ma'lumotlarga tegmaydi.
set -euo pipefail

TARGET="${1:?Foydalanish: ./deploy/push.sh root@SERVER_IP}"
PORT="${SSH_PORT:-22}"
KEY="$HOME/.ssh/myfin_deploy"
cd "$(dirname "$0")/.."

# GitHub Actions serverga shu kalit bilan kiradi (faqat shu loyiha uchun alohida kalit).
if [ ! -f "$KEY" ]; then
  mkdir -p "$HOME/.ssh"
  ssh-keygen -q -t ed25519 -N "" -C "myfin-github-deploy" -f "$KEY"
fi
PUB="$(cat "$KEY.pub")"

echo "▶ Kod $TARGET ga yuborilmoqda (server paroli so'raladi)…"

# .env va baza arxivga alohida nom bilan kiradi; server ularni faqat o'zida yo'q bo'lsa oladi.
tar -cz \
  --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./tsconfig.tsbuildinfo \
  --exclude='./prisma/dev.db-journal' \
  --transform='s|^\./\.env$|./deploy/.seed/env|' \
  --transform='s|^\./prisma/dev\.db$|./deploy/.seed/dev.db|' \
  . |
  ssh -p "$PORT" "$TARGET" "
    mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
    grep -qxF '$PUB' ~/.ssh/authorized_keys || echo '$PUB' >> ~/.ssh/authorized_keys
    mkdir -p /opt/myfin && tar -xzf - -C /opt/myfin --no-same-owner &&
    MYFIN_DOMAIN='${MYFIN_DOMAIN:-}' bash /opt/myfin/deploy/server-setup.sh"

# GitHub secret'larini qo'yish: shundan keyin `git push` avtomatik deploy qiladi.
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1 && git remote get-url origin >/dev/null 2>&1; then
  echo "▶ GitHub Actions ulanmoqda…"
  gh secret set SERVER_HOST --body "${TARGET#*@}"
  gh secret set SERVER_USER --body "${TARGET%@*}"
  gh secret set SERVER_PORT --body "$PORT"
  gh secret set SSH_PRIVATE_KEY < "$KEY"
  echo "✔ Endi har 'git push' da sayt avtomatik yangilanadi."
else
  echo "ℹ GitHub CLI topilmadi — avtomatik deploy uchun deploy/README.md dagi secret'larni qo'lda qo'shing."
fi
