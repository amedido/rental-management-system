import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  const { response } = await requireAdmin();

  if (response) {
    return response;
  }

  const [tenants, availableUnits] = await Promise.all([
    prisma.tenant.findMany({
      where: {
        user: {
          role: "TENANT",
          accountStatus: "ACTIVE",
        },
      },
      orderBy: {
        user: {
          fullName: "asc",
        },
      },
      select: {
        id: true,
        userId: true,
        monthlyRent: true,
        moveInAt: true,
        requestedUnitNumber: true,
        user: {
          select: {
            fullName: true,
            email: true,
            phone: true,
            accountStatus: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            floor: true,
            status: true,
          },
        },
      },
    }),

    prisma.unit.findMany({
      where: {
        type: "ONE_BEDROOM",
        status: "VACANT",
        property: {
          name: "Mashaallah",
        },
      },
      orderBy: [
        {
          floor: "asc",
        },
        {
          unitNumber: "asc",
        },
      ],
      select: {
        id: true,
        unitNumber: true,
        floor: true,
        status: true,
        monthlyRent: true,
      },
    }),
  ]);

  return Response.json({
    tenants: tenants.map((tenant) => ({
      id: tenant.id,
      userId: tenant.userId,
      monthlyRent: tenant.monthlyRent.toString(),
      moveInAt: tenant.moveInAt,
      requestedUnitNumber: tenant.requestedUnitNumber,
      user: tenant.user,
      unit: tenant.unit,
    })),

    availableUnits: availableUnits.map((unit) => ({
      id: unit.id,
      unitNumber: unit.unitNumber,
      floor: unit.floor,
      status: unit.status,
      monthlyRent: unit.monthlyRent.toString(),
    })),
  });
}
