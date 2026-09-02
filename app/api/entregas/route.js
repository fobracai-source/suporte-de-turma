// app/api/entregas/route.js
//
// Recebe as respostas do aluno, confere com o gabarito de VERDADE (lido
// aqui, no servidor — nunca enviado pro navegador), calcula a nota, e
// grava a entrega. Confirma também que quem está enviando é dono da
// própria entrega (não dá pra um aluno enviar resposta em nome de
// outro, mesmo manipulando a requisição).

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

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
  let notaCalculada = null;

  if (gabarito.length > 0) {
    let acertos = 0;
    gabarito.forEach((respostaCerta, indice) => {
      const respostaAluno = String((respostas || [])[indice] || '').trim().toUpperCase();
      if (respostaAluno === String(respostaCerta).trim().toUpperCase()) acertos++;
    });
    notaCalculada = Math.round((acertos / gabarito.length) * atividade.valor_nota * 100) / 100;
  }

  const { data: entregaCriada, error: erroGravar } = await supabaseAdmin
    .from('entregas')
    .insert({
      atividade_id: atividadeId,
      aluno_id: aluno.id,
      respostas: respostas || [],
      avaliacao: avaliacao || null,
      observacoes: observacoes || null,
      nota_calculada: notaCalculada
    })
    .select()
    .single();

  if (erroGravar) {
    return NextResponse.json({ ok: false, erro: erroGravar.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    notaCalculada: notaCalculada,
    valorNota: atividade.valor_nota,
    numQuestoes: gabarito.length
  });
}
