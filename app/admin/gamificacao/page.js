'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaAdminGamificacao() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [aba, setAba] = useState('pontos');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Configuração de pontos
  const [config, setConfig] = useState(null);

  // Missões
  const [missoes, setMissoes] = useState([]);
  const [novaMissaoChave, setNovaMissaoChave] = useState('');
  const [novaMissaoTitulo, setNovaMissaoTitulo] = useState('');
  const [novaMissaoEmoji, setNovaMissaoEmoji] = useState('🏆');
  const [missaoExpandida, setMissaoExpandida] = useState(null);
  const [novoNivel, setNovoNivel] = useState({ nivel: '', meta: '', descricao: '', pontosBonus: '' });

  // Penalidades
  const [penalidades, setPenalidades] = useState([]);
  const [novaPenalidade, setNovaPenalidade] = useState({ qtdOcorrencias: '', pontosPerdidos: '', titulo: '' });

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const respConfig = await fetch('/api/admin/gamificacao/config-pontos', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const dadosConfig = await respConfig.json();
      if (dadosConfig.ok) setConfig(dadosConfig.config);

      const { data: missoesExistentes } = await supabase.from('missoes_config').select('id, chave, titulo_base, emoji, ativa, missoes_niveis(id, nivel, meta, descricao, pontos_bonus)').order('id');
      setMissoes((missoesExistentes || []).map((m) => ({ ...m, missoes_niveis: (m.missoes_niveis || []).sort((a, b) => a.nivel - b.nivel) })));

      const { data: penalidadesExistentes } = await supabase.from('penalidades_ocorrencia').select('id, qtd_ocorrencias, pontos_perdidos, titulo').order('qtd_ocorrencias');
      setPenalidades(penalidadesExistentes || []);

      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function chamarApi(caminho, corpo, metodo = 'POST') {
    setErro(''); setSucesso(''); setEnviando(true);
    try {
      const resposta = await fetch(caminho, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(corpo)
      });
      const dados = await resposta.json();
      setEnviando(false);
      if (!dados.ok) { setErro(dados.erro || 'Não foi possível concluir.'); return null; }
      return dados;
    } catch (e) {
      setEnviando(false);
      setErro('Erro inesperado: ' + e.message);
      return null;
    }
  }

  async function salvarConfigPontos() {
    const dados = await chamarApi('/api/admin/gamificacao/config-pontos', {
      entregaNoPrazo: Number(config.entrega_no_prazo),
      entregaForaPrazo: Number(config.entrega_fora_prazo),
      pontoPorAcertoNoPrazo: Number(config.ponto_por_acerto_no_prazo),
      pontoPorAcertoForaPrazo: Number(config.ponto_por_acerto_fora_prazo),
      bonusSemOcorrenciaSemanal: Number(config.bonus_sem_ocorrencia_semanal),
      bonusChatSemanal: Number(config.bonus_chat_semanal)
    });
    if (dados) setSucesso('Configuração de pontos salva!');
  }

  async function criarMissao() {
    const dados = await chamarApi('/api/admin/gamificacao/missao', { chave: novaMissaoChave, tituloBase: novaMissaoTitulo, emoji: novaMissaoEmoji });
    if (dados) {
      setSucesso('Missão criada!');
      setMissoes((atual) => [...atual, { ...dados.missao, missoes_niveis: [] }]);
      setNovaMissaoChave(''); setNovaMissaoTitulo(''); setNovaMissaoEmoji('🏆');
    }
  }

  async function excluirMissao(id) {
    if (!confirm('Excluir essa missão e todos os seus níveis? Não dá pra desfazer.')) return;
    const dados = await chamarApi('/api/admin/gamificacao/missao', { id }, 'DELETE');
    if (dados) { setSucesso('Missão excluída!'); setMissoes((atual) => atual.filter((m) => m.id !== id)); }
  }

  async function adicionarNivel(missaoId) {
    const dados = await chamarApi('/api/admin/gamificacao/nivel-missao', {
      missaoId, nivel: Number(novoNivel.nivel), meta: Number(novoNivel.meta), descricao: novoNivel.descricao, pontosBonus: Number(novoNivel.pontosBonus || 0)
    });
    if (dados) {
      setSucesso('Nível salvo!');
      setMissoes((atual) => atual.map((m) => {
        if (m.id !== missaoId) return m;
        const semODuplicado = m.missoes_niveis.filter((n) => n.nivel !== dados.nivelMissao.nivel);
        return { ...m, missoes_niveis: [...semODuplicado, dados.nivelMissao].sort((a, b) => a.nivel - b.nivel) };
      }));
      setNovoNivel({ nivel: '', meta: '', descricao: '', pontosBonus: '' });
    }
  }

  async function excluirNivel(missaoId, nivelId) {
    if (!confirm('Excluir esse nível? Não dá pra desfazer.')) return;
    const dados = await chamarApi('/api/admin/gamificacao/nivel-missao', { id: nivelId }, 'DELETE');
    if (dados) {
      setMissoes((atual) => atual.map((m) => m.id !== missaoId ? m : { ...m, missoes_niveis: m.missoes_niveis.filter((n) => n.id !== nivelId) }));
    }
  }

  async function criarPenalidade() {
    const dados = await chamarApi('/api/admin/gamificacao/penalidade', {
      qtdOcorrencias: Number(novaPenalidade.qtdOcorrencias), pontosPerdidos: Number(novaPenalidade.pontosPerdidos), titulo: novaPenalidade.titulo
    });
    if (dados) {
      setSucesso('Penalidade salva!');
      setPenalidades((atual) => {
        const semODuplicado = atual.filter((p) => p.qtd_ocorrencias !== dados.penalidade.qtd_ocorrencias);
        return [...semODuplicado, dados.penalidade].sort((a, b) => a.qtd_ocorrencias - b.qtd_ocorrencias);
      });
      setNovaPenalidade({ qtdOcorrencias: '', pontosPerdidos: '', titulo: '' });
    }
  }

  async function excluirPenalidade(id) {
    if (!confirm('Excluir essa penalidade? Não dá pra desfazer.')) return;
    const dados = await chamarApi('/api/admin/gamificacao/penalidade', { id }, 'DELETE');
    if (dados) { setSucesso('Penalidade excluída!'); setPenalidades((atual) => atual.filter((p) => p.id !== id)); }
  }

  const estiloCampo = { width: '100%', padding: 10, marginBottom: 12, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, boxSizing: 'border-box' };
  const estiloRotulo = { display: 'block', fontWeight: 'bold', fontSize: 12.5, marginBottom: 5, color: '#333' };
  const estiloBotao = { padding: '10px 18px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' };
  const estiloAba = (ativa) => ({ flex: 1, padding: 10, borderRadius: 8, border: ativa ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: ativa ? '#F4F2FF' : 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 12.5 });

  if (carregando) return <main style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>🎮 Gamificação — Administração</h1>
        <button onClick={() => router.push('/admin')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>⚠️ {erro}</div>}
      {sucesso && <div style={{ background: '#E8F9EE', color: '#1E8449', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>✅ {sucesso}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setAba('pontos')} style={estiloAba(aba === 'pontos')}>💰 Pontos</button>
        <button onClick={() => setAba('missoes')} style={estiloAba(aba === 'missoes')}>🏅 Missões</button>
        <button onClick={() => setAba('penalidades')} style={estiloAba(aba === 'penalidades')}>⚠️ Penalidades</button>
      </div>

      {aba === 'pontos' && config && (
        <div>
          <div style={{ background: '#F4F2FF', color: '#4E3FC7', padding: 12, borderRadius: 8, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            💰 Esses valores valem pra toda entrega/participação nova, a partir de agora (não muda pontos já dados no passado).
          </div>

          <label style={estiloRotulo}>Pontos por entrega NO PRAZO</label>
          <input type="number" value={config.entrega_no_prazo} onChange={(e) => setConfig({ ...config, entrega_no_prazo: e.target.value })} style={estiloCampo} />

          <label style={estiloRotulo}>Pontos por entrega FORA DO PRAZO</label>
          <input type="number" value={config.entrega_fora_prazo} onChange={(e) => setConfig({ ...config, entrega_fora_prazo: e.target.value })} style={estiloCampo} />

          <label style={estiloRotulo}>Pontos por questão certa — NO PRAZO</label>
          <input type="number" value={config.ponto_por_acerto_no_prazo} onChange={(e) => setConfig({ ...config, ponto_por_acerto_no_prazo: e.target.value })} style={estiloCampo} />

          <label style={estiloRotulo}>Pontos por questão certa — FORA DO PRAZO</label>
          <input type="number" value={config.ponto_por_acerto_fora_prazo} onChange={(e) => setConfig({ ...config, ponto_por_acerto_fora_prazo: e.target.value })} style={estiloCampo} />

          <label style={estiloRotulo}>Bônus semanal — sem nenhuma ocorrência</label>
          <input type="number" value={config.bonus_sem_ocorrencia_semanal} onChange={(e) => setConfig({ ...config, bonus_sem_ocorrencia_semanal: e.target.value })} style={estiloCampo} />

          <label style={estiloRotulo}>Bônus semanal — participar do chat</label>
          <input type="number" value={config.bonus_chat_semanal} onChange={(e) => setConfig({ ...config, bonus_chat_semanal: e.target.value })} style={estiloCampo} />

          <button onClick={salvarConfigPontos} disabled={enviando} style={{ ...estiloBotao, width: '100%', marginTop: 6 }}>{enviando ? 'Salvando...' : 'Salvar configuração'}</button>
        </div>
      )}

      {aba === 'missoes' && (
        <div>
          <div style={{ background: '#F4F2FF', color: '#4E3FC7', padding: 12, borderRadius: 8, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            🏅 Cada missão tem vários NÍVEIS — assim ela nunca "acaba" de verdade pro aluno, sempre tem um próximo degrau. Clique numa missão pra ver/editar os níveis dela.
          </div>

          <div style={{ background: '#F8F8F8', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: 13 }}>Nova missão</p>
            <label style={estiloRotulo}>Chave <span style={{ fontWeight: 400, color: '#999' }}>(identificador técnico — veja lib/gamificacao.js pras opções válidas)</span></label>
            <input type="text" value={novaMissaoChave} onChange={(e) => setNovaMissaoChave(e.target.value)} style={estiloCampo} placeholder="Ex.: entregas_total" />
            <label style={estiloRotulo}>Título</label>
            <input type="text" value={novaMissaoTitulo} onChange={(e) => setNovaMissaoTitulo(e.target.value)} style={estiloCampo} placeholder="Ex.: Maratonista" />
            <label style={estiloRotulo}>Emoji</label>
            <input type="text" value={novaMissaoEmoji} onChange={(e) => setNovaMissaoEmoji(e.target.value)} style={estiloCampo} maxLength={4} />
            <button onClick={criarMissao} disabled={enviando} style={estiloBotao}>Criar missão</button>
          </div>

          {missoes.map((m) => (
            <div key={m.id} style={{ border: '1.5px solid #eee', borderRadius: 10, marginBottom: 10 }}>
              <div onClick={() => setMissaoExpandida(missaoExpandida === m.id ? null : m.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, cursor: 'pointer' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{m.emoji} {m.titulo_base} <span style={{ fontSize: 11, color: '#888', fontWeight: 'normal' }}>({m.missoes_niveis.length} nível(is))</span></p>
                <span style={{ fontSize: 13, color: '#6C5CE7' }}>{missaoExpandida === m.id ? '▲' : '▼'}</span>
              </div>

              {missaoExpandida === m.id && (
                <div style={{ padding: '0 14px 14px 14px' }}>
                  <button onClick={() => excluirMissao(m.id)} style={{ background: 'none', border: 'none', color: '#C93B26', fontSize: 11.5, fontWeight: 'bold', cursor: 'pointer', padding: 0, marginBottom: 10 }}>🗑️ Excluir missão inteira</button>

                  {m.missoes_niveis.map((n) => (
                    <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F8F8', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 'bold' }}>Nível {n.nivel} — meta: {n.meta}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 11.5, color: '#888' }}>{n.descricao} • +{n.pontos_bonus} pts</p>
                      </div>
                      <button onClick={() => excluirNivel(m.id, n.id)} style={{ background: 'none', border: 'none', color: '#C93B26', fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                    </div>
                  ))}

                  <div style={{ marginTop: 10, background: '#FFFBEB', borderRadius: 8, padding: 10 }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 'bold', color: '#8A6D1E' }}>Adicionar/editar nível</p>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input type="number" placeholder="Nível (1,2...)" value={novoNivel.nivel} onChange={(e) => setNovoNivel({ ...novoNivel, nivel: e.target.value })} style={{ ...estiloCampo, marginBottom: 0, flex: 1 }} />
                      <input type="number" placeholder="Meta" value={novoNivel.meta} onChange={(e) => setNovoNivel({ ...novoNivel, meta: e.target.value })} style={{ ...estiloCampo, marginBottom: 0, flex: 1 }} />
                    </div>
                    <input type="text" placeholder="Descrição (ex.: Responda 10 atividades)" value={novoNivel.descricao} onChange={(e) => setNovoNivel({ ...novoNivel, descricao: e.target.value })} style={estiloCampo} />
                    <input type="number" placeholder="Pontos bônus" value={novoNivel.pontosBonus} onChange={(e) => setNovoNivel({ ...novoNivel, pontosBonus: e.target.value })} style={estiloCampo} />
                    <button onClick={() => adicionarNivel(m.id)} disabled={enviando} style={estiloBotao}>Salvar nível</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {aba === 'penalidades' && (
        <div>
          <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            ⚠️ Ao acumular X ocorrências, o aluno perde Y pontos — configure quantos "degraus" quiser.
          </div>

          <div style={{ background: '#F8F8F8', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: 13 }}>Novo degrau</p>
            <label style={estiloRotulo}>Quantidade de ocorrências</label>
            <input type="number" value={novaPenalidade.qtdOcorrencias} onChange={(e) => setNovaPenalidade({ ...novaPenalidade, qtdOcorrencias: e.target.value })} style={estiloCampo} placeholder="Ex.: 3" />
            <label style={estiloRotulo}>Pontos perdidos</label>
            <input type="number" value={novaPenalidade.pontosPerdidos} onChange={(e) => setNovaPenalidade({ ...novaPenalidade, pontosPerdidos: e.target.value })} style={estiloCampo} placeholder="Ex.: 50" />
            <label style={estiloRotulo}>Título</label>
            <input type="text" value={novaPenalidade.titulo} onChange={(e) => setNovaPenalidade({ ...novaPenalidade, titulo: e.target.value })} style={estiloCampo} placeholder="Ex.: Atenção: 3 ocorrências" />
            <button onClick={criarPenalidade} disabled={enviando} style={estiloBotao}>Salvar degrau</button>
          </div>

          {penalidades.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: 13 }}>{p.titulo}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: 11.5, color: '#888' }}>{p.qtd_ocorrencias} ocorrência(s) → -{p.pontos_perdidos} pontos</p>
              </div>
              <button onClick={() => excluirPenalidade(p.id)} style={{ background: 'none', border: 'none', color: '#C93B26', fontSize: 11.5, fontWeight: 'bold', cursor: 'pointer' }}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
