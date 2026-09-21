import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, response } = await requireAdmin();

  if (response) {
    return response;
  }

  const pendingTenants = await prisma.user.findMany({
    where: {
      role: "TENANT",
      accountStatus: "PENDING_APPROVAL",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      accountStatus: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          requestedUnitNumber: true,
          identificationNumber: true,
          createdAt: true,
        },
      },
    },
  });

  return Response.json({
    requestedBy: user?.id,
    tenants: pendingTenants,
  });
}
