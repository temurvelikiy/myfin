import { prisma } from "./prisma";
import { addDays, currentYm, dayStr, monthLabel, monthRange, monthShort, shiftYm, todayStr, weekStart } from "./dates";
import { fmt, pct } from "./format";
import { DICTS, fill, tn, type Dict } from "./i18n";
import { summarize } from "./credit";
import type { Acc, Cat, Parsed } from "./parse";

const PLUS = new Set(["INCOME", "DEBT_IN", "SAVING_OUT"]);
const round2 = (n: number) => Math.round(n * 100) / 100;

const UZ = DICTS.uz;

export const scopeLabel = (t: Dict): Record<string, string> => ({ PERSONAL: t.personal, BUSINESS: t.business });
export const typeLabel = (t: Dict): Record<string, string> => ({
  EXPENSE: t.expense,
  INCOME: t.income,
  TRANSFER: t.transfer,
  EXCHANGE: t.exchange,
  DEBT_OUT: t.debtOut,
  DEBT_IN: t.debtIn,
  SAVING_IN: t.typeSavingIn,
  SAVING_OUT: t.typeSavingOut,
});

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
  creditId?: string | null;
  goalId?: string | null;
};

export async function createTx(userId: string, d: TxInput) {
  if (!(d.amount > 0)) throw new Error("errAmount");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const account = await prisma.account.findFirst({ where: { id: d.accountId, userId } });
  if (!account) throw new Error("errAccount");

  let type = d.type;
  let toAccountId: string | null = null;
  let toAmount: number | null = null;
  let rate: number | null = null;
  let categoryId: string | null = null;

  if (type === "TRANSFER" || type === "EXCHANGE") {
    const to = await prisma.account.findFirst({ where: { id: d.toAccountId ?? "", userId } });
    if (!to || to.id === account.id) throw new Error("errToAccount");
    toAccountId = to.id;
    if (to.currency === account.currency) {
      type = "TRANSFER";
      toAmount = d.amount;
    } else {
      if (!d.toAmount || !(d.toAmount > 0)) throw new Error("errToAmount");
      type = "EXCHANGE";
      toAmount = d.toAmount;
      rate = round2(account.currency === "USD" ? toAmount / d.amount : d.amount / toAmount);
    }
  } else if (type === "EXPENSE" || type === "INCOME") {
    const cat = await prisma.category.findFirst({ where: { id: d.categoryId ?? "", userId, kind: type } });
    if (!cat) throw new Error("errCategory");
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
      creditId: d.creditId ?? null,
      goalId: d.goalId ?? null,
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
export async function limitWarning(userId: string, categoryId: string, t: Dict = UZ) {
  const stats = await monthStats(userId, currentYm());
  const c = stats.categories.find((x) => x.id === categoryId);
  if (!c || c.limit <= 0) return null;
  const p = pct(c.spent, c.limit);
  const name = `${c.icon} ${tn(t, c.name)}`;
  if (p > 100) return fill(t.limitOver, { c: name, v: fmt(c.spent - c.limit), s: fmt(c.spent), l: fmt(c.limit) });
  if (p >= 80) return fill(t.limitNear, { c: name, p, v: fmt(c.limit - c.spent) });
  return null;
}

export function describeParsed(p: Parsed, accounts: Acc[], categories: (Cat & { icon?: string })[], t: Dict = UZ) {
  const acc = (id?: string) => tn(t, accounts.find((a) => a.id === id)?.name ?? "?");
  const money = fmt(p.amount, p.currency);
  if (p.type === "TRANSFER") return `${t.transfer} · ${money} · ${acc(p.accountId)} → ${acc(p.toAccountId)}`;
  if (p.type === "DEBT") {
    const due = p.dueDate ? ` · ${fill(t.dueShort, { d: p.dueDate.split("-").reverse().join(".") })}` : "";
    return `${p.direction === "TAKEN" ? t.debtTook : t.debtGave} · ${money} · ${p.person} · ${acc(p.accountId)}${due}`;
  }
  const cat = categories.find((c) => c.id === p.categoryId);
  return `${typeLabel(t)[p.type]} · ${money} · ${cat?.icon ?? ""} ${cat ? tn(t, cat.name) : "?"} · ${acc(p.accountId)} · ${scopeLabel(t)[p.scope]}`;
}

export async function createDebt(
  userId: string,
  d: { direction: string; person: string; amount: number; currency: string; dueDate?: Date | null; note?: string; accountId?: string | null; source?: string; date?: Date },
) {
  if (!(d.amount > 0)) throw new Error("errAmount");
  if (!d.person) throw new Error("errPerson");
  const direction = d.direction === "TAKEN" ? "TAKEN" : "GIVEN";
  let account = null;
  if (d.accountId) {
    account = await prisma.account.findFirst({ where: { id: d.accountId, userId } });
    if (!account) throw new Error("errAccount");
    if (account.currency !== d.currency) throw new Error("errDebtCurrency");
  }
  const debt = await prisma.debt.create({
    data: { userId, direction, person: d.person.slice(0, 80), amount: round2(d.amount), currency: d.currency === "USD" ? "USD" : "UZS", dueDate: d.dueDate ?? null, note: (d.note ?? "").slice(0, 200) },
  });
  if (account)
    await createTx(userId, {
      type: direction === "GIVEN" ? "DEBT_OUT" : "DEBT_IN",
      amount: d.amount,
      accountId: account.id,
      note: debt.person,
      debtId: debt.id,
      source: d.source,
      date: d.date,
    });
  return debt;
}

// Tahlil qilingan yozuvni saqlaydi (bot va vebdagi tezkor kiritish uchun umumiy).
export async function saveParsed(userId: string, p: Parsed, source: "WEB" | "BOT", t: Dict = UZ) {
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
  const warning = p.type === "EXPENSE" && p.categoryId ? await limitWarning(userId, p.categoryId, t) : null;
  return { warning };
}

export type Bucket = { key: string; label: string; full: string; income: number; expense: number };

// Daromad va xarajat dinamikasi: so'nggi 30 kun, 12 hafta va 12 oy.
export async function trends(userId: string, t: Dict = UZ) {
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
  const months = make(monthKeys, (k) => monthShort(k, t), (k) => monthLabel(k, t));

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

export const debtLeft = (d: { amount: number; paid: number }) => Math.max(round2(d.amount - d.paid), 0);

// Qarzning bir qismini yoki hammasini qaytarish. GIVEN (men bergan) — pul hisobga qaytadi,
// TAKEN (men olgan) — pul hisobdan chiqadi. Qoldiq 0 bo'lsa qarz yopiladi.
export async function repayDebt(
  userId: string,
  debtId: string,
  d: { amount: number; accountId: string; date?: Date; source?: string },
) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, userId, status: "OPEN" } });
  if (!debt) throw new Error("debtNotFound");
  if (!(d.amount > 0)) throw new Error("errAmount");
  const left = debtLeft(debt);
  if (d.amount > left + 0.005) throw new Error(`errOverpay|${left}`);
  const account = await prisma.account.findFirst({ where: { id: d.accountId, userId } });
  if (!account) throw new Error("errAccount");
  if (account.currency !== debt.currency) throw new Error("errDebtCurrency");

  await createTx(userId, {
    type: debt.direction === "GIVEN" ? "DEBT_IN" : "DEBT_OUT",
    amount: d.amount,
    accountId: account.id,
    note: debt.person,
    debtId: debt.id,
    date: d.date,
    source: d.source,
  });
  const paid = round2(debt.paid + d.amount);
  const closed = paid >= debt.amount - 0.005;
  await prisma.debt.update({
    where: { id: debt.id },
    data: { paid, ...(closed ? { status: "CLOSED", closedAt: new Date() } : {}) },
  });
}

// Qaytarish yozuvi (tx) o'chirilsa, qarz qoldig'i va holati tiklanadi.
export async function undoDebtPayment(userId: string, tx: { debtId: string | null; type: string; amount: number }) {
  if (!tx.debtId) return;
  const debt = await prisma.debt.findFirst({ where: { id: tx.debtId, userId } });
  if (!debt) return;
  const isRepayment = (debt.direction === "GIVEN" && tx.type === "DEBT_IN") || (debt.direction === "TAKEN" && tx.type === "DEBT_OUT");
  if (!isRepayment) return;
  await prisma.debt.update({
    where: { id: debt.id },
    data: { paid: Math.max(round2(debt.paid - tx.amount), 0), status: "OPEN", closedAt: null },
  });
}

// ---------- Kredit ----------

export const CREDIT_CATEGORY = "Kredit to'lovi";

async function creditCategoryId(userId: string) {
  const cat = await prisma.category.upsert({
    where: { userId_name_kind: { userId, name: CREDIT_CATEGORY, kind: "EXPENSE" } },
    update: { archived: false },
    create: { userId, name: CREDIT_CATEGORY, kind: "EXPENSE", icon: "🏦", keywords: "kredit,credit,кредит,loan,ipoteka,ипотека,taksit" },
  });
  return cat.id;
}

export async function creditPaid(creditId: string) {
  const r = await prisma.transaction.aggregate({ where: { creditId, type: "EXPENSE" }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

export const termsOf = (c: { principal: number; rate: number; termMonths: number; kind: string; startDate: Date; payDay: number }) => ({
  principal: c.principal,
  rate: c.rate,
  termMonths: c.termMonths,
  kind: c.kind,
  startDate: c.startDate,
  payDay: c.payDay,
});

export async function createCredit(
  userId: string,
  d: { name: string; principal: number; rate: number; termMonths: number; kind: string; currency: string; startDate: Date; payDay: number; note?: string; accountId?: string | null },
) {
  if (!d.name) throw new Error("enterName");
  if (!(d.principal > 0)) throw new Error("errAmount");
  if (!(d.rate >= 0 && d.rate <= 200)) throw new Error("errCreditRate");
  if (!(Number.isInteger(d.termMonths) && d.termMonths >= 1 && d.termMonths <= 600)) throw new Error("errCreditTerm");
  if (!(Number.isInteger(d.payDay) && d.payDay >= 1 && d.payDay <= 31)) throw new Error("errPayDay");
  let account = null;
  if (d.accountId) {
    account = await prisma.account.findFirst({ where: { id: d.accountId, userId } });
    if (!account) throw new Error("errAccount");
    if (account.currency !== d.currency) throw new Error("errDebtCurrency");
  }
  const credit = await prisma.credit.create({
    data: {
      userId,
      name: d.name.slice(0, 80),
      principal: round2(d.principal),
      rate: d.rate,
      termMonths: d.termMonths,
      kind: d.kind === "DIFFERENTIATED" ? "DIFFERENTIATED" : "ANNUITY",
      currency: d.currency === "USD" ? "USD" : "UZS",
      startDate: d.startDate,
      payDay: d.payDay,
      note: (d.note ?? "").slice(0, 200),
    },
  });
  // Kredit puli hisobga tushdi: daromad emas, qarz kirimi (DEBT_IN) — qoldiqqa qo'shiladi.
  if (account)
    await createTx(userId, { type: "DEBT_IN", amount: d.principal, accountId: account.id, note: credit.name, creditId: credit.id, date: d.startDate });
  return credit;
}

// Kredit to'lovi: oddiy xarajat ("Kredit to'lovi" kategoriyasi), creditId bilan bog'lanadi.
export async function payCredit(
  userId: string,
  creditId: string,
  d: { amount: number; accountId: string; date?: Date; source?: string },
) {
  const credit = await prisma.credit.findFirst({ where: { id: creditId, userId, status: "OPEN" } });
  if (!credit) throw new Error("creditNotFound");
  const account = await prisma.account.findFirst({ where: { id: d.accountId, userId } });
  if (!account) throw new Error("errAccount");
  if (account.currency !== credit.currency) throw new Error("errDebtCurrency");

  await createTx(userId, {
    type: "EXPENSE",
    amount: d.amount,
    accountId: account.id,
    categoryId: await creditCategoryId(userId),
    note: credit.name,
    creditId: credit.id,
    date: d.date,
    source: d.source,
  });
  const sum = summarize(termsOf(credit), await creditPaid(credit.id));
  if (sum.left <= 0.5) await prisma.credit.update({ where: { id: credit.id }, data: { status: "CLOSED" } });
}

export async function undoCreditPayment(userId: string, tx: { creditId: string | null; type: string }) {
  if (!tx.creditId || tx.type !== "EXPENSE") return;
  await prisma.credit.updateMany({ where: { id: tx.creditId, userId }, data: { status: "OPEN" } });
}

// Kreditlar to'langan summa va to'lov jadvali xulosasi bilan.
export async function getCredits(userId: string) {
  const [credits, paid] = await Promise.all([
    prisma.credit.findMany({ where: { userId }, orderBy: [{ status: "desc" }, { createdAt: "desc" }] }),
    prisma.transaction.groupBy({ by: ["creditId"], where: { userId, creditId: { not: null }, type: "EXPENSE" }, _sum: { amount: true } }),
  ]);
  const paidBy = new Map(paid.map((r) => [r.creditId, r._sum.amount ?? 0]));
  return credits.map((c) => {
    const p = paidBy.get(c.id) ?? 0;
    return { ...c, paid: p, ...summarize(termsOf(c), p) };
  });
}

// ---------- Jamg'arma (pul yig'ish) ----------

// Maqsadlar yig'ilgan summa bilan: SAVING_IN − SAVING_OUT.
export async function getGoals(userId: string) {
  const [goals, sums] = await Promise.all([
    prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.groupBy({ by: ["goalId", "type"], where: { userId, goalId: { not: null } }, _sum: { amount: true } }),
  ]);
  return goals.map((g) => {
    let saved = 0;
    for (const r of sums) if (r.goalId === g.id) saved += (r.type === "SAVING_IN" ? 1 : r.type === "SAVING_OUT" ? -1 : 0) * (r._sum.amount ?? 0);
    saved = Math.max(round2(saved), 0);
    return { ...g, saved, left: Math.max(round2(g.target - saved), 0), done: saved >= g.target - 0.005 };
  });
}

export async function createGoal(
  userId: string,
  d: { name: string; target: number; currency: string; deadline?: Date | null; note?: string; image?: string | null },
) {
  if (!d.name) throw new Error("enterName");
  if (!(d.target > 0)) throw new Error("errAmount");
  return prisma.goal.create({
    data: {
      userId,
      name: d.name.slice(0, 60),
      target: round2(d.target),
      currency: d.currency === "USD" ? "USD" : "UZS",
      deadline: d.deadline ?? null,
      note: (d.note ?? "").slice(0, 200),
      image: d.image ?? null,
    },
  });
}

// Maqsadni tahrirlash. image: undefined — o'zgarmaydi, null — olib tashlanadi, matn — yangi rasm.
export async function updateGoal(
  userId: string,
  id: string,
  d: { name: string; target: number; deadline: Date | null; note: string; image?: string | null },
) {
  if (!d.name) throw new Error("enterName");
  if (!(d.target > 0)) throw new Error("errAmount");
  const r = await prisma.goal.updateMany({
    where: { id, userId },
    data: { name: d.name.slice(0, 60), target: round2(d.target), deadline: d.deadline, note: d.note.slice(0, 200), ...(d.image !== undefined ? { image: d.image } : {}) },
  });
  if (!r.count) throw new Error("errGoal");
}

// Jamg'armaga pul qo'shish (hisobdan chiqadi) yoki yechish (hisobga qaytadi).
export async function saveToGoal(
  userId: string,
  goalId: string,
  d: { amount: number; accountId: string; withdraw?: boolean; date?: Date; note?: string; source?: string },
) {
  if (!(d.amount > 0)) throw new Error("errAmount");
  const goal = (await getGoals(userId)).find((g) => g.id === goalId);
  if (!goal) throw new Error("errGoal");
  const account = await prisma.account.findFirst({ where: { id: d.accountId, userId } });
  if (!account) throw new Error("errAccount");
  if (account.currency !== goal.currency) throw new Error("errDebtCurrency");
  if (d.withdraw && d.amount > goal.saved + 0.005) throw new Error(`errGoalOver|${goal.saved}`);

  await createTx(userId, {
    type: d.withdraw ? "SAVING_OUT" : "SAVING_IN",
    amount: d.amount,
    accountId: account.id,
    goalId: goal.id,
    note: d.note,
    date: d.date,
    source: d.source,
  });
}
