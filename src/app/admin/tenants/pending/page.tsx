"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PendingTenant = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  accountStatus: string;
  createdAt: string;
  tenant?: {
    id: string;
    requestedUnitNumber: string | null;
    identificationNumber: string | null;
    createdAt: string;
  } | null;
};

type PendingResponse = {
  tenants: PendingTenant[];
};

export default function PendingTenantsPage() {
  const router = useRouter();

  const [tenants, setTenants] = useState<PendingTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPendingTenants = useCallback(async () => {
    const response = await fetch("/api/admin/tenants/pending", {
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
      throw new Error("Unable to load pending tenants.");
    }

    const data = (await response.json()) as PendingResponse;
    setTenants(data.tenants);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadPendingTenants();
      } catch {
        if (!cancelled) {
          setError("Unable to load pending tenant registrations.");
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
  }, [loadPendingTenants]);

  async function decideTenant(
    tenantId: string,
    decision: "approve" | "reject",
  ) {
    const message =
      decision === "approve"
        ? "Approve this tenant registration?"
        : "Reject this tenant registration?";

    if (!window.confirm(message)) {
      return;
    }

    setActiveId(tenantId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/${decision}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            note:
              decision === "approve"
                ? "Registration approved by administrator."
                : "Registration rejected by administrator.",
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "The request could not be completed.");
        return;
      }

      setSuccess(data.message ?? "Decision saved.");
      await loadPendingTenants();
    } catch {
      setError("Unable to contact the server.");
    } finally {
      setActiveId(null);
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
            Pending Tenant Registrations
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
            Loading pending registrations...
          </div>
        ) : tenants.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <h2 className="text-xl font-bold text-slate-900">
              No pending registrations
            </h2>
            <p className="mt-2 text-slate-600">
              New tenant registrations will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {tenants.map((tenant) => (
              <article
                key={tenant.id}
                className="rounded-xl bg-white p-6 shadow"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {tenant.fullName}
                    </h2>

                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>Email: {tenant.email ?? "Not provided"}</p>
                      <p>Phone: {tenant.phone ?? "Not provided"}</p>
                      <p>
                        Requested unit:{" "}
                        {tenant.tenant?.requestedUnitNumber ??
                          "Not specified"}
                      </p>
                      <p>
                        Identification number:{" "}
                        {tenant.tenant?.identificationNumber ??
                          "Not provided"}
                      </p>
                      <p>
                        Registered:{" "}
                        {new Date(tenant.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => decideTenant(tenant.id, "approve")}
                      disabled={activeId === tenant.id}
                      className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      Approve
                    </button>

                    <button
                      onClick={() => decideTenant(tenant.id, "reject")}
                      disabled={activeId === tenant.id}
                      className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Reject
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
