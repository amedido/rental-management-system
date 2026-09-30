"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type AccountStatus =
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "REJECTED"
  | "SUSPENDED"
  | "ARCHIVED";

type Tenant = {
  id: string;
  userId: string;
  moveInAt: string | null;
  requestedUnitNumber: string | null;
  monthlyRent?: string | null;
  user: {
    fullName: string;
    email: string | null;
    phone: string | null;
    accountStatus: AccountStatus;
  };
  unit: {
    id: string;
    unitNumber: string;
    floor: number | null;
    status: string;
  } | null;
};

type AvailableUnit = {
  id: string;
  unitNumber: string;
  floor: number | null;
  status: string;
  monthlyRent: string;
};

type TenantsResponse = {
  tenants: Tenant[];
  availableUnits: AvailableUnit[];
  error?: string;
};

type AccountAction =
  | "SUSPEND"
  | "REACTIVATE"
  | "ARCHIVE"
  | "DELETE";

function formatMoney(
  value: string | number | null | undefined,
) {
  return Number(value ?? 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function accountStatusClass(status: AccountStatus) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800";

    case "SUSPENDED":
      return "bg-amber-100 text-amber-800";

    case "ARCHIVED":
      return "bg-slate-200 text-slate-700";

    case "REJECTED":
      return "bg-red-100 text-red-800";

    default:
      return "bg-blue-100 text-blue-800";
  }
}

function actionLabel(action: AccountAction) {
  switch (action) {
    case "SUSPEND":
      return "suspend";

    case "REACTIVATE":
      return "reactivate";

    case "ARCHIVE":
      return "archive";

    case "DELETE":
      return "permanently delete";
  }
}

export default function AdminTenantsPage() {
  const router = useRouter();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [availableUnits, setAvailableUnits] = useState<
    AvailableUnit[]
  >([]);

  const [selectedUnits, setSelectedUnits] = useState<
    Record<string, string>
  >({});

  const [rentValues, setRentValues] = useState<
    Record<string, string>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [activeTenantId, setActiveTenantId] = useState<
    string | null
  >(null);
  const [accountActionTenantId, setAccountActionTenantId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTenants = useCallback(async () => {
    const response = await fetch("/api/admin/tenants", {
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

    const data = (await response.json()) as TenantsResponse;

    if (!response.ok) {
      throw new Error(
        data.error ?? "Unable to load tenant information.",
      );
    }

    setTenants(data.tenants);
    setAvailableUnits(data.availableUnits);

    setRentValues((current) => {
      const next = { ...current };

      for (const tenant of data.tenants) {
        if (next[tenant.userId] === undefined) {
          next[tenant.userId] = tenant.monthlyRent ?? "";
        }
      }

      return next;
    });
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void loadTenants()
        .catch((loadError) => {
          if (!cancelled) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Unable to load tenant information.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadTenants]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function changeSelectedUnit(
    tenantUserId: string,
    unitNumber: string,
  ) {
    setSelectedUnits((current) => ({
      ...current,
      [tenantUserId]: unitNumber,
    }));
  }

  function changeRentValue(
    tenantUserId: string,
    value: string,
  ) {
    setRentValues((current) => ({
      ...current,
      [tenantUserId]: value,
    }));
  }

  async function assignUnit(tenant: Tenant) {
    const unitNumber =
      selectedUnits[tenant.userId]?.trim() ?? "";

    if (!unitNumber) {
      setError("Select a vacant unit before assigning.");
      setSuccess("");
      return;
    }

    const confirmed = window.confirm(
      `Assign unit ${unitNumber} to ${tenant.user.fullName}?`,
    );

    if (!confirmed) {
      return;
    }

    setActiveTenantId(tenant.userId);
    clearMessages();

    try {
      const response = await fetch(
        `/api/admin/tenants/${encodeURIComponent(
          tenant.userId,
        )}/assign-unit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            unitNumber: unitNumber,
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Unit assignment failed.");
        return;
      }

      setSuccess(
        data.message ?? "Unit assigned successfully.",
      );

      setSelectedUnits((current) => {
        const next = { ...current };
        delete next[tenant.userId];
        return next;
      });

      await loadTenants();
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "Unable to contact the server.",
      );
    } finally {
      setActiveTenantId(null);
    }
  }

  async function saveRent(tenant: Tenant) {
    const monthlyRentValue =
      rentValues[tenant.userId]?.trim() ?? "";

    if (
      !monthlyRentValue ||
      !/^\d+(\.\d{1,2})?$/.test(monthlyRentValue) ||
      Number(monthlyRentValue) < 0
    ) {
      setError(
        "Enter a valid rent amount, for example 16500 or 16500.00.",
      );
      setSuccess("");
      return;
    }

    const confirmed = window.confirm(
      `Save monthly rent of KSh ${formatMoney(
        monthlyRentValue,
      )} for ${tenant.user.fullName}?`,
    );

    if (!confirmed) {
      return;
    }

    setActiveTenantId(tenant.userId);
    clearMessages();

    try {
      const response = await fetch(
        `/api/admin/tenants/${encodeURIComponent(
          tenant.id,
        )}/rent`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            monthlyRent: monthlyRentValue,
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(
          data.error ?? "Unable to save monthly rent.",
        );
        return;
      }

      setSuccess(
        data.message ?? "Monthly rent saved successfully.",
      );

      await loadTenants();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to contact the server.",
      );
    } finally {
      setActiveTenantId(null);
    }
  }

  async function updateTenantAccount(
    tenant: Tenant,
    action: AccountAction,
  ) {
    const label = actionLabel(action);

    const reason = window.prompt(
      `Enter the reason to ${label} ${tenant.user.fullName}:`,
    );

    if (!reason || reason.trim().length < 5) {
      window.alert(
        "A reason of at least 5 characters is required.",
      );
      return;
    }

    let moveOutAt: string | undefined;

    if (action === "ARCHIVE") {
      const date = window.prompt(
        "Enter move-out date as YYYY-MM-DD, or leave blank for today:",
      );

      if (date?.trim()) {
        moveOutAt = date.trim();
      }
    }

    const confirmationText =
      action === "DELETE"
        ? `Permanently delete ${tenant.user.fullName}? This cannot be undone. Accounts with financial history will be protected from deletion.`
        : `Are you sure you want to ${label} ${tenant.user.fullName}?`;

    if (!window.confirm(confirmationText)) {
      return;
    }

    setAccountActionTenantId(tenant.userId);
    clearMessages();

    try {
      const response = await fetch(
        `/api/admin/tenants/${encodeURIComponent(
          tenant.userId,
        )}/account-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: action,
            reason: reason.trim(),
            ...(moveOutAt
              ? { moveOutAt: moveOutAt }
              : {}),
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        error?: string;
        history?: {
          payments?: number;
          rentBills?: number;
          waterBills?: number;
          receipts?: number;
        };
      };

      if (!response.ok) {
        if (data.history) {
          setError(
            `${data.error ?? "Deletion was blocked."} ` +
              `Payments: ${data.history.payments ?? 0}; ` +
              `rent bills: ${data.history.rentBills ?? 0}; ` +
              `water bills: ${data.history.waterBills ?? 0}; ` +
              `receipts: ${data.history.receipts ?? 0}.`,
          );
        } else {
          setError(
            data.error ?? "Unable to update tenant account.",
          );
        }

        return;
      }

      setSuccess(
        data.message ?? "Tenant account updated successfully.",
      );

      await loadTenants();
    } catch (accountError) {
      setError(
        accountError instanceof Error
          ? accountError.message
          : "Unable to contact the server.",
      );
    } finally {
      setAccountActionTenantId(null);
    }
  }

  return (
    <section className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">
              Mashaallah Apartments
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Tenant management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Assign units, set rent, and manage account status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Dashboard
          </button>
        </div>

        {error ? (
          <div className="rounded-xl bg-red-50 p-4 text-red-700 shadow">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl bg-green-50 p-4 text-green-700 shadow">
            {success}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl bg-white p-8 text-slate-600 shadow">
            Loading tenant information...
          </div>
        ) : tenants.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-slate-600 shadow">
            No tenants were returned by the server.
          </div>
        ) : (
          <div className="space-y-5">
            {tenants.map((tenant) => {
              const isSaving =
                activeTenantId === tenant.userId;

              const isUpdatingAccount =
                accountActionTenantId === tenant.userId;

              const currentRent =
                tenant.monthlyRent ??
                rentValues[tenant.userId] ??
                "0";

              return (
                <article
                  key={tenant.id}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold text-slate-900">
                          {tenant.user.fullName}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${accountStatusClass(
                            tenant.user.accountStatus,
                          )}`}
                        >
                          {tenant.user.accountStatus}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                        <p>
                          <strong>Email:</strong>{" "}
                          {tenant.user.email ?? "Not provided"}
                        </p>

                        <p>
                          <strong>Phone:</strong>{" "}
                          {tenant.user.phone ?? "Not provided"}
                        </p>

                        <p>
                          <strong>Unit:</strong>{" "}
                          {tenant.unit?.unitNumber ??
                            "Not assigned"}
                        </p>

                        <p>
                          <strong>Floor:</strong>{" "}
                          {tenant.unit?.floor ?? "—"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Current rent
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        KSh {formatMoney(currentRent)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 border-t border-slate-200 pt-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-5">
                      <h3 className="font-bold text-slate-900">
                        Assign apartment
                      </h3>

                      {tenant.unit ? (
                        <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                          Assigned unit:{" "}
                          <strong>
                            {tenant.unit.unitNumber}
                          </strong>
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          No unit assigned yet.
                        </p>
                      )}

                      <label
                        htmlFor={`unit-${tenant.userId}`}
                        className="mt-4 block text-sm font-medium text-slate-700"
                      >
                        Select vacant apartment
                      </label>

                      <select
                        id={`unit-${tenant.userId}`}
                        value={
                          selectedUnits[tenant.userId] ?? ""
                        }
                        onChange={(event) =>
                          changeSelectedUnit(
                            tenant.userId,
                            event.target.value,
                          )
                        }
                        disabled={
                          isSaving ||
                          tenant.user.accountStatus !== "ACTIVE"
                        }
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                      >
                        <option value="">
                          Select vacant apartment
                        </option>

                        {availableUnits.map((unit) => (
                          <option
                            key={unit.id}
                            value={unit.unitNumber}
                          >
                            {unit.unitNumber} — Floor{" "}
                            {unit.floor ?? "—"}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void assignUnit(tenant)}
                        disabled={
                          isSaving ||
                          tenant.user.accountStatus !== "ACTIVE"
                        }
                        className="mt-4 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving
                          ? "Saving..."
                          : "Assign unit"}
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-5">
                      <h3 className="font-bold text-slate-900">
                        Monthly rent
                      </h3>

                      <label
                        htmlFor={`rent-${tenant.userId}`}
                        className="mt-4 block text-sm font-medium text-slate-700"
                      >
                        Rent amount in KSh
                      </label>

                      <input
                        id={`rent-${tenant.userId}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          rentValues[tenant.userId] ??
                          tenant.monthlyRent ??
                          ""
                        }
                        onChange={(event) =>
                          changeRentValue(
                            tenant.userId,
                            event.target.value,
                          )
                        }
                        disabled={
                          isSaving ||
                          tenant.user.accountStatus !== "ACTIVE"
                        }
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
                        placeholder="Enter rent amount"
                      />

                      <button
                        type="button"
                        onClick={() => void saveRent(tenant)}
                        disabled={
                          isSaving ||
                          tenant.user.accountStatus !== "ACTIVE"
                        }
                        className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving
                          ? "Saving..."
                          : "Save rent"}
                      </button>

                      <p className="mt-3 text-sm text-slate-500">
                        Current rent: KSh{" "}
                        {formatMoney(currentRent)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          Account management
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Suspended and archived tenants cannot log
                          in. Their financial history is preserved.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {tenant.user.accountStatus === "ACTIVE" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void updateTenantAccount(
                                tenant,
                                "SUSPEND",
                              )
                            }
                            disabled={isUpdatingAccount}
                            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Suspend
                          </button>
                        ) : null}

                        {tenant.user.accountStatus ===
                        "SUSPENDED" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void updateTenantAccount(
                                tenant,
                                "REACTIVATE",
                              )
                            }
                            disabled={isUpdatingAccount}
                            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Reactivate
                          </button>
                        ) : null}

                        {tenant.user.accountStatus !==
                        "ARCHIVED" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void updateTenantAccount(
                                tenant,
                                "ARCHIVE",
                              )
                            }
                            disabled={isUpdatingAccount}
                            className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Archive / Move out
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() =>
                            void updateTenantAccount(
                              tenant,
                              "DELETE",
                            )
                          }
                          disabled={isUpdatingAccount}
                          className="rounded-lg bg-red-800 px-3 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {isUpdatingAccount ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Updating account status...
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
