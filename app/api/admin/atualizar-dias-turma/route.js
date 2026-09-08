// app/api/admin/atualizar-dias-turma/route.js
import { verificarAdmin } from '@/lib/verificarAdmin';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

const DIAS_VALIDOS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

export async function POST(req) {
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { turmaId, diasOcorrencia, diasAtividade } = await req.json();
  if (!turmaId) {
    return NextResponse.json({ ok: false, erro: 'Turma não informada.' }, { status: 400 });
  }

  const limparDias = (lista) => (lista || []).filter((d) => DIAS_VALIDOS.includes(d));

  const { error } = await supabaseAdmin
    .from('turmas')
    .update({
      dias_envio_ocorrencia: limparDias(diasOcorrencia),
      dias_envio_atividade: limparDias(diasAtividade)
    })
    .eq('id', turmaId);

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
