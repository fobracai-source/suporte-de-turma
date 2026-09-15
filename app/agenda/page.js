'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const ESTILO_POR_TIPO = {
  prova: { emoji: '📝', cor: '#FF5C5C', rotulo: 'Prova' },
  trabalho: { emoji: '📄', cor: '#F2994A', rotulo: 'Trabalho' },
  evento: { emoji: '🎉', cor: '#6C5CE7', rotulo: 'Evento' },
  entrega: { emoji: '⏰', cor: '#2ECC71', rotulo: 'Prazo de atividade' }
};

export default function PaginaAgenda() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [agenda, setAgenda] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const resposta = await fetch('/api/agenda/listar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const dados = await resposta.json();
      if (!dados.ok) { setErro(dados.erro); setCarregando(false); return; }
      setAgenda(dados.agenda);
      setCarregando(false);
    }
    carregar();
  }, [router]);

  const hoje = new Date().toISOString().slice(0, 10);
  const proximos = agenda.filter((e) => e.data >= hoje);
  const passados = agenda.filter((e) => e.data < hoje);

  if (carregando) return <main style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>Carregando...</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>📅 Agenda</h1>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #ddd', background: 'white', cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
      </div>

      {erro && <div style={{ background: '#FFEDEA', color: '#C93B26', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13.5 }}>⚠️ {erro}</div>}

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Próximos</h2>
      {proximos.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>Nada marcado por enquanto.</p>}
      {proximos.map((e) => {
        const estilo = ESTILO_POR_TIPO[e.tipo] || ESTILO_POR_TIPO.evento;
        return (
          <div key={e.id} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, border: `1.5px solid ${estilo.cor}33`, background: `${estilo.cor}0D`, marginBottom: 8 }}>
            <div style={{ fontSize: 22 }}>{estilo.emoji}</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 'bold', color: estilo.cor }}>{estilo.rotulo}{e.disciplina ? ` — ${e.disciplina}` : ''}</p>
              <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 'bold' }}>{e.titulo}</p>
              {e.descricao && <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#666' }}>{e.descricao}</p>}
              <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#888' }}>{new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
            </div>
          </div>
        );
      })}

      {passados.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, margin: '24px 0 10px 0', color: '#aaa' }}>Passados</h2>
          {passados.slice(-10).reverse().map((e) => {
            const estilo = ESTILO_POR_TIPO[e.tipo] || ESTILO_POR_TIPO.evento;
            return (
              <div key={e.id} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 10, border: '1.5px solid #eee', marginBottom: 6, opacity: 0.6 }}>
                <div style={{ fontSize: 18 }}>{estilo.emoji}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13 }}>{e.titulo}</p>
                  <p style={{ margin: 0, fontSize: 10.5, color: '#aaa' }}>{new Date(e.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            );
          })}
        </>
      )}
    </main>
  );
}
