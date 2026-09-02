'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaResponderAtividade() {
  const router = useRouter();
  const params = useParams();
  const atividadeId = params.id;

  const [carregando, setCarregando] = useState(true);
  const [atividade, setAtividade] = useState(null);
  const [numQuestoes, setNumQuestoes] = useState(0);
  const [respostas, setRespostas] = useState([]);
  const [avaliacao, setAvaliacao] = useState(0);
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // Usamos a "vitrine" (atividades_publicas), que NUNCA traz o
      // gabarito — o aluno não tem como ver as respostas certas por
      // aqui, mesmo abrindo o console do navegador.
      const { data, error } = await supabase
        .from('atividades_publicas')
        .select('*')
        .eq('id', atividadeId)
        .maybeSingle();

      if (error || !data) {
        setErro('Não consegui carregar essa atividade.');
        setCarregando(false);
        return;
      }

      setAtividade(data);
      // Descobre quantas questões tem, sem nunca ver a resposta certa:
      // perguntamos pro servidor só a QUANTIDADE, através de uma
      // segunda chamadinha simples.
      const respostaContagem = await fetch('/api/entregas/quantidade-questoes?atividadeId=' + atividadeId);
      const dadosContagem = await respostaContagem.json();
      const qtd = dadosContagem.ok ? dadosContagem.numQuestoes : 0;
      setNumQuestoes(qtd);
      setRespostas(new Array(qtd).fill(''));
      setCarregando(false);
    }
    carregar();
  }, [atividadeId, router]);

  function marcarResposta(indice, letra) {
    const novas = [...respostas];
    novas[indice] = letra;
    setRespostas(novas);
  }

  async function enviar() {
    setErro('');
    if (numQuestoes > 0 && respostas.some((r) => !r)) {
      setErro('Responda todas as questões antes de enviar.');
      return;
    }

    setEnviando(true);
    const { data: { session } } = await supabase.auth.getSession();

    try {
      const resposta = await fetch('/api/entregas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ atividadeId, respostas, avaliacao, observacoes })
      });
      const dados = await resposta.json();

      if (!dados.ok) {
        setErro(dados.erro || 'Não foi possível enviar.');
        setEnviando(false);
        return;
      }
      setResultado(dados);
    } catch (e) {
      setErro('Erro inesperado: ' + e.message);
      setEnviando(false);
    }
  }

  const estiloCartao = { padding: 16, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 14 };
  const estiloBotaoLetra = (ativo) => ({
    width: 44, height: 44, borderRadius: '50%', border: ativo ? 'none' : '2px solid #ddd',
    background: ativo ? '#6C5CE7' : 'white', color: ativo ? 'white' : '#333',
    fontWeight: 'bold', cursor: 'pointer', marginRight: 8
  });

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;
  if (!atividade) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Atividade não encontrada.</main>;

  if (resultado) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 50 }}>✅</div>
        <h2>Resposta enviada!</h2>
        {resultado.numQuestoes > 0 ? (
          <p style={{ fontSize: 22, fontWeight: 'bold', color: '#6C5CE7' }}>
            Nota: {resultado.notaCalculada} / {resultado.valorNota}
          </p>
        ) : (
          <p style={{ color: '#888' }}>Essa atividade será avaliada manualmente pelo professor(a).</p>
        )}
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          Voltar
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 18 }}>{atividade.tema}</h1>
      <p style={{ color: '#888', fontSize: 13 }}>{atividade.disciplina} — Aula {atividade.aula_numero}</p>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      {Array.from({ length: numQuestoes }).map((_, indice) => (
        <div key={indice} style={estiloCartao}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: 14 }}>Questão {indice + 1}</p>
          <div style={{ display: 'flex' }}>
            {['A', 'B', 'C', 'D', 'E'].map((letra) => (
              <button key={letra} onClick={() => marcarResposta(indice, letra)} style={estiloBotaoLetra(respostas[indice] === letra)}>
                {letra}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={estiloCartao}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: 14 }}>Observações (opcional)</p>
        <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} style={{ width: '100%', minHeight: 70, padding: 10, borderRadius: 8, border: '1.5px solid #ddd', boxSizing: 'border-box' }} />
      </div>

      <button onClick={enviar} disabled={enviando} style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' }}>
        {enviando ? 'Enviando...' : 'Enviar respostas'}
      </button>
    </main>
  );
}
