# MyFin — shaxsiy moliya platformasi

Har bir so'm qayerga ketganini 10 soniyada yozib olish va oy oxirida pul qayerga oqib ketganini ko'rish uchun.

## Stack

- **Next.js 14** (App Router, server actions) + **TypeScript** + **Tailwind CSS**
- **Prisma** + **SQLite** (`prisma/dev.db` — bitta fayl, server kerak emas)
- **Telegram bot** — alohida jarayon, long polling (HTTPS/webhook kerak emas)

## Ishga tushirish

```bash
npm install
cp .env.example .env     # ADMIN_LOGIN / ADMIN_PASSWORD ni o'zgartiring
npm run setup            # baza + birinchi foydalanuvchi + hisoblar + kategoriyalar
npm run dev              # http://localhost:3100
```

Login va parol `.env` dagi `ADMIN_LOGIN` / `ADMIN_PASSWORD`. Parolni keyin **Sozlamalar** sahifasida
almashtirish mumkin. Unutilsa: `.env` da yangisini yozib `npm run reset-password`.

## Telegram bot

1. [@BotFather](https://t.me/BotFather) da bot yarating, tokenni `.env` → `TELEGRAM_BOT_TOKEN` ga yozing.
2. `npm run bot`
3. Botga istalgan xabar yozing — u Telegram ID raqamingizni aytadi. Uni saytda **Sozlamalar → Telegram ID** ga kiriting.

| Xabar | Natija |
|---|---|
| `45000 taksi` | xarajat, Transport, asosiy naqd hisob |
| `120000 humo market` | xarajat, Humo kartasidan |
| `#biz 500000 reklama` | biznes xarajati |
| `+5000000 maosh` | daromad |
| `20$ kitob` | dollar hisobidan |
| `500000 humo > naqd` | o'tkazma (xarajat emas) |
| `qarz 200000 Ali 15.10` | qarz berdim, 15-oktabrda eslatma |
| `qarz oldim 1mln Vali 01.11` | qarz oldim |
| `/balans`, `/oy`, `/qarz` | qoldiqlar, oy xulosasi, ochiq qarzlar |

Bot taxminni ko'rsatadi va **✅ Tasdiqlash** tugmasi bosilgandan keyingina saqlaydi. Xarajat kategoriya
limitining 80% idan o'tsa ogohlantiradi. Xuddi shu sintaksis saytdagi **Tezkor kiritish** maydonida ham ishlaydi.

Kategoriya va hisob **kalit so'zlar** orqali taxmin qilinadi — ularni Sozlamalar va Hisoblar sahifalarida o'zgartirish mumkin.

## Sahifalar

- **Asosiy** — qoldiqlar, oy daromadi/xarajati, jamg'arma foizi, limitlar, so'nggi amallar, tezkor kiritish
- **Amallar** — xarajat / daromad / o'tkazma / valyuta ayirboshlash (kurs saqlanadi), filtrlar
- **Hisoblar** — naqd, karta, hamyon (UZS/USD); real qoldiq bilan solishtirish
- **Limitlar** — kategoriya bo'yicha oylik limit, o'tgan oy bilan solishtirish
- **Qarzlar** — berilgan/olingan qarzlar, muddat, yopish
- **Hisobot** — pul qayerga ketdi, shaxsiy va biznes, limitdan oshganlar, kunlik grafik
- **Sozlamalar** — USD kursi, jamg'arma maqsadi, Telegram ID, parol, kategoriyalar

## Tuzilishi

```
prisma/schema.prisma   # User, Session, Account, Category, Budget, Transaction, Debt
prisma/seed.ts         # birinchi foydalanuvchi va boshlang'ich ma'lumotlar
bot/index.ts           # Telegram bot
src/lib/parse.ts       # "45000 taksi" ni tahlil qilish (bot va veb uchun umumiy)
src/lib/finance.ts     # qoldiqlar, oylik statistika, limit ogohlantirishlari
src/lib/auth.ts        # sessiya (httpOnly cookie, bazada faqat token xeshi)
src/app/actions.ts     # barcha server action'lar
src/app/(app)/         # himoyalangan sahifalar
src/app/login/         # kirish
```

## Eslatmalar

- Hisob qoldig'i alohida saqlanmaydi — boshlang'ich qoldiq + amallardan hisoblanadi.
- Dollardagi amallar kiritilgan paytdagi kurs bo'yicha so'mga o'giriladi (`amountBase`) va hisobotlarga shunday kiradi.
- Oy va kun chegaralari Toshkent vaqti (UTC+5) bo'yicha.
- Internetga chiqarishda albatta HTTPS ortida ishlating va `prisma/dev.db` ni muntazam zaxiralang.
