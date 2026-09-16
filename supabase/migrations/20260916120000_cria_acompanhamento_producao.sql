-- Registro diário (append-only) de observações de produção por O.S.
-- Cada visita à área gera uma linha NOVA — nunca um UPDATE em cima da
-- anterior — pra permitir ver, no dia seguinte, exatamente como cada O.S.
-- estava antes. status_anterior/status_novo ficam null quando a visita foi
-- só uma observação, sem troca de status.
--
-- Mesma regra de quem pode mexer no kanban de Produção (canUpdateStages,
-- em use-auth.ts): admin/pcp/producao.
--
-- Idempotente: pode rodar de novo sem quebrar nada.

create table if not exists public.os_acompanhamento_producao (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references public.ordens_servico(id) on delete cascade,
  observacao text,
  status_anterior public.os_status,
  status_novo public.os_status,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);

create index if not exists idx_acompanhamento_os_id_criado_em
  on public.os_acompanhamento_producao (os_id, criado_em desc);

alter table public.os_acompanhamento_producao enable row level security;

drop policy if exists "acompanhamento select" on public.os_acompanhamento_producao;
create policy "acompanhamento select" on public.os_acompanhamento_producao
  for select
  to authenticated
  using (has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role]));

drop policy if exists "acompanhamento insert" on public.os_acompanhamento_producao;
create policy "acompanhamento insert" on public.os_acompanhamento_producao
  for insert
  to authenticated
  with check (
    has_any_role(auth.uid(), array['admin'::app_role, 'pcp'::app_role, 'producao'::app_role])
    and criado_por = auth.uid()
  );

-- Sem policy de update/delete de propósito: histórico é só de leitura depois
-- de criado (é o que garante "ver como tava antes" de verdade).
