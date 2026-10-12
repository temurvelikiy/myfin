# MyFin'ni serverga joylashtirish

Natija: sayt va Telegram bot 24/7 ishlaydi, ma'lumotlar serverda saqlanadi va har kuni zaxiralanadi.

## 1. VPS sotib olish

Eng arzon tarif yetadi:

| Parametr | Qiymat |
|---|---|
| Operatsion tizim | **Ubuntu 24.04** (yoki 22.04) |
| RAM | 1 GB (2 GB bo'lsa yaxshiroq) |
| Disk | 10 GB+ |
| Joylashuv | farqi yo'q; Yevropa/Rossiya/O'zbekiston |

Sotib olgandan keyin provayder sizga uchta narsa beradi: **IP manzil**, **root login** va **parol**.

## 2. Joylashtirish

Kompyuterda **Git Bash** oching (Windows'da Git bilan birga o'rnatilgan) va:

```bash
cd /d/saytlar/myfin
./deploy/push.sh root@SERVER_IP
```

`SERVER_IP` o'rniga serveringiz IP manzilini yozing. Birinchi ulanishda `yes` deb tasdiqlaysiz, keyin server
parolini kiritasiz. 5–10 daqiqadan so'ng oxirida sayt manzili chiqadi:

```
✔ Tayyor
  Sayt:    https://1-2-3-4.sslip.io
```

Skript nima qiladi:

- Node.js, Caddy (HTTPS), SQLite o'rnatadi
- kompyuteringizdagi `.env` (login/parol) va bazani serverga ko'chiradi — **faqat birinchi marta**
- saytni yig'adi va `myfin-web` xizmati sifatida ishga tushiradi (server o'chib yonsa ham o'zi turadi)
- `.env` da `TELEGRAM_BOT_TOKEN` bo'lsa, botni ham ishga tushiradi
- firewall'ni yoqadi (faqat SSH, 80, 443 ochiq)
- har kuni bazadan zaxira nusxa oladi (`/var/backups/myfin`, 14 kun)

Domen yo'q bo'lgani uchun manzil `IP.sslip.io` ko'rinishida bo'ladi — bu bepul xizmat, IP manzilingizga
nom beradi va shu tufayli HTTPS ishlaydi (parol shifrlangan holda uzatiladi).

## 3. Keyingi yangilanishlar — GitHub orqali

Kod GitHub'dagi private repoda turadi. Birinchi `push.sh` serverga alohida deploy kalitini qo'yadi va
GitHub'ga secret'larni (`SERVER_HOST`, `SERVER_USER`, `SERVER_PORT`, `SSH_PRIVATE_KEY`) yozadi.
Shundan keyin har bir o'zgarish uchun:

```bash
git add -A && git commit -m "o'zgarish tavsifi" && git push
```

GitHub Actions (`.github/workflows/deploy.yml`) kodni serverga yuboradi va saytni qayta yig'adi —
jarayonni repo sahifasidagi **Actions** bo'limida kuzatasiz. Serverdagi ma'lumotlar va `.env` saqlanib
qoladi, har yangilanishdan oldin bazaning nusxasi olinadi.

Server hali ulanmagan bo'lsa, Actions deploy'ni shunchaki o'tkazib yuboradi (xato bermaydi).
Xavfsizlik uchun GitHub'dan birinchi o'rnatish qilinmaydi — u faqat kompyuterdan `push.sh` orqali.

> Serverga ko'chgandan keyin faqat serverdagi saytdan foydalaning. Kompyuterdagi (`localhost:3100`)
> baza alohida — u yerga kiritilgan narsalar serverga o'tmaydi.

## Foydali buyruqlar (serverda, `ssh root@SERVER_IP` orqali)

| Nima | Buyruq |
|---|---|
| Sayt holati | `systemctl status myfin-web` |
| Sayt loglari | `journalctl -u myfin-web -n 100` |
| Bot loglari | `journalctl -u myfin-bot -n 100` |
| Qayta ishga tushirish | `systemctl restart myfin-web myfin-bot` |
| Hozir zaxira olish | `myfin-backup` |
| Zaxiralar ro'yxati | `ls -lh /var/backups/myfin` |

**Bot tokenini keyin qo'shish:** `nano /opt/myfin/.env` → `TELEGRAM_BOT_TOKEN="..."` →
`bash /opt/myfin/deploy/server-setup.sh`

**Parolni unutsangiz:** `nano /opt/myfin/.env` da `ADMIN_PASSWORD` ni o'zgartiring, keyin
`cd /opt/myfin && runuser -u myfin -- npm run reset-password`

**Zaxiradan tiklash:**

```bash
systemctl stop myfin-web myfin-bot
cp /var/backups/myfin/myfin-2026-10-01.db /opt/myfin/prisma/dev.db
chown myfin:myfin /opt/myfin/prisma/dev.db
systemctl start myfin-web myfin-bot
```

**Zaxirani kompyuterga yuklab olish** (kompyuterda, Git Bash):

```bash
scp "root@SERVER_IP:/var/backups/myfin/myfin-*.db" ~/Desktop/
```

## Keyinroq domen ulash

1. Domen DNS sozlamalarida `A` yozuvini server IP manziliga yo'naltiring.
2. Kompyuterda: `MYFIN_DOMAIN=fin.saytim.uz ./deploy/push.sh root@SERVER_IP`

## Agar HTTPS ochilmasa

`journalctl -u caddy -n 50` ni ko'ring. Sertifikat olinmagan bo'lsa, provayder panelida 80 va 443 portlar
ochiqligini tekshiring (ba'zi provayderlarda alohida "Firewall / Security group" bo'ladi).
