-- 프로젝트별 AI 채팅 패널 제목

alter table public.projects
  add column if not exists chat_title text not null default '';

update public.projects
set chat_title = left(
  coalesce(
    nullif(trim(description), ''),
    nullif(trim(title), ''),
    'AI 채팅'
  ),
  40
)
where chat_title = '';
