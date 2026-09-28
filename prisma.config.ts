import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` (run in postinstall/build, e.g. on Vercel) only reads the schema — it
// never opens a database connection — but Prisma's config loader resolves `datasource.url`
// eagerly regardless of which command is running. The strict `env("DATABASE_URL")` helper
// throws immediately if that var isn't set yet at that point in the build, which broke a
// build where env vars hadn't been added in the hosting dashboard. Falling back to a
// syntactically-valid placeholder keeps `generate` working either way; anything that
// actually queries the database (src/lib/db.ts) still requires and validates the real
// DATABASE_URL at runtime via src/lib/env.ts, so a missing/wrong value there still fails
// loudly — just not during a `generate`-only step that doesn't need it.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
