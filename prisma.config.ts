import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Check the .env file in the project root.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.cjs",
  },
  datasource: {
    url: databaseUrl,
  },
});
