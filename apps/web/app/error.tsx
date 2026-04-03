"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 py-10 text-[var(--text-primary)]">
      <section className="glass w-full max-w-lg p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
          SAVJAX ID Systems
        </p>
        <h1 className="mb-3 text-2xl font-semibold">Something went wrong</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          The page hit an unexpected error. You can retry safely.
        </p>
        <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-soft)] p-4 text-xs text-[var(--text-muted)]">
          {error.message || "Unexpected application error"}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-gradient-to-r from-[#0F3C78] to-[#1C6ED5] px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <a
            href="/login"
            className="rounded-xl border border-[var(--line-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)]"
          >
            Go to login
          </a>
        </div>
      </section>
    </main>
  );
}
