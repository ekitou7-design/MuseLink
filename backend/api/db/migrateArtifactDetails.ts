type DbLike = {
  query: <T = any>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export async function migrateArtifactDetails(db: DbLike): Promise<{ migrated: boolean }> {
  await db.query(`alter table artifacts add column if not exists category text not null default ''`);
  await db.query(`alter table artifacts add column if not exists short_intro text not null default ''`);
  await db.query(`alter table artifacts add column if not exists source_url text not null default ''`);
  await db.query(`alter table artifacts add column if not exists updated_at timestamptz not null default now()`);

  const attributeTable = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_name = 'artifact_attributes'`,
  );
  if (attributeTable.rows.length === 0) {
    try {
      await db.query(`
        create table if not exists artifact_attributes (
          id bigserial primary key,
          artifact_id bigint not null references artifacts(id) on delete cascade,
          attribute_group text not null default '基础信息',
          attribute_name text not null,
          attribute_value text not null default '',
          sort_order int not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
    } catch {
      await db.query(`
        create table artifact_attributes (
          id bigserial,
          artifact_id bigint,
          attribute_group text,
          attribute_name text,
          attribute_value text,
          sort_order int,
          created_at timestamptz,
          updated_at timestamptz
        )
      `);
    }
  }
  await db.query(
    `create index if not exists idx_artifact_attributes_artifact_id on artifact_attributes(artifact_id, sort_order, id)`,
  );

  const columnsResult = await db.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_name = 'artifacts'`,
  );
  const columns = new Set(columnsResult.rows.map((row) => row.column_name));

  const syncLegacyColumn = async (
    column: string,
    attributeGroup: string,
    attributeName: string,
    sortOrder: number,
  ) => {
    if (!columns.has(column)) return;
    await db.query(
      `
      insert into artifact_attributes (artifact_id, attribute_group, attribute_name, attribute_value, sort_order)
      select a.id, $1, $2, a.${column}::text, $3
      from artifacts a
      where nullif(btrim(coalesce(a.${column}::text, '')), '') is not null
        and not exists (
          select 1
          from artifact_attributes aa
          where aa.artifact_id = a.id
            and aa.attribute_group = $1
            and aa.attribute_name = $2
        )
      `,
      [attributeGroup, attributeName, sortOrder],
    );
  };

  await syncLegacyColumn("material", "基础信息", "材质", 1);
  await syncLegacyColumn(columns.has("size") ? "size" : "dimensions", "基础信息", "尺寸", 2);
  await syncLegacyColumn("level", "基础信息", "等级", 3);
  await syncLegacyColumn(columns.has("remark") ? "remark" : "note", "其他信息", "备注", 4);

  return { migrated: true };
}
