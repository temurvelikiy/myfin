"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { createGoalAction, updateGoalAction } from "@/app/actions";
import { Submit } from "./StateForm";
import { useT } from "./I18n";

type Initial = { id: string; name: string; target: number; currency: string; deadline: string; note: string; image: string | null };

// Rasmni 4:3 nisbatda markazdan kesib, 800×600 JPEG ga kichraytiradi.
async function toCover(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new window.Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("bad"));
      i.src = url;
    });
    const W = 800, H = 600;
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw = W / scale, sh = H / scale;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, W, H);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Yangi maqsad yoki mavjudini tahrirlash (initial berilsa).
export function GoalForm({ initial, today }: { initial?: Initial; today: string }) {
  const t = useT();
  const editing = !!initial;
  const [state, action] = useFormState(editing ? updateGoalAction : createGoalAction, {});
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [changed, setChanged] = useState(false);
  const [bad, setBad] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && !editing) {
      form.current?.reset();
      setImage(null);
      setChanged(false);
    }
  }, [state, editing]);

  const pick = async (f?: File) => {
    if (!f) return;
    setBad(false);
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setBad(true);
    try {
      setImage(await toCover(f));
      setChanged(true);
    } catch {
      setBad(true);
    }
  };

  return (
    <form ref={form} action={action} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {editing && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="image" value={image ?? ""} />
      {editing && <input type="hidden" name="imageChanged" value={changed ? "1" : "0"} />}

      <div className="col-span-2">
        <label className="label">{t.goalName}</label>
        <input name="name" className="input" placeholder={t.goalNamePlaceholder} maxLength={60} defaultValue={initial?.name} required />
      </div>
      <div>
        <label className="label">{t.goalTarget}</label>
        <input name="target" className="input num" inputMode="decimal" placeholder="0" defaultValue={initial?.target} required />
      </div>
      {editing ? (
        <div>
          <label className="label">{t.currency}</label>
          <input className="input" value={initial.currency} disabled readOnly />
        </div>
      ) : (
        <div>
          <label className="label">{t.currency}</label>
          <select name="currency" className="input">
            <option>UZS</option>
            <option>USD</option>
          </select>
        </div>
      )}
      <div>
        <label className="label">{t.goalDeadline}</label>
        <input name="deadline" type="date" className="input" defaultValue={initial?.deadline} min={editing ? undefined : today} />
      </div>
      <div className="col-span-2">
        <label className="label">{t.note}</label>
        <input name="note" className="input" maxLength={200} defaultValue={initial?.note} placeholder={t.optional} />
      </div>

      <div className="col-span-2 md:col-span-4">
        <span className="label">{t.goalImage}</span>
        <div className="flex flex-wrap items-center gap-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-20 w-28 rounded-xl object-cover ring-1 ring-peach-200" />
          ) : (
            <span className="flex h-20 w-28 items-center justify-center rounded-xl bg-peach-100 text-3xl">🎯</span>
          )}
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" className="btn-ghost" onClick={() => file.current?.click()}>
            {t.goalPickImage}
          </button>
          {image && (
            <button type="button" className="btn-ghost text-red-600" onClick={() => (setImage(null), setChanged(true))}>
              {t.goalRemoveImage}
            </button>
          )}
          {bad && <span className="text-sm text-red-600">{t.avatarBadFile}</span>}
        </div>
      </div>

      <div className="col-span-full">
        <Submit>{editing ? t.goalSaveChanges : t.goalAddBtn}</Submit>
      </div>
      {(state.error || state.ok) && (
        <p role="status" className={`col-span-full text-sm ${state.error ? "text-red-600" : "text-blue-700"}`}>
          {state.error ?? `✓ ${state.ok}`}
        </p>
      )}
    </form>
  );
}
