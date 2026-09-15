// app/api/agenda/listar/route.js
// Junta os eventos cadastrados (prova, trabalho, evento escolar) com
// os prazos de entrega das atividades — tudo numa lista só, ordenada
// por data. Funciona tanto pra aluno quanto pra professor.
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

  const { data: aluno } = await supabaseAdmin.from('alunos').select('id, turma_id').eq('auth_user_id', user.id).maybeSingle();
  const { data: professor } = await supabaseAdmin.from('professores').select('id').eq('auth_user_id', user.id).maybeSingle();

  let turmaIds = [];
  if (aluno) {
    turmaIds = [aluno.turma_id];
  } else if (professor) {
    const { data: vinculos } = await supabaseAdmin.from('professor_turmas').select('turma_id').eq('professor_id', professor.id);
    turmaIds = (vinculos || []).map((v) => v.turma_id);
  } else {
    return NextResponse.json({ ok: false, erro: 'Conta não reconhecida.' }, { status: 403 });
  }

  // Eventos cadastrados (prova, trabalho, evento) — inclui os gerais
  // (turma_id null) e os das turmas certas
  const { data: eventos } = await supabaseAdmin
    .from('eventos_agenda')
    .select('id, tipo, titulo, descricao, disciplina, data_evento, turma_id, turmas(nome)')
    .or(`turma_id.is.null,turma_id.in.(${turmaIds.join(',') || '0'})`)
    .order('data_evento');

  // Prazos de entrega de atividade
  let atividadesQuery = supabaseAdmin
    .from('atividades')
    .select('id, disciplina, tema, data_final, atividade_turmas!inner(turma_id)')
    .not('data_final', 'is', null)
    .in('atividade_turmas.turma_id', turmaIds);

  const { data: atividades } = await atividadesQuery;

  const listaUnificada = [
    ...(eventos || []).map((e) => ({
      id: `evento-${e.id}`,
      tipo: e.tipo,
      titulo: e.titulo,
      descricao: e.descricao,
      disciplina: e.disciplina,
      data: e.data_evento,
      turmaNome: e.turmas?.nome || 'Todas as turmas'
    })),
    ...(atividades || []).map((a) => ({
      id: `atividade-${a.id}`,
      tipo: 'entrega',
      titulo: a.tema,
      descricao: null,
      disciplina: a.disciplina,
      data: a.data_final,
      turmaNome: null
    }))
  ].sort((a, b) => new Date(a.data) - new Date(b.data));

  return NextResponse.json({ ok: true, agenda: listaUnificada });
}
