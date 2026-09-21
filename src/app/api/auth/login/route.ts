import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

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
    !("email" in body) ||
    !("password" in body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return Response.json(
      {
        error: "Email and password are required.",
      },
      { status: 400 },
    );
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return Response.json(
      {
        error: "Email and password are required.",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user || !user.passwordHash) {
    if (user) {
      await prisma.loginEvent.create({
        data: {
          userId: user.id,
          succeeded: false,
          ipAddress,
          userAgent,
          failureReason: "INVALID_CREDENTIALS",
        },
      });
    }

    return Response.json(
      {
        error: "Invalid email or password.",
      },
      { status: 401 },
    );
  }

  const passwordIsValid = await verifyPassword(
    password,
    user.passwordHash,
  );

  if (!passwordIsValid) {
    await prisma.loginEvent.create({
      data: {
        userId: user.id,
        succeeded: false,
        ipAddress,
        userAgent,
        failureReason: "INVALID_CREDENTIALS",
      },
    });

    return Response.json(
      {
        error: "Invalid email or password.",
      },
      { status: 401 },
    );
  }

  if (user.accountStatus !== "ACTIVE") {
    await prisma.loginEvent.create({
      data: {
        userId: user.id,
        succeeded: false,
        ipAddress,
        userAgent,
        failureReason: `ACCOUNT_${user.accountStatus}`,
      },
    });

    return Response.json(
      {
        error: `This account is ${user.accountStatus.toLowerCase()}.`,
      },
      { status: 403 },
    );
  }

  await createSession(user.id);

  const loggedInAt = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: loggedInAt,
      },
    }),
    prisma.loginEvent.create({
      data: {
        userId: user.id,
        succeeded: true,
        loggedInAt,
        ipAddress,
        userAgent,
      },
    }),
  ]);

  return Response.json({
    message: "Login successful.",
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    },
  });
}
