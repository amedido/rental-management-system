"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Bill = {
  id: string;
  billingMonth: string;
  amount: string;
  paidAmount: string;
  balance: string;
  status: string;
};

type Tenant = {
  id: string;
  fullName: string;
  email: string | null;
  unitNumber: string | null;
  rentBills: Bill[];
  waterBills: Bill[];
};

type PaymentsResponse = {
  tenants: Tenant[];
  error?: string;
};

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMonth(value: string) {
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
  });
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminPaymentsPage() {
  const router = useRouter();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedBillId, setSelectedBillId] = useState("");
  const [selectedBillType, setSelectedBillType] = useState<
    "RENT" | "WATER" | ""
  >("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [transactionReference, setTransactionReference] =
    useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPaymentsData = useCallback(async () => {
    const response = await fetch("/api/admin/payments", {
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

    const data = (await response.json()) as PaymentsResponse;

    if (!response.ok) {
      throw new Error(
        data.error ?? "Unable to load outstanding bills.",
      );
    }

    setTenants(data.tenants);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadPaymentsData();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load outstanding bills.",
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
  }, [loadPaymentsData]);

  const selectedTenant = useMemo(
    () =>
      tenants.find(
        (tenant) => tenant.id === selectedTenantId,
      ) ?? null,
    [selectedTenantId, tenants],
  );

  const selectedBills = useMemo(() => {
    if (!selectedTenant) {
      return [];
    }

    return [
      ...selectedTenant.rentBills.map((bill) => ({
        ...bill,
        type: "RENT" as const,
      })),
      ...selectedTenant.waterBills.map((bill) => ({
        ...bill,
        type: "WATER" as const,
      })),
    ];
  }, [selectedTenant]);

  const selectedBill = selectedBills.find(
    (bill) =>
      bill.id === selectedBillId &&
      bill.type === selectedBillType,
  );

  function selectTenant(value: string) {
    setSelectedTenantId(value);
    setSelectedBillId("");
    setSelectedBillType("");
    setAmount("");
  }

  function selectBill(value: string) {
    const [type, billId] = value.split(":");

    const bill = selectedBills.find(
      (item) => item.type === type && item.id === billId,
    );

    setSelectedBillType(
      type === "RENT" || type === "WATER" ? type : "",
    );
    setSelectedBillId(billId ?? "");
    setAmount(bill?.balance ?? "");
  }

  async function recordPayment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedTenantId) {
      setError("Select a tenant.");
      return;
    }

    if (!selectedBillId || !selectedBillType) {
      setError("Select a bill.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (
      selectedBill &&
      Number(amount) > Number(selectedBill.balance)
    ) {
      setError(
        `Payment cannot exceed the outstanding balance of KSh ${formatMoney(
          selectedBill.balance,
        )}.`,
      );
      return;
    }

    const confirmed = window.confirm(
      "Record this payment and generate a receipt?",
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: selectedTenantId,
          ...(selectedBillType === "RENT"
            ? { rentBillId: selectedBillId }
            : { waterBillId: selectedBillId }),
          amount,
          paymentDate,
          transactionReference:
            transactionReference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
        receipt?: {
          receiptNumber: string;
        };
        remainingBalance?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Unable to record payment.");
        return;
      }

      setSuccess(
        `${data.message ?? "Payment recorded successfully."} Receipt: ${
          data.receipt?.receiptNumber ?? "generated"
        }. Remaining balance: KSh ${formatMoney(
          data.remainingBalance ?? "0",
        )}.`,
      );

      setSelectedBillId("");
      setSelectedBillType("");
      setAmount("");
      setTransactionReference("");
      setNotes("");

      await loadPaymentsData();
    } catch {
      setError("Unable to contact the server.");
    } finally {
      setIsSaving(false);
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
            Record Payments
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

      <section className="mx-auto max-w-5xl space-y-6 p-8">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-slate-900">
            Payment instructions
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-blue-50 p-4 text-blue-900">
              <h3 className="font-bold">Rent — Equity Bank</h3>
              <p className="mt-2">
                Business number: <strong>247247</strong>
              </p>
              <p>
                Account reference:{" "}
                <strong>972944#UnitNumber</strong>
              </p>
              <p className="mt-2 text-sm">
                Example for unit A3: 972944#A3
              </p>
            </div>

            <div className="rounded-lg bg-green-50 p-4 text-green-900">
              <h3 className="font-bold">Water — M-Pesa</h3>
              <p className="mt-2">
                Payment number: <strong>0797568316</strong>
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={recordPayment}
          className="rounded-xl bg-white p-6 shadow"
        >
          <h2 className="text-xl font-bold text-slate-900">
            Record a payment
          </h2>

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
            <p className="mt-5 text-slate-600">
              Loading outstanding bills...
            </p>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="tenant"
                  className="block text-sm font-medium text-slate-700"
                >
                  Tenant
                </label>

                <select
                  id="tenant"
                  value={selectedTenantId}
                  onChange={(event) =>
                    selectTenant(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                >
                  <option value="">Select tenant</option>

                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.fullName} — Unit{" "}
                      {tenant.unitNumber ?? "unassigned"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="bill"
                  className="block text-sm font-medium text-slate-700"
                >
                  Outstanding bill
                </label>

                <select
                  id="bill"
                  value={
                    selectedBillId && selectedBillType
                      ? `${selectedBillType}:${selectedBillId}`
                      : ""
                  }
                  onChange={(event) =>
                    selectBill(event.target.value)
                  }
                  disabled={!selectedTenant}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                >
                  <option value="">Select bill</option>

                  {selectedBills.map((bill) => (
                    <option
                      key={`${bill.type}:${bill.id}`}
                      value={`${bill.type}:${bill.id}`}
                    >
                      {bill.type} — {formatMonth(bill.billingMonth)} —
                      Balance KSh {formatMoney(bill.balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-slate-700"
                >
                  Payment amount
                </label>

                <input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label
                  htmlFor="paymentDate"
                  className="block text-sm font-medium text-slate-700"
                >
                  Payment date
                </label>

                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(event) =>
                    setPaymentDate(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                />
              </div>

              <div>
                <label
                  htmlFor="transactionReference"
                  className="block text-sm font-medium text-slate-700"
                >
                  Transaction reference
                </label>

                <input
                  id="transactionReference"
                  type="text"
                  value={transactionReference}
                  onChange={(event) =>
                    setTransactionReference(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                  placeholder="Bank or M-Pesa reference"
                />
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-slate-700"
                >
                  Notes
                </label>

                <input
                  id="notes"
                  type="text"
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || isSaving}
            className="mt-6 w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Recording payment..."
              : "Record payment and generate receipt"}
          </button>
        </form>
      </section>
    </main>
  );
}

