// app/api/admin/gamificacao/missao/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { id, chave, tituloBase, emoji, ativa } = await req.json();
  if (!chave || !chave.trim()) return NextResponse.json({ ok: false, erro: 'Informe a chave (identificador único).' }, { status: 400 });
  if (!tituloBase || !tituloBase.trim()) return NextResponse.json({ ok: false, erro: 'Informe o título.' }, { status: 400 });

  const dados = {
    chave: chave.trim(),
    titulo_base: tituloBase.trim(),
    emoji: emoji && emoji.trim() ? emoji.trim() : '🏆',
    ativa: ativa !== false
  };

  let resultado;
  if (id) {
    resultado = await supabaseAdmin.from('missoes_config').update(dados).eq('id', id).select().single();
  } else {
    resultado = await supabaseAdmin.from('missoes_config').insert(dados).select().single();
  }

  if (resultado.error) return NextResponse.json({ ok: false, erro: resultado.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, missao: resultado.data });
}

export async function DELETE(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, erro: 'Missão não informada.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('missoes_config').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
