'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaDenunciarColega() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [colegas, setColegas] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);

  const [alunoDenunciadoId, setAlunoDenunciadoId] = useState('');
  const [disciplinaOuTodas, setDisciplinaOuTodas] = useState('');
  const [denuncia, setDenuncia] = useState('');

  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const resposta = await fetch('/api/colegas-da-turma', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const dados = await resposta.json();
      if (dados.ok) setColegas(dados.colegas.filter((c) => c.id !== dados.meuId));

      const { data: disc } = await supabase.from('professor_disciplinas').select('disciplina');
      const unicas = [...new Set((disc || []).map((d) => d.disciplina))].sort();
      setDisciplinas(unicas);

      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function enviar() {
    setErro('');
    if (!alunoDenunciadoId) { setErro('Selecione o colega.'); return; }
    if (!disciplinaOuTodas) { setErro('Selecione a disciplina, ou "Em todas as aulas acontece isso".'); return; }
    if (!denuncia.trim()) { setErro('Escreva o relato antes de enviar.'); return; }

    setEnviando(true);
    try {
      const resposta = await fetch('/api/denuncia-colega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ alunoDenunciadoId, disciplinaOuTodas, denuncia })
      });
      const dados = await resposta.json();
      if (!dados.ok) { setErro(dados.erro); setEnviando(false); return; }
      setSucesso(true);
    } catch (e) {
      setErro('Erro inesperado: ' + e.message);
      setEnviando(false);
    }
  }

  const estiloCampo = { width: '100%', padding: 12, marginBottom: 16, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box' };
  const estiloRotulo = { display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#333' };

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  if (sucesso) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 50 }}>🙏</div>
        <h2>Obrigado(a) pela sua denúncia!</h2>
        <p style={{ color: '#888', fontSize: 14 }}>
          Seu relato foi registrado e será analisado. Sua identidade não foi revelada em nenhum momento.
        </p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          Voltar
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>Meu colega atrapalha!</h1>

      <div style={{ background: '#FFF8E1', color: '#8A6D1E', padding: 13, borderRadius: 8, marginBottom: 18, fontSize: 12.5, lineHeight: 1.5 }}>
        🔒 Este formulário não pergunta o seu nome em nenhum momento. Sua identidade não é revelada pro colega denunciado, nem aparece nos painéis do professor.
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      <label style={estiloRotulo}>Sobre qual colega é a denúncia?</label>
      <select value={alunoDenunciadoId} onChange={(e) => setAlunoDenunciadoId(e.target.value)} style={estiloCampo}>
        <option value="">Selecione...</option>
        {colegas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>

      <label style={estiloRotulo}>Disciplina em que ocorreu o fato</label>
      <select value={disciplinaOuTodas} onChange={(e) => setDisciplinaOuTodas(e.target.value)} style={estiloCampo}>
        <option value="">Selecione...</option>
        {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
        <option value="__TODAS__">Em todas as aulas acontece isso</option>
      </select>

      <label style={estiloRotulo}>✏️ Denuncie!</label>
      <textarea value={denuncia} onChange={(e) => setDenuncia(e.target.value)} placeholder="Conte o que está acontecendo..." style={{ ...estiloCampo, minHeight: 110 }} />
      <div style={{ background: '#FFF8E1', color: '#8A6D1E', padding: 12, borderRadius: 8, marginTop: -8, marginBottom: 16, fontSize: 11.5, lineHeight: 1.5 }}>
        ⚠️ Pra manter sua identidade em sigilo, evite palavras, apelidos ou informações que possam te identificar. Fale sobre o comportamento observado, sem se identificar.
      </div>

      <button onClick={enviar} disabled={enviando} style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#7B68EE', color: 'white', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' }}>
        {enviando ? 'Enviando...' : 'Enviar denúncia'}
      </button>
    </main>
  );
}
