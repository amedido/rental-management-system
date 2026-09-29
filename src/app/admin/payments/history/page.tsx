"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Payment = {
  id: string;
  category: "RENT" | "WATER";
  method: string;
  amount: string;
  paymentDate: string;
  status: string;
  confirmedAt: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  transactionReference: string | null;
  notes: string | null;
  createdAt: string;
  tenant: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  };
  unitNumber: string;
  receipt: {
    id: string;
    receiptNumber: string;
    issuedAt: string;
  } | null;
  recordedBy: {
    fullName: string;
    email: string | null;
  } | null;
};

type PaymentsResponse = {
  payments: Payment[];
  error?: string;
};

function formatMoney(value: string) {
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string) {
  if (status === "CONFIRMED") {
    return "bg-green-100 text-green-800";
  }

  if (status === "REVERSED") {
    return "bg-red-100 text-red-800";
  }

  return "bg-yellow-100 text-yellow-800";
}

export default function AdminPaymentHistoryPage() {
  const router = useRouter();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reversingPaymentId, setReversingPaymentId] =
    useState<string | null>(null);


  const loadPayments = useCallback(async () => {
    const response = await fetch(
      "/api/admin/payments/history",
      {
        cache: "no-store",
      },
    );

    if (response.status === 401) {
      router.replace("/login");
      return;
    }

    if (response.status === 403) {
      router.replace("/admin");
      return;
    }

    const data = (await response.json()) as PaymentsResponse;

    if (!response.ok) {
      throw new Error(
        data.error ?? "Unable to load payment history.",
      );
    }

    setPayments(data.payments);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadPayments();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load payment history.",
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
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !searchText ||
        payment.tenant.fullName.toLowerCase().includes(searchText) ||
        payment.tenant.email
          ?.toLowerCase()
          .includes(searchText) ||
        payment.unitNumber.toLowerCase().includes(searchText) ||
        payment.transactionReference
          ?.toLowerCase()
          .includes(searchText) ||
        payment.receipt?.receiptNumber
          .toLowerCase()
          .includes(searchText);

      const matchesCategory =
        category === "ALL" || payment.category === category;

      const matchesStatus =
        status === "ALL" || payment.status === status;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus
      );
    });
  }, [category, payments, search, status]);

    async function reversePayment(payment: Payment) {
    if (payment.status !== "CONFIRMED") {
      return;
    }

    const reason = window.prompt(
      `Enter the reason for reversing payment ${
        payment.receipt?.receiptNumber ?? payment.id
      }:`,
    );

    if (!reason || reason.trim().length < 5) {
      window.alert(
        "A reversal reason of at least 5 characters is required.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Reverse KSh ${formatMoney(payment.amount)} for ${
        payment.tenant.fullName
      }? This will restore the bill balance.`,
    );

    if (!confirmed) {
      return;
    }

    setReversingPaymentId(payment.id);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/payments/${encodeURIComponent(
          payment.id,
        )}/reverse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: reason.trim(),
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Unable to reverse payment.");
        return;
      }

      window.alert(
        data.message ?? "Payment reversed successfully.",
      );

      await loadPayments();
    } catch {
      setError("Unable to contact the server.");
    } finally {
      setReversingPaymentId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 px-8 py-6 text-white">
        <div>
          <p className="text-sm text-slate-300">
            Mashaallah Apartments
          </p>

          <h1 className="text-2xl font-bold">
            Payment and Receipt History
          </h1>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/payments")}
            className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold hover:bg-emerald-800"
          >
            Record Payment
          </button>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-lg bg-slate-700 px-4 py-2 font-semibold hover:bg-slate-600"
          >
            Dashboard
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 p-8">
        <div className="grid gap-4 rounded-xl bg-white p-6 shadow md:grid-cols-3">
          <div className="md:col-span-1">
            <label
              htmlFor="search"
              className="block text-sm font-medium text-slate-700"
            >
              Search
            </label>

            <input
              id="search"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Tenant, unit, reference, receipt"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-slate-700"
            >
              Category
            </label>

            <select
              id="category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
            >
              <option value="ALL">All categories</option>
              <option value="RENT">Rent</option>
              <option value="WATER">Water</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-slate-700"
            >
              Status
            </label>

            <select
              id="status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
            >
              <option value="ALL">All statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REVERSED">Reversed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl bg-red-50 p-5 text-red-700 shadow">
            {error}
          </div>
        ) : null}

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Recorded payments
            </h2>

            <p className="text-sm text-slate-500">
              Showing {filteredPayments.length} of{" "}
              {payments.length}
            </p>
          </div>

          {isLoading ? (
            <p className="mt-5 text-slate-600">
              Loading payment history...
            </p>
          ) : filteredPayments.length === 0 ? (
            <p className="mt-5 text-slate-600">
              No payments match the selected filters.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3">Payment date</th>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Receipt</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Recorded by</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="px-4 py-3">
                        <p>
                          {formatDate(payment.paymentDate)}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Confirmed:{" "}
                          {formatDateTime(payment.confirmedAt)}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold">
                          {payment.tenant.fullName}
                        </p>

                        <p className="text-xs text-slate-500">
                          {payment.tenant.email ?? "No email"}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        {payment.unitNumber}
                      </td>

                      <td className="px-4 py-3">
                        {payment.category}
                      </td>

                      <td className="px-4 py-3">
                        {payment.method}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        KSh {formatMoney(payment.amount)}
                      </td>

                      <td className="px-4 py-3">
                        {payment.transactionReference ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        {payment.receipt ? (
                          <span className="font-semibold text-blue-700">
                            {payment.receipt.receiptNumber}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                            payment.status,
                          )}`}
                        >
                          {payment.status}
                        </span>

                        {payment.reversedAt ? (
                          <p className="mt-2 text-xs text-red-700">
                            Reversed:{" "}
                            {formatDateTime(payment.reversedAt)}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        {payment.recordedBy?.fullName ?? "System"}
                      </td>
                      <td className="px-4 py-3">
                        {payment.status === "CONFIRMED" ? (
                          <button
                            type="button"
                            onClick={() => void reversePayment(payment)}
                            disabled={reversingPaymentId === payment.id}
                            className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {reversingPaymentId === payment.id
                              ? "Reversing..."
                              : "Reverse"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">
                            No action
                          </span>
                         )}
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
