'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaRegistrarOcorrencia() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [turmas, setTurmas] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [disciplina, setDisciplina] = useState('');
  const [tiposAtividade, setTiposAtividade] = useState([]);
  const [tiposDisciplina, setTiposDisciplina] = useState([]);

  const [turmaId, setTurmaId] = useState('');
  const [alunosDaTurma, setAlunosDaTurma] = useState([]);
  const [alunoId, setAlunoId] = useState('');
  const [motivosAtividades, setMotivosAtividades] = useState([]);
  const [motivosDisciplina, setMotivosDisciplina] = useState([]);
  const [detalhamento, setDetalhamento] = useState('');

  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const resposta = await fetch('/api/professor/minhas-turmas-disciplinas', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const dados = await resposta.json();
      if (dados.ok) {
        setTurmas(dados.turmas);
        setDisciplinas(dados.disciplinas);
      }

      const { data: tipos } = await supabase.from('tipos_ocorrencia').select('id, categoria, texto').order('texto');
      setTiposAtividade((tipos || []).filter((t) => t.categoria === 'atividade'));
      setTiposDisciplina((tipos || []).filter((t) => t.categoria === 'disciplina'));

      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function mudarTurma(id) {
    setTurmaId(id);
    setAlunoId('');
    setAlunosDaTurma([]);
    if (!id) return;
    const { data } = await supabase.from('alunos').select('id, nome').eq('turma_id', id).order('nome');
    setAlunosDaTurma(data || []);
  }

  function alternar(lista, setLista, valor) {
    setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  }

  async function registrar() {
    setErro('');
    if (!turmaId) { setErro('Selecione a turma.'); return; }
    if (!alunoId) { setErro('Selecione o aluno.'); return; }
    if (!disciplina) { setErro('Selecione a disciplina.'); return; }
    if (motivosAtividades.length === 0 && motivosDisciplina.length === 0) { setErro('Selecione pelo menos um motivo.'); return; }

    setEnviando(true);
    try {
      const resposta = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ turmaId, alunoId, disciplina, motivosAtividades, motivosDisciplina, detalhamento })
      });
      const dados = await resposta.json();
      if (!dados.ok) { setErro(dados.erro); setEnviando(false); return; }
      setSucesso(true);
    } catch (e) {
      setErro('Erro inesperado: ' + e.message);
      setEnviando(false);
    }
  }

  function limparFormulario() {
    setMotivosAtividades([]);
    setMotivosDisciplina([]);
    setDetalhamento('');
    setSucesso(false);
  }

  const estiloCampo = { width: '100%', padding: 12, marginBottom: 16, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box' };
  const estiloRotulo = { display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#333' };
  const estiloChip = (ativo, cor) => ({
    display: 'inline-block', padding: '8px 14px', margin: '0 8px 8px 0', borderRadius: 20,
    border: ativo ? `2px solid ${cor}` : '1.5px solid #ddd',
    background: ativo ? cor + '22' : 'white', color: ativo ? cor : '#555',
    fontSize: 13, fontWeight: 'bold', cursor: 'pointer'
  });

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  if (sucesso) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 50 }}>✅</div>
        <h2>Ocorrência registrada!</h2>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          Voltar
        </button>
        <button onClick={limparFormulario} style={{ marginTop: 12, marginLeft: 10, padding: '10px 24px', borderRadius: 8, border: '1.5px solid #6C5CE7', background: 'white', color: '#6C5CE7', fontWeight: 'bold', cursor: 'pointer' }}>
          Registrar outra
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>Registrar ocorrência</h1>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, margin: '14px 0', fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      <label style={estiloRotulo}>Turma</label>
      <select value={turmaId} onChange={(e) => mudarTurma(e.target.value)} style={estiloCampo}>
        <option value="">Selecione...</option>
        {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>

      <label style={estiloRotulo}>Disciplina</label>
      <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} style={estiloCampo}>
        <option value="">Selecione...</option>
        {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      <label style={estiloRotulo}>Aluno</label>
      <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)} style={estiloCampo} disabled={!turmaId}>
        <option value="">{turmaId ? 'Selecione...' : 'Escolha a turma primeiro...'}</option>
        {alunosDaTurma.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
      </select>

      <label style={estiloRotulo}>Motivos — Atividades</label>
      <div style={{ marginBottom: 16 }}>
        {tiposAtividade.map((t) => (
          <span key={t.id} style={estiloChip(motivosAtividades.includes(t.texto), '#6C5CE7')} onClick={() => alternar(motivosAtividades, setMotivosAtividades, t.texto)}>
            {t.texto}
          </span>
        ))}
      </div>

      <label style={estiloRotulo}>Motivos — Disciplina</label>
      <div style={{ marginBottom: 16 }}>
        {tiposDisciplina.map((t) => (
          <span key={t.id} style={estiloChip(motivosDisciplina.includes(t.texto), '#FF7A59')} onClick={() => alternar(motivosDisciplina, setMotivosDisciplina, t.texto)}>
            {t.texto}
          </span>
        ))}
      </div>

      <label style={estiloRotulo}>Observações (opcional)</label>
      <textarea value={detalhamento} onChange={(e) => setDetalhamento(e.target.value)} style={{ ...estiloCampo, minHeight: 80 }} />

      <button onClick={registrar} disabled={enviando} style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#FF7A59', color: 'white', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' }}>
        {enviando ? 'Registrando...' : 'Registrar ocorrência'}
      </button>
    </main>
  );
}
