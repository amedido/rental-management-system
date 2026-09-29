"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type PropertyResponse = {
  property?: {
    id: string;
    name: string;
    waterRate: string;
  };
  error?: string;
};

export default function BillingSettingsPage() {
  const router = useRouter();

  const [waterRate, setWaterRate] = useState("");
  const [newWaterRate, setNewWaterRate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    const response = await fetch(
      "/api/admin/settings/water-rate",
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

    const data = (await response.json()) as PropertyResponse;

    if (!response.ok || !data.property) {
      throw new Error(
        data.error ?? "Unable to load billing settings.",
      );
    }

    setWaterRate(data.property.waterRate);
    setNewWaterRate(data.property.waterRate);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadSettings();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load billing settings.",
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
  }, [loadSettings]);

  async function saveWaterRate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!newWaterRate.trim()) {
      setError("Enter a water rate.");
      return;
    }

    if (
      !window.confirm(
        `Change the water rate to KSh ${newWaterRate} per unit?`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "/api/admin/settings/water-rate",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            waterRate: newWaterRate.trim(),
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        error?: string;
        property?: {
          waterRate: string;
        };
      };

      if (!response.ok) {
        setError(data.error ?? "Unable to update water rate.");
        return;
      }

      const savedRate = data.property?.waterRate ?? newWaterRate;

      setWaterRate(savedRate);
      setNewWaterRate(savedRate);
      setSuccess(
        data.message ?? "Water rate updated successfully.",
      );
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
            Billing Settings
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

      <section className="mx-auto max-w-2xl p-8">
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold text-slate-900">
            Water rate
          </h2>

          <p className="mt-2 text-slate-600">
            This rate is used for future water bills. Existing
            water bills keep the rate that was saved when they were
            created.
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
              Loading billing settings...
            </p>
          ) : (
            <>
              <div className="mt-6 rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
                  Current water rate
                </p>

                <p className="mt-1 text-3xl font-bold text-slate-900">
                  KSh{" "}
                  {Number(waterRate).toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  per consumed unit
                </p>
              </div>

              <form onSubmit={saveWaterRate} className="mt-6">
                <label
                  htmlFor="waterRate"
                  className="block text-sm font-medium text-slate-700"
                >
                  New water rate per unit
                </label>

                <input
                  id="waterRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newWaterRate}
                  onChange={(event) =>
                    setNewWaterRate(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                  placeholder="For example, 250"
                />

                <button
                  type="submit"
                  disabled={isSaving}
                  className="mt-4 w-full rounded-lg bg-cyan-700 px-4 py-3 font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving
                    ? "Saving..."
                    : "Save water rate"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
