'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaAnaliseQuestoes() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [disciplinas, setDisciplinas] = useState([]);
  const [disciplina, setDisciplina] = useState('');
  const [atividades, setAtividades] = useState([]);
  const [atividadeId, setAtividadeId] = useState('');
  const [carregandoAnalise, setCarregandoAnalise] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const resposta = await fetch('/api/professor/minhas-turmas-disciplinas', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const dados = await resposta.json();
      if (dados.ok) setDisciplinas(dados.disciplinas);

      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function mudarDisciplina(disciplinaEscolhida) {
    setDisciplina(disciplinaEscolhida);
    setAtividadeId('');
    setResultado(null);
    setAtividades([]);
    if (!disciplinaEscolhida) return;

    // Reaproveita a segurança (RLS): o professor só enxerga as
    // próprias atividades
    const { data } = await supabase
      .from('atividades')
      .select('id, aula_numero, tema, gabarito')
      .eq('disciplina', disciplinaEscolhida)
      .order('aula_numero');

    // Só faz sentido analisar quem tem gabarito
    setAtividades((data || []).filter((a) => (a.gabarito || []).length > 0));
  }

  async function analisar(idEscolhido) {
    setAtividadeId(idEscolhido);
    setResultado(null);
    setErro('');
    if (!idEscolhido) return;

    setCarregandoAnalise(true);
    try {
      const resposta = await fetch('/api/professor/analise-questoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ atividadeId: idEscolhido })
      });
      const dados = await resposta.json();
      setCarregandoAnalise(false);
      if (!dados.ok) { setErro(dados.erro); return; }
      setResultado(dados);
    } catch (e) {
      setCarregandoAnalise(false);
      setErro('Erro inesperado: ' + e.message);
    }
  }

  const medalha = (posicao) => {
    if (posicao === 0) return '🥇';
    if (posicao === 1) return '🥈';
    if (posicao === 2) return '🥉';
    return null;
  };

  const corPorErro = (percentual) => {
    if (percentual >= 60) return '#FF5C5C';
    if (percentual >= 30) return '#F2C94C';
    return '#2ECC71';
  };

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Questões com mais erro</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      <label style={{ display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>Disciplina</label>
      <select
        value={disciplina}
        onChange={(e) => mudarDisciplina(e.target.value)}
        style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}>
        <option value="">Selecione...</option>
        {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      {disciplina && (
        <>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>Atividade</label>
          <select
            value={atividadeId}
            onChange={(e) => analisar(e.target.value)}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}>
            <option value="">Selecione...</option>
            {atividades.map((a) => <option key={a.id} value={a.id}>Aula {a.aula_numero} — {a.tema}</option>)}
          </select>
          {atividades.length === 0 && <p style={{ color: '#888', fontSize: 13, marginTop: -12 }}>Nenhuma atividade com gabarito nessa disciplina.</p>}
        </>
      )}

      {carregandoAnalise && <p style={{ color: '#888', fontSize: 13 }}>Calculando...</p>}

      {resultado && (
        <>
          <div style={{ background: '#F4F2FF', borderRadius: 10, padding: 14, marginBottom: 16, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 'bold' }}>{resultado.tema}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#888' }}>{resultado.totalRespondentes} aluno(s) responderam</p>
          </div>

          {resultado.totalRespondentes === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>Ninguém respondeu essa atividade ainda.</p>
          ) : (
            resultado.analise.map((q, indice) => (
              <div key={q.numero} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 8 }}>
                <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{medalha(indice) || `${indice + 1}º`}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>Questão {q.numero}</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#888' }}>Resposta certa: {q.respostaCerta} — {q.acertos} acerto(s), {q.erros} erro(s)</p>
                </div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 'bold', color: corPorErro(q.percentualErro) }}>{q.percentualErro}%</p>
              </div>
            ))
          )}
        </>
      )}
    </main>
  );
}
