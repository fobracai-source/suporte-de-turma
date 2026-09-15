// app/api/gamificacao/resumo/route.js
// Monta a tela de gamificação do aluno: pontos totais, histórico
// recente, o progresso das missões (calculado na hora, comparando com
// os dados reais — não fica guardado separado, pra nunca ficar
// desatualizado), e a lista de recompensas configuradas.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

  const { data: aluno } = await supabaseAdmin.from('alunos').select('id, nome, pontos_totais').eq('auth_user_id', user.id).maybeSingle();
  if (!aluno) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });
  }

  const { data: historico } = await supabaseAdmin
    .from('pontos_historico')
    .select('pontos, origem, descricao, criado_em')
    .eq('aluno_id', aluno.id)
    .order('criado_em', { ascending: false })
    .limit(20);

  // Dados pra calcular o progresso das missões
  const { count: qtdEntregas } = await supabaseAdmin.from('entregas').select('id', { count: 'exact', head: true }).eq('aluno_id', aluno.id);
  const { data: entregasComNota } = await supabaseAdmin.from('entregas').select('nota_calculada, atividades(valor_nota)').eq('aluno_id', aluno.id).not('nota_calculada', 'is', null);
  const qtdNotasPerfeitas = (entregasComNota || []).filter((e) => e.atividades?.valor_nota && e.nota_calculada >= e.atividades.valor_nota).length;
  const { count: qtdMensagensChat } = await supabaseAdmin.from('mural_mensagens').select('id', { count: 'exact', head: true }).eq('aluno_id', aluno.id).eq('tipo', 'chat');
  const { count: qtdOcorrencias } = await supabaseAdmin.from('ocorrencias').select('id', { count: 'exact', head: true }).eq('aluno_id', aluno.id);

  const missoes = [
    { emoji: '🎯', titulo: 'Primeira Entrega', descricao: 'Responda sua primeira atividade', meta: 1, atual: qtdEntregas || 0 },
    { emoji: '🏃', titulo: 'Maratonista', descricao: 'Responda 10 atividades', meta: 10, atual: qtdEntregas || 0 },
    { emoji: '⭐', titulo: 'Nota Perfeita', descricao: 'Tire 100% em pelo menos 1 atividade', meta: 1, atual: qtdNotasPerfeitas },
    { emoji: '💬', titulo: 'Comunicativo', descricao: 'Mande 10 mensagens no chat da turma', meta: 10, atual: qtdMensagensChat || 0 },
    { emoji: '🛡️', titulo: 'Sem Ocorrências', descricao: 'Fique sem nenhuma ocorrência registrada', meta: 1, atual: (qtdOcorrencias || 0) === 0 ? 1 : 0 }
  ].map((m) => ({ ...m, concluida: m.atual >= m.meta, percentual: Math.min(100, Math.round((m.atual / m.meta) * 100)) }));

  const { data: recompensas } = await supabaseAdmin.from('recompensas').select('titulo, descricao, pontos_necessarios, emoji').order('pontos_necessarios');
  const recompensasComStatus = (recompensas || []).map((r) => ({ ...r, desbloqueada: aluno.pontos_totais >= r.pontos_necessarios }));

  return NextResponse.json({
    ok: true,
    nome: aluno.nome,
    pontosTotais: aluno.pontos_totais,
    historico: historico || [],
    missoes,
    recompensas: recompensasComStatus
  });
}
