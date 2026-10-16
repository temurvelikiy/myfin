"use client";

import { useRef, useState, useTransition } from "react";
import { removeAvatar, saveAvatar } from "@/app/actions";
import { Avatar } from "./Avatar";
import { tMsg } from "@/lib/i18n";
import { useT } from "./I18n";

// Rasmni markazdan kvadrat qilib kesib, size×size ga kichraytiradi.
async function toSquare(src: Blob | string, size: number, type: "image/jpeg" | "image/webp", quality: number): Promise<string> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new window.Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("avatarBadFile"));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return c.toDataURL(type, quality);
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

export function AvatarEditor({ current, name }: { current: string | null; name: string }) {
  const t = useT();
  const file = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null); // yuklangan haqiqiy rasm (256px)
  const [photoBig, setPhotoBig] = useState<string | null>(null); // AI ga yuboriladigan nusxa (512px)
  const [cartoon, setCartoon] = useState<string | null>(null); // AI natijasi (256px)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setMsg({});
    setCartoon(null);
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setMsg({ error: t.avatarBadFile });
    try {
      setPhoto(await toSquare(f, 256, "image/jpeg", 0.88));
      setPhotoBig(await toSquare(f, 512, "image/jpeg", 0.9));
    } catch {
      setMsg({ error: t.avatarBadFile });
    }
  };

  const makeAi = async () => {
    if (!photoBig) return;
    setBusy(true);
    setMsg({});
    try {
      const r = await fetch("/api/avatar/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: photoBig }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.image) return setMsg({ error: tMsg(t, j.error ?? "aiError") });
      setCartoon(await toSquare(j.image, 256, "image/webp", 0.9));
    } catch {
      setMsg({ error: t.aiError });
    } finally {
      setBusy(false);
    }
  };

  const save = (dataUrl: string) =>
    start(async () => {
      const r = await saveAvatar(dataUrl);
      if (r.error) return setMsg({ error: r.error });
      setMsg({ ok: r.ok });
      setPhoto(null);
      setPhotoBig(null);
      setCartoon(null);
    });

  const remove = () =>
    start(async () => {
      const r = await removeAvatar();
      setMsg({ ok: r.ok });
    });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={current} name={name} size={72} className="ring-4 ring-peach-100" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{t.avatarHint}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <button type="button" className="btn-ghost" onClick={() => file.current?.click()} disabled={busy || pending}>
              {t.uploadPhoto}
            </button>
            {current && (
              <button type="button" className="btn-ghost text-red-600" onClick={remove} disabled={busy || pending}>
                {t.removeAvatar}
              </button>
            )}
          </div>
        </div>
      </div>

      {photo && (
        <div className="mt-4 rounded-xl border border-peach-100 bg-peach-50 p-3">
          <div className="flex flex-wrap items-start gap-4">
            <figure className="text-center">
              <Avatar src={photo} name={name} size={96} />
              <figcaption className="mt-1 text-xs text-slate-500">{t.avatarOriginal}</figcaption>
            </figure>
            {(cartoon || busy) && (
              <figure className="text-center">
                {cartoon ? (
                  <Avatar src={cartoon} name={name} size={96} />
                ) : (
                  <span className="flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-peach-200 text-2xl">✨</span>
                )}
                <figcaption className="mt-1 text-xs text-slate-500">{t.avatarCartoon}</figcaption>
              </figure>
            )}
          </div>

          {busy && <p className="mt-2 text-sm text-slate-500">{t.aiWorking}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => save(photo)} disabled={busy || pending}>
              {t.useThis}: {t.avatarOriginal.toLowerCase()}
            </button>
            {cartoon && (
              <button type="button" className="btn" onClick={() => save(cartoon)} disabled={busy || pending}>
                {t.useThis}: {t.avatarCartoon}
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={makeAi} disabled={busy || pending}>
              {cartoon ? t.aiAgain : t.aiAvatar}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">{t.aiPrivacy}</p>
        </div>
      )}

      {(msg.error || msg.ok) && <p role="status" className={`mt-3 text-sm ${msg.error ? "text-red-600" : "text-blue-700"}`}>{msg.error ?? msg.ok}</p>}
    </div>
  );
}
