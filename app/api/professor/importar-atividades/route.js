// app/api/professor/importar-atividades/route.js
//
// O professor escolhe UMA disciplina e as turmas (valem pra toda a
// planilha inteira, já que normalmente é um professor subindo o
// próprio conjunto de aulas de uma vez). O arquivo só precisa ter,
// nesta ordem: Nº da aula | Tema | Data inicial | Data final |
// Valor da nota | Gabarito (ex.: "ABCAB", ou em branco se não tiver
// correção automática).
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

function formatarDataParaISO(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  const texto = String(valor).trim();
  const comBarra = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (comBarra) return `${comBarra[3]}-${comBarra[2].padStart(2, '0')}-${comBarra[1].padStart(2, '0')}`;
  const comTraco = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (comTraco) return `${comTraco[1]}-${comTraco[2].padStart(2, '0')}-${comTraco[3].padStart(2, '0')}`;
  return null;
}

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

  const { disciplina, turmaIds, arquivoBase64 } = await req.json();

  if (!disciplina) return NextResponse.json({ ok: false, erro: 'Selecione a disciplina.' }, { status: 400 });
  if (!turmaIds || turmaIds.length === 0) return NextResponse.json({ ok: false, erro: 'Selecione pelo menos uma turma.' }, { status: 400 });
  if (!arquivoBase64) return NextResponse.json({ ok: false, erro: 'Nenhum arquivo enviado.' }, { status: 400 });

  // Confere que a disciplina e as turmas são mesmo do professor
  const { data: disciplinaDele } = await supabaseAdmin
    .from('professor_disciplinas').select('disciplina').eq('professor_id', professor.id).eq('disciplina', disciplina).maybeSingle();
  if (!disciplinaDele) {
    return NextResponse.json({ ok: false, erro: 'Essa disciplina não está vinculada ao seu cadastro.' }, { status: 403 });
  }

  const { data: turmasDele } = await supabaseAdmin.from('professor_turmas').select('turma_id').eq('professor_id', professor.id);
  const turmasPermitidas = (turmasDele || []).map((t) => t.turma_id);
  if (turmaIds.some((id) => !turmasPermitidas.includes(id))) {
    return NextResponse.json({ ok: false, erro: 'Uma ou mais turmas escolhidas não estão vinculadas ao seu cadastro.' }, { status: 403 });
  }

  let linhas;
  try {
    const buffer = Buffer.from(arquivoBase64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const planilha = workbook.Sheets[workbook.SheetNames[0]];
    linhas = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: '' });
  } catch (erroLeitura) {
    return NextResponse.json({ ok: false, erro: 'Não consegui ler o arquivo. Confira se é um .xlsx válido.' }, { status: 400 });
  }

  if (!linhas || linhas.length < 2) {
    return NextResponse.json({ ok: false, erro: 'A planilha não tem nenhuma linha de dado.' }, { status: 400 });
  }

  let criadas = 0;
  const erros = [];

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const numeroLinha = i + 1;

    const aulaNumero = linha[0];
    if (aulaNumero === '' || aulaNumero === null || isNaN(Number(aulaNumero))) continue; // pula linha vazia/cabeçalho repetido

    const tema = String(linha[1] || '').trim();
    if (!tema) { erros.push(`Linha ${numeroLinha}: sem tema, pulei.`); continue; }

    const dataInicial = formatarDataParaISO(linha[2]);
    const dataFinal = formatarDataParaISO(linha[3]);
    const valorNota = Number(linha[4] || 0);
    const gabaritoTexto = String(linha[5] || '').toUpperCase().replace(/[^A-E]/g, '');
    const gabaritoArray = gabaritoTexto ? gabaritoTexto.split('') : [];

    const { data: atividadeCriada, error: erroAtividade } = await supabaseAdmin
      .from('atividades')
      .insert({
        disciplina, professor_id: professor.id, aula_numero: Number(aulaNumero), tema,
        data_inicial: dataInicial, data_final: dataFinal, valor_nota: valorNota, gabarito: gabaritoArray
      })
      .select()
      .single();

    if (erroAtividade) {
      erros.push(`Linha ${numeroLinha}: erro ao criar "${tema}": ${erroAtividade.message}`);
      continue;
    }

    const vinculos = turmaIds.map((turmaId) => ({ atividade_id: atividadeCriada.id, turma_id: turmaId }));
    const { error: erroVinculo } = await supabaseAdmin.from('atividade_turmas').insert(vinculos);
    if (erroVinculo) {
      erros.push(`Linha ${numeroLinha}: atividade "${tema}" criada, mas erro ao vincular turma: ${erroVinculo.message}`);
      continue;
    }

    criadas++;
  }

  return NextResponse.json({ ok: true, criadas, erros });
}
