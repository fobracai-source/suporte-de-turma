export const dynamic = 'force-dynamic';
// app/api/professor/minhas-turmas-disciplinas/route.js
// Devolve as disciplinas e turmas vinculadas ao professor que está
// fazendo a requisição — identificado pelo token de sessão dele, nunca
// por um ID que o navegador poderia inventar.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ ok: false, erro: 'Sessão não encontrada.' }, { status: 401 });
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

  const { data: professor } = await supabaseAdmin
    .from('professores')
    .select('id, nome')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!professor) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um professor.' }, { status: 403 });
  }

  const { data: disciplinas } = await supabaseAdmin
    .from('professor_disciplinas')
    .select('disciplina')
    .eq('professor_id', professor.id);

  const { data: turmasVinculo } = await supabaseAdmin
    .from('professor_turmas')
    .select('turmas(id, nome)')
    .eq('professor_id', professor.id);

  const turmas = (turmasVinculo || []).map((v) => v.turmas).filter(Boolean);

  return NextResponse.json({
    ok: true,
    professorId: professor.id,
    disciplinas: (disciplinas || []).map((d) => d.disciplina),
    turmas: turmas
  });
}
