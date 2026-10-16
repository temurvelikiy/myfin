import { shiftYm, dayStr } from "./dates";

export type CreditTerms = {
  principal: number;
  rate: number; // yillik %
  termMonths: number;
  kind: string; // ANNUITY | DIFFERENTIATED
  startDate: Date;
  payDay: number;
};

export type Installment = {
  n: number;
  due: string; // YYYY-MM-DD
  payment: number;
  principal: number;
  interest: number;
  balance: number; // to'lovdan keyingi qoldiq
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// n-to'lov sanasi: boshlanish oyidan n oy keyin, oyning payDay-kuni (qisqa oyda oxirgi kun).
function dueDate(start: Date, n: number, payDay: number) {
  const ym = shiftYm(dayStr(start).slice(0, 7), n);
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(Math.min(payDay, last)).padStart(2, "0")}`;
}

// To'lov jadvali. Annuitet — har oy teng to'lov, differensial — asosiy qarz teng, foiz kamayib boradi.
export function schedule(c: CreditTerms): Installment[] {
  const n = Math.max(1, Math.floor(c.termMonths));
  const mr = c.rate / 12 / 100;
  const rows: Installment[] = [];
  let balance = c.principal;

  const annuity = mr === 0 ? c.principal / n : (c.principal * mr) / (1 - Math.pow(1 + mr, -n));

  for (let i = 1; i <= n; i++) {
    const interest = r2(balance * mr);
    let principal = c.kind === "DIFFERENTIATED" ? r2(c.principal / n) : r2(annuity - interest);
    // Oxirgi to'lov qoldiqni to'liq yopadi (yaxlitlash farqi yig'ilib qolmasligi uchun).
    if (i === n) principal = r2(balance);
    const payment = r2(principal + interest);
    balance = r2(balance - principal);
    rows.push({ n: i, due: dueDate(c.startDate, i, c.payDay), payment, principal, interest, balance: Math.max(balance, 0) });
  }
  return rows;
}

// Necha to'lov qoplangan: to'langan summa to'lovlar yig'indisini ketma-ket qoplaydi.
export function paidCount(rows: Installment[], paid: number) {
  let sum = 0;
  let k = 0;
  for (const r of rows) {
    if (sum + r.payment > paid + 0.5) break;
    sum += r.payment;
    k++;
  }
  return k;
}

export function summarize(c: CreditTerms, paid: number) {
  const rows = schedule(c);
  const total = r2(rows.reduce((s, r) => s + r.payment, 0));
  const done = paidCount(rows, paid);
  const next = rows[done] ?? null;
  const balance = done === 0 ? c.principal : rows[done - 1].balance;
  return { rows, total, interestTotal: r2(total - c.principal), done, next, balance, left: Math.max(r2(total - paid), 0) };
}
