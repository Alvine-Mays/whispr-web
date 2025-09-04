// Initialisation globale: thème, i18n, SW, install prompt, routing, polling avec backoff.

import { initTheme, setTheme } from './theme.js';
import { applyI18n, detectLocale, setLocale, t } from './i18n.js';
import { initNotify, notyf } from './notify.js';
import { Api } from './api.js';
import { shareMessageImage, generateMessageImage } from './share-image.js';
import { VAPID_PUBLIC_KEY } from './config.js';

const TOKEN_KEY = 'whispr_token';
const BACKOFFS = [3000, 5000, 8000, 13000, 21000, 34000];
let backoffIndex = 0; let lastSeenId = null; let pollingTimer = null;

const REACT_KEY = 'whispr_reactions';
function getReactions() { try { return JSON.parse(localStorage.getItem(REACT_KEY) || '{}'); } catch { return {}; } }
function saveReactions(r) { localStorage.setItem(REACT_KEY, JSON.stringify(r)); }

function confettiBurst(colors=['#be29ec','#ef5875']) {
  if (!window.confetti) return;
  window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 }, colors });
}
function confettiMini(colors=['#be29ec','#ef5875']) {
  if (!window.confetti) return;
  window.confetti({ particleCount: 30, spread: 50, ticks: 120, origin: { y: 0.8 }, colors });
}

function resetBackoff() { backoffIndex = 0; }
function nextBackoff() { backoffIndex = Math.min(backoffIndex + 1, BACKOFFS.length - 1); return BACKOFFS[backoffIndex]; }

export function getToken() {
  const url = new URL(location.href);
  const path = location.pathname;
  const qsToken = url.searchParams.get('token');
  if (qsToken) { localStorage.setItem(TOKEN_KEY, qsToken); return qsToken; }
  if (path.startsWith('/dashboard/')) {
    const seg = path.split('/').filter(Boolean)[1];
    if (seg) { localStorage.setItem(TOKEN_KEY, seg); return seg; }
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function getUsernameFromPath() {
  const path = location.pathname;
  if (path === '/' || path === '/index.html' || path === '/public-page.html' || path === '/dashboard.html' || path.startsWith('/dashboard')) return null;
  const seg = path.replace(/^\/+/, '').split('/')[0];
  return seg || null;
}

function qs(sel, root=document) { return root.querySelector(sel); }
function qsa(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/service-worker.js'); }
    catch(e) { console.warn('SW registre échec', e); }
  }
}

let deferredPrompt = null;
function setupInstallBanner() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; qs('.install-banner')?.classList.add('show'); });
  qs('#btn-install')?.addEventListener('click', async () => { if (!deferredPrompt) return; notyf?.open({ type: 'info', message: t('installing') }); deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; qs('.install-banner')?.classList.remove('show'); });
  qs('#btn-install-cancel')?.addEventListener('click', () => qs('.install-banner')?.classList.remove('show'));
}

function setupThemeLangToggles() {
  qsa('[data-lang]').forEach(btn => btn.addEventListener('click', () => setLocale(btn.getAttribute('data-lang'))));
  qsa('[data-theme-toggle]').forEach(btn => btn.style.display = 'none');
}

function setupRevealAnimations() {
  const els = qsa('.reveal'); if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { rootMargin: '0px 0px -10% 0px' });
  els.forEach(el => io.observe(el));
}

async function pollMessagesIfNeeded() {
  if (document.body.dataset.page !== 'dashboard') return;
  const token = getToken(); if (!token) { notyf?.error(t('token_missing')); return; }
  const res = await Api.listMessages(token, { status: 'unread' });
  if (res.ok) {
    const list = res.data?.data?.items || res.data?.items || [];
    const topId = list[0]?._id || list[0]?.id || null;
    if (topId && topId !== lastSeenId) { lastSeenId = topId; resetBackoff(); notyf?.success(t('new_message')); const container = qs('#messages'); if (container) renderMessages(container, token, 'all'); }
  }
  const delay = BACKOFFS[backoffIndex]; clearTimeout(pollingTimer); pollingTimer = setTimeout(() => { nextBackoff(); pollMessagesIfNeeded(); }, delay);
}

export async function renderMessages(container, token, status='all') {
  try {
    const res = await Api.listMessages(token, { status });
    if (!res.ok) { 
      container.innerHTML = `<div class="empty">${t('no_data')}</div>`; 
      notyf?.error(res.error || t('fetch_error') || 'Erreur lors du chargement des messages.');
      return; 
    }
    const items = res.data?.data?.items || res.data?.items || [];
    if (!items.length) { container.innerHTML = `<div class="empty">${t('no_data')}</div>`; return; }
    container.innerHTML = '';

    const modal = qs('#message-modal');
    const modalText = qs('#modal-message-text');
    const modalMeta = qs('#modal-message-meta');
    const modalCloseBtn = qs('#modal-close');
    const modalShareBtn = qs('#btn-share-image');
    const modalOverlay = qs('.modal-overlay');

    function closeModal() {
        modal?.classList.add('hidden');
    }

    modalCloseBtn?.addEventListener('click', closeModal);
    modalOverlay?.addEventListener('click', closeModal);

    for (const it of items) {
      const card = document.createElement('div'); card.className = 'card reveal';
      const clickableArea = document.createElement('div'); clickableArea.style.cursor = 'pointer';
      const text = document.createElement('div'); text.className = 'msg'; text.textContent = it.content || '';
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = new Date(it.createdAt || Date.now()).toLocaleDateString();

      clickableArea.append(text, meta);
      card.append(clickableArea);

      clickableArea.addEventListener('click', async () => {
        modalText.textContent = it.content || '';
        modalMeta.textContent = new Date(it.createdAt || Date.now()).toLocaleString();
        
        if(modalShareBtn) {
          const newShareBtn = modalShareBtn.cloneNode(true);
          modalShareBtn.parentNode.replaceChild(newShareBtn, modalShareBtn);
          newShareBtn.addEventListener('click', async () => {
              const nodeToCapture = qs('.modal-content'); 
              const profileRes = await Api.getPublicProfile(getToken());
              const username = profileRes.ok ? profileRes.data.username : null;
              
              if (navigator.canShare && navigator.canShare({ files: [new File([], 'a.png', { type: 'image/png' })] })) {
                  const dataUrl = await generateMessageImage(nodeToCapture, username);
                  const res = await fetch(dataUrl);
                  const blob = await res.blob();
                  const file = new File([blob], 'whispr.png', { type: 'image/png' });

                  await navigator.share({
                      title: 'CyberFusion | Whispr',
                      text: `J'ai reçu un message anonyme ! Envoie-moi le tien sur :\n\n${window.location.origin}/${username}\n\n`,
                      files: [file]
                  });
              } else {
                  const fallbackText = `J'ai reçu un message anonyme ! Envoie-moi le tien sur :\n\n${window.location.origin}/${username}\n\n`;
                  await shareMessageImage(nodeToCapture, username, fallbackText);
              }
          });
        }
        modal?.classList.remove('hidden');
      });

      const actions = document.createElement('div'); actions.className = 'msg-actions';
      const reactGroup = document.createElement('div'); reactGroup.className = 'react-group';
      const reactions = getReactions();
      const current = reactions[it._id || it.id] || null;
      function makeReact(label, code, colors) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'react-btn'; b.textContent = label;
        if (current === code) b.classList.add('active');
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = it._id || it.id; const rx = getReactions();
          rx[id] = (rx[id] === code) ? null : code; saveReactions(rx);
          reactGroup.querySelectorAll('.react-btn').forEach(x => x.classList.remove('active'));
          if (rx[id]) b.classList.add('active');
          confettiMini(colors);
        });
        return b;
      }
      reactGroup.append(
        makeReact('👍','like',['#60a5fa','#93c5fd']), makeReact('❤️','love',['#f43f5e','#fb7185']), makeReact('😂','lol',['#facc15','#fde047'])
      );
      const btnRead = document.createElement('button'); btnRead.className = 'icon-btn sm'; btnRead.textContent = it.isRead ? t('unread') : t('read');
      btnRead.addEventListener('click', async (e) => { e.stopPropagation(); const r = await Api.updateMessage(token, it._id || it.id, { isRead: !it.isRead }); if (r.ok) { notyf?.success(t('action_done')); renderMessages(container, token, status); } });
      const btnDel = document.createElement('button'); btnDel.className = 'icon-btn sm danger'; btnDel.textContent = t('deleted');
      btnDel.addEventListener('click', async (e) => { e.stopPropagation(); const r = await Api.deleteMessage(token, it._id || it.id); if (r.ok) { notyf?.success(t('deleted')); renderMessages(container, token, status); } });
      
      actions.append(reactGroup, btnRead, btnDel);
      card.append(document.createElement('hr')); card.lastChild.className = 'sep';
      card.append(actions);
      container.append(card);
    }
    setupRevealAnimations();
  } catch (error) {
    notyf?.error(t('render_error') || 'Erreur lors de l\'affichage des messages.');
    console.error('Error rendering messages:', error);
  }
}

async function maybeSetupPush(token) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const vapidKey = VAPID_PUBLIC_KEY; if (!vapidKey) return;
    const permission = await Notification.requestPermission(); if (permission !== 'granted') { notyf?.error(t('push_denied')); return; }
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
    const sres = await Api.subscribePush(token, sub); if (sres.ok) notyf?.success(t('push_enabled'));
  } catch (e) { console.warn('Push setup error', e); }
}

function urlBase64ToUint8Array(base64String) { const padding = '='.repeat((4 - (base64String.length % 4)) % 4); const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/'); const rawData = atob(base64); const outputArray = new Uint8-8-Array(rawData.length); for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i); return outputArray; }

function showCreateLinkPrompt() {
  const host = qs('#cta-own-link') || qs('.section.card'); if (!host) return;
  if (qs('#own-link-card')) return;
  const wrap = document.createElement('div'); wrap.id = 'own-link-card'; wrap.className = 'card reveal';
  wrap.innerHTML = `<div class="cta-own"><div style="font-weight:700;">${t('get_own_link') || 'Crée aussi ton lien anonyme'}</div><div class="row"><span>@</span><input id="own-username" class="input" placeholder="${t('choose_username') || 'Choisis ton nom d’utilisateur'}" /><button id="own-create" class="icon-btn primary">${t('create_now') || 'Créer maintenant'}</button></div><div id="own-result" class="row" style="display:none"></div></div>`;
  host.append(wrap);
  setupRevealAnimations();

  qs('#own-create')?.addEventListener('click', async () => {
    const u = (qs('#own-username').value || '').trim(); if (!u) return;
    const res = await Api.createUser({ username: u, bio: '', theme: 'dark' });
    if (!res.ok) { notyf?.error(res.error?.message || 'Erreur'); return; }
    const data = res.data?.data || res.data || {}; const token = data.dashboard_token; if (!token) { notyf?.error('Token manquant'); return; }
    localStorage.setItem(TOKEN_KEY, token);
    const link = `${location.origin}/${encodeURIComponent(u)}`;
    const zone = qs('#own-result'); zone.style.display = 'flex'; zone.style.flexDirection = 'column'; zone.style.gap = '8px';
    zone.innerHTML = `<div><strong>${t('your_link')||'Votre lien'}</strong><br><code>${link}</code></div><div style="display:flex; gap:8px;"><button class="icon-btn" id="own-copy-link">${t('copy')||'Copier'}</button><a class="icon-btn primary" href="/dashboard.html?token=${encodeURIComponent(token)}">${t('go_to_dashboard')||'Aller au dashboard'}</a></div>`;
    qs('#own-copy-link')?.addEventListener('click', async () => { await navigator.clipboard.writeText(link); notyf?.success(t('copied')||'Copié'); });
    notyf?.success(t('success_created') || 'Compte créé !');
  });
}

async function setupPublicForm() {
  const form = qs('#public-form');
  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = 'true';

  const ta = qs('#message'); 
  const btn = qs('#btn-send');
  const username = getUsernameFromPath(); 
  if (!username) return;

  btn.disabled = true; setTimeout(() => { btn.disabled = false; }, 750);

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const content = (ta.value || '').trim();
    if (!content || content.length > 1000) { notyf?.error(t('send_error')); return; }
    const payload = { content, hp: '', ts: Date.now() };
    
    btn.disabled = true; 
    const res = await Api.sendMessage(username, payload);
    if (res.ok) { 
      notyf?.success(t('send_success')); 
      ta.value = ''; 
      confettiBurst(); 
      showCreateLinkPrompt(); 
    } else { 
      notyf?.error(res.error || t('send_error')); 
    }
    setTimeout(() => { btn.disabled = false; }, 2000);
  });
}

async function setupLanding() {
  if (document.body.dataset.page !== 'landing') return;
  const form = qs('#create-user-form'); if (!form) return;
  const iUser = qs('#in-username'); const iBio = qs('#in-bio');
  const out = qs('#signup-result');
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const username = (iUser.value || '').trim(); if (!username) return;
    const bio = (iBio?.value || '').trim();
    const res = await Api.createUser({ username, bio, theme: 'dark' });
    if (!res.ok) { notyf?.error(res.error?.message || 'Erreur'); return; }
    const data = res.data?.data || res.data || {}; const token = data.dashboard_token; if (!token) { notyf?.error('Token manquant'); return; }
    localStorage.setItem(TOKEN_KEY, token);
    const link = `${location.origin}/${encodeURIComponent(username)}`;
    out.innerHTML = '';
    const card = document.createElement('div'); card.className = 'card reveal';
    card.innerHTML = `<div style="display:grid; gap:8px;"><div><strong>${t('your_link') || 'Votre lien'}</strong><br><code>${link}</code></div><div style="display:flex; gap:8px;"><button class="icon-btn" id="copy-link">${t('copy') || 'Copier'}</button><a class="icon-btn" href="${link}" target="_blank" rel="noopener">${t('open_public') || 'Ouvrir la page publique'}</a></div><hr class="sep" /><div><strong>${t('your_token') || 'Votre token'}</strong><br><code style="word-break:break-all;">${token}</code></div><div style="display:flex; gap:8px;"><button class="icon-btn" id="copy-token">${t('copy') || 'Copier'}</button><a class="icon-btn primary" href="/dashboard.html?token=${encodeURIComponent(token)}">${t('go_to_dashboard') || 'Aller au dashboard'}</a></div></div>`;
    out.append(card); setupRevealAnimations();
    
    const shareButtonsHTML = `
      <div style="margin-top: 16px; text-align: center;">
        <h3 style="margin-bottom: 10px;">Partager votre lien</h3>
        <a href="https://wa.me/?text=Laisse-moi un message anonyme sur Whispr ! C'est ici : ${encodeURIComponent(link)}" target="_blank" class="icon-btn" style="background:#25D366; color:white;">WhatsApp</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}" target="_blank" class="icon-btn" style="background:#1877F2; color:white;">Facebook</a>
        <a href="https://www.snapchat.com/scan?uuid=YOUR-UUID-HERE&amp;share_url=${encodeURIComponent(link)}" target="_blank" class="icon-btn" style="background:#FFFC00; color:black;">Snapchat</a>
      </div>
    `;
    card.insertAdjacentHTML('beforeend', shareButtonsHTML);

    qs('#copy-link')?.addEventListener('click', async () => { await navigator.clipboard.writeText(link); notyf?.success(t('copied') || 'Copié'); });
    qs('#copy-token')?.addEventListener('click', async () => { await navigator.clipboard.writeText(token); notyf?.success(t('copied') || 'Copié'); });
  });
}

async function setupDashboard() {
  if (document.body.dataset.page !== 'dashboard') return;
  const token = getToken(); if (!token) { notyf?.error(t('token_missing')); return; }

  try {
    const profileRes = await Api.getPublicProfile(token);
    if (profileRes.ok && profileRes.data && profileRes.data.username) {
      const username = profileRes.data.username;
      const publicLink = `${window.location.origin}/${username}`;
      const publicLinkInput = qs('#public-link-input');
      if (publicLinkInput) publicLinkInput.value = publicLink;
      
      const copyLinkBtn = qs('#copy-link-btn');
      if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', async () => {
          await navigator.clipboard.writeText(publicLink);
          notyf?.success(t('copied') || 'Copié !');
        });
      }

      const shareText = `Laisse-moi un message anonyme sur Whispr ! C'est ici : ${publicLink}`;
      if (qs('#share-whatsapp')) qs('#share-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      if (qs('#share-facebook')) qs('#share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicLink)}`;
      if (qs('#share-snapchat')) qs('#share-snapchat').href = `https://www.snapchat.com/scan?uuid=YOUR-UUID-HERE&amp;share_url=${encodeURIComponent(publicLink)}`;
    } else {
      notyf?.error(t('profile_error') || 'Erreur lors du chargement du profil.');
    }
  } catch (error) {
    notyf?.error(t('api_error') || 'Erreur de connexion au serveur.');
    console.error('API Error fetching profile:', error);
  }

  const listEl = qs('#messages'); 
  if (listEl) await renderMessages(listEl, token, 'all');

  qsa('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    qsa('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMessages(listEl, token, btn.getAttribute('data-filter'));
  }));

  const canvas = qs('#chart'); const rangeBtns = qsa('[data-range]');
  async function loadRange(r) { 
    const { renderStats } = await import('./stats.js'); 
    await renderStats(canvas, token, r); 
  }
  rangeBtns.forEach(b => b.addEventListener('click', () => loadRange(b.getAttribute('data-range')))); await loadRange('7d');
  
 const btnPush = qs('#btn-push'); 
  if (btnPush && VAPID_PUBLIC_KEY) {
    btnPush.addEventListener('click', () => maybeSetupPush(token));
  } else {
    btnPush?.remove();
  }
  
  resetBackoff(); 
  pollMessagesIfNeeded(); 
  setupRevealAnimations();
}

export async function initApp() { 
    initTheme(); initNotify(); applyI18n(detectLocale()); setupThemeLangToggles(); 
    await registerServiceWorker(); 
    setupInstallBanner(); setupRevealAnimations(); 
    await setupLanding(); await setupPublicForm(); await setupDashboard(); 
}