'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaMinhasOcorrencias() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // A segurança (RLS) já garante que só vêm as ocorrências do
      // próprio aluno logado.
      const { data, error } = await supabase
        .from('ocorrencias')
        .select('id, tipo, motivos_atividades, motivos_disciplina, detalhamento, professor_nome, criado_em')
        .order('criado_em', { ascending: false });

      if (error) setErro(error.message);
      else setOcorrencias(data || []);
      setCarregando(false);
    }
    carregar();
  }, [router]);

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Minhas Ocorrências</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      {ocorrencias.length === 0 && (
        <p style={{ color: '#888', fontSize: 14 }}>🎉 Você não tem nenhuma ocorrência registrada!</p>
      )}

      {ocorrencias.map((oc) => {
        const motivos = [...(oc.motivos_atividades || []), ...(oc.motivos_disciplina || [])];
        return (
          <div key={oc.id} style={{ padding: 14, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 10 }}>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: 13, color: '#FF7A59' }}>{oc.professor_nome}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#aaa' }}>{new Date(oc.criado_em).toLocaleString('pt-BR')}</p>
            <div style={{ marginTop: 8 }}>
              {motivos.map((m, i) => (
                <span key={i} style={{ display: 'inline-block', background: '#FFF0EA', color: '#C9622C', fontSize: 11.5, fontWeight: 'bold', padding: '4px 10px', borderRadius: 12, margin: '0 6px 6px 0' }}>
                  {m}
                </span>
              ))}
            </div>
            {oc.detalhamento && <p style={{ margin: '8px 0 0 0', fontSize: 12.5, color: '#555', fontStyle: 'italic' }}>"{oc.detalhamento}"</p>}
          </div>
        );
      })}
    </main>
  );
}
