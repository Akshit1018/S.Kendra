create table if not exists user_profiles (
  user_id     text primary key,
  role        text not null default 'field_engineer',
  department  text not null default 'logistics',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists audit_logs (
  id                      text primary key,
  user_id                 text not null,
  user_role               text not null,
  action                  text not null,
  query_text              text,
  retrieved_chunk_ids     text,
  document_ids_accessed   text,
  answer_preview          text,
  latency_ms              integer,
  success                 boolean not null default true,
  escalate                boolean not null default false,
  model_used              text,
  error_message           text,
  created_at              timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on audit_logs (user_id, created_at desc);

create table if not exists query_feedback (
  id          text primary key,
  audit_id    text not null,
  user_id     text not null,
  rating      text not null,
  comment     text,
  created_at  timestamptz not null default now()
);

create table if not exists uploaded_docs (
  id            text primary key,
  user_id       text not null,
  title         text not null,
  content       text not null,
  department    text not null,
  access_level  text not null,
  allowed_roles text not null,
  created_at    timestamptz not null default now()
);
