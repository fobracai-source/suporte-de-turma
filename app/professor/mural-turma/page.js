'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaMuralTurmaProfessor() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [turmas, setTurmas] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [aba, setAba] = useState('avisos');
  const [avisos, setAvisos] = useState([]);
  const [mensagensChat, setMensagensChat] = useState([]);
  const [textoAviso, setTextoAviso] = useState('');
  const [textoChat, setTextoChat] = useState('');
  const [enviando, setEnviando] = useState(false);
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
      if (dados.ok) setTurmas(dados.turmas);
      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function mudarTurma(id) {
    setTurmaId(id);
    setAvisos([]);
    setMensagensChat([]);
    if (!id) return;
    await carregarMensagens(id);
  }

  async function carregarMensagens(idDaTurma) {
    const { data, error } = await supabase
      .from('mural_mensagens')
      .select('id, tipo, autor_nome, autor_tipo, mensagem, criado_em')
      .eq('turma_id', idDaTurma)
      .order('criado_em', { ascending: false });

    if (error) { setErro('Não consegui carregar as mensagens: ' + error.message); return; }

    setAvisos((data || []).filter((m) => m.tipo === 'aviso'));
    setMensagensChat((data || []).filter((m) => m.tipo === 'chat').reverse());
  }

  async function enviarMensagem(tipo) {
    const texto = tipo === 'aviso' ? textoAviso : textoChat;
    if (!texto.trim()) return;
    setErro('');
    setEnviando(true);
    try {
      const resposta = await fetch('/api/mural/enviar-mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ turmaId, tipo, mensagem: texto })
      });
      const dados = await resposta.json();
      if (!dados.ok) { setErro(dados.erro); setEnviando(false); return; }
      if (tipo === 'aviso') setTextoAviso(''); else setTextoChat('');
      await carregarMensagens(turmaId);
    } catch (e) {
      setErro('Erro inesperado: ' + e.message);
    }
    setEnviando(false);
  }

  const estiloAba = (ativa) => ({ flex: 1, padding: 10, borderRadius: 8, border: ativa ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: ativa ? '#F4F2FF' : 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 });

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>📢 Mural e Chat</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      <label style={{ display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>Turma</label>
      <select value={turmaId} onChange={(e) => mudarTurma(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}>
        <option value="">Selecione...</option>
        {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>

      {turmaId && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button onClick={() => setAba('avisos')} style={estiloAba(aba === 'avisos')}>📌 Avisos</button>
            <button onClick={() => setAba('chat')} style={estiloAba(aba === 'chat')}>💬 Chat da turma</button>
          </div>

          {aba === 'avisos' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text" value={textoAviso} onChange={(e) => setTextoAviso(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') enviarMensagem('aviso'); }}
                  placeholder="Escreva um aviso pra turma..."
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14 }}
                />
                <button onClick={() => enviarMensagem('aviso')} disabled={enviando} style={{ padding: '0 20px', borderRadius: 8, border: 'none', background: '#F2C94C', color: '#8A6D1E', fontWeight: 'bold', cursor: 'pointer' }}>
                  Publicar
                </button>
              </div>

              {avisos.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Nenhum aviso publicado ainda.</p>}
              {avisos.map((a) => (
                <div key={a.id} style={{ padding: 14, borderRadius: 10, border: '1.5px solid #F2C94C', background: '#FFFBEB', marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#8A6D1E', fontWeight: 'bold' }}>{a.autor_nome} • {new Date(a.criado_em).toLocaleString('pt-BR')}</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: 14, color: '#333' }}>{a.mensagem}</p>
                </div>
              ))}
            </div>
          )}

          {aba === 'chat' && (
            <div>
              <div style={{ marginBottom: 14 }}>
                {mensagensChat.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Nenhuma mensagem ainda.</p>}
                {mensagensChat.map((m) => (
                  <div key={m.id} style={{ padding: 10, borderRadius: 10, background: m.autor_tipo === 'professor' ? '#F4F2FF' : '#F8F8F8', marginBottom: 8 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 'bold', color: m.autor_tipo === 'professor' ? '#6C5CE7' : '#555' }}>
                      {m.autor_tipo === 'professor' ? '👩‍🏫 ' : ''}{m.autor_nome} • {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13.5, color: '#333' }}>{m.mensagem}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" value={textoChat} onChange={(e) => setTextoChat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') enviarMensagem('chat'); }}
                  placeholder="Escreva uma mensagem..."
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14 }}
                />
                <button onClick={() => enviarMensagem('chat')} disabled={enviando} style={{ padding: '0 20px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                  {enviando ? '...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
