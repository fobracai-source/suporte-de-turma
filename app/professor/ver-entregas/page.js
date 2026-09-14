'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaVerEntregas() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [minhasAtividades, setMinhasAtividades] = useState([]);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState('');
  const [entregas, setEntregas] = useState([]);
  const [faltamEntregar, setFaltamEntregar] = useState([]);
  const [carregandoEntregas, setCarregandoEntregas] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // A segurança (RLS) já garante que só vêm as atividades desse
      // professor — não precisa filtrar manualmente aqui.
      const { data, error } = await supabase
        .from('atividades')
        .select('id, disciplina, aula_numero, tema')
        .order('aula_numero');

      if (error) setErro(error.message);
      else setMinhasAtividades(data || []);

      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function abrirAnexo(entregaId, caminhoArquivo) {
    const { data: { session } } = await supabase.auth.getSession();
    const resposta = await fetch('/api/anexos/url-assinada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ entregaId, caminhoArquivo })
    });
    const dados = await resposta.json();
    if (dados.ok) window.open(dados.url, '_blank');
    else alert('Não consegui abrir o anexo: ' + dados.erro);
  }

  async function carregarEntregas(atividadeId) {
    setAtividadeSelecionada(atividadeId);
    if (!atividadeId) { setEntregas([]); setFaltamEntregar([]); return; }

    setCarregandoEntregas(true);

    const { data: entregasFeitas, error } = await supabase
      .from('entregas')
      .select('id, aluno_id, nota_calculada, avaliacao, observacoes, arquivos, criado_em, alunos(nome)')
      .eq('atividade_id', atividadeId)
      .order('criado_em', { ascending: false });

    if (error) {
      setErro(error.message);
      setCarregandoEntregas(false);
      return;
    }
    setEntregas(entregasFeitas || []);

    // Descobre quais turmas essa atividade vale, pra saber o "universo"
    // completo de alunos que deveriam responder — e comparar com quem
    // já entregou, pra achar quem falta.
    const { data: vinculos } = await supabase.from('atividade_turmas').select('turma_id').eq('atividade_id', atividadeId);
    const turmaIds = (vinculos || []).map((v) => v.turma_id);

    if (turmaIds.length > 0) {
      const { data: todosAlunos } = await supabase.from('alunos').select('id, nome').in('turma_id', turmaIds).order('nome');
      const idsQueJaEntregaram = new Set((entregasFeitas || []).map((e) => e.aluno_id));
      setFaltamEntregar((todosAlunos || []).filter((a) => !idsQueJaEntregaram.has(a.id)));
    } else {
      setFaltamEntregar([]);
    }

    setCarregandoEntregas(false);
  }

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Ver Entregas</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      <label style={{ display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>Escolha a atividade</label>
      <select
        value={atividadeSelecionada}
        onChange={(e) => carregarEntregas(e.target.value)}
        style={{ width: '100%', padding: 12, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}>
        <option value="">Selecione...</option>
        {minhasAtividades.map((a) => (
          <option key={a.id} value={a.id}>{a.disciplina} — Aula {a.aula_numero} — {a.tema}</option>
        ))}
      </select>

      {carregandoEntregas && <p style={{ color: '#888', fontSize: 13 }}>Carregando entregas...</p>}

      {!carregandoEntregas && atividadeSelecionada && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#F4F2FF', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 'bold', color: '#6C5CE7' }}>{entregas.length}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#888' }}>já entregaram</p>
          </div>
          <div style={{ flex: 1, background: '#FFF0EA', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 'bold', color: '#FF7A59' }}>{faltamEntregar.length}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#888' }}>faltam entregar</p>
          </div>
        </div>
      )}

      {!carregandoEntregas && atividadeSelecionada && entregas.length === 0 && (
        <p style={{ color: '#888', fontSize: 14 }}>Ninguém entregou essa atividade ainda.</p>
      )}

      {entregas.map((e) => (
        <div key={e.id} style={{ padding: 14, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{e.alunos?.nome || 'Aluno'}</p>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: 16, color: '#6C5CE7' }}>
              {e.nota_calculada !== null ? e.nota_calculada : '—'}
            </p>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#aaa' }}>{new Date(e.criado_em).toLocaleString('pt-BR')}</p>
          {e.observacoes && <p style={{ margin: '6px 0 0 0', fontSize: 12.5, color: '#555' }}>"{e.observacoes}"</p>}
          {(e.arquivos || []).length > 0 && (
            <div style={{ marginTop: 8 }}>
              {e.arquivos.map((caminho, i) => (
                <button key={i} onClick={() => abrirAnexo(e.id, caminho)} style={{ display: 'inline-block', marginRight: 6, marginBottom: 6, padding: '5px 10px', borderRadius: 12, border: '1.5px solid #6C5CE7', background: 'white', color: '#6C5CE7', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>
                  📎 Anexo {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {!carregandoEntregas && faltamEntregar.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 'bold', color: '#FF7A59', marginBottom: 10 }}>⏳ Ainda faltam entregar:</p>
          {faltamEntregar.map((a) => (
            <div key={a.id} style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px dashed #FFD5C4', marginBottom: 8, background: '#FFFAF8' }}>
              <p style={{ margin: 0, fontSize: 13.5, color: '#555' }}>{a.nome}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
