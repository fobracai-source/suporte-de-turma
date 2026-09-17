// app/api/admin/gamificacao/config-pontos/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { data } = await supabaseAdmin.from('configuracao_pontos').select('*').eq('id', 1).maybeSingle();
  return NextResponse.json({ ok: true, config: data }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { entregaNoPrazo, entregaForaPrazo, pontoPorAcertoNoPrazo, pontoPorAcertoForaPrazo, bonusSemOcorrenciaSemanal, bonusChatSemanal } = await req.json();

  const { data, error } = await supabaseAdmin.from('configuracao_pontos').update({
    entrega_no_prazo: entregaNoPrazo,
    entrega_fora_prazo: entregaForaPrazo,
    ponto_por_acerto_no_prazo: pontoPorAcertoNoPrazo,
    ponto_por_acerto_fora_prazo: pontoPorAcertoForaPrazo,
    bonus_sem_ocorrencia_semanal: bonusSemOcorrenciaSemanal,
    bonus_chat_semanal: bonusChatSemanal
  }).eq('id', 1).select().single();

  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, config: data });
}
