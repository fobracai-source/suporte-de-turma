// app/api/professor/analise-questoes/route.js
// Calcula, pra uma atividade, o percentual de erro de CADA questão —
// olhando todas as respostas já entregues por qualquer aluno. Só o
// professor DONO da atividade pode consultar (o gabarito é dado dele
// mesmo, não tem problema nenhum ele ver — quem nunca pode ver é o
// aluno).
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

  const { data: professor } = await supabaseAdmin
    .from('professores')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!professor) {
    return NextResponse.json({ ok: false, erro: 'Essa conta não é de um professor.' }, { status: 403 });
  }

  const { atividadeId } = await req.json();
  if (!atividadeId) {
    return NextResponse.json({ ok: false, erro: 'Atividade não informada.' }, { status: 400 });
  }

  const { data: atividade } = await supabaseAdmin
    .from('atividades')
    .select('id, professor_id, disciplina, tema, gabarito')
    .eq('id', atividadeId)
    .maybeSingle();

  if (!atividade || atividade.professor_id !== professor.id) {
    return NextResponse.json({ ok: false, erro: 'Essa atividade não é sua.' }, { status: 403 });
  }

  const gabarito = atividade.gabarito || [];
  if (gabarito.length === 0) {
    return NextResponse.json({ ok: false, erro: 'Essa atividade não tem gabarito (é do tipo trabalho/entrega) — não dá pra analisar questão por questão.' }, { status: 400 });
  }

  const { data: entregas } = await supabaseAdmin
    .from('entregas')
    .select('respostas')
    .eq('atividade_id', atividadeId);

  const totalRespondentes = (entregas || []).length;

  const analise = gabarito.map((respostaCerta, indice) => {
    let acertos = 0;
    (entregas || []).forEach((e) => {
      const respostaAluno = String((e.respostas || [])[indice] || '').trim().toUpperCase();
      if (respostaAluno === String(respostaCerta).trim().toUpperCase()) acertos++;
    });
    const erros = totalRespondentes - acertos;
    const percentualErro = totalRespondentes > 0 ? Math.round((erros / totalRespondentes) * 1000) / 10 : 0;

    return {
      numero: indice + 1,
      respostaCerta: respostaCerta,
      acertos,
      erros,
      percentualErro
    };
  });

  // Pódio: quem errou mais vem primeiro
  analise.sort((a, b) => b.percentualErro - a.percentualErro);

  return NextResponse.json({
    ok: true,
    disciplina: atividade.disciplina,
    tema: atividade.tema,
    totalRespondentes,
    analise
  });
}
