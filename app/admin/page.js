'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaAdmin() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [souAdmin, setSouAdmin] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [aba, setAba] = useState('turma');
  const [turmas, setTurmas] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Turma
  const [nomeTurma, setNomeTurma] = useState('');

  // Professor
  const [nomeProfessor, setNomeProfessor] = useState('');
  const [emailProfessor, setEmailProfessor] = useState('');
  const [dataNascProfessor, setDataNascProfessor] = useState('');
  const [disciplinasTexto, setDisciplinasTexto] = useState('');
  const [turmasDoProfessor, setTurmasDoProfessor] = useState([]);

  // Aluno
  const [nomeAluno, setNomeAluno] = useState('');
  const [turmaDoAluno, setTurmaDoAluno] = useState('');

  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setAccessToken(session.access_token);

      const { data: professor } = await supabase
        .from('professores')
        .select('is_admin')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      if (professor && professor.is_admin) {
        setSouAdmin(true);
        const { data: t } = await supabase.from('turmas').select('id, nome').order('nome');
        setTurmas(t || []);
      }
      setCarregando(false);
    }
    carregar();
  }, [router]);

  function alternarTurmaProfessor(id) {
    setTurmasDoProfessor((atual) => atual.includes(id) ? atual.filter((t) => t !== id) : [...atual, id]);
  }

  async function chamarApi(caminho, corpo) {
    setErro(''); setSucesso(''); setEnviando(true);
    try {
      const resposta = await fetch(caminho, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(corpo)
      });
      const dados = await resposta.json();
      setEnviando(false);
      if (!dados.ok) { setErro(dados.erro); return null; }
      return dados;
    } catch (e) {
      setEnviando(false);
      setErro('Erro inesperado: ' + e.message);
      return null;
    }
  }

  async function criarTurma() {
    const dados = await chamarApi('/api/admin/criar-turma', { nome: nomeTurma });
    if (dados) {
      setSucesso(`Turma "${dados.turma.nome}" criada!`);
      setTurmas((atual) => [...atual, dados.turma].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNomeTurma('');
    }
  }

  async function criarProfessor() {
    const disciplinas = disciplinasTexto.split(',').map((d) => d.trim()).filter(Boolean);
    const dados = await chamarApi('/api/admin/criar-professor', {
      nome: nomeProfessor, email: emailProfessor, dataNascimento: dataNascProfessor,
      disciplinas, turmaIds: turmasDoProfessor
    });
    if (dados) {
      setSucesso(`Professor(a) "${dados.professor.nome}" cadastrado(a)!`);
      setNomeProfessor(''); setEmailProfessor(''); setDataNascProfessor(''); setDisciplinasTexto(''); setTurmasDoProfessor([]);
    }
  }

  async function criarAluno() {
    const dados = await chamarApi('/api/admin/criar-aluno', { nome: nomeAluno, turmaId: turmaDoAluno });
    if (dados) {
      setSucesso(`Aluno "${dados.aluno.nome}" cadastrado! Ele mesmo completa o resto no primeiro acesso dele.`);
      setNomeAluno('');
    }
  }

  const estiloCampo = { width: '100%', padding: 12, marginBottom: 14, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box' };
  const estiloRotulo = { display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#333' };
  const estiloBotao = { width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' };
  const estiloAba = (ativa) => ({ flex: 1, padding: 10, borderRadius: 8, border: ativa ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: ativa ? '#F4F2FF' : 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: 13 });

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  if (!souAdmin) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <p>🔒 Você não tem permissão de administrador.</p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          Voltar
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Administração</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => { setAba('turma'); setErro(''); setSucesso(''); }} style={estiloAba(aba === 'turma')}>Turma</button>
        <button onClick={() => { setAba('professor'); setErro(''); setSucesso(''); }} style={estiloAba(aba === 'professor')}>Professor</button>
        <button onClick={() => { setAba('aluno'); setErro(''); setSucesso(''); }} style={estiloAba(aba === 'aluno')}>Aluno</button>
      </div>

      {erro && <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>⚠️ {erro}</div>}
      {sucesso && <div style={{ background: '#E8F9EE', color: '#1E8449', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>✅ {sucesso}</div>}

      {aba === 'turma' && (
        <div>
          <label style={estiloRotulo}>Nome da turma</label>
          <input type="text" value={nomeTurma} onChange={(e) => setNomeTurma(e.target.value)} style={estiloCampo} placeholder="Ex.: 81, 103A..." />
          <button onClick={criarTurma} disabled={enviando} style={estiloBotao}>{enviando ? 'Criando...' : 'Criar turma'}</button>
        </div>
      )}

      {aba === 'professor' && (
        <div>
          <label style={estiloRotulo}>Nome completo</label>
          <input type="text" value={nomeProfessor} onChange={(e) => setNomeProfessor(e.target.value)} style={estiloCampo} />

          <label style={estiloRotulo}>E-mail <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <input type="email" value={emailProfessor} onChange={(e) => setEmailProfessor(e.target.value)} style={estiloCampo} />

          <label style={estiloRotulo}>Data de nascimento <span style={{ color: '#C93B26' }}>*vira a senha dele</span></label>
          <input type="date" value={dataNascProfessor} onChange={(e) => setDataNascProfessor(e.target.value)} style={estiloCampo} />

          <label style={estiloRotulo}>Disciplinas <span style={{ fontWeight: 400, color: '#999' }}>(separadas por vírgula)</span></label>
          <input type="text" value={disciplinasTexto} onChange={(e) => setDisciplinasTexto(e.target.value)} style={estiloCampo} placeholder="Ex.: Matemática, Física" />

          <label style={estiloRotulo}>Turmas em que dá aula</label>
          <div style={{ marginBottom: 16 }}>
            {turmas.map((t) => (
              <label key={t.id} style={{ display: 'inline-block', marginRight: 8, marginBottom: 8, padding: '8px 14px', borderRadius: 20, border: turmasDoProfessor.includes(t.id) ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: turmasDoProfessor.includes(t.id) ? '#F4F2FF' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                <input type="checkbox" checked={turmasDoProfessor.includes(t.id)} onChange={() => alternarTurmaProfessor(t.id)} style={{ display: 'none' }} />
                {t.nome}
              </label>
            ))}
          </div>

          <button onClick={criarProfessor} disabled={enviando} style={estiloBotao}>{enviando ? 'Cadastrando...' : 'Cadastrar professor(a)'}</button>
        </div>
      )}

      {aba === 'aluno' && (
        <div>
          <label style={estiloRotulo}>Nome completo</label>
          <input type="text" value={nomeAluno} onChange={(e) => setNomeAluno(e.target.value)} style={estiloCampo} />

          <label style={estiloRotulo}>Turma</label>
          <select value={turmaDoAluno} onChange={(e) => setTurmaDoAluno(e.target.value)} style={estiloCampo}>
            <option value="">Selecione...</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>

          <p style={{ fontSize: 12, color: '#888', marginTop: -6, marginBottom: 16 }}>
            O aluno preenche o resto (data de nascimento, telefone, etc.) sozinho, no primeiro acesso dele ao site.
          </p>

          <button onClick={criarAluno} disabled={enviando} style={estiloBotao}>{enviando ? 'Cadastrando...' : 'Cadastrar aluno(a)'}</button>
        </div>
      )}
    </main>
  );
}
