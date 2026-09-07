'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaVerOcorrencias() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [defesasPorOcorrencia, setDefesasPorOcorrencia] = useState({});
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // A segurança (RLS) já garante que só vêm as ocorrências das
      // turmas desse professor.
      const { data, error } = await supabase
        .from('ocorrencias')
        .select('id, disciplina, tipo, motivos_atividades, motivos_disciplina, detalhamento, professor_nome, criado_em, alunos(nome), turmas(nome)')
        .order('criado_em', { ascending: false });

      if (error) { setErro(error.message); setCarregando(false); return; }
      setOcorrencias(data || []);

      const { data: defesas } = await supabase
        .from('defesa_ocorrencias')
        .select('ocorrencia_id, justificativa, nao_quis_justificar, criado_em');

      const mapa = {};
      (defesas || []).forEach((d) => { mapa[d.ocorrencia_id] = d; });
      setDefesasPorOcorrencia(mapa);

      setCarregando(false);
    }
    carregar();
  }, [router]);

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Ocorrências</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      {ocorrencias.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Nenhuma ocorrência registrada ainda.</p>}

      {ocorrencias.map((oc) => {
        const motivos = [...(oc.motivos_atividades || []), ...(oc.motivos_disciplina || [])];
        const defesa = defesasPorOcorrencia[oc.id];

        return (
          <div key={oc.id} style={{ padding: 14, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{oc.alunos?.nome}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#888' }}>Turma {oc.turmas?.nome}{oc.disciplina ? ` — ${oc.disciplina}` : ''}</p>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{new Date(oc.criado_em).toLocaleDateString('pt-BR')}</p>
            </div>

            <div style={{ marginTop: 8 }}>
              {motivos.map((m, i) => (
                <span key={i} style={{ display: 'inline-block', background: '#FFF0EA', color: '#C9622C', fontSize: 11.5, fontWeight: 'bold', padding: '4px 10px', borderRadius: 12, margin: '0 6px 6px 0' }}>
                  {m}
                </span>
              ))}
            </div>

            {oc.detalhamento && <p style={{ margin: '6px 0 0 0', fontSize: 12.5, color: '#555', fontStyle: 'italic' }}>"{oc.detalhamento}"</p>}
            <p style={{ margin: '8px 0 0 0', fontSize: 11, color: '#aaa' }}>Registrado por: {oc.professor_nome}</p>

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f2f2f2' }}>
              {!defesa && (
                <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>💬 O aluno ainda não se manifestou sobre essa ocorrência.</p>
              )}
              {defesa && defesa.nao_quis_justificar && (
                <p style={{ margin: 0, fontSize: 12, color: '#888' }}>🤐 O aluno optou por não justificar.</p>
              )}
              {defesa && !defesa.nao_quis_justificar && (
                <div>
                  <p style={{ margin: 0, fontSize: 11.5, fontWeight: 'bold', color: '#6C5CE7' }}>🛡️ Defesa do aluno:</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#555', fontStyle: 'italic' }}>"{defesa.justificativa}"</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </main>
  );
}
