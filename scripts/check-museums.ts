import { db } from "../backend/api/db/client";
import { ensureMuseumSchema, findPossibleMuseumDuplicates, inferMuseumLocation } from "../backend/museum-normalizer";
import { bootstrapMuseumsData } from "../backend/api/db/bootstrapMuseumsData";

type CountRow = { c: string };

async function count(sql: string, params: unknown[] = []) {
  const result = await db.query<CountRow>(sql, params);
  return Number(result.rows[0]?.c || 0);
}

async function main() {
  const sync = await bootstrapMuseumsData(db);
  if (!sync.skipped) {
    console.log(`已同步导入文物数据：${sync.importedCount} file rows, ${sync.inserted} inserted, ${sync.updated} updated`);
  }
  await ensureMuseumSchema(db);

  const museums = await db.query<{ id: number | string; name: string; province?: string | null; city?: string | null }>(`select id, name, province, city from museums order by name asc`);
  const duplicateRows = [];
  for (const museum of museums.rows) {
    const duplicates = await findPossibleMuseumDuplicates(db, museum.name);
    if (duplicates.length > 0) duplicateRows.push({ museum: museum.name, duplicates });
  }

  const aliasRows = await db.query<{ normalized_alias: string; museum_id: number | string; name: string }>(
    `select ma.normalized_alias, ma.museum_id, m.name
     from museum_aliases ma
     join museums m on m.id = ma.museum_id
     order by ma.normalized_alias asc`,
  );
  const aliasConflictMap = new Map<string, Map<string, string>>();
  aliasRows.rows.forEach((row) => {
    const entry = aliasConflictMap.get(row.normalized_alias) || new Map<string, string>();
    entry.set(String(row.museum_id), row.name);
    aliasConflictMap.set(row.normalized_alias, entry);
  });
  const aliasConflicts = Array.from(aliasConflictMap.entries())
    .filter(([, museumMap]) => museumMap.size > 1)
    .map(([normalizedAlias, museumMap]) => ({
      normalizedAlias,
      museums: Array.from(museumMap.values()).join(" / "),
    }));

  const stats = {
    museumsTotal: await count(`select count(*)::text as c from museums`),
    museumsWithProvince: museums.rows.filter((museum) => museum.province && museum.province !== "其他" && museum.province !== "未知地区").length,
    museumsProvinceOther: museums.rows.filter((museum) => museum.province === "其他" || museum.province === "未知地区").length,
    museumsProvinceEmpty: museums.rows.filter((museum) => !museum.province).length,
    museumsWithArtifacts: await count(`select count(distinct museum_id)::text as c from artifacts`),
    museumsWithoutArtifacts: 0,
    museumsCreatedByImport: await count(`select count(*)::text as c from museums where created_by_import = true`),
    aliasesTotal: await count(`select count(*)::text as c from museum_aliases`),
    artifactsTotal: await count(`select count(*)::text as c from artifacts`),
    artifactsWithMuseumId: await count(`select count(*)::text as c from artifacts where museum_id is not null`),
    artifactsMissingMuseumId: await count(`select count(*)::text as c from artifacts where museum_id is null`),
  };
  stats.museumsWithoutArtifacts = Math.max(stats.museumsTotal - stats.museumsWithArtifacts, 0);
  const provinceCounts = new Map<string, number>();
  const shouldHaveProvince = museums.rows.filter((museum) => {
    const province = museum.province || "";
    const inferred = inferMuseumLocation(museum.name);
    provinceCounts.set(province || "空", (provinceCounts.get(province || "空") || 0) + 1);
    return (!province || province === "其他" || province === "未知地区") && inferred.source !== "unknown";
  });

  console.log("MuseLink museum dictionary check");
  console.table(stats);
  console.log("每个省份下 museums 数量：");
  Array.from(provinceCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .forEach(([province, total]) => console.log(`- ${province}: ${total}`));
  console.log(`疑似应该有省份但仍在其他/空: ${shouldHaveProvince.length}`);
  shouldHaveProvince.slice(0, 20).forEach((museum) => {
    const inferred = inferMuseumLocation(museum.name);
    console.log(`- ${museum.name}: 建议 ${inferred.province} / ${inferred.city}`);
  });
  console.log(`疑似重复 museums: ${duplicateRows.length}`);
  duplicateRows.slice(0, 20).forEach((item) => {
    console.log(`- ${item.museum}: ${item.duplicates.map((dup) => `${dup.name} (${dup.score.toFixed(2)})`).join(", ")}`);
  });
  console.log(`alias 冲突项: ${aliasConflicts.length}`);
  aliasConflicts.forEach((row) => {
    console.log(`- ${row.normalizedAlias}: ${row.museums}`);
  });

  if (stats.artifactsMissingMuseumId > 0 || aliasConflicts.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end().catch(() => undefined);
  });
