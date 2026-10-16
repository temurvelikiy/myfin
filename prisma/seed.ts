// Birinchi foydalanuvchi + boshlang'ich hisoblar va kategoriyalar.
// Qayta ishga tushirish xavfsiz: mavjud ma'lumotlarga tegmaydi.
//   npm run db:seed            -> foydalanuvchi yo'q bo'lsa yaratadi
//   npm run reset-password     -> parolni .env dagi ADMIN_PASSWORD ga almashtiradi
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const ACCOUNTS = [
  { name: "Naqd UZS", kind: "CASH", currency: "UZS", keywords: "naqd,nalichka,cash", isDefault: true },
  { name: "Naqd USD", kind: "CASH", currency: "USD", keywords: "dollar,usd,valyuta" },
  { name: "Uzcard", kind: "CARD", currency: "UZS", keywords: "uzcard,uzkard,karta" },
  { name: "Humo", kind: "CARD", currency: "UZS", keywords: "humo,xumo" },
  { name: "Payme", kind: "WALLET", currency: "UZS", keywords: "payme,payma" },
  { name: "Click", kind: "WALLET", currency: "UZS", keywords: "click,klik" },
];

const EXPENSE = [
  ["Oziq-ovqat", "🛒", "market,bozor,korzinka,makro,havas,oziq,non,go'sht,meva,sabzavot,magazin,do'kon"],
  ["Ovqatlanish", "🍽️", "tushlik,kafe,restoran,obed,ovqat,kofe,choy,lavash,fastfud,nonushta,kechki,osh,somsa"],
  ["Transport", "🚕", "taksi,yandex,metro,avtobus,benzin,zapravka,metan,moyka,parkovka,mashina,yo'l"],
  ["Uy va kommunal", "🏠", "ijara,kvartira,svet,elektr,suv,kommunal,internet,uy,remont"],
  ["Aloqa", "📱", "telefon,beeline,ucell,uzmobile,mobiuz,aloqa,paynet,tarif"],
  ["Sog'liq", "💊", "dorixona,apteka,dori,shifokor,vrach,klinika,analiz,tish,sport,zal"],
  ["Kiyim", "👕", "kiyim,poyabzal,krossovka,kurtka,shim,ko'ylak"],
  ["Ko'ngilochar", "🎬", "kino,o'yin,sayohat,netflix,obuna,dam,konsert"],
  ["Ta'lim", "📚", "kurs,kitob,ta'lim,o'qish,trening"],
  ["Oila va sovg'a", "🎁", "sovg'a,to'y,oila,bolalar,ehson,ota-ona"],
  ["Reklama", "📣", "reklama,target,ads,instagram,facebook,google,smm"],
  ["Xodimlar", "👥", "oylik,xodim,frilanser,dizayner,mobilograf,kopirayter"],
  ["Servislar", "💻", "servis,hosting,domen,server,canva,chatgpt,claude,figma,crm,podpiska"],
  ["Ofis", "🏢", "ofis,arenda,kantselyariya,kovorking"],
  ["Soliq va komissiya", "🧾", "soliq,komissiya,bank,jarima"],
  ["Kredit to'lovi", "🏦", "kredit,credit,кредит,loan,ipoteka,ипотека,taksit"],
  ["Boshqa", "📦", ""],
  ["Tuzatish", "⚖️", ""],
];

const INCOME = [
  ["Maosh", "💼", "maosh,oylik,zarplata,avans"],
  ["Mijoz to'lovi", "🤝", "mijoz,klient,to'lov,loyiha,shartnoma,oplata"],
  ["Boshqa daromad", "💰", ""],
  ["Tuzatish", "⚖️", ""],
];

// Rus, ingliz va turk tillaridagi kalit so'zlar: "45000 такси", "45000 taxi" ham Transportga tushadi.
// Mavjud foydalanuvchilarda ham qayta seed qilinganda qo'shiladi (eski so'zlar saqlanadi).
const EXTRA_KEYWORDS: Record<string, string> = {
  "Naqd UZS": "наличные,нал,наличка,cash,nakit",
  "Naqd USD": "доллар,dolar",
  Uzcard: "узкард",
  Humo: "хумо",
  Payme: "пейми",
  Click: "клик",
  "Oziq-ovqat": "продукты,магазин,рынок,супермаркет,хлеб,мясо,фрукты,groceries,grocery,supermarket,market,bread,meat,fruit,bakkal,ekmek,et,meyve,manav",
  Ovqatlanish: "обед,кафе,ресторан,кофе,ужин,завтрак,еда,lunch,cafe,restaurant,coffee,dinner,breakfast,food,öğle,kafe,restoran,kahve,akşam,kahvaltı,yemek",
  Transport: "такси,метро,автобус,бензин,заправка,парковка,taxi,bus,fuel,gas,parking,uber,taksi,otobüs,benzin,otopark",
  "Uy va kommunal": "аренда,квартира,свет,вода,коммуналка,интернет,rent,electricity,water,utilities,internet,kira,elektrik,su,fatura",
  Aloqa: "телефон,связь,мобильный,phone,mobile,telefon,hat",
  "Sog'liq": "аптека,лекарство,врач,клиника,анализ,стоматолог,pharmacy,medicine,doctor,clinic,dentist,eczane,ilaç,doktor,klinik,diş",
  Kiyim: "одежда,обувь,кроссовки,куртка,clothes,shoes,sneakers,jacket,kıyafet,giyim,ayakkabı,ceket",
  "Ko'ngilochar": "кино,игры,отдых,подписка,путешествие,movie,cinema,games,subscription,travel,sinema,oyun,abonelik,tatil",
  "Ta'lim": "курс,книга,учеба,обучение,course,book,education,study,kurs,kitap,eğitim",
  "Oila va sovg'a": "подарок,свадьба,семья,дети,gift,wedding,family,kids,hediye,düğün,aile,çocuk",
  Reklama: "реклама,таргет,ads,advertising,reklam",
  Xodimlar: "зарплата,сотрудник,фрилансер,дизайнер,staff,employee,freelancer,designer,personel,çalışan",
  Servislar: "сервис,хостинг,домен,сервер,service,hosting,domain,subscription,servis,sunucu",
  Ofis: "офис,канцелярия,office,stationery,ofis,kırtasiye",
  "Soliq va komissiya": "налог,комиссия,банк,штраф,tax,fee,commission,bank,fine,vergi,komisyon,ceza",
  Maosh: "зарплата,аванс,salary,wage,paycheck,maaş",
  "Mijoz to'lovi": "клиент,оплата,проект,договор,client,customer,payment,invoice,project,müşteri,ödeme,proje",
};

const mergeKeywords = (a: string, b: string) => [...new Set([...a.split(","), ...b.split(",")].map((k) => k.trim().toLowerCase()).filter(Boolean))].join(",");

async function main() {
  const login = (process.env.ADMIN_LOGIN ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!login || password.length < 8) throw new Error(".env: ADMIN_LOGIN va kamida 8 belgili ADMIN_PASSWORD kerak");

  let user = await prisma.user.findUnique({ where: { login } });
  if (!user) {
    user = await prisma.user.create({ data: { login, passwordHash: hashPassword(password) } });
    console.log(`Foydalanuvchi yaratildi: ${login}`);
  } else if (process.argv.includes("--reset-password")) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    console.log(`Parol yangilandi: ${login}`);
  }

  if (!(await prisma.account.count({ where: { userId: user.id } }))) {
    await prisma.account.createMany({ data: ACCOUNTS.map((a, i) => ({ ...a, userId: user.id, sort: i })) });
    console.log(`${ACCOUNTS.length} ta hisob qo'shildi`);
  }
  if (!(await prisma.category.count({ where: { userId: user.id } }))) {
    const row = (kind: string) => ([name, icon, keywords]: string[]) => ({ userId: user.id, kind, name, icon, keywords });
    await prisma.category.createMany({ data: [...EXPENSE.map(row("EXPENSE")), ...INCOME.map(row("INCOME"))] });
    console.log(`${EXPENSE.length + INCOME.length} ta kategoriya qo'shildi`);
  }

  // Ko'p tilli kalit so'zlarni standart hisob va kategoriyalarga qo'shish.
  for (const [name, words] of Object.entries(EXTRA_KEYWORDS)) {
    for (const acc of await prisma.account.findMany({ where: { userId: user.id, name } }))
      await prisma.account.update({ where: { id: acc.id }, data: { keywords: mergeKeywords(acc.keywords, words) } });
    for (const cat of await prisma.category.findMany({ where: { userId: user.id, name } }))
      await prisma.category.update({ where: { id: cat.id }, data: { keywords: mergeKeywords(cat.keywords, words) } });
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
