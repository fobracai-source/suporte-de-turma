'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaVisaoTurma() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [turmas, setTurmas] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [carregandoVisao, setCarregandoVisao] = useState(false);
  const [visaoAlunos, setVisaoAlunos] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const resposta = await fetch('/api/professor/minhas-turmas-disciplinas', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const dados = await resposta.json();
      if (dados.ok) setTurmas(dados.turmas);
      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function carregarVisaoDaTurma(idEscolhido) {
    setTurmaId(idEscolhido);
    setVisaoAlunos([]);
    setErro('');
    if (!idEscolhido) return;

    setCarregandoVisao(true);

    // Atividades do professor logado que valem pra essa turma
    const { data: vinculos } = await supabase.from('atividade_turmas').select('atividade_id').eq('turma_id', idEscolhido);
    const atividadeIds = (vinculos || []).map((v) => v.atividade_id);

    const { data: alunosDaTurma, error: erroAlunos } = await supabase.from('alunos').select('id, nome').eq('turma_id', idEscolhido).order('nome');
    if (erroAlunos) { setErro(erroAlunos.message); setCarregandoVisao(false); return; }

    let entregasPorAluno = {};
    if (atividadeIds.length > 0) {
      const { data: entregas } = await supabase
        .from('entregas')
        .select('aluno_id, nota_calculada, atividades(valor_nota)')
        .in('atividade_id', atividadeIds);

      (entregas || []).forEach((e) => {
        if (!entregasPorAluno[e.aluno_id]) entregasPorAluno[e.aluno_id] = [];
        entregasPorAluno[e.aluno_id].push(e);
      });
    }

    const { data: ocorrencias } = await supabase.from('ocorrencias').select('aluno_id').eq('turma_id', idEscolhido);
    const ocorrenciasPorAluno = {};
    (ocorrencias || []).forEach((o) => {
      ocorrenciasPorAluno[o.aluno_id] = (ocorrenciasPorAluno[o.aluno_id] || 0) + 1;
    });

    const visao = (alunosDaTurma || []).map((aluno) => {
      const entregasDele = entregasPorAluno[aluno.id] || [];
      const totalAtividades = atividadeIds.length;
      const qtdRespondidas = entregasDele.length;

      let mediaPercentual = null;
      const comNota = entregasDele.filter((e) => e.nota_calculada !== null);
      if (comNota.length > 0) {
        const soma = comNota.reduce((s, e) => s + (e.nota_calculada / (e.atividades?.valor_nota || 1)), 0);
        mediaPercentual = Math.round((soma / comNota.length) * 1000) / 10;
      }

      return {
        alunoId: aluno.id,
        nome: aluno.nome,
        totalAtividades,
        qtdRespondidas,
        percentualEntrega: totalAtividades > 0 ? Math.round((qtdRespondidas / totalAtividades) * 100) : 100,
        mediaPercentual,
        qtdOcorrencias: ocorrenciasPorAluno[aluno.id] || 0
      };
    });

    // Quem precisa de mais atenção (menos entrega, ou mais ocorrência) aparece primeiro
    visao.sort((a, b) => {
      if (a.qtdOcorrencias !== b.qtdOcorrencias) return b.qtdOcorrencias - a.qtdOcorrencias;
      return a.percentualEntrega - b.percentualEntrega;
    });

    setVisaoAlunos(visao);
    setCarregandoVisao(false);
  }

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Visão Geral da Turma</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      <label style={{ display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>Escolha a turma</label>
      <select
        value={turmaId}
        onChange={(e) => carregarVisaoDaTurma(e.target.value)}
        style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}>
        <option value="">Selecione...</option>
        {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>

      {carregandoVisao && <p style={{ color: '#888', fontSize: 13 }}>Calculando...</p>}

      {!carregandoVisao && turmaId && visaoAlunos.length === 0 && (
        <p style={{ color: '#888', fontSize: 14 }}>Nenhum aluno encontrado nessa turma.</p>
      )}

      {visaoAlunos.map((a) => {
        const corEntrega = a.percentualEntrega >= 80 ? '#2ECC71' : a.percentualEntrega >= 50 ? '#F2C94C' : '#FF5C5C';
        const precisaAtencao = a.qtdOcorrencias > 0 || a.percentualEntrega < 50;

        return (
          <div key={a.alunoId} style={{ padding: 14, borderRadius: 10, border: precisaAtencao ? '1.5px solid #FFD5C4' : '1.5px solid #eee', background: precisaAtencao ? '#FFFAF8' : 'white', marginBottom: 10 }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: 14 }}>{a.nome}</p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Entregou</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 'bold', color: corEntrega }}>{a.qtdRespondidas}/{a.totalAtividades} ({a.percentualEntrega}%)</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Aproveitamento</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 'bold', color: '#6C5CE7' }}>{a.mediaPercentual !== null ? `${a.mediaPercentual}%` : '—'}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Ocorrências</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 'bold', color: a.qtdOcorrencias > 0 ? '#FF7A59' : '#888' }}>{a.qtdOcorrencias}</p>
              </div>
            </div>
          </div>
        );
      })}
    </main>
  );
}
