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
    tenant?: {
      id: string;
      unit?: {
        id: string;
        unitNumber: string;
        property: string;
      } | null;
    } | null;
  };
};

export default function TenantPage( ) {
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

      if (currentUser.user?.role !== "TENANT") {
        router.replace("/admin");
        return;
      }

      setData(currentUser);
    }

    loadUser().catch(() => {
      setError("Unable to load tenant information.");
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
    return <main className="p-8">Loading tenant portal...</main>;
  }

  const tenant = data.user?.tenant;
  const unit = tenant?.unit;

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-blue-800 px-8 py-5 text-white">
        <div>
          <p className="text-sm text-blue-200">
            Mashaallah Apartments
          </p>
          <h1 className="text-2xl font-bold">Tenant Portal</h1>
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
            Account status: {data.user?.accountStatus}
          </p>

          <p className="mt-1 text-slate-600">
            Email: {data.user?.email}
          </p>
        </div>

        <div className="mt-6 rounded-xl bg-white p-6 shadow">
          <p className="text-sm text-slate-500">Assigned unit</p>

          {unit ? (
            <>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {unit.unitNumber}
              </p>

              <p className="mt-2 text-slate-600">
                {unit.property}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-xl font-semibold text-amber-700">
                Unit not assigned yet
              </p>

              <p className="mt-2 text-slate-600">
                Your account has been approved. The administrator still
                needs to assign your official unit.
              </p>
            </>
          )}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">Rent balance</p>
            <p className="mt-2 text-2xl font-bold">
              Not available yet
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">Water balance</p>
            <p className="mt-2 text-2xl font-bold">
              Not available yet
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">Receipts</p>
            <p className="mt-2 text-2xl font-bold">
              Not available yet
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
