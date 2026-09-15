// app/api/mural/excluir-mensagem/route.js
// Exclui uma mensagem do mural/chat. Permite: o próprio dono excluir a
// própria mensagem, OU um professor da turma excluir qualquer
// mensagem (moderação — inclusive de aluno).
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
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

  const { mensagemId } = await req.json();
  if (!mensagemId) {
    return NextResponse.json({ ok: false, erro: 'Mensagem não informada.' }, { status: 400 });
  }

  const { data: professor } = await supabaseAdmin.from('professores').select('id').eq('auth_user_id', user.id).maybeSingle();
  const { data: aluno } = await supabaseAdmin.from('alunos').select('id').eq('auth_user_id', user.id).maybeSingle();

  const { data: mensagem } = await supabaseAdmin.from('mural_mensagens').select('turma_id, professor_id, aluno_id').eq('id', mensagemId).maybeSingle();
  if (!mensagem) {
    return NextResponse.json({ ok: false, erro: 'Mensagem não encontrada.' }, { status: 404 });
  }

  const ehDono = (professor && mensagem.professor_id === professor.id) || (aluno && mensagem.aluno_id === aluno.id);

  let ehProfessorDaTurma = false;
  if (professor && !ehDono) {
    const { data: vinculo } = await supabaseAdmin.from('professor_turmas').select('turma_id').eq('professor_id', professor.id).eq('turma_id', mensagem.turma_id).maybeSingle();
    ehProfessorDaTurma = !!vinculo;
  }

  if (!ehDono && !ehProfessorDaTurma) {
    return NextResponse.json({ ok: false, erro: 'Você não tem permissão pra excluir essa mensagem.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('mural_mensagens').delete().eq('id', mensagemId);
  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
