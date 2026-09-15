// app/api/professor/esqueci-senha/route.js
// Igual à recuperação de senha do aluno, mas pro professor — a senha
// também é sempre calculada a partir da data de nascimento, então só
// reenviamos, nunca precisa "redefinir" nada.
import { supabaseAdmin, calcularSenhaDaData, normalizarNome } from '@/lib/supabaseAdmin';
import { enviarEmail } from '@/lib/email';
import { NextResponse } from 'next/server';

const MENSAGEM_GENERICA = 'Se o e-mail informado estiver certo, você vai receber a senha em instantes. Confira sua caixa de entrada (e o spam, por garantia).';

export async function POST(req) {
  const { nome, email } = await req.json();

  if (!nome || !email) {
    return NextResponse.json({ ok: false, erro: 'Preencha todos os campos.' }, { status: 400 });
  }

  const nomeNormalizado = normalizarNome(nome);
  const { data: todosProfessores } = await supabaseAdmin
    .from('professores')
    .select('nome, email, data_nascimento');

  const professor = (todosProfessores || []).find((p) => normalizarNome(p.nome) === nomeNormalizado);

  if (!professor || !professor.data_nascimento || !professor.email) {
    return NextResponse.json({ ok: true, mensagem: MENSAGEM_GENERICA });
  }

  const emailDigitado = String(email).trim().toLowerCase();
  const emailCadastrado = String(professor.email).trim().toLowerCase();

  if (emailDigitado === emailCadastrado) {
    const senha = calcularSenhaDaData(professor.data_nascimento);

    await enviarEmail({
      para: professor.email,
      assunto: 'Sua senha de acesso — Suporte de Turma',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color:#6C5CE7;">Sua senha de acesso</h2>
          <p>Olá, <b>${professor.nome}</b>!</p>
          <p>Você pediu pra recuperar sua senha. Ela é sempre a sua data de nascimento (no formato DDMMAAAA) digitada duas vezes seguidas:</p>
          <p style="font-size:24px; font-weight:bold; letter-spacing:2px; background:#F4F2FF; padding:14px; border-radius:10px; text-align:center;">${senha}</p>
        </div>
      `,
      texto: `Olá, ${professor.nome}! Sua senha de acesso é: ${senha}`
    });
  }

  return NextResponse.json({ ok: true, mensagem: MENSAGEM_GENERICA });
}
