// Intégration Notyf pour les toasts de feedback utilisateur.

export let notyf;

export function initNotify() {
  // Notyf est fourni via CDN et exposé globalement.
  if (window.Notyf) {
    notyf = new Notyf({
      duration: 2500,
      position: { x: 'center', y: 'top' },
      ripple: true,
      types: [
        { type: 'success', background: '#10b981' },
        { type: 'error', background: '#ef4444' },
        { type: 'info', background: '#2563eb' },
      ]
    });
  } else {
    console.warn('Notyf non chargé');
    notyf = { success: console.log, error: console.error, open: console.log };
  }
}
