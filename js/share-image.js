// Génération d’image à partir d’un message via html2canvas ou dom-to-image.
// Ajoute une signature "Whispr" + lien public BASE_URL/username.

import { BASE_URL } from './config.js';

async function htmlToCanvas(node) {
  if (window.html2canvas) {
    return await window.html2canvas(node, { backgroundColor: null, scale: 2 });
  }
  if (window.domtoimage) {
    const dataUrl = await window.domtoimage.toPng(node, { bgcolor: 'transparent', style: { transform: 'scale(1)' } });
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }
  throw new Error('Aucune librairie de capture DOM disponible');
}

export async function generateMessageImage(node, username) {
  const originalText = node.querySelector('#modal-message-text').textContent;
  const originalMeta = node.querySelector('#modal-message-meta').textContent;

  const tempDiv = document.createElement('div');
  tempDiv.style.cssText = `
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: #f0f0f5;
    font-size: 36px;
    line-height: 1.5;
    text-align: center;
    padding: 40px;
    max-width: 900px;
    word-wrap: break-word;
    white-space: pre-wrap;
    background: rgba(255,255,255,0.05);
    border-radius: 20px;
    margin: 0 auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  `;
  tempDiv.textContent = originalText;
  document.body.appendChild(tempDiv);
  const messageCanvas = await htmlToCanvas(tempDiv);
  document.body.removeChild(tempDiv);

  const w = 1200;
  const h = 630;
  
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const bgGradient = ctx.createLinearGradient(0, 0, w, h);
  bgGradient.addColorStop(0, '#1a1823');
  bgGradient.addColorStop(1, '#0d0c12');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, w, h);

  const light1 = ctx.createRadialGradient(w * 0.2, h * -0.1, 0, w * 0.2, h * -0.1, w * 0.8);
  light1.addColorStop(0, 'rgba(190, 41, 236, 0.4)');
  light1.addColorStop(1, 'transparent');
  ctx.fillStyle = light1;
  ctx.fillRect(0, 0, w, h);

  const light2 = ctx.createRadialGradient(w * 0.8, h * 1.1, 0, w * 0.8, h * 1.1, w * 0.7);
  light2.addColorStop(0, 'rgba(239, 88, 117, 0.3)');
  light2.addColorStop(1, 'transparent');
  ctx.fillStyle = light2;
  ctx.fillRect(0, 0, w, h);

  const scale = Math.min((w * 0.8) / messageCanvas.width, (h * 0.5) / messageCanvas.height);
  const scaledW = messageCanvas.width * scale;
  const scaledH = messageCanvas.height * scale;
  const posX = (w - scaledW) / 2;
  const posY = (h - scaledH) / 2 - 50;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 40;
  ctx.drawImage(messageCanvas, posX, posY, scaledW, scaledH);
  ctx.shadowColor = 'transparent';

  ctx.font = '20px Inter, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'center';
  ctx.fillText(originalMeta, w / 2, posY + scaledH + 20);

  const signatureY = h - 100;
  ctx.font = 'bold 72px Inter, system-ui, sans-serif';
  
  const textGradient = ctx.createLinearGradient(0, 0, w, 0);
  textGradient.addColorStop(0.3, '#be29ec');
  textGradient.addColorStop(0.7, '#ef5875');
  ctx.fillStyle = textGradient;
  ctx.fillText('CyberFusion | Whispr', w / 2, signatureY);

  if (username) {
    const link = `${BASE_URL}/${encodeURIComponent(username)}`;
    ctx.font = '28px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(link, w / 2, signatureY + 45);
  }

  return canvas.toDataURL('image/png');
}

export async function shareMessageImage(node, username, fallbackText) {
  const dataUrl = await generateMessageImage(node, username);

  if (navigator.canShare) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'whispr.png', { type: 'image/png' });

      await navigator.share({
        title: 'CyberFusion | Whispr',
        text: fallbackText || `Partagé via Whispr. Envoie-moi un message : ${window.location.origin}/${username}`,
        files: [file]
      });
      return { ok: true };
    } catch (e) { /* ignoré, on essaie le fallback */ }
  }

  const a = document.createElement('a');
  a.href = dataUrl; a.download = 'whispr.png';
  document.body.appendChild(a); a.click(); a.remove();

  return { ok: true, fallback: true };
}