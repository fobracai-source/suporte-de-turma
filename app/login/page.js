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
  const [dataNascimento, setDataNascimento] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Carrega a lista de turmas assim que a página abre
  useEffect(() => {
    fetch('/api/turmas')
      .then((r) => r.json())
      .then((resultado) => { if (resultado.ok) setTurmas(resultado.turmas); });
  }, []);

  // Carrega a lista de nomes sempre que muda o tipo (aluno/professor)
  // ou a turma escolhida
  useEffect(() => {
    setNome('');
    setNomes([]);
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

  function aplicarMascaraData(valor) {
    var numeros = valor.replace(/\D/g, '').slice(0, 8);
    var formatado = numeros;
    if (numeros.length > 4) formatado = numeros.slice(0, 2) + '/' + numeros.slice(2, 4) + '/' + numeros.slice(4);
    else if (numeros.length > 2) formatado = numeros.slice(0, 2) + '/' + numeros.slice(2);
    setDataNascimento(formatado);
  }

  async function entrar() {
    setErro('');
    if (tipo === 'aluno' && !turmaId) { setErro('Selecione sua turma.'); return; }
    if (!nome) { setErro('Selecione seu nome.'); return; }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataNascimento)) { setErro('Digite a data de nascimento no formato DD/MM/AAAA.'); return; }

    setCarregando(true);
    try {
      const resposta = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, turmaId, nome, dataNascimento })
      });
      const resultado = await resposta.json();

      if (!resultado.ok) {
        setErro(resultado.erro || 'Não foi possível entrar.');
        setCarregando(false);
        return;
      }

      // Registra a sessão no navegador, usando os tokens que a rota
      // de login devolveu
      await supabase.auth.setSession({
        access_token: resultado.access_token,
        refresh_token: resultado.refresh_token
      });

      router.push('/dashboard');
    } catch (e) {
      setErro('Erro inesperado: ' + e.message);
      setCarregando(false);
    }
  }

  const estiloCampo = { width: '100%', padding: 12, marginBottom: 14, borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box' };
  const estiloBotao = { width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' };

  return (
    <main style={{ maxWidth: 380, margin: '60px auto', padding: 24 }}>
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
        <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} style={estiloCampo}>
          <option value="">Selecione sua turma...</option>
          {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      )}

      <select value={nome} onChange={(e) => setNome(e.target.value)} style={estiloCampo} disabled={tipo === 'aluno' && !turmaId}>
        <option value="">
          {tipo === 'professor' ? 'Selecione seu nome...' : (turmaId ? 'Selecione seu nome...' : 'Escolha a turma primeiro...')}
        </option>
        {nomes.map((n) => <option key={n.id} value={n.nome}>{n.nome}</option>)}
      </select>

      <input
        type="text"
        placeholder="Data de nascimento — DD/MM/AAAA"
        value={dataNascimento}
        onChange={(e) => aplicarMascaraData(e.target.value)}
        maxLength={10}
        inputMode="numeric"
        style={estiloCampo}
      />

      <button onClick={entrar} disabled={carregando} style={estiloBotao}>
        {carregando ? 'Entrando...' : 'Entrar'}
      </button>
    </main>
  );
}
