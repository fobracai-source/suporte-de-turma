// app/api/login/route.js
//
// Essa rota recebe { tipo, turmaId, nome, dataNascimento } vindos da
// tela de login, confere se bate com um aluno ou professor cadastrado,
// e devolve um token de sessão do Supabase — pronto pro navegador usar
// pra acessar o resto do site.
//
// IMPORTANTE: a senha de verdade nunca é "a data de nascimento" salva
// direto no Supabase Auth como texto puro — ela é a senha da conta
// interna, criada uma vez (veja scripts/criar-logins.js). Aqui só
// conferimos e fazemos o login de verdade.

import { supabaseAdmin, normalizarNome, dataParaSenha } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Cliente "normal" (sem privilégio de admin) — usado só pra fazer o
// login de verdade, exatamente como um usuário faria.
const supabasePublico = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  const { tipo, turmaId, nome, dataNascimento } = await req.json();

  if (!tipo || !nome || !dataNascimento) {
    return NextResponse.json({ ok: false, erro: 'Preencha todos os campos.' }, { status: 400 });
  }

  // Confere se a data digitada está no formato certo (DD/MM/AAAA)
  const bateFormato = /^\d{2}\/\d{2}\/\d{4}$/.test(dataNascimento);
  if (!bateFormato) {
    return NextResponse.json({ ok: false, erro: 'Digite a data de nascimento no formato DD/MM/AAAA.' }, { status: 400 });
  }

  let registro = null;
  let emailInterno = null;

  if (tipo === 'aluno') {
    if (!turmaId) {
      return NextResponse.json({ ok: false, erro: 'Selecione a turma.' }, { status: 400 });
    }
    const { data } = await supabaseAdmin
      .from('alunos')
      .select('id, auth_user_id, data_nascimento')
      .eq('turma_id', turmaId)
      .eq('nome', nome)
      .maybeSingle();
    registro = data;
    if (registro) emailInterno = `aluno-${registro.id}@interno.escola.app`;
  } else if (tipo === 'professor') {
    // Professor: comparação "tolerante" (sem acento, maiúscula ou
    // pontuação) — e também aceita o e-mail como identificador.
    const nomeDigitadoNormalizado = normalizarNome(nome);

    const { data: todosProfessores } = await supabaseAdmin
      .from('professores')
      .select('id, nome, email, auth_user_id, data_nascimento');

    registro = (todosProfessores || []).find((p) => {
      return normalizarNome(p.nome) === nomeDigitadoNormalizado
        || (p.email && normalizarNome(p.email) === nomeDigitadoNormalizado);
    });
    if (registro) emailInterno = `professor-${registro.id}@interno.escola.app`;
  } else {
    return NextResponse.json({ ok: false, erro: 'Tipo de login inválido.' }, { status: 400 });
  }

  if (!registro || !registro.auth_user_id) {
    // Mensagem genérica de propósito — não diz se foi o nome ou a data
    // que errou, pra não dar pista de adivinhação.
    return NextResponse.json({ ok: false, erro: 'Nome ou data de nascimento não conferem.' }, { status: 401 });
  }

  const { data: sessao, error } = await supabasePublico.auth.signInWithPassword({
    email: emailInterno,
    password: dataNascimento // formato DD/MM/AAAA, exatamente como foi digitado
  });

  if (error) {
    return NextResponse.json({ ok: false, erro: 'Nome ou data de nascimento não conferem.' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    access_token: sessao.session.access_token,
    refresh_token: sessao.session.refresh_token,
    tipo: tipo
  });
}
