// app/api/admin/excluir-premio-semanal/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, erro: 'Prêmio não informado.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('premios_semanais').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
