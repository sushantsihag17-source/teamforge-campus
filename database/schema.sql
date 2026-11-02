-- Run once in Supabase -> SQL Editor. Starts with ZERO student/project records.
-- All application tables have RLS enabled but no browser-access policies.
-- Only the authenticated, authorization-checking Node server may use the secret key.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 55),
 handle text not null unique check(handle ~ '^[a-z0-9._-]{3,30}$'),
 program text not null,
 year integer not null check(year between 1 and 4),
 bio text not null default '',
 skills text[] not null default '{}',
 interests text[] not null default '{}',
 availability text not null default 'High' check(availability in ('High','Medium','Low')),
 color text not null default '#14a3a1',
 created_at timestamptz not null default now()
);
create table if not exists public.projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete restrict,
 title text not null,
 tagline text not null,
 description text not null,
 category text not null,
 skills text[] not null default '{}',
 capacity integer not null check(capacity between 2 and 8),
 color text not null default '#14a3a1',
 created_at timestamptz not null default now()
);
create table if not exists public.project_members (
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(project_id,user_id)
);
create table if not exists public.applications (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 message text not null default '',
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now()
);
create unique index if not exists only_one_pending_application on public.applications(project_id,user_id) where status='pending';
create table if not exists public.invites (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now()
);
create unique index if not exists only_one_pending_invite on public.invites(project_id,user_id) where status='pending';
create table if not exists public.activity (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null,
 text text not null,
 at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.applications enable row level security;
alter table public.invites enable row level security;
alter table public.activity enable row level security;
-- Explicitly revoke normal browser roles. All access occurs via backend with checked JWT.
revoke all on public.profiles,public.projects,public.project_members,public.applications,public.invites,public.activity from anon,authenticated;
grant all on public.profiles,public.projects,public.project_members,public.applications,public.invites,public.activity to service_role;

-- Transactional project creation and membership updates prevent partial inserts and overcapacity.
create or replace function public.create_teamforge_project(p_owner uuid,p_title text,p_tagline text,p_description text,p_category text,p_skills text[],p_capacity integer)
returns uuid language plpgsql security invoker set search_path=public as $$
declare new_id uuid;
begin
  if p_capacity<2 or p_capacity>8 then raise exception 'Invalid capacity'; end if;
  insert into projects(owner_id,title,tagline,description,category,skills,capacity)
  values(p_owner,p_title,p_tagline,p_description,p_category,p_skills,p_capacity) returning id into new_id;
  insert into project_members(project_id,user_id) values(new_id,p_owner);
  return new_id;
end;$$;

create or replace function public.decide_teamforge_application(p_project uuid,p_owner uuid,p_student uuid,p_decision text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare p public.projects%rowtype; a uuid; n integer;
begin
  if p_decision not in ('accept','decline') then raise exception 'Invalid decision'; end if;
  select * into p from projects where id=p_project for update;
  if not found or p.owner_id<>p_owner then raise exception 'Not project owner'; end if;
  select id into a from applications where project_id=p_project and user_id=p_student and status='pending' for update;
  if a is null then raise exception 'Pending application not found'; end if;
  if p_decision='accept' then
    select count(*) into n from project_members where project_id=p_project;
    if n >= p.capacity then raise exception 'Team is full'; end if;
    insert into project_members(project_id,user_id) values(p_project,p_student) on conflict do nothing;
  end if;
  update applications set status=case when p_decision='accept' then 'accepted' else 'declined' end where id=a;
  return true;
end;$$;

create or replace function public.decide_teamforge_invitation(p_project uuid,p_student uuid,p_decision text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare p public.projects%rowtype; i uuid; n integer;
begin
  if p_decision not in ('accept','decline') then raise exception 'Invalid decision'; end if;
  select * into p from projects where id=p_project for update;
  if not found then raise exception 'Project not found'; end if;
  select id into i from invites where project_id=p_project and user_id=p_student and status='pending' for update;
  if i is null then raise exception 'Pending invitation not found'; end if;
  if p_decision='accept' then
    select count(*) into n from project_members where project_id=p_project;
    if n >= p.capacity then raise exception 'Team is full'; end if;
    insert into project_members(project_id,user_id) values(p_project,p_student) on conflict do nothing;
    update applications set status='accepted' where project_id=p_project and user_id=p_student and status='pending';
  end if;
  update invites set status=case when p_decision='accept' then 'accepted' else 'declined' end where id=i;
  return true;
end;$$;

revoke all on function public.create_teamforge_project(uuid,text,text,text,text,text[],integer) from public,anon,authenticated;
revoke all on function public.decide_teamforge_application(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.decide_teamforge_invitation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_teamforge_project(uuid,text,text,text,text,text[],integer) to service_role;
grant execute on function public.decide_teamforge_application(uuid,uuid,uuid,text) to service_role;
grant execute on function public.decide_teamforge_invitation(uuid,uuid,text) to service_role;
