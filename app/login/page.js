'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaLogin() {
  const router = useRouter();

  const [tipo, setTipo] = useState('aluno');
  const [turmas, setTurmas] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [nomes, setNomes] = useState([]);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Controla se é primeiro acesso (sem conta ainda) ou acesso normal
  const [verificandoCadastro, setVerificandoCadastro] = useState(false);
  const [ehPrimeiroAcesso, setEhPrimeiroAcesso] = useState(null); // null = ainda não sabemos

  // Campos do formulário de primeiro acesso
  const [dataNascimento, setDataNascimento] = useState('');
  const [matricula, setMatricula] = useState('');
  const [telefone, setTelefone] = useState('');
  const [emailAluno, setEmailAluno] = useState('');
  const [emailFamilia, setEmailFamilia] = useState('');
  const [donoEmailFamilia, setDonoEmailFamilia] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    fetch('/api/turmas')
      .then((r) => r.json())
      .then((resultado) => { if (resultado.ok) setTurmas(resultado.turmas); });
  }, []);

  useEffect(() => {
    setNome('');
    setNomes([]);
    setEhPrimeiroAcesso(null);
    if (tipo === 'professor') {
      fetch('/api/nomes?tipo=professor')
        .then((r) => r.json())
        .then((resultado) => { if (resultado.ok) setNomes(resultado.nomes); });
    } else if (tipo === 'aluno' && turmaId) {
      fetch(`/api/nomes?tipo=aluno&turmaId=${turmaId}`)
        .then((r) => r.json())
        .then((resultado) => { if (resultado.ok) setNomes(resultado.nomes); });
    }
  }, [tipo, turmaId]);

  // Assim que o aluno escolhe o nome, confere se ele já tem conta ou não
  useEffect(() => {
    async function conferir() {
      setEhPrimeiroAcesso(null);
      setErro('');
      if (tipo !== 'aluno' || !turmaId || !nome) return;

      setVerificandoCadastro(true);
      const resposta = await fetch(`/api/verificar-cadastro-aluno?turmaId=${turmaId}&nome=${encodeURIComponent(nome)}`);
      const dados = await resposta.json();
      setVerificandoCadastro(false);

      if (!dados.ok) { setErro(dados.erro); return; }

      setEhPrimeiroAcesso(!dados.temLogin);
      if (!dados.temLogin) {
        setMatricula(dados.dadosAtuais.matricula);
        setTelefone(dados.dadosAtuais.telefone);
        setEmailAluno(dados.dadosAtuais.emailAluno);
        setEmailFamilia(dados.dadosAtuais.emailFamilia);
        setDonoEmailFamilia(dados.dadosAtuais.donoEmailFamilia);
        setObservacao(dados.dadosAtuais.observacao);
      }
    }
    conferir();
  }, [nome, turmaId, tipo]);

  async function entrarComSenha() {
    setErro('');
    if (tipo === 'aluno' && !turmaId) { setErro('Selecione sua turma.'); return; }
    if (!nome) { setErro('Selecione seu nome.'); return; }
    if (!senha) { setErro('Digite sua senha.'); return; }

    setCarregando(true);
    try {
      const resposta = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, turmaId, nome, senha })
      });
      const resultado = await resposta.json();

      if (!resultado.ok) { setErro(resultado.erro || 'Não foi possível entrar.'); setCarregando(false); return; }

      await supabase.auth.setSession({ access_token: resultado.access_token, refresh_token: resultado.refresh_token });
      router.push('/dashboard');
    } catch (e) {
      setErro('Erro inesperado: ' + e.message);
      setCarregando(false);
    }
  }

  async function criarPrimeiroAcesso() {
    setErro('');
    if (!dataNascimento) { setErro('A data de nascimento é obrigatória.'); return; }

    setCarregando(true);
    try {
      const resposta = await fetch('/api/criar-login-aluno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turmaId, nome, dataNascimento, matricula, telefone,
          emailAluno, emailFamilia, donoEmailFamilia, observacao
        })
      });
      const resultado = await resposta.json();

      if (!resultado.ok) { setErro(resultado.erro || 'Não foi possível criar sua conta.'); setCarregando(false); return; }

      await supabase.auth.setSession({ access_token: resultado.access_token, refresh_token: resultado.refresh_token });
      router.push('/dashboard');
    } catch (e) {
      setErro('Erro inesperado: ' + e.message);
      setCarregando(false);
    }
  }

  const estiloCampo = { width: '100%', padding: 12, marginBottom: 6, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box' };
  const estiloDica = { fontSize: 11, color: '#999', marginBottom: 14, marginTop: 0 };
  const estiloBotao = { width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' };
  const estiloRotulo = { display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 6, color: '#333' };

  return (
    <main style={{ maxWidth: 380, margin: '40px auto', padding: 24 }}>
      <h1 style={{ textAlign: 'center', fontSize: 22, marginBottom: 24 }}>Suporte de Turma</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button
          onClick={() => setTipo('aluno')}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: tipo === 'aluno' ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: tipo === 'aluno' ? '#F4F2FF' : 'white', cursor: 'pointer', fontWeight: 'bold' }}>
          Sou aluno(a)
        </button>
        <button
          onClick={() => setTipo('professor')}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: tipo === 'professor' ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: tipo === 'professor' ? '#F4F2FF' : 'white', cursor: 'pointer', fontWeight: 'bold' }}>
          Sou professor(a)
        </button>
      </div>

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      {tipo === 'aluno' && (
        <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={{ ...estiloCampo, marginBottom: 16 }}>
          <option value="">Selecione sua turma...</option>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      )}

      <select value={nome} onChange={(e) => setNome(e.target.value)} style={{ ...estiloCampo, marginBottom: 16 }} disabled={tipo === 'aluno' && !turmaId}>
        <option value="">
          {tipo === 'professor' ? 'Selecione seu nome...' : (turmaId ? 'Selecione seu nome...' : 'Escolha a turma primeiro...')}
        </option>
        {nomes.map((n) => <option key={n.id} value={n.nome}>{n.nome}</option>)}
      </select>

      {verificandoCadastro && <p style={{ textAlign: 'center', color: '#888', fontSize: 13 }}>Verificando...</p>}

      {/* ACESSO NORMAL — já tem conta, só pede a senha */}
      {!verificandoCadastro && (tipo === 'professor' || ehPrimeiroAcesso === false) && nome && (
        <>
          <label style={estiloRotulo}>Senha</label>
          <input
            type="password"
            placeholder="••••••••••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            maxLength={16}
            inputMode="numeric"
            style={estiloCampo}
            onKeyDown={(e) => { if (e.key === 'Enter') entrarComSenha(); }}
          />
          <p style={estiloDica}>Sua senha é a sua data de nascimento (DDMMAAAA) digitada duas vezes seguidas.</p>
          <button onClick={entrarComSenha} disabled={carregando} style={estiloBotao}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </>
      )}

      {/* PRIMEIRO ACESSO — cria a conta na hora */}
      {!verificandoCadastro && ehPrimeiroAcesso === true && (
        <div>
          <div style={{ background: '#F4F2FF', color: '#4E3FC7', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12.5, lineHeight: 1.5 }}>
            👋 Esse é o seu primeiro acesso! Preencha os dados abaixo pra criar sua conta.
          </div>

          <label style={estiloRotulo}>Data de nascimento <span style={{ color: '#C93B26' }}>*obrigatório</span></label>
          <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} style={estiloCampo} />
          <p style={estiloDica}>Isso vai virar sua senha de acesso (não esqueça essa data!).</p>

          <label style={estiloRotulo}>Matrícula <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <input type="text" value={matricula} onChange={(e) => setMatricula(e.target.value)} style={estiloCampo} placeholder="Deixe em branco pra responder depois" />

          <label style={estiloRotulo}>Telefone <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <input type="text" value={telefone} onChange={(e) => setTelefone(e.target.value)} style={estiloCampo} placeholder="Deixe em branco pra responder depois" />

          <label style={estiloRotulo}>Seu e-mail <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <input type="email" value={emailAluno} onChange={(e) => setEmailAluno(e.target.value)} style={estiloCampo} placeholder="Deixe em branco pra responder depois" />

          <label style={estiloRotulo}>E-mail da família <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <input type="email" value={emailFamilia} onChange={(e) => setEmailFamilia(e.target.value)} style={estiloCampo} placeholder="Deixe em branco pra responder depois" />

          <label style={estiloRotulo}>De quem é esse e-mail de família? <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <input type="text" value={donoEmailFamilia} onChange={(e) => setDonoEmailFamilia(e.target.value)} style={estiloCampo} placeholder="Ex.: mãe, pai, avó..." />

          <label style={estiloRotulo}>Observação <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} style={{ ...estiloCampo, minHeight: 60 }} />

          <button onClick={criarPrimeiroAcesso} disabled={carregando} style={{ ...estiloBotao, marginTop: 8 }}>
            {carregando ? 'Criando sua conta...' : 'Criar meu acesso'}
          </button>
        </div>
      )}
    </main>
  );
}
