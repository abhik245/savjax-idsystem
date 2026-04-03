"use client";

import { motion } from "framer-motion";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { FloatingInput } from "@/components/ui/floating-input";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useRouter } from "next/navigation";
import { applyTheme, resolveTheme, ThemeMode } from "@/lib/theme";

export default function LoginPage() {
  const router = useRouter();
  const exposeDevAuthHints = process.env.NEXT_PUBLIC_EXPOSE_DEV_AUTH_HINTS === "true";
  const [email, setEmail] = useState(exposeDevAuthHints ? "main.admin@demo.com" : "");
  const [password, setPassword] = useState(exposeDevAuthHints ? "Admin@123" : "");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(exposeDevAuthHints ? "main.admin@demo.com" : "");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  useEffect(() => {
    const selected = resolveTheme();
    setTheme(selected);
    applyTheme(selected, { persist: false, withTransition: false });
  }, []);

  async function handleCompanyLogin() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api/v2";
    setLoading(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Login failed");

      localStorage.removeItem("company_access_token");
      localStorage.removeItem("company_refresh_token");
      localStorage.removeItem("parent_access_token");
      localStorage.removeItem("parent_refresh_token");
      const nextRole = data?.user?.role || data.role;
      localStorage.setItem("company_role", nextRole);
      if (data?.user) localStorage.setItem("company_user", JSON.stringify(data.user));
      setStatus(`Login successful: ${nextRole}`);
      if (nextRole === "PARENT") router.push("/parent/portal");
      else router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed";
      if (msg.toLowerCase().includes("failed to fetch")) {
        setError("API not reachable. Start apps/api on port 4000 and check CORS/env.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api/v2";
    setForgotLoading(true);
    setForgotError("");
    setForgotMessage("");
    try {
      const res = await fetch(`${apiBase}/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Failed to start password reset");
      const tokenHint =
        exposeDevAuthHints && data?.devResetToken ? ` Dev token: ${data.devResetToken}` : "";
      setForgotMessage((data.message || "Reset request submitted.") + tokenHint);
    } catch (e) {
      setForgotError(e instanceof Error ? e.message : "Failed to start password reset");
    } finally {
      setForgotLoading(false);
    }
  }

  function toggleTheme() {
    const next: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10">
      <AnimatedMesh />
      <div className="relative z-10 mx-auto flex min-h-[85vh] max-w-5xl items-center justify-center">
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          className="glass w-full max-w-md p-7"
        >
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-[35px] w-auto" />
              <div>
                <p className="m-0 text-base font-semibold">SAVJAX ID Systems</p>
                <p className="m-0 text-xs text-[var(--text-muted)]">Secure Access Portal</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="hover-glow rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-2 text-[var(--text-muted)]"
              aria-label="Toggle theme"
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24 }}
            className="space-y-3"
          >
            <FloatingInput
              label="Work Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FloatingInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForgot((v) => !v);
                  setForgotError("");
                  setForgotMessage("");
                }}
                className="text-xs font-medium text-[#1C6ED5] hover:text-[#3A8DFF]"
              >
                Forgot Password?
              </button>
            </div>
            <button
              type="button"
              onClick={handleCompanyLogin}
              disabled={loading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0F3C78] to-[#1C6ED5] px-4 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-[1px] disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
              <ArrowRight size={16} />
            </button>
            <p className="text-xs text-[var(--text-muted)]">
              Company, School Admins, College Admins sign in here with assigned credentials
            </p>
            {showForgot ? (
              <div className="space-y-2 rounded-xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-3">
                <p className="m-0 text-xs font-semibold text-[var(--text-primary)]">Password Reset</p>
                <FloatingInput
                  label="Account Email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotLoading}
                  className="w-full rounded-xl border border-[var(--line-soft)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] hover-glow disabled:opacity-60"
                >
                  {forgotLoading ? "Sending..." : "Send Reset Link"}
                </button>
                {forgotMessage ? <p className="m-0 text-xs text-emerald-500">{forgotMessage}</p> : null}
                {forgotError ? <p className="m-0 text-xs text-rose-500">{forgotError}</p> : null}
              </div>
            ) : null}
            {status ? <p className="text-xs text-emerald-500">{status}</p> : null}
            {error ? <p className="text-xs text-rose-500">{error}</p> : null}
          </motion.div>
        </motion.section>
      </div>
    </main>
  );
}

function AnimatedMesh() {
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-32 h-96 w-96 rounded-full bg-[#0F3C78]/22 blur-3xl"
        animate={{ x: [0, 40, -10, 0], y: [0, 18, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-44 top-10 h-[28rem] w-[28rem] rounded-full bg-[#3A8DFF]/18 blur-3xl"
        animate={{ x: [0, -25, 15, 0], y: [0, -20, 12, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-4 left-1/2 h-36 w-36 -translate-x-1/2 rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)]"
        animate={{ rotate: [0, 8, -8, 0], y: [0, -12, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}


