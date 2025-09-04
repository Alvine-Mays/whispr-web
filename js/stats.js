// Intégration Chart.js et consommation des stats API.

import { Api } from './api.js';
import { notyf } from './notify.js';

let chart;

export async function renderStats(canvas, token, range = '7d') {
  const res = await Api.getStats(token, range);
  if (!res.ok) { notyf?.error(res.error || 'Erreur stats'); return { ok: false, error: res.error }; }

  const payload = res.data || {};
  const labels = payload.labels || payload.data?.labels || [];
  const series = payload.series || payload.data?.series || [];

  const ctx = canvas.getContext('2d');
  const styles = getComputedStyle(document.documentElement);
  const primary = (styles.getPropertyValue('--primary') || '#be29ec').trim();
  const textColor = (styles.getPropertyValue('--text') || '#f0f0f5').trim();
  const mutedColor = (styles.getPropertyValue('--muted') || '#85809a').trim();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  function hexToRGBA(hex, a=1) {
    const h = hex.replace('#','');
    const bigint = parseInt(h.length===3 ? h.split('').map(x=>x+x).join('') : h, 16);
    const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, hexToRGBA(primary, 0.35));
  grad.addColorStop(1, hexToRGBA(primary, 0.05));

  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Messages',
        data: series,
        borderColor: primary,
        backgroundColor: grad,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: mutedColor }, grid: { color: gridColor } },
        y: { ticks: { color: mutedColor }, grid: { color: gridColor }, beginAtZero: true }
      },
      plugins: {
        legend: { labels: { color: textColor } }
      }
    }
  };

  if (chart) { chart.destroy(); }
  chart = new Chart(ctx, cfg);
  return { ok: true };
}
