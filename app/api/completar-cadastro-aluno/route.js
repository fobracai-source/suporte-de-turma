// app/api/completar-cadastro-aluno/route.js
// Usado DEPOIS que o aluno já está logado — preenche os campos que
// ele tinha deixado como "Depois informo" antes. Nunca é obrigatório
// chamar essa rota; o aluno pode continuar adiando à vontade.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, MENSAGEM_PENDENTE } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ ok: false, erro: 'Sessão não encontrada.' }, { status: 401 });
  }

  const supabaseComoUsuario = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: erroUsuario } = await supabaseComoUsuario.auth.getUser();
  if (erroUsuario || !user) {
    return NextResponse.json({ ok: false, erro: 'Sessão inválida.' }, { status: 401 });
  }

  const { data: aluno } = await supabaseAdmin
    .from('alunos')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!aluno) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });
  }

  const { matricula, telefone, emailAluno, emailAluno2, emailFamilia, donoEmailFamilia, observacao } = await req.json();

  const atualizacao = { cadastro_atualizado_em: new Date().toISOString() };
  if (matricula !== undefined) atualizacao.matricula = matricula.trim() ? matricula.trim() : MENSAGEM_PENDENTE;
  if (telefone !== undefined) atualizacao.telefone = telefone.trim() ? telefone.trim() : MENSAGEM_PENDENTE;
  if (emailAluno !== undefined) atualizacao.email_aluno = emailAluno.trim() ? emailAluno.trim() : MENSAGEM_PENDENTE;
  if (emailFamilia !== undefined) atualizacao.email_familia = emailFamilia.trim() ? emailFamilia.trim() : MENSAGEM_PENDENTE;
  if (donoEmailFamilia !== undefined) atualizacao.dono_email_familia = donoEmailFamilia.trim() ? donoEmailFamilia.trim() : MENSAGEM_PENDENTE;
  if (observacao !== undefined) atualizacao.observacao = observacao.trim();

  const { error } = await supabaseAdmin.from('alunos').update(atualizacao).eq('id', aluno.id);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
