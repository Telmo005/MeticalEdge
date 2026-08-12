import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  schemaFilter: ["metical_edge"],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
