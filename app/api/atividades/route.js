// app/api/atividades/route.js
// Cria uma atividade nova. Confere, no servidor, que quem está
// mandando é mesmo um professor, e que a disciplina/turmas escolhidas
// realmente pertencem a ele — mesmo que alguém tente "forçar" outro
// valor mexendo na requisição.
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
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!professor) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um professor.' }, { status: 403 });
  }

  const { disciplina, aulaNumero, tema, dataInicial, dataFinal, valorNota, gabarito, turmaIds } = await req.json();

  if (!disciplina || !aulaNumero || !tema || !turmaIds || turmaIds.length === 0) {
    return NextResponse.json({ ok: false, erro: 'Preencha disciplina, nº da aula, tema e pelo menos uma turma.' }, { status: 400 });
  }

  // Confere que a disciplina e as turmas escolhidas são mesmo do
  // professor — mesmo que o navegador tenha mandado outra coisa.
  const { data: disciplinasDele } = await supabaseAdmin
    .from('professor_disciplinas')
    .select('disciplina')
    .eq('professor_id', professor.id);
  const disciplinasPermitidas = (disciplinasDele || []).map((d) => d.disciplina);
  if (!disciplinasPermitidas.includes(disciplina)) {
    return NextResponse.json({ ok: false, erro: 'Essa disciplina não está vinculada ao seu cadastro.' }, { status: 403 });
  }

  const { data: turmasDele } = await supabaseAdmin
    .from('professor_turmas')
    .select('turma_id')
    .eq('professor_id', professor.id);
  const turmasPermitidas = (turmasDele || []).map((t) => t.turma_id);
  const turmasInvalidas = turmaIds.filter((id) => !turmasPermitidas.includes(id));
  if (turmasInvalidas.length > 0) {
    return NextResponse.json({ ok: false, erro: 'Uma ou mais turmas escolhidas não estão vinculadas ao seu cadastro.' }, { status: 403 });
  }

  // Gabarito: texto tipo "ABCAB" vira array ["A","B","C","A","B"].
  // Se vier vazio, é uma atividade sem correção automática (trabalho/entrega).
  const gabaritoArray = String(gabarito || '').toUpperCase().replace(/[^A-E]/g, '').split('');

  const { data: atividadeCriada, error: erroGravar } = await supabaseAdmin
    .from('atividades')
    .insert({
      disciplina,
      professor_id: professor.id,
      aula_numero: aulaNumero,
      tema,
      data_inicial: dataInicial || null,
      data_final: dataFinal || null,
      valor_nota: valorNota || 0,
      gabarito: gabaritoArray
    })
    .select()
    .single();

  if (erroGravar) {
    return NextResponse.json({ ok: false, erro: erroGravar.message }, { status: 500 });
  }

  const vinculos = turmaIds.map((turmaId) => ({ atividade_id: atividadeCriada.id, turma_id: turmaId }));
  const { error: erroVinculo } = await supabaseAdmin.from('atividade_turmas').insert(vinculos);

  if (erroVinculo) {
    return NextResponse.json({ ok: false, erro: 'Atividade criada, mas houve erro ao vincular as turmas: ' + erroVinculo.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, atividadeId: atividadeCriada.id });
}
