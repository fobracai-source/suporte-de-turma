// app/api/denuncia-colega/route.js
// Registra uma denúncia anônima de "colega atrapalha". Faz duas coisas:
//
// 1) Grava o registro completo (incluindo quem denunciou) na tabela
//    "denuncias" — que NINGUÉM além do sistema consegue ler (nem
//    professor, nem aluno; conferimos isso na Fase de segurança).
//
// 2) Cria também uma ocorrência "de verdade" na tabela "ocorrencias" —
//    assim ela aparece pro professor normalmente, mas com o campo de
//    "quem registrou" sempre mostrando "DENÚNCIA ANÔNIMA...", nunca o
//    nome de quem denunciou.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

const ROTULO_DENUNCIA_ANONIMA = 'DENÚNCIA ANÔNIMA (COLEGA DE TURMA)';

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

  const { data: reclamante } = await supabaseAdmin
    .from('alunos')
    .select('id, nome, turma_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!reclamante) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um aluno.' }, { status: 403 });
  }

  const { alunoDenunciadoId, disciplinaOuTodas, denuncia } = await req.json();

  if (!alunoDenunciadoId) {
    return NextResponse.json({ ok: false, erro: 'Selecione o colega.' }, { status: 400 });
  }
  if (!disciplinaOuTodas) {
    return NextResponse.json({ ok: false, erro: 'Selecione a disciplina, ou "Em todas as aulas acontece isso".' }, { status: 400 });
  }
  if (!String(denuncia || '').trim()) {
    return NextResponse.json({ ok: false, erro: 'Escreva o relato da denúncia.' }, { status: 400 });
  }
  if (Number(alunoDenunciadoId) === reclamante.id) {
    return NextResponse.json({ ok: false, erro: 'Você não pode denunciar a si mesmo(a).' }, { status: 400 });
  }

  // Confere que o colega denunciado é mesmo da mesma turma
  const { data: alunoDenunciado } = await supabaseAdmin
    .from('alunos')
    .select('id')
    .eq('id', alunoDenunciadoId)
    .eq('turma_id', reclamante.turma_id)
    .maybeSingle();

  if (!alunoDenunciado) {
    return NextResponse.json({ ok: false, erro: 'Esse colega não pertence à sua turma.' }, { status: 400 });
  }

  const ehTodasAsAulas = disciplinaOuTodas === '__TODAS__';
  const disciplinaFinal = ehTodasAsAulas ? null : disciplinaOuTodas;
  const rotuloMotivo = ehTodasAsAulas ? 'Em todas as aulas acontece isso' : ('Disciplina: ' + disciplinaOuTodas);

  // 1) Ocorrência anônima, visível pro professor
  const { data: ocorrenciaCriada, error: erroOcorrencia } = await supabaseAdmin
    .from('ocorrencias')
    .insert({
      turma_id: reclamante.turma_id,
      aluno_id: alunoDenunciadoId,
      disciplina: disciplinaFinal,
      tipo: 'Disciplina',
      motivos_disciplina: ['Denúncia de colega — ' + rotuloMotivo],
      detalhamento: String(denuncia).trim(),
      origem: 'DENUNCIA',
      professor_nome: ROTULO_DENUNCIA_ANONIMA
    })
    .select()
    .single();

  if (erroOcorrencia) {
    return NextResponse.json({ ok: false, erro: erroOcorrencia.message }, { status: 500 });
  }

  // 2) Registro completo, em segredo — só pra rastreabilidade interna,
  // ninguém além do sistema consegue ler essa tabela.
  const { error: erroDenuncia } = await supabaseAdmin.from('denuncias').insert({
    turma_id: reclamante.turma_id,
    reclamante: reclamante.nome,
    aluno_denunciado_id: alunoDenunciadoId,
    disciplina_ou_todas: rotuloMotivo,
    denuncia: String(denuncia).trim(),
    ocorrencia_id: ocorrenciaCriada.id
  });

  if (erroDenuncia) {
    return NextResponse.json({ ok: false, erro: erroDenuncia.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
