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
  const [jaAtingiuMaximo, setJaAtingiuMaximo] = useState(false);
  const [infoTentativas, setInfoTentativas] = useState(null);
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

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

      // Confere ANTES de mostrar o formulário se o aluno já bateu no
      // limite de 3 tentativas — evita ele perder tempo preenchendo
      // tudo pra descobrir só no final que não pode mais enviar.
      const respostaTentativas = await fetch('/api/entregas/tentativas?atividadeId=' + atividadeId, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const dadosTentativas = await respostaTentativas.json();
      if (dadosTentativas.ok) {
        setInfoTentativas(dadosTentativas);
        if (dadosTentativas.jaAtingiuMaximo) {
          setJaAtingiuMaximo(true);
          setCarregando(false);
          return;
        }
      }

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
    try {
      const resposta = await fetch('/api/entregas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ atividadeId, respostas, avaliacao, observacoes })
      });
      const dados = await resposta.json();

      if (!dados.ok) {
        if (dados.jaAtingiuMaximo) {
          setJaAtingiuMaximo(true);
        } else {
          setErro(dados.erro || 'Não foi possível enviar.');
        }
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

  // Já bateu no limite de 3 tentativas — nem mostra o formulário
  if (jaAtingiuMaximo && !resultado) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 50 }}>🚫</div>
        <h2>Você já respondeu!</h2>
        <p style={{ color: '#888', fontSize: 14 }}>
          Essa atividade permite no máximo 3 tentativas, e você já usou todas.
        </p>
        {infoTentativas && infoTentativas.tentativasAnteriores && infoTentativas.tentativasAnteriores.some((n) => n !== null) && (
          <div style={{ background: '#F4F2FF', borderRadius: 10, padding: 14, marginTop: 16, textAlign: 'left' }}>
            {infoTentativas.tentativasAnteriores.map((nota, i) => (
              <p key={i} style={{ margin: '4px 0', fontSize: 13 }}>Tentativa {i + 1}: <b>{nota !== null ? nota : '—'}</b></p>
            ))}
          </div>
        )}
        <button onClick={() => router.push('/minhas-notas')} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          Ver minhas notas
        </button>
      </main>
    );
  }

  if (!atividade) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Atividade não encontrada.</main>;

  if (resultado) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 50 }}>✅</div>
        <h2>Resposta enviada!</h2>

        {resultado.numQuestoes > 0 ? (
          <>
            <div style={{ background: '#F4F2FF', borderRadius: 12, padding: 16, marginTop: 16, textAlign: 'left' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 12, color: '#888', fontWeight: 'bold' }}>NOTAS POR TENTATIVA</p>
              {resultado.tentativas.map((nota, i) => (
                <p key={i} style={{ margin: '4px 0', fontSize: 15 }}>
                  Tentativa {i + 1}{i + 1 === resultado.numeroDestaTentativa ? ' (agora)' : ''}: <b>{nota} / {resultado.valorNota}</b>
                </p>
              ))}
            </div>

            <p style={{ marginTop: 20, marginBottom: 0, fontSize: 13, color: '#888' }}>Nota média</p>
            <p style={{ fontSize: 46, fontWeight: 'bold', color: '#6C5CE7', margin: '4px 0' }}>
              {resultado.notaMedia} / {resultado.valorNota}
            </p>

            {resultado.aindaPodeTentar ? (
              <p style={{ color: '#888', fontSize: 13 }}>Você ainda pode tentar mais {3 - resultado.numeroDestaTentativa} vez(es).</p>
            ) : (
              <p style={{ color: '#888', fontSize: 13 }}>Essa foi sua última tentativa permitida.</p>
            )}
          </>
        ) : (
          <p style={{ color: '#888' }}>Essa atividade será avaliada manualmente pelo professor(a).</p>
        )}

        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          Voltar
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 18 }}>{atividade.tema}</h1>
      <p style={{ color: '#888', fontSize: 13 }}>{atividade.disciplina} — Aula {atividade.aula_numero}</p>
      {infoTentativas && infoTentativas.qtdTentativas > 0 && (
        <p style={{ color: '#6C5CE7', fontSize: 12.5, fontWeight: 'bold' }}>
          Essa será sua {infoTentativas.qtdTentativas + 1}ª tentativa (de no máximo 3).
        </p>
      )}

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
