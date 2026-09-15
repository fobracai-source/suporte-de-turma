// app/api/admin/excluir-recompensa/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, erro: 'Recompensa não informada.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('recompensas').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
