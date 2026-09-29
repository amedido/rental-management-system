"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ReceiptData = {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  createdAt: string;
  tenant: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    identificationNumber: string | null;
    unit: {
      id: string;
      unitNumber: string;
      floor: number | null;
      type: string;
      property: {
        id: string;
        name: string;
        address: string | null;
      } | null;
    } | null;
  };
  payment: {
    id: string;
    category: string;
    method: string;
    amount: string;
    paymentDate: string;
    status: string;
    transactionReference: string | null;
    notes: string | null;
  };
  bill: {
    id: string;
    type: string;
    billingMonth: string;
    amount: string;
    dueDate: string;
    previousReading?: string | null;
    currentReading?: string | null;
    consumption?: string | null;
    rate?: string | null;
  } | null;
  issuedBy: {
    fullName: string;
    email: string | null;
  };
};

type ReceiptResponse = {
  receipt?: ReceiptData;
  error?: string;
};

function formatMoney(value: string | number) {
  return Number(value).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonth(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
  });
}

function getPaymentMethodLabel(method: string) {
  if (method === "BANK") {
    return "Equity Bank Transfer";
  }

  if (method === "MPESA") {
    return "M-Pesa";
  }

  return method;
}

export default function TenantReceiptPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const receiptId = params.id;

  const [receipt, setReceipt] = useState<ReceiptData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReceipt = useCallback(async () => {
    const response = await fetch(
      `/api/tenant/receipts/${encodeURIComponent(receiptId)}`,
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

    const data = (await response.json()) as ReceiptResponse;

    if (!response.ok || !data.receipt) {
      throw new Error(
        data.error ?? "Unable to load receipt.",
      );
    }

    setReceipt(data.receipt);
  }, [receiptId, router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadReceipt();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load receipt.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (receiptId) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [loadReceipt, receiptId]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-700">Loading receipt...</p>
      </main>
    );
  }

  if (error || !receipt) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-2xl rounded-xl bg-red-50 p-6 text-red-700 shadow">
          {error || "Receipt not found."}
        </div>
      </main>
    );
  }

  const propertyName =
    receipt.tenant.unit?.property?.name ??
    "Mashaallah Apartments";

  const unitNumber =
    receipt.tenant.unit?.unitNumber ?? "Not assigned";

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-3xl flex-wrap justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={() => router.push("/tenant")}
          className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800"
        >
          Back to Tenant Portal
        </button>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
        >
          Print Receipt
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
        >
          Download PDF
        </button>
       </div>
      </div>

      <article className="receipt-paper mx-auto max-w-3xl bg-white p-8 shadow-xl print:max-w-none print:p-10 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-600">
            Official Payment Receipt
          </p>

          <h1 className="mt-3 text-3xl font-bold uppercase tracking-wide text-slate-900">
            {propertyName}
          </h1>

          {receipt.tenant.unit?.property?.address ? (
            <p className="mt-1 text-slate-600">
              {receipt.tenant.unit.property.address}
            </p>
          ) : null}

          <div className="mt-5 inline-block rounded-lg border border-slate-300 px-5 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Receipt number
            </p>

            <p className="mt-1 text-xl font-bold text-slate-900">
              {receipt.receiptNumber}
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 border-b border-slate-300 pb-6 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Received from
            </h2>

            <p className="mt-2 text-lg font-bold text-slate-900">
              {receipt.tenant.fullName}
            </p>

            <p className="mt-1 text-slate-600">
              Unit: <strong>{unitNumber}</strong>
            </p>

            {receipt.tenant.email ? (
              <p className="text-slate-600">
                Email: {receipt.tenant.email}
              </p>
            ) : null}

            {receipt.tenant.phone ? (
              <p className="text-slate-600">
                Phone: {receipt.tenant.phone}
              </p>
            ) : null}

            {receipt.tenant.identificationNumber ? (
              <p className="text-slate-600">
                ID: {receipt.tenant.identificationNumber}
              </p>
            ) : null}
          </div>

          <div className="md:text-right">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Receipt details
            </h2>

            <p className="mt-2 text-slate-700">
              Issued: <strong>{formatDateTime(receipt.issuedAt)}</strong>
            </p>

            <p className="text-slate-700">
              Payment date:{" "}
              <strong>{formatDate(receipt.payment.paymentDate)}</strong>
            </p>

            <p className="text-slate-700">
              Category: <strong>{receipt.payment.category}</strong>
            </p>

            <p className="text-slate-700">
              Method:{" "}
              <strong>
                {getPaymentMethodLabel(receipt.payment.method)}
              </strong>
            </p>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-300">
          <div className="grid grid-cols-2 bg-slate-900 px-4 py-3 font-semibold text-white">
            <span>Description</span>
            <span className="text-right">Amount</span>
          </div>

          <div className="grid grid-cols-2 px-4 py-5">
            <div>
              <p className="font-semibold text-slate-900">
                {receipt.payment.category === "RENT"
                  ? "Rent payment"
                  : "Water payment"}
              </p>

              {receipt.bill ? (
                <p className="mt-1 text-sm text-slate-600">
                  Billing month:{" "}
                  {formatMonth(receipt.bill.billingMonth)}
                </p>
              ) : null}

              {receipt.payment.transactionReference ? (
                <p className="mt-1 text-sm text-slate-600">
                  Reference:{" "}
                  {receipt.payment.transactionReference}
                </p>
              ) : null}
            </div>

            <p className="text-right text-xl font-bold text-slate-900">
              KSh {formatMoney(receipt.payment.amount)}
            </p>
          </div>
        </section>

        {receipt.payment.category === "WATER" &&
        receipt.bill ? (
          <section className="mt-6 rounded-lg bg-cyan-50 p-4">
            <h2 className="font-bold text-cyan-900">
              Water billing details
            </h2>

            <div className="mt-3 grid gap-3 text-sm text-cyan-950 md:grid-cols-4">
              <div>
                <p className="text-cyan-700">Previous reading</p>
                <p className="font-semibold">
                  {receipt.bill.previousReading ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-cyan-700">Current reading</p>
                <p className="font-semibold">
                  {receipt.bill.currentReading ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-cyan-700">Consumption</p>
                <p className="font-semibold">
                  {receipt.bill.consumption ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-cyan-700">Rate</p>
                <p className="font-semibold">
                  KSh {formatMoney(receipt.bill.rate ?? "0")}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-6 flex items-center justify-between border-t-2 border-slate-900 pt-5">
          <div>
            <p className="text-sm text-slate-500">Total paid</p>
            <p className="text-3xl font-bold text-slate-900">
              KSh {formatMoney(receipt.payment.amount)}
            </p>
          </div>

          <div className="rounded-lg border-2 border-green-600 px-5 py-3 text-center text-green-700">
            <p className="text-xs font-bold uppercase tracking-wider">
              Payment status
            </p>
            <p className="mt-1 font-bold">
              {receipt.payment.status}
            </p>
          </div>
        </section>

        {receipt.payment.notes ? (
          <section className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <strong>Notes:</strong> {receipt.payment.notes}
          </section>
        ) : null}

        <section className="mt-16 grid gap-10 border-t border-slate-300 pt-8 md:grid-cols-2">
          <div>
            <div className="h-10 border-b border-slate-900">
              <p className="font-serif text-2xl italic text-slate-800">
                Ahmed Abuche
              </p>
            </div>

            <p className="mt-2 text-sm text-slate-600">
              Authorized administrator signature
            </p>
          </div>

          <div className="md:text-right">
            <p className="font-semibold text-slate-900">
              Ahmed Abuche
            </p>

            <p className="mt-1 text-sm text-slate-600">
              Authorized administrator
            </p>

            <p className="mt-1 text-sm text-slate-600">
              Issued: {formatDateTime(receipt.issuedAt)}
            </p>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          This receipt confirms that the payment shown above was
          recorded in the Mashaallah Apartments rental system.
        </footer>
      </article>

      <style jsx global>{`
  @media print {
    @page {
      size: A4;
      margin: 12mm;
    }

    body {
      background: white !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .receipt-paper {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
    }
  }
`}</style>

    </main>
  );
}


