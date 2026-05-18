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
  description text not null default '',
  location text not null default '',
  image_url text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists artifacts (
  id bigserial primary key,
  name text not null,
  dynasty text not null,
  museum_id bigint not null references museums(id) on delete restrict,
  description text not null,
  image_url text not null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
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
create index if not exists idx_artifacts_dynasty on artifacts(dynasty);
create index if not exists idx_exhibitions_user_id on exhibitions(user_id);
create index if not exists idx_exhibition_items_exhibition on exhibition_items(exhibition_id, order_index);

