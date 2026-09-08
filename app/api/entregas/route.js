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

  const { atividadeId, respostas, avaliacao, observacoes } = await req.json();
  if (!atividadeId) {
    return NextResponse.json({ ok: false, erro: 'Atividade não informada.' }, { status: 400 });
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

  if (gabarito.length > 0) {
    let acertos = 0;
    gabarito.forEach((respostaCerta, indice) => {
      const respostaAluno = String((respostas || [])[indice] || '').trim().toUpperCase();
      if (respostaAluno === String(respostaCerta).trim().toUpperCase()) acertos++;
    });
    notaDestaTentativa = Math.round((acertos / gabarito.length) * atividade.valor_nota * 100) / 100;
  }

  const { error: erroGravar } = await supabaseAdmin
    .from('entregas')
    .insert({
      atividade_id: atividadeId,
      aluno_id: aluno.id,
      respostas: respostas || [],
      avaliacao: avaliacao || null,
      observacoes: observacoes || null,
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
