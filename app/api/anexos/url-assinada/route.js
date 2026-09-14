// app/api/anexos/url-assinada/route.js
// Gera um link temporário (válido por alguns minutos) pra abrir um
// anexo — só devolve o link se quem está pedindo for o dono do
// arquivo, ou o professor da atividade correspondente. O arquivo em
// si nunca fica acessível por link fixo/permanente.
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

  const { entregaId, caminhoArquivo } = await req.json();
  if (!entregaId || !caminhoArquivo) {
    return NextResponse.json({ ok: false, erro: 'Dados incompletos.' }, { status: 400 });
  }

  const { data: entrega } = await supabaseAdmin
    .from('entregas')
    .select('aluno_id, arquivos, atividades(professor_id)')
    .eq('id', entregaId)
    .maybeSingle();

  if (!entrega || !(entrega.arquivos || []).includes(caminhoArquivo)) {
    return NextResponse.json({ ok: false, erro: 'Anexo não encontrado.' }, { status: 404 });
  }

  // Confere se quem pediu é o próprio dono do arquivo, ou o professor
  // dessa atividade
  const { data: aluno } = await supabaseAdmin.from('alunos').select('id').eq('auth_user_id', user.id).maybeSingle();
  const { data: professor } = await supabaseAdmin.from('professores').select('id').eq('auth_user_id', user.id).maybeSingle();

  const ehDono = aluno && aluno.id === entrega.aluno_id;
  const ehProfessorDaAtividade = professor && professor.id === entrega.atividades?.professor_id;

  if (!ehDono && !ehProfessorDaAtividade) {
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
