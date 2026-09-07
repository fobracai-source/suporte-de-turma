// app/api/verificar-cadastro-aluno/route.js
// Pública de propósito (roda ANTES do login existir) — só confirma se
// esse aluno já tem uma conta de acesso criada ou não. Não expõe
// nenhum dado sensível, só um "sim" ou "não".
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const turmaId = searchParams.get('turmaId');
  const nome = searchParams.get('nome');

  if (!turmaId || !nome) {
    return NextResponse.json({ ok: false, erro: 'Dados incompletos.' }, { status: 400 });
  }

  const { data: aluno, error } = await supabaseAdmin
    .from('alunos')
    .select('auth_user_id, matricula, telefone, data_nascimento, email_aluno, email_familia, dono_email_familia, observacao')
    .eq('turma_id', turmaId)
    .eq('nome', nome)
    .maybeSingle();

  if (error || !aluno) {
    return NextResponse.json({ ok: false, erro: 'Aluno não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    temLogin: !!aluno.auth_user_id,
    // Se já existem valores cadastrados (por exemplo, colocados pelo
    // administrador direto na tabela), devolvemos pra já vir
    // preenchido no formulário do primeiro acesso.
    dadosAtuais: {
      matricula: aluno.matricula || '',
      telefone: aluno.telefone || '',
      emailAluno: aluno.email_aluno || '',
      emailFamilia: aluno.email_familia || '',
      donoEmailFamilia: aluno.dono_email_familia || '',
      observacao: aluno.observacao || ''
    }
  });
}
