import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  revokeCurrentSession,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (user) {
    const loggedOutAt = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastLogoutAt: loggedOutAt,
        },
      }),
      prisma.loginEvent.create({
        data: {
          userId: user.id,
          succeeded: true,
          loggedInAt: loggedOutAt,
          loggedOutAt,
          ipAddress:
            request.headers.get("x-forwarded-for") ??
            request.headers.get("x-real-ip"),
          userAgent: request.headers.get("user-agent"),
        },
      }),
    ]);
  }

  await revokeCurrentSession();

  return Response.json({
    message: "Logout successful.",
  });
}
