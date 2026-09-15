// app/api/admin/criar-evento-escolar/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { turmaId, titulo, descricao, dataEvento } = await req.json();
  if (!titulo || !dataEvento) {
    return NextResponse.json({ ok: false, erro: 'Preencha título e data.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from('eventos_agenda').insert({
    turma_id: turmaId || null, tipo: 'evento', titulo: titulo.trim(), descricao: descricao || null, data_evento: dataEvento
  }).select().single();

  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, evento: data });
}
