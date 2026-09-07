// app/api/defesa-ocorrencia/route.js
// Grava a defesa do aluno pra uma ocorrência. Confere, no servidor,
// quem está mandando (pelo token de sessão), e usa isso — nunca um
// valor que o navegador tenha mandado — como o "dono" da defesa.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(req) {
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

  const { data: aluno } = await supabaseAdmin
    .from('alunos')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!aluno) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });
  }

  const { ocorrenciaId, justificativa, naoQuisJustificar } = await req.json();
  if (!ocorrenciaId) {
    return NextResponse.json({ ok: false, erro: 'Ocorrência não informada.' }, { status: 400 });
  }
  if (!naoQuisJustificar && !String(justificativa || '').trim()) {
    return NextResponse.json({ ok: false, erro: 'Escreva sua justificativa, ou marque "Não quero justificar".' }, { status: 400 });
  }

  // Confere que essa ocorrência é mesmo do aluno que está pedindo
  const { data: ocorrencia } = await supabaseAdmin
    .from('ocorrencias')
    .select('id, turma_id, aluno_id')
    .eq('id', ocorrenciaId)
    .maybeSingle();

  if (!ocorrencia || ocorrencia.aluno_id !== aluno.id) {
    return NextResponse.json({ ok: false, erro: 'Essa ocorrência não pertence a você.' }, { status: 403 });
  }

  // Confere se já existe uma defesa pra essa ocorrência (evita duplicar)
  const { data: defesaExistente } = await supabaseAdmin
    .from('defesa_ocorrencias')
    .select('id')
    .eq('ocorrencia_id', ocorrenciaId)
    .eq('aluno_id', aluno.id)
    .maybeSingle();

  if (defesaExistente) {
    return NextResponse.json({ ok: false, erro: 'Você já se manifestou sobre essa ocorrência.' }, { status: 409 });
  }

  const { error: erroGravar } = await supabaseAdmin.from('defesa_ocorrencias').insert({
    ocorrencia_id: ocorrenciaId,
    aluno_id: aluno.id,
    turma_id: ocorrencia.turma_id,
    justificativa: naoQuisJustificar ? '' : String(justificativa || '').trim(),
    nao_quis_justificar: !!naoQuisJustificar
  });

  if (erroGravar) {
    return NextResponse.json({ ok: false, erro: erroGravar.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
