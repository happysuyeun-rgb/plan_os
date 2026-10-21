-- Synthetic fault injection for disposable LOCAL Supabase CI only.
-- Raising inside the documents UPDATE of commit_chat_document_edit must
-- roll back the earlier user chat message INSERT in the same transaction.
create or replace function public.qa_fail_chat_document_update()
returns trigger language plpgsql as $$
begin
  if old.content is distinct from new.content
     and position('C10-ATOMIC-FAULT' in new.content)>0 then
    raise exception 'C10_LOCAL_SYNTHETIC_UPDATE_FAULT';
  end if;
  return new;
end;
$$;
create trigger qa_fail_chat_document_update
before update on public.documents
for each row execute function public.qa_fail_chat_document_update();
