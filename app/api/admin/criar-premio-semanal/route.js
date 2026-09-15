// app/api/admin/criar-premio-semanal/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { posicao, titulo, descricao, emoji } = await req.json();
  if (!posicao || posicao <= 0) return NextResponse.json({ ok: false, erro: 'Informe a posição (1, 2, 3...).' }, { status: 400 });
  if (!titulo || !titulo.trim()) return NextResponse.json({ ok: false, erro: 'Informe o título do prêmio.' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('premios_semanais').upsert({
    posicao, titulo: titulo.trim(), descricao: descricao || null, emoji: emoji && emoji.trim() ? emoji.trim() : '🏆'
  }, { onConflict: 'posicao' }).select().single();

  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, premio: data });
}
