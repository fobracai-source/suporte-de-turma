export const dynamic = 'force-dynamic';
// app/api/entregas/tentativas/route.js
// Confere quantas vezes o aluno logado já respondeu uma atividade —
// usado ANTES de mostrar o formulário, pra já bloquear de cara se ele
// tiver estourado o limite de 3 tentativas, sem fazer ele preencher
// tudo à toa.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const LIMITE_TENTATIVAS = 3;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const atividadeId = searchParams.get('atividadeId');

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token || !atividadeId) {
    return NextResponse.json({ ok: false, erro: 'Dados incompletos.' }, { status: 400 });
  }

  const supabaseComoUsuario = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: erroUsuario } = await supabaseComoUsuario.auth.getUser();
  if (erroUsuario || !user) {
    return NextResponse.json({ ok: false, erro: 'Sessão inválida.' }, { status: 401 });
  }

  const { data: aluno } = await supabaseAdmin
    .from('alunos')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!aluno) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });
  }

  const { data: tentativas, error } = await supabaseAdmin
    .from('entregas')
    .select('nota_calculada, criado_em')
    .eq('aluno_id', aluno.id)
    .eq('atividade_id', atividadeId)
    .order('criado_em', { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  const qtd = (tentativas || []).length;

  return NextResponse.json({
    ok: true,
    qtdTentativas: qtd,
    jaAtingiuMaximo: qtd >= LIMITE_TENTATIVAS,
    limite: LIMITE_TENTATIVAS,
    tentativasAnteriores: (tentativas || []).map((t) => t.nota_calculada)
  });
}
