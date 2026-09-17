// app/api/gamificacao/resumo/route.js
// Monta a tela de gamificação do aluno: pontos totais, histórico,
// progresso de cada missão (lida do banco — o administrador pode
// editar/criar missões e níveis sem precisar mexer em código), status
// de penalidade por ocorrência, recompensas, e o ranking geral da
// turma (por pontos totais), visível a todos os alunos.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { calcularStatAluno, verificarEPremiarMissoes, verificarPenalidadeOcorrencia } from '@/lib/gamificacao';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

  const { data: aluno } = await supabaseAdmin.from('alunos').select('id, nome, turma_id, pontos_totais').eq('auth_user_id', user.id).maybeSingle();
  if (!aluno) return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });

  // Confere e premia qualquer missão nova (e desconta penalidade, se
  // for o caso) ANTES de montar a resposta — assim a tela já mostra
  // tudo atualizado na hora
  const novosNiveis = await verificarEPremiarMissoes(aluno.id);
  await verificarPenalidadeOcorrencia(aluno.id);

  const { data: alunoAtualizado } = await supabaseAdmin.from('alunos').select('pontos_totais').eq('id', aluno.id).maybeSingle();
  const pontosAtuais = alunoAtualizado?.pontos_totais || 0;

  // ── Missões, com progresso calculado a partir do banco ──────────────
  const { data: missoesConfig } = await supabaseAdmin
    .from('missoes_config')
    .select('id, chave, titulo_base, emoji, missoes_niveis(id, nivel, meta, descricao, pontos_bonus)')
    .eq('ativa', true);

  const { data: conquistados } = await supabaseAdmin.from('missoes_niveis_conquistados').select('missao_nivel_id').eq('aluno_id', aluno.id);
  const idsConquistados = new Set((conquistados || []).map((c) => c.missao_nivel_id));

  const missoes = [];
  for (const missao of missoesConfig || []) {
    const valorAtual = await calcularStatAluno(aluno.id, missao.chave);
    const niveis = [...(missao.missoes_niveis || [])].sort((a, b) => a.nivel - b.nivel);

    const nivelAtual = niveis.filter((n) => idsConquistados.has(n.id)).length;
    const proximoNivel = niveis.find((n) => !idsConquistados.has(n.id));

    missoes.push({
      chave: missao.chave,
      emoji: missao.emoji,
      titulo: missao.titulo_base,
      nivelAtual,
      nivelMaximo: niveis.length,
      valorAtual,
      metaProximoNivel: proximoNivel ? proximoNivel.meta : null,
      descricaoProximoNivel: proximoNivel ? proximoNivel.descricao : null,
      percentualProximoNivel: proximoNivel ? Math.min(100, Math.round((valorAtual / proximoNivel.meta) * 100)) : 100,
      completouTudo: !proximoNivel && niveis.length > 0
    });
  }

  // ── Status de penalidade por ocorrência ──────────────────────────────
  const { count: totalOcorrencias } = await supabaseAdmin.from('ocorrencias').select('id', { count: 'exact', head: true }).eq('aluno_id', aluno.id);
  const { data: penalidades } = await supabaseAdmin.from('penalidades_ocorrencia').select('qtd_ocorrencias, pontos_perdidos, titulo').order('qtd_ocorrencias');
  const { data: penalidadesAplicadas } = await supabaseAdmin.from('penalidades_ocorrencia_aplicadas').select('penalidade_id').eq('aluno_id', aluno.id);

  const proximaPenalidade = (penalidades || []).find((p) => (totalOcorrencias || 0) < p.qtd_ocorrencias);
  const totalPerdidoEmPenalidades = (penalidadesAplicadas || []).length > 0
    ? (penalidades || []).filter((p, i) => i < (penalidadesAplicadas || []).length).reduce((s, p) => s + p.pontos_perdidos, 0)
    : 0;

  // ── Histórico recente ─────────────────────────────────────────────
  const { data: historico } = await supabaseAdmin
    .from('pontos_historico')
    .select('pontos, origem, descricao, criado_em')
    .eq('aluno_id', aluno.id)
    .order('criado_em', { ascending: false })
    .limit(20);

  // ── Recompensas ───────────────────────────────────────────────────
  const { data: recompensas } = await supabaseAdmin.from('recompensas').select('titulo, descricao, pontos_necessarios, emoji').order('pontos_necessarios');
  const recompensasComStatus = (recompensas || []).map((r) => ({ ...r, desbloqueada: pontosAtuais >= r.pontos_necessarios }));

  // ── Ranking geral da turma (por pontos totais) — visível a todos ────
  const { data: alunosDaTurma } = await supabaseAdmin.from('alunos').select('id, nome, pontos_totais').eq('turma_id', aluno.turma_id).order('pontos_totais', { ascending: false });
  const rankingGeral = (alunosDaTurma || []).map((a, i) => ({ posicao: i + 1, nome: a.nome, pontos: a.pontos_totais, souEu: a.id === aluno.id }));

  return NextResponse.json({
    ok: true,
    nome: aluno.nome,
    pontosTotais: pontosAtuais,
    novosNiveisConquistadosAgora: novosNiveis,
    historico: historico || [],
    missoes,
    recompensas: recompensasComStatus,
    penalidadeOcorrencia: {
      totalOcorrencias: totalOcorrencias || 0,
      totalPerdido: totalPerdidoEmPenalidades,
      proximaPenalidade: proximaPenalidade || null
    },
    rankingGeral
  });
}
