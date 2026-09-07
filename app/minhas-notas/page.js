'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaMinhasNotas() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [atividadesAgrupadas, setAtividadesAgrupadas] = useState([]);
  const [erro, setErro] = useState('');
  const [mediaGeral, setMediaGeral] = useState(null);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data, error } = await supabase
        .from('entregas')
        .select('id, atividade_id, nota_calculada, criado_em, atividades(disciplina, aula_numero, tema, valor_nota)')
        .order('criado_em', { ascending: true });

      if (error) {
        setErro(error.message);
        setCarregando(false);
        return;
      }

      const porAtividade = {};
      (data || []).forEach((e) => {
        if (!porAtividade[e.atividade_id]) {
          porAtividade[e.atividade_id] = { atividade: e.atividades, tentativas: [] };
        }
        porAtividade[e.atividade_id].tentativas.push(e.nota_calculada);
      });

      const lista = Object.values(porAtividade).map((grupo) => {
        const temNota = grupo.tentativas.some((n) => n !== null);
        let media = null;
        if (temNota) {
          const soma = grupo.tentativas.reduce((s, n) => s + (n || 0), 0);
          media = Math.round((soma / grupo.tentativas.length) * 100) / 100;
        }
        return { ...grupo, media, temNota };
      });

      setAtividadesAgrupadas(lista);

      const comNota = lista.filter((l) => l.temNota);
      if (comNota.length > 0) {
        const somaPercentual = comNota.reduce((soma, l) => {
          const valorMax = l.atividade?.valor_nota || 1;
          return soma + (l.media / valorMax);
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

      {atividadesAgrupadas.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Você ainda não respondeu nenhuma atividade.</p>}

      {atividadesAgrupadas.map((grupo, indice) => {
        const atividade = grupo.atividade || {};
        const percentual = grupo.temNota && atividade.valor_nota ? (grupo.media / atividade.valor_nota) : null;
        const cor = percentual !== null ? (percentual >= 0.6 ? '#2ECC71' : '#FF5C5C') : '#888';

        return (
          <div key={indice} style={{ padding: 14, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{atividade.disciplina} — Aula {atividade.aula_numero}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>{atividade.tema}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {grupo.temNota ? (
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: 20, color: cor }}>{grupo.media}/{atividade.valor_nota}</p>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Em avaliação</p>
                )}
              </div>
            </div>
            {grupo.tentativas.length > 1 && (
              <p style={{ margin: '10px 0 0 0', fontSize: 11.5, color: '#aaa' }}>
                {grupo.tentativas.length} tentativa(s): {grupo.tentativas.map((n) => n !== null ? n : '—').join(' · ')} (nota mostrada = média)
              </p>
            )}
          </div>
        );
      })}
    </main>
  );
}
