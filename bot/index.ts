// MyFin Telegram bot (long polling — webhook/HTTPS kerak emas).
//   npm run bot
// Foydalanuvchi Telegram ID orqali aniqlanadi (veb: Sozlamalar -> Telegram ID).
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import { parseEntry, type Parsed } from "../src/lib/parse";
import { describeParsed, getAccounts, monthStats, saveParsed } from "../src/lib/finance";
import { currentYm, dayStr, monthLabel, shortDay, todayStr } from "../src/lib/dates";
import { fmt } from "../src/lib/format";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN .env faylida ko'rsatilmagan (@BotFather'dan oling).");
  process.exit(1);
}

async function api(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await r.json()) as { ok: boolean; result?: any; description?: string };
}
const send = (chat_id: number | string, text: string, extra: Record<string, unknown> = {}) =>
  api("sendMessage", { chat_id, text, ...extra });

const HELP = `Bir qatorda yozing:

45000 taksi — xarajat
120000 humo market — kartadan
#biz 500000 reklama — biznes xarajati
+5000000 maosh — daromad
20$ kitob — dollarda
500000 humo > naqd — o'tkazma
qarz 200000 Ali 15.10 — qarz berdim
qarz oldim 1mln Vali 01.11 — qarz oldim

/balans — hisoblar qoldig'i
/oy — shu oy xulosasi
/qarz — ochiq qarzlar`;

// Tasdiqlashni kutayotgan yozuvlar (bot qayta ishga tushsa yo'qoladi — qaytadan yozish kifoya).
const pending = new Map<string, { userId: string; parsed: Parsed; summary: string; at: number }>();

async function onMessage(msg: any) {
  const chat = msg.chat.id;
  const text: string = (msg.text ?? "").trim();
  if (msg.chat.type !== "private" || !text) return;

  const user = await prisma.user.findUnique({ where: { telegramId: String(msg.from.id) } });
  if (!user) {
    await send(chat, `Bu bot shaxsiy. Sizning Telegram ID: ${msg.from.id}\n\nUni MyFin saytida Sozlamalar → Telegram ID maydoniga kiriting.`);
    return;
  }

  if (text === "/start" || text === "/help") return void (await send(chat, HELP));

  if (text === "/balans") {
    const accounts = await getAccounts(user.id);
    const total = (c: string) => accounts.filter((a) => a.currency === c).reduce((s, a) => s + a.balance, 0);
    const lines = accounts.map((a) => `${a.name}: ${fmt(a.balance, a.currency)}`);
    return void (await send(chat, `${lines.join("\n")}\n\nJami: ${fmt(total("UZS"))} + ${fmt(total("USD"), "USD")}`));
  }

  if (text === "/oy") {
    const s = await monthStats(user.id, currentYm());
    const top = s.categories.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 5);
    return void (await send(
      chat,
      [
        `📊 ${monthLabel(currentYm())}`,
        `Daromad: ${fmt(s.income)}`,
        `Xarajat: ${fmt(s.expense)} (shaxsiy ${fmt(s.personal)}, biznes ${fmt(s.business)})`,
        `Jamg'arma: ${s.income > 0 ? s.savingsRate + "%" : "—"} (maqsad ${user.savingsTarget}%)`,
        "",
        ...top.map((c) => `${c.icon} ${c.name}: ${fmt(c.spent)}${c.limit > 0 ? ` / ${fmt(c.limit)}` : ""}`),
        ...(s.overLimit.length ? ["", `🚨 Limitdan oshgan: ${s.overLimit.map((c) => c.name).join(", ")}`] : []),
      ].join("\n"),
    ));
  }

  if (text === "/qarz") {
    const debts = await prisma.debt.findMany({ where: { userId: user.id, status: "OPEN" }, orderBy: { dueDate: "asc" } });
    const lines = debts.map((d) => `${d.direction === "GIVEN" ? "↗ Berdim" : "↙ Oldim"} · ${d.person} · ${fmt(d.amount, d.currency)}${d.dueDate ? ` · ${shortDay(d.dueDate)}` : ""}`);
    return void (await send(chat, lines.join("\n") || "Ochiq qarz yo'q"));
  }

  if (text.startsWith("/")) return void (await send(chat, HELP));

  const [accounts, categories] = await Promise.all([
    getAccounts(user.id),
    prisma.category.findMany({ where: { userId: user.id, archived: false } }),
  ]);
  const parsed = parseEntry(text.slice(0, 300), accounts, categories);
  if ("error" in parsed) return void (await send(chat, `❌ ${parsed.error}`));

  const id = crypto.randomBytes(6).toString("hex");
  const summary = describeParsed(parsed, accounts, categories);
  pending.set(id, { userId: user.id, parsed, summary, at: Date.now() });
  await send(chat, summary, {
    reply_markup: { inline_keyboard: [[{ text: "✅ Tasdiqlash", callback_data: `ok:${id}` }, { text: "❌ Bekor", callback_data: `no:${id}` }]] },
  });
}

async function onCallback(cb: any) {
  const [action, id] = String(cb.data ?? "").split(":");
  const chat = cb.message?.chat.id;
  const message_id = cb.message?.message_id;
  const p = pending.get(id);
  const user = await prisma.user.findUnique({ where: { telegramId: String(cb.from.id) } });
  await api("answerCallbackQuery", { callback_query_id: cb.id });
  if (!chat || !p || !user || user.id !== p.userId) {
    if (chat) await api("editMessageText", { chat_id: chat, message_id, text: "⌛ Eskirgan. Qaytadan yozing." });
    return;
  }
  pending.delete(id);
  if (action !== "ok") return void (await api("editMessageText", { chat_id: chat, message_id, text: `❌ Bekor qilindi: ${p.summary}` }));
  try {
    const { warning } = await saveParsed(user.id, p.parsed, "BOT");
    await api("editMessageText", { chat_id: chat, message_id, text: `✅ ${p.summary}` });
    if (warning) await send(chat, warning);
  } catch (e) {
    await api("editMessageText", { chat_id: chat, message_id, text: `❌ ${e instanceof Error ? e.message : "Xatolik"}` });
  }
}

// Muddati kelgan qarzlar haqida kuniga bir marta eslatma.
async function remindDebts() {
  const today = todayStr();
  const debts = await prisma.debt.findMany({
    where: { status: "OPEN", dueDate: { not: null }, user: { telegramId: { not: null } } },
    include: { user: true },
  });
  for (const d of debts) {
    if (dayStr(d.dueDate!) > today) continue;
    if (d.remindedAt && dayStr(d.remindedAt) >= today) continue;
    const late = dayStr(d.dueDate!) < today ? " (muddati o'tgan)" : " (bugun)";
    const who = d.direction === "GIVEN" ? `${d.person} sizga qaytarishi kerak` : `Siz ${d.person}ga qaytarishingiz kerak`;
    const r = await send(d.user.telegramId!, `⏰ Qarz eslatmasi${late}\n${who}: ${fmt(d.amount, d.currency)}`);
    if (r.ok) await prisma.debt.update({ where: { id: d.id }, data: { remindedAt: new Date() } });
  }
}

async function main() {
  const me = await api("getMe", {});
  if (!me.ok) throw new Error(`Token noto'g'ri: ${me.description}`);
  console.log(`Bot ishga tushdi: @${me.result.username}`);

  remindDebts().catch(console.error);
  setInterval(() => remindDebts().catch(console.error), 3600e3);
  setInterval(() => {
    for (const [id, p] of pending) if (Date.now() - p.at > 3600e3) pending.delete(id);
  }, 600e3);

  let offset = 0;
  for (;;) {
    try {
      const r = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      if (!r.ok) throw new Error(r.description);
      for (const u of r.result) {
        offset = u.update_id + 1;
        try {
          if (u.message) await onMessage(u.message);
          else if (u.callback_query) await onCallback(u.callback_query);
        } catch (e) {
          console.error("Xabarni qayta ishlashda xato:", e);
        }
      }
    } catch (e) {
      console.error("Telegram bilan aloqa xatosi:", e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
