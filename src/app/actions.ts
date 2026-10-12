"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createDebt, createTx, describeParsed, getAccounts, saveParsed } from "@/lib/finance";
import { parseEntry } from "@/lib/parse";
import { parseDay, validDay, validYm } from "@/lib/dates";

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
const fail = (e: unknown): State => ({ error: e instanceof Error ? e.message : "Xatolik yuz berdi", at: Date.now() });

// ---------- Kirish ----------

// Parol tanlashga qarshi: bitta login uchun 15 daqiqada 5 ta xato urinish.
const attempts = new Map<string, { n: number; until: number }>();

export async function login(_: State, fd: FormData): Promise<State> {
  const name = str(fd.get("login"), 64).toLowerCase();
  const password = String(fd.get("password") ?? "");
  const now = Date.now();
  const a = attempts.get(name);
  if (a && a.until > now && a.n >= 5) return { error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." };

  const user = await prisma.user.findUnique({ where: { login: name } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    attempts.set(name, { n: (a && a.until > now ? a.n : 0) + 1, until: now + 15 * 60e3 });
    return { error: "Login yoki parol noto'g'ri" };
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
  if (!verifyPassword(String(fd.get("current") ?? ""), user.passwordHash)) return { error: "Joriy parol noto'g'ri" };
  if (next.length < 8) return { error: "Yangi parol kamida 8 belgi bo'lsin" };
  if (next !== String(fd.get("repeat") ?? "")) return { error: "Parollar mos kelmadi" };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  // Boshqa qurilmalardagi sessiyalar yopiladi, joriysi yangilanadi.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  return done("Parol yangilandi");
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
  if ("error" in parsed) return { error: parsed.error };
  return { parsed, summary: describeParsed(parsed, accounts, categories) };
}

export async function confirmQuick(text: string, accountId?: string, categoryId?: string) {
  const user = await requireUser();
  const { accounts, categories, parsed } = await parseFor(user.id, text);
  if ("error" in parsed) return { error: parsed.error };
  const acc = accounts.find((a) => a.id === accountId);
  if (acc && parsed.type !== "TRANSFER") {
    parsed.accountId = acc.id;
    parsed.currency = acc.currency;
  }
  if (categories.some((c) => c.id === categoryId && c.kind === parsed.type)) parsed.categoryId = categoryId;
  try {
    const { warning } = await saveParsed(user.id, parsed, "WEB");
    revalidatePath("/", "layout");
    return { ok: describeParsed(parsed, accounts, categories), warning };
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

  try {
    await createTx(user.id, {
      type,
      amount,
      accountId: str(fd.get("accountId")),
      toAccountId: str(fd.get("toAccountId")) || null,
      toAmount: num(fd.get("toAmount")) || null,
      categoryId,
      scope: str(fd.get("scope"), 20),
      note: str(fd.get("note")),
      date: parseDay(str(fd.get("date"), 10)),
    });
  } catch (e) {
    return fail(e);
  }
  return done("Saqlandi");
}

export async function deleteTransaction(fd: FormData) {
  const user = await requireUser();
  await prisma.transaction.deleteMany({ where: { id: str(fd.get("id")), userId: user.id } });
  revalidatePath("/", "layout");
}

// ---------- Hisoblar ----------

export async function saveAccount(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const id = str(fd.get("id"));
  const name = str(fd.get("name"), 40);
  const initial = num(fd.get("initial"));
  if (!name) return { error: "Nomini kiriting" };
  const data = {
    name,
    keywords: str(fd.get("keywords"), 120).toLowerCase(),
    initial: Number.isFinite(initial) ? initial : 0,
    isDefault: fd.get("isDefault") === "on",
  };
  let currency: string;
  if (id) {
    const acc = await prisma.account.findFirst({ where: { id, userId: user.id } });
    if (!acc) return { error: "Hisob topilmadi" };
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
  return done("Saqlandi");
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
  if (!Number.isFinite(real)) return { error: "Real qoldiqni kiriting" };
  const acc = (await getAccounts(user.id, true)).find((a) => a.id === str(fd.get("id")));
  if (!acc) return { error: "Hisob topilmadi" };
  const diff = Math.round((real - acc.balance) * 100) / 100;
  if (diff === 0) return done("Farq yo'q — qoldiq to'g'ri ✅");
  const type = diff > 0 ? "INCOME" : "EXPENSE";
  const cat = await prisma.category.upsert({
    where: { userId_name_kind: { userId: user.id, name: "Tuzatish", kind: type } },
    update: {},
    create: { userId: user.id, name: "Tuzatish", kind: type, icon: "⚖️" },
  });
  try {
    await createTx(user.id, { type, amount: Math.abs(diff), accountId: acc.id, categoryId: cat.id, note: "Qoldiqni solishtirish" });
  } catch (e) {
    return fail(e);
  }
  const share = acc.balance ? ` (${Math.abs((diff / acc.balance) * 100).toFixed(1)}%)` : "";
  return done(`Farq ${diff > 0 ? "+" : "−"}${Math.abs(diff)} ${acc.currency}${share} tuzatish sifatida yozildi`);
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
  return done("Limitlar saqlandi");
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
  return done("Qarz yozildi");
}

export async function closeDebt(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const debt = await prisma.debt.findFirst({ where: { id: str(fd.get("id")), userId: user.id, status: "OPEN" } });
  if (!debt) return { error: "Qarz topilmadi" };
  const accountId = str(fd.get("accountId"));
  if (accountId) {
    const acc = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!acc || acc.currency !== debt.currency) return { error: `${debt.currency} hisobini tanlang` };
    await createTx(user.id, {
      type: debt.direction === "GIVEN" ? "DEBT_IN" : "DEBT_OUT",
      amount: debt.amount,
      accountId,
      note: `Qarz qaytdi: ${debt.person}`,
      debtId: debt.id,
    });
  }
  await prisma.debt.update({ where: { id: debt.id }, data: { status: "CLOSED", closedAt: new Date() } });
  return done("Qarz yopildi");
}

export async function deleteDebt(fd: FormData) {
  const user = await requireUser();
  const id = str(fd.get("id"));
  // Qarzga bog'liq hisob harakatlari ham o'chadi, aks holda qoldiq noto'g'ri bo'lib qoladi.
  await prisma.transaction.deleteMany({ where: { debtId: id, userId: user.id } });
  await prisma.debt.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}

// ---------- Sozlamalar ----------

export async function saveSettings(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const usdRate = num(fd.get("usdRate"));
  const savingsTarget = Math.round(num(fd.get("savingsTarget")));
  const telegramId = str(fd.get("telegramId"), 20) || null;
  if (!(usdRate > 0)) return { error: "Kurs noto'g'ri" };
  if (!(savingsTarget >= 0 && savingsTarget <= 100)) return { error: "Jamg'arma maqsadi 0–100% oralig'ida bo'lsin" };
  if (telegramId && !/^\d{4,15}$/.test(telegramId)) return { error: "Telegram ID faqat raqamlardan iborat" };
  if (telegramId && (await prisma.user.findFirst({ where: { telegramId, id: { not: user.id } } })))
    return { error: "Bu Telegram ID boshqa foydalanuvchiga ulangan" };
  await prisma.user.update({ where: { id: user.id }, data: { usdRate, savingsTarget, telegramId } });
  return done("Saqlandi");
}

export async function saveCategory(_: State, fd: FormData): Promise<State> {
  const user = await requireUser();
  const id = str(fd.get("id"));
  const name = str(fd.get("name"), 40);
  if (!name) return { error: "Nomini kiriting" };
  const data = { name, icon: str(fd.get("icon"), 8) || "📦", keywords: str(fd.get("keywords"), 300).toLowerCase() };
  try {
    if (id) {
      const r = await prisma.category.updateMany({ where: { id, userId: user.id }, data });
      if (!r.count) return { error: "Kategoriya topilmadi" };
    } else {
      const kind = fd.get("kind") === "INCOME" ? "INCOME" : "EXPENSE";
      await prisma.category.create({ data: { ...data, userId: user.id, kind } });
    }
  } catch {
    return { error: "Bunday nomli kategoriya bor" };
  }
  return done("Saqlandi");
}

export async function archiveCategory(fd: FormData) {
  const user = await requireUser();
  await prisma.category.updateMany({
    where: { id: str(fd.get("id")), userId: user.id },
    data: { archived: fd.get("archived") === "1" },
  });
  revalidatePath("/", "layout");
}
