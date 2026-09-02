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

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // Descobre se quem está logado é aluno ou professor, e pega o nome
      const { data: aluno } = await supabase
        .from('alunos')
        .select('nome, turmas(nome)')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

      if (aluno) {
        setPerfil({ tipo: 'aluno', nome: aluno.nome, turmaNome: aluno.turmas?.nome });

        const { data: minhasAtividades, error: erroAtividades } = await supabase
          .from('atividades_publicas')
          .select('id, disciplina, aula_numero, tema, data_final, valor_nota')
          .order('data_final');

        if (erroAtividades) setErro(erroAtividades.message);
        else setAtividades(minhasAtividades || []);
      } else {
        const { data: professor } = await supabase
          .from('professores')
          .select('nome')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();

        if (professor) {
          setPerfil({ tipo: 'professor', nome: professor.nome });

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
