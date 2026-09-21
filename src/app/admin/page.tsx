"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CurrentUserResponse = {
  authenticated: boolean;
  user?: {
    id: string;
    fullName: string;
    email: string | null;
    role: string;
    accountStatus: string;
  };
};

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<CurrentUserResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUser() {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (!response.ok) {
        router.replace("/login");
        return;
      }

      const currentUser =
        (await response.json()) as CurrentUserResponse;

      if (
        currentUser.user?.role !== "SUPER_ADMIN" &&
        currentUser.user?.role !== "ADMIN"
      ) {
        router.replace("/tenant");
        return;
      }

      setData(currentUser);
    }

    loadUser().catch(() => {
      setError("Unable to load administrator information.");
    });
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.replace("/login");
    router.refresh();
  }

  if (error) {
    return <main className="p-8 text-red-700">{error}</main>;
  }

  if (!data) {
    return <main className="p-8">Loading administrator portal...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-slate-900 px-8 py-5 text-white">
        <div>
          <p className="text-sm text-slate-300">
            Mashaallah Apartments
          </p>
          <h1 className="text-2xl font-bold">
            Administrator Portal
          </h1>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-lg bg-red-600 px-4 py-2 font-semibold hover:bg-red-700"
        >
          Sign out
        </button>
      </header>

      <section className="mx-auto max-w-6xl p-8">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-slate-900">
            Welcome, {data.user?.fullName}
          </h2>

          <p className="mt-2 text-slate-600">
            You are signed in as {data.user?.role}.
          </p>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">Apartments</p>
            <p className="mt-2 text-3xl font-bold">27</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">Shops</p>
            <p className="mt-2 text-3xl font-bold">2</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">Total Units</p>
            <p className="mt-2 text-3xl font-bold">29</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-bold text-slate-900">
            Tenant approvals
          </h2>

          <p className="mt-2 text-slate-600">
            Pending tenant management will be added next.
          </p>

          <a
            href="/admin/tenants/pending"
            className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
          >
            Review pending tenants
          </a>
          <a
          href="/admin/tenants"
          className="mt-3 inline-block rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800"
          >
          Manage tenant units
          </a>
        </div>
      </section>
    </main>
  );
}
