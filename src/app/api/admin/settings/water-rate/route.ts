import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const RATE_PATTERN = /^\d+(\.\d{1,2})?$/;

export async function GET() {
  const { response } = await requireAdmin();

  if (response) {
    return response;
  }

  const property = await prisma.property.findUnique({
    where: {
      name: "Mashaallah",
    },
    select: {
      id: true,
      name: true,
      waterRate: true,
    },
  });

  if (!property) {
    return Response.json(
      {
        error: "Mashaallah property was not found.",
      },
      { status: 404 },
    );
  }

  return Response.json({
    property: {
      id: property.id,
      name: property.name,
      waterRate: property.waterRate.toString(),
    },
  });
}

export async function PATCH(request: NextRequest) {
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

  const rawRate = (body as { waterRate?: unknown }).waterRate;
  const rateText = String(rawRate ?? "").trim();

  if (!RATE_PATTERN.test(rateText)) {
    return Response.json(
      {
        error:
          "Water rate must be a valid amount with no more than 2 decimal places.",
      },
      { status: 400 },
    );
  }

  const rate = Number(rateText);

  if (!Number.isFinite(rate) || rate < 0) {
    return Response.json(
      {
        error: "Water rate cannot be negative.",
      },
      { status: 400 },
    );
  }

  const property = await prisma.property.findUnique({
    where: {
      name: "Mashaallah",
    },
    select: {
      id: true,
      name: true,
      waterRate: true,
    },
  });

  if (!property) {
    return Response.json(
      {
        error: "Mashaallah property was not found.",
      },
      { status: 404 },
    );
  }

  const oldRate = property.waterRate.toString();
  const changedAt = new Date();

  const updatedProperty = await prisma.$transaction(
    async (transaction) => {
      const updated = await transaction.property.update({
        where: {
          id: property.id,
        },
        data: {
          waterRate: rateText,
        },
        select: {
          id: true,
          name: true,
          waterRate: true,
        },
      });

      await transaction.auditEvent.create({
        data: {
          actorUserId: user!.id,
          action: "WATER_RATE_CHANGED",
          entityType: "Property",
          entityId: property.id,
          metadata: {
            propertyName: property.name,
            oldWaterRate: oldRate,
            newWaterRate: rateText,
            changedAt: changedAt.toISOString(),
          },
          ipAddress: request.headers.get("x-forwarded-for"),
          userAgent: request.headers.get("user-agent"),
        },
      });

      return updated;
    },
  );

  return Response.json({
    message: "Water rate updated successfully.",
    property: {
      id: updatedProperty.id,
      name: updatedProperty.name,
      waterRate: updatedProperty.waterRate.toString(),
    },
  });
}
