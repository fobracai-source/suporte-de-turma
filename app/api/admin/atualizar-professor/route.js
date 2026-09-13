// app/api/admin/atualizar-professor/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { professorId, disciplinas, turmaIds } = await req.json();
  if (!professorId) {
    return NextResponse.json({ ok: false, erro: 'Professor não informado.' }, { status: 400 });
  }

  // Substitui a lista inteira: apaga os vínculos antigos e grava os novos
  await supabaseAdmin.from('professor_disciplinas').delete().eq('professor_id', professorId);
  if (disciplinas && disciplinas.length > 0) {
    const linhas = disciplinas.map((d) => ({ professor_id: professorId, disciplina: d }));
    const { error: erroDisciplinas } = await supabaseAdmin.from('professor_disciplinas').insert(linhas);
    if (erroDisciplinas) return NextResponse.json({ ok: false, erro: erroDisciplinas.message }, { status: 500 });
  }

  await supabaseAdmin.from('professor_turmas').delete().eq('professor_id', professorId);
  if (turmaIds && turmaIds.length > 0) {
    const linhas = turmaIds.map((t) => ({ professor_id: professorId, turma_id: t }));
    const { error: erroTurmas } = await supabaseAdmin.from('professor_turmas').insert(linhas);
    if (erroTurmas) return NextResponse.json({ ok: false, erro: erroTurmas.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
