Optimisateur de Batterie - Simulation & Arbitrage

Solution full-stack permettant de simuler l'utilisation d'une batterie résidentielle et d'optimiser les coûts d'électricité basée sur l'arbitrage tarifaire.

Installation

Backend (FastAPI)
1. Allez dans le dossier 'server'.
2. Créez un environnement virtuel : 'python -m venv venv'.
3. Activez-le : '.\venv\Scripts\activate' (Windows) ou 'source venv/bin/activate' (Linux/Mac).
4. Installez les dépendances : 'pip install -r requirements.txt'.
5. Renommez '.env.template' (si présent) en '.env' et configurez votre 'API_KEY'.

Frontend (React + Vite)
1. Allez dans le dossier 'client'.
2. Installez les dépendances : 'npm install'.

---

1. Lancer le Backend
Dans le terminal, dans le dossier 'server', il faut inscrire
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000


- L'API sera disponible sur 'http://localhost:8000'.
- La documentation OpenAPI est sur 'http://localhost:8000/docs'.

2. Lancer le Frontend
Dans le terminal, dans le dossier 'client', il faut inscrire
npm run dev

- L'interface sera accessible sur 'http://localhost:5173'.

---

Fonctionnalités de Production
- Authentification: Sécurisé via l'entête x-api-key.
- Rate Limiting: Protection contre les accès abusifs via SlowAPI.
- Logging : Suivi des performances et des requêtes en temps réel.
- Containerization : Prêt pour Docker.

---

Déploiement

Backend via Docker
1. Construisez l'image : docker build -t battery-optimizer-server ./server.
2. Lancez le conteneur : docker run -p 8000:8000 --env API_KEY=votre_cle battery-optimizer-server.

Plateformes Cloud (ex: Render/Railway)
- Utilisez le Dockerfile pour le backend.
- Définissez la variable d'environnement API_KEY.
- Déployez le dossier client comme un Static Site.
