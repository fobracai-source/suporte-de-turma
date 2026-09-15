// app/api/cron/lembretes-agenda/route.js
// Roda uma vez por dia. Confere o que está marcado pra AMANHÃ (eventos
// e prazos de atividade) e manda um lembrete por e-mail — só uma vez
// por evento (controlado pela tabela lembretes_enviados).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { enviarEmail, escolherEmailValido } from '@/lib/email';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function amanha() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function jaFoiEnviado(tipo, referenciaId) {
  const { data } = await supabaseAdmin.from('lembretes_enviados').select('id').eq('tipo', tipo).eq('referencia_id', referenciaId).maybeSingle();
  return !!data;
}

async function marcarComoEnviado(tipo, referenciaId) {
  await supabaseAdmin.from('lembretes_enviados').insert({ tipo, referencia_id: referenciaId });
}

async function notificarAlunosDaTurma(turmaId, assunto, tituloEmail, mensagemEmail) {
  const { data: alunos } = await supabaseAdmin.from('alunos').select('nome, email_aluno, email_aluno_2').eq('turma_id', turmaId);
  let enviados = 0;
  for (const aluno of alunos || []) {
    const emailDestino = escolherEmailValido(aluno.email_aluno, aluno.email_aluno_2);
    if (!emailDestino) continue;
    const resultado = await enviarEmail({
      para: emailDestino,
      assunto,
      html: `<div style="font-family: Arial, sans-serif; max-width:480px;"><h2 style="color:#6C5CE7;">⏰ ${tituloEmail}</h2><p>Olá, <b>${aluno.nome}</b>!</p><p>${mensagemEmail}</p></div>`,
      texto: `${tituloEmail}\n\nOlá, ${aluno.nome}! ${mensagemEmail}`
    });
    if (resultado.enviado) enviados++;
  }
  return enviados;
}

export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }

  const dataAlvo = amanha();
  let totalEnviados = 0;

  // Eventos (prova, trabalho, evento escolar) marcados pra amanhã
  const { data: eventos } = await supabaseAdmin.from('eventos_agenda').select('id, tipo, titulo, disciplina, turma_id').eq('data_evento', dataAlvo);
  for (const evento of eventos || []) {
    if (await jaFoiEnviado('evento', evento.id)) continue;

    const rotuloTipo = evento.tipo === 'prova' ? 'Prova' : evento.tipo === 'trabalho' ? 'Trabalho' : 'Evento';
    const mensagem = `Amanhã tem <b>${rotuloTipo.toLowerCase()}</b>: ${evento.titulo}${evento.disciplina ? ` (${evento.disciplina})` : ''}. Não esqueça!`;

    if (evento.turma_id) {
      totalEnviados += await notificarAlunosDaTurma(evento.turma_id, `Lembrete: ${evento.titulo} amanhã`, `${rotuloTipo}: ${evento.titulo}`, mensagem);
    } else {
      const { data: todasTurmas } = await supabaseAdmin.from('turmas').select('id');
      for (const turma of todasTurmas || []) {
        totalEnviados += await notificarAlunosDaTurma(turma.id, `Lembrete: ${evento.titulo} amanhã`, `${rotuloTipo}: ${evento.titulo}`, mensagem);
      }
    }
    await marcarComoEnviado('evento', evento.id);
  }

  // Atividades com prazo de entrega pra amanhã
  const { data: atividades } = await supabaseAdmin
    .from('atividades')
    .select('id, disciplina, tema, atividade_turmas(turma_id)')
    .eq('data_final', dataAlvo);

  for (const atividade of atividades || []) {
    if (await jaFoiEnviado('atividade', atividade.id)) continue;

    const mensagem = `Amanhã encerra o prazo da atividade <b>${atividade.tema}</b> (${atividade.disciplina}). Não perca!`;
    for (const vinculo of atividade.atividade_turmas || []) {
      totalEnviados += await notificarAlunosDaTurma(vinculo.turma_id, `Lembrete: prazo de "${atividade.tema}" amanhã`, `Prazo de entrega: ${atividade.tema}`, mensagem);
    }
    await marcarComoEnviado('atividade', atividade.id);
  }

  return NextResponse.json({ ok: true, dataAlvo, totalEnviados });
}
