// app/api/anexos/url-assinada/route.js
// Gera um link temporário (válido por alguns minutos) pra abrir um
// anexo — de entrega, ocorrência ou defesa. Só devolve o link se quem
// está pedindo tiver permissão de verdade pra aquele registro
// específico. O arquivo em si nunca fica acessível por link fixo.
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

  const { tipo, registroId, caminhoArquivo } = await req.json();
  if (!tipo || !registroId || !caminhoArquivo) {
    return NextResponse.json({ ok: false, erro: 'Dados incompletos.' }, { status: 400 });
  }

  const { data: aluno } = await supabaseAdmin.from('alunos').select('id').eq('auth_user_id', user.id).maybeSingle();
  const { data: professor } = await supabaseAdmin.from('professores').select('id').eq('auth_user_id', user.id).maybeSingle();

  let temPermissao = false;

  if (tipo === 'entrega') {
    const { data: registro } = await supabaseAdmin
      .from('entregas')
      .select('aluno_id, arquivos, atividades(professor_id)')
      .eq('id', registroId)
      .maybeSingle();
    if (registro && (registro.arquivos || []).includes(caminhoArquivo)) {
      temPermissao = (aluno && aluno.id === registro.aluno_id) || (professor && professor.id === registro.atividades?.professor_id);
    }
  } else if (tipo === 'ocorrencia') {
    const { data: registro } = await supabaseAdmin
      .from('ocorrencias')
      .select('aluno_id, anexos, turma_id')
      .eq('id', registroId)
      .maybeSingle();
    if (registro && (registro.anexos || []).includes(caminhoArquivo)) {
      let ehProfessorDaTurma = false;
      if (professor) {
        const { data: vinculo } = await supabaseAdmin.from('professor_turmas').select('turma_id').eq('professor_id', professor.id).eq('turma_id', registro.turma_id).maybeSingle();
        ehProfessorDaTurma = !!vinculo;
      }
      temPermissao = (aluno && aluno.id === registro.aluno_id) || ehProfessorDaTurma;
    }
  } else if (tipo === 'defesa') {
    const { data: registro } = await supabaseAdmin
      .from('defesa_ocorrencias')
      .select('aluno_id, anexos, turma_id')
      .eq('id', registroId)
      .maybeSingle();
    if (registro && (registro.anexos || []).includes(caminhoArquivo)) {
      let ehProfessorDaTurma = false;
      if (professor) {
        const { data: vinculo } = await supabaseAdmin.from('professor_turmas').select('turma_id').eq('professor_id', professor.id).eq('turma_id', registro.turma_id).maybeSingle();
        ehProfessorDaTurma = !!vinculo;
      }
      temPermissao = (aluno && aluno.id === registro.aluno_id) || ehProfessorDaTurma;
    }
  } else if (tipo === 'material') {
    const { data: registro } = await supabaseAdmin
      .from('materiais')
      .select('turma_id, professor_id, caminho_arquivo')
      .eq('id', registroId)
      .maybeSingle();
    if (registro && registro.caminho_arquivo === caminhoArquivo) {
      let ehProfessorDaTurma = false;
      if (professor) {
        const { data: vinculo } = await supabaseAdmin.from('professor_turmas').select('turma_id').eq('professor_id', professor.id).eq('turma_id', registro.turma_id).maybeSingle();
        ehProfessorDaTurma = !!vinculo;
      }
      const ehAlunoDaTurma = aluno && (await supabaseAdmin.from('alunos').select('id').eq('id', aluno.id).eq('turma_id', registro.turma_id).maybeSingle()).data;
      temPermissao = !!ehAlunoDaTurma || ehProfessorDaTurma;
    }
  } else {
    return NextResponse.json({ ok: false, erro: 'Tipo inválido.' }, { status: 400 });
  }

  if (!temPermissao) {
    return NextResponse.json({ ok: false, erro: 'Você não tem permissão pra ver esse anexo.' }, { status: 403 });
  }

  const { data: linkAssinado, error: erroLink } = await supabaseAdmin
    .storage
    .from('anexos')
    .createSignedUrl(caminhoArquivo, 300); // válido por 5 minutos

  if (erroLink) {
    return NextResponse.json({ ok: false, erro: erroLink.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: linkAssinado.signedUrl });
}
