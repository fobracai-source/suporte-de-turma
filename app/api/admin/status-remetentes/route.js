// app/api/admin/status-remetentes/route.js
// Devolve só um "sim/não" pra cada remetente — a senha de app NUNCA
// volta pro navegador, por segurança.
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { data } = await supabaseAdmin.from('configuracao_email').select('*').eq('id', 1).maybeSingle();

  return NextResponse.json({
    ok: true,
    remetente1: { email: data?.remetente_1_email || '', configurado: !!(data?.remetente_1_email && data?.remetente_1_senha) },
    remetente2: { email: data?.remetente_2_email || '', configurado: !!(data?.remetente_2_email && data?.remetente_2_senha) },
    remetente3: { email: data?.remetente_3_email || '', configurado: !!(data?.remetente_3_email && data?.remetente_3_senha) }
  });
}
