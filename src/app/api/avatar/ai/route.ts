import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const PROMPT =
  "Turn this person's photo into a friendly 3D animated cartoon portrait in the style of modern Pixar movies. " +
  "Keep the same face shape, hairstyle, hair color, skin tone, expression and clothing so the person is recognizable. " +
  "Large expressive eyes, smooth soft skin, soft studio lighting, head and shoulders, centered, " +
  "plain light grey background, no text, no watermark.";

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

// Xarajat nazorati: bir foydalanuvchi soatiga 5 ta so'rov (xotirada; server qayta ishga tushsa nolga tushadi).
const hits = new Map<string, number[]>();

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "aiNotConfigured" }, { status: 503 });

  const now = Date.now();
  const recent = (hits.get(user.id) ?? []).filter((t) => now - t < 3600e3);
  if (recent.length >= 5) return NextResponse.json({ error: "aiTooMany" }, { status: 429 });

  let image = "";
  try {
    image = String((await req.json()).image ?? "");
  } catch {
    return NextResponse.json({ error: "avatarBadFile" }, { status: 400 });
  }
  const m = DATA_URL.exec(image);
  if (!m || image.length > 1_500_000) return NextResponse.json({ error: "avatarBadFile" }, { status: 400 });

  const ext = m[1].split("/")[1];
  const form = new FormData();
  form.set("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
  form.set("prompt", PROMPT);
  form.set("size", "1024x1024");
  form.set("quality", process.env.OPENAI_IMAGE_QUALITY || "medium");
  form.set("n", "1");
  form.set("image", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), `photo.${ext}`);

  recent.push(now);
  hits.set(user.id, recent);

  try {
    const r = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(110_000),
    });
    const j = await r.json().catch(() => null);
    const b64: string | undefined = j?.data?.[0]?.b64_json;
    if (!r.ok || !b64) {
      console.error("OpenAI rasm xatosi:", r.status, j?.error?.message ?? "");
      return NextResponse.json({ error: "aiError" }, { status: 502 });
    }
    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch (e) {
    console.error("OpenAI so'rovi bajarilmadi:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "aiError" }, { status: 502 });
  }
}
