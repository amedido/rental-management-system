import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { user, response } = await requireAdmin();

  if (response) {
    return response;
  }

  const { id: tenantId } = await context.params;

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

  if (
    typeof body !== "object" ||
    body === null ||
    !("monthlyRent" in body)
  ) {
    return Response.json(
      {
        error: "monthlyRent is required.",
      },
      { status: 400 },
    );
  }

  const rawAmount = (body as { monthlyRent: unknown }).monthlyRent;
  const amountText = String(rawAmount).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
    return Response.json(
      {
        error: "Rent must be a valid amount with no more than 2 decimals.",
      },
      { status: 400 },
    );
  }

  const monthlyRent = Number(amountText);

  if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
    return Response.json(
      {
        error: "Rent cannot be negative.",
      },
      { status: 400 },
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      id: tenantId,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!tenant || tenant.user.role !== "TENANT") {
    return Response.json(
      {
        error: "Tenant not found.",
      },
      { status: 404 },
    );
  }

  const oldRent = tenant.monthlyRent.toString();
  const updatedAt = new Date();

  const updatedTenant = await prisma.$transaction(async (transaction) => {
    const result = await transaction.tenant.update({
      where: {
        id: tenantId,
      },
      data: {
        monthlyRent: amountText,
      },
      select: {
        id: true,
        monthlyRent: true,
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    await transaction.auditEvent.create({
      data: {
        actorUserId: user!.id,
        action: "TENANT_RENT_CHANGED",
        entityType: "Tenant",
        entityId: tenantId,
        metadata: {
          oldMonthlyRent: oldRent,
          newMonthlyRent: amountText,
          changedAt: updatedAt.toISOString(),
        },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return result;
  });

  return Response.json({
    message: "Tenant rent updated successfully.",
    tenant: {
      id: updatedTenant.id,
      fullName: updatedTenant.user.fullName,
      email: updatedTenant.user.email,
      monthlyRent: updatedTenant.monthlyRent.toString(),
    },
  });
}
