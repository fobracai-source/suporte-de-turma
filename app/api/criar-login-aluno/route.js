// app/api/criar-login-aluno/route.js
// Cria a conta de acesso do aluno na hora do PRIMEIRO acesso dele —
// data de nascimento é obrigatória (vira a senha), o resto é opcional
// (campos deixados em branco viram "Depois informo", e continuam
// sendo perguntados nos próximos acessos, sem nunca travar o login).
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, calcularSenhaDaData, MENSAGEM_PENDENTE } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

const supabasePublico = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  const { turmaId, nome, dataNascimento, matricula, telefone, emailAluno, emailFamilia, donoEmailFamilia, observacao } = await req.json();

  if (!turmaId || !nome) {
    return NextResponse.json({ ok: false, erro: 'Dados incompletos.' }, { status: 400 });
  }
  if (!dataNascimento) {
    return NextResponse.json({ ok: false, erro: 'A data de nascimento é obrigatória.' }, { status: 400 });
  }

  const { data: aluno } = await supabaseAdmin
    .from('alunos')
    .select('id, auth_user_id')
    .eq('turma_id', turmaId)
    .eq('nome', nome)
    .maybeSingle();

  if (!aluno) {
    return NextResponse.json({ ok: false, erro: 'Aluno não encontrado.' }, { status: 404 });
  }
  if (aluno.auth_user_id) {
    return NextResponse.json({ ok: false, erro: 'Esse aluno já tem uma conta criada. Use a tela de login normal.' }, { status: 409 });
  }

  const senha = calcularSenhaDaData(dataNascimento);
  if (!senha) {
    return NextResponse.json({ ok: false, erro: 'Data de nascimento inválida.' }, { status: 400 });
  }

  const emailInterno = `aluno-${aluno.id}@interno.escola.app`;

  const { data: novoUsuario, error: erroCriacao } = await supabaseAdmin.auth.admin.createUser({
    email: emailInterno,
    password: senha,
    email_confirm: true
  });

  if (erroCriacao) {
    return NextResponse.json({ ok: false, erro: 'Não consegui criar sua conta: ' + erroCriacao.message }, { status: 500 });
  }

  const { error: erroAtualizar } = await supabaseAdmin
    .from('alunos')
    .update({
      auth_user_id: novoUsuario.user.id,
      data_nascimento: dataNascimento,
      matricula: matricula && matricula.trim() ? matricula.trim() : MENSAGEM_PENDENTE,
      telefone: telefone && telefone.trim() ? telefone.trim() : MENSAGEM_PENDENTE,
      email_aluno: emailAluno && emailAluno.trim() ? emailAluno.trim() : MENSAGEM_PENDENTE,
      email_familia: emailFamilia && emailFamilia.trim() ? emailFamilia.trim() : MENSAGEM_PENDENTE,
      dono_email_familia: donoEmailFamilia && donoEmailFamilia.trim() ? donoEmailFamilia.trim() : MENSAGEM_PENDENTE,
      observacao: observacao && observacao.trim() ? observacao.trim() : '',
      cadastro_atualizado_em: new Date().toISOString()
    })
    .eq('id', aluno.id);

  if (erroAtualizar) {
    return NextResponse.json({ ok: false, erro: 'Conta criada, mas houve erro ao salvar os dados: ' + erroAtualizar.message }, { status: 500 });
  }

  // Já loga o aluno na hora, sem precisar digitar a senha de novo
  const { data: sessao, error: erroLogin } = await supabasePublico.auth.signInWithPassword({
    email: emailInterno,
    password: senha
  });

  if (erroLogin) {
    return NextResponse.json({ ok: false, erro: 'Conta criada! Mas não consegui entrar automaticamente — tente fazer login normalmente.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    access_token: sessao.session.access_token,
    refresh_token: sessao.session.refresh_token
  });
}
