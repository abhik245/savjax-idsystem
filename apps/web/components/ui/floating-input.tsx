"use client";

import { InputHTMLAttributes, useId } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function FloatingInput({ label, className = "", ...props }: Props) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={`focus-glow group relative block rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] px-3 pt-5 pb-2 transition-all duration-200 ${className}`}
    >
      <input
        id={id}
        placeholder=" "
        className="peer w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
        {...props}
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)] transition-all duration-200 peer-placeholder-shown:top-1/2 peer-focus:top-3 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:text-xs">
        {label}
      </span>
    </label>
  );
}


