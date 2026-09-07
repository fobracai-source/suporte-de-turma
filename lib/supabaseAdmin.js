// lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export function normalizarNome(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s@.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula a senha a partir de uma data no formato AAAA-MM-DD (o
 * formato que vem de um <input type="date">, e também o formato salvo
 * no banco): junta como DDMMAAAA e repete duas vezes.
 * Ex.: nasceu em 25/01/1984 → "25011984" → senha final "2501198425011984"
 */
export function calcularSenhaDaData(dataISO) {
  if (!dataISO) return null;
  const partes = String(dataISO).split('-');
  if (partes.length !== 3) return null;
  const [ano, mes, dia] = partes;
  const ddmmaaaa = dia + mes + ano;
  return ddmmaaaa + ddmmaaaa;
}

export const MENSAGEM_PENDENTE = 'Depois informo';
