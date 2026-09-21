import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json(
      {
        authenticated: false,
        user: null,
      },
      { status: 401 },
    );
  }

  return Response.json({
    authenticated: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            unit: user.tenant.unit
              ? {
                  id: user.tenant.unit.id,
                  unitNumber: user.tenant.unit.unitNumber,
                  property: user.tenant.unit.property.name,
                }
              : null,
          }
        : null,
    },
  });
}
