// i18n minimal: FR prioritaire + EN, avec data-i18n et bascule.

const I18N_KEY = 'whispr_lang';

const FR = {
  app_name: 'Whispr',
  landing_title: 'Envoyez et recevez des messages en toute simplicité',
  get_started: 'Commencer',
  docs: 'Documentation',
  username_placeholder: 'Votre nom d’utilisateur',
  message_placeholder: 'Écrire un message anonyme (max 1000 caractères)…',
  send: 'Envoyer',
  installing: 'Installation PWA…',
  install: 'Installer l’application',
  cancel: 'Annuler',
  theme: 'Thème',
  theme_auto: 'Auto',
  theme_light: 'Clair',
  theme_dark: 'Sombre',
  language: 'Langue',
  fr: 'FR',
  en: 'EN',
  stats: 'Statistiques',
  last_7: '7 jours',
  last_30: '30 jours',
  no_data: 'Aucune donnée pour l’instant',
  dashboard: 'Tableau de bord',
  public_profile: 'Page publique',
  send_success: 'Message envoyé !',
  send_error: 'Échec de l’envoi',
  new_message: 'Nouveau message reçu',
  enable_push: 'Activer les notifications',
  push_enabled: 'Notifications activées',
  push_denied: 'Permission de notification refusée',
  token_missing: 'Jeton absent, merci d’ajouter ?token=…',
  action_done: 'Action effectuée',
  deleted: 'Supprimé',
  archived: 'Archivé',
  favorited: 'Favori',
  read: 'Lu',
  unread: 'Non lu',
  download_image: 'Télécharger l’image',
  share_image: 'Partager en image',
  share_text: 'Partager',
  create_link: 'Créer mon lien',
  your_link: 'Votre lien public',
  your_token: 'Votre token',
  copy: 'Copier',
  copied: 'Copié',
  go_to_dashboard: 'Aller au dashboard',
  open_public: 'Ouvrir la page publique',
  get_own_link: 'Crée aussi ton lien anonyme',
  choose_username: 'Choisis ton nom d’utilisateur',
  create_now: 'Créer maintenant',
  success_created: 'Compte créé !' ,
};

const EN = {
  app_name: 'Whispr',
  landing_title: 'Send and receive messages effortlessly',
  get_started: 'Get started',
  docs: 'Documentation',
  username_placeholder: 'Your username',
  message_placeholder: 'Write an anonymous message (max 1000 chars)…',
  send: 'Send',
  installing: 'Installing PWA…',
  install: 'Install app',
  cancel: 'Cancel',
  theme: 'Theme',
  theme_auto: 'Auto',
  theme_light: 'Light',
  theme_dark: 'Dark',
  language: 'Language',
  fr: 'FR',
  en: 'EN',
  stats: 'Statistics',
  last_7: '7 days',
  last_30: '30 days',
  no_data: 'No data yet',
  dashboard: 'Dashboard',
  public_profile: 'Public page',
  send_success: 'Message sent!',
  send_error: 'Sending failed',
  new_message: 'New message received',
  enable_push: 'Enable notifications',
  push_enabled: 'Notifications enabled',
  push_denied: 'Notification permission denied',
  token_missing: 'Token missing, please add ?token=…',
  action_done: 'Action done',
  deleted: 'Deleted',
  archived: 'Archived',
  favorited: 'Favorited',
  read: 'Read',
  unread: 'Unread',
  download_image: 'Download image',
  share_image: 'Share image',
  share_text: 'Share',
  create_link: 'Create my link',
  your_link: 'Your public link',
  your_token: 'Your token',
  copy: 'Copy',
  copied: 'Copied',
  go_to_dashboard: 'Go to dashboard',
  open_public: 'Open public page',
  get_own_link: 'Create your own anonymous link',
  choose_username: 'Choose your username',
  create_now: 'Create now',
  success_created: 'Account created!' ,
};

const DICTS = { fr: FR, en: EN };

export function detectLocale() {
  const saved = localStorage.getItem(I18N_KEY);
  if (saved) return saved;
  const nav = (navigator.language || 'fr').toLowerCase();
  return nav.startsWith('fr') ? 'fr' : 'en';
}

export function setLocale(lang) {
  localStorage.setItem(I18N_KEY, lang);
  applyI18n(lang);
}

export function t(key) {
  const lang = detectLocale();
  return (DICTS[lang] && DICTS[lang][key]) || (DICTS.fr && DICTS.fr[key]) || key;
}

export function applyI18n(lang = detectLocale()) {
  const dict = DICTS[lang] || DICTS.fr;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = dict[key] || key;
    // Sécurité: on écrit dans textContent uniquement
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.setAttribute('placeholder', value);
    } else {
      el.textContent = value;
    }
  });
}
