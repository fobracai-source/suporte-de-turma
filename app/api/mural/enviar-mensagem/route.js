// app/api/mural/enviar-mensagem/route.js
// Grava uma mensagem no mural ou no chat de uma turma. Confere, no
// servidor, quem está mandando (pelo login) e se ele tem relação com
// aquela turma — e só deixa marcar como "aviso" quem for professor
// (aluno só pode mandar mensagem de "chat").
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

  const { turmaId, tipo, mensagem } = await req.json();
  if (!turmaId || !tipo || !mensagem || !mensagem.trim()) {
    return NextResponse.json({ ok: false, erro: 'Preencha a mensagem.' }, { status: 400 });
  }
  if (tipo !== 'aviso' && tipo !== 'chat') {
    return NextResponse.json({ ok: false, erro: 'Tipo inválido.' }, { status: 400 });
  }

  const { data: aluno } = await supabaseAdmin.from('alunos').select('id, nome, turma_id').eq('auth_user_id', user.id).maybeSingle();
  const { data: professor } = await supabaseAdmin.from('professores').select('id, nome').eq('auth_user_id', user.id).maybeSingle();

  let dadosAutor = null;

  if (aluno) {
    if (String(aluno.turma_id) !== String(turmaId)) {
      return NextResponse.json({ ok: false, erro: 'Essa turma não é a sua.' }, { status: 403 });
    }
    if (tipo === 'aviso') {
      return NextResponse.json({ ok: false, erro: 'Só o professor pode publicar avisos — você pode mandar mensagem no chat.' }, { status: 403 });
    }
    dadosAutor = { autor_tipo: 'aluno', autor_nome: aluno.nome, aluno_id: aluno.id, professor_id: null };
  } else if (professor) {
    const { data: vinculo } = await supabaseAdmin.from('professor_turmas').select('turma_id').eq('professor_id', professor.id).eq('turma_id', turmaId).maybeSingle();
    if (!vinculo) {
      return NextResponse.json({ ok: false, erro: 'Essa turma não está vinculada ao seu cadastro.' }, { status: 403 });
    }
    dadosAutor = { autor_tipo: 'professor', autor_nome: professor.nome, aluno_id: null, professor_id: professor.id };
  } else {
    return NextResponse.json({ ok: false, erro: 'Conta não reconhecida.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('mural_mensagens').insert({
    turma_id: turmaId,
    tipo,
    mensagem: mensagem.trim(),
    ...dadosAutor
  });

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  // Ponto de participação no chat — 50 pontos, só UMA VEZ por semana
  // (não é por mensagem — é só "participou essa semana ou não")
  if (dadosAutor.autor_tipo === 'aluno' && tipo === 'chat') {
    const hoje = new Date();
    const diaDaSemana = hoje.getDay(); // 0 = domingo
    const inicioDaSemana = new Date(hoje);
    inicioDaSemana.setDate(hoje.getDate() - (diaDaSemana === 0 ? 6 : diaDaSemana - 1));
    inicioDaSemana.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from('pontos_historico')
      .select('id', { count: 'exact', head: true })
      .eq('aluno_id', dadosAutor.aluno_id)
      .eq('origem', 'chat')
      .gte('criado_em', inicioDaSemana.toISOString());

    if ((count || 0) === 0) {
      await supabaseAdmin.from('pontos_historico').insert({
        aluno_id: dadosAutor.aluno_id,
        pontos: 50,
        origem: 'chat',
        descricao: 'Participou do chat da turma essa semana'
      });
      await supabaseAdmin.rpc('incrementar_pontos_aluno', { p_aluno_id: dadosAutor.aluno_id, p_pontos: 50 });
    }
  }

  return NextResponse.json({ ok: true });
}
