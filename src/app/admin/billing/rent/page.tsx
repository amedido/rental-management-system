"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type BillingResult = {
  message?: string;
  error?: string;
  billingMonth?: string;
  createdCount?: number;
  skippedCount?: number;
  skipped?: Array<{
    tenantId: string;
    reason: string;
  }>;
};

function currentMonth() {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
}

export default function RentBillingPage() {
  const router = useRouter();

  const [billingMonth, setBillingMonth] = useState(currentMonth());
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BillingResult | null>(
    null,
  );

  async function generateBills(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!billingMonth || !dueDate) {
      setError("Billing month and due date are required.");
      return;
    }

    const confirmed = window.confirm(
      `Generate rent bills for ${billingMonth}?`,
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/admin/billing/rent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billingMonth: `${billingMonth}-01`,
          dueDate,
        }),
      });

      const data = (await response.json()) as BillingResult;

      if (!response.ok) {
        setError(data.error ?? "Unable to generate rent bills.");
        return;
      }

      setResult(data);
    } catch {
      setError("Unable to contact the server.");
    } finally {
      setIsSubmitting(false);
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
            Generate Rent Bills
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

      <section className="mx-auto max-w-3xl p-8">
        <form
          onSubmit={generateBills}
          className="rounded-xl bg-white p-6 shadow"
        >
          <h2 className="text-xl font-bold text-slate-900">
            Monthly rent billing
          </h2>

          <p className="mt-2 text-slate-600">
            The system will use each active tenant&apos;s saved
            monthly rent.
          </p>

          {error ? (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="billingMonth"
                className="block text-sm font-medium text-slate-700"
              >
                Billing month
              </label>

              <input
                id="billingMonth"
                type="month"
                value={billingMonth}
                onChange={(event) =>
                  setBillingMonth(event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="dueDate"
                className="block text-sm font-medium text-slate-700"
              >
                Due date
              </label>

              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(event) =>
                  setDueDate(event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Generating bills..."
              : "Generate rent bills"}
          </button>
        </form>

        {result ? (
          <div className="mt-6 rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-green-700">
              {result.message}
            </h2>

            <div className="mt-4 space-y-2 text-slate-700">
              <p>
                Bills created:{" "}
                <strong>{result.createdCount ?? 0}</strong>
              </p>

              <p>
                Bills skipped:{" "}
                <strong>{result.skippedCount ?? 0}</strong>
              </p>
            </div>

            {result.skipped && result.skipped.length > 0 ? (
              <div className="mt-5">
                <h3 className="font-semibold text-slate-900">
                  Skipped records
                </h3>

                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {result.skipped.map((item) => (
                    <li key={`${item.tenantId}-${item.reason}`}>
                      {item.tenantId}: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
