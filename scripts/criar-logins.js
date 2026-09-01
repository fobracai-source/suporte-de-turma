// scripts/criar-logins.js
//
// Roda UMA VEZ (e sempre que cadastrar alunos/professores novos em
// lote): cria a conta de login de cada um no Supabase Auth, com a
// senha sendo a data de nascimento no formato DD/MM/AAAA.
//
// Como rodar (no terminal, dentro da pasta do projeto):
//   node scripts/criar-logins.js
//
// Precisa que o arquivo .env.local já esteja preenchido (veja
// .env.local.exemplo) — principalmente a SUPABASE_SERVICE_ROLE_KEY.

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function dataParaSenha(dataISO) {
  if (!dataISO) return null;
  var partes = String(dataISO).split('-');
  if (partes.length !== 3) return null;
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

async function criarLoginsDeAlunos() {
  const { data: alunos, error } = await supabaseAdmin
    .from('alunos')
    .select('id, nome, data_nascimento, auth_user_id')
    .is('auth_user_id', null); // só quem ainda não tem login

  if (error) { console.error('Erro ao buscar alunos:', error.message); return; }
  console.log(`Encontrei ${alunos.length} aluno(s) sem login ainda.`);

  for (const aluno of alunos) {
    if (!aluno.data_nascimento) {
      console.log(`⚠️  Pulei "${aluno.nome}" — não tem data de nascimento cadastrada.`);
      continue;
    }
    const email = `aluno-${aluno.id}@interno.escola.app`;
    const senha = dataParaSenha(aluno.data_nascimento);

    const { data: novoUsuario, error: erroCriacao } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true // não manda e-mail de confirmação nenhum — é uma conta interna
    });

    if (erroCriacao) {
      console.log(`❌ Erro ao criar login de "${aluno.nome}": ${erroCriacao.message}`);
      continue;
    }

    await supabaseAdmin.from('alunos').update({ auth_user_id: novoUsuario.user.id }).eq('id', aluno.id);
    console.log(`✅ Login criado: ${aluno.nome}`);
  }
}

async function criarLoginsDeProfessores() {
  const { data: professores, error } = await supabaseAdmin
    .from('professores')
    .select('id, nome, data_nascimento, auth_user_id')
    .is('auth_user_id', null);

  if (error) { console.error('Erro ao buscar professores:', error.message); return; }
  console.log(`Encontrei ${professores.length} professor(a) sem login ainda.`);

  for (const professor of professores) {
    if (!professor.data_nascimento) {
      console.log(`⚠️  Pulei "${professor.nome}" — não tem data de nascimento cadastrada.`);
      continue;
    }
    const email = `professor-${professor.id}@interno.escola.app`;
    const senha = dataParaSenha(professor.data_nascimento);

    const { data: novoUsuario, error: erroCriacao } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true
    });

    if (erroCriacao) {
      console.log(`❌ Erro ao criar login de "${professor.nome}": ${erroCriacao.message}`);
      continue;
    }

    await supabaseAdmin.from('professores').update({ auth_user_id: novoUsuario.user.id }).eq('id', professor.id);
    console.log(`✅ Login criado: ${professor.nome}`);
  }
}

(async function main() {
  console.log('=== Criando logins de alunos ===');
  await criarLoginsDeAlunos();
  console.log('\n=== Criando logins de professores ===');
  await criarLoginsDeProfessores();
  console.log('\nPronto!');
})();
