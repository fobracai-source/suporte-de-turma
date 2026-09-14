// app/api/ranking-turma/route.js
// Calcula o ranking da turma do aluno logado, baseado no aproveitamento
// médio (nota / valor da atividade). Roda no servidor porque um aluno
// não pode ler direto as entregas de outro aluno (a segurança do banco
// bloqueia isso, e é assim mesmo que tem que ser) — aqui a gente só
// devolve o NOME e a PONTUAÇÃO de cada um, nada além disso.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ ok: false, erro: 'Sessão não encontrada.' }, { status: 401 });
  }

  const supabaseComoUsuario = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: erroUsuario } = await supabaseComoUsuario.auth.getUser();
  if (erroUsuario || !user) {
    return NextResponse.json({ ok: false, erro: 'Sessão inválida.' }, { status: 401 });
  }

  const { data: euMesmo } = await supabaseAdmin
    .from('alunos')
    .select('id, turma_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!euMesmo) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });
  }

  const { data: alunosDaTurma } = await supabaseAdmin
    .from('alunos')
    .select('id, nome')
    .eq('turma_id', euMesmo.turma_id);

  const lista = [];
  for (const aluno of alunosDaTurma || []) {
    const { data: entregas } = await supabaseAdmin
      .from('entregas')
      .select('nota_calculada, atividades(valor_nota)')
      .eq('aluno_id', aluno.id)
      .not('nota_calculada', 'is', null);

    let aproveitamento = null;
    if (entregas && entregas.length > 0) {
      const somaPercentual = entregas.reduce((soma, e) => {
        const valorMax = e.atividades?.valor_nota || 1;
        return soma + (e.nota_calculada / valorMax);
      }, 0);
      aproveitamento = Math.round((somaPercentual / entregas.length) * 1000) / 10;
    }

    lista.push({
      alunoId: aluno.id,
      nome: aluno.nome,
      aproveitamento: aproveitamento,
      qtdAtividades: (entregas || []).length,
      souEu: aluno.id === euMesmo.id
    });
  }

  // Quem não fez nenhuma atividade ainda fica no final, sem posição
  const comNota = lista.filter((a) => a.aproveitamento !== null).sort((a, b) => b.aproveitamento - a.aproveitamento);
  const semNota = lista.filter((a) => a.aproveitamento === null);

  const ranking = comNota.map((a, indice) => ({ ...a, posicao: indice + 1 }));

  return NextResponse.json({ ok: true, ranking, semAtividade: semNota });
}
