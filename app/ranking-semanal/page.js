'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaRankingSemanal() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const resposta = await fetch('/api/ranking-semanal/resumo', {
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

  const medalha = (posicao) => (posicao === 1 ? '🥇' : posicao === 2 ? '🥈' : posicao === 3 ? '🥉' : `${posicao}º`);

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
        <h1 style={{ fontSize: 20, margin: 0 }}>🏅 Ranking Semanal</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        Semana atual (desde {new Date(dados.inicioSemana + 'T00:00:00').toLocaleDateString('pt-BR')}) — o ranking fecha toda segunda-feira!
      </p>

      {dados.premios.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1.5px solid #F2C94C', borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 'bold', color: '#8A6D1E' }}>🎁 PRÊMIOS DESSA SEMANA</p>
          {dados.premios.map((p) => (
            <p key={p.posicao} style={{ margin: '4px 0', fontSize: 13 }}>{p.emoji} {p.posicao}º lugar: <b>{p.titulo}</b></p>
          ))}
        </div>
      )}

      {dados.ranking.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Ninguém pontuou ainda essa semana. Responda uma atividade!</p>}

      {dados.ranking.map((a) => (
        <div key={a.alunoId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 8, border: a.souEu ? '2px solid #6C5CE7' : '1.5px solid #eee', background: a.souEu ? '#F4F2FF' : 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16, width: 28, textAlign: 'center' }}>{medalha(a.posicao)}</span>
            <span style={{ fontWeight: a.souEu ? 'bold' : 'normal', fontSize: 14 }}>{a.nome}{a.souEu ? ' (você)' : ''}</span>
          </div>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: 16, color: '#6C5CE7' }}>{a.pontos} pts</p>
        </div>
      ))}

      {dados.ultimoPodio.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, margin: '24px 0 10px 0' }}>🏆 Últimos vencedores</h2>
          {dados.ultimoPodio.map((p, i) => (
            <p key={i} style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>
              {medalha(p.posicao)} {p.alunos?.nome} — {p.pontos_da_semana} pts (semana de {new Date(p.semana_inicio + 'T00:00:00').toLocaleDateString('pt-BR')})
            </p>
          ))}
        </>
      )}
    </main>
  );
}
