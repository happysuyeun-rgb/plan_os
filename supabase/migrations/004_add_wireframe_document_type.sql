-- wireframe document type (code already uses 6 doc types)

alter table public.documents drop constraint if exists documents_type_check;

alter table public.documents
  add constraint documents_type_check
  check (type in ('prd', 'ia', 'screen_list', 'policy', 'wireframe', 'cursor_prompt'));
