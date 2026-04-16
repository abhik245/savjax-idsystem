"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export default function AppTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // CSS keyframe animation defined in tailwind.config.ts — no framer-motion needed
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
