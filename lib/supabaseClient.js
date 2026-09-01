// lib/supabaseClient.js
// Esse cliente roda no NAVEGADOR (diferente do supabaseAdmin.js, que só
// roda no servidor). Usa a chave "publishable" (segura de expor),
// nunca a chave secreta.
'use client';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
