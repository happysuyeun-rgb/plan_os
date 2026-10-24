-- Synthetic data for a DISPOSABLE local Supabase instance only.
-- Run after Auth/JWT test_login created real local users and projects.
-- Every id is synthetic, deterministic and different from hosted Plan OS data.
grant select, insert, update, delete on public.project_comments,
  public.comment_reactions, public.comment_participant_status,
  public.user_notifications to authenticated;

-- document_versions stays append-only (migration 014 dropped the UPDATE
-- policy and revoked UPDATE). This seed must not resurrect the UPDATE grant:
-- combined with a drifted UPDATE policy it would let editors rewrite history.
grant select, insert on public.document_versions to authenticated;

insert into public.project_comments
 (id, project_id, document_id, user_id, author_name, body, anchor_type, status)
values
 ('33333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111111',
  (select id from public.documents where project_id='11111111-1111-1111-1111-111111111111' and type='prd'),
  :'owner_id'::uuid,'Owner','Original owner comment','none','open'),
 ('33333333-3333-3333-3333-333333333302',
  '11111111-1111-1111-1111-111111111111',
  (select id from public.documents where project_id='11111111-1111-1111-1111-111111111111' and type='prd'),
  :'editor_id'::uuid,'Editor','Original editor comment','none','open'),
 ('33333333-3333-3333-3333-333333333303',
  '11111111-1111-1111-1111-111111111111',
  (select id from public.documents where project_id='11111111-1111-1111-1111-111111111111' and type='prd'),
  :'viewer_id'::uuid,'Viewer','Original viewer comment','none','open'),
 ('33333333-3333-3333-3333-333333333304',
  '22222222-2222-2222-2222-222222222222',
  (select id from public.documents where project_id='22222222-2222-2222-2222-222222222222' and type='prd'),
  :'other_owner_id'::uuid,'Other owner','Other project comment','none','open');

insert into public.comment_reactions
  (id, comment_id, user_id, emoji)
values
 ('44444444-4444-4444-4444-444444444401','33333333-3333-3333-3333-333333333301',:'owner_id'::uuid,'👍'),
 ('44444444-4444-4444-4444-444444444402','33333333-3333-3333-3333-333333333301',:'editor_id'::uuid,'🔥');

insert into public.comment_participant_status(thread_root_id,user_id,status)
values
 ('33333333-3333-3333-3333-333333333301',:'owner_id'::uuid,'pending'),
 ('33333333-3333-3333-3333-333333333301',:'editor_id'::uuid,'pending'),
 ('33333333-3333-3333-3333-333333333301',:'viewer_id'::uuid,'pending');

insert into public.user_notifications(
 id,user_id,project_id,document_id,actor_id,actor_name,type,title,body,link_path
) values (
 '55555555-5555-5555-5555-555555555501',
 :'owner_id'::uuid,
 '11111111-1111-1111-1111-111111111111',
 (select id from public.documents where project_id='11111111-1111-1111-1111-111111111111' and type='prd'),
 :'editor_id'::uuid,
 'Editor','comment.reply','Comment replied','Content','/projects/test'
);

insert into public.document_versions
  (id,document_id,version_number,version_name,content)
values (
  '66666666-6666-6666-6666-666666666601',
  (select id from public.documents where project_id='11111111-1111-1111-1111-111111111111' and type='prd'),
  1,'Initial','Immutable first version'
);
