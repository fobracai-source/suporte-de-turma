// app/api/cron/enviar-digests/route.js
//
// Roda uma vez por dia (agendado no arquivo vercel.json). Pra cada
// turma, confere se HOJE é um dos dias configurados pra mandar o
// e-mail de ocorrências e/ou o de atividades. Pra cada aluno da
// turma, só manda e-mail se tiver "novidade" desde o último envio —
// nunca manda o mesmo e-mail duas vezes, mas manda uma ATUALIZAÇÃO
// (com o total acumulado) sempre que o número crescer.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { enviarEmail, escolherEmailValido } from '@/lib/email';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // pode levar um tempo se tiver muito aluno

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const NOMES_DIAS_BONITOS = { domingo: 'domingo', segunda: 'segunda-feira', terca: 'terça-feira', quarta: 'quarta-feira', quinta: 'quinta-feira', sexta: 'sexta-feira', sabado: 'sábado' };

function formatarData(dataISO) {
  if (!dataISO) return '';
  return new Date(dataISO).toLocaleDateString('pt-BR');
}

async function processarDigestDeOcorrencias(turma) {
  const { data: alunos } = await supabaseAdmin
    .from('alunos')
    .select('id, nome, email_aluno, email_aluno_2, ultima_qtd_ocorrencias_enviada')
    .eq('turma_id', turma.id);

  let enviados = 0;
  for (const aluno of alunos || []) {
    const { data: ocorrencias, count } = await supabaseAdmin
      .from('ocorrencias')
      .select('disciplina, tipo, motivos_atividades, motivos_disciplina, detalhamento, professor_nome, criado_em', { count: 'exact' })
      .eq('aluno_id', aluno.id)
      .order('criado_em', { ascending: true });

    const totalAtual = count || 0;
    if (totalAtual === 0 || totalAtual <= aluno.ultima_qtd_ocorrencias_enviada) continue; // sem novidade, pula

    const emailDestino = escolherEmailValido(aluno.email_aluno, aluno.email_aluno_2);
    if (emailDestino) {
      const linhasHtml = ocorrencias.map((o, i) => {
        const motivos = [...(o.motivos_atividades || []), ...(o.motivos_disciplina || [])].join(', ');
        return `<tr style="border-bottom:1px solid #eee;">
          <td style="padding:8px; font-size:12px; color:#888;">${i + 1}</td>
          <td style="padding:8px; font-size:13px;"><b>${o.disciplina || '—'}</b></td>
          <td style="padding:8px; font-size:13px;">${motivos}</td>
          <td style="padding:8px; font-size:12px; color:#888;">${formatarData(o.criado_em)}</td>
        </tr>`;
      }).join('');

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color:#FF7A59;">Resumo de ocorrências — ${aluno.nome}</h2>
          <p>Olá! Este é o resumo completo e atualizado de todas as ocorrências registradas até hoje (<b>${totalAtual}</b> no total).</p>
          <table style="width:100%; border-collapse:collapse; margin-top:12px;">
            <thead><tr style="background:#FFF0EA;"><th style="padding:8px; text-align:left; font-size:12px;">#</th><th style="padding:8px; text-align:left; font-size:12px;">Disciplina</th><th style="padding:8px; text-align:left; font-size:12px;">Motivo(s)</th><th style="padding:8px; text-align:left; font-size:12px;">Data</th></tr></thead>
            <tbody>${linhasHtml}</tbody>
          </table>
        </div>
      `;
      const texto = `Resumo de ocorrências de ${aluno.nome} (${totalAtual} no total):\n\n` +
        ocorrencias.map((o, i) => `${i + 1}. ${o.disciplina || '—'} — ${[...(o.motivos_atividades || []), ...(o.motivos_disciplina || [])].join(', ')} (${formatarData(o.criado_em)})`).join('\n');

      const resultado = await enviarEmail({ para: emailDestino, assunto: `Resumo de ocorrências — ${aluno.nome}`, html, texto });
      if (resultado.enviado) enviados++;
    }

    await supabaseAdmin.from('alunos').update({ ultima_qtd_ocorrencias_enviada: totalAtual }).eq('id', aluno.id);
  }
  return enviados;
}

async function processarDigestDeAtividades(turma) {
  const { data: alunos } = await supabaseAdmin
    .from('alunos')
    .select('id, nome, email_aluno, email_aluno_2, ultima_qtd_atividades_enviada')
    .eq('turma_id', turma.id);

  let enviados = 0;
  for (const aluno of alunos || []) {
    const { data: entregas, count } = await supabaseAdmin
      .from('entregas')
      .select('nota_calculada, criado_em, atividades(disciplina, aula_numero, tema, valor_nota)', { count: 'exact' })
      .eq('aluno_id', aluno.id)
      .order('criado_em', { ascending: true });

    const totalAtual = count || 0;
    if (totalAtual === 0 || totalAtual <= aluno.ultima_qtd_atividades_enviada) continue;

    const emailDestino = escolherEmailValido(aluno.email_aluno, aluno.email_aluno_2);
    if (emailDestino) {
      const linhasHtml = (entregas || []).map((e, i) => {
        const a = e.atividades || {};
        const notaTexto = e.nota_calculada !== null ? `${e.nota_calculada} / ${a.valor_nota}` : 'Em avaliação';
        return `<tr style="border-bottom:1px solid #eee;">
          <td style="padding:8px; font-size:12px; color:#888;">${i + 1}</td>
          <td style="padding:8px; font-size:13px;"><b>${a.disciplina || '—'}</b> — Aula ${a.aula_numero || '-'}</td>
          <td style="padding:8px; font-size:13px;">${a.tema || ''}</td>
          <td style="padding:8px; font-size:13px; font-weight:bold; color:#6C5CE7;">${notaTexto}</td>
          <td style="padding:8px; font-size:12px; color:#888;">${formatarData(e.criado_em)}</td>
        </tr>`;
      }).join('');

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 620px;">
          <h2 style="color:#6C5CE7;">Resumo de atividades — ${aluno.nome}</h2>
          <p>Olá! Este é o resumo completo e atualizado de todas as atividades respondidas até hoje (<b>${totalAtual}</b> no total).</p>
          <table style="width:100%; border-collapse:collapse; margin-top:12px;">
            <thead><tr style="background:#F4F2FF;"><th style="padding:8px; text-align:left; font-size:12px;">#</th><th style="padding:8px; text-align:left; font-size:12px;">Disciplina</th><th style="padding:8px; text-align:left; font-size:12px;">Tema</th><th style="padding:8px; text-align:left; font-size:12px;">Nota</th><th style="padding:8px; text-align:left; font-size:12px;">Data</th></tr></thead>
            <tbody>${linhasHtml}</tbody>
          </table>
        </div>
      `;
      const texto = `Resumo de atividades de ${aluno.nome} (${totalAtual} no total):\n\n` +
        (entregas || []).map((e, i) => {
          const a = e.atividades || {};
          const notaTexto = e.nota_calculada !== null ? `${e.nota_calculada} / ${a.valor_nota}` : 'Em avaliação';
          return `${i + 1}. ${a.disciplina || '—'} — ${a.tema || ''} — Nota: ${notaTexto} (${formatarData(e.criado_em)})`;
        }).join('\n');

      const resultado = await enviarEmail({ para: emailDestino, assunto: `Resumo de atividades — ${aluno.nome}`, html, texto });
      if (resultado.enviado) enviados++;
    }

    await supabaseAdmin.from('alunos').update({ ultima_qtd_atividades_enviada: totalAtual }).eq('id', aluno.id);
  }
  return enviados;
}

export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }

  const hoje = DIAS_SEMANA[new Date().getDay()];

  const { data: turmasOcorrencia } = await supabaseAdmin.from('turmas').select('id, nome').contains('dias_envio_ocorrencia', [hoje]);
  const { data: turmasAtividade } = await supabaseAdmin.from('turmas').select('id, nome').contains('dias_envio_atividade', [hoje]);

  let totalOcorrenciaEnviados = 0;
  for (const turma of turmasOcorrencia || []) {
    totalOcorrenciaEnviados += await processarDigestDeOcorrencias(turma);
  }

  let totalAtividadeEnviados = 0;
  for (const turma of turmasAtividade || []) {
    totalAtividadeEnviados += await processarDigestDeAtividades(turma);
  }

  return NextResponse.json({
    ok: true,
    diaDaSemana: NOMES_DIAS_BONITOS[hoje],
    turmasComOcorrenciaHoje: (turmasOcorrencia || []).map((t) => t.nome),
    turmasComAtividadeHoje: (turmasAtividade || []).map((t) => t.nome),
    emailsDeOcorrenciaEnviados: totalOcorrenciaEnviados,
    emailsDeAtividadeEnviados: totalAtividadeEnviados
  });
}
