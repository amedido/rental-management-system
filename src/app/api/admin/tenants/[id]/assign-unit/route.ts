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

  const { id: tenantUserId } = await context.params;

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
    !("unitNumber" in body) ||
    typeof body.unitNumber !== "string"
  ) {
    return Response.json(
      {
        error: "unitNumber is required.",
      },
      { status: 400 },
    );
  }

  const unitNumber = body.unitNumber.trim().toUpperCase();

  const result = await prisma.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.findUnique({
      where: {
        userId: tenantUserId,
      },
      include: {
        user: true,
        unit: true,
      },
    });

    if (!tenant || tenant.user.role !== "TENANT") {
      throw new Error("TENANT_NOT_FOUND");
    }

    if (tenant.user.accountStatus !== "ACTIVE") {
      throw new Error("TENANT_NOT_ACTIVE");
    }

    const property = await transaction.property.findUnique({
      where: {
        name: "Mashaallah",
      },
    });

    if (!property) {
      throw new Error("PROPERTY_NOT_FOUND");
    }

    const unit = await transaction.unit.findUnique({
      where: {
        propertyId_unitNumber: {
          propertyId: property.id,
          unitNumber,
        },
      },
    });

    if (!unit) {
      throw new Error("UNIT_NOT_FOUND");
    }

    if (unit.type !== "ONE_BEDROOM") {
      throw new Error("UNIT_NOT_RESIDENTIAL");
    }

    if (unit.status === "OCCUPIED" && unit.id !== tenant.unitId) {
      throw new Error("UNIT_ALREADY_OCCUPIED");
    }

    const moveInAt = new Date();

    if (tenant.unitId && tenant.unitId !== unit.id) {
      await transaction.unit.update({
        where: {
          id: tenant.unitId,
        },
        data: {
          status: "VACANT",
        },
      });
    }

    const updatedTenant = await transaction.tenant.update({
      where: {
        id: tenant.id,
      },
      data: {
        unitId: unit.id,
        moveInAt,
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
        unit: {
          select: {
            unitNumber: true,
            floor: true,
            status: true,
          },
        },
      },
    });

    await transaction.unit.update({
      where: {
        id: unit.id,
      },
      data: {
        status: "OCCUPIED",
      },
    });

    await transaction.auditEvent.create({
      data: {
        actorUserId: user!.id,
        action: "TENANT_UNIT_ASSIGNED",
        entityType: "Tenant",
        entityId: tenant.id,
        metadata: {
          unitNumber,
          previousUnitId: tenant.unitId,
          assignedAt: moveInAt.toISOString(),
        },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return updatedTenant;
  });

  return Response.json({
    message: "Unit assigned successfully.",
    tenant: result,
  });
}
