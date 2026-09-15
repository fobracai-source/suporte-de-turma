// app/api/mural/editar-mensagem/route.js
// Edita uma mensagem do mural/chat — só quem ESCREVEU a mensagem pode
// editá-la (ninguém edita mensagem de outra pessoa, só apaga, se for
// professor moderando).
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

  const { mensagemId, novoTexto } = await req.json();
  if (!mensagemId || !novoTexto || !novoTexto.trim()) {
    return NextResponse.json({ ok: false, erro: 'Escreva o novo texto da mensagem.' }, { status: 400 });
  }

  const { data: professor } = await supabaseAdmin.from('professores').select('id').eq('auth_user_id', user.id).maybeSingle();
  const { data: aluno } = await supabaseAdmin.from('alunos').select('id').eq('auth_user_id', user.id).maybeSingle();

  const { data: mensagem } = await supabaseAdmin.from('mural_mensagens').select('professor_id, aluno_id').eq('id', mensagemId).maybeSingle();
  if (!mensagem) {
    return NextResponse.json({ ok: false, erro: 'Mensagem não encontrada.' }, { status: 404 });
  }

  const ehDono = (professor && mensagem.professor_id === professor.id) || (aluno && mensagem.aluno_id === aluno.id);
  if (!ehDono) {
    return NextResponse.json({ ok: false, erro: 'Você só pode editar as próprias mensagens.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('mural_mensagens').update({ mensagem: novoTexto.trim() }).eq('id', mensagemId);
  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
