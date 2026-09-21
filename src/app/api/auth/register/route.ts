import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

export async function POST(request: NextRequest) {
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
        error: "Registration data is required.",
      },
      { status: 400 },
    );
  }

  const data = body as Record<string, unknown>;

  const fullName =
    typeof data.fullName === "string" ? data.fullName.trim() : "";

  const email =
    typeof data.email === "string"
      ? data.email.trim().toLowerCase()
      : "";

  const phone =
    typeof data.phone === "string" ? data.phone.trim() : "";

  const password =
    typeof data.password === "string" ? data.password : "";

  const requestedUnitNumber =
    typeof data.requestedUnitNumber === "string"
      ? data.requestedUnitNumber.trim().toUpperCase()
      : null;

  const identificationNumber =
    typeof data.identificationNumber === "string"
      ? data.identificationNumber.trim()
      : null;

  if (!fullName || !email || !phone || !password) {
    return Response.json(
      {
        error: "Full name, email, phone, and password are required.",
      },
      { status: 400 },
    );
  }

  if (fullName.length < 2) {
    return Response.json(
      {
        error: "Full name must contain at least 2 characters.",
      },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return Response.json(
      {
        error: "Password must contain at least 8 characters.",
      },
      { status: 400 },
    );
  }

  if (!email.includes("@")) {
    return Response.json(
      {
        error: "Enter a valid email address.",
      },
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        {
          email,
        },
        {
          phone,
        },
      ],
    },
    select: {
      id: true,
      email: true,
      phone: true,
      accountStatus: true,
    },
  });

  if (existingUser) {
    return Response.json(
      {
        error: "An account with this email or phone already exists.",
      },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const registeredAt = new Date();

  const user = await prisma.$transaction(async (transaction) => {
    const createdUser = await transaction.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash,
        role: "TENANT",
        accountStatus: "PENDING_APPROVAL",
        tenant: {
          create: {
            requestedUnitNumber,
            identificationNumber,
          },
        },
      },
      include: {
        tenant: true,
      },
    });

    await transaction.auditEvent.create({
      data: {
        actorUserId: createdUser.id,
        action: "TENANT_REGISTRATION_SUBMITTED",
        entityType: "User",
        entityId: createdUser.id,
        metadata: {
          registeredAt: registeredAt.toISOString(),
          requestedUnitNumber,
        },
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    });

    return createdUser;
  });

  return Response.json(
    {
      message:
        "Registration submitted. Your account is waiting for administrator approval.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        tenantId: user.tenant?.id,
      },
    },
    { status: 201 },
  );
}
