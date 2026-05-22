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
  category?: string;
  short_intro?: string;
  description: string;
  image_url: string;
  source_url?: string;
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
  description: string;
  location: string;
  image_url: string;
  created_at: string;
  artifact_count?: number;
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
