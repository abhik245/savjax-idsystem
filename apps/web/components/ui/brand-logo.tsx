"use client";

import { useEffect, useState } from "react";

type BrandLogoProps = {
  className?: string;
  alt?: string;
  theme?: "dark" | "light";
};

export function BrandLogo({ className = "h-[35px] w-auto", alt = "SAVJAX ID Systems logo", theme }: BrandLogoProps) {
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(theme ?? "light");

  useEffect(() => {
    if (theme) {
      setResolvedTheme(theme);
      return;
    }

    const resolve = () => {
      const isDark = document.documentElement.classList.contains("theme-dark");
      setResolvedTheme(isDark ? "dark" : "light");
    };

    resolve();

    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });

    return () => observer.disconnect();
  }, [theme]);

  const src = resolvedTheme === "light" ? "/savjax-logo-light.svg" : "/savjax-logo-dark.svg";

  return <img src={src} alt={alt} className={className} loading="eager" decoding="async" draggable={false} />;
}
