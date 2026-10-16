import Image from "next/image";

// Avatar: rasm bo'lsa o'sha, bo'lmasa loginning bosh harfi (shaftoli doira).
export function Avatar({ src, name, size = 28, className = "" }: { src?: string | null; name: string; size?: number; className?: string }) {
  const box = { width: size, height: size };
  if (src)
    return (
      // data URL — Next/Image optimizatsiyasi kerak emas
      <Image src={src} alt={name} width={size} height={size} unoptimized className={`shrink-0 rounded-full object-cover ${className}`} style={box} />
    );
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-peach-300 font-semibold uppercase text-blue-900 ${className}`}
      style={{ ...box, fontSize: Math.max(10, size * 0.42) }}
      aria-label={name}
    >
      {name[0]}
    </span>
  );
}
