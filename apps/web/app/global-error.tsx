"use client";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  return (
    <html lang="en">
      <body className="bg-[#F5F7FA] text-[#1A1A1A]">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <section className="w-full max-w-lg rounded-[24px] border border-[#E5E7EB] bg-white p-8 shadow-[0_24px_80px_rgba(15,60,120,0.10)]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#4B5563]">
              SAVJAX ID Systems
            </p>
            <h1 className="mb-3 text-2xl font-semibold">Application recovery screen</h1>
            <p className="mb-6 text-sm text-[#4B5563]">
              The app hit a root-level error. We can retry from here without losing the entire session.
            </p>
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#F5F7FA] p-4 text-xs text-[#4B5563]">
              {error.message || "Unexpected application error"}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl bg-gradient-to-r from-[#0F3C78] to-[#1C6ED5] px-4 py-2 text-sm font-semibold text-white"
              >
                Retry app
              </button>
              <a
                href="/login"
                className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#0F3C78]"
              >
                Back to login
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
