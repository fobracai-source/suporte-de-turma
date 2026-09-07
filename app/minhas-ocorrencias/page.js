'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaMinhasOcorrencias() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [defesasEnviadas, setDefesasEnviadas] = useState({}); // ocorrencia_id -> true
  const [erro, setErro] = useState('');

  const [ocorrenciaAberta, setOcorrenciaAberta] = useState(null);
  const [justificativa, setJustificativa] = useState('');
  const [naoQuerJustificar, setNaoQuerJustificar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [alunoId, setAlunoId] = useState(null);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: aluno } = await supabase
        .from('alunos')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();
      if (aluno) setAlunoId(aluno.id);

      // A segurança (RLS) já garante que só vêm as ocorrências do
      // próprio aluno logado.
      const { data, error } = await supabase
        .from('ocorrencias')
        .select('id, turma_id, tipo, motivos_atividades, motivos_disciplina, detalhamento, professor_nome, criado_em')
        .order('criado_em', { ascending: false });

      if (error) { setErro(error.message); setCarregando(false); return; }
      setOcorrencias(data || []);

      const { data: defesas } = await supabase.from('defesa_ocorrencias').select('ocorrencia_id');
      const mapa = {};
      (defesas || []).forEach((d) => { mapa[d.ocorrencia_id] = true; });
      setDefesasEnviadas(mapa);

      setCarregando(false);
    }
    carregar();
  }, [router]);

  function abrirDefesa(ocorrenciaId) {
    setOcorrenciaAberta(ocorrenciaId);
    setJustificativa('');
    setNaoQuerJustificar(false);
    setErro('');
  }

  async function enviarDefesa(ocorrencia) {
    if (!naoQuerJustificar && !justificativa.trim()) {
      setErro('Escreva sua justificativa, ou marque "Não quero justificar".');
      return;
    }
    setEnviando(true);

    const { error } = await supabase.from('defesa_ocorrencias').insert({
      ocorrencia_id: ocorrencia.id,
      aluno_id: alunoId,
      turma_id: ocorrencia.turma_id,
      justificativa: naoQuerJustificar ? '' : justificativa.trim(),
      nao_quis_justificar: naoQuerJustificar
    });

    if (error) {
      setErro(error.message);
      setEnviando(false);
      return;
    }

    setDefesasEnviadas((atual) => ({ ...atual, [ocorrencia.id]: true }));
    setOcorrenciaAberta(null);
    setEnviando(false);
  }

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
        const jaDefendeu = !!defesasEnviadas[oc.id];
        const estaAberta = ocorrenciaAberta === oc.id;

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

            {jaDefendeu ? (
              <p style={{ marginTop: 10, fontSize: 12, color: '#2ECC71', fontWeight: 'bold' }}>✓ Você já se manifestou sobre essa ocorrência.</p>
            ) : estaAberta ? (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                <textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  disabled={naoQuerJustificar}
                  placeholder="Escreva sua justificativa..."
                  style={{ width: '100%', minHeight: 70, padding: 10, borderRadius: 8, border: '1.5px solid #ddd', boxSizing: 'border-box', fontSize: 13, marginBottom: 8 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#666', marginBottom: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={naoQuerJustificar} onChange={(e) => setNaoQuerJustificar(e.target.checked)} />
                  Não quero justificar
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => enviarDefesa(oc)} disabled={enviando} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
                    {enviando ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button onClick={() => setOcorrenciaAberta(null)} style={{ padding: '10px 16px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', color: '#555', fontSize: 13, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => abrirDefesa(oc.id)}
                style={{ marginTop: 10, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #6C5CE7', background: 'white', color: '#6C5CE7', fontWeight: 'bold', fontSize: 12.5, cursor: 'pointer' }}>
                🛡️ Me defender
              </button>
            )}
          </div>
        );
      })}
    </main>
  );
}
