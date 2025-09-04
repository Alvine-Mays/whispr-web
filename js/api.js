// Wrapper fetch pour l’API Whispr (wishpr-api)
// Gère JSON, erreurs et Authorization Bearer pour le dashboard.

import { API_ORIGIN } from './config.js';

const jsonHeaders = { 'Content-Type': 'application/json' };

function toQS(params) {
  const entries = Object.entries(params || {}).filter(([_, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

function buildUrl(path, params) {
  if (!API_ORIGIN) return `${path}${toQS(params)}`; // proxy local
  const url = new URL(path.startsWith('http') ? path : API_ORIGIN + path);
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, v); });
  return url.toString();
}

export async function apiFetch(path, { method = 'GET', body, token, params, headers = {} } = {}) {
  const url = buildUrl(path, params);
  const finalHeaders = { ...jsonHeaders, ...headers };
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });
    
    // Gérer les erreurs de réponse de manière plus précise
    if (!res.ok) {
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await res.json().catch(() => ({})) : await res.text();
      const errorMsg = isJson ? data?.error || data?.message || `Erreur API: ${res.status}` : `Erreur API: ${res.status}`;
      return { ok: false, status: res.status, error: errorMsg, data };
    }

    // Gérer les réponses réussies
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : await res.text();
    return { ok: true, status: res.status, data };

  } catch (err) {
    // Gérer les erreurs de réseau
    console.error('Network or CORS error:', err);
    return { ok: false, status: 0, error: err?.message || 'Réseau indisponible ou erreur CORS' };
  }
}

export const Api = {
  // Onboarding NGL-like: créer un utilisateur et recevoir le token dashboard
  createUser: ({ username, bio = '', theme = 'system' }) => apiFetch('/api/users', { method: 'POST', body: { username, bio, theme } }),

  // Profil public
  getPublicProfile: (username) => apiFetch(`/api/users/${encodeURIComponent(username)}/public`),

  // Envoi de message anonyme
  sendMessage: (username, payload) => apiFetch(`/api/messages/${encodeURIComponent(username)}`, { method: 'POST', body: payload }),

  // Dashboard: liste/MAJ/suppression
  listMessages: (token, { status = 'all', page, limit } = {}) => {
    // Mapping NGL-like → booléens backend
    const params = {};
    if (status === 'unread') params.isRead = 'false';
    if (status === 'archived') params.isArchived = 'true';
    if (status === 'favorite') params.isFavorite = 'true';
    if (page) params.page = String(page);
    if (limit) params.limit = String(limit);
    return apiFetch('/api/dashboard/messages', { token, params });
  },
  updateMessage: (token, id, patch) => {
    // Patch attendu: { isRead?, isArchived?, isFavorite? }
    return apiFetch(`/api/dashboard/messages/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: patch });
  },
  deleteMessage: (token, id) => apiFetch(`/api/dashboard/messages/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  // Stats
  getStats: (token, range = '7d') => apiFetch('/api/dashboard/stats', { token, params: { range } }),

  // Web Push (si clé VAPID fournie côté client)
  subscribePush: (token, subscription) => apiFetch('/api/push/subscribe', { method: 'POST', token, body: subscription }),
  unsubscribePush: (token, endpoint) => apiFetch('/api/push/unsubscribe', { method: 'POST', token, body: { endpoint } }),
};