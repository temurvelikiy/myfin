// Bir qatorli yozuvni tahlil qilish. Bot ham, vebdagi tezkor kiritish ham shuni ishlatadi.
//   45000 taksi              -> xarajat, Transport, asosiy hisob
//   120000 humo market       -> xarajat, Humo kartasi
//   #biz 500000 reklama      -> biznes xarajati
//   +5000000 maosh           -> daromad
//   500000 humo > naqd       -> o'tkazma
//   qarz 200000 Ali 15.10    -> qarz berdim (qarz oldim ... -> qarz oldim)

export type Acc = { id: string; name: string; currency: string; keywords: string; isDefault: boolean };
export type Cat = { id: string; name: string; kind: string; keywords: string };

export type Parsed = {
  type: "EXPENSE" | "INCOME" | "TRANSFER" | "DEBT";
  amount: number;
  currency: string;
  scope: "PERSONAL" | "BUSINESS";
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  note: string;
  direction?: "GIVEN" | "TAKEN";
  person?: string;
  dueDate?: string; // YYYY-MM-DD
};

const norm = (s: string) => s.toLowerCase().replace(/[ʻʼ’‘`]/g, "'").trim();
const kws = (s: string) => norm(s).split(/[,\s]+/).filter(Boolean);

const AMOUNT =
  /(\$\s*)?(\d{1,3}(?:[  .,]\d{3})+(?!\d)|\d+(?:[.,]\d+)?)\s*(mln|млн|milyon|ming|тыс|bin|k|m)?(?![\p{L}'])\s*(\$|usd|dollar|доллар|долл|dolar)?/u;
const DATE = /\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?!\s*(?:mln|млн|ming|тыс|k\b|m\b)|\d)/;
const TRANSFER_WORDS = ["yechdim", "o'tkazma", "otkazma", "o'tkazdim", "otkazdim", "снял", "перевод", "withdrew", "transfer", "çektim"];
// Qarz: qarz / долг / debt / borç. "oldim / взял / borrowed / aldım" bo'lsa — men qarz oldim.
const DEBT_START = /^(qarz|долг|debt|borç)/;
const TAKEN_WORDS = ["oldim", "взял", "borrowed", "aldım"];
const DEBT_WORDS = ["qarz", "qarzga", "berdim", "oldim", "долг", "дал", "взял", "debt", "lent", "borrowed", "borç", "verdim", "aldım"];
const THOUSAND = ["k", "ming", "тыс", "bin"];

// Xato — i18n kaliti (masalan "pNoAmount"), vars esa shablon qiymatlari.
export type ParseError = { error: string; vars?: Record<string, string> };

export function parseEntry(raw: string, accounts: Acc[], categories: Cat[]): Parsed | ParseError {
  let t = norm(raw);
  if (!t) return { error: "pEmpty" };

  let scope: Parsed["scope"] = "PERSONAL";
  if (/#(biznes|biz|b)\b/.test(t)) {
    scope = "BUSINESS";
    t = t.replace(/#(biznes|biz|b)\b/g, " ");
  }

  const isDebt = DEBT_START.test(t.trim());
  let dueDate: string | undefined;
  if (isDebt) {
    const d = t.match(DATE);
    if (d && +d[1] >= 1 && +d[1] <= 31 && +d[2] >= 1 && +d[2] <= 12) {
      const now = new Date(Date.now() + 5 * 3600e3);
      let year = d[3] ? (d[3].length === 2 ? 2000 + +d[3] : +d[3]) : now.getUTCFullYear();
      const iso = (y: number) => `${y}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}`;
      if (!d[3] && iso(year) < now.toISOString().slice(0, 10)) year++;
      dueDate = iso(year);
      t = t.replace(d[0], " ");
    }
  }

  const income = /^\s*\+/.test(t);
  const am = t.match(AMOUNT);
  if (!am) return { error: "pNoAmount" };
  const grouped = /[  .,]\d{3}$/.test(am[2]) && /^\d{1,3}([  .,]\d{3})+$/.test(am[2]);
  let amount = Number(grouped ? am[2].replace(/[  .,]/g, "") : am[2].replace(",", "."));
  if (am[3]) amount *= THOUSAND.includes(am[3]) ? 1e3 : 1e6;
  if (!(amount > 0)) return { error: "errAmount" };
  const usdMarked = !!(am[1] || am[4]);

  const rest = t.replace(am[0], " ").replace(/^\s*\+/, " ");
  const words = rest
    .replace(/->|→/g, " > ")
    .split(/\s+/)
    .map((w) => (w === ">" ? w : w.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}$']+$/gu, "")))
    .filter(Boolean);

  const active = accounts;
  const findAcc = (ws: string[]) => {
    for (const w of ws) {
      const a = active.find((x) => kws(x.keywords).includes(w) || norm(x.name) === w);
      if (a) return { acc: a, word: w };
    }
    return null;
  };
  const defaultAcc = (currency: string) =>
    active.find((a) => a.currency === currency && a.isDefault) ?? active.find((a) => a.currency === currency);

  // --- O'tkazma ---
  const arrow = words.indexOf(">");
  if (!isDebt && (arrow >= 0 || words.some((w) => TRANSFER_WORDS.includes(w)))) {
    const left = findAcc(arrow >= 0 ? words.slice(0, arrow) : words);
    const right = arrow >= 0 ? findAcc(words.slice(arrow + 1)) : null;
    const from = left?.acc ?? (usdMarked ? defaultAcc("USD") : undefined);
    if (!from) return { error: "pFromAcc" };
    const to = right?.acc ?? defaultAcc(from.currency);
    if (!to || to.id === from.id) return { error: "pToAcc" };
    if (to.currency !== from.currency)
      return { error: "pExchangeWeb" };
    return { type: "TRANSFER", amount, currency: from.currency, scope, accountId: from.id, toAccountId: to.id, note: "" };
  }

  // --- Hisob va valyuta ---
  const hit = findAcc(words);
  let account = hit?.acc;
  if (usdMarked && account && account.currency !== "USD") account = undefined;
  const currency = usdMarked ? "USD" : account?.currency ?? "UZS";
  account ??= defaultAcc(currency);
  if (!account) return { error: "pNoCurrencyAcc", vars: { c: currency } };
  const noteWords = words.filter((w) => w !== ">" && w !== hit?.word);

  // --- Qarz ---
  if (isDebt) {
    const direction = noteWords.some((w) => TAKEN_WORDS.includes(w)) ? "TAKEN" : "GIVEN";
    const person = noteWords
      .filter((w) => !DEBT_WORDS.includes(w))
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
    if (!person) return { error: "pWho" };
    return { type: "DEBT", amount, currency, scope, accountId: account.id, note: "", direction, person, dueDate };
  }

  // --- Xarajat / daromad ---
  const kind = income ? "INCOME" : "EXPENSE";
  const pool = categories.filter((c) => c.kind === kind);
  let category = pool.find((c) =>
    kws(c.keywords).some((k) => noteWords.some((w) => w === k || (k.length >= 3 && w.startsWith(k)))),
  );
  category ??= pool.find((c) => norm(c.name).startsWith("boshqa")) ?? pool[0];
  if (!category) return { error: "pNoCategory" };

  return { type: kind, amount, currency, scope, accountId: account.id, categoryId: category.id, note: noteWords.join(" ") };
}
