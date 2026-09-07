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

  async function carregarEntregas(atividadeId) {
    setAtividadeSelecionada(atividadeId);
    if (!atividadeId) { setEntregas([]); return; }

    setCarregandoEntregas(true);
    const { data, error } = await supabase
      .from('entregas')
      .select('id, nota_calculada, avaliacao, observacoes, criado_em, alunos(nome)')
      .eq('atividade_id', atividadeId)
      .order('criado_em', { ascending: false });

    if (error) setErro(error.message);
    else setEntregas(data || []);
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
        </div>
      ))}
    </main>
  );
}
