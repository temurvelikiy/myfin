"use client";

import { useEffect, useRef, useState } from "react";
import type { Bucket } from "@/lib/finance";
import { change, fmt, fmtShort } from "@/lib/format";
import { Delta } from "./ui";
import { useT } from "./I18n";

const TABS = [
  ["days", "tabDays", "nowDay", "vsDay"],
  ["weeks", "tabWeeks", "nowWeek", "vsWeek"],
  ["months", "tabMonths", "nowMonth", "vsPrevMonth"],
] as const;
type Tab = (typeof TABS)[number][0];

// Ranglar CSS o'zgaruvchilaridan olinadi: kun va tun rejimida alohida tekshirilgan.
const INCOME = "rgb(var(--income))";
const EXPENSE = "rgb(var(--expense))";
const H = 250;
const PAD = { l: 52, r: 8, t: 10, b: 26 };

// O'q uchun "chiroyli" maksimum: 1 / 2 / 2.5 / 5 / 10 × 10ⁿ
function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// Tepasi yumaloq, pasti o'qqa tekis ustun.
function bar(x: number, y: number, w: number, base: number) {
  const r = Math.min(4, w / 2, base - y);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />;
}

export function TrendChart({ data }: { data: Record<Tab, Bucket[]> }) {
  const [tab, setTab] = useState<Tab>("days");
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const t = useT();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = data[tab];
  const [, , nowKey, vsKey] = TABS.find((x) => x[0] === tab)!;
  const nowLabel = t[nowKey];
  const cur = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const empty = rows.every((r) => !r.income && !r.expense);

  const max = niceMax(Math.max(...rows.flatMap((r) => [r.income, r.expense]), 1));
  const iw = Math.max(w - PAD.l - PAD.r, 10);
  const base = H - PAD.b;
  const ih = base - PAD.t;
  const band = iw / rows.length;
  const bw = Math.max(2, Math.min(14, (band - 6) / 2));
  const y = (v: number) => base - (v / max) * ih;
  const labelStep = Math.ceil(rows.length / (w < 480 ? 6 : 12));
  const h = hover !== null ? rows[hover] : null;
  const tipX = hover !== null ? PAD.l + band * (hover + 0.5) : 0;

  const figures = [
    { label: t.income, color: INCOME, value: cur.income, delta: change(cur.income, prev.income), upIsGood: true },
    { label: t.expense, color: EXPENSE, value: cur.expense, delta: change(cur.expense, prev.expense), upIsGood: false },
  ];
  const net = cur.income - cur.expense;

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">{t.trendTitle}</h2>
        <div className="seg">
          {TABS.map(([v, key]) => (
            <button key={v} type="button" aria-pressed={tab === v} onClick={() => (setTab(v), setHover(null))}>
              {t[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Joriy davr va oldingi davr bilan solishtirish */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {figures.map((f) => (
          <div key={f.label} className="rounded-xl bg-peach-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Swatch color={f.color} /> {nowLabel} · {f.label.toLowerCase()}
            </p>
            <p className="num mt-0.5 text-lg font-bold">{fmt(f.value)}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Delta value={f.delta} upIsGood={f.upIsGood} />
              {f.delta === null ? t.noCompare : t[vsKey]}
            </p>
          </div>
        ))}
        <div className="rounded-xl bg-peach-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">{nowLabel} · {t.difference.toLowerCase()}</p>
          <p className="num mt-0.5 text-lg font-bold">
            {net > 0 ? "+" : ""}
            {fmt(net)}
          </p>
          <p className="text-[11px] text-slate-400">{net >= 0 ? t.incomeMore : t.expenseMore}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><Swatch color={INCOME} /> {t.income}</span>
        <span className="flex items-center gap-1.5"><Swatch color={EXPENSE} /> {t.expense}</span>
      </div>

      <div ref={wrap} className="relative mt-2" onMouseLeave={() => setHover(null)}>
        <svg width="100%" height={H} role="img" aria-label={t.chartAria}>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={PAD.l + iw} y1={y(max * v)} y2={y(max * v)} className={v === 0 ? "stroke-slate-300" : "stroke-slate-100"} />
              <text x={PAD.l - 8} y={y(max * v) + 4} textAnchor="end" fontSize="11" className="fill-slate-400">
                {v === 0 ? "0" : fmtShort(max * v, t)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = PAD.l + band * (i + 0.5);
            return (
              <g key={r.key}>
                {hover === i && <rect x={PAD.l + band * i} y={PAD.t} width={band} height={ih} className="fill-peach-100" rx="6" />}
                {r.income > 0 && <path d={bar(cx - bw - 1, y(r.income), bw, base)} fill={INCOME} />}
                {r.expense > 0 && <path d={bar(cx + 1, y(r.expense), bw, base)} fill={EXPENSE} />}
                {(rows.length - 1 - i) % labelStep === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" className={i === rows.length - 1 ? "fill-slate-900" : "fill-slate-400"} fontWeight={i === rows.length - 1 ? 600 : 400}>
                    {r.label}
                  </text>
                )}
                <rect x={PAD.l + band * i} y={0} width={band} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              </g>
            );
          })}
        </svg>

        {empty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            {t.noTxPeriod}
          </p>
        )}

        {h && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[11rem] rounded-xl border border-slate-200 bg-card px-3 py-2 text-xs shadow-lg"
            style={{ left: tipX, transform: `translateX(${tipX > w / 2 ? "calc(-100% - 12px)" : "12px"})` }}
          >
            <p className="mb-1 font-semibold text-slate-800">{h.full}</p>
            <p className="flex items-center justify-between gap-4 text-slate-600">
              <span className="flex items-center gap-1.5"><Swatch color={INCOME} /> {t.income}</span>
              <b className="num text-slate-900">{fmt(h.income)}</b>
            </p>
            <p className="flex items-center justify-between gap-4 text-slate-600">
              <span className="flex items-center gap-1.5"><Swatch color={EXPENSE} /> {t.expense}</span>
              <b className="num text-slate-900">{fmt(h.expense)}</b>
            </p>
            <p className="mt-1 flex justify-between gap-4 border-t border-slate-100 pt-1 text-slate-600">
              {t.difference} <b className="num text-slate-900">{h.income - h.expense > 0 ? "+" : ""}{fmt(h.income - h.expense)}</b>
            </p>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs text-slate-500">
        <summary className="cursor-pointer hover:text-slate-700">{t.tableView}</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="num w-full">
            <thead className="sticky top-0 bg-card text-left text-slate-400">
              <tr>
                <th className="py-1 font-medium">{t.period}</th>
                <th className="py-1 text-right font-medium">{t.income}</th>
                <th className="py-1 text-right font-medium">{t.expense}</th>
                <th className="py-1 text-right font-medium">{t.difference}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {[...rows].reverse().map((r) => (
                <tr key={r.key}>
                  <td className="py-1">{r.full}</td>
                  <td className="py-1 text-right">{fmt(r.income)}</td>
                  <td className="py-1 text-right">{fmt(r.expense)}</td>
                  <td className="py-1 text-right">{fmt(r.income - r.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
