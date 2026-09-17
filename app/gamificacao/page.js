'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaGamificacao() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('missoes');

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

  const iconePorOrigem = { entrega: '📝', chat: '💬', missao: '🏅', sem_ocorrencia: '🛡️', penalidade: '⚠️' };
  const medalha = (posicao) => (posicao === 1 ? '🥇' : posicao === 2 ? '🥈' : posicao === 3 ? '🥉' : `${posicao}º`);
  const estiloAba = (ativa) => ({ flex: 1, padding: 10, borderRadius: 8, border: ativa ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: ativa ? '#F4F2FF' : 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 12.5 });

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

      {dados.novosNiveisConquistadosAgora.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #2ECC71, #27AE60)', borderRadius: 12, padding: 16, marginBottom: 16, color: 'white', textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: 15 }}>🎉 Você subiu de nível!</p>
          {dados.novosNiveisConquistadosAgora.map((n, i) => (
            <p key={i} style={{ margin: '4px 0 0 0', fontSize: 13 }}>{n.emoji} {n.missao} — Nível {n.nivel} (+{n.pontosBonus} pts)</p>
          ))}
        </div>
      )}

      <div style={{ background: 'linear-gradient(135deg, #6C5CE7, #8E7CFB)', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 16, color: 'white' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>Seus pontos</p>
        <p style={{ margin: '6px 0 0 0', fontSize: 46, fontWeight: 'bold' }}>{dados.pontosTotais} 🏆</p>
      </div>

      {dados.penalidadeOcorrencia.proximaPenalidade && (
        <div style={{ background: '#FFF0EA', border: '1.5px solid #FF7A59', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12.5, color: '#C0491F' }}>
          ⚠️ Você tem {dados.penalidadeOcorrencia.totalOcorrencias} ocorrência(s). Ao chegar em {dados.penalidadeOcorrencia.proximaPenalidade.qtd_ocorrencias}, perde {dados.penalidadeOcorrencia.proximaPenalidade.pontos_perdidos} pontos.
        </div>
      )}
      {dados.penalidadeOcorrencia.totalPerdido > 0 && (
        <div style={{ background: '#FFEDEA', border: '1.5px solid #C93B26', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12.5, color: '#C93B26' }}>
          📉 Você já perdeu {dados.penalidadeOcorrencia.totalPerdido} pontos por causa de ocorrências.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button onClick={() => setAba('missoes')} style={estiloAba(aba === 'missoes')}>🏅 Missões</button>
        <button onClick={() => setAba('ranking')} style={estiloAba(aba === 'ranking')}>📊 Ranking</button>
        <button onClick={() => setAba('recompensas')} style={estiloAba(aba === 'recompensas')}>🎁 Prêmios</button>
        <button onClick={() => setAba('historico')} style={estiloAba(aba === 'historico')}>📜 Extrato</button>
      </div>

      {aba === 'missoes' && dados.missoes.map((m, i) => (
        <div key={i} style={{ padding: 14, borderRadius: 10, border: m.completouTudo ? '1.5px solid #2ECC71' : '1.5px solid #eee', background: m.completouTudo ? '#E8F9EE' : 'white', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{m.emoji} {m.titulo} <span style={{ fontSize: 11, color: '#888', fontWeight: 'normal' }}>Nível {m.nivelAtual}/{m.nivelMaximo}</span></p>
          </div>
          {m.completouTudo ? (
            <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#2ECC71', fontWeight: 'bold' }}>✓ Nível máximo alcançado!</p>
          ) : (
            <>
              <p style={{ margin: '6px 0 8px 0', fontSize: 12, color: '#888' }}>Próximo: {m.descricaoProximoNivel} ({m.valorAtual}/{m.metaProximoNivel})</p>
              <div style={{ background: '#eee', borderRadius: 10, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${m.percentualProximoNivel}%`, background: '#6C5CE7', height: '100%' }} />
              </div>
            </>
          )}
        </div>
      ))}

      {aba === 'ranking' && (
        <div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>Ranking geral da turma, por pontos acumulados (nunca zera).</p>
          {dados.rankingGeral.map((a) => (
            <div key={a.posicao} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, border: a.souEu ? '2px solid #6C5CE7' : '1.5px solid #eee', background: a.souEu ? '#F4F2FF' : 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, width: 26, textAlign: 'center' }}>{medalha(a.posicao)}</span>
                <span style={{ fontWeight: a.souEu ? 'bold' : 'normal', fontSize: 13.5 }}>{a.nome}{a.souEu ? ' (você)' : ''}</span>
              </div>
              <p style={{ margin: 0, fontWeight: 'bold', color: '#6C5CE7', fontSize: 14 }}>{a.pontos} pts</p>
            </div>
          ))}
        </div>
      )}

      {aba === 'recompensas' && (
        <div>
          {dados.recompensas.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Nenhuma recompensa configurada ainda.</p>}
          {dados.recompensas.map((r, i) => (
            <div key={i} style={{ padding: 14, borderRadius: 10, border: r.desbloqueada ? '1.5px solid #F2C94C' : '1.5px solid #eee', background: r.desbloqueada ? '#FFFBEB' : '#FAFAFA', marginBottom: 10, opacity: r.desbloqueada ? 1 : 0.6 }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{r.emoji} {r.titulo} {r.desbloqueada ? '🔓' : '🔒'}</p>
              {r.descricao && <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#888' }}>{r.descricao}</p>}
              <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#aaa' }}>{r.pontos_necessarios} pontos</p>
            </div>
          ))}
        </div>
      )}

      {aba === 'historico' && (
        <div>
          {dados.historico.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Nenhum ponto ainda — responda uma atividade!</p>}
          {dados.historico.map((h, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f2f2f2' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13 }}>{iconePorOrigem[h.origem] || '•'} {h.descricao}</p>
                <p style={{ margin: 0, fontSize: 10.5, color: '#aaa' }}>{new Date(h.criado_em).toLocaleString('pt-BR')}</p>
              </div>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14, color: h.pontos >= 0 ? '#2ECC71' : '#C93B26' }}>{h.pontos >= 0 ? '+' : ''}{h.pontos}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
