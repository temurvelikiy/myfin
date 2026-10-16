"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { State } from "@/app/actions";

// Server action natijasini (xato yoki "saqlandi") forma ostida ko'rsatadigan o'ram.
export function StateForm({
  action,
  children,
  className,
  resetOnOk,
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
  resetOnOk?: boolean;
}) {
  const [state, formAction] = useFormState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {(state.error || state.ok) && (
        <p role="status" className={`col-span-full text-sm ${state.error ? "text-red-600" : "text-blue-700"}`}>
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className ?? "btn"} disabled={pending}>
      {pending ? "…" : children}
    </button>
  );
}
