"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createCredit,
  createDebt,
  createGoal,
  getGoals,
  saveToGoal,
  createTx,
  debtLeft,
  describeParsed,
  getAccounts,
  payCredit,
  repayDebt,
  saveParsed,
  undoCreditPayment,
  undoDebtPayment,
} from "@/lib/finance";
import { parseEntry } from "@/lib/parse";
import { parseDay, validDay, validYm } from "@/lib/dates";
import { fill, isLang, tMsg, type Dict } from "@/lib/i18n";
import { getT, LANG_COOKIE } from "@/lib/lang";

export type State = { error?: string; ok?: string; at?: number };

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[\s ]/g, "").replace(",", ".");
  return s === "" ? NaN : Number(s);
};
const str = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);
const done = (ok: string): State => {
  revalidatePath("/", "layout");
  return { ok, at: Date.now() };
};
// Xato matni tarjima kaliti bo'lsa ("errAmount"), joriy tilga o'giriladi.
const fail = (e: unknown): State => {
  const t = getT();
  return { error: e instanceof Error ? tMsg(t, e.message) : t.genericError, at: Date.now() };
};
type MsgKey = { [K in keyof Dict]: Dict[K] extends string ? K : never }[keyof Dict];
const err = (key: MsgKey, vars: Record<string, string | number> = {}): State => ({
  error: fill(getT()[key], vars),
  at: Date.now(),
});

// ---------- Til ----------

export async function setLang(lang: string) {
  if (!isLang(lang)) return;
  cookies().set(LANG_COOKIE, lang, { path: "/", maxAge: 365 * 864e2, sameSite: "lax" });
  revalidatePath("/", "layout");
}

// ---------- Kirish ----------

// Parol tanlashga qarshi: bitta login uchun 15 daqiqada 5 ta xato urinish.
const attempts = new Map<string, { n: number; until: number }>();

export async function login(_: State, fd: FormData): Promise<State> {
  const name = str(fd.get("login"), 64).toLowerCase();
  const password = String(fd.get("password") ?? "");
  const now = Date.now();
  const a = attempts.get(name);
  if (a && a.until > now && a.n >= 5) return err("tooManyAttempts");

  const user = await prisma.user.findUnique({ where: { login: name } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    attempts.set(name, { n: (a && a.until > now ? a.n : 0) + 1, until: now + 15 * 60e3 });
    return err("wrongLogin");
  }
  attempts.delete(name);
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function changePassword(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const next = String(fd.get("next") ?? "");
  if (!verifyPassword(String(fd.get("current") ?? ""), user.passwordHash)) return err("wrongCurrentPassword");
  if (next.length < 8) return err("passwordMin");
  if (next !== String(fd.get("repeat") ?? "")) return err("passwordMismatch");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  // Boshqa qurilmalardagi sessiyalar yopiladi, joriysi yangilanadi.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  return done(getT().passwordUpdated);
}

// ---------- Tezkor kiritish ----------

async function parseFor(userId: string, text: string) {
  const [accounts, categories] = await Promise.all([
    getAccounts(userId),
    prisma.category.findMany({ where: { userId, archived: false }, orderBy: { name: "asc" } }),
  ]);
  return { accounts, categories, parsed: parseEntry(text.slice(0, 300), accounts, categories) };
}

export async function previewQuick(text: string) {
  const user = await requireUser();
  const { accounts, categories, parsed } = await parseFor(user.id, text);
  const t = getT();
  if ("error" in parsed) return { error: fill(tMsg(t, parsed.error), parsed.vars ?? {}) };
  return { parsed, summary: describeParsed(parsed, accounts, categories, t) };
}

export async function confirmQuick(text: string, accountId?: string, categoryId?: string) {
  const user = await requireUser();
  const { accounts, categories, parsed } = await parseFor(user.id, text);
  const t = getT();
  if ("error" in parsed) return { error: fill(tMsg(t, parsed.error), parsed.vars ?? {}) };
  const acc = accounts.find((a) => a.id === accountId);
  if (acc && parsed.type !== "TRANSFER") {
    parsed.accountId = acc.id;
    parsed.currency = acc.currency;
  }
  if (categories.some((c) => c.id === categoryId && c.kind === parsed.type)) parsed.categoryId = categoryId;
  try {
    const { warning } = await saveParsed(user.id, parsed, "WEB", t);
    revalidatePath("/", "layout");
    return { ok: describeParsed(parsed, accounts, categories, t), warning };
  } catch (e) {
    return { error: fail(e).error };
  }
}

// ---------- Amallar ----------

export async function addTransaction(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const type = str(fd.get("type"), 20);
  const amount = num(fd.get("amount"));
  let categoryId = str(fd.get("categoryId")) || null;

  // Formadan qo'lda kiritilgan yangi kategoriya: bo'lmasa yaratiladi, arxivda bo'lsa qaytariladi.
  const newCategory = str(fd.get("newCategory"), 40);
  if (newCategory && amount > 0 && (type === "EXPENSE" || type === "INCOME")) {
    const cat = await prisma.category.upsert({
      where: { userId_name_kind: { userId: user.id, name: newCategory, kind: type } },
      update: { archived: false },
      create: { userId: user.id, name: newCategory, kind: type, icon: "🏷️", keywords: newCategory.toLowerCase() },
    });
    categoryId = cat.id;
  }

  const accountId = str(fd.get("accountId"));
  const date = parseDay(str(fd.get("date"), 10));
  const pick = categoryId ?? "";

  // Pul yig'ish: maqsadga qo'shish / yechish (yangi maqsad ham shu yerda yaratiladi).
  if (type === "SAVING") {
    const withdraw = fd.get("savingKind") === "out";
    let goalId = str(fd.get("goalId"));
    try {
      if (!(amount > 0)) return err("errAmount");
      if (goalId === "__goal_new") {
        const acc = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
        if (!acc) return err("errAccount");
        const dl = str(fd.get("goalDeadline"), 10);
        const g = await createGoal(user.id, {
          name: str(fd.get("goalName"), 60),
          target: num(fd.get("goalTarget")),
          currency: acc.currency,
          deadline: validDay(dl) ? new Date(`${dl}T12:00:00+05:00`) : null,
        });
        goalId = g.id;
      }
      await saveToGoal(user.id, goalId, { amount, accountId, withdraw, date, note: str(fd.get("note")) });
    } catch (e) {
      return fail(e);
    }
    return done(withdraw ? getT().goalWithdrawOk : getT().goalDepositOk);
  }

  // Kategoriya ro'yxatidagi qarz va kredit bandlari: yangi qarz, qarzni qaytarish, kredit to'lovi.
  if (pick === "__debt_new" || pick.startsWith("debt:") || pick.startsWith("credit:")) {
    try {
      if (pick === "__debt_new") {
        const acc = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
        if (!acc) return err("errAccount");
        const due = str(fd.get("dueDate"), 10);
        await createDebt(user.id, {
          // Xarajat — men qarz berdim, daromad — men qarz oldim.
          direction: type === "EXPENSE" ? "GIVEN" : "TAKEN",
          person: str(fd.get("person"), 80),
          amount,
          currency: acc.currency,
          dueDate: validDay(due) ? new Date(`${due}T12:00:00+05:00`) : null,
          note: str(fd.get("note")),
          accountId,
          date,
        });
      } else if (pick.startsWith("debt:")) {
        await repayDebt(user.id, pick.slice(5), { amount, accountId, date });
      } else {
        await payCredit(user.id, pick.slice(7), { amount, accountId, date });
      }
    } catch (e) {
      return fail(e);
    }
    return done(getT().saved);
  }

  try {
    await createTx(user.id, {
      type,
      amount,
      accountId,
      toAccountId: str(fd.get("toAccountId")) || null,
      toAmount: num(fd.get("toAmount")) || null,
      categoryId,
      scope: str(fd.get("scope"), 20),
      note: str(fd.get("note")),
      date,
    });
  } catch (e) {
    return fail(e);
  }
  return done(getT().saved);
}

export async function deleteTransaction(fd: FormData) {
  const user = await requireUser();
  const tx = await prisma.transaction.findFirst({ where: { id: str(fd.get("id")), userId: user.id } });
  if (tx) {
    await prisma.transaction.delete({ where: { id: tx.id } });
    await undoDebtPayment(user.id, tx);
    await undoCreditPayment(user.id, tx);
  }
  revalidatePath("/", "layout");
}

// ---------- Hisoblar ----------

export async function saveAccount(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const id = str(fd.get("id"));
  const name = str(fd.get("name"), 40);
  const initial = num(fd.get("initial"));
  if (!name) return err("enterName");
  const data = {
    name,
    keywords: str(fd.get("keywords"), 120).toLowerCase(),
    initial: Number.isFinite(initial) ? initial : 0,
    isDefault: fd.get("isDefault") === "on",
  };
  let currency: string;
  if (id) {
    const acc = await prisma.account.findFirst({ where: { id, userId: user.id } });
    if (!acc) return err("errAccount");
    currency = acc.currency;
    await prisma.account.update({ where: { id }, data });
  } else {
    currency = fd.get("currency") === "USD" ? "USD" : "UZS";
    const kind = ["CASH", "CARD", "WALLET"].includes(str(fd.get("kind"))) ? str(fd.get("kind")) : "CASH";
    const created = await prisma.account.create({ data: { ...data, userId: user.id, kind, currency, sort: 100 } });
    fd.set("id", created.id);
  }
  // Har bir valyutada faqat bitta asosiy hisob bo'ladi.
  if (data.isDefault)
    await prisma.account.updateMany({
      where: { userId: user.id, currency, id: { not: str(fd.get("id")) } },
      data: { isDefault: false },
    });
  return done(getT().saved);
}

export async function archiveAccount(fd: FormData) {
  const user = await requireUser();
  await prisma.account.updateMany({
    where: { id: str(fd.get("id")), userId: user.id },
    data: { archived: fd.get("archived") === "1", isDefault: false },
  });
  revalidatePath("/", "layout");
}

// Real qoldiq bilan solishtirish: farq «Tuzatish» kategoriyasiga yoziladi.
export async function reconcileAccount(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const real = num(fd.get("real"));
  if (!Number.isFinite(real)) return err("enterRealBalance");
  const acc = (await getAccounts(user.id, true)).find((a) => a.id === str(fd.get("id")));
  if (!acc) return err("errAccount");
  const diff = Math.round((real - acc.balance) * 100) / 100;
  const t = getT();
  if (diff === 0) return done(t.noDiff);
  const type = diff > 0 ? "INCOME" : "EXPENSE";
  const cat = await prisma.category.upsert({
    where: { userId_name_kind: { userId: user.id, name: "Tuzatish", kind: type } },
    update: {},
    create: { userId: user.id, name: "Tuzatish", kind: type, icon: "⚖️" },
  });
  try {
    await createTx(user.id, { type, amount: Math.abs(diff), accountId: acc.id, categoryId: cat.id, note: t.reconcileNote });
  } catch (e) {
    return fail(e);
  }
  const share = acc.balance ? ` (${Math.abs((diff / acc.balance) * 100).toFixed(1)}%)` : "";
  return done(fill(t.diffRecorded, { v: `${diff > 0 ? "+" : "−"}${Math.abs(diff)} ${acc.currency}`, s: share }));
}

// ---------- Limitlar ----------

export async function saveBudgets(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const month = validYm(str(fd.get("month"), 7));
  const cats = await prisma.category.findMany({ where: { userId: user.id, kind: "EXPENSE" } });
  for (const c of cats) {
    const raw = fd.get(`limit_${c.id}`);
    if (raw === null) continue;
    const v = num(raw);
    const limit = Number.isFinite(v) && v > 0 ? v : 0;
    await prisma.budget.upsert({
      where: { categoryId_month: { categoryId: c.id, month } },
      update: { limit },
      create: { userId: user.id, categoryId: c.id, month, limit },
    });
  }
  return done(getT().limitsSaved);
}

// ---------- Qarzlar ----------

export async function addDebt(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const due = str(fd.get("dueDate"), 10);
  try {
    await createDebt(user.id, {
      direction: str(fd.get("direction"), 10),
      person: str(fd.get("person"), 80),
      amount: num(fd.get("amount")),
      currency: str(fd.get("currency"), 3),
      dueDate: validDay(due) ? new Date(`${due}T12:00:00+05:00`) : null,
      note: str(fd.get("note")),
      accountId: str(fd.get("accountId")) || null,
    });
  } catch (e) {
    return fail(e);
  }
  return done(getT().debtRecorded);
}

export async function closeDebt(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const debt = await prisma.debt.findFirst({ where: { id: str(fd.get("id")), userId: user.id, status: "OPEN" } });
  if (!debt) return err("debtNotFound");
  const accountId = str(fd.get("accountId"));
  if (accountId) {
    const acc = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!acc || acc.currency !== debt.currency) return err("chooseCurrencyAccount", { c: debt.currency });
    try {
      await repayDebt(user.id, debt.id, { amount: debtLeft(debt), accountId });
    } catch (e) {
      return fail(e);
    }
    return done(getT().debtClosed);
  }
  await prisma.debt.update({ where: { id: debt.id }, data: { paid: debt.amount, status: "CLOSED", closedAt: new Date() } });
  return done(getT().debtClosed);
}

export async function deleteDebt(fd: FormData) {
  const user = await requireUser();
  const id = str(fd.get("id"));
  // Qarzga bog'liq hisob harakatlari ham o'chadi, aks holda qoldiq noto'g'ri bo'lib qoladi.
  await prisma.transaction.deleteMany({ where: { debtId: id, userId: user.id } });
  await prisma.debt.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}

// ---------- Kreditlar ----------

export async function addCredit(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const start = str(fd.get("startDate"), 10);
  try {
    await createCredit(user.id, {
      name: str(fd.get("name"), 80),
      principal: num(fd.get("principal")),
      rate: num(fd.get("rate")) || 0,
      termMonths: Math.round(num(fd.get("termMonths"))),
      kind: str(fd.get("kind"), 20),
      currency: str(fd.get("currency"), 3),
      startDate: validDay(start) ? new Date(`${start}T12:00:00+05:00`) : new Date(),
      payDay: Math.round(num(fd.get("payDay"))),
      note: str(fd.get("note")),
      accountId: str(fd.get("accountId")) || null,
    });
  } catch (e) {
    return fail(e);
  }
  return done(getT().creditSaved);
}

export async function payCreditAction(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  try {
    await payCredit(user.id, str(fd.get("id")), { amount: num(fd.get("amount")), accountId: str(fd.get("accountId")) });
  } catch (e) {
    return fail(e);
  }
  return done(getT().creditPaid);
}

export async function deleteCredit(fd: FormData) {
  const user = await requireUser();
  const id = str(fd.get("id"));
  // To'lovlar va kredit puli yozuvlari ham o'chadi, aks holda hisob qoldig'i noto'g'ri bo'lib qoladi.
  await prisma.transaction.deleteMany({ where: { creditId: id, userId: user.id } });
  await prisma.credit.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}

// ---------- Jamg'arma maqsadlari ----------

export async function deleteGoal(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const goal = (await getGoals(user.id)).find((g) => g.id === str(fd.get("id")));
  if (!goal) return err("errGoal");
  // Yig'ilgan pul bor maqsadni o'chirib bo'lmaydi: avval yechib olinadi, aks holda hisob qoldig'i noto'g'ri bo'lib qoladi.
  if (goal.saved > 0) return err("goalNotEmpty");
  await prisma.transaction.deleteMany({ where: { goalId: goal.id, userId: user.id } });
  await prisma.goal.delete({ where: { id: goal.id } });
  return done(getT().saved);
}

// ---------- Avatar ----------

const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

// Rasm brauzerda 256×256 ga kichraytirib yuboriladi; bazada data URL sifatida saqlanadi.
export async function saveAvatar(dataUrl: string): Promise<State> {
  const user = await requireUser();
  if (typeof dataUrl !== "string" || dataUrl.length > 150_000 || !AVATAR_RE.test(dataUrl)) return err("avatarBadFile");
  await prisma.user.update({ where: { id: user.id }, data: { avatar: dataUrl } });
  return done(getT().avatarSaved);
}

export async function removeAvatar(): Promise<State> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { avatar: null } });
  return done(getT().avatarRemoved);
}

// ---------- Sozlamalar ----------

export async function saveSettings(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const usdRate = num(fd.get("usdRate"));
  const savingsTarget = Math.round(num(fd.get("savingsTarget")));
  const telegramId = str(fd.get("telegramId"), 20) || null;
  if (!(usdRate > 0)) return err("invalidRate");
  if (!(savingsTarget >= 0 && savingsTarget <= 100)) return err("savingsRange");
  if (telegramId && !/^\d{4,15}$/.test(telegramId)) return err("telegramDigits");
  if (telegramId && (await prisma.user.findFirst({ where: { telegramId, id: { not: user.id } } })))
    return err("telegramTaken");
  await prisma.user.update({ where: { id: user.id }, data: { usdRate, savingsTarget, telegramId } });
  return done(getT().saved);
}

export async function saveCategory(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const id = str(fd.get("id"));
  const name = str(fd.get("name"), 40);
  if (!name) return err("enterName");
  const data = { name, icon: str(fd.get("icon"), 8) || "📦", keywords: str(fd.get("keywords"), 300).toLowerCase() };
  try {
    if (id) {
      const r = await prisma.category.updateMany({ where: { id, userId: user.id }, data });
      if (!r.count) return err("categoryNotFound");
    } else {
      const kind = fd.get("kind") === "INCOME" ? "INCOME" : "EXPENSE";
      await prisma.category.create({ data: { ...data, userId: user.id, kind } });
    }
  } catch {
    return err("categoryExists");
  }
  return done(getT().saved);
}

export async function archiveCategory(fd: FormData) {
  const user = await requireUser();
  await prisma.category.updateMany({
    where: { id: str(fd.get("id")), userId: user.id },
    data: { archived: fd.get("archived") === "1" },
  });
  revalidatePath("/", "layout");
}
