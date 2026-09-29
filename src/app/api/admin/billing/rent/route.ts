import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

function parseDate(
  value: unknown,
  fieldName: string,
): Date | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return date;
}

function beginningOfMonth(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin();

  if (response) {
    return response;
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

  if (typeof body !== "object" || body === null) {
    return Response.json(
      {
        error: "Request body is required.",
      },
      { status: 400 },
    );
  }

  const input = body as {
    billingMonth?: unknown;
    dueDate?: unknown;
  };

  let billingMonth: Date | null;
  let dueDate: Date | null;

  try {
    billingMonth = parseDate(
      input.billingMonth,
      "billingMonth",
    );

    dueDate = parseDate(input.dueDate, "dueDate");
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid date.",
      },
      { status: 400 },
    );
  }

  if (!billingMonth || !dueDate) {
    return Response.json(
      {
        error: "billingMonth and dueDate are required.",
      },
      { status: 400 },
    );
  }

  billingMonth = beginningOfMonth(billingMonth);

  const activeTenants = await prisma.tenant.findMany({
    where: {
      user: {
        role: "TENANT",
        accountStatus: "ACTIVE",
      },
      unitId: {
        not: null,
      },
      unit: {
        isNot: null,
      },
    },
    select: {
      id: true,
      monthlyRent: true,
      unit: {
        select: {
          id: true,
          propertyId: true,
        },
      },
    },
  });

  const skipped: Array<{
    tenantId: string;
    reason: string;
  }> = [];

  const billData: Array<{
    propertyId: string;
    unitId: string;
    tenantId: string;
    createdById: string;
    billingMonth: Date;
    amount: string;
    dueDate: Date;
    issuedAt: Date;
  }> = [];

  const existingBills = await prisma.rentBill.findMany({
    where: {
      billingMonth,
      tenantId: {
        in: activeTenants.map((tenant) => tenant.id),
      },
    },
    select: {
      tenantId: true,
    },
  });

  const existingTenantIds = new Set(
    existingBills.map((bill) => bill.tenantId),
  );

  const issuedAt = new Date();

  for (const tenant of activeTenants) {
    if (!tenant.unit) {
      skipped.push({
        tenantId: tenant.id,
        reason: "Tenant has no assigned unit.",
      });
      continue;
    }

    if (existingTenantIds.has(tenant.id)) {
      skipped.push({
        tenantId: tenant.id,
        reason: "A rent bill already exists for this month.",
      });
      continue;
    }

    const amount = tenant.monthlyRent.toString();

    if (!MONEY_PATTERN.test(amount)) {
      skipped.push({
        tenantId: tenant.id,
        reason: "Tenant rent is invalid.",
      });
      continue;
    }

    if (Number(amount) <= 0) {
      skipped.push({
        tenantId: tenant.id,
        reason: "Tenant rent is zero.",
      });
      continue;
    }

    billData.push({
      propertyId: tenant.unit.propertyId,
      unitId: tenant.unit.id,
      tenantId: tenant.id,
      createdById: user!.id,
      billingMonth,
      amount,
      dueDate,
      issuedAt,
    });
  }

  if (billData.length > 0) {
    await prisma.rentBill.createMany({
      data: billData,
      skipDuplicates: true,
    });
  }

  await prisma.auditEvent.create({
    data: {
      actorUserId: user!.id,
      action: "RENT_BILLS_GENERATED",
      entityType: "RentBill",
      entityId: billingMonth.toISOString(),
      metadata: {
        billingMonth: billingMonth.toISOString(),
        dueDate: dueDate.toISOString(),
        createdCount: billData.length,
        skippedCount: skipped.length,
        generatedAt: issuedAt.toISOString(),
      },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    },
  });

  return Response.json({
    message: "Rent bills generated successfully.",
    billingMonth: billingMonth.toISOString(),
    createdCount: billData.length,
    skippedCount: skipped.length,
    skipped,
  });
}
