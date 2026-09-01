// lib/supabaseAdmin.js
// Cliente do Supabase com permissão de administrador — só usado no
// SERVIDOR (nunca no navegador), porque a "service role key" dá acesso
// total ao banco, ignorando toda regra de segurança (RLS).
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Deixa um nome "limpo" pra comparar: sem acento, sem maiúscula, sem
 * pontuação, sem espaço duplicado. Assim "Fabrício da Silva França",
 * "fabricio DA SILVA franca" e "FABRICIO-DA-SILVA-FRANCA" são todos
 * tratados como o mesmo nome.
 */
export function normalizarNome(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove os acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s@.]/g, '')   // remove pontuação (mantém @ e . por causa de e-mail)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formata uma data (formato AAAA-MM-DD, como vem do banco) pro formato
 * DD/MM/AAAA que é usado como senha.
 */
export function dataParaSenha(dataISO) {
  if (!dataISO) return null;
  var partes = String(dataISO).split('-');
  if (partes.length !== 3) return null;
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}
