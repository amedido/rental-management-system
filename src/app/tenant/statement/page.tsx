"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Transaction = {
  id: string;
  type: "RENT_BILL" | "WATER_BILL" | "PAYMENT";
  date: string;
  description: string;
  amount: string;
  paidAmount: string;
  balance: string;
  status: string;
  dueDate: string | null;
  reference: string | null;
  method?: string;
  runningBalance: string;
};

type StatementResponse = {
  tenant: {
    fullName: string;
    email: string | null;
    phone: string | null;
    unitNumber: string | null;
  };
  filters: {
    startDate: string | null;
    endDate: string | null;
  };
  summary: {
    openingBalance: string;
    totalBilled: string;
    totalPaid: string;
    closingBalance: string;
  };
  transactions: Transaction[];
  error?: string;
};

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusClass(status: string) {
  if (status === "PAID" || status === "CONFIRMED") {
    return "bg-green-100 text-green-800";
  }

  if (status === "PARTIALLY_PAID") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-red-100 text-red-800";
}

export default function TenantStatementPage() {
  const router = useRouter();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] =
    useState<StatementResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatement = useCallback(
    async (requestedStartDate = startDate, requestedEndDate = endDate) => {
      const query = new URLSearchParams();

      if (requestedStartDate) {
        query.set("startDate", requestedStartDate);
      }

      if (requestedEndDate) {
        query.set("endDate", requestedEndDate);
      }

      const queryString = query.toString();

      const response = await fetch(
        `/api/tenant/statement${
          queryString ? `?${queryString}` : ""
        }`,
        {
          cache: "no-store",
        },
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        router.replace("/tenant");
        return;
      }

      const responseData =
        (await response.json()) as StatementResponse;

      if (!response.ok) {
        throw new Error(
          responseData.error ??
            "Unable to load your statement.",
        );
      }

      setData(responseData);
    },
    [endDate, router, startDate],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatement()
        .catch((loadError) => {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your statement.",
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadStatement]);

  async function submitFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await loadStatement(startDate, endDate);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your statement.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function clearFilter() {
    setStartDate("");
    setEndDate("");
    setError("");
    setIsLoading(true);

    void loadStatement("", "")
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your statement.",
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  return (
    <section className="min-h-screen bg-slate-100 p-6 md:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-5 print:hidden">
          <div>
            <p className="text-sm font-medium text-blue-700">
              Mashaallah Apartments
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Financial statement
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Search your rent, water, payment, and balance history.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data || isLoading}
            className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>

        <form
          onSubmit={submitFilter}
          className="rounded-2xl bg-white p-6 shadow-sm print:hidden"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="start-date"
                className="block text-sm font-semibold text-slate-700"
              >
                Start date
              </label>

              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(event) =>
                  setStartDate(event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="end-date"
                className="block text-sm font-semibold text-slate-700"
              >
                End date
              </label>

              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(event) =>
                  setEndDate(event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
              />
            </div>

            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Search statement
              </button>

              <button
                type="button"
                onClick={clearFilter}
                className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>
        </form>

        {error ? (
          <div className="rounded-xl bg-red-50 p-4 text-red-700 print:hidden">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl bg-white p-8 text-slate-600">
            Loading statement...
          </div>
        ) : data ? (
          <div className="statement-document rounded-2xl bg-white p-6 shadow-sm md:p-10 print:rounded-none print:p-0 print:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Mashaallah Apartments
                </p>

                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  Tenant Financial Statement
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Generated on{" "}
                  {new Date().toLocaleDateString("en-KE", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div className="text-left text-sm text-slate-600 md:text-right">
                <p className="font-bold text-slate-900">
                  {data.tenant.fullName}
                </p>

                <p>{data.tenant.email ?? "No email"}</p>

                <p>{data.tenant.phone ?? "No phone"}</p>

                <p>
                  Unit: {data.tenant.unitNumber ?? "Not assigned"}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <strong>Statement period:</strong>{" "}
              {data.filters.startDate
                ? formatDate(data.filters.startDate)
                : "Beginning"}
              {" – "}
              {data.filters.endDate
                ? formatDate(data.filters.endDate)
                : "Current"}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Opening balance
                </p>

                <p className="mt-2 text-xl font-bold text-slate-900">
                  KSh{" "}
                  {formatMoney(data.summary.openingBalance)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Total billed
                </p>

                <p className="mt-2 text-xl font-bold text-slate-900">
                  KSh {formatMoney(data.summary.totalBilled)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Total paid
                </p>

                <p className="mt-2 text-xl font-bold text-emerald-700">
                  KSh {formatMoney(data.summary.totalPaid)}
                </p>
              </div>

              <div className="rounded-xl bg-blue-700 p-4 text-white">
                <p className="text-xs uppercase tracking-wide text-blue-100">
                  Closing balance
                </p>

                <p className="mt-2 text-xl font-bold">
                  KSh{" "}
                  {formatMoney(data.summary.closingBalance)}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-bold text-slate-900">
                Transaction history
              </h3>

              {data.transactions.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-50 p-5 text-slate-600">
                  No financial transactions match this date range.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Paid</th>
                        <th className="px-4 py-3">Balance</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">
                          Reference
                        </th>
                        <th className="px-4 py-3">
                          Running balance
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {data.transactions.map((transaction) => (
                        <tr
                          key={`${transaction.type}-${transaction.id}`}
                          className="border-b border-slate-100"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatDate(transaction.date)}
                          </td>

                          <td className="px-4 py-3 font-medium">
                            {transaction.description}
                          </td>

                          <td
                            className={`px-4 py-3 font-semibold ${
                              transaction.type === "PAYMENT"
                                ? "text-emerald-700"
                                : "text-slate-900"
                            }`}
                          >
                            {transaction.type === "PAYMENT"
                              ? "−"
                              : ""}
                            KSh{" "}
                            {formatMoney(
                              Math.abs(
                                Number(transaction.amount),
                              ),
                            )}
                          </td>

                          <td className="px-4 py-3">
                            KSh{" "}
                            {formatMoney(transaction.paidAmount)}
                          </td>

                          <td className="px-4 py-3">
                            KSh{" "}
                            {formatMoney(transaction.balance)}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                                transaction.status,
                              )}`}
                            >
                              {transaction.status}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {transaction.reference ?? "—"}
                          </td>

                          <td className="px-4 py-3 font-semibold">
                            KSh{" "}
                            {formatMoney(
                              transaction.runningBalance,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500">
              This statement is generated from the Mashaallah Apartments
              rental management system. Payments shown are confirmed
              payments recorded against this tenant account.
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
