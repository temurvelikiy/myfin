import { prisma } from "./prisma";
import { addDays, currentYm, dayStr, monthLabel, monthRange, monthShort, shiftYm, todayStr, weekStart } from "./dates";
import { fmt, pct } from "./format";
import type { Acc, Cat, Parsed } from "./parse";

const PLUS = new Set(["INCOME", "DEBT_IN"]);
const round2 = (n: number) => Math.round(n * 100) / 100;

export const SCOPE_LABEL: Record<string, string> = { PERSONAL: "Shaxsiy", BUSINESS: "Biznes" };
export const TYPE_LABEL: Record<string, string> = {
  EXPENSE: "Xarajat",
  INCOME: "Daromad",
  TRANSFER: "O'tkazma",
  EXCHANGE: "Ayirboshlash",
  DEBT_OUT: "Qarz (chiqim)",
  DEBT_IN: "Qarz (kirim)",
};

// Qoldiq = boshlang'ich summa + barcha amallar. Alohida saqlanmaydi, shuning uchun buzilmaydi.
export async function getAccounts(userId: string, includeArchived = false) {
  const [accounts, out, inn] = await Promise.all([
    prisma.account.findMany({
      where: { userId, ...(includeArchived ? {} : { archived: false }) },
      orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    }),
    prisma.transaction.groupBy({ by: ["accountId", "type"], where: { userId }, _sum: { amount: true } }),
    prisma.transaction.groupBy({
      by: ["toAccountId"],
      where: { userId, toAccountId: { not: null } },
      _sum: { toAmount: true },
    }),
  ]);
  return accounts.map((a) => {
    let balance = a.initial;
    for (const r of out) if (r.accountId === a.id) balance += (PLUS.has(r.type) ? 1 : -1) * (r._sum.amount ?? 0);
    for (const r of inn) if (r.toAccountId === a.id) balance += r._sum.toAmount ?? 0;
    return { ...a, balance: round2(balance) };
  });
}

export type TxInput = {
  type: string;
  amount: number;
  accountId: string;
  scope?: string;
  toAccountId?: string | null;
  toAmount?: number | null;
  categoryId?: string | null;
  note?: string;
  date?: Date;
  source?: string;
  debtId?: string | null;
};

export async function createTx(userId: string, d: TxInput) {
  if (!(d.amount > 0)) throw new Error("Summa noto'g'ri");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const account = await prisma.account.findFirst({ where: { id: d.accountId, userId } });
  if (!account) throw new Error("Hisob topilmadi");

  let type = d.type;
  let toAccountId: string | null = null;
  let toAmount: number | null = null;
  let rate: number | null = null;
  let categoryId: string | null = null;

  if (type === "TRANSFER" || type === "EXCHANGE") {
    const to = await prisma.account.findFirst({ where: { id: d.toAccountId ?? "", userId } });
    if (!to || to.id === account.id) throw new Error("Qabul qiluvchi hisobni tanlang");
    toAccountId = to.id;
    if (to.currency === account.currency) {
      type = "TRANSFER";
      toAmount = d.amount;
    } else {
      if (!d.toAmount || !(d.toAmount > 0)) throw new Error("Olingan summani kiriting");
      type = "EXCHANGE";
      toAmount = d.toAmount;
      rate = round2(account.currency === "USD" ? toAmount / d.amount : d.amount / toAmount);
    }
  } else if (type === "EXPENSE" || type === "INCOME") {
    const cat = await prisma.category.findFirst({ where: { id: d.categoryId ?? "", userId, kind: type } });
    if (!cat) throw new Error("Kategoriyani tanlang");
    categoryId = cat.id;
  }

  return prisma.transaction.create({
    data: {
      userId,
      type,
      scope: d.scope === "BUSINESS" ? "BUSINESS" : "PERSONAL",
      amount: round2(d.amount),
      accountId: account.id,
      toAccountId,
      toAmount,
      rate,
      categoryId,
      amountBase: round2(account.currency === "USD" ? d.amount * user.usdRate : d.amount),
      note: (d.note ?? "").slice(0, 200),
      date: d.date ?? new Date(),
      source: d.source ?? "WEB",
      debtId: d.debtId ?? null,
    },
  });
}

export async function monthStats(userId: string, ym: string) {
  const { start, end } = monthRange(ym);
  const [rows, cats, budgets] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type", "scope", "categoryId"],
      where: { userId, date: { gte: start, lt: end }, type: { in: ["EXPENSE", "INCOME"] } },
      _sum: { amountBase: true },
    }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.budget.findMany({ where: { userId, month: { lte: ym } }, orderBy: { month: "desc" } }),
  ]);

  const limits = new Map<string, number>();
  for (const b of budgets) if (!limits.has(b.categoryId)) limits.set(b.categoryId, b.limit);

  let income = 0, expense = 0, personal = 0, business = 0, businessIncome = 0;
  const byCat = new Map<string, { personal: number; business: number }>();
  for (const r of rows) {
    const v = r._sum.amountBase ?? 0;
    if (r.type === "INCOME") {
      income += v;
      if (r.scope === "BUSINESS") businessIncome += v;
      continue;
    }
    expense += v;
    if (r.scope === "BUSINESS") business += v;
    else personal += v;
    const c = byCat.get(r.categoryId ?? "") ?? { personal: 0, business: 0 };
    if (r.scope === "BUSINESS") c.business += v;
    else c.personal += v;
    byCat.set(r.categoryId ?? "", c);
  }

  const categories = cats
    .filter((c) => c.kind === "EXPENSE")
    .map((c) => {
      const s = byCat.get(c.id) ?? { personal: 0, business: 0 };
      return { id: c.id, name: c.name, icon: c.icon, archived: c.archived, ...s, spent: s.personal + s.business, limit: limits.get(c.id) ?? 0 };
    });

  return {
    income,
    expense,
    personal,
    business,
    businessIncome,
    saved: income - expense,
    savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
    categories,
    overLimit: categories.filter((c) => c.limit > 0 && c.spent > c.limit),
  };
}

// Xarajatdan keyin: limitning 80% idan o'tgan bo'lsa ogohlantirish matni qaytadi.
export async function limitWarning(userId: string, categoryId: string) {
  const stats = await monthStats(userId, currentYm());
  const c = stats.categories.find((x) => x.id === categoryId);
  if (!c || c.limit <= 0) return null;
  const p = pct(c.spent, c.limit);
  if (p > 100) return `🚨 ${c.icon} ${c.name}: limit ${fmt(c.spent - c.limit)} ga oshdi (${fmt(c.spent)} / ${fmt(c.limit)})`;
  if (p >= 80) return `⚠️ ${c.icon} ${c.name}: limitning ${p}% i ishlatildi, ${fmt(c.limit - c.spent)} qoldi`;
  return null;
}

export function describeParsed(p: Parsed, accounts: Acc[], categories: (Cat & { icon?: string })[]) {
  const acc = (id?: string) => accounts.find((a) => a.id === id)?.name ?? "?";
  const money = fmt(p.amount, p.currency);
  if (p.type === "TRANSFER") return `O'tkazma · ${money} · ${acc(p.accountId)} → ${acc(p.toAccountId)}`;
  if (p.type === "DEBT") {
    const due = p.dueDate ? ` · muddat ${p.dueDate.split("-").reverse().join(".")}` : "";
    return `${p.direction === "TAKEN" ? "Qarz oldim" : "Qarz berdim"} · ${money} · ${p.person} · ${acc(p.accountId)}${due}`;
  }
  const cat = categories.find((c) => c.id === p.categoryId);
  return `${TYPE_LABEL[p.type]} · ${money} · ${cat?.icon ?? ""} ${cat?.name ?? "?"} · ${acc(p.accountId)} · ${SCOPE_LABEL[p.scope]}`;
}

export async function createDebt(
  userId: string,
  d: { direction: string; person: string; amount: number; currency: string; dueDate?: Date | null; note?: string; accountId?: string | null; source?: string },
) {
  if (!(d.amount > 0)) throw new Error("Summa noto'g'ri");
  if (!d.person) throw new Error("Ismni kiriting");
  const direction = d.direction === "TAKEN" ? "TAKEN" : "GIVEN";
  let account = null;
  if (d.accountId) {
    account = await prisma.account.findFirst({ where: { id: d.accountId, userId } });
    if (!account) throw new Error("Hisob topilmadi");
    if (account.currency !== d.currency) throw new Error("Hisob valyutasi qarz valyutasiga mos emas");
  }
  const debt = await prisma.debt.create({
    data: { userId, direction, person: d.person.slice(0, 80), amount: round2(d.amount), currency: d.currency === "USD" ? "USD" : "UZS", dueDate: d.dueDate ?? null, note: (d.note ?? "").slice(0, 200) },
  });
  if (account)
    await createTx(userId, {
      type: direction === "GIVEN" ? "DEBT_OUT" : "DEBT_IN",
      amount: d.amount,
      accountId: account.id,
      note: `Qarz: ${debt.person}`,
      debtId: debt.id,
      source: d.source,
    });
  return debt;
}

// Tahlil qilingan yozuvni saqlaydi (bot va vebdagi tezkor kiritish uchun umumiy).
export async function saveParsed(userId: string, p: Parsed, source: "WEB" | "BOT") {
  if (p.type === "DEBT") {
    await createDebt(userId, {
      direction: p.direction ?? "GIVEN",
      person: p.person ?? "",
      amount: p.amount,
      currency: p.currency,
      dueDate: p.dueDate ? new Date(`${p.dueDate}T12:00:00+05:00`) : null,
      accountId: p.accountId,
      source,
    });
    return { warning: null as string | null };
  }
  await createTx(userId, { ...p, source });
  const warning = p.type === "EXPENSE" && p.categoryId ? await limitWarning(userId, p.categoryId) : null;
  return { warning };
}

export type Bucket = { key: string; label: string; full: string; income: number; expense: number };

// Daromad va xarajat dinamikasi: so'nggi 30 kun, 12 hafta va 12 oy.
export async function trends(userId: string) {
  const today = todayStr();
  const ym = currentYm();
  const dm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`;
  const make = (keys: string[], label: (k: string) => string, full: (k: string) => string) =>
    new Map(keys.map((k) => [k, { key: k, label: label(k), full: full(k), income: 0, expense: 0 } as Bucket]));

  const monthKeys = Array.from({ length: 12 }, (_, i) => shiftYm(ym, i - 11));
  const days = make(Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)), (k) => String(Number(k.slice(8))), dm);
  const weeks = make(
    Array.from({ length: 12 }, (_, i) => addDays(weekStart(today), (i - 11) * 7)),
    dm,
    (k) => `${dm(k)} – ${dm(addDays(k, 6))}`,
  );
  const months = make(monthKeys, monthShort, monthLabel);

  const txs = await prisma.transaction.findMany({
    where: { userId, type: { in: ["EXPENSE", "INCOME"] }, date: { gte: monthRange(monthKeys[0]).start } },
    select: { date: true, type: true, amountBase: true },
  });
  for (const t of txs) {
    const d = dayStr(t.date);
    const field = t.type === "INCOME" ? "income" : "expense";
    for (const b of [days.get(d), weeks.get(weekStart(d)), months.get(d.slice(0, 7))]) if (b) b[field] += t.amountBase;
  }
  return { days: [...days.values()], weeks: [...weeks.values()], months: [...months.values()] };
}
