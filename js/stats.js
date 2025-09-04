// Intégration Chart.js et consommation des stats API.

import { Api } from './api.js';

let chart;

export async function renderStats(canvas, token, range = '7d') {
  const res = await Api.getStats(token, range);
  if (!res.ok) return { ok: false, error: res.error };

  const payload = res.data || {};
  const labels = payload.labels || payload.data?.labels || [];
  const series = payload.series || payload.data?.series || [];

  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Messages',
        data: series,
        borderColor: '#6ea8fe',
        backgroundColor: 'rgba(110,168,254,0.2)',
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted') } },
        y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted') }, beginAtZero: true }
      },
      plugins: {
        legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') } }
      }
    }
  };

  if (chart) { chart.destroy(); }
  chart = new Chart(canvas.getContext('2d'), cfg);
  return { ok: true };
}
