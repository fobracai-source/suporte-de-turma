// app/api/entregas/route.js
//
// Recebe as respostas do aluno, confere com o gabarito de VERDADE (lido
// aqui, no servidor — nunca enviado pro navegador), calcula a nota, e
// grava a entrega. Permite no máximo 3 tentativas por atividade — a
// nota final mostrada é a MÉDIA de todas as tentativas feitas.

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

const LIMITE_TENTATIVAS = 3;

export async function POST(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ ok: false, erro: 'Sessão não encontrada. Faça login novamente.' }, { status: 401 });
  }

  // Confere QUEM está mandando essa requisição, usando o token dele
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
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!aluno) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });
  }

  const { atividadeId, respostas, avaliacao, observacoes } = await req.json();
  if (!atividadeId) {
    return NextResponse.json({ ok: false, erro: 'Atividade não informada.' }, { status: 400 });
  }

  // Confere quantas vezes o aluno JÁ respondeu essa atividade — se já
  // chegou no limite, bloqueia aqui, sem nem chegar a gravar nada novo.
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

  // Só agora, no servidor, lemos o gabarito de verdade
  const { data: atividade } = await supabaseAdmin
    .from('atividades')
    .select('gabarito, valor_nota')
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

  const { data: entregaCriada, error: erroGravar } = await supabaseAdmin
    .from('entregas')
    .insert({
      atividade_id: atividadeId,
      aluno_id: aluno.id,
      respostas: respostas || [],
      avaliacao: avaliacao || null,
      observacoes: observacoes || null,
      nota_calculada: notaDestaTentativa
    })
    .select()
    .single();

  if (erroGravar) {
    return NextResponse.json({ ok: false, erro: erroGravar.message }, { status: 500 });
  }

  // Monta a lista de notas de TODAS as tentativas (as antigas + essa
  // nova agora) e calcula a média — é essa média que vale como nota
  // final da atividade.
  const todasAsNotas = [...(tentativasAnteriores || []).map((t) => t.nota_calculada), notaDestaTentativa];
  let notaMedia = null;
  if (gabarito.length > 0) {
    const somaNotas = todasAsNotas.reduce((soma, n) => soma + (n || 0), 0);
    notaMedia = Math.round((somaNotas / todasAsNotas.length) * 100) / 100;
  }

  return NextResponse.json({
    ok: true,
    notaDestaTentativa: notaDestaTentativa,
    tentativas: todasAsNotas,
    numeroDestaTentativa: todasAsNotas.length,
    notaMedia: notaMedia,
    valorNota: atividade.valor_nota,
    numQuestoes: gabarito.length,
    aindaPodeTentar: todasAsNotas.length < LIMITE_TENTATIVAS
  });
}
