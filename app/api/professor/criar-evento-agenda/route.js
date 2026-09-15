// app/api/professor/criar-evento-agenda/route.js
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

  const { turmaId, tipo, titulo, descricao, disciplina, dataEvento } = await req.json();

  if (!turmaId || !titulo || !dataEvento) {
    return NextResponse.json({ ok: false, erro: 'Preencha turma, título e data.' }, { status: 400 });
  }
  if (tipo !== 'prova' && tipo !== 'trabalho') {
    return NextResponse.json({ ok: false, erro: 'Tipo inválido.' }, { status: 400 });
  }

  const { data: vinculo } = await supabaseAdmin.from('professor_turmas').select('turma_id').eq('professor_id', professor.id).eq('turma_id', turmaId).maybeSingle();
  if (!vinculo) {
    return NextResponse.json({ ok: false, erro: 'Essa turma não está vinculada ao seu cadastro.' }, { status: 403 });
  }

  if (disciplina) {
    const { data: disciplinaDele } = await supabaseAdmin.from('professor_disciplinas').select('disciplina').eq('professor_id', professor.id).eq('disciplina', disciplina).maybeSingle();
    if (!disciplinaDele) {
      return NextResponse.json({ ok: false, erro: 'Essa disciplina não está vinculada ao seu cadastro.' }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin.from('eventos_agenda').insert({
    turma_id: turmaId, tipo, titulo: titulo.trim(), descricao: descricao || null,
    disciplina: disciplina || null, data_evento: dataEvento, professor_id: professor.id
  }).select().single();

  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, evento: data });
}
