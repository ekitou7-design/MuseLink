export type UserRow = {
  id: number;
  user_number: number;
  password_hash: string;
  created_at: string;
};

export type ArtifactRow = {
  id: number;
  name: string;
  dynasty: string;
  museum_id: number;
  museum: string;
  raw_museum_name?: string;
  canonical_museum_name?: string;
  museum_type?: string;
  museum_grade?: string;
  museum_province?: string;
  museum_city?: string;
  category?: string;
  short_intro?: string;
  description: string;
  image_url: string;
  local_image_url?: string;
  local_thumbnail_url?: string;
  source_url?: string;
  is_editor_recommended?: boolean;
  editor_recommendation_order?: number;
  tags: string[];
  created_at: string;
  updated_at?: string;
};

export type ArtifactAttributeRow = {
  id: number;
  artifact_id: number;
  attribute_group: string;
  attribute_name: string;
  attribute_value: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MuseumRow = {
  id: number;
  name: string;
  normalized_name?: string;
  aliases?: string[];
  type?: string;
  level?: string;
  grade?: string;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  official_website?: string | null;
  description: string;
  history?: string;
  highlights?: string;
  opening_hours?: string;
  ticket_info?: string;
  contact?: string;
  cover_image_url?: string;
  cover_thumbnail_url?: string;
  local_cover_image_url?: string;
  local_cover_thumbnail_url?: string;
  storage_cover_image_url?: string;
  storage_cover_thumbnail_url?: string;
  image_source?: string;
  source?: string;
  created_by_import?: boolean;
  location: string;
  image_url: string;
  created_at: string;
  updated_at?: string;
  artifact_count?: number;
  is_featured?: boolean;
};

export type ExhibitionRow = {
  id: number;
  user_id: number;
  title: string;
  theme: string;
  bgm_url: string | null;
  created_at: string;
};

export type ExhibitionItemRow = {
  exhibition_id: number;
  artifact_id: number;
  order_index: number;
  curator_note: string;
};

export type LikeRow = {
  user_id: number;
  target_type: "artifact" | "exhibition";
  target_id: number;
  created_at: string;
};
