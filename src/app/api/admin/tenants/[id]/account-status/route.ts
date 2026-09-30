import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AccountAction =
  | "SUSPEND"
  | "REACTIVATE"
  | "ARCHIVE"
  | "DELETE";

function getAction(value: unknown): AccountAction | null {
  if (
    value === "SUSPEND" ||
    value === "REACTIVATE" ||
    value === "ARCHIVE" ||
    value === "DELETE"
  ) {
    return value;
  }

  return null;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAdmin();

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const userId = id.trim();

  if (!userId) {
    return Response.json(
      {
        error: "Tenant user ID is required.",
      },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const input =
    typeof body === "object" &&
    body !== null
      ? (body as {
          action?: unknown;
          reason?: unknown;
          moveOutAt?: unknown;
        })
      : {};

  const action = getAction(input.action);

  if (!action) {
    return Response.json(
      {
        error:
          "Action must be SUSPEND, REACTIVATE, ARCHIVE, or DELETE.",
      },
      { status: 400 },
    );
  }

  const reason =
    typeof input.reason === "string"
      ? input.reason.trim()
      : "";

  if (reason.length < 5) {
    return Response.json(
      {
        error:
          "A reason of at least 5 characters is required.",
      },
      { status: 400 },
    );
  }

  const requestedMoveOutAt =
    typeof input.moveOutAt === "string" &&
    input.moveOutAt.trim()
      ? new Date(input.moveOutAt)
      : new Date();

  if (Number.isNaN(requestedMoveOutAt.getTime())) {
    return Response.json(
      {
        error: "moveOutAt must be a valid date.",
      },
      { status: 400 },
    );
  }

  if (action === "DELETE" && user!.role !== "SUPER_ADMIN") {
    return Response.json(
      {
        error:
          "Only a super administrator can permanently delete an account.",
      },
      { status: 403 },
    );
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const target = await transaction.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            accountStatus: true,
            tenant: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!target || target.role !== "TENANT") {
          throw new Error("TENANT_NOT_FOUND");
        }

        if (target.id === user!.id) {
          throw new Error("CANNOT_CHANGE_OWN_ACCOUNT");
        }

        if (!target.tenant) {
          throw new Error("TENANT_PROFILE_NOT_FOUND");
        }

        if (action === "DELETE") {
          const [
            paymentCount,
            rentBillCount,
            waterBillCount,
            receiptCount,
            auditEventCount,
            loginEventCount,
            sessionCount,
            approvalActionCount,
          ] = await Promise.all([
            transaction.payment.count({
              where: {
                tenantId: target.tenant.id,
              },
            }),

            transaction.rentBill.count({
              where: {
                tenantId: target.tenant.id,
              },
            }),

            transaction.waterBill.count({
              where: {
                tenantId: target.tenant.id,
              },
            }),

            transaction.receipt.count({
              where: {
                tenantId: target.tenant.id,
              },
            }),

            transaction.auditEvent.count({
              where: {
                actorUserId: target.id,
              },
            }),

            transaction.loginEvent.count({
              where: {
                userId: target.id,
              },
            }),

            transaction.session.count({
              where: {
                userId: target.id,
              },
            }),

            transaction.approvalAction.count({
              where: {
                userId: target.id,
              },
            }),
          ]);

          const hasHistory =
            paymentCount > 0 ||
            rentBillCount > 0 ||
            waterBillCount > 0 ||
            receiptCount > 0 ||
            auditEventCount > 0 ||
            loginEventCount > 0 ||
            sessionCount > 0 ||
            approvalActionCount > 0;

          if (hasHistory) {
            throw new Error(
              [
                "HARD_DELETE_BLOCKED",
                paymentCount,
                rentBillCount,
                waterBillCount,
                receiptCount,
                auditEventCount,
                loginEventCount,
                sessionCount,
                approvalActionCount,
              ].join(":"),
            );
          }

          await transaction.tenant.delete({
            where: {
              id: target.tenant.id,
            },
          });

          await transaction.user.delete({
            where: {
              id: target.id,
            },
          });

          return {
            action,
            userId: target.id,
            fullName: target.fullName,
          };
        }

        const now = new Date();

        let accountStatus:
          | "ACTIVE"
          | "SUSPENDED"
          | "ARCHIVED";

        if (action === "SUSPEND") {
          accountStatus = "SUSPENDED";
        } else if (action === "ARCHIVE") {
          accountStatus = "ARCHIVED";
        } else {
          accountStatus = "ACTIVE";
        }

        const updatedUser =
          await transaction.user.update({
            where: {
              id: target.id,
            },
            data: {
              accountStatus,
              suspendedAt:
                action === "SUSPEND" ? now : null,
              archivedAt:
                action === "ARCHIVE" ? now : null,
              moveOutAt:
                action === "ARCHIVE"
                  ? requestedMoveOutAt
                  : null,
              approvalNote: reason,
            },
            select: {
              id: true,
              fullName: true,
              email: true,
              accountStatus: true,
              suspendedAt: true,
              archivedAt: true,
              moveOutAt: true,
            },
          });

        if (
          action === "SUSPEND" ||
          action === "ARCHIVE"
        ) {
          await transaction.session.updateMany({
            where: {
              userId: target.id,
              revokedAt: null,
            },
            data: {
              revokedAt: now,
            },
          });
        }

        await transaction.auditEvent.create({
          data: {
            actorUserId: user!.id,
            action:
              action === "SUSPEND"
                ? "TENANT_ACCOUNT_SUSPENDED"
                : action === "ARCHIVE"
                  ? "TENANT_ACCOUNT_ARCHIVED"
                  : "TENANT_ACCOUNT_REACTIVATED",
            entityType: "User",
            entityId: target.id,
            metadata: {
              targetUserId: target.id,
              targetName: target.fullName,
              targetEmail: target.email,
              previousStatus: target.accountStatus,
              newStatus: accountStatus,
              reason,
              moveOutAt:
                action === "ARCHIVE"
                  ? requestedMoveOutAt.toISOString()
                  : null,
              changedAt: now.toISOString(),
            },
            ipAddress:
              request.headers.get("x-forwarded-for"),
            userAgent:
              request.headers.get("user-agent"),
          },
        });

        return {
          action,
          user: updatedUser,
        };
      },
    );

    return Response.json({
      message:
        action === "SUSPEND"
          ? "Tenant account suspended successfully."
          : action === "ARCHIVE"
            ? "Tenant account archived successfully."
            : "Tenant account reactivated successfully.",
      result,
    });
  } catch (error) {
    const errorCode =
      error instanceof Error ? error.message : "";

    if (errorCode === "TENANT_NOT_FOUND") {
      return Response.json(
        {
          error: "Tenant account was not found.",
        },
        { status: 404 },
      );
    }

    if (errorCode === "TENANT_PROFILE_NOT_FOUND") {
      return Response.json(
        {
          error: "Tenant profile was not found.",
        },
        { status: 404 },
      );
    }

    if (errorCode === "CANNOT_CHANGE_OWN_ACCOUNT") {
      return Response.json(
        {
          error:
            "You cannot suspend, archive, or delete your own account.",
        },
        { status: 400 },
      );
    }

    if (errorCode.startsWith("HARD_DELETE_BLOCKED:")) {
      const parts = errorCode.split(":");

      return Response.json(
        {
          error:
            "Hard deletion is blocked because this tenant has financial, login, approval, or audit history. Archive the account instead.",
          history: {
            payments: Number(parts[1] ?? 0),
            rentBills: Number(parts[2] ?? 0),
            waterBills: Number(parts[3] ?? 0),
            receipts: Number(parts[4] ?? 0),
            auditEvents: Number(parts[5] ?? 0),
            loginEvents: Number(parts[6] ?? 0),
            sessions: Number(parts[7] ?? 0),
            approvalActions: Number(parts[8] ?? 0),
          },
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        error:
          "Unable to update the tenant account.",
      },
      { status: 500 },
    );
  }
}
