import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAdmin();

  if (response) {
    return response;
  }

  const { id } = await context.params;

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const note =
    typeof body === "object" &&
    body !== null &&
    "note" in body &&
    typeof body.note === "string"
      ? body.note.trim()
      : null;

  const tenantUser = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      role: true,
      accountStatus: true,
    },
  });

  if (!tenantUser || tenantUser.role !== "TENANT") {
    return Response.json(
      {
        error: "Tenant account not found.",
      },
      { status: 404 },
    );
  }

  if (tenantUser.accountStatus !== "PENDING_APPROVAL") {
    return Response.json(
      {
        error: "This tenant account is not awaiting approval.",
      },
      { status: 409 },
    );
  }

  const rejectedAt = new Date();

  const rejectedTenant = await prisma.$transaction(async (transaction) => {
    const updatedUser = await transaction.user.update({
      where: {
        id,
      },
      data: {
        accountStatus: "REJECTED",
        rejectedAt,
        approvalNote: note,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        accountStatus: true,
        rejectedAt: true,
        approvalNote: true,
      },
    });

    await transaction.approvalAction.create({
      data: {
        userId: id,
        decidedById: user!.id,
        decision: "REJECTED",
        note,
        decidedAt: rejectedAt,
      },
    });

    await transaction.auditEvent.create({
      data: {
        actorUserId: user!.id,
        action: "TENANT_REJECTED",
        entityType: "User",
        entityId: id,
        metadata: {
          note,
        },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return updatedUser;
  });

  return Response.json({
    message: "Tenant registration rejected.",
    tenant: rejectedTenant,
  });
}
