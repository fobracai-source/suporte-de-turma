// app/api/aluno/esqueci-senha/route.js
// Pública de propósito (roda ANTES do login) — o aluno informa turma,
// nome e o e-mail que está no cadastro dele. Se bater com o e-mail
// principal OU o reserva, reenvia a senha (que é sempre calculada a
// partir da data de nascimento salva — nunca é um valor aleatório
// guardado, então não precisa de "redefinir", só reenviar).
//
// Por segurança, a resposta é sempre a mesma genérica, tenha batido ou
// não — assim ninguém consegue "descobrir" o e-mail de um colega só
// tentando vários aqui.
import { supabaseAdmin, calcularSenhaDaData } from '@/lib/supabaseAdmin';
import { enviarEmail, escolherEmailValido } from '@/lib/email';
import { NextResponse } from 'next/server';

const MENSAGEM_GENERICA = 'Se o e-mail informado estiver certo, você vai receber a senha em instantes. Confira sua caixa de entrada (e o spam, por garantia).';

export async function POST(req) {
  const { turmaId, nome, email } = await req.json();

  if (!turmaId || !nome || !email) {
    return NextResponse.json({ ok: false, erro: 'Preencha todos os campos.' }, { status: 400 });
  }

  const { data: aluno } = await supabaseAdmin
    .from('alunos')
    .select('nome, data_nascimento, email_aluno, email_aluno_2')
    .eq('turma_id', turmaId)
    .eq('nome', nome)
    .maybeSingle();

  // Mesmo se não achar o aluno, ou o e-mail não bater, devolve a
  // mesma mensagem — nunca revela se o e-mail existe ou não.
  if (!aluno || !aluno.data_nascimento) {
    return NextResponse.json({ ok: true, mensagem: MENSAGEM_GENERICA });
  }

  const emailDigitado = String(email).trim().toLowerCase();
  const emailPrincipal = String(aluno.email_aluno || '').trim().toLowerCase();
  const emailReserva = String(aluno.email_aluno_2 || '').trim().toLowerCase();

  const bateu = (emailDigitado === emailPrincipal && emailPrincipal) || (emailDigitado === emailReserva && emailReserva);

  if (bateu) {
    const senha = calcularSenhaDaData(aluno.data_nascimento);
    const emailDestino = escolherEmailValido(aluno.email_aluno, aluno.email_aluno_2);

    await enviarEmail({
      para: emailDestino,
      assunto: 'Sua senha de acesso — Suporte de Turma',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color:#6C5CE7;">Sua senha de acesso</h2>
          <p>Olá, <b>${aluno.nome}</b>!</p>
          <p>Você pediu pra recuperar sua senha. Ela é sempre a sua data de nascimento (no formato DDMMAAAA) digitada duas vezes seguidas:</p>
          <p style="font-size:24px; font-weight:bold; letter-spacing:2px; background:#F4F2FF; padding:14px; border-radius:10px; text-align:center;">${senha}</p>
        </div>
      `,
      texto: `Olá, ${aluno.nome}! Sua senha de acesso é: ${senha}`
    });
  }

  return NextResponse.json({ ok: true, mensagem: MENSAGEM_GENERICA });
}
