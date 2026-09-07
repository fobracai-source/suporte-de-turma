export const dynamic = 'force-dynamic';
// app/api/colegas-da-turma/route.js
// Lista os colegas da MESMA turma de quem está pedindo — só nome e id,
// NUNCA data de nascimento, telefone ou e-mail (a data de nascimento é
// literalmente a senha de login de cada um, então não pode vazar aqui
// de jeito nenhum). Por isso essa rota existe: pra nunca precisarmos
// dar permissão de RLS pro aluno ler a linha completa de outro aluno.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET(req) {
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
    .select('id, turma_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!aluno) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });
  }

  const { data: colegas, error } = await supabaseAdmin
    .from('alunos')
    .select('id, nome')
    .eq('turma_id', aluno.turma_id)
    .order('nome');

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, colegas: colegas || [], meuId: aluno.id });
}
