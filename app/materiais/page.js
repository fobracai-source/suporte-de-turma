'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const ICONE_POR_TIPO = { arquivo: '📄', link: '🔗', video: '🎬' };

export default function PaginaMateriais() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [materiais, setMateriais] = useState([]);
  const [disciplinaFiltro, setDisciplinaFiltro] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const { data, error } = await supabase
        .from('materiais')
        .select('id, disciplina, tipo, titulo, descricao, caminho_arquivo, url_externa, criado_em')
        .order('criado_em', { ascending: false });

      if (error) { setErro(error.message); setCarregando(false); return; }
      setMateriais(data || []);
      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function abrirMaterial(m) {
    if (m.tipo !== 'arquivo') {
      window.open(m.url_externa, '_blank');
      return;
    }
    const resposta = await fetch('/api/anexos/url-assinada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ tipo: 'material', registroId: m.id, caminhoArquivo: m.caminho_arquivo })
    });
    const dados = await resposta.json();
    if (dados.ok) window.open(dados.url, '_blank');
    else alert('Não consegui abrir o material: ' + dados.erro);
  }

  const disciplinas = [...new Set(materiais.map((m) => m.disciplina))].sort();
  const materiaisFiltrados = disciplinaFiltro ? materiais.filter((m) => m.disciplina === disciplinaFiltro) : materiais;

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>📚 Materiais</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>⚠️ {erro}</div>}

      {disciplinas.length > 0 && (
        <select value={disciplinaFiltro} onChange={(e) => setDisciplinaFiltro(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}>
          <option value="">Todas as disciplinas</option>
          {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      )}

      {materiaisFiltrados.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Nenhum material disponível ainda.</p>}

      {materiaisFiltrados.map((m) => (
        <div key={m.id} onClick={() => abrirMaterial(m)} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ fontSize: 24 }}>{ICONE_POR_TIPO[m.tipo]}</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 'bold', color: '#6C5CE7' }}>{m.disciplina}</p>
            <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 'bold' }}>{m.titulo}</p>
            {m.descricao && <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#666' }}>{m.descricao}</p>}
          </div>
        </div>
      ))}
    </main>
  );
}
