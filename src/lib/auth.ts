import crypto from "crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const COOKIE = "myfin_session";
const DAYS = 30;

// Bazada faqat token xeshi saqlanadi: baza o'g'irlansa ham sessiyani qayta ishlatib bo'lmaydi.
const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DAYS * 864e5);
  await prisma.session.create({ data: { tokenHash: sha(token), userId, expiresAt } });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: headers().get("x-forwarded-proto") === "https",
    path: "/",
    expires: expiresAt,
  });
}

export const getUser = cache(async () => {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha(token) } });
  cookies().delete(COOKIE);
}
