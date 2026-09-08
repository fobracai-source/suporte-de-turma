// lib/email.js
// Motor de e-mail compartilhado. Os remetentes (até 3 contas do
// Gmail) são configurados pelo administrador na tela de
// Administração, e ficam guardados na tabela "configuracao_email" —
// nunca em variável de ambiente fixa, pra dar flexibilidade de trocar
// sem precisar mexer em código.
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Escolhe qual e-mail usar: o principal, se existir de verdade (não
 * vazio, nem "Depois informo"); senão, o reserva. Se nenhum dos dois
 * existir, devolve null.
 */
export function escolherEmailValido(principal, reserva) {
  const ehValido = (e) => !!e && e !== 'Depois informo';
  if (ehValido(principal)) return principal;
  if (ehValido(reserva)) return reserva;
  return null;
}

async function obterRemetentesConfigurados() {
  const { data } = await supabaseAdmin.from('configuracao_email').select('*').eq('id', 1).maybeSingle();
  if (!data) return [];

  const lista = [];
  if (data.remetente_1_email && data.remetente_1_senha) lista.push({ email: data.remetente_1_email, senha: data.remetente_1_senha });
  if (data.remetente_2_email && data.remetente_2_senha) lista.push({ email: data.remetente_2_email, senha: data.remetente_2_senha });
  if (data.remetente_3_email && data.remetente_3_senha) lista.push({ email: data.remetente_3_email, senha: data.remetente_3_senha });
  return lista;
}

/**
 * Manda um e-mail, tentando o 1º remetente configurado; se falhar
 * (erro de autenticação, limite diário estourado, etc.), tenta o 2º,
 * depois o 3º.
 */
export async function enviarEmail({ para, assunto, html, texto }) {
  if (!para) {
    return { enviado: false, motivo: 'Sem e-mail cadastrado.' };
  }

  const remetentes = await obterRemetentesConfigurados();
  if (remetentes.length === 0) {
    return { enviado: false, motivo: 'Nenhum remetente de e-mail configurado ainda (veja Administração → E-mail).' };
  }

  let ultimoErro = '';
  for (const remetente of remetentes) {
    try {
      const transportador = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: remetente.email, pass: remetente.senha }
      });
      await transportador.sendMail({
        from: `"Suporte de Turma" <${remetente.email}>`,
        to: para,
        subject: assunto,
        html: html,
        text: texto
      });
      return { enviado: true };
    } catch (erro) {
      ultimoErro = erro.message;
      continue; // tenta o próximo remetente da lista
    }
  }

  return { enviado: false, motivo: 'Nenhum dos remetentes conseguiu enviar. Último erro: ' + ultimoErro };
}
