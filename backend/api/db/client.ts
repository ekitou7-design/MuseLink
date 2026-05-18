import { Pool } from "pg";
import { newDb } from "pg-mem";
import fs from "fs";
import path from "path";

type DbLike = Pick<Pool, "query" | "end">;

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing ${name} env var`);
  return value;
}

function createPgMemDb(): DbLike {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({
    name: "now",
    returns: "timestamptz" as any,
    implementation: () => new Date(),
  });

  // Apply schema at startup so the backend can run out-of-the-box.
  const schemaPath = path.join(process.cwd(), "backend", "api", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  mem.public.none(schemaSql);

  // Return a pg-compatible pool
  const { Pool: MemPool } = mem.adapters.createPg();
  return new MemPool() as unknown as DbLike;
}

function createPostgresDb(): DbLike {
  return new Pool({
    host: required("DB_HOST", "127.0.0.1"),
    port: Number(required("DB_PORT", "5432")),
    database: required("DB_NAME", "muselink"),
    user: required("DB_USER", "muselink"),
    password: required("DB_PASSWORD", "muselink_password"),
  });
}

const usePgMem =
  process.env.USE_PGMEM === "true" ||
  process.env.USE_PGMEM === "1" ||
  (!process.env.DB_HOST && !process.env.DB_NAME);

export const db: DbLike = usePgMem ? createPgMemDb() : createPostgresDb();

