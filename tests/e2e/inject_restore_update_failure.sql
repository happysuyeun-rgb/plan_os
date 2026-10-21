-- Local synthetic test ONLY; never deploy to hosted Supabase.
-- Raise during the SECOND part (document UPDATE) of atomic version restore.
-- The document version INSERT made earlier in the same server RPC must roll
-- back together with the UPDATE and operation log when this trigger fails.
create or replace function public.qa_reject_document_restore()
returns trigger language plpgsql as $$
begin
  if old.content is distinct from new.content
     and position('B05-CURRENT-MUST-BE-PRESERVED' in new.content) > 0 then
    raise exception 'SYNTHETIC_RESTORE_UPDATE_FAILURE'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger qa_reject_document_restore
before update on public.documents
for each row execute function public.qa_reject_document_restore();
