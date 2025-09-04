Lancement local (npm start)

1) Installer les dépendances
   cd frontend
   npm install

2) Configurer l’ENV
   cp .env.example .env
   # Éditez .env si besoin (API_ORIGIN, PORT, BASE_URL, VAPID_PUBLIC_KEY)
   # Astuce anti‑CORS pendant le dev: mettez API_ORIGIN="" pour utiliser le proxy local /api/*

3) Démarrer
   npm start

4) Ouvrir
   - Landing:        http://localhost:5173/
   - Page publique:  http://localhost:5173/votreUsername
   - Dashboard:      http://localhost:5173/dashboard.html?token=VOTRE_TOKEN

Notes
- /env.js expose votre .env côté client pour que /js/config.js lise API_ORIGIN/BASE_URL sans build.
- Un proxy /api/* → API_ORIGIN est actif; si vous mettez API_ORIGIN="" les appels relatifs /api/... passeront par ce proxy.
- Le Service Worker est actif en local (PWA installable). Videz le cache lors des changements.
- Web Push ne s’activera que si vous fournissez une VAPID_PUBLIC_KEY ou si l’API expose une route dédiée.
