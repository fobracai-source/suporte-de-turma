// app/api/login/route.js
//
// Essa rota recebe { tipo, turmaId, nome, senha } vindos da tela de
// login, confere se bate com um aluno ou professor já cadastrado (com
// conta já criada), e devolve um token de sessão do Supabase.
//
// A "senha" aqui é literalmente o que a pessoa digitou — nunca
// validamos formato específico aqui, porque quem definiu o valor
// exato foi a rota que criou a conta (criar-login-aluno, ou o script
// de professor), sempre seguindo a regra: data de nascimento no
// formato DDMMAAAA, duplicada.

import { supabaseAdmin, normalizarNome } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabasePublico = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  const { tipo, turmaId, nome, senha } = await req.json();

  if (!tipo || !nome || !senha) {
    return NextResponse.json({ ok: false, erro: 'Preencha todos os campos.' }, { status: 400 });
  }

  let registro = null;
  let emailInterno = null;

  if (tipo === 'aluno') {
    if (!turmaId) {
      return NextResponse.json({ ok: false, erro: 'Selecione a turma.' }, { status: 400 });
    }
    const { data } = await supabaseAdmin
      .from('alunos')
      .select('id, auth_user_id')
      .eq('turma_id', turmaId)
      .eq('nome', nome)
      .maybeSingle();
    registro = data;
    if (registro) emailInterno = `aluno-${registro.id}@interno.escola.app`;
  } else if (tipo === 'professor') {
    const nomeDigitadoNormalizado = normalizarNome(nome);

    const { data: todosProfessores } = await supabaseAdmin
      .from('professores')
      .select('id, nome, email, auth_user_id');

    registro = (todosProfessores || []).find((p) => {
      return normalizarNome(p.nome) === nomeDigitadoNormalizado
        || (p.email && normalizarNome(p.email) === nomeDigitadoNormalizado);
    });
    if (registro) emailInterno = `professor-${registro.id}@interno.escola.app`;
  } else {
    return NextResponse.json({ ok: false, erro: 'Tipo de login inválido.' }, { status: 400 });
  }

  if (!registro || !registro.auth_user_id) {
    return NextResponse.json({ ok: false, erro: 'Nome ou senha não conferem.' }, { status: 401 });
  }

  const { data: sessao, error } = await supabasePublico.auth.signInWithPassword({
    email: emailInterno,
    password: senha
  });

  if (error) {
    return NextResponse.json({ ok: false, erro: 'Nome ou senha não conferem.' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    access_token: sessao.session.access_token,
    refresh_token: sessao.session.refresh_token,
    tipo: tipo
  });
}
