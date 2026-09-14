'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaRankingTurma() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [ranking, setRanking] = useState([]);
  const [semAtividade, setSemAtividade] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const resposta = await fetch('/api/ranking-turma', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const dados = await resposta.json();

      if (!dados.ok) { setErro(dados.erro); setCarregando(false); return; }
      setRanking(dados.ranking);
      setSemAtividade(dados.semAtividade);
      setCarregando(false);
    }
    carregar();
  }, [router]);

  const medalha = (posicao) => {
    if (posicao === 1) return '🥇';
    if (posicao === 2) return '🥈';
    if (posicao === 3) return '🥉';
    return null;
  };

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>🏆 Ranking da Turma</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      {ranking.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Ninguém da turma respondeu nenhuma atividade ainda.</p>}

      {ranking.map((a) => (
        <div
          key={a.alunoId}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 14, borderRadius: 10, marginBottom: 8,
            border: a.souEu ? '2px solid #6C5CE7' : '1.5px solid #eee',
            background: a.souEu ? '#F4F2FF' : 'white'
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 'bold', color: '#888', width: 28, textAlign: 'center' }}>
              {medalha(a.posicao) || `${a.posicao}º`}
            </span>
            <span style={{ fontWeight: a.souEu ? 'bold' : 'normal', fontSize: 14 }}>
              {a.nome}{a.souEu ? ' (você)' : ''}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: 15, color: '#6C5CE7' }}>{a.aproveitamento}%</p>
            <p style={{ margin: 0, fontSize: 10.5, color: '#aaa' }}>{a.qtdAtividades} atividade(s)</p>
          </div>
        </div>
      ))}

      {semAtividade.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>Ainda não responderam nenhuma atividade:</p>
          {semAtividade.map((a) => (
            <p key={a.alunoId} style={{ margin: '4px 0', fontSize: 13, color: a.souEu ? '#6C5CE7' : '#888', fontWeight: a.souEu ? 'bold' : 'normal' }}>
              {a.nome}{a.souEu ? ' (você)' : ''}
            </p>
          ))}
        </div>
      )}
    </main>
  );
}
