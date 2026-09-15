// app/api/professor/adicionar-material/route.js
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return NextResponse.json({ ok: false, erro: 'Sessão não encontrada.' }, { status: 401 });

  const supabaseComoUsuario = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: erroUsuario } = await supabaseComoUsuario.auth.getUser();
  if (erroUsuario || !user) return NextResponse.json({ ok: false, erro: 'Sessão inválida.' }, { status: 401 });

  const { data: professor } = await supabaseAdmin.from('professores').select('id').eq('auth_user_id', user.id).maybeSingle();
  if (!professor) return NextResponse.json({ ok: false, erro: 'Essa conta não é de um professor.' }, { status: 403 });

  const { turmaId, disciplina, tipo, titulo, descricao, caminhoArquivo, urlExterna } = await req.json();

  if (!turmaId || !disciplina || !tipo || !titulo) {
    return NextResponse.json({ ok: false, erro: 'Preencha turma, disciplina, tipo e título.' }, { status: 400 });
  }
  if (tipo === 'arquivo' && !caminhoArquivo) {
    return NextResponse.json({ ok: false, erro: 'Nenhum arquivo enviado.' }, { status: 400 });
  }
  if ((tipo === 'link' || tipo === 'video') && !urlExterna) {
    return NextResponse.json({ ok: false, erro: 'Informe o link.' }, { status: 400 });
  }

  const { data: vinculoTurma } = await supabaseAdmin.from('professor_turmas').select('turma_id').eq('professor_id', professor.id).eq('turma_id', turmaId).maybeSingle();
  if (!vinculoTurma) return NextResponse.json({ ok: false, erro: 'Essa turma não está vinculada ao seu cadastro.' }, { status: 403 });

  const { data: vinculoDisciplina } = await supabaseAdmin.from('professor_disciplinas').select('disciplina').eq('professor_id', professor.id).eq('disciplina', disciplina).maybeSingle();
  if (!vinculoDisciplina) return NextResponse.json({ ok: false, erro: 'Essa disciplina não está vinculada ao seu cadastro.' }, { status: 403 });

  const { data, error } = await supabaseAdmin.from('materiais').insert({
    turma_id: turmaId, disciplina, professor_id: professor.id, tipo, titulo: titulo.trim(),
    descricao: descricao || null,
    caminho_arquivo: tipo === 'arquivo' ? caminhoArquivo : null,
    url_externa: tipo !== 'arquivo' ? urlExterna : null
  }).select().single();

  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, material: data });
}
