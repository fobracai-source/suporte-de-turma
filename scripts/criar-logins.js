// scripts/criar-logins.js
//
// Usado pra criar logins de PROFESSOR (o aluno não precisa mais disso —
// ele cria a própria conta sozinho, na hora do primeiro acesso).
//
// Como rodar: node scripts/criar-logins.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Mesma regra de senha usada em todo o sistema: DDMMAAAA duplicado.
function calcularSenhaDaData(dataISO) {
  if (!dataISO) return null;
  const partes = String(dataISO).split('-');
  if (partes.length !== 3) return null;
  const [ano, mes, dia] = partes;
  const ddmmaaaa = dia + mes + ano;
  return ddmmaaaa + ddmmaaaa;
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
    const senha = calcularSenhaDaData(professor.data_nascimento);

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
  console.log('=== Criando logins de professores ===');
  await criarLoginsDeProfessores();
  console.log('\nPronto! (Alunos não precisam mais disso — eles criam a própria conta no primeiro acesso.)');
})();
