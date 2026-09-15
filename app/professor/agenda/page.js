'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const ESTILO_POR_TIPO = {
  prova: { emoji: '📝', cor: '#FF5C5C', rotulo: 'Prova' },
  trabalho: { emoji: '📄', cor: '#F2994A', rotulo: 'Trabalho' },
  evento: { emoji: '🎉', cor: '#6C5CE7', rotulo: 'Evento' },
  entrega: { emoji: '⏰', cor: '#2ECC71', rotulo: 'Prazo de atividade' }
};

export default function PaginaAgendaProfessor() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [turmas, setTurmas] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [turmaId, setTurmaId] = useState('');
  const [tipo, setTipo] = useState('prova');
  const [disciplina, setDisciplina] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataEvento, setDataEvento] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const resposta = await fetch('/api/professor/minhas-turmas-disciplinas', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const dados = await resposta.json();
      if (dados.ok) { setTurmas(dados.turmas); setDisciplinas(dados.disciplinas); }

      await carregarAgenda(session.access_token);
      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function carregarAgenda(token) {
    const resposta = await fetch('/api/agenda/listar', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const dados = await resposta.json();
    if (dados.ok) setAgenda(dados.agenda);
  }

  async function criarEvento() {
    setErro('');
    if (!turmaId || !titulo.trim() || !dataEvento) { setErro('Preencha turma, título e data.'); return; }

    setEnviando(true);
    try {
      const resposta = await fetch('/api/professor/criar-evento-agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ turmaId, tipo, titulo, descricao, disciplina, dataEvento })
      });
      const dados = await resposta.json();
      if (!dados.ok) { setErro(dados.erro); setEnviando(false); return; }

      setTitulo(''); setDescricao(''); setDataEvento(''); setMostrarForm(false);
      await carregarAgenda(accessToken);
    } catch (e) {
      setErro('Erro inesperado: ' + e.message);
    }
    setEnviando(false);
  }

  const estiloCampo = { width: '100%', padding: 12, marginBottom: 14, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box' };
  const estiloRotulo = { display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#333' };
  const hoje = new Date().toISOString().slice(0, 10);
  const proximos = agenda.filter((e) => e.data >= hoje);

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>📅 Agenda</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>⚠️ {erro}</div>}

      <button onClick={() => setMostrarForm(!mostrarForm)} style={{ width: '100%', padding: 12, marginBottom: 18, borderRadius: 8, border: '1.5px dashed #6C5CE7', background: 'white', color: '#6C5CE7', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
        {mostrarForm ? '✕ Fechar' : '➕ Marcar prova ou trabalho'}
      </button>

      {mostrarForm && (
        <div style={{ background: '#F8F8F8', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <label style={estiloRotulo}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={estiloCampo}>
            <option value="prova">Prova</option>
            <option value="trabalho">Trabalho</option>
          </select>

          <label style={estiloRotulo}>Turma</label>
          <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={estiloCampo}>
            <option value="">Selecione...</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>

          <label style={estiloRotulo}>Disciplina <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} style={estiloCampo}>
            <option value="">Não informar</option>
            {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <label style={estiloRotulo}>Título</label>
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={estiloCampo} placeholder="Ex.: Prova bimestral" />

          <label style={estiloRotulo}>Descrição <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ ...estiloCampo, minHeight: 60 }} />

          <label style={estiloRotulo}>Data</label>
          <input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} style={estiloCampo} />

          <button onClick={criarEvento} disabled={enviando} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
            {enviando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Próximos</h2>
      {proximos.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Nada marcado por enquanto.</p>}
      {proximos.map((e) => {
        const estilo = ESTILO_POR_TIPO[e.tipo] || ESTILO_POR_TIPO.evento;
        return (
          <div key={e.id} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, border: `1.5px solid ${estilo.cor}33`, background: `${estilo.cor}0D`, marginBottom: 8 }}>
            <div style={{ fontSize: 22 }}>{estilo.emoji}</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 'bold', color: estilo.cor }}>{estilo.rotulo}{e.disciplina ? ` — ${e.disciplina}` : ''}{e.turmaNome ? ` — Turma ${e.turmaNome}` : ''}</p>
              <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 'bold' }}>{e.titulo}</p>
              {e.descricao && <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#666' }}>{e.descricao}</p>}
              <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#888' }}>{new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
            </div>
          </div>
        );
      })}
    </main>
  );
}
