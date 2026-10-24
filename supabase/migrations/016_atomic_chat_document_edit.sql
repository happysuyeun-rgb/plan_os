-- 016 (renumbered from PR 012): C-10 atomic chat placeholder edit. DRAFT / DISPOSABLE LOCAL ONLY.
-- The legacy browser committed user chat INSERT before document UPDATE.
-- A failed UPDATE left an orphaned user message and an ambiguous retry.
-- Keep all three mutations and operation record in one authenticated RPC.
-- This is not an AI generator; it appends the existing placeholder note.

create table public.document_chat_operations (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  input_content text not null,
  user_message_id uuid not null references public.chat_messages(id) on delete cascade,
  assistant_message_id uuid not null references public.chat_messages(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index document_chat_operations_doc_idx
  on public.document_chat_operations(document_id, created_at desc);
alter table public.document_chat_operations enable row level security;
revoke all on public.document_chat_operations from public, anon, authenticated;

create or replace function public.commit_chat_document_edit(
  p_project_id uuid,
  p_document_id uuid,
  p_content text,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_user public.chat_messages%rowtype;
  v_assistant public.chat_messages%rowtype;
  v_operation public.document_chat_operations%rowtype;
begin
  if auth.role() is distinct from 'authenticated' or v_actor_id is null
     or p_project_id is null or p_document_id is null
     or p_operation_id is null or p_content is null
     or char_length(btrim(p_content)) = 0 or char_length(p_content) > 50000 then
    raise exception 'valid authenticated chat request required' using errcode = '42501';
  end if;

  -- Locks serialize concurrent RPCs per document. Content is read inside the
  -- transaction so a stale browser value cannot overwrite the server body.
  select * into v_doc from public.documents d
   where d.id = p_document_id and d.project_id = p_project_id for update;
  if not found then
    raise exception 'chat document not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.projects p
     where p.id = p_project_id and p.deleted_at is null
  ) or not public.can_edit_project_content(p_project_id) then
    raise exception 'not allowed to edit chat document' using errcode = '42501';
  end if;

  select * into v_operation from public.document_chat_operations o
   where o.id = p_operation_id;
  if found then
    if v_operation.project_id is distinct from p_project_id
       or v_operation.document_id is distinct from p_document_id
       or v_operation.actor_id is distinct from v_actor_id
       or v_operation.input_content is distinct from p_content then
      raise exception 'operation id belongs to a different chat request'
        using errcode = '42501';
    end if;
    select * into v_user from public.chat_messages m
     where m.id = v_operation.user_message_id;
    select * into v_assistant from public.chat_messages m
     where m.id = v_operation.assistant_message_id;
    -- Replay does NOT append again or revert later edits. Return the current
    -- locked document body together with the original immutable chat rows.
    return jsonb_build_object('updated_content', v_doc.content,
      'user_message', to_jsonb(v_user),
      'assistant_message', to_jsonb(v_assistant));
  end if;

  insert into public.chat_messages(project_id, document_id, role, content)
   values(p_project_id,p_document_id,'user',p_content)
   returning * into v_user;

  update public.documents set
    content = v_doc.content || E'\n\n<!-- AI 수정 반영 -->\n> ' || p_content
   where id = p_document_id
   returning * into v_doc;

  insert into public.chat_messages(project_id, document_id, role, content)
   values(p_project_id,p_document_id,'assistant',
     '요청하신 내용을 문서에 반영했습니다.')
   returning * into v_assistant;

  insert into public.document_chat_operations
    (id,project_id,document_id,actor_id,input_content,user_message_id,assistant_message_id)
    values(p_operation_id,p_project_id,p_document_id,v_actor_id,p_content,v_user.id,v_assistant.id);

  return jsonb_build_object('updated_content',v_doc.content,
    'user_message',to_jsonb(v_user),'assistant_message',to_jsonb(v_assistant));
end;
$$;
revoke all on function public.commit_chat_document_edit(uuid,uuid,text,uuid)
  from public, anon;
grant execute on function public.commit_chat_document_edit(uuid,uuid,text,uuid)
  to authenticated;
