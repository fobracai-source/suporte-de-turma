-- ============================================================================
-- SCHEMA DO SISTEMA "SUPORTE DE TURMA" — SUPABASE (POSTGRES)
-- ============================================================================
-- Como rodar: Supabase → seu projeto → SQL Editor → New query → cole tudo
-- este arquivo → Run. É seguro rodar do zero num projeto novo.
-- ============================================================================

-- ── EXTENSÕES NECESSÁRIAS ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── TURMAS ───────────────────────────────────────────────────────────────
create table turmas (
  id serial primary key,
  nome text not null unique
);

-- ── ALUNOS ───────────────────────────────────────────────────────────────
-- auth_user_id liga esse aluno à conta de login dele (criada no Supabase Auth)
create table alunos (
  id serial primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nome text not null,
  turma_id integer not null references turmas(id),
  matricula text,
  telefone text,
  data_nascimento date,
  email_aluno text,
  email_familia text,
  dono_email_familia text,
  observacao text,
  cadastro_atualizado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (nome, turma_id)
);
create index idx_alunos_turma on alunos(turma_id);

-- ── PROFESSORES ──────────────────────────────────────────────────────────
create table professores (
  id serial primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nome text not null unique,
  email text,
  data_nascimento date,
  criado_em timestamptz not null default now()
);

-- Um professor pode dar mais de uma disciplina
create table professor_disciplinas (
  professor_id integer not null references professores(id) on delete cascade,
  disciplina text not null,
  primary key (professor_id, disciplina)
);

-- Um professor pode dar aula em mais de uma turma
create table professor_turmas (
  professor_id integer not null references professores(id) on delete cascade,
  turma_id integer not null references turmas(id) on delete cascade,
  primary key (professor_id, turma_id)
);

-- ── ATIVIDADES (equivalente à antiga aba "Temas_prazos_turmas") ─────────
create table atividades (
  id serial primary key,               -- equivalente ao antigo CODIGO_GERAL
  disciplina text not null,
  professor_id integer references professores(id),
  aula_numero integer not null,
  tema text not null,
  data_inicial date,
  data_final date,
  valor_nota numeric(6,2) not null default 0,
  gabarito jsonb not null default '[]',  -- array com até 20 letras, ex: ["A","B","C"]
  observacao text,
  criado_em timestamptz not null default now()
);
create index idx_atividades_disciplina on atividades(disciplina);
create index idx_atividades_professor on atividades(professor_id);

-- Uma atividade pode valer pra várias turmas ao mesmo tempo
create table atividade_turmas (
  atividade_id integer not null references atividades(id) on delete cascade,
  turma_id integer not null references turmas(id) on delete cascade,
  primary key (atividade_id, turma_id)
);

-- ── ENTREGAS (respostas dos alunos) ──────────────────────────────────────
create table entregas (
  id serial primary key,
  atividade_id integer not null references atividades(id),
  aluno_id integer not null references alunos(id),
  respostas jsonb not null default '[]',   -- array de letras, na ordem das questões
  arquivos jsonb not null default '[]',    -- array de { nome, url }
  avaliacao smallint,                       -- corações de 1 a 5
  telefone text,
  observacoes text,
  nota_calculada numeric(6,2),
  criado_em timestamptz not null default now()
);
create index idx_entregas_aluno on entregas(aluno_id);
create index idx_entregas_atividade on entregas(atividade_id);

-- ── OCORRÊNCIAS ──────────────────────────────────────────────────────────
create table ocorrencias (
  id serial primary key,
  turma_id integer not null references turmas(id),
  aluno_id integer not null references alunos(id),
  tipo text,
  motivos_atividades jsonb not null default '[]',
  motivos_disciplina jsonb not null default '[]',
  detalhamento text,
  origem text not null default 'MANUAL',   -- MANUAL | AUTOMATICA | DENUNCIA
  professor_nome text,                     -- pode ser "DENÚNCIA ANÔNIMA..." ou "SISTEMA..."
  anexos jsonb not null default '[]',
  codigo_tema_ref integer references atividades(id),
  codigo_lote text,
  email_digest_enviado_em timestamptz,
  enviado_familia_em timestamptz,
  criado_em timestamptz not null default now()
);
create index idx_ocorrencias_aluno on ocorrencias(aluno_id);
create index idx_ocorrencias_turma on ocorrencias(turma_id);

-- ── DENÚNCIAS (registro completo, com o reclamante) ──────────────────────
-- Fica separada de "ocorrencias" de propósito: só essa tabela guarda quem
-- denunciou, e nenhuma política de acesso (RLS) permite professor/aluno
-- lerem essa tabela — só o administrador do banco.
create table denuncias (
  id serial primary key,
  turma_id integer not null references turmas(id),
  reclamante text not null,
  aluno_denunciado_id integer not null references alunos(id),
  disciplina_ou_todas text not null,
  denuncia text not null,
  anexos jsonb not null default '[]',
  ocorrencia_id integer references ocorrencias(id),
  criado_em timestamptz not null default now()
);

-- ── DEFESA DE OCORRÊNCIA ─────────────────────────────────────────────────
create table defesa_ocorrencias (
  id serial primary key,
  codigo_lote text not null,
  aluno_id integer not null references alunos(id),
  turma_id integer not null references turmas(id),
  ocorrencia_id integer references ocorrencias(id),
  justificativa text,
  nao_quis_justificar boolean not null default false,
  anexos jsonb not null default '[]',
  criado_em timestamptz not null default now()
);

-- ============================================================================
-- SEGURANÇA (RLS) — cada um só vê o que pode ver
-- ============================================================================
alter table alunos enable row level security;
alter table professores enable row level security;
alter table atividades enable row level security;
alter table atividade_turmas enable row level security;
alter table entregas enable row level security;
alter table ocorrencias enable row level security;
alter table turmas enable row level security;

-- Função auxiliar: pega o id do aluno logado (null se quem está logado
-- não for um aluno)
create or replace function aluno_logado_id() returns integer as $$
  select id from alunos where auth_user_id = auth.uid();
$$ language sql stable;

-- Função auxiliar: pega o id do professor logado
create or replace function professor_logado_id() returns integer as $$
  select id from professores where auth_user_id = auth.uid();
$$ language sql stable;

-- Turmas: todo mundo logado pode ver a lista de turmas (é só a lista de
-- nomes, não tem informação sensível)
create policy "turmas visiveis a todos os logados" on turmas
  for select using (auth.role() = 'authenticated');

-- Alunos: um aluno só vê a própria linha; um professor vê os alunos das
-- turmas dele
create policy "aluno ve so a propria linha" on alunos
  for select using (
    auth_user_id = auth.uid()
    or turma_id in (select turma_id from professor_turmas where professor_id = professor_logado_id())
  );
create policy "aluno atualiza so a propria linha" on alunos
  for update using (auth_user_id = auth.uid());

-- Professores: todo mundo logado pode ver nomes/disciplinas (pra montar
-- os dropdowns de disciplina/professor)
create policy "professores visiveis a todos os logados" on professores
  for select using (auth.role() = 'authenticated');

-- Atividades: aluno só vê atividades da própria turma; professor só vê
-- (e só edita) as próprias atividades
create policy "atividades visiveis por turma" on atividades
  for select using (
    id in (
      select atividade_id from atividade_turmas
      where turma_id = (select turma_id from alunos where auth_user_id = auth.uid())
         or turma_id in (select turma_id from professor_turmas where professor_id = professor_logado_id())
    )
  );
create policy "professor edita as proprias atividades" on atividades
  for all using (professor_id = professor_logado_id());

create policy "atividade_turmas visivel junto" on atividade_turmas
  for select using (true);

-- Entregas: aluno só vê (e só cria) as próprias entregas; professor vê as
-- entregas das atividades dele
create policy "aluno ve e cria as proprias entregas" on entregas
  for select using (aluno_id = aluno_logado_id());
create policy "aluno insere suas entregas" on entregas
  for insert with check (aluno_id = aluno_logado_id());
create policy "professor ve entregas das proprias atividades" on entregas
  for select using (
    atividade_id in (select id from atividades where professor_id = professor_logado_id())
  );

-- Ocorrências: aluno só vê as próprias; professor vê as das turmas dele
create policy "aluno ve as proprias ocorrencias" on ocorrencias
  for select using (aluno_id = aluno_logado_id());
create policy "professor ve ocorrencias das proprias turmas" on ocorrencias
  for select using (
    turma_id in (select turma_id from professor_turmas where professor_id = professor_logado_id())
  );
