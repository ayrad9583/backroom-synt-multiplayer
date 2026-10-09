# Backrooms SYNT — salons publics

Ce dépôt contient le serveur WebSocket qui héberge la liste des salons publics et relaie les positions/messages.

## Déployer le serveur sur Render

1. Ouvrir https://render.com/ et connecter GitHub.
2. Choisir **New + → Blueprint** et sélectionner ce dépôt, ou créer un **Web Service** depuis ce dépôt.
3. Si Render demande les commandes : Build `npm install`, Start `npm start`.
4. Une fois le service démarré, vérifier `https://NOM-DU-SERVICE.onrender.com/health`. La réponse doit inclure `ok: true`.
5. Dans le jeu, utiliser `wss://NOM-DU-SERVICE.onrender.com` comme adresse du serveur multijoueur.

## Fichier du jeu

Ajouter à la racine du dépôt le fichier `backrooms-synt-public-rooms.html` contenu dans l'archive `Backrooms-SYNT-salons-publics-kit.zip`. Pour le faire via GitHub : **Add file → Upload files**, déposer le HTML, puis **Commit changes**.

Pour publier le jeu avec GitHub Pages : **Settings → Pages → Deploy from a branch → main → /(root) → Save**. L'adresse attendue sera `https://ayrad9583.github.io/backroom-synt-multiplayer/backrooms-synt-public-rooms.html` une fois Pages activé et le fichier présent.

## Limites

La version relaie la liste des salons, la présence, les positions et le chat. Les monstres, objets, portes, inventaires et progression ne sont pas synchronisés comme un monde partagé autoritaire. Il faut encore effectuer un test réel avec deux appareils après le déploiement.
