"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type DashboardData = {
  generatedAt: string;
  occupancy: {
    activeTenants: number;
    occupiedUnits: number;
    totalUnits: number;
    vacantUnits: number;
  };
  collections: {
    rent: string;
    water: string;
    total: string;
    reversed: string;
  };
  outstanding: {
    rent: string;
    water: string;
    total: string;
  };
  bills: {
    rent: {
      paid: number;
      partiallyPaid: number;
      unpaid: number;
      total: number;
    };
    water: {
      paid: number;
      partiallyPaid: number;
      unpaid: number;
      total: number;
    };
  };
  monthlyCollections: Array<{
    month: string;
    label: string;
    rent: string;
    water: string;
    total: string;
  }>;
  tenantBalances: Array<{
    id: string;
    fullName: string;
    email: string | null;
    unitNumber: string;
    rentBalance: string;
    waterBalance: string;
    totalBalance: string;
    rentBills: Array<{
      id: string;
      billingMonth: string;
      amount: string;
      paidAmount: string;
      balance: string;
    }>;
    waterBills: Array<{
      id: string;
      billingMonth: string;
      amount: string;
      paidAmount: string;
      balance: string;
    }>;
  }>;
};

type DashboardResponse = DashboardData & {
  error?: string;
};

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function collectionCardClass(color: string) {
  return `rounded-2xl border p-5 shadow-sm ${color}`;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedTenantId, setExpandedTenantId] =
    useState<string | null>(null);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError("");

      try {
        const response = await fetch("/api/admin/dashboard", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.status === 403) {
          router.replace("/login");
          return;
        }

        const result =
          (await response.json()) as DashboardResponse;

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Unable to load dashboard information.",
          );
        }

        setData(result);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load dashboard information.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadDashboard();
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [loadDashboard]);


  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-700">
          Loading administrator dashboard...
        </p>
      </main>
    );
  }

    if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-100">
        <section className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow">
            <h1 className="text-xl font-bold text-slate-900">
              Dashboard unavailable
            </h1>

            <p className="mt-3 text-red-700">
              {error || "Unable to load dashboard data."}
            </p>

            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              className="mt-6 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
            >
              Try again
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      
      <section className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-6 py-5 shadow-sm md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-700">
                Mashaallah Apartments
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                Administrator Dashboard
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Monitor collections, balances, billing, and
                occupancy.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              disabled={isRefreshing}
              className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing..." : "Refresh data"}
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Last updated: {formatDateTime(data.generatedAt)}
          </p>
        </header>

        <div className="space-y-8 p-6 md:p-8">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                Financial overview
              </h2>

              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                Live database figures
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <div
                className={collectionCardClass(
                  "border-blue-200 bg-blue-50",
                )}
              >
                <p className="text-sm font-medium text-blue-800">
                  Total collected
                </p>

                <p className="mt-3 text-3xl font-bold text-blue-950">
                  KSh {formatMoney(data.collections.total)}
                </p>

                <p className="mt-2 text-sm text-blue-700">
                  Rent and water payments
                </p>
              </div>

              <div
                className={collectionCardClass(
                  "border-emerald-200 bg-emerald-50",
                )}
              >
                <p className="text-sm font-medium text-emerald-800">
                  Rent collected
                </p>

                <p className="mt-3 text-3xl font-bold text-emerald-950">
                  KSh {formatMoney(data.collections.rent)}
                </p>

                <p className="mt-2 text-sm text-emerald-700">
                  Confirmed rent payments
                </p>
              </div>

              <div
                className={collectionCardClass(
                  "border-cyan-200 bg-cyan-50",
                )}
              >
                <p className="text-sm font-medium text-cyan-800">
                  Water collected
                </p>

                <p className="mt-3 text-3xl font-bold text-cyan-950">
                  KSh {formatMoney(data.collections.water)}
                </p>

                <p className="mt-2 text-sm text-cyan-700">
                  Confirmed water payments
                </p>
              </div>

              <div
                className={collectionCardClass(
                  "border-red-200 bg-red-50",
                )}
              >
                <p className="text-sm font-medium text-red-800">
                  Total outstanding
                </p>

                <p className="mt-3 text-3xl font-bold text-red-950">
                  KSh {formatMoney(data.outstanding.total)}
                </p>

                <p className="mt-2 text-sm text-red-700">
                  Unpaid and partially paid bills
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Outstanding balances
                </h2>

                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  Due
                </span>
              </div>

              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-slate-600">
                    Outstanding rent
                  </span>

                  <span className="font-bold text-slate-900">
                    KSh {formatMoney(data.outstanding.rent)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="text-slate-600">
                    Outstanding water
                  </span>

                  <span className="font-bold text-slate-900">
                    KSh {formatMoney(data.outstanding.water)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    Total due
                  </span>

                  <span className="text-xl font-bold text-red-700">
                    KSh {formatMoney(data.outstanding.total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Occupancy
                </h2>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  Property
                </span>
              </div>

              <div className="mt-6">
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-bold text-slate-900">
                    {data.occupancy.occupiedUnits}
                  </p>

                  <p className="pb-1 text-sm text-slate-500">
                    of {data.occupancy.totalUnits} units occupied
                  </p>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-700"
                    style={{
                      width: `${
                        data.occupancy.totalUnits > 0
                          ? Math.min(
                              100,
                              (data.occupancy.occupiedUnits /
                                data.occupancy.totalUnits) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="text-xs text-green-700">
                      Active tenants
                    </p>

                    <p className="mt-1 text-2xl font-bold text-green-900">
                      {data.occupancy.activeTenants}
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-100 p-3">
                    <p className="text-xs text-slate-600">
                      Vacant units
                    </p>

                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {data.occupancy.vacantUnits}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Reversed payments
                </h2>

                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Audit
                </span>
              </div>

              <p className="mt-6 text-4xl font-bold text-amber-700">
                KSh {formatMoney(data.collections.reversed)}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Payments marked as reversed are excluded from
                collections and balances.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push("/admin/payments/history")
                }
                className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                View payment history
              </button>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Rent bill status
              </h2>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-xs text-green-700">Paid</p>
                  <p className="mt-1 text-2xl font-bold text-green-900">
                    {data.bills.rent.paid}
                  </p>
                </div>

                <div className="rounded-lg bg-yellow-50 p-4">
                  <p className="text-xs text-yellow-700">
                    Partial
                  </p>
                  <p className="mt-1 text-2xl font-bold text-yellow-900">
                    {data.bills.rent.partiallyPaid}
                  </p>
                </div>

                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-xs text-red-700">Unpaid</p>
                  <p className="mt-1 text-2xl font-bold text-red-900">
                    {data.bills.rent.unpaid}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Total rent bills: {data.bills.rent.total}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Water bill status
              </h2>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-xs text-green-700">Paid</p>
                  <p className="mt-1 text-2xl font-bold text-green-900">
                    {data.bills.water.paid}
                  </p>
                </div>

                <div className="rounded-lg bg-yellow-50 p-4">
                  <p className="text-xs text-yellow-700">
                    Partial
                  </p>
                  <p className="mt-1 text-2xl font-bold text-yellow-900">
                    {data.bills.water.partiallyPaid}
                  </p>
                </div>

                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-xs text-red-700">Unpaid</p>
                  <p className="mt-1 text-2xl font-bold text-red-900">
                    {data.bills.water.unpaid}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                Total water bills: {data.bills.water.total}
              </p>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Collection trend
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Confirmed collections by payment month.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/admin/payments/history")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open payment history
              </button>
            </div>

            {data.monthlyCollections.length === 0 ? (
              <p className="mt-6 text-slate-600">
                No confirmed payments have been recorded yet.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[650px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3">Rent</th>
                      <th className="px-4 py-3">Water</th>
                      <th className="px-4 py-3">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.monthlyCollections.map((item) => (
                      <tr
                        key={item.month}
                        className="border-b border-slate-100"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {item.label}
                        </td>

                        <td className="px-4 py-3">
                          KSh {formatMoney(item.rent)}
                        </td>

                        <td className="px-4 py-3">
                          KSh {formatMoney(item.water)}
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-900">
                          KSh {formatMoney(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

                    <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Tenants with balances to clear
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Click a tenant to view unpaid rent and water bills.
                </p>
              </div>

              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                {data.tenantBalances.length} tenant
                {data.tenantBalances.length === 1 ? "" : "s"}
                with balances
              </span>
            </div>

            {data.tenantBalances.length === 0 ? (
              <div className="mt-6 rounded-lg bg-green-50 p-5 text-green-800">
                All active tenants have cleared their current bills.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {data.tenantBalances.map((tenant) => {
                  const isExpanded =
                    expandedTenantId === tenant.id;

                  return (
                    <div
                      key={tenant.id}
                      className="overflow-hidden rounded-xl border border-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTenantId(
                            isExpanded ? null : tenant.id,
                          )
                        }
                        className="flex w-full flex-wrap items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {tenant.fullName}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Unit {tenant.unitNumber}
                            {tenant.email
                              ? ` · ${tenant.email}`
                              : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="text-red-700">
                            Rent:{" "}
                            <strong>
                              KSh{" "}
                              {formatMoney(
                                tenant.rentBalance,
                              )}
                            </strong>
                          </span>

                          <span className="text-cyan-700">
                            Water:{" "}
                            <strong>
                              KSh{" "}
                              {formatMoney(
                                tenant.waterBalance,
                              )}
                            </strong>
                          </span>

                          <span className="rounded-lg bg-red-100 px-3 py-2 font-bold text-red-800">
                            Total: KSh{" "}
                            {formatMoney(
                              tenant.totalBalance,
                            )}
                          </span>

                          <span className="text-slate-500">
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="border-t border-slate-200 bg-slate-50 px-5 py-5">
                          <div className="grid gap-5 lg:grid-cols-2">
                            <div>
                              <h3 className="font-bold text-slate-900">
                                Rent bills to clear
                              </h3>

                              {tenant.rentBills.length === 0 ? (
                                <p className="mt-3 text-sm text-slate-500">
                                  No outstanding rent bills.
                                </p>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  {tenant.rentBills.map((bill) => (
                                    <div
                                      key={bill.id}
                                      className="rounded-lg bg-white p-3 text-sm shadow-sm"
                                    >
                                      <div className="flex justify-between gap-3">
                                        <span className="font-medium text-slate-700">
                                          {new Date(
                                            bill.billingMonth,
                                          ).toLocaleDateString(
                                            "en-KE",
                                            {
                                              year: "numeric",
                                              month: "long",
                                            },
                                          )}
                                        </span>

                                        <strong className="text-red-700">
                                          KSh{" "}
                                          {formatMoney(
                                            bill.balance,
                                          )}
                                        </strong>
                                      </div>

                                      <p className="mt-1 text-xs text-slate-500">
                                        Bill: KSh{" "}
                                        {formatMoney(
                                          bill.amount,
                                        )}
                                        {" · "}
                                        Paid: KSh{" "}
                                        {formatMoney(
                                          bill.paidAmount,
                                        )}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <h3 className="font-bold text-slate-900">
                                Water bills to clear
                              </h3>

                              {tenant.waterBills.length === 0 ? (
                                <p className="mt-3 text-sm text-slate-500">
                                  No outstanding water bills.
                                </p>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  {tenant.waterBills.map((bill) => (
                                    <div
                                      key={bill.id}
                                      className="rounded-lg bg-white p-3 text-sm shadow-sm"
                                    >
                                      <div className="flex justify-between gap-3">
                                        <span className="font-medium text-slate-700">
                                          {new Date(
                                            bill.billingMonth,
                                          ).toLocaleDateString(
                                            "en-KE",
                                            {
                                              year: "numeric",
                                              month: "long",
                                            },
                                          )}
                                        </span>

                                        <strong className="text-cyan-700">
                                          KSh{" "}
                                          {formatMoney(
                                            bill.balance,
                                          )}
                                        </strong>
                                      </div>

                                      <p className="mt-1 text-xs text-slate-500">
                                        Bill: KSh{" "}
                                        {formatMoney(
                                          bill.amount,
                                        )}
                                        {" · "}
                                        Paid: KSh{" "}
                                        {formatMoney(
                                          bill.paidAmount,
                                        )}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              router.push("/admin/payments")
                            }
                            className="mt-5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                          >
                            Record payment
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <h2 className="text-lg font-bold text-blue-950">
              Quick actions
            </h2>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/admin/tenants")}
                className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Manage tenants
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/admin/billing/rent")
                }
                className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100"
              >
                Generate rent bills
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/admin/billing/water")
                }
                className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100"
              >
                Record water readings
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/admin/payments")
                }
                className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100"
              >
                Record payment
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
