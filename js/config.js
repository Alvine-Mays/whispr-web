// Fichier de configuration côté client, surchargé par /env.js si présent
// Tous les commentaires sont en français.

const ENV = (typeof window !== 'undefined' && window.__ENV) ? window.__ENV : {};

// Important: si API_ORIGIN est une chaîne vide (""), on utilise les URLs relatives /api/* (proxy local)
export const API_ORIGIN = (ENV.API_ORIGIN === undefined ? "https://wishpr-api.onrender.com" : ENV.API_ORIGIN);
export const BASE_URL = ENV.BASE_URL || "https://whispr.netlify.app";
export const VAPID_PUBLIC_KEY = ENV.VAPID_PUBLIC_KEY || null;