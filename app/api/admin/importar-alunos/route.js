// app/api/admin/importar-alunos/route.js
//
// Lê uma planilha Excel com colunas: NOME DO ALUNO, TURMA, (—),
// EMAIL_MAIS_RECENTE, EMAIL_ANTERIOR (ignorada), MATRICULA,
// TELEFONE_CONTATO, DATA_NASCIMENTO, EMAIL_FAMILIA,
// DONO_EMAIL_FAMILIA, OBSERVACAO.
//
// Regras (definidas pelo administrador):
// - Só cria/atualiza um aluno se a linha tiver o NOME preenchido.
// - O NOME só é gravado/alterado por aqui — nunca pelo próprio aluno.
// - As demais colunas: se vierem preenchidas na planilha, SOBRESCREVEM
//   o que já estiver no banco (mesmo que o aluno já tivesse
//   preenchido). Se vierem em branco, o valor atual do banco NÃO é
//   mexido (evita apagar o que o aluno já informou sozinho).
// - Se a turma da planilha não existir ainda, ela é criada automaticamente.

import * as XLSX from 'xlsx';
import { verificarAdmin } from '@/lib/verificarAdmin';
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
  const checagem = await verificarAdmin(req);
  if (!checagem.ok) return NextResponse.json(checagem, { status: checagem.status });

  const { arquivoBase64 } = await req.json();
  if (!arquivoBase64) {
    return NextResponse.json({ ok: false, erro: 'Nenhum arquivo enviado.' }, { status: 400 });
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
    return NextResponse.json({ ok: false, erro: 'A planilha não tem nenhuma linha de dado (só o cabeçalho, ou está vazia).' }, { status: 400 });
  }

  const { data: turmasExistentes } = await supabaseAdmin.from('turmas').select('id, nome');
  const mapaTurmas = {};
  (turmasExistentes || []).forEach((t) => { mapaTurmas[String(t.nome).trim().toLowerCase()] = t.id; });

  let criados = 0;
  let atualizados = 0;
  let pulados = 0;
  const turmasCriadas = [];
  const erros = [];

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const numeroLinha = i + 1; // +1 porque a linha 1 da planilha é o cabeçalho

    const nome = String(linha[0] || '').trim();
    if (!nome) { pulados++; continue; } // sem nome, não faz nada com essa linha

    const turmaTexto = String(linha[1] || '').trim();
    if (!turmaTexto) {
      erros.push(`Linha ${numeroLinha}: "${nome}" está sem turma definida — pulei essa linha.`);
      continue;
    }

    let turmaId = mapaTurmas[turmaTexto.toLowerCase()];
    if (!turmaId) {
      const { data: novaTurma, error: erroTurma } = await supabaseAdmin.from('turmas').insert({ nome: turmaTexto }).select().single();
      if (erroTurma) {
        erros.push(`Linha ${numeroLinha}: erro ao criar a turma "${turmaTexto}": ${erroTurma.message}`);
        continue;
      }
      turmaId = novaTurma.id;
      mapaTurmas[turmaTexto.toLowerCase()] = turmaId;
      turmasCriadas.push(turmaTexto);
    }

    const emailAluno = String(linha[3] || '').trim();
    const matricula = String(linha[5] || '').trim();
    const telefone = String(linha[6] || '').trim();
    const dataNascimento = formatarDataParaISO(linha[7]);
    const emailFamilia = String(linha[8] || '').trim();
    const donoEmailFamilia = String(linha[9] || '').trim();
    const observacao = String(linha[10] || '').trim();

    // Só entram no "pacote de atualização" os campos que vieram
    // preenchidos na planilha — em branco significa "não mexer".
    const camposOpcionais = {};
    if (emailAluno) camposOpcionais.email_aluno = emailAluno;
    if (matricula) camposOpcionais.matricula = matricula;
    if (telefone) camposOpcionais.telefone = telefone;
    if (dataNascimento) camposOpcionais.data_nascimento = dataNascimento;
    if (emailFamilia) camposOpcionais.email_familia = emailFamilia;
    if (donoEmailFamilia) camposOpcionais.dono_email_familia = donoEmailFamilia;
    if (observacao) camposOpcionais.observacao = observacao;

    const { data: alunoExistente } = await supabaseAdmin
      .from('alunos')
      .select('id')
      .eq('nome', nome)
      .eq('turma_id', turmaId)
      .maybeSingle();

    if (alunoExistente) {
      if (Object.keys(camposOpcionais).length > 0) {
        camposOpcionais.cadastro_atualizado_em = new Date().toISOString();
        const { error: erroUpdate } = await supabaseAdmin.from('alunos').update(camposOpcionais).eq('id', alunoExistente.id);
        if (erroUpdate) {
          erros.push(`Linha ${numeroLinha}: erro ao atualizar "${nome}": ${erroUpdate.message}`);
          continue;
        }
      }
      atualizados++;
    } else {
      const { error: erroInsert } = await supabaseAdmin.from('alunos').insert({ nome, turma_id: turmaId, ...camposOpcionais });
      if (erroInsert) {
        erros.push(`Linha ${numeroLinha}: erro ao criar "${nome}": ${erroInsert.message}`);
        continue;
      }
      criados++;
    }
  }

  return NextResponse.json({ ok: true, criados, atualizados, pulados, turmasCriadas, erros });
}
