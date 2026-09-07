// app/api/admin/criar-turma/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { nome } = await req.json();
  if (!nome || !nome.trim()) {
    return NextResponse.json({ ok: false, erro: 'Informe o nome da turma.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from('turmas').insert({ nome: nome.trim() }).select().single();

  if (error) {
    const mensagem = error.code === '23505' ? 'Já existe uma turma com esse nome.' : error.message;
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 400 });
  }

  return NextResponse.json({ ok: true, turma: data });
}
