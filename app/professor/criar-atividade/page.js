'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaCriarAtividade() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [disciplinas, setDisciplinas] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [accessToken, setAccessToken] = useState('');

  const [disciplina, setDisciplina] = useState('');
  const [aulaNumero, setAulaNumero] = useState('');
  const [tema, setTema] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [valorNota, setValorNota] = useState('10');
  const [gabarito, setGabarito] = useState('');
  const [turmasSelecionadas, setTurmasSelecionadas] = useState([]);

  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const resposta = await fetch('/api/professor/minhas-turmas-disciplinas', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const dados = await resposta.json();

      if (!dados.ok) {
        setErro(dados.erro || 'Não foi possível carregar seus dados.');
        setCarregando(false);
        return;
      }

      setDisciplinas(dados.disciplinas);
      setTurmas(dados.turmas);
      setCarregando(false);
    }
    carregar();
  }, [router]);

  function alternarTurma(turmaId) {
    setTurmasSelecionadas((atual) =>
      atual.includes(turmaId) ? atual.filter((t) => t !== turmaId) : [...atual, turmaId]
    );
  }

  async function salvar() {
    setErro('');
    if (!disciplina) { setErro('Selecione a disciplina.'); return; }
    if (!aulaNumero) { setErro('Informe o número da aula.'); return; }
    if (!tema.trim()) { setErro('Informe o tema.'); return; }
    if (turmasSelecionadas.length === 0) { setErro('Selecione pelo menos uma turma.'); return; }

    setEnviando(true);
    try {
      const resposta = await fetch('/api/atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          disciplina, aulaNumero: Number(aulaNumero), tema,
          dataInicial: dataInicial || null, dataFinal: dataFinal || null,
          valorNota: Number(valorNota), gabarito, turmaIds: turmasSelecionadas
        })
      });
      const dados = await resposta.json();

      if (!dados.ok) { setErro(dados.erro); setEnviando(false); return; }
      setSucesso(true);
    } catch (e) {
      setErro('Erro inesperado: ' + e.message);
      setEnviando(false);
    }
  }

  const estiloCampo = { width: '100%', padding: 12, marginBottom: 16, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box' };
  const estiloRotulo = { display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#333' };
  const estiloBotao = { width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' };

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  if (sucesso) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 50 }}>✅</div>
        <h2>Atividade criada!</h2>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          Voltar
        </button>
        <button onClick={() => window.location.reload()} style={{ marginTop: 12, marginLeft: 10, padding: '10px 24px', borderRadius: 8, border: '1.5px solid #6C5CE7', background: 'white', color: '#6C5CE7', fontWeight: 'bold', cursor: 'pointer' }}>
          Criar outra
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>Cadastrar atividade</h1>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, margin: '14px 0', fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      {disciplinas.length === 0 ? (
        <p style={{ color: '#888', marginTop: 20 }}>
          Você ainda não tem nenhuma disciplina/turma vinculada ao seu cadastro. Peça pro administrador configurar isso na tabela <code>professor_disciplinas</code> / <code>professor_turmas</code>.
        </p>
      ) : (
        <>
          <label style={estiloRotulo}>Disciplina</label>
          <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} style={estiloCampo}>
            <option value="">Selecione...</option>
            {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <label style={estiloRotulo}>Nº da aula</label>
          <input type="number" value={aulaNumero} onChange={(e) => setAulaNumero(e.target.value)} style={estiloCampo} />

          <label style={estiloRotulo}>Tema</label>
          <input type="text" value={tema} onChange={(e) => setTema(e.target.value)} style={estiloCampo} />

          <label style={estiloRotulo}>Data inicial <span style={{ fontWeight: 400, color: '#888' }}>(opcional)</span></label>
          <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} style={estiloCampo} />

          <label style={estiloRotulo}>Data final <span style={{ fontWeight: 400, color: '#888' }}>(opcional)</span></label>
          <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} style={estiloCampo} />

          <label style={estiloRotulo}>Valor da nota</label>
          <input type="number" step="0.1" value={valorNota} onChange={(e) => setValorNota(e.target.value)} style={estiloCampo} />

          <label style={estiloRotulo}>Gabarito <span style={{ fontWeight: 400, color: '#888' }}>(ex.: ABCAB — deixe em branco se for trabalho/entrega sem correção automática)</span></label>
          <input type="text" value={gabarito} onChange={(e) => setGabarito(e.target.value)} style={estiloCampo} placeholder="Ex.: ABCAB" />

          <label style={estiloRotulo}>Turmas</label>
          <div style={{ marginBottom: 20 }}>
            {turmas.map((t) => (
              <label key={t.id} style={{ display: 'inline-block', marginRight: 10, marginBottom: 8, padding: '8px 14px', borderRadius: 20, border: turmasSelecionadas.includes(t.id) ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: turmasSelecionadas.includes(t.id) ? '#F4F2FF' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                <input type="checkbox" checked={turmasSelecionadas.includes(t.id)} onChange={() => alternarTurma(t.id)} style={{ display: 'none' }} />
                {t.nome}
              </label>
            ))}
          </div>

          <button onClick={salvar} disabled={enviando} style={estiloBotao}>
            {enviando ? 'Salvando...' : 'Salvar atividade'}
          </button>
        </>
      )}
    </main>
  );
}
