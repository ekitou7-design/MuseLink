-- MuseLink (博悟) backend schema (PostgreSQL)

create table if not exists users (
  id bigserial primary key,
  user_number bigint not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create sequence if not exists user_number_seq start 100000;

-- Ensure user_number defaults from sequence if omitted
alter table users
  alter column user_number set default nextval('user_number_seq');

create table if not exists museums (
  id bigserial primary key,
  name text not null unique,
  normalized_name text,
  aliases text[] not null default '{}'::text[],
  type text not null default '其他',
  level text not null default '未定级',
  grade text not null default '未定级',
  province text,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  official_website text,
  description text not null default '',
  history text not null default '',
  highlights text not null default '',
  opening_hours text not null default '',
  ticket_info text not null default '',
  contact text not null default '',
  cover_image_url text not null default '',
  cover_thumbnail_url text not null default '',
  local_cover_image_url text not null default '',
  local_cover_thumbnail_url text not null default '',
  storage_cover_image_url text not null default '',
  storage_cover_thumbnail_url text not null default '',
  image_source text not null default '',
  source text not null default '',
  created_by_import boolean not null default false,
  artifact_count int not null default 0,
  is_featured boolean not null default false,
  location text not null default '',
  image_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table museums add column if not exists normalized_name text;
alter table museums add column if not exists aliases text[] not null default '{}'::text[];
alter table museums add column if not exists type text not null default '其他';
alter table museums add column if not exists level text not null default '未定级';
alter table museums add column if not exists grade text not null default '未定级';
alter table museums add column if not exists province text;
alter table museums add column if not exists city text;
alter table museums add column if not exists address text;
alter table museums add column if not exists latitude double precision;
alter table museums add column if not exists longitude double precision;
alter table museums add column if not exists official_website text;
alter table museums add column if not exists history text not null default '';
alter table museums add column if not exists highlights text not null default '';
alter table museums add column if not exists opening_hours text not null default '';
alter table museums add column if not exists ticket_info text not null default '';
alter table museums add column if not exists contact text not null default '';
alter table museums add column if not exists cover_image_url text not null default '';
alter table museums add column if not exists cover_thumbnail_url text not null default '';
alter table museums add column if not exists local_cover_image_url text not null default '';
alter table museums add column if not exists local_cover_thumbnail_url text not null default '';
alter table museums add column if not exists storage_cover_image_url text not null default '';
alter table museums add column if not exists storage_cover_thumbnail_url text not null default '';
alter table museums add column if not exists image_source text not null default '';
alter table museums add column if not exists source text not null default '';
alter table museums add column if not exists created_by_import boolean not null default false;
alter table museums add column if not exists artifact_count int not null default 0;
alter table museums add column if not exists is_featured boolean not null default false;
alter table museums add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_museums_normalized_name on museums(normalized_name);

create table if not exists museum_aliases (
  id bigserial primary key,
  museum_id bigint not null references museums(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null default '',
  confidence double precision not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_alias)
);

create table if not exists artifacts (
  id bigserial primary key,
  name text not null,
  dynasty text not null,
  museum_id bigint not null references museums(id) on delete restrict,
  raw_museum_name text not null default '',
  canonical_museum_name text not null default '',
  category text not null default '',
  short_intro text not null default '',
  description text not null,
  image_url text not null,
  local_image_url text not null default '',
  local_thumbnail_url text not null default '',
  source_url text not null default '',
  is_editor_recommended boolean not null default false,
  editor_recommendation_order int not null default 0,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table artifacts add column if not exists category text not null default '';
alter table artifacts add column if not exists short_intro text not null default '';
alter table artifacts add column if not exists local_image_url text not null default '';
alter table artifacts add column if not exists local_thumbnail_url text not null default '';
alter table artifacts add column if not exists source_url text not null default '';
alter table artifacts add column if not exists is_editor_recommended boolean not null default false;
alter table artifacts add column if not exists editor_recommendation_order int not null default 0;
alter table artifacts add column if not exists updated_at timestamptz not null default now();
alter table artifacts add column if not exists raw_museum_name text not null default '';
alter table artifacts add column if not exists canonical_museum_name text not null default '';

create table if not exists artifact_attributes (
  id bigserial primary key,
  artifact_id bigint not null references artifacts(id) on delete cascade,
  attribute_group text not null default '基础信息',
  attribute_name text not null,
  attribute_value text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists exhibitions (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  title text not null,
  theme text not null,
  bgm_url text,
  created_at timestamptz not null default now()
);

create table if not exists exhibition_items (
  exhibition_id bigint not null references exhibitions(id) on delete cascade,
  artifact_id bigint not null references artifacts(id) on delete restrict,
  order_index int not null default 0,
  curator_note text not null default '',
  primary key (exhibition_id, artifact_id)
);

-- likes = like/favorite toggle table
create type target_type as enum ('artifact', 'exhibition');

create table if not exists likes (
  user_id bigint not null references users(id) on delete cascade,
  target_type target_type not null,
  target_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

-- Helpful indexes
create index if not exists idx_artifacts_museum_id on artifacts(museum_id);
create index if not exists idx_artifacts_raw_museum_name on artifacts(raw_museum_name);
create index if not exists idx_artifacts_dynasty on artifacts(dynasty);
create index if not exists idx_artifact_attributes_artifact_id on artifact_attributes(artifact_id, sort_order, id);
create index if not exists idx_exhibitions_user_id on exhibitions(user_id);
create index if not exists idx_exhibition_items_exhibition on exhibition_items(exhibition_id, order_index);
