#!/bin/sh
# Railway'da ishga tushish (faqat veb-sayt): bazani tayyorlash -> birinchi foydalanuvchi -> sayt.
# Kerakli o'zgaruvchilar (Railway → Variables):
#   DATABASE_URL="file:/data/myfin.db"   (/data — Railway Volume, ma'lumotlar shu yerda saqlanadi)
#   ADMIN_LOGIN, ADMIN_PASSWORD          (birinchi kirish uchun)
set -e

case "$DATABASE_URL" in
  file:/data/*) [ -d /data ] || { echo "XATO: /data Volume ulanmagan — ma'lumotlar har deploy'da o'chib ketadi."; exit 1; } ;;
esac

npx prisma db push --skip-generate
npx tsx prisma/seed.ts

exec npx next start -H 0.0.0.0 -p "${PORT:-3100}"
