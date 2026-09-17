// app/api/cron/fechar-semana/route.js
// Roda uma vez por semana (segunda-feira de manhã). Faz 3 coisas:
// 1) Dá 150 pontos pra quem NÃO teve nenhuma ocorrência na semana
//    passada.
// 2) Calcula o ranking de pontos da semana passada, por turma.
// 3) Registra o pódio no histórico, e avisa os vencedores por e-mail.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { enviarEmail, escolherEmailValido } from '@/lib/email';
import { verificarEPremiarMissoes } from '@/lib/gamificacao';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function limitesDaSemanaPassada() {
  const hoje = new Date();
  const diaDaSemana = hoje.getDay();
  const inicioDessaSemana = new Date(hoje);
  inicioDessaSemana.setDate(hoje.getDate() - (diaDaSemana === 0 ? 6 : diaDaSemana - 1));
  inicioDessaSemana.setHours(0, 0, 0, 0);

  const inicioSemanaPassada = new Date(inicioDessaSemana);
  inicioSemanaPassada.setDate(inicioSemanaPassada.getDate() - 7);

  const fimSemanaPassada = new Date(inicioDessaSemana);
  fimSemanaPassada.setMilliseconds(-1); // 1ms antes do início dessa semana

  return { inicioSemanaPassada, fimSemanaPassada };
}

export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }

  const { inicioSemanaPassada, fimSemanaPassada } = limitesDaSemanaPassada();
  const { data: turmas } = await supabaseAdmin.from('turmas').select('id');
  const { data: premios } = await supabaseAdmin.from('premios_semanais').select('posicao, titulo, emoji').order('posicao');

  let bonusOcorrenciaDados = 0;
  let vencedoresNotificados = 0;

  for (const turma of turmas || []) {
    const { data: alunos } = await supabaseAdmin.from('alunos').select('id, nome, email_aluno, email_aluno_2').eq('turma_id', turma.id);

    // 1) Bônus de "sem ocorrência" na semana passada
    for (const aluno of alunos || []) {
      const { count: qtdOcorrencias } = await supabaseAdmin
        .from('ocorrencias')
        .select('id', { count: 'exact', head: true })
        .eq('aluno_id', aluno.id)
        .gte('criado_em', inicioSemanaPassada.toISOString())
        .lte('criado_em', fimSemanaPassada.toISOString());

      if ((qtdOcorrencias || 0) === 0) {
        await supabaseAdmin.from('pontos_historico').insert({
          aluno_id: aluno.id,
          pontos: 150,
          origem: 'sem_ocorrencia',
          descricao: 'Semana sem nenhuma ocorrência'
        });
        await supabaseAdmin.rpc('incrementar_pontos_aluno', { p_aluno_id: aluno.id, p_pontos: 150 });
        bonusOcorrenciaDados++;
        await verificarEPremiarMissoes(aluno.id);
      }
    }

    // 2) Ranking de pontos da semana passada, só dessa turma
    const pontuacaoDaSemana = [];
    for (const aluno of alunos || []) {
      const { data: historico } = await supabaseAdmin
        .from('pontos_historico')
        .select('pontos')
        .eq('aluno_id', aluno.id)
        .gte('criado_em', inicioSemanaPassada.toISOString())
        .lte('criado_em', fimSemanaPassada.toISOString());

      const total = (historico || []).reduce((soma, h) => soma + h.pontos, 0);
      if (total > 0) pontuacaoDaSemana.push({ aluno, total });
    }
    pontuacaoDaSemana.sort((a, b) => b.total - a.total);

    // 3) Registra o pódio e avisa os vencedores (só até onde tiver prêmio configurado)
    const qtdPremiados = Math.min(pontuacaoDaSemana.length, (premios || []).length);
    for (let i = 0; i < qtdPremiados; i++) {
      const posicao = i + 1;
      const ganhador = pontuacaoDaSemana[i];
      const premio = (premios || []).find((p) => p.posicao === posicao);

      await supabaseAdmin.from('premios_semanais_historico').insert({
        semana_inicio: inicioSemanaPassada.toISOString().slice(0, 10),
        turma_id: turma.id,
        aluno_id: ganhador.aluno.id,
        posicao,
        pontos_da_semana: ganhador.total
      });

      const emailDestino = escolherEmailValido(ganhador.aluno.email_aluno, ganhador.aluno.email_aluno_2);
      if (emailDestino && premio) {
        const resultado = await enviarEmail({
          para: emailDestino,
          assunto: `🏆 Parabéns! Você ficou em ${posicao}º lugar essa semana!`,
          html: `<div style="font-family: Arial, sans-serif; max-width:480px;"><h2 style="color:#F2C94C;">${premio.emoji} ${posicao}º lugar da semana!</h2><p>Olá, <b>${ganhador.aluno.nome}</b>!</p><p>Você ficou em <b>${posicao}º lugar</b> no ranking da sua turma essa semana, com <b>${ganhador.total} pontos</b>!</p><p>Prêmio: <b>${premio.titulo}</b></p></div>`,
          texto: `Parabéns, ${ganhador.aluno.nome}! Você ficou em ${posicao}º lugar essa semana, com ${ganhador.total} pontos. Prêmio: ${premio.titulo}`
        });
        if (resultado.enviado) vencedoresNotificados++;
      }
    }
  }

  return NextResponse.json({ ok: true, bonusOcorrenciaDados, vencedoresNotificados });
}
