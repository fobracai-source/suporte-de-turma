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
  const [diasPorTurma, setDiasPorTurma] = useState({}); // { turmaId: { ocorrencia: [...], atividade: [...] } }

  // E-mail (remetentes)
  const [statusRemetentes, setStatusRemetentes] = useState(null);
  const [camposRemetentes, setCamposRemetentes] = useState({ remetente1Email: '', remetente1Senha: '', remetente2Email: '', remetente2Senha: '', remetente3Email: '', remetente3Senha: '' });

  // Professor
  const [nomeProfessor, setNomeProfessor] = useState('');
  const [emailProfessor, setEmailProfessor] = useState('');
  const [dataNascProfessor, setDataNascProfessor] = useState('');
  const [disciplinasTexto, setDisciplinasTexto] = useState('');
  const [turmasDoProfessor, setTurmasDoProfessor] = useState([]);

  // Aluno
  const [nomeAluno, setNomeAluno] = useState('');
  const [turmaDoAluno, setTurmaDoAluno] = useState('');

  // Importação em lote
  const [arquivoImportacao, setArquivoImportacao] = useState(null);
  const [nomeArquivoImportacao, setNomeArquivoImportacao] = useState('');
  const [resultadoImportacao, setResultadoImportacao] = useState(null);

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
        const { data: t } = await supabase.from('turmas').select('id, nome, dias_envio_ocorrencia, dias_envio_atividade').order('nome');
        setTurmas(t || []);

        const mapaDias = {};
        (t || []).forEach((turma) => {
          mapaDias[turma.id] = { ocorrencia: turma.dias_envio_ocorrencia || [], atividade: turma.dias_envio_atividade || [] };
        });
        setDiasPorTurma(mapaDias);

        const respostaStatus = await fetch('/api/admin/status-remetentes', { headers: { Authorization: `Bearer ${session.access_token}` } });
        const dadosStatus = await respostaStatus.json();
        if (dadosStatus.ok) setStatusRemetentes(dadosStatus);
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

  const DIAS_SEMANA = [
    { valor: 'domingo', rotulo: 'Dom' }, { valor: 'segunda', rotulo: 'Seg' }, { valor: 'terca', rotulo: 'Ter' },
    { valor: 'quarta', rotulo: 'Qua' }, { valor: 'quinta', rotulo: 'Qui' }, { valor: 'sexta', rotulo: 'Sex' }, { valor: 'sabado', rotulo: 'Sáb' }
  ];

  function alternarDiaTurma(turmaId, tipo, dia) {
    setDiasPorTurma((atual) => {
      const atualDaTurma = atual[turmaId] || { ocorrencia: [], atividade: [] };
      const listaAtual = atualDaTurma[tipo] || [];
      const novaLista = listaAtual.includes(dia) ? listaAtual.filter((d) => d !== dia) : [...listaAtual, dia];
      return { ...atual, [turmaId]: { ...atualDaTurma, [tipo]: novaLista } };
    });
  }

  async function salvarDiasTurma(turmaId) {
    const dias = diasPorTurma[turmaId] || { ocorrencia: [], atividade: [] };
    const dados = await chamarApi('/api/admin/atualizar-dias-turma', {
      turmaId, diasOcorrencia: dias.ocorrencia, diasAtividade: dias.atividade
    });
    if (dados) setSucesso('Dias de envio atualizados!');
  }

  async function salvarRemetentes() {
    const dados = await chamarApi('/api/admin/configurar-remetentes', camposRemetentes);
    if (dados) {
      setSucesso('Remetentes salvos!');
      setCamposRemetentes({ remetente1Email: '', remetente1Senha: '', remetente2Email: '', remetente2Senha: '', remetente3Email: '', remetente3Senha: '' });
      const respostaStatus = await fetch('/api/admin/status-remetentes', { headers: { Authorization: `Bearer ${accessToken}` } });
      const dadosStatus = await respostaStatus.json();
      if (dadosStatus.ok) setStatusRemetentes(dadosStatus);
    }
  }

  async function criarTurma() {
    const dados = await chamarApi('/api/admin/criar-turma', { nome: nomeTurma });
    if (dados) {
      setSucesso(`Turma "${dados.turma.nome}" criada!`);
      setTurmas((atual) => [...atual, dados.turma].sort((a, b) => a.nome.localeCompare(b.nome)));
      setDiasPorTurma((atual) => ({ ...atual, [dados.turma.id]: { ocorrencia: [], atividade: [] } }));
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

  function arquivoEscolhido(inputEl) {
    const arquivo = inputEl.files[0];
    if (!arquivo) return;
    setNomeArquivoImportacao(arquivo.name);
    setResultadoImportacao(null);
    const leitor = new FileReader();
    leitor.onload = (evento) => setArquivoImportacao(evento.target.result.split(',')[1]);
    leitor.readAsDataURL(arquivo);
  }

  async function importarPlanilha() {
    if (!arquivoImportacao) { setErro('Escolha o arquivo da planilha primeiro.'); return; }
    setErro(''); setSucesso(''); setResultadoImportacao(null); setEnviando(true);
    try {
      const resposta = await fetch('/api/admin/importar-alunos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ arquivoBase64: arquivoImportacao })
      });
      const dados = await resposta.json();
      setEnviando(false);
      if (!dados.ok) { setErro(dados.erro); return; }
      setResultadoImportacao(dados);
      const { data: t } = await supabase.from('turmas').select('id, nome').order('nome');
      setTurmas(t || []);
    } catch (e) {
      setEnviando(false);
      setErro('Erro inesperado: ' + e.message);
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
        <button onClick={() => { setAba('importar'); setErro(''); setSucesso(''); }} style={estiloAba(aba === 'importar')}>Importar</button>
        <button onClick={() => { setAba('email'); setErro(''); setSucesso(''); }} style={estiloAba(aba === 'email')}>E-mail</button>
      </div>

      {erro && <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>⚠️ {erro}</div>}
      {sucesso && <div style={{ background: '#E8F9EE', color: '#1E8449', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>✅ {sucesso}</div>}

      {aba === 'turma' && (
        <div>
          <label style={estiloRotulo}>Nome da turma</label>
          <input type="text" value={nomeTurma} onChange={(e) => setNomeTurma(e.target.value)} style={estiloCampo} placeholder="Ex.: 81, 103A..." />
          <button onClick={criarTurma} disabled={enviando} style={estiloBotao}>{enviando ? 'Criando...' : 'Criar turma'}</button>

          <h3 style={{ fontSize: 15, marginTop: 28, marginBottom: 12 }}>Dias de envio dos e-mails consolidados</h3>
          {turmas.map((t) => {
            const dias = diasPorTurma[t.id] || { ocorrencia: [], atividade: [] };
            return (
              <div key={t.id} style={{ border: '1.5px solid #eee', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: 14 }}>Turma {t.nome}</p>

                <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#888' }}>📋 E-mail de ocorrências</p>
                <div style={{ marginBottom: 12 }}>
                  {DIAS_SEMANA.map((d) => (
                    <label key={d.valor} style={{ display: 'inline-block', marginRight: 6, marginBottom: 6, padding: '5px 10px', borderRadius: 14, border: dias.ocorrencia.includes(d.valor) ? '2px solid #FF7A59' : '1.5px solid #ddd', background: dias.ocorrencia.includes(d.valor) ? '#FFF0EA' : 'white', cursor: 'pointer', fontSize: 11.5, fontWeight: 'bold' }}>
                      <input type="checkbox" checked={dias.ocorrencia.includes(d.valor)} onChange={() => alternarDiaTurma(t.id, 'ocorrencia', d.valor)} style={{ display: 'none' }} />
                      {d.rotulo}
                    </label>
                  ))}
                </div>

                <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#888' }}>📊 E-mail de atividades</p>
                <div style={{ marginBottom: 12 }}>
                  {DIAS_SEMANA.map((d) => (
                    <label key={d.valor} style={{ display: 'inline-block', marginRight: 6, marginBottom: 6, padding: '5px 10px', borderRadius: 14, border: dias.atividade.includes(d.valor) ? '2px solid #6C5CE7' : '1.5px solid #ddd', background: dias.atividade.includes(d.valor) ? '#F4F2FF' : 'white', cursor: 'pointer', fontSize: 11.5, fontWeight: 'bold' }}>
                      <input type="checkbox" checked={dias.atividade.includes(d.valor)} onChange={() => alternarDiaTurma(t.id, 'atividade', d.valor)} style={{ display: 'none' }} />
                      {d.rotulo}
                    </label>
                  ))}
                </div>

                <button onClick={() => salvarDiasTurma(t.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2D3436', color: 'white', fontWeight: 'bold', fontSize: 11.5, cursor: 'pointer' }}>
                  Salvar dias dessa turma
                </button>
              </div>
            );
          })}
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

      {aba === 'importar' && (
        <div>
          <div style={{ background: '#F4F2FF', color: '#4E3FC7', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 12.5, lineHeight: 1.6 }}>
            📄 A planilha deve ter as colunas: <b>NOME DO ALUNO, TURMA, EMAIL_MAIS_RECENTE, EMAIL_ANTERIOR, MATRICULA, TELEFONE_CONTATO, DATA_NASCIMENTO, EMAIL_FAMILIA, DONO_EMAIL_FAMILIA, OBSERVACAO</b> (nessa ordem).
            <br /><br />
            O nome só é alterado por aqui (nunca pelo próprio aluno). Os demais campos: se vierem preenchidos na planilha, substituem o que já está salvo; se vierem em branco, o que já existe é mantido.
          </div>

          <input type="file" id="inputImportacao" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => arquivoEscolhido(e.target)} />
          <div onClick={() => document.getElementById('inputImportacao').click()} style={{ border: '2px dashed #ddd', borderRadius: 10, padding: 24, textAlign: 'center', cursor: 'pointer', marginBottom: 16 }}>
            <div style={{ fontSize: 32 }}>📤</div>
            <div style={{ fontWeight: 'bold', fontSize: 13, marginTop: 6 }}>{nomeArquivoImportacao || 'Toque para escolher a planilha'}</div>
          </div>

          <button onClick={importarPlanilha} disabled={enviando} style={estiloBotao}>{enviando ? 'Importando...' : 'Importar planilha'}</button>

          {resultadoImportacao && (
            <div style={{ marginTop: 18, background: '#F8F8F8', borderRadius: 10, padding: 16, fontSize: 13 }}>
              <p style={{ margin: '0 0 6px 0' }}>✅ <b>{resultadoImportacao.criados}</b> aluno(s) novo(s) criado(s)</p>
              <p style={{ margin: '0 0 6px 0' }}>🔄 <b>{resultadoImportacao.atualizados}</b> aluno(s) já existente(s) atualizado(s)</p>
              <p style={{ margin: '0 0 6px 0' }}>⏭️ <b>{resultadoImportacao.pulados}</b> linha(s) sem nome, ignorada(s)</p>
              {resultadoImportacao.turmasCriadas.length > 0 && (
                <p style={{ margin: '0 0 6px 0' }}>🏫 Turma(s) criada(s) automaticamente: {resultadoImportacao.turmasCriadas.join(', ')}</p>
              )}
              {resultadoImportacao.erros.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #ddd' }}>
                  <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: '#C93B26' }}>⚠️ Avisos:</p>
                  {resultadoImportacao.erros.map((e, i) => <p key={i} style={{ margin: '2px 0', fontSize: 12, color: '#C93B26' }}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {aba === 'email' && (
        <div>
          <div style={{ background: '#F4F2FF', color: '#4E3FC7', padding: 12, borderRadius: 8, marginBottom: 18, fontSize: 12.5, lineHeight: 1.6 }}>
            📧 Configure até 3 contas do Gmail como remetente. Se a 1ª falhar na hora de mandar (por exemplo, estourou o limite diário), o sistema tenta a 2ª, depois a 3ª — automaticamente.
            <br /><br />
            Cada uma precisa de uma <b>senha de app</b> do Google (não é a senha normal da conta — veja o LEIA-ME de como gerar).
          </div>

          {[1, 2, 3].map((n) => {
            const status = statusRemetentes ? statusRemetentes[`remetente${n}`] : null;
            return (
              <div key={n} style={{ border: '1.5px solid #eee', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: 13 }}>
                  Remetente {n} {status?.configurado ? <span style={{ color: '#2ECC71', fontSize: 11 }}>✓ configurado ({status.email})</span> : <span style={{ color: '#C93B26', fontSize: 11 }}>não configurado</span>}
                </p>
                <input
                  type="email" placeholder="E-mail do Gmail"
                  value={camposRemetentes[`remetente${n}Email`]}
                  onChange={(e) => setCamposRemetentes((atual) => ({ ...atual, [`remetente${n}Email`]: e.target.value }))}
                  style={{ ...estiloCampo, marginBottom: 8 }}
                />
                <input
                  type="password" placeholder="Senha de app (16 caracteres)"
                  value={camposRemetentes[`remetente${n}Senha`]}
                  onChange={(e) => setCamposRemetentes((atual) => ({ ...atual, [`remetente${n}Senha`]: e.target.value }))}
                  style={estiloCampo}
                />
              </div>
            );
          })}

          <p style={{ fontSize: 11.5, color: '#999', marginBottom: 14 }}>Deixe em branco o que não quiser alterar — só é atualizado o que você preencher.</p>

          <button onClick={salvarRemetentes} disabled={enviando} style={estiloBotao}>{enviando ? 'Salvando...' : 'Salvar remetentes'}</button>
        </div>
      )}
    </main>
  );
}
