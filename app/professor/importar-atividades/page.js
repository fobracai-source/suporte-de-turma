'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaImportarAtividades() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [disciplinas, setDisciplinas] = useState([]);
  const [turmas, setTurmas] = useState([]);

  const [disciplina, setDisciplina] = useState('');
  const [turmasSelecionadas, setTurmasSelecionadas] = useState([]);
  const [arquivoBase64, setArquivoBase64] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState('');

  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const resposta = await fetch('/api/professor/minhas-turmas-disciplinas', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const dados = await resposta.json();
      if (dados.ok) {
        setDisciplinas(dados.disciplinas);
        setTurmas(dados.turmas);
      }
      setCarregando(false);
    }
    carregar();
  }, [router]);

  function alternarTurma(turmaId) {
    setTurmasSelecionadas((atual) => atual.includes(turmaId) ? atual.filter((t) => t !== turmaId) : [...atual, turmaId]);
  }

  function arquivoEscolhido(inputEl) {
    const arquivo = inputEl.files[0];
    if (!arquivo) return;
    setNomeArquivo(arquivo.name);
    setResultado(null);
    const leitor = new FileReader();
    leitor.onload = (evento) => setArquivoBase64(evento.target.result.split(',')[1]);
    leitor.readAsDataURL(arquivo);
  }

  async function importar() {
    setErro(''); setResultado(null);
    if (!disciplina) { setErro('Selecione a disciplina.'); return; }
    if (turmasSelecionadas.length === 0) { setErro('Selecione pelo menos uma turma.'); return; }
    if (!arquivoBase64) { setErro('Escolha o arquivo da planilha.'); return; }

    setEnviando(true);
    try {
      const resposta = await fetch('/api/professor/importar-atividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ disciplina, turmaIds: turmasSelecionadas, arquivoBase64 })
      });
      const dados = await resposta.json();
      setEnviando(false);
      if (!dados.ok) { setErro(dados.erro); return; }
      setResultado(dados);
    } catch (e) {
      setEnviando(false);
      setErro('Erro inesperado: ' + e.message);
    }
  }

  const estiloCampo = { width: '100%', padding: 12, marginBottom: 16, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box' };
  const estiloRotulo = { display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#333' };
  const estiloBotao = { width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' };

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Importar atividades</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      <div style={{ background: '#F4F2FF', color: '#4E3FC7', padding: 12, borderRadius: 8, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
        📄 A planilha deve ter, nesta ordem: <b>Nº da aula, Tema, Data inicial, Data final, Valor da nota, Gabarito</b>.
        <br />O gabarito é opcional (ex.: <code>ABCAB</code>) — deixe em branco se for trabalho/entrega sem correção automática.
        <br />Disciplina e turmas valem pra <b>toda a planilha</b> — não precisam estar no arquivo.
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      {disciplinas.length === 0 ? (
        <p style={{ color: '#888' }}>Você ainda não tem nenhuma disciplina/turma vinculada. Peça pro administrador configurar isso.</p>
      ) : (
        <>
          <label style={estiloRotulo}>Disciplina</label>
          <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} style={estiloCampo}>
            <option value="">Selecione...</option>
            {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <label style={estiloRotulo}>Turmas</label>
          <div style={{ marginBottom: 16 }}>
            {turmas.map((t) => (
              <label key={t.id} style={{ display: 'inline-block', marginRight: 8, marginBottom: 8, padding: '8px 14px', borderRadius: 20, border: turmasSelecionadas.includes(t.id) ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: turmasSelecionadas.includes(t.id) ? '#F4F2FF' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                <input type="checkbox" checked={turmasSelecionadas.includes(t.id)} onChange={() => alternarTurma(t.id)} style={{ display: 'none' }} />
                {t.nome}
              </label>
            ))}
          </div>

          <label style={estiloRotulo}>Planilha (.xlsx)</label>
          <input type="file" id="inputArquivo" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => arquivoEscolhido(e.target)} />
          <div onClick={() => document.getElementById('inputArquivo').click()} style={{ border: '2px dashed #ddd', borderRadius: 10, padding: 24, textAlign: 'center', cursor: 'pointer', marginBottom: 20 }}>
            <div style={{ fontSize: 32 }}>📤</div>
            <div style={{ fontWeight: 'bold', fontSize: 13, marginTop: 6 }}>{nomeArquivo || 'Toque para escolher a planilha'}</div>
          </div>

          <button onClick={importar} disabled={enviando} style={estiloBotao}>{enviando ? 'Importando...' : 'Importar atividades'}</button>

          {resultado && (
            <div style={{ marginTop: 18, background: '#F8F8F8', borderRadius: 10, padding: 16, fontSize: 13 }}>
              <p style={{ margin: '0 0 6px 0' }}>✅ <b>{resultado.criadas}</b> atividade(s) criada(s)</p>
              {resultado.erros.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #ddd' }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: '#C93B26' }}>⚠️ Avisos:</p>
                  {resultado.erros.map((e, i) => <p key={i} style={{ margin: '2px 0', fontSize: 12, color: '#C93B26' }}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
