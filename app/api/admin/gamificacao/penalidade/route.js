// app/api/admin/gamificacao/penalidade/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { id, qtdOcorrencias, pontosPerdidos, titulo } = await req.json();
  if (!qtdOcorrencias || !pontosPerdidos || !titulo || !titulo.trim()) {
    return NextResponse.json({ ok: false, erro: 'Preencha quantidade, pontos perdidos e título.' }, { status: 400 });
  }

  const dados = { qtd_ocorrencias: qtdOcorrencias, pontos_perdidos: pontosPerdidos, titulo: titulo.trim() };

  let resultado;
  if (id) {
    resultado = await supabaseAdmin.from('penalidades_ocorrencia').update(dados).eq('id', id).select().single();
  } else {
    resultado = await supabaseAdmin.from('penalidades_ocorrencia').upsert(dados, { onConflict: 'qtd_ocorrencias' }).select().single();
  }

  if (resultado.error) return NextResponse.json({ ok: false, erro: resultado.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, penalidade: resultado.data });
}

export async function DELETE(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, erro: 'Penalidade não informada.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('penalidades_ocorrencia').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
