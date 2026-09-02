// app/api/entregas/quantidade-questoes/route.js
// Devolve só o NÚMERO de questões de uma atividade — nunca o
// conteúdo do gabarito. É assim que a tela do aluno sabe quantos
// botões de resposta desenhar, sem nunca ver a resposta certa.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const atividadeId = searchParams.get('atividadeId');
  if (!atividadeId) {
    return NextResponse.json({ ok: false, erro: 'Informe a atividade.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('atividades')
    .select('gabarito')
    .eq('id', atividadeId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, erro: 'Atividade não encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, numQuestoes: (data.gabarito || []).length });
}
