// lib/verificarAdmin.js
// Função compartilhada: confere se o token pertence a um professor
// marcado como administrador. Usada por todas as rotas de /api/admin.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function verificarAdmin(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return { ok: false, erro: 'Sessão não encontrada.', status: 401 };

  const supabaseComoUsuario = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: erroUsuario } = await supabaseComoUsuario.auth.getUser();
  if (erroUsuario || !user) return { ok: false, erro: 'Sessão inválida.', status: 401 };

  const { data: professor } = await supabaseAdmin
    .from('professores')
    .select('id, is_admin')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!professor || !professor.is_admin) {
    return { ok: false, erro: 'Você não tem permissão de administrador.', status: 403 };
  }

  return { ok: true, professorId: professor.id };
}
