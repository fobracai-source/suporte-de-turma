// app/api/admin/criar-professor/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { nome, email, dataNascimento, disciplinas, turmaIds } = await req.json();

  if (!nome || !nome.trim()) {
    return NextResponse.json({ ok: false, erro: 'Informe o nome do professor.' }, { status: 400 });
  }
  if (!dataNascimento) {
    return NextResponse.json({ ok: false, erro: 'A data de nascimento é obrigatória (vira a senha dele).' }, { status: 400 });
  }

  const { data: professorCriado, error: erroProfessor } = await supabaseAdmin
    .from('professores')
    .insert({ nome: nome.trim(), email: email && email.trim() ? email.trim() : null, data_nascimento: dataNascimento })
    .select()
    .single();

  if (erroProfessor) {
    const mensagem = erroProfessor.code === '23505' ? 'Já existe um professor com esse nome.' : erroProfessor.message;
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 400 });
  }

  if (disciplinas && disciplinas.length > 0) {
    const linhas = disciplinas.map((d) => ({ professor_id: professorCriado.id, disciplina: d }));
    await supabaseAdmin.from('professor_disciplinas').insert(linhas);
  }

  if (turmaIds && turmaIds.length > 0) {
    const linhas = turmaIds.map((t) => ({ professor_id: professorCriado.id, turma_id: t }));
    await supabaseAdmin.from('professor_turmas').insert(linhas);
  }

  return NextResponse.json({ ok: true, professor: professorCriado });
}
