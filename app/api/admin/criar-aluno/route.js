// app/api/admin/criar-aluno/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { nome, turmaId } = await req.json();

  if (!nome || !nome.trim()) {
    return NextResponse.json({ ok: false, erro: 'Informe o nome do aluno.' }, { status: 400 });
  }
  if (!turmaId) {
    return NextResponse.json({ ok: false, erro: 'Selecione a turma.' }, { status: 400 });
  }

  // O resto (data de nascimento, telefone, e-mail...) o próprio aluno
  // preenche sozinho no primeiro acesso — aqui só criamos o "lugar" dele.
  const { data, error } = await supabaseAdmin
    .from('alunos')
    .insert({ nome: nome.trim(), turma_id: turmaId })
    .select()
    .single();

  if (error) {
    const mensagem = error.code === '23505' ? 'Já existe um aluno com esse nome nessa turma.' : error.message;
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 400 });
  }

  return NextResponse.json({ ok: true, aluno: data });
}
