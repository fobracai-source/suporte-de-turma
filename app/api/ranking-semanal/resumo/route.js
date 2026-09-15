// app/api/ranking-semanal/resumo/route.js
// Mostra o ranking de pontos da SEMANA ATUAL (ainda em andamento) da
// turma do aluno logado, junto com os prêmios configurados — e também
// o pódio da última semana já fechada, pra dar transparência de quem
// ganhou.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

function inicioDaSemanaAtual() {
  const hoje = new Date();
  const diaDaSemana = hoje.getDay();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - (diaDaSemana === 0 ? 6 : diaDaSemana - 1));
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

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

  const { data: euMesmo } = await supabaseAdmin.from('alunos').select('id, turma_id').eq('auth_user_id', user.id).maybeSingle();
  if (!euMesmo) return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });

  const inicioSemana = inicioDaSemanaAtual();

  const { data: alunosDaTurma } = await supabaseAdmin.from('alunos').select('id, nome').eq('turma_id', euMesmo.turma_id);

  const ranking = [];
  for (const aluno of alunosDaTurma || []) {
    const { data: historico } = await supabaseAdmin
      .from('pontos_historico')
      .select('pontos')
      .eq('aluno_id', aluno.id)
      .gte('criado_em', inicioSemana.toISOString());

    const total = (historico || []).reduce((soma, h) => soma + h.pontos, 0);
    ranking.push({ alunoId: aluno.id, nome: aluno.nome, pontos: total, souEu: aluno.id === euMesmo.id });
  }
  ranking.sort((a, b) => b.pontos - a.pontos);
  const rankingComPosicao = ranking.map((r, i) => ({ ...r, posicao: i + 1 }));

  const { data: premios } = await supabaseAdmin.from('premios_semanais').select('posicao, titulo, descricao, emoji').order('posicao');

  const { data: ultimoPodio } = await supabaseAdmin
    .from('premios_semanais_historico')
    .select('posicao, pontos_da_semana, semana_inicio, alunos(nome)')
    .eq('turma_id', euMesmo.turma_id)
    .order('semana_inicio', { ascending: false })
    .limit(10);

  return NextResponse.json({
    ok: true,
    inicioSemana: inicioSemana.toISOString().slice(0, 10),
    ranking: rankingComPosicao,
    premios: premios || [],
    ultimoPodio: ultimoPodio || []
  });
}
