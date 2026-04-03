"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SchoolRow = { id: string; name: string; code: string };
type UserRow = { id: string; email: string; role: string; name?: string | null };
type AssignmentRow = {
  id: string;
  school: { id: string; name: string; code: string };
  salesPerson: { id: string; email: string; role: string; name?: string | null };
  createdAt: string;
};

export default function AccessManagementPage() {
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api/v2";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const [employeeForm, setEmployeeForm] = useState({
    email: "",
    password: "",
    role: "SALES_PERSON",
    phone: ""
  });
  const [schoolUserForm, setSchoolUserForm] = useState({
    schoolId: "",
    email: "",
    password: "",
    role: "SCHOOL_STAFF",
    name: "",
    phone: ""
  });
  const [assignmentForm, setAssignmentForm] = useState({
    schoolId: "",
    salesPersonId: ""
  });

  const salesPeople = useMemo(
    () => users.filter((u) => u.role === "SALES_PERSON" || u.role === "SALES"),
    [users]
  );

  useEffect(() => {
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function boot() {
    try {
      await Promise.all([loadSchools(), loadUsers(), loadAssignments()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load access module");
      if (e instanceof Error && e.message === "Session expired") {
        localStorage.removeItem("company_access_token");
        localStorage.removeItem("company_refresh_token");
        localStorage.removeItem("company_role");
        localStorage.removeItem("company_user");
        router.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshAccessToken(refreshToken?: string | null) {
    const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refreshToken ? { refreshToken } : {})
    });
    return refreshRes.ok;
  }

  async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
    const accessToken = localStorage.getItem("company_access_token");
    const refreshToken = localStorage.getItem("company_refresh_token");
    const headers: Record<string, string> = { ...((options.headers || {}) as Record<string, string>) };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (!headers["Content-Type"] && options.body) headers["Content-Type"] = "application/json";

    const res = await fetch(`${apiBase}${path}`, { ...options, headers, credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && retry) {
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        return apiRequest<T>(path, options, false);
      }
      throw new Error("Session expired");
    }
    if (!res.ok) throw new Error(data.message || data.error || `Request failed ${res.status}`);
    return data as T;
  }

  async function loadSchools() {
    const rows = await apiRequest<SchoolRow[]>("/schools");
    setSchools(rows);
  }

  async function loadUsers() {
    const rows = await apiRequest<UserRow[]>("/admin/users");
    setUsers(rows);
  }

  async function loadAssignments() {
    const rows = await apiRequest<AssignmentRow[]>("/admin/sales-assignments");
    setAssignments(rows);
  }

  async function createEmployee() {
    setError("");
    setMessage("");
    try {
      await apiRequest("/admin/users", {
        method: "POST",
        body: JSON.stringify(employeeForm)
      });
      setEmployeeForm({ email: "", password: "", role: "SALES_PERSON", phone: "" });
      await loadUsers();
      setMessage("Employee created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create employee");
    }
  }

  async function createSchoolUser() {
    setError("");
    setMessage("");
    if (!schoolUserForm.schoolId) {
      setError("Select school first");
      return;
    }
    try {
      await apiRequest(`/admin/schools/${encodeURIComponent(schoolUserForm.schoolId)}/users`, {
        method: "POST",
        body: JSON.stringify({
          email: schoolUserForm.email,
          password: schoolUserForm.password,
          role: schoolUserForm.role,
          name: schoolUserForm.name || undefined,
          phone: schoolUserForm.phone || undefined
        })
      });
      setSchoolUserForm({ schoolId: schoolUserForm.schoolId, email: "", password: "", role: "SCHOOL_STAFF", name: "", phone: "" });
      await loadUsers();
      setMessage("School user created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create school user");
    }
  }

  async function saveAssignment() {
    setError("");
    setMessage("");
    if (!assignmentForm.schoolId || !assignmentForm.salesPersonId) {
      setError("Select both school and sales person");
      return;
    }
    try {
      await apiRequest("/admin/sales-assignments", {
        method: "POST",
        body: JSON.stringify(assignmentForm)
      });
      await Promise.all([loadAssignments(), loadSchools()]);
      setMessage("Sales assignment saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save assignment");
    }
  }

  async function deleteAssignment(id: string) {
    setError("");
    setMessage("");
    try {
      await apiRequest(`/admin/sales-assignments/${id}`, { method: "DELETE" });
      await loadAssignments();
      setMessage("Assignment deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete assignment");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-8 text-[var(--text-primary)]">
        <p className="text-sm text-[var(--text-muted)]">Loading access management...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-5 text-[var(--text-primary)] md:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="glass rounded-2xl p-4">
          <p className="m-0 text-xl font-semibold">Access Management</p>
          <p className="m-0 mt-1 text-xs text-[var(--text-muted)]">
            Manage employees, school users, and sales-school assignments.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-3 rounded-xl border border-[var(--line-soft)] px-3 py-2 text-xs"
          >
            Back to Dashboard
          </button>
        </section>

        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        {message ? <p className="text-xs text-emerald-300">{message}</p> : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="glass rounded-2xl p-4">
            <p className="m-0 text-sm font-semibold">Create Employee</p>
            <div className="mt-3 space-y-2">
              <input
                placeholder="Email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              />
              <input
                placeholder="Password"
                value={employeeForm.password}
                onChange={(e) => setEmployeeForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              />
              <select
                value={employeeForm.role}
                onChange={(e) => setEmployeeForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              >
                {["COMPANY_ADMIN", "SALES_PERSON", "PRINTING", "FINANCE", "SUPPORT"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                placeholder="Phone (optional)"
                value={employeeForm.phone}
                onChange={(e) => setEmployeeForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={createEmployee}
                className="w-full rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold"
              >
                Create Employee
              </button>
            </div>
          </article>

          <article className="glass rounded-2xl p-4">
            <p className="m-0 text-sm font-semibold">Create School User</p>
            <div className="mt-3 space-y-2">
              <select
                value={schoolUserForm.schoolId}
                onChange={(e) => setSchoolUserForm((p) => ({ ...p, schoolId: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              >
                <option value="">Select school</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <input
                placeholder="Name"
                value={schoolUserForm.name}
                onChange={(e) => setSchoolUserForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              />
              <input
                placeholder="Email"
                value={schoolUserForm.email}
                onChange={(e) => setSchoolUserForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              />
              <input
                placeholder="Password"
                value={schoolUserForm.password}
                onChange={(e) => setSchoolUserForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              />
              <select
                value={schoolUserForm.role}
                onChange={(e) => setSchoolUserForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              >
                <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
                <option value="SCHOOL_STAFF">SCHOOL_STAFF</option>
              </select>
              <button
                type="button"
                onClick={createSchoolUser}
                className="w-full rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold"
              >
                Create School User
              </button>
            </div>
          </article>

          <article className="glass rounded-2xl p-4">
            <p className="m-0 text-sm font-semibold">Sales Assignment</p>
            <div className="mt-3 space-y-2">
              <select
                value={assignmentForm.schoolId}
                onChange={(e) => setAssignmentForm((p) => ({ ...p, schoolId: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              >
                <option value="">Select school</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <select
                value={assignmentForm.salesPersonId}
                onChange={(e) => setAssignmentForm((p) => ({ ...p, salesPersonId: e.target.value }))}
                className="w-full rounded-xl border border-[var(--line-soft)] bg-transparent px-3 py-2 text-xs"
              >
                <option value="">Select sales person</option>
                {salesPeople.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email} ({u.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={saveAssignment}
                className="w-full rounded-xl bg-[linear-gradient(135deg,#0F3C78,#1C6ED5)] px-3 py-2 text-xs font-semibold"
              >
                Save Assignment
              </button>
            </div>
          </article>
        </section>

        <section className="glass rounded-2xl p-4">
          <p className="m-0 text-sm font-semibold">Current Sales Assignments</p>
          <div className="mt-3 overflow-auto rounded-xl border border-[var(--line-soft)]">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--line-soft)]">
                  <th className="px-3 py-2">School</th>
                  <th className="px-3 py-2">Sales Person</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--line-soft)]">
                    <td className="px-3 py-2">
                      {row.school.name} ({row.school.code})
                    </td>
                    <td className="px-3 py-2">{row.salesPerson.name || row.salesPerson.email}</td>
                    <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void deleteAssignment(row.id)}
                        className="rounded-lg border border-[var(--line-soft)] px-2 py-1"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!assignments.length ? (
                  <tr>
                    <td className="px-3 py-3 text-[var(--text-muted)]" colSpan={4}>
                      No assignments yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}




