import type { Pool } from "pg";

type DbLike = Pick<Pool, "query" | "end">;

/**
 * Migrates legacy `artifacts.museum` (text) to `artifacts.museum_id` + `museums` table.
 * Safe to run repeatedly (no-op when already migrated).
 */
export async function upgradeArtifactsMuseumFk(db: DbLike): Promise<{ migrated: boolean }> {
  const col = await db.query<{ column_name: string }>(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'artifacts'
       and column_name = 'museum'`,
  );
  if (col.rows.length === 0) {
    return { migrated: false };
  }

  await db.query(
    `insert into museums (name)
     select distinct a.museum
     from artifacts a
     where a.museum is not null
       and trim(a.museum) <> ''
       and not exists (select 1 from museums m where m.name = a.museum)`,
  );

  await db.query(`alter table artifacts add column if not exists museum_id bigint references museums(id)`);

  await db.query(
    `update artifacts a
     set museum_id = m.id
     from museums m
     where m.name = a.museum
       and a.museum_id is null`,
  );

  const orphans = await db.query(`select count(*)::text as c from artifacts where museum_id is null`);
  if (Number(orphans.rows[0]?.c || "0") > 0) {
    await db.query(`insert into museums (name) values ('未归类博物馆') on conflict (name) do nothing`);
    await db.query(
      `update artifacts
       set museum_id = (select id from museums where name = '未归类博物馆' limit 1)
       where museum_id is null`,
    );
  }

  await db.query(`alter table artifacts alter column museum_id set not null`);
  await db.query(`alter table artifacts drop column museum`);
  await db.query(`drop index if exists idx_artifacts_museum`);
  await db.query(`create index if not exists idx_artifacts_museum_id on artifacts(museum_id)`);

  return { migrated: true };
}
