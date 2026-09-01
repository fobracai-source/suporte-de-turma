// app/api/turmas/route.js
// Pública de propósito — só mostra o NOME das turmas, nada sensível.
// É o que alimenta o dropdown da tela de login, antes do aluno entrar.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('turmas')
    .select('id, nome')
    .order('nome');

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, turmas: data });
}
