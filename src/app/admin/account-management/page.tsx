"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
  user: {
    fullName: string;
    email: string | null;
    phone: string | null;
    accountStatus: AccountStatus;
  };
  unit: {
    unitNumber: string;
    floor: number | null;
  } | null;
};

type TenantsResponse = {
  tenants: Tenant[];
  error?: string;
};

type AccountAction =
  | "SUSPEND"
  | "REACTIVATE"
  | "ARCHIVE"
  | "DELETE";

function statusClass(status: AccountStatus) {
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

export default function AccountManagementPage() {
  const router = useRouter();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedStatus, setSelectedStatus] =
    useState<"ALL" | AccountStatus>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTenantId, setActiveTenantId] = useState<
    string | null
  >(null);
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
        data.error ?? "Unable to load tenant accounts.",
      );
    }

    setTenants(data.tenants);
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
                : "Unable to load tenant accounts.",
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

  const filteredTenants = useMemo(() => {
    if (selectedStatus === "ALL") {
      return tenants;
    }

    return tenants.filter(
      (tenant) =>
        tenant.user.accountStatus === selectedStatus,
    );
  }, [selectedStatus, tenants]);

  async function updateAccount(
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

    const confirmation =
      action === "DELETE"
        ? `Permanently delete ${tenant.user.fullName}? This cannot be undone. Deletion will be blocked if this account has financial or audit history.`
        : `Are you sure you want to ${label} ${tenant.user.fullName}?`;

    if (!window.confirm(confirmation)) {
      return;
    }

    setActiveTenantId(tenant.userId);
    setError("");
    setSuccess("");

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
            data.error ?? "Unable to update account.",
          );
        }

        return;
      }

      setSuccess(
        data.message ?? "Tenant account updated successfully.",
      );

      await loadTenants();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to contact the server.",
      );
    } finally {
      setActiveTenantId(null);
    }
  }

  const activeCount = tenants.filter(
    (tenant) => tenant.user.accountStatus === "ACTIVE",
  ).length;

  const suspendedCount = tenants.filter(
    (tenant) => tenant.user.accountStatus === "SUSPENDED",
  ).length;

  const archivedCount = tenants.filter(
    (tenant) => tenant.user.accountStatus === "ARCHIVED",
  ).length;

  return (
    <section className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">
              Mashaallah Apartments
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Account management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Control tenant access while preserving financial history.
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

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total tenant accounts
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {tenants.length}
            </p>
          </div>

          <div className="rounded-xl bg-green-50 p-5 shadow-sm">
            <p className="text-sm text-green-700">Active</p>

            <p className="mt-2 text-3xl font-bold text-green-900">
              {activeCount}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 p-5 shadow-sm">
            <p className="text-sm text-amber-700">Suspended</p>

            <p className="mt-2 text-3xl font-bold text-amber-900">
              {suspendedCount}
            </p>
          </div>

          <div className="rounded-xl bg-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-600">Archived</p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {archivedCount}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <label
            htmlFor="account-status"
            className="block text-sm font-medium text-slate-700"
          >
            Filter accounts
          </label>

          <select
            id="account-status"
            value={selectedStatus}
            onChange={(event) =>
              setSelectedStatus(
                event.target.value as
                  | "ALL"
                  | AccountStatus,
              )
            }
            className="mt-2 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-3"
          >
            <option value="ALL">All accounts</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
            <option value="REJECTED">Rejected</option>
            <option value="PENDING_APPROVAL">
              Pending approval
            </option>
          </select>
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

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Tenant accounts
            </h2>

            <span className="text-sm text-slate-500">
              Showing {filteredTenants.length} of{" "}
              {tenants.length}
            </span>
          </div>

          {isLoading ? (
            <p className="mt-5 text-slate-600">
              Loading tenant accounts...
            </p>
          ) : filteredTenants.length === 0 ? (
            <p className="mt-5 text-slate-600">
              No tenant accounts match this filter.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Account actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTenants.map((tenant) => {
                    const isUpdating =
                      activeTenantId === tenant.userId;

                    return (
                      <tr
                        key={tenant.id}
                        className="border-b border-slate-100 align-top"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900">
                            {tenant.user.fullName}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {tenant.user.email ?? "No email"}
                          </p>

                          <p className="text-xs text-slate-500">
                            {tenant.user.phone ?? "No phone"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          {tenant.unit ? (
                            <>
                              <p className="font-semibold">
                                {tenant.unit.unitNumber}
                              </p>

                              <p className="text-xs text-slate-500">
                                Floor {tenant.unit.floor ?? "—"}
                              </p>
                            </>
                          ) : (
                            "Not assigned"
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                              tenant.user.accountStatus,
                            )}`}
                          >
                            {tenant.user.accountStatus}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {tenant.user.accountStatus ===
                            "ACTIVE" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateAccount(
                                    tenant,
                                    "SUSPEND",
                                  )
                                }
                                disabled={isUpdating}
                                className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                              >
                                Suspend
                              </button>
                            ) : null}

                            {tenant.user.accountStatus ===
                            "SUSPENDED" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateAccount(
                                    tenant,
                                    "REACTIVATE",
                                  )
                                }
                                disabled={isUpdating}
                                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                              >
                                Reactivate
                              </button>
                            ) : null}

                            {tenant.user.accountStatus !==
                            "ARCHIVED" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateAccount(
                                    tenant,
                                    "ARCHIVE",
                                  )
                                }
                                disabled={isUpdating}
                                className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                              >
                                Archive / Move out
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() =>
                                void updateAccount(
                                  tenant,
                                  "DELETE",
                                )
                              }
                              disabled={isUpdating}
                              className="rounded-lg bg-red-800 px-3 py-2 text-xs font-semibold text-white hover:bg-red-900 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>

                          {isUpdating ? (
                            <p className="mt-2 text-xs text-slate-500">
                              Updating account...
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
