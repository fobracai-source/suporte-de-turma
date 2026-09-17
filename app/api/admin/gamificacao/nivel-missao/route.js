// app/api/admin/gamificacao/nivel-missao/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { id, missaoId, nivel, meta, descricao, pontosBonus } = await req.json();
  if (!missaoId || !nivel || !meta || !descricao) {
    return NextResponse.json({ ok: false, erro: 'Preencha missão, nível, meta e descrição.' }, { status: 400 });
  }

  const dados = { missao_id: missaoId, nivel, meta, descricao: descricao.trim(), pontos_bonus: pontosBonus || 0 };

  let resultado;
  if (id) {
    resultado = await supabaseAdmin.from('missoes_niveis').update(dados).eq('id', id).select().single();
  } else {
    resultado = await supabaseAdmin.from('missoes_niveis').upsert(dados, { onConflict: 'missao_id,nivel' }).select().single();
  }

  if (resultado.error) return NextResponse.json({ ok: false, erro: resultado.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, nivelMissao: resultado.data });
}

export async function DELETE(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, erro: 'Nível não informado.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('missoes_niveis').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
