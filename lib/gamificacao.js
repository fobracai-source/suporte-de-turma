// lib/gamificacao.js
// Motor compartilhado da gamificação — usado em todo lugar que precisa
// checar/premiar missão ou aplicar penalidade (entregas, chat,
// ocorrências, robô semanal). Fica tudo aqui pra nunca ficar
// duplicado nem desatualizado em algum lugar.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Calcula o valor ATUAL de uma estatística do aluno — usado pra
 * comparar com a meta de cada nível de missão.
 */
export async function calcularStatAluno(alunoId, chave) {
  if (chave === 'entregas_total') {
    const { count } = await supabaseAdmin.from('entregas').select('id', { count: 'exact', head: true }).eq('aluno_id', alunoId);
    return count || 0;
  }

  if (chave === 'entregas_no_prazo') {
    const { data } = await supabaseAdmin.from('entregas').select('criado_em, atividades(data_final)').eq('aluno_id', alunoId);
    return (data || []).filter((e) => {
      if (!e.atividades?.data_final) return true; // sem prazo definido = considera no prazo
      return new Date(e.criado_em) <= new Date(e.atividades.data_final + 'T23:59:59');
    }).length;
  }

  if (chave === 'notas_perfeitas') {
    const { data } = await supabaseAdmin.from('entregas').select('nota_calculada, atividades(valor_nota)').eq('aluno_id', alunoId).not('nota_calculada', 'is', null);
    return (data || []).filter((e) => e.atividades?.valor_nota && e.nota_calculada >= e.atividades.valor_nota).length;
  }

  if (chave === 'chat_semanas') {
    const { count } = await supabaseAdmin.from('pontos_historico').select('id', { count: 'exact', head: true }).eq('aluno_id', alunoId).eq('origem', 'chat');
    return count || 0;
  }

  if (chave === 'sem_ocorrencia_semanas') {
    const { count } = await supabaseAdmin.from('pontos_historico').select('id', { count: 'exact', head: true }).eq('aluno_id', alunoId).eq('origem', 'sem_ocorrencia');
    return count || 0;
  }

  if (chave === 'pontos_totais') {
    const { data } = await supabaseAdmin.from('alunos').select('pontos_totais').eq('id', alunoId).maybeSingle();
    return data?.pontos_totais || 0;
  }

  if (chave === 'podios_semanais') {
    const { count } = await supabaseAdmin.from('premios_semanais_historico').select('id', { count: 'exact', head: true }).eq('aluno_id', alunoId);
    return count || 0;
  }

  return 0;
}

/**
 * Confere TODAS as missões ativas pro aluno, e premia (uma única vez)
 * qualquer nível que ele tenha atingido e ainda não tinha recebido o
 * bônus. Retorna a lista de níveis novos conquistados agora (pra
 * mostrar um aviso na tela, se quiser).
 */
export async function verificarEPremiarMissoes(alunoId) {
  const { data: missoes } = await supabaseAdmin
    .from('missoes_config')
    .select('id, chave, titulo_base, emoji, missoes_niveis(id, nivel, meta, descricao, pontos_bonus)')
    .eq('ativa', true);

  const { data: jaConquistados } = await supabaseAdmin.from('missoes_niveis_conquistados').select('missao_nivel_id').eq('aluno_id', alunoId);
  const idsJaConquistados = new Set((jaConquistados || []).map((c) => c.missao_nivel_id));

  const novosNiveis = [];

  for (const missao of missoes || []) {
    const valorAtual = await calcularStatAluno(alunoId, missao.chave);
    const niveisOrdenados = [...(missao.missoes_niveis || [])].sort((a, b) => a.nivel - b.nivel);

    for (const nivel of niveisOrdenados) {
      if (idsJaConquistados.has(nivel.id)) continue;
      if (valorAtual < nivel.meta) continue;

      await supabaseAdmin.from('missoes_niveis_conquistados').insert({ aluno_id: alunoId, missao_nivel_id: nivel.id });
      if (nivel.pontos_bonus > 0) {
        await supabaseAdmin.from('pontos_historico').insert({
          aluno_id: alunoId,
          pontos: nivel.pontos_bonus,
          origem: 'missao',
          descricao: `Missão concluída: ${missao.titulo_base} — nível ${nivel.nivel}`
        });
        await supabaseAdmin.rpc('incrementar_pontos_aluno', { p_aluno_id: alunoId, p_pontos: nivel.pontos_bonus });
      }
      novosNiveis.push({ missao: missao.titulo_base, emoji: missao.emoji, nivel: nivel.nivel, descricao: nivel.descricao, pontosBonus: nivel.pontos_bonus });
    }
  }

  return novosNiveis;
}

/**
 * Confere se o aluno bateu em algum "degrau" de penalidade por
 * ocorrências acumuladas, e desconta os pontos (uma única vez por
 * degrau).
 */
export async function verificarPenalidadeOcorrencia(alunoId) {
  const { count: totalOcorrencias } = await supabaseAdmin.from('ocorrencias').select('id', { count: 'exact', head: true }).eq('aluno_id', alunoId);
  const { data: penalidades } = await supabaseAdmin.from('penalidades_ocorrencia').select('id, qtd_ocorrencias, pontos_perdidos, titulo').order('qtd_ocorrencias');
  const { data: jaAplicadas } = await supabaseAdmin.from('penalidades_ocorrencia_aplicadas').select('penalidade_id').eq('aluno_id', alunoId);
  const idsJaAplicadas = new Set((jaAplicadas || []).map((p) => p.penalidade_id));

  for (const penalidade of penalidades || []) {
    if (idsJaAplicadas.has(penalidade.id)) continue;
    if ((totalOcorrencias || 0) < penalidade.qtd_ocorrencias) continue;

    await supabaseAdmin.from('penalidades_ocorrencia_aplicadas').insert({ aluno_id: alunoId, penalidade_id: penalidade.id });
    await supabaseAdmin.from('pontos_historico').insert({
      aluno_id: alunoId,
      pontos: -penalidade.pontos_perdidos,
      origem: 'penalidade',
      descricao: penalidade.titulo
    });
    await supabaseAdmin.rpc('incrementar_pontos_aluno', { p_aluno_id: alunoId, p_pontos: -penalidade.pontos_perdidos });
  }
}
