import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { promisify } from "node:util";
import {
  randomBytes,
  scrypt as scryptCallback,
} from "node:crypto";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  if (password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);

  return `${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

async function main() {
  const fullName = process.env.ADMIN_FULL_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!fullName || !email || !password) {
    throw new Error(
      "Set ADMIN_FULL_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running this script.",
    );
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      fullName,
      passwordHash,
      role: "SUPER_ADMIN",
      accountStatus: "ACTIVE",
      approvedAt: new Date(),
      rejectedAt: null,
      suspendedAt: null,
      archivedAt: null,
    },
    create: {
      fullName,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      accountStatus: "ACTIVE",
      approvedAt: new Date(),
    },
  });

  console.log(`Administrator ready: ${admin.email}`);
  console.log(`User ID: ${admin.id}`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
