// app/api/admin/criar-recompensa/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { titulo, descricao, pontosNecessarios, emoji } = await req.json();
  if (!titulo || !titulo.trim()) {
    return NextResponse.json({ ok: false, erro: 'Informe o título da recompensa.' }, { status: 400 });
  }
  if (!pontosNecessarios || pontosNecessarios <= 0) {
    return NextResponse.json({ ok: false, erro: 'Informe quantos pontos são necessários.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from('recompensas').insert({
    titulo: titulo.trim(),
    descricao: descricao ? descricao.trim() : null,
    pontos_necessarios: pontosNecessarios,
    emoji: emoji && emoji.trim() ? emoji.trim() : '🎁'
  }).select().single();

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recompensa: data });
}
