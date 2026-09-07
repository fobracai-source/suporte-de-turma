'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaMinhasNotas() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [entregas, setEntregas] = useState([]);
  const [erro, setErro] = useState('');
  const [mediaGeral, setMediaGeral] = useState(null);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // A segurança (RLS) já garante que só vêm as entregas do próprio
      // aluno logado — não precisa filtrar nada aqui manualmente.
      const { data, error } = await supabase
        .from('entregas')
        .select('id, nota_calculada, avaliacao, criado_em, atividades(disciplina, aula_numero, tema, valor_nota)')
        .order('criado_em', { ascending: false });

      if (error) {
        setErro(error.message);
        setCarregando(false);
        return;
      }

      setEntregas(data || []);

      var comNota = (data || []).filter((e) => e.nota_calculada !== null);
      if (comNota.length > 0) {
        var somaPercentual = comNota.reduce((soma, e) => {
          var valorMax = e.atividades?.valor_nota || 1;
          return soma + (e.nota_calculada / valorMax);
        }, 0);
        setMediaGeral(Math.round((somaPercentual / comNota.length) * 1000) / 10);
      }

      setCarregando(false);
    }
    carregar();
  }, [router]);

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Minhas Notas</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      {mediaGeral !== null && (
        <div style={{ background: '#F4F2FF', borderRadius: 12, padding: 18, marginBottom: 20, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Seu aproveitamento geral</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 32, fontWeight: 'bold', color: '#6C5CE7' }}>{mediaGeral}%</p>
        </div>
      )}

      {entregas.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Você ainda não respondeu nenhuma atividade.</p>}

      {entregas.map((e) => {
        const atividade = e.atividades || {};
        const temNota = e.nota_calculada !== null && e.nota_calculada !== undefined;
        const percentual = temNota && atividade.valor_nota ? (e.nota_calculada / atividade.valor_nota) : null;
        const cor = percentual !== null ? (percentual >= 0.6 ? '#2ECC71' : '#FF5C5C') : '#888';

        return (
          <div key={e.id} style={{ padding: 14, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{atividade.disciplina} — Aula {atividade.aula_numero}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>{atividade.tema}</p>
              <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#aaa' }}>{new Date(e.criado_em).toLocaleDateString('pt-BR')}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {temNota ? (
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: 20, color: cor }}>{e.nota_calculada}/{atividade.valor_nota}</p>
              ) : (
                <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Em avaliação</p>
              )}
            </div>
          </div>
        );
      })}
    </main>
  );
}
