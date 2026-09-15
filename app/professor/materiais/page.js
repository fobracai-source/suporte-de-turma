'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const ICONE_POR_TIPO = { arquivo: '📄', link: '🔗', video: '🎬' };

export default function PaginaMateriaisProfessor() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [professorId, setProfessorId] = useState(null);
  const [turmas, setTurmas] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [meusMateriais, setMeusMateriais] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [turmaId, setTurmaId] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [tipo, setTipo] = useState('arquivo');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [urlExterna, setUrlExterna] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const resposta = await fetch('/api/professor/minhas-turmas-disciplinas', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const dados = await resposta.json();
      if (dados.ok) { setTurmas(dados.turmas); setDisciplinas(dados.disciplinas); setProfessorId(dados.professorId); }

      const { data: materiaisExistentes } = await supabase.from('materiais').select('id, disciplina, tipo, titulo, descricao, criado_em, turmas(nome)').order('criado_em', { ascending: false });
      setMeusMateriais(materiaisExistentes || []);

      setCarregando(false);
    }
    carregar();
  }, [router]);

  function arquivoEscolhido(inputEl) {
    const f = inputEl.files[0];
    if (!f) return;
    setArquivo(f);
    setNomeArquivo(f.name);
  }

  async function adicionarMaterial() {
    setErro('');
    if (!turmaId || !disciplina || !titulo.trim()) { setErro('Preencha turma, disciplina e título.'); return; }
    if (tipo === 'arquivo' && !arquivo) { setErro('Escolha o arquivo.'); return; }
    if (tipo !== 'arquivo' && !urlExterna.trim()) { setErro('Informe o link.'); return; }

    setEnviando(true);
    try {
      let caminhoArquivo = null;
      if (tipo === 'arquivo') {
        const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        caminhoArquivo = `professor-${professorId}/materiais/${turmaId}-${disciplina}/${Date.now()}-${nomeSeguro}`;
        const { error: erroUpload } = await supabase.storage.from('anexos').upload(caminhoArquivo, arquivo);
        if (erroUpload) throw new Error('Erro ao enviar o arquivo: ' + erroUpload.message);
      }

      const resposta = await fetch('/api/professor/adicionar-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ turmaId, disciplina, tipo, titulo, descricao, caminhoArquivo, urlExterna: tipo !== 'arquivo' ? urlExterna : null })
      });
      const dados = await resposta.json();
      if (!dados.ok) { setErro(dados.erro); setEnviando(false); return; }

      const turmaNome = turmas.find((t) => String(t.id) === String(turmaId))?.nome;
      setMeusMateriais((atual) => [{ ...dados.material, turmas: { nome: turmaNome } }, ...atual]);
      setTitulo(''); setDescricao(''); setUrlExterna(''); setArquivo(null); setNomeArquivo(''); setMostrarForm(false);
    } catch (e) {
      setErro(e.message);
    }
    setEnviando(false);
  }

  const estiloCampo = { width: '100%', padding: 12, marginBottom: 14, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box' };
  const estiloRotulo = { display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#333' };

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>📚 Materiais</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>⚠️ {erro}</div>}

      <button onClick={() => setMostrarForm(!mostrarForm)} style={{ width: '100%', padding: 12, marginBottom: 18, borderRadius: 8, border: '1.5px dashed #6C5CE7', background: 'white', color: '#6C5CE7', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
        {mostrarForm ? '✕ Fechar' : '➕ Adicionar material'}
      </button>

      {mostrarForm && (
        <div style={{ background: '#F8F8F8', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <label style={estiloRotulo}>Turma</label>
          <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={estiloCampo}>
            <option value="">Selecione...</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>

          <label style={estiloRotulo}>Disciplina</label>
          <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} style={estiloCampo}>
            <option value="">Selecione...</option>
            {disciplinas.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <label style={estiloRotulo}>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={estiloCampo}>
            <option value="arquivo">Arquivo (PDF, slides...)</option>
            <option value="link">Link</option>
            <option value="video">Vídeo</option>
          </select>

          <label style={estiloRotulo}>Título</label>
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={estiloCampo} placeholder="Ex.: Slides da aula 5" />

          <label style={estiloRotulo}>Descrição <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ ...estiloCampo, minHeight: 50 }} />

          {tipo === 'arquivo' ? (
            <>
              <input type="file" id="inputMaterial" style={{ display: 'none' }} onChange={(e) => arquivoEscolhido(e.target)} />
              <div onClick={() => document.getElementById('inputMaterial').click()} style={{ border: '2px dashed #ddd', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', marginBottom: 14 }}>
                <div style={{ fontSize: 28 }}>📤</div>
                <div style={{ fontWeight: 'bold', fontSize: 13, marginTop: 6 }}>{nomeArquivo || 'Toque para escolher o arquivo'}</div>
              </div>
            </>
          ) : (
            <>
              <label style={estiloRotulo}>Link</label>
              <input type="url" value={urlExterna} onChange={(e) => setUrlExterna(e.target.value)} style={estiloCampo} placeholder="https://..." />
            </>
          )}

          <button onClick={adicionarMaterial} disabled={enviando} style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
            {enviando ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      )}

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Materiais adicionados</h2>
      {meusMateriais.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Nenhum ainda.</p>}
      {meusMateriais.map((m) => (
        <div key={m.id} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 8 }}>
          <div style={{ fontSize: 22 }}>{ICONE_POR_TIPO[m.tipo]}</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 'bold', color: '#6C5CE7' }}>{m.disciplina} — Turma {m.turmas?.nome}</p>
            <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 'bold' }}>{m.titulo}</p>
          </div>
        </div>
      ))}
    </main>
  );
}
