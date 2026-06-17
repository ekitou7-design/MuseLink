import { normalizedMuseumKey } from "../../museum-normalizer";
import { listMuseumsFromStore } from "../services/museumsStore";
import type { DbQuery } from "./syncImportedArtifacts";

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export async function syncImportedMuseumsToDb(db: DbQuery) {
  const museums = await listMuseumsFromStore();
  let inserted = 0;
  let updated = 0;
  let pruned = 0;
  const seenMuseumNames = new Set<string>();

  for (const museum of museums) {
    const name = text(museum.name);
    if (!name) continue;
    seenMuseumNames.add(name);
    const existing = await db.query<{ id: number | string }>(`select id from museums where name=$1 limit 1`, [name]);
    const params = [
      name,
      normalizedMuseumKey(name),
      museum.aliases || [],
      museum.type || "其他",
      museum.level || "未定级",
      museum.grade || "未定级",
      museum.province || null,
      museum.city || null,
      museum.address || null,
      museum.officialWebsite || null,
      museum.description || "",
      museum.history || "",
      museum.highlights || "",
      museum.openingHours || "",
      museum.ticketInfo || "",
      museum.contact || "",
      museum.coverImageUrl || "",
      museum.coverThumbnailUrl || "",
      museum.localCoverImageUrl || "",
      museum.localCoverThumbnailUrl || "",
      museum.storageCoverImageUrl || "",
      museum.storageCoverThumbnailUrl || "",
      museum.imageSource || "",
      museum.source || "imported-museums-json",
      Boolean(museum.createdByImport),
      Number(museum.artifactCount || 0) || 0,
      Boolean(museum.isFeatured),
      museum.location || "",
      museum.imageUrl || museum.displayCoverUrl || "",
    ];

    if (existing.rows[0]) {
      await db.query(
        `update museums
         set normalized_name=$2, aliases=$3, type=$4, level=$5, grade=$6, province=$7, city=$8,
             address=$9, official_website=$10, description=$11, history=$12, highlights=$13,
             opening_hours=$14, ticket_info=$15, contact=$16, cover_image_url=$17,
             cover_thumbnail_url=$18, local_cover_image_url=$19, local_cover_thumbnail_url=$20,
             storage_cover_image_url=$21, storage_cover_thumbnail_url=$22, image_source=$23,
             source=$24, created_by_import=$25, artifact_count=$26, is_featured=$27,
             location=$28, image_url=$29, updated_at=now()
         where name=$1`,
        params,
      );
      updated += 1;
    } else {
      await db.query(
        `insert into museums (
           name, normalized_name, aliases, type, level, grade, province, city, address,
           official_website, description, history, highlights, opening_hours, ticket_info,
           contact, cover_image_url, cover_thumbnail_url, local_cover_image_url,
           local_cover_thumbnail_url, storage_cover_image_url, storage_cover_thumbnail_url,
           image_source, source, created_by_import, artifact_count, is_featured, location, image_url
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
        params,
      );
      inserted += 1;
    }
  }

  const existingMuseums = await db.query<{ id: number | string; name: string }>(`select id, name from museums`);
  for (const row of existingMuseums.rows) {
    if (seenMuseumNames.has(text(row.name))) continue;
    await db.query(`delete from museum_aliases where museum_id::text = $1`, [String(row.id)]).catch(() => undefined);
    const deleted = await db.query(`delete from museums where id::text = $1`, [String(row.id)]).catch(() => ({ rowCount: 0 }));
    if ((deleted.rowCount || 0) > 0) pruned += 1;
  }

  return { importedCount: museums.length, inserted, updated, pruned };
}
