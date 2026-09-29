"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Tenant = {
  id: string;
  userId: string;
  monthlyRent: string | number;
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

type TenantsResponse = {
  tenants: Tenant[];
};

type RateResponse = {
  property?: {
    id: string;
    name: string;
    waterRate: string;
  };
  error?: string;
};

type MeterForm = {
  billingMonth: string;
  previousReading: string;
  currentReading: string;
  dueDate: string;
  notes: string;
};

type WaterBillResponse = {
  message?: string;
  error?: string;
  waterBill?: {
    amount?: string;
    consumption?: string;
    rate?: string;
  };
};

function getCurrentMonth() {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
}

function getDefaultDueDate() {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}-10`;
}

function getDefaultForm(): MeterForm {
  return {
    billingMonth: getCurrentMonth(),
    previousReading: "",
    currentReading: "",
    dueDate: getDefaultDueDate(),
    notes: "",
  };
}

function calculateConsumption(form: MeterForm) {
  const previous = Number(form.previousReading);
  const current = Number(form.currentReading);

  if (
    form.previousReading === "" ||
    form.currentReading === "" ||
    !Number.isFinite(previous) ||
    !Number.isFinite(current) ||
    previous < 0 ||
    current < 0 ||
    current < previous
  ) {
    return null;
  }

  return current - previous;
}

function formatMoney(amount: number) {
  return amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function WaterBillingPage() {
  const router = useRouter();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [forms, setForms] = useState<Record<string, MeterForm>>(
    {},
  );
  const [waterRate, setWaterRate] = useState<number | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadBillingData = useCallback(async () => {
    const [tenantsResponse, rateResponse] = await Promise.all([
      fetch("/api/admin/tenants", {
        cache: "no-store",
      }),
      fetch("/api/admin/settings/water-rate", {
        cache: "no-store",
      }),
    ]);

    if (
      tenantsResponse.status === 401 ||
      rateResponse.status === 401
    ) {
      router.replace("/login");
      return;
    }

    if (
      tenantsResponse.status === 403 ||
      rateResponse.status === 403
    ) {
      router.replace("/admin");
      return;
    }

    if (!tenantsResponse.ok) {
      throw new Error("Unable to load active tenants.");
    }

    if (!rateResponse.ok) {
      const rateError =
        (await rateResponse.json()) as RateResponse;

      throw new Error(
        rateError.error ?? "Unable to load the current water rate.",
      );
    }

    const tenantsData =
      (await tenantsResponse.json()) as TenantsResponse;

    const rateData =
      (await rateResponse.json()) as RateResponse;

    const currentRate = Number(rateData.property?.waterRate);

    if (!Number.isFinite(currentRate) || currentRate < 0) {
      throw new Error("The current water rate is invalid.");
    }

    setTenants(tenantsData.tenants);
    setWaterRate(currentRate);

    setForms((current) => {
      const next = { ...current };

      for (const tenant of tenantsData.tenants) {
        if (!next[tenant.id]) {
          next[tenant.id] = getDefaultForm();
        }
      }

      return next;
    });
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadBillingData();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load water billing data.",
          );
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
  }, [loadBillingData]);

  function updateForm(
    tenantId: string,
    field: keyof MeterForm,
    value: string,
  ) {
    setForms((current) => ({
      ...current,
      [tenantId]: {
        ...(current[tenantId] ?? getDefaultForm()),
        [field]: value,
      },
    }));
  }

  async function createWaterBill(
    event: FormEvent<HTMLFormElement>,
    tenant: Tenant,
  ) {
    event.preventDefault();

    const tenantForm = forms[tenant.id] ?? getDefaultForm();

    if (waterRate === null) {
      setError("The current water rate has not loaded yet.");
      return;
    }

    if (!tenant.unit) {
      setError(
        `${tenant.user.fullName} does not have an assigned unit.`,
      );
      return;
    }

    if (
      !tenantForm.billingMonth ||
      !tenantForm.previousReading ||
      !tenantForm.currentReading ||
      !tenantForm.dueDate
    ) {
      setError(
        "Billing month, readings, and due date are required.",
      );
      return;
    }

    const previousReading = Number(
      tenantForm.previousReading,
    );
    const currentReading = Number(tenantForm.currentReading);

    if (
      !Number.isFinite(previousReading) ||
      previousReading < 0
    ) {
      setError("Previous reading must be zero or greater.");
      return;
    }

    if (
      !Number.isFinite(currentReading) ||
      currentReading < 0
    ) {
      setError("Current reading must be zero or greater.");
      return;
    }

    if (currentReading < previousReading) {
      setError(
        "Current reading cannot be lower than the previous reading.",
      );
      return;
    }

    const consumption = currentReading - previousReading;
    const amount = consumption * waterRate;

    const confirmed = window.confirm(
      `Create a water bill of KSh ${formatMoney(
        amount,
      )} for ${tenant.user.fullName}?`,
    );

    if (!confirmed) {
      return;
    }

    setActiveTenantId(tenant.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/billing/water", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          billingMonth: `${tenantForm.billingMonth}-01`,
          previousReading: tenantForm.previousReading,
          currentReading: tenantForm.currentReading,
          dueDate: tenantForm.dueDate,
          notes: tenantForm.notes.trim() || undefined,
        }),
      });

      const data = (await response.json()) as WaterBillResponse;

      if (!response.ok) {
        setError(data.error ?? "Unable to create water bill.");
        return;
      }

      const savedRate = data.waterBill?.rate
        ? ` at KSh ${formatMoney(Number(data.waterBill.rate))} per unit`
        : "";

      setSuccess(
        `${tenant.user.fullName}: ${
          data.message ?? "Water bill created successfully."
        }${savedRate}`,
      );

      setForms((current) => ({
        ...current,
        [tenant.id]: {
          ...getDefaultForm(),
          billingMonth: tenantForm.billingMonth,
          previousReading: tenantForm.currentReading,
          dueDate: tenantForm.dueDate,
        },
      }));
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
            Monthly Water Billing
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="rounded-lg bg-slate-700 px-4 py-2 font-semibold hover:bg-slate-600"
        >
          Back to Dashboard
        </button>
      </header>

      <section className="mx-auto max-w-7xl p-8">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-slate-900">
            Record monthly meter readings
          </h2>

          <p className="mt-2 text-slate-600">
            Current water rate:{" "}
            <strong>
              {waterRate === null
                ? "Loading..."
                : `KSh ${formatMoney(waterRate)}`}
            </strong>{" "}
            per consumed unit.
          </p>

          {error ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-5 rounded-lg bg-green-50 px-4 py-3 text-green-700">
              {success}
            </div>
          ) : null}

          {isLoading ? (
            <p className="mt-6 text-slate-600">
              Loading active tenants and water rate...
            </p>
          ) : tenants.length === 0 ? (
            <p className="mt-6 text-slate-600">
              No active tenants found.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-[1250px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold">
                      Tenant
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Unit
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Billing month
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Previous reading
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Current reading
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Usage
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Amount
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Due date
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {tenants.map((tenant) => {
                    const tenantForm =
                      forms[tenant.id] ?? getDefaultForm();

                    const consumption =
                      calculateConsumption(tenantForm);

                    const amount =
                      consumption === null || waterRate === null
                        ? null
                        : consumption * waterRate;

                    return (
                      <tr
                        key={tenant.id}
                        className="border-b border-slate-200 align-top"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900">
                            {tenant.user.fullName}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {tenant.user.email ??
                              "No email provided"}
                          </p>
                        </td>

                        <td className="px-4 py-4 font-semibold">
                          {tenant.unit?.unitNumber ??
                            "Not assigned"}
                        </td>

                        <td className="px-4 py-4">
                          <input
                            type="month"
                            value={tenantForm.billingMonth}
                            onChange={(event) =>
                              updateForm(
                                tenant.id,
                                "billingMonth",
                                event.target.value,
                              )
                            }
                            className="rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </td>

                        <td className="px-4 py-4">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={tenantForm.previousReading}
                            onChange={(event) =>
                              updateForm(
                                tenant.id,
                                "previousReading",
                                event.target.value,
                              )
                            }
                            className="w-32 rounded-lg border border-slate-300 px-3 py-2"
                            placeholder="0.000"
                          />
                        </td>

                        <td className="px-4 py-4">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={tenantForm.currentReading}
                            onChange={(event) =>
                              updateForm(
                                tenant.id,
                                "currentReading",
                                event.target.value,
                              )
                            }
                            className="w-32 rounded-lg border border-slate-300 px-3 py-2"
                            placeholder="0.000"
                          />
                        </td>

                        <td className="px-4 py-4 font-semibold">
                          {consumption === null
                            ? "—"
                            : consumption.toFixed(3)}
                        </td>

                        <td className="px-4 py-4 font-semibold">
                          {amount === null
                            ? "—"
                            : `KSh ${formatMoney(amount)}`}
                        </td>

                        <td className="px-4 py-4">
                          <input
                            type="date"
                            value={tenantForm.dueDate}
                            onChange={(event) =>
                              updateForm(
                                tenant.id,
                                "dueDate",
                                event.target.value,
                              )
                            }
                            className="rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </td>

                        <td className="px-4 py-4">
                          <form
                            onSubmit={(event) =>
                              void createWaterBill(
                                event,
                                tenant,
                              )
                            }
                          >
                            <button
                              type="submit"
                              disabled={
                                activeTenantId === tenant.id ||
                                waterRate === null ||
                                !tenant.unit
                              }
                              className="whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {activeTenantId === tenant.id
                                ? "Saving..."
                                : "Create bill"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
