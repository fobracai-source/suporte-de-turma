// app/api/cron/gerar-ocorrencias-atraso/route.js
//
// Roda uma vez por dia (agendado no vercel.json), de manhã cedo — antes
// do robô de e-mails, pra já incluir as ocorrências novas no resumo do
// dia. Confere todas as atividades cujo prazo já passou; pra cada
// aluno da turma que NÃO entregou, cria uma ocorrência automática. Se
// o aluno entregar depois (mesmo atrasado), a ocorrência automática
// correspondente é removida sozinha.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ROTULO_SISTEMA = 'Sistema (atraso automático)';
const MOTIVO_ATRASO = 'Atividade não realizada dentro do prazo';

export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }

  const hojeISO = new Date().toISOString().slice(0, 10);

  // 1) Atividades cujo prazo já passou
  const { data: atividadesVencidas } = await supabaseAdmin
    .from('atividades')
    .select('id, disciplina, tema, data_final, atividade_turmas(turma_id)')
    .lt('data_final', hojeISO)
    .not('data_final', 'is', null);

  let criadas = 0;
  let removidas = 0;

  for (const atividade of atividadesVencidas || []) {
    const turmaIds = (atividade.atividade_turmas || []).map((v) => v.turma_id);
    if (turmaIds.length === 0) continue;

    const { data: alunosDasTurmas } = await supabaseAdmin
      .from('alunos')
      .select('id, turma_id')
      .in('turma_id', turmaIds);

    for (const aluno of alunosDasTurmas || []) {
      const { data: entregaExistente } = await supabaseAdmin
        .from('entregas')
        .select('id')
        .eq('aluno_id', aluno.id)
        .eq('atividade_id', atividade.id)
        .maybeSingle();

      const { data: ocorrenciaAutomaticaExistente } = await supabaseAdmin
        .from('ocorrencias')
        .select('id')
        .eq('aluno_id', aluno.id)
        .eq('codigo_tema_ref', atividade.id)
        .eq('origem', 'AUTOMATICA')
        .maybeSingle();

      if (entregaExistente) {
        // O aluno já entregou (mesmo que atrasado) — se existir uma
        // ocorrência automática dessa atividade, remove ela.
        if (ocorrenciaAutomaticaExistente) {
          await supabaseAdmin.from('ocorrencias').delete().eq('id', ocorrenciaAutomaticaExistente.id);
          removidas++;
        }
        continue;
      }

      // Não entregou — se ainda não existe a ocorrência automática
      // dessa atividade pra esse aluno, cria agora.
      if (!ocorrenciaAutomaticaExistente) {
        await supabaseAdmin.from('ocorrencias').insert({
          turma_id: aluno.turma_id,
          aluno_id: aluno.id,
          disciplina: atividade.disciplina,
          tipo: 'Atividades',
          motivos_atividades: [MOTIVO_ATRASO],
          detalhamento: `Atividade "${atividade.tema}" — prazo encerrado em ${new Date(atividade.data_final).toLocaleDateString('pt-BR')}.`,
          origem: 'AUTOMATICA',
          professor_nome: ROTULO_SISTEMA,
          codigo_tema_ref: atividade.id
        });
        criadas++;
      }
    }
  }

  return NextResponse.json({ ok: true, ocorrenciasCriadas: criadas, ocorrenciasRemovidas: removidas });
}
