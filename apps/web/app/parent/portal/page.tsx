"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ParentStudentRow = {
  id: string;
  fullName: string;
  className: string;
  section: string;
  rollNumber: string;
  status: string;
  createdAt: string;
};

export default function ParentPortalPage() {
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api/v2";
  const [rows, setRows] = useState<ParentStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRows() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/parent/submissions`, {
        credentials: "include"
      });
      const data = await res.json().catch(() => []);
      if (res.status === 401) {
        router.replace("/parent/intake");
        return;
      }
      if (!res.ok) throw new Error(data.message || data.error || "Failed to load parent submissions");
      setRows(data as ParentStudentRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load parent submissions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] px-3 py-4 text-[var(--text-primary)] md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="glass rounded-2xl p-4">
          <p className="m-0 text-xl font-semibold">Parent Portal</p>
          <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">Submitted students linked to this parent account.</p>
          <button
            type="button"
            onClick={() => router.push("/parent/intake")}
            className="mt-3 rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs"
          >
            Open Intake Flow
          </button>
        </section>

        {error ? <p className="text-xs text-rose-300">{error}</p> : null}

        <section className="glass rounded-2xl p-4">
          {loading ? <p className="text-sm text-[var(--text-muted)]">Loading submissions...</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No submissions found yet.</p>
          ) : null}
          {!loading && rows.length > 0 ? (
            <div className="overflow-auto rounded-xl border border-[var(--line-soft)]">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--line-soft)]">
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Roll</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--line-soft)]">
                      <td className="px-3 py-2">{row.fullName}</td>
                      <td className="px-3 py-2">
                        {row.className}-{row.section}
                      </td>
                      <td className="px-3 py-2">{row.rollNumber}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}



