# Suporte de Turma — Migração pra Supabase + Vercel + GitHub

## O que está pronto nesta Fase 1

- Banco de dados completo (todas as tabelas: alunos, professores, turmas,
  atividades, entregas, ocorrências, denúncias, defesa).
- Segurança por linha (RLS): cada aluno só vê a própria turma; cada
  professor só vê as próprias turmas/disciplinas.
- Sistema de login: nome (lista) + data de nascimento (senha DD/MM/AAAA),
  igual pra aluno e professor. Você também pode entrar com seu e-mail.
- Script que cria a conta de login de todo mundo que já está cadastrado.

## O que AINDA NÃO está nesta fase (vem nas próximas)

- As telas de verdade (responder atividade, ver nota, ocorrências,
  denúncia, GENERAL, etc.) — hoje só existe a "cozinha" (banco + login),
  ainda não a "sala de jantar" (as páginas que aparecem pro usuário).

---

## PASSO A PASSO

### 1. Criar o projeto no Supabase

1. Acesse **supabase.com** → crie uma conta (pode ser com seu e-mail
   institucional) → **New Project**.
2. Escolha um nome, uma senha forte pro banco (guarde ela num lugar
   seguro), e a região mais próxima (São Paulo, se disponível).
3. Espere o projeto terminar de criar (leva 1-2 minutos).

### 2. Rodar o schema do banco

1. No painel do Supabase, vá em **SQL Editor** (menu lateral) → **New
   query**.
2. Cole todo o conteúdo do arquivo `sql/001_schema_inicial.sql` (que eu
   te mandei) → **Run**.
3. Confira em **Table Editor** se todas as tabelas apareceram (turmas,
   alunos, professores, atividades, entregas, ocorrencias, etc.).

### 3. Pegar suas chaves de acesso

1. No painel do Supabase → **Project Settings** (ícone de engrenagem) →
   **API**.
2. Copie 3 valores: **Project URL**, a chave **anon public**, e a chave
   **service_role** (essa última é secreta — não compartilhe).

### 4. Criar o repositório no GitHub

1. Acesse **github.com** → **New repository** → nome, por exemplo,
   `suporte-de-turma` → **Public** ou **Private** (tanto faz) → **Create**.
2. Baixe todos os arquivos que eu te mandei nesta pasta e suba pro
   repositório (pelo site mesmo, arrastando os arquivos, ou usando
   `git` se preferir).

### 5. Preencher as variáveis de ambiente

1. Copie o arquivo `.env.local.exemplo` → renomeie a cópia pra
   `.env.local`.
2. Cole os 3 valores que você pegou no passo 3.
3. **Esse arquivo NUNCA deve ir pro GitHub** (ele tem a chave secreta) —
   crie também um arquivo `.gitignore` com a linha `.env.local` dentro,
   se ainda não tiver.

### 6. Instalar e testar localmente (opcional, mas recomendado)

No terminal, dentro da pasta do projeto:
```
npm install
npm run dev
```
Abre `http://localhost:3000` no navegador pra conferir se está tudo
funcionando antes de publicar de verdade.

### 7. Cadastrar alunos e professores com data de nascimento

Antes de criar os logins, o banco precisa ter os alunos e professores
cadastrados (com `data_nascimento` preenchida). Por enquanto, o jeito
mais rápido é fazer isso direto no **Table Editor** do Supabase (nas
próximas fases eu construo uma tela bonita pra isso, como tínhamos no
Apps Script).

### 8. Criar os logins de todo mundo

Depois de cadastrar alunos/professores com a data de nascimento:
```
npm run criar-logins
```
Isso cria a conta de acesso de cada um automaticamente.

### 9. Publicar na Vercel

1. Acesse **vercel.com** → **Add New → Project** → conecte sua conta do
   GitHub → escolha o repositório que você criou.
2. Em **Environment Variables**, cole as mesmas 3 variáveis do passo 5.
3. **Deploy**.
4. Pronto — a Vercel te dá um link público (tipo
   `suporte-de-turma.vercel.app`), e toda vez que você atualizar o
   código no GitHub, o site atualiza sozinho.

---

## Próxima fase

Assim que você confirmar que os passos acima funcionaram (banco criado,
login funcionando), sigo pra Fase 2: a tela do aluno pra responder
atividades e ver notas.
