import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.LINKORA_CONFIG || {};
export const isConfigured = !!(cfg.supabaseUrl && cfg.supabaseKey && !cfg.supabaseUrl.includes('YOUR-PROJECT') && !cfg.supabaseKey.includes('YOUR_SUPABASE'));
export const supabase = isConfigured ? createClient(cfg.supabaseUrl, cfg.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const initials = (s = 'L') => String(s).trim().split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase() || 'L';
export function toast(message, type = 'info') {
  let host = $('#toastHost');
  if (!host) { host = document.createElement('div'); host.id = 'toastHost'; host.className = 'toast-host'; document.body.append(host); }
  const el = document.createElement('div'); el.className = `toast toast-${type}`; el.textContent = message; host.append(el);
  requestAnimationFrame(() => el.classList.add('show')); setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 4200);
}
export function showConfigWarning() {
  if (isConfigured) return;
  const note = $('#configNotice');
  if (note) note.hidden = false;
}
export async function requireUser(redirect = 'auth.html') {
  if (!isConfigured) { showConfigWarning(); throw new Error('Please configure Supabase first.'); }
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.user) { window.location.href = redirect; throw new Error('Sign in required.'); }
  return session.user;
}
export async function isAdmin(userId) {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error) throw error;
  return !!data;
}
export function cleanSlug(value) {
  return String(value || '').toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 28);
}
export function safeUrl(value) {
  const s = String(value || '').trim();
  if (/^(mailto:|tel:)/i.test(s)) return s;
  try { const u = new URL(s); if (['https:', 'http:'].includes(u.protocol)) return u.href; } catch {}
  return '';
}
export function formatDate(value) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('en', {year:'numeric',month:'short',day:'numeric'}).format(new Date(value)); } catch { return value; }
}
export function appUrl(file) { return new URL(file, window.location.href).href; }
export async function signOut() { if (supabase) await supabase.auth.signOut(); window.location.href = 'index.html'; }
