'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaGamificacao() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const resposta = await fetch('/api/gamificacao/resumo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const resultado = await resposta.json();
      if (!resultado.ok) { setErro(resultado.erro); setCarregando(false); return; }
      setDados(resultado);
      setCarregando(false);
    }
    carregar();
  }, [router]);

  const iconePorOrigem = (origem) => (origem === 'entrega' ? '📝' : '💬');

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  if (erro) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#C93B26' }}>⚠️ {erro}</p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Voltar</button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>🎮 Gamificação</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #6C5CE7, #8E7CFB)', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 24, color: 'white' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>Seus pontos</p>
        <p style={{ margin: '6px 0 0 0', fontSize: 46, fontWeight: 'bold' }}>{dados.pontosTotais} 🏆</p>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>🏅 Missões</h2>
      {dados.missoes.map((m, i) => (
        <div key={i} style={{ padding: 14, borderRadius: 10, border: m.concluida ? '1.5px solid #2ECC71' : '1.5px solid #eee', background: m.concluida ? '#E8F9EE' : 'white', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{m.emoji} {m.titulo} {m.concluida && '✓'}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#888' }}>{m.atual}/{m.meta}</p>
          </div>
          <p style={{ margin: '4px 0 8px 0', fontSize: 12, color: '#888' }}>{m.descricao}</p>
          <div style={{ background: '#eee', borderRadius: 10, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${m.percentual}%`, background: m.concluida ? '#2ECC71' : '#6C5CE7', height: '100%' }} />
          </div>
        </div>
      ))}

      <h2 style={{ fontSize: 16, margin: '24px 0 12px 0' }}>🎁 Recompensas</h2>
      {dados.recompensas.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Nenhuma recompensa configurada ainda.</p>}
      {dados.recompensas.map((r, i) => (
        <div key={i} style={{ padding: 14, borderRadius: 10, border: r.desbloqueada ? '1.5px solid #F2C94C' : '1.5px solid #eee', background: r.desbloqueada ? '#FFFBEB' : '#FAFAFA', marginBottom: 10, opacity: r.desbloqueada ? 1 : 0.6 }}>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{r.emoji} {r.titulo} {r.desbloqueada ? '🔓' : '🔒'}</p>
          {r.descricao && <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#888' }}>{r.descricao}</p>}
          <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#aaa' }}>{r.pontos_necessarios} pontos</p>
        </div>
      ))}

      <h2 style={{ fontSize: 16, margin: '24px 0 12px 0' }}>📜 Histórico recente</h2>
      {dados.historico.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Nenhum ponto ganho ainda — responda uma atividade!</p>}
      {dados.historico.map((h, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f2f2f2' }}>
          <div>
            <p style={{ margin: 0, fontSize: 13 }}>{iconePorOrigem(h.origem)} {h.descricao}</p>
            <p style={{ margin: 0, fontSize: 10.5, color: '#aaa' }}>{new Date(h.criado_em).toLocaleString('pt-BR')}</p>
          </div>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#2ECC71', fontSize: 14 }}>+{h.pontos}</p>
        </div>
      ))}
    </main>
  );
}
