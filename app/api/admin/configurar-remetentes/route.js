// app/api/admin/configurar-remetentes/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { remetente1Email, remetente1Senha, remetente2Email, remetente2Senha, remetente3Email, remetente3Senha } = await req.json();

  // Só atualiza os campos que vieram preenchidos — deixar em branco
  // significa "não mexer no que já está salvo" (assim dá pra trocar
  // só a senha de um remetente sem precisar redigitar os outros 2).
  const atualizacao = { atualizado_em: new Date().toISOString() };
  if (remetente1Email !== undefined && remetente1Email !== '') atualizacao.remetente_1_email = remetente1Email.trim();
  if (remetente1Senha !== undefined && remetente1Senha !== '') atualizacao.remetente_1_senha = remetente1Senha.trim();
  if (remetente2Email !== undefined && remetente2Email !== '') atualizacao.remetente_2_email = remetente2Email.trim();
  if (remetente2Senha !== undefined && remetente2Senha !== '') atualizacao.remetente_2_senha = remetente2Senha.trim();
  if (remetente3Email !== undefined && remetente3Email !== '') atualizacao.remetente_3_email = remetente3Email.trim();
  if (remetente3Senha !== undefined && remetente3Senha !== '') atualizacao.remetente_3_senha = remetente3Senha.trim();

  const { error } = await supabaseAdmin.from('configuracao_email').update(atualizacao).eq('id', 1);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
