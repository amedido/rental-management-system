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
      },
    }),
  ]);

  return Response.json({
    tenants,
    availableUnits,
  });
}
