"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Payment = {
  id: string;
  amount: string;
  paymentDate: string;
  method: string;
  category: string;
  status: string;
  transactionReference: string | null;
  rentBillId: string | null;
  waterBillId: string | null;
  receipt: {
    id: string;
    receiptNumber: string;
    issuedAt: string;
  } | null;
};


type RentBill = {
  id: string;
  billingMonth: string;
  amount: string;
  paidAmount: string;
  balance: string;
  status: string;
  adjustment: string;
  dueDate: string;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  payments: Payment[];
};

type WaterBill = {
  id: string;
  billingMonth: string;
  previousReading: string | null;
  currentReading: string | null;
  consumption: string | null;
  rate: string | null;
  amount: string;
  paidAmount: string;
  balance: string;
  status: string;
  dueDate: string;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  payments: Payment[];
};

type SummaryResponse = {
  tenant: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    accountStatus: string;
    monthlyRent: string;
    requestedUnitNumber: string | null;
  };
  unit: {
    id: string;
    unitNumber: string;
    floor: number | null;
    type: string;
    status: string;
    property: {
      id: string;
      name: string;
      address: string | null;
      waterRate: string;
    } | null;
  } | null;
  balances: {
    rent: string;
    water: string;
    total: string;
  };
  rentBills: RentBill[];
  waterBills: WaterBill[];
  payments: Payment[];
};

function formatMoney(value: string | number ) {
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

function formatMonth(value: string) {
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
  });
}

function statusClass(status: string) {
  if (status === "PAID") {
    return "bg-green-100 text-green-800";
  }

  if (status === "PARTIALLY_PAID") {
    return "bg-yellow-100 text-yellow-800";
  }

  return "bg-red-100 text-red-800";
}

export default function TenantPage() {
  const router = useRouter();

  const [data, setData] = useState<SummaryResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    const response = await fetch("/api/tenant/summary", {
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

    const result = (await response.json()) as
      | SummaryResponse
      | { error?: string };

    if (!response.ok) {
      throw new Error(
        "error" in result
          ? result.error ?? "Unable to load tenant information."
          : "Unable to load tenant information.",
      );
    }

    setData(result as SummaryResponse);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadSummary();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load tenant information.",
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
  }, [loadSummary]);


  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-700">
          Loading your tenant portal...
        </p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-100">
        <header className="bg-blue-800 px-8 py-6 text-white">
          <p className="text-sm text-blue-100">
            Mashaallah Apartments
          </p>
          <h1 className="text-2xl font-bold">Tenant Portal</h1>
        </header>

        <section className="mx-auto max-w-3xl p-8">
          <div className="rounded-xl bg-red-50 p-6 text-red-700 shadow">
            {error || "Unable to load tenant information."}
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-blue-800 px-8 py-6 text-white">
        <div>
          <p className="text-sm text-blue-100">
            Mashaallah Apartments
          </p>

          <h1 className="text-2xl font-bold">
            Tenant Portal
          </h1>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 p-8">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold text-slate-900">
            Welcome, {data.tenant.fullName}
          </h2>

          <div className="mt-3 grid gap-2 text-slate-600 md:grid-cols-2">
            <p>
              <strong>Email:</strong>{" "}
              {data.tenant.email ?? "Not provided"}
            </p>

            <p>
              <strong>Phone:</strong>{" "}
              {data.tenant.phone ?? "Not provided"}
            </p>

            <p>
              <strong>Account status:</strong>{" "}
              {data.tenant.accountStatus}
            </p>

            <p>
              <strong>Monthly rent:</strong> KSh{" "}
              {formatMoney(data.tenant.monthlyRent)}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-slate-900">
            Assigned unit
          </h2>

          {data.unit ? (
            <div className="mt-4 grid gap-3 text-slate-700 md:grid-cols-4">
              <div>
                <p className="text-sm text-slate-500">Unit</p>
                <p className="font-semibold">
                  {data.unit.unitNumber}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Floor</p>
                <p className="font-semibold">
                  {data.unit.floor ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Type</p>
                <p className="font-semibold">
                  {data.unit.type}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Status</p>
                <p className="font-semibold">
                  {data.unit.status}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-slate-600">
              No unit has been assigned yet.
            </p>
          )}
        </div>

        <div 
           id="balances"
           className="grid scroll-mt-6 gap-6 md:grid-cols-3"
          >
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">
              Outstanding rent
            </p>

            <p className="mt-2 text-3xl font-bold text-red-700">
              KSh {formatMoney(data.balances.rent)}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">
              Outstanding water
            </p>

            <p className="mt-2 text-3xl font-bold text-cyan-700">
              KSh {formatMoney(data.balances.water)}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">
              Total outstanding
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              KSh {formatMoney(data.balances.total)}
            </p>
          </div>
        </div>

        <section
          id="rent-bills"
           className="scroll-mt-6 rounded-xl bg-white p-6 shadow"
          >
          <h2 className="text-xl font-bold text-slate-900">
            Rent bill history
          </h2>

          {data.rentBills.length === 0 ? (
            <p className="mt-4 text-slate-600">
              No rent bills have been created yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Due date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {data.rentBills.map((bill) => (
                    <tr
                      key={bill.id}
                      className="border-b border-slate-100"
                    >
                      <td className="px-4 py-3">
                        {formatMonth(bill.billingMonth)}
                      </td>

                      <td className="px-4 py-3">
                        KSh {formatMoney(bill.amount)}
                      </td>

                      <td className="px-4 py-3">
                        KSh {formatMoney(bill.paidAmount)}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        KSh {formatMoney(bill.balance)}
                      </td>

                      <td className="px-4 py-3">
                        {formatDate(bill.dueDate)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                            bill.status,
                          )}`}
                        >
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section 
          id="water-bills"
          className="scroll-mt-6 rounded-xl bg-white p-6 shadow"
          >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Water bill history
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Current rate: KSh{" "}
                {data.unit?.property
                  ? formatMoney(data.unit.property.waterRate)
                  : "—"}{" "}
                per unit
              </p>
            </div>
          </div>

          {data.waterBills.length === 0 ? (
            <p className="mt-4 text-slate-600">
              No water bills have been created yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">
                      Previous reading
                    </th>
                    <th className="px-4 py-3">
                      Current reading
                    </th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">Rate</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {data.waterBills.map((bill) => (
                    <tr
                      key={bill.id}
                      className="border-b border-slate-100"
                    >
                      <td className="px-4 py-3">
                        {formatMonth(bill.billingMonth)}
                      </td>

                      <td className="px-4 py-3">
                        {bill.previousReading ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        {bill.currentReading ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        {bill.consumption ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        KSh {formatMoney(bill.rate ?? "0")}
                      </td>

                      <td className="px-4 py-3">
                        KSh {formatMoney(bill.amount)}
                      </td>

                      <td className="px-4 py-3">
                        KSh {formatMoney(bill.paidAmount)}
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        KSh {formatMoney(bill.balance)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                            bill.status,
                          )}`}
                        >
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="payments"
          className="scroll-mt-6 rounded-xl bg-white p-6 shadow"
          >
          <h2 className="text-xl font-bold text-slate-900">
            Payment and receipt history
          </h2>

  {data.payments.length === 0 ? (
    <p className="mt-4 text-slate-600">
      No confirmed payments have been recorded yet.
    </p>
   ) : (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[950px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Method</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Receipt number</th>
            <th className="px-4 py-3">Receipt issued</th>
          </tr>
        </thead>

        <tbody>
          {data.payments.map((payment) => (
            <tr
              key={payment.id}
              className="border-b border-slate-100"
            >
              <td className="px-4 py-3">
                {formatDate(payment.paymentDate)}
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
              {payment.receipt ? (
                <a
                  href={`/tenant/receipts/${encodeURIComponent(
                    payment.receipt.id,
                  )}`}
                  className="font-semibold text-blue-700 underline hover:text-blue-900"
                >
                  {payment.receipt.receiptNumber}
                </a>
              ) : (
                "—"
                )}
              </td>

              <td className="px-4 py-3">
                {payment.receipt
                  ? formatDate(payment.receipt.issuedAt)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</section>
      </section>
    </main>
  );
}
