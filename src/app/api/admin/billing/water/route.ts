import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const READING_PATTERN = /^\d+(\.\d{1,3})?$/;

type RouteInput = {
  tenantId?: unknown;
  billingMonth?: unknown;
  previousReading?: unknown;
  currentReading?: unknown;
  dueDate?: unknown;
  notes?: unknown;
};

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

  const input = body as RouteInput;

  const tenantId =
    typeof input.tenantId === "string"
      ? input.tenantId.trim()
      : "";

  if (!tenantId) {
    return Response.json(
      {
        error: "tenantId is required.",
      },
      { status: 400 },
    );
  }

  const previousText = String(
    input.previousReading ?? "",
  ).trim();

  const currentText = String(
    input.currentReading ?? "",
  ).trim();

  if (!READING_PATTERN.test(previousText)) {
    return Response.json(
      {
        error:
          "Previous reading must be a valid number with no more than 3 decimal places.",
      },
      { status: 400 },
    );
  }

  if (!READING_PATTERN.test(currentText)) {
    return Response.json(
      {
        error:
          "Current reading must be a valid number with no more than 3 decimal places.",
      },
      { status: 400 },
    );
  }

  const previousReading = Number(previousText);
  const currentReading = Number(currentText);

  if (
    !Number.isFinite(previousReading) ||
    previousReading < 0
  ) {
    return Response.json(
      {
        error: "Previous reading must be zero or greater.",
      },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(currentReading) ||
    currentReading < 0
  ) {
    return Response.json(
      {
        error: "Current reading must be zero or greater.",
      },
      { status: 400 },
    );
  }

  if (currentReading < previousReading) {
    return Response.json(
      {
        error:
          "Current reading cannot be lower than the previous reading.",
      },
      { status: 400 },
    );
  }

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

  const tenant = await prisma.tenant.findUnique({
    where: {
      id: tenantId,
    },
    select: {
      id: true,
      user: {
        select: {
          fullName: true,
          role: true,
          accountStatus: true,
        },
      },
      unit: {
        select: {
          id: true,
          propertyId: true,
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

  if (tenant.user.accountStatus !== "ACTIVE") {
    return Response.json(
      {
        error: "Tenant account is not active.",
      },
      { status: 400 },
    );
  }

  if (!tenant.unit) {
    return Response.json(
      {
        error: "Tenant does not have an assigned unit.",
      },
      { status: 400 },
    );
  }

  const property = await prisma.property.findUnique({
    where: {
      id: tenant.unit.propertyId,
    },
    select: {
      id: true,
      waterRate: true,
    },
  });

  if (!property) {
    return Response.json(
      {
        error: "The tenant's property was not found.",
      },
      { status: 404 },
    );
  }

  const existingBill = await prisma.waterBill.findUnique({
    where: {
      tenantId_billingMonth: {
        tenantId: tenant.id,
        billingMonth,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingBill) {
    return Response.json(
      {
        error:
          "A water bill already exists for this tenant and month.",
      },
      { status: 409 },
    );
  }

  const consumption = currentReading - previousReading;
  const rate = property.waterRate.toString();
  const amount = consumption * Number(rate);
  const issuedAt = new Date();

  const waterBill = await prisma.waterBill.create({
    data: {
      propertyId: tenant.unit.propertyId,
      unitId: tenant.unit.id,
      tenantId: tenant.id,
      createdById: user!.id,
      billingMonth,
      previousReading: previousText,
      currentReading: currentText,
      consumption: consumption.toFixed(3),
      rate,
      amount: amount.toFixed(2),
      dueDate,
      issuedAt,
      notes:
        typeof input.notes === "string"
          ? input.notes.trim() || null
          : null,
    },
    select: {
      id: true,
      billingMonth: true,
      previousReading: true,
      currentReading: true,
      consumption: true,
      rate: true,
      amount: true,
      dueDate: true,
      status: true,
      issuedAt: true,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user!.id,
      action: "WATER_BILL_CREATED",
      entityType: "WaterBill",
      entityId: waterBill.id,
      metadata: {
        tenantId: tenant.id,
        propertyId: property.id,
        billingMonth: billingMonth.toISOString(),
        previousReading: previousText,
        currentReading: currentText,
        consumption: consumption.toFixed(3),
        rate,
        amount: amount.toFixed(2),
        createdAt: issuedAt.toISOString(),
      },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    },
  });

  return Response.json(
    {
      message: "Water bill created successfully.",
      waterBill: {
        id: waterBill.id,
        billingMonth: waterBill.billingMonth,
        previousReading:
          waterBill.previousReading?.toString() ?? null,
        currentReading:
          waterBill.currentReading?.toString() ?? null,
        consumption:
          waterBill.consumption?.toString() ?? null,
        rate: waterBill.rate?.toString() ?? null,
        amount: waterBill.amount.toString(),
        dueDate: waterBill.dueDate,
        status: waterBill.status,
        issuedAt: waterBill.issuedAt,
      },
    },
    { status: 201 },
  );
}
