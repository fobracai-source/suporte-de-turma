// app/api/entregas/route.js
//
// Recebe as respostas do aluno, confere com o gabarito de VERDADE (lido
// aqui, no servidor — nunca enviado pro navegador), calcula a nota, e
// grava a entrega. Permite no máximo 3 tentativas por atividade — a
// nota final mostrada é a MÉDIA de todas as tentativas feitas. Depois
// de gravar, manda um e-mail de confirmação pro aluno (se ele já
// tiver um e-mail cadastrado).

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { enviarEmail, escolherEmailValido } from '@/lib/email';
import { verificarEPremiarMissoes } from '@/lib/gamificacao';
import { NextResponse } from 'next/server';

const LIMITE_TENTATIVAS = 3;

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ ok: false, erro: 'Sessão não encontrada. Faça login novamente.' }, { status: 401 });
  }

  const supabaseComoUsuario = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: erroUsuario } = await supabaseComoUsuario.auth.getUser();
  if (erroUsuario || !user) {
    return NextResponse.json({ ok: false, erro: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const { data: aluno } = await supabaseAdmin
    .from('alunos')
    .select('id, nome, email_aluno, email_aluno_2')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!aluno) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });
  }

  const { atividadeId, respostas, avaliacao, observacoes, arquivos, feedbackAula } = await req.json();
  if (!atividadeId) {
    return NextResponse.json({ ok: false, erro: 'Atividade não informada.' }, { status: 400 });
  }
  if (!avaliacao || avaliacao < 1 || avaliacao > 5) {
    return NextResponse.json({ ok: false, erro: 'Aluno, é obrigatório avaliar a aula!' }, { status: 400 });
  }

  const { data: tentativasAnteriores, error: erroContagem } = await supabaseAdmin
    .from('entregas')
    .select('id, nota_calculada, criado_em')
    .eq('aluno_id', aluno.id)
    .eq('atividade_id', atividadeId)
    .order('criado_em', { ascending: true });

  if (erroContagem) {
    return NextResponse.json({ ok: false, erro: erroContagem.message }, { status: 500 });
  }

  if ((tentativasAnteriores || []).length >= LIMITE_TENTATIVAS) {
    return NextResponse.json({ ok: false, erro: 'Você já respondeu!', jaAtingiuMaximo: true }, { status: 403 });
  }

  const { data: atividade } = await supabaseAdmin
    .from('atividades')
    .select('gabarito, valor_nota, disciplina, aula_numero, tema')
    .eq('id', atividadeId)
    .maybeSingle();

  if (!atividade) {
    return NextResponse.json({ ok: false, erro: 'Atividade não encontrada.' }, { status: 404 });
  }

  const gabarito = atividade.gabarito || [];
  let notaDestaTentativa = null;
  let acertosDestaTentativa = 0;

  if (gabarito.length > 0) {
    gabarito.forEach((respostaCerta, indice) => {
      const respostaAluno = String((respostas || [])[indice] || '').trim().toUpperCase();
      if (respostaAluno === String(respostaCerta).trim().toUpperCase()) acertosDestaTentativa++;
    });
    notaDestaTentativa = Math.round((acertosDestaTentativa / gabarito.length) * atividade.valor_nota * 100) / 100;
  }

  const { error: erroGravar } = await supabaseAdmin
    .from('entregas')
    .insert({
      atividade_id: atividadeId,
      aluno_id: aluno.id,
      respostas: respostas || [],
      avaliacao: avaliacao || null,
      arquivos: arquivos || [],
      observacoes: observacoes || null,
      feedback_aula: feedbackAula || null,
      nota_calculada: notaDestaTentativa
    });

  if (erroGravar) {
    return NextResponse.json({ ok: false, erro: erroGravar.message }, { status: 500 });
  }

  const todasAsNotas = [...(tentativasAnteriores || []).map((t) => t.nota_calculada), notaDestaTentativa];
  let notaMedia = null;
  if (gabarito.length > 0) {
    const somaNotas = todasAsNotas.reduce((soma, n) => soma + (n || 0), 0);
    notaMedia = Math.round((somaNotas / todasAsNotas.length) * 100) / 100;
  }
  const aindaPodeTentar = todasAsNotas.length < LIMITE_TENTATIVAS;

  // ── PONTOS DE GAMIFICAÇÃO ────────────────────────────────────────
  // Só na PRIMEIRA tentativa dessa atividade — assim o aluno não ganha
  // ponto de novo só por tentar de novo a mesma atividade. Os valores
  // (250/75/50/25 etc.) são configuráveis pelo administrador — nunca
  // ficam fixos aqui no código.
  if (todasAsNotas.length === 1) {
    const { data: config } = await supabaseAdmin.from('configuracao_pontos').select('*').eq('id', 1).maybeSingle();
    const prazoFinal = atividade.data_final ? new Date(atividade.data_final + 'T23:59:59') : null;
    const noPrazo = !prazoFinal || new Date() <= prazoFinal;

    const pontosPorEntrega = noPrazo ? config.entrega_no_prazo : config.entrega_fora_prazo;
    const pontosPorAcerto = noPrazo ? config.ponto_por_acerto_no_prazo : config.ponto_por_acerto_fora_prazo;
    const pontosDeAcertos = gabarito.length > 0 ? acertosDestaTentativa * pontosPorAcerto : 0;
    const pontosGanhos = pontosPorEntrega + pontosDeAcertos;

    const descricao = gabarito.length > 0
      ? `Entregou "${atividade.tema}" ${noPrazo ? 'no prazo' : 'fora do prazo'} (${acertosDestaTentativa} acerto${acertosDestaTentativa === 1 ? '' : 's'})`
      : `Entregou "${atividade.tema}" ${noPrazo ? 'no prazo' : 'fora do prazo'}`;

    await supabaseAdmin.from('pontos_historico').insert({
      aluno_id: aluno.id,
      pontos: pontosGanhos,
      origem: 'entrega',
      descricao,
      referencia_id: atividadeId
    });
    await supabaseAdmin.rpc('incrementar_pontos_aluno', { p_aluno_id: aluno.id, p_pontos: pontosGanhos });
    await verificarEPremiarMissoes(aluno.id);
  }

  // Manda o e-mail de confirmação — só se o aluno já tiver um e-mail
  // cadastrado de verdade. Segue a mesma regra do resto do sistema:
  // nunca revela o gabarito, só a nota final.
  let emailEnviado = false;
  const emailDestino = escolherEmailValido(aluno.email_aluno, aluno.email_aluno_2);
  if (emailDestino) {
    const tituloAtividade = `${atividade.disciplina} — Aula ${atividade.aula_numero} — ${atividade.tema}`;
    let corpoHtml;
    let corpoTexto;

    if (gabarito.length > 0) {
      const listaTentativas = todasAsNotas.map((n, i) => `Tentativa ${i + 1}: ${n} / ${atividade.valor_nota}`).join('<br>');
      corpoHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color:#6C5CE7;">${tituloAtividade}</h2>
          <p>Olá, <b>${aluno.nome}</b>! Recebemos sua resposta.</p>
          <div style="background:#F4F2FF; padding:14px; border-radius:10px; margin:14px 0;">${listaTentativas}</div>
          <p style="font-size:22px; font-weight:bold; color:#6C5CE7;">Nota média: ${notaMedia} / ${atividade.valor_nota}</p>
          ${aindaPodeTentar ? `<p style="color:#888; font-size:13px;">Você ainda pode tentar mais ${LIMITE_TENTATIVAS - todasAsNotas.length} vez(es).</p>` : ''}
        </div>
      `;
      corpoTexto = `${tituloAtividade}\n\nOlá, ${aluno.nome}! Recebemos sua resposta.\n\n${listaTentativas.replace(/<br>/g, '\n')}\n\nNota média: ${notaMedia} / ${atividade.valor_nota}`;
    } else {
      corpoHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color:#6C5CE7;">${tituloAtividade}</h2>
          <p>Olá, <b>${aluno.nome}</b>! Recebemos sua resposta.</p>
          <p>Essa atividade será avaliada manualmente pelo(a) professor(a).</p>
        </div>
      `;
      corpoTexto = `${tituloAtividade}\n\nOlá, ${aluno.nome}! Recebemos sua resposta. Essa atividade será avaliada manualmente pelo(a) professor(a).`;
    }

    const resultadoEmail = await enviarEmail({
      para: emailDestino,
      assunto: `Resposta recebida — ${tituloAtividade}`,
      html: corpoHtml,
      texto: corpoTexto
    });
    emailEnviado = resultadoEmail.enviado;
  }

  return NextResponse.json({
    ok: true,
    notaDestaTentativa: notaDestaTentativa,
    tentativas: todasAsNotas,
    numeroDestaTentativa: todasAsNotas.length,
    notaMedia: notaMedia,
    valorNota: atividade.valor_nota,
    numQuestoes: gabarito.length,
    aindaPodeTentar: aindaPodeTentar,
    emailEnviado: emailEnviado
  });
}
