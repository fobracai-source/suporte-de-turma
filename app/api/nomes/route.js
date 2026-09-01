// app/api/nomes/route.js
// Pública de propósito — só mostra NOMES, nada sensível (nunca a data
// de nascimento nem qualquer outro dado). Alimenta o segundo dropdown
// da tela de login (depois de escolher turma, ou pra professor).
//
// Uso: /api/nomes?tipo=aluno&turmaId=3
//      /api/nomes?tipo=professor
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo');

  if (tipo === 'aluno') {
    const turmaId = searchParams.get('turmaId');
    if (!turmaId) return NextResponse.json({ ok: false, erro: 'Informe a turma.' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('alunos')
      .select('id, nome')
      .eq('turma_id', turmaId)
      .order('nome');

    if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, nomes: data });
  }

  if (tipo === 'professor') {
    const { data, error } = await supabaseAdmin
      .from('professores')
      .select('id, nome')
      .order('nome');

    if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, nomes: data });
  }

  return NextResponse.json({ ok: false, erro: 'Tipo inválido.' }, { status: 400 });
}
