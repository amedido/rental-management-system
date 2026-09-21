"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tenant = {
  id: string;
  userId: string;
  moveInAt: string | null;
  requestedUnitNumber: string | null;
  user: {
    fullName: string;
    email: string | null;
    phone: string | null;
    accountStatus: string;
  };
  unit: {
    id: string;
    unitNumber: string;
    floor: number | null;
    status: string;
  } | null;
};

type AvailableUnit = {
  id: string;
  unitNumber: string;
  floor: number | null;
  status: string;
};

type TenantsResponse = {
  tenants: Tenant[];
  availableUnits: AvailableUnit[];
};

export default function AdminTenantsPage() {
  const router = useRouter();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [availableUnits, setAvailableUnits] = useState<AvailableUnit[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<
    Record<string, string>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadTenants() {
    const response = await fetch("/api/admin/tenants", {
      cache: "no-store",
    });

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    if (response.status === 403) {
      router.replace("/admin");
      return;
    }

    if (!response.ok) {
      throw new Error("Unable to load tenants.");
    }

    const data = (await response.json()) as TenantsResponse;

    setTenants(data.tenants);
    setAvailableUnits(data.availableUnits);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadTenants();
      } catch {
        if (!cancelled) {
          setError("Unable to load tenant information.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function assignUnit(tenantUserId: string) {
    const unitNumber = selectedUnits[tenantUserId];

    if (!unitNumber) {
      setError("Select a unit before assigning.");
      return;
    }

    if (!window.confirm(`Assign unit ${unitNumber} to this tenant?`)) {
      return;
    }

    setActiveTenantId(tenantUserId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/admin/tenants/${encodeURIComponent(
          tenantUserId,
        )}/assign-unit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            unitNumber,
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Unit assignment failed.");
        return;
      }

      setSuccess(data.message ?? "Unit assigned successfully.");

      setSelectedUnits((current) => {
        const next = { ...current };
        delete next[tenantUserId];
        return next;
      });

      await loadTenants();
    } catch {
      setError("Unable to contact the server.");
    } finally {
      setActiveTenantId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-slate-900 px-8 py-5 text-white">
        <div>
          <p className="text-sm text-slate-300">
            Mashaallah Apartments
          </p>
          <h1 className="text-2xl font-bold">
            Tenant Management
          </h1>
        </div>

        <button
          onClick={() => router.push("/admin")}
          className="rounded-lg bg-slate-700 px-4 py-2 font-semibold hover:bg-slate-600"
        >
          Back to Dashboard
        </button>
      </header>

      <section className="mx-auto max-w-6xl p-8">
        {error ? (
          <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-green-700">
            {success}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl bg-white p-6 shadow">
            Loading tenants...
          </div>
        ) : tenants.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            No active tenants found.
          </div>
        ) : (
          <div className="space-y-5">
            {tenants.map((tenant) => (
              <article
                key={tenant.id}
                className="rounded-xl bg-white p-6 shadow"
              >
                <div className="flex flex-col justify-between gap-6 lg:flex-row">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {tenant.user.fullName}
                    </h2>

                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>
                        Email: {tenant.user.email ?? "Not provided"}
                      </p>
                      <p>
                        Phone: {tenant.user.phone ?? "Not provided"}
                      </p>
                      <p>
                        Requested unit:{" "}
                        {tenant.requestedUnitNumber ?? "Not specified"}
                      </p>
                      <p>
                        Current unit:{" "}
                        {tenant.unit?.unitNumber ?? "Not assigned"}
                      </p>
                      <p>Status: {tenant.user.accountStatus}</p>
                    </div>
                  </div>

                  <div className="flex min-w-64 flex-col gap-3">
                    <label
                      htmlFor={`unit-${tenant.id}`}
                      className="text-sm font-medium text-slate-700"
                    >
                      Assign apartment
                    </label>

                    <select
                      id={`unit-${tenant.id}`}
                      value={selectedUnits[tenant.userId] ?? ""}
                      onChange={(event) =>
                        setSelectedUnits((current) => ({
                          ...current,
                          [tenant.userId]: event.target.value,
                        }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                    >
                      <option value="">
                        Select vacant apartment
                      </option>

                      {availableUnits.map((unit) => (
                        <option
                          key={unit.id}
                          value={unit.unitNumber}
                        >
                          {unit.unitNumber} — Floor {unit.floor}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => assignUnit(tenant.userId)}
                      disabled={
                        activeTenantId === tenant.userId ||
                        availableUnits.length === 0
                      }
                      className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {activeTenantId === tenant.userId
                        ? "Assigning..."
                        : "Assign unit"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
