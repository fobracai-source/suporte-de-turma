// app/api/ocorrencias/route.js
// Registra uma ocorrência. Confere, no servidor, que quem está
// mandando é mesmo um professor, e que a turma escolhida é dele —
// mesmo que alguém tente "forçar" outro valor mexendo na requisição.
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

  const { data: professor } = await supabaseAdmin
    .from('professores')
    .select('id, nome')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!professor) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um professor.' }, { status: 403 });
  }

  const { turmaId, alunoId, motivosAtividades, motivosDisciplina, detalhamento } = await req.json();

  if (!turmaId || !alunoId) {
    return NextResponse.json({ ok: false, erro: 'Selecione a turma e o aluno.' }, { status: 400 });
  }
  if ((!motivosAtividades || motivosAtividades.length === 0) && (!motivosDisciplina || motivosDisciplina.length === 0)) {
    return NextResponse.json({ ok: false, erro: 'Selecione pelo menos um motivo.' }, { status: 400 });
  }

  // Confere que a turma é mesmo do professor
  const { data: turmaDele } = await supabaseAdmin
    .from('professor_turmas')
    .select('turma_id')
    .eq('professor_id', professor.id)
    .eq('turma_id', turmaId)
    .maybeSingle();

  if (!turmaDele) {
    return NextResponse.json({ ok: false, erro: 'Essa turma não está vinculada ao seu cadastro.' }, { status: 403 });
  }

  // Confere que o aluno é mesmo dessa turma
  const { data: alunoDaTurma } = await supabaseAdmin
    .from('alunos')
    .select('id')
    .eq('id', alunoId)
    .eq('turma_id', turmaId)
    .maybeSingle();

  if (!alunoDaTurma) {
    return NextResponse.json({ ok: false, erro: 'Esse aluno não pertence a essa turma.' }, { status: 400 });
  }

  const tipoTexto = [];
  if (motivosAtividades && motivosAtividades.length > 0) tipoTexto.push('Atividades');
  if (motivosDisciplina && motivosDisciplina.length > 0) tipoTexto.push('Disciplina');

  const { data: ocorrenciaCriada, error: erroGravar } = await supabaseAdmin
    .from('ocorrencias')
    .insert({
      turma_id: turmaId,
      aluno_id: alunoId,
      tipo: tipoTexto.join(' e '),
      motivos_atividades: motivosAtividades || [],
      motivos_disciplina: motivosDisciplina || [],
      detalhamento: detalhamento || '',
      origem: 'MANUAL',
      professor_nome: professor.nome
    })
    .select()
    .single();

  if (erroGravar) {
    return NextResponse.json({ ok: false, erro: erroGravar.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ocorrenciaId: ocorrenciaCriada.id });
}
