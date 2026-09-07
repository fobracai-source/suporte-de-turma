'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function PaginaDashboard() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [perfil, setPerfil] = useState(null); // { tipo: 'aluno'|'professor', nome, turmaNome }
  const [atividades, setAtividades] = useState([]);
  const [erro, setErro] = useState('');
  const [camposPendentes, setCamposPendentes] = useState([]);
  const [mostrarFormPendente, setMostrarFormPendente] = useState(false);
  const [valoresPendentes, setValoresPendentes] = useState({});
  const [salvandoPendente, setSalvandoPendente] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // Descobre se quem está logado é aluno ou professor, e pega o nome
      const { data: aluno } = await supabase
        .from('alunos')
        .select('nome, turmas(nome), matricula, telefone, email_aluno, email_familia, dono_email_familia')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      if (aluno) {
        setPerfil({ tipo: 'aluno', nome: aluno.nome, turmaNome: aluno.turmas?.nome });

        const camposParaChecar = { matricula: aluno.matricula, telefone: aluno.telefone, emailAluno: aluno.email_aluno, emailFamilia: aluno.email_familia, donoEmailFamilia: aluno.dono_email_familia };
        const pendentes = Object.entries(camposParaChecar).filter(([, v]) => !v || v === 'Depois informo').map(([k]) => k);
        setCamposPendentes(pendentes);

        const { data: minhasAtividades, error: erroAtividades } = await supabase
          .from('atividades_publicas')
          .select('id, disciplina, aula_numero, tema, data_final, valor_nota')
          .order('data_final');

        if (erroAtividades) setErro(erroAtividades.message);
        else setAtividades(minhasAtividades || []);
      } else {
        const { data: professor } = await supabase
          .from('professores')
          .select('nome, is_admin')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();

        if (professor) {
          setPerfil({ tipo: 'professor', nome: professor.nome, isAdmin: professor.is_admin });

          const { data: minhasAtividades, error: erroAtividades } = await supabase
            .from('atividades')
            .select('id, disciplina, aula_numero, tema, data_final, valor_nota')
            .order('data_final');

          if (erroAtividades) setErro(erroAtividades.message);
          else setAtividades(minhasAtividades || []);
        }
      }

      setCarregando(false);
    }
    carregar();
  }, [router]);

  async function sair() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function salvarPendentes() {
    setSalvandoPendente(true);
    const { data: { session } } = await supabase.auth.getSession();
    const resposta = await fetch('/api/completar-cadastro-aluno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(valoresPendentes)
    });
    const dados = await resposta.json();
    setSalvandoPendente(false);
    if (dados.ok) window.location.reload();
  }

  const rotulosCampos = { matricula: 'Matrícula', telefone: 'Telefone', emailAluno: 'Seu e-mail', emailFamilia: 'E-mail da família', donoEmailFamilia: 'De quem é o e-mail de família' };

  if (carregando) {
    return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;
  }

  if (!perfil) {
    return (
      <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <p>Não consegui identificar seu cadastro.</p>
        <button onClick={sair}>Voltar ao login</button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Bem-vindo(a),</p>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 'bold' }}>{perfil.nome}</p>
          {perfil.turmaNome && <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Turma {perfil.turmaNome}</p>}
        </div>
        <button onClick={sair} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer' }}>Sair</button>
      </div>

      {perfil.tipo === 'aluno' && camposPendentes.length > 0 && (
        <div style={{ background: '#FFF8E1', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          {!mostrarFormPendente ? (
            <>
              <p style={{ margin: 0, fontSize: 13, color: '#8A6D1E' }}>
                📋 Ainda falta completar {camposPendentes.length} informação(ões) do seu cadastro.
              </p>
              <button onClick={() => setMostrarFormPendente(true)} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#F2C94C', color: '#8A6D1E', fontWeight: 'bold', fontSize: 12, cursor: 'pointer' }}>
                Completar agora
              </button>
            </>
          ) : (
            <>
              {camposPendentes.map((campo) => (
                <div key={campo} style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#8A6D1E', marginBottom: 4 }}>{rotulosCampos[campo]}</label>
                  <input
                    type="text"
                    placeholder="Deixe em branco pra responder depois"
                    onChange={(e) => setValoresPendentes((atual) => ({ ...atual, [campo]: e.target.value }))}
                    style={{ width: '100%', padding: 9, borderRadius: 6, border: '1.5px solid #E8D9A0', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button onClick={salvarPendentes} disabled={salvandoPendente} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#F2C94C', color: '#8A6D1E', fontWeight: 'bold', fontSize: 12.5, cursor: 'pointer', marginRight: 8 }}>
                {salvandoPendente ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setMostrarFormPendente(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1.5px solid #E8D9A0', background: 'transparent', color: '#8A6D1E', fontSize: 12.5, cursor: 'pointer' }}>
                Depois
              </button>
            </>
          )}
        </div>
      )}

      {perfil.tipo === 'professor' && perfil.isAdmin && (
        <button
          onClick={() => router.push('/admin')}
          style={{ width: '100%', padding: 14, marginBottom: 12, borderRadius: 8, border: 'none', background: '#2D3436', color: 'white', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
          ⚙️ Administração (turmas, professores, alunos)
        </button>
      )}

      {perfil.tipo === 'professor' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button
            onClick={() => router.push('/professor/criar-atividade')}
            style={{ flex: 1, padding: 14, borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
            ➕ Cadastrar atividade
          </button>
          <button
            onClick={() => router.push('/professor/ver-entregas')}
            style={{ flex: 1, padding: 14, borderRadius: 8, border: '1.5px solid #6C5CE7', background: 'white', color: '#6C5CE7', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
            📋 Ver entregas
          </button>
        </div>
      )}

      {perfil.tipo === 'professor' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => router.push('/professor/registrar-ocorrencia')}
            style={{ flex: 1, padding: 14, borderRadius: 8, border: '1.5px solid #FF7A59', background: 'white', color: '#FF7A59', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
            🚨 Registrar ocorrência
          </button>
          <button
            onClick={() => router.push('/professor/ver-ocorrencias')}
            style={{ flex: 1, padding: 14, borderRadius: 8, border: '1.5px solid #FF7A59', background: 'white', color: '#FF7A59', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
            📋 Ver ocorrências
          </button>
        </div>
      )}

      {perfil.tipo === 'aluno' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            onClick={() => router.push('/minhas-notas')}
            style={{ flex: 1, padding: 14, borderRadius: 8, border: '1.5px solid #6C5CE7', background: 'white', color: '#6C5CE7', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
            📊 Minhas notas
          </button>
          <button
            onClick={() => router.push('/minhas-ocorrencias')}
            style={{ flex: 1, padding: 14, borderRadius: 8, border: '1.5px solid #FF7A59', background: 'white', color: '#FF7A59', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
            🚨 Minhas ocorrências
          </button>
        </div>
      )}

      {perfil.tipo === 'aluno' && (
        <button
          onClick={() => router.push('/denunciar-colega')}
          style={{ width: '100%', padding: 14, marginBottom: 20, borderRadius: 8, border: '1.5px solid #7B68EE', background: 'white', color: '#7B68EE', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
          🙊 Meu colega atrapalha!
        </button>
      )}

      {erro && (
        <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>
          ⚠️ {erro}
        </div>
      )}

      <h2 style={{ fontSize: 16 }}>Atividades</h2>
      {atividades.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Nenhuma atividade encontrada ainda.</p>}
      {atividades.map((a) => (
        <div key={a.id} style={{ padding: 14, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 10 }}>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: 14 }}>{a.disciplina} — Aula {a.aula_numero}</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 13.5 }}>{a.tema}</p>
          <p style={{ margin: '4px 0 8px 0', fontSize: 12, color: '#888' }}>Vale {a.valor_nota} ponto(s)</p>
          {perfil.tipo === 'aluno' && (
            <button
              onClick={() => router.push('/atividades/' + a.id)}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6C5CE7', color: 'white', fontWeight: 'bold', fontSize: 13, cursor: 'pointer' }}>
              Responder
            </button>
          )}
        </div>
      ))}
    </main>
  );
}
