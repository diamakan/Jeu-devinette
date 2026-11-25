# 🎨 Croquizz : dessine, devine, gagne !

Jeu de dessin et de devinettes à plusieurs : **chaque téléphone sert de manette**, **la télé affiche le dessin en direct**.

![Les logos proposés](logos/planche-logos.png)

## Jouer

1. Ouvre l'adresse du jeu dans **Chrome** sur ton téléphone (ou l'appli installée).
2. Entre ton prénom, choisis un avatar et touche **🎉 Créer une partie**. Un code de 4 lettres s'affiche (ex. `KZPT`).
3. Touche le **bouton Cast 📺** et choisis ta télé : le jeu s'affiche dessus.
4. Les autres joueurs scannent le QR code affiché sur la télé (ou tapent le code) et rejoignent la partie.

Pas de Chromecast ? Ouvre `adresse-du-jeu/tv?salon=CODE` dans le navigateur de la télé.

> Le bouton Cast d'une appli web marche avec Chrome sur Android et sur ordinateur. Sur iPhone on peut jouer normalement, mais c'est un téléphone Android (ou un ordinateur) qui lance le Cast.

## Mise en ligne (une seule fois)

### Étape 1 : héberger le jeu gratuitement sur Render
1. Va sur https://render.com, clique **Get Started** et connecte-toi **avec GitHub**.
2. Clique **New +** puis **Blueprint**, choisis le dépôt **jeu-devinette**, puis **Apply**. Laisse `CAST_APP_ID` vide pour l'instant.
3. Après 1 à 2 minutes, Render affiche l'adresse du jeu, par exemple `https://croquizz.onrender.com`. Le jeu est en ligne !

> Version gratuite : le serveur s'endort après 15 minutes sans joueur. La première ouverture prend alors environ une minute, ensuite tout est rapide.

### Étape 2 : créer l'appli Google Cast (5 $ une seule fois)
1. Va sur https://cast.google.com/publish, connecte-toi avec ton compte Google et paie l'inscription (5 $).
2. Clique **Add New Application** puis **Custom Receiver**.
   - Name : `Croquizz`
   - Receiver Application URL : `https://TON-ADRESSE.onrender.com/recepteur`
3. Enregistre : Google te donne un **Application ID** (8 caractères, ex. `A1B2C3D4`).
4. Pour essayer tout de suite, clique **Add New Device** et entre le numéro de série de ton Chromecast (visible dans l'appli Google Home, réglages de l'appareil). Attends 15 minutes puis redémarre le Chromecast.
5. Quand tout marche, clique **Publish** : l'appli fonctionnera alors sur tous les Chromecast, y compris chez tes amis.

### Étape 3 : relier les deux
Dans Render, ouvre le service **croquizz**, onglet **Environment**, ajoute `CAST_APP_ID` = ton Application ID, puis **Save Changes**. Le bouton Cast apparaît dans le jeu.

## Jouer à la maison sans Internet (optionnel)
Avec Node.js installé (https://nodejs.org), tape `node server.js` dans le dossier du jeu, puis ouvre l'adresse affichée sur la télé et les téléphones (même Wi-Fi).

## Déroulement d'une partie

1. Chacun entre son prénom et choisit un avatar. Celui qui crée la partie est **l'hôte** : il choisit le thème et le nombre de tours, puis lance la partie.
2. Le dessinateur reçoit **3 mots** : 🟢 facile (100 pts), 🟠 moyen (200 pts), 🔴 difficile (300 pts).
3. Il dessine sur son téléphone, le dessin apparaît **en direct** sur la télé. Il a 90 secondes.
4. Les autres tapent leurs réponses sur leur téléphone (« 🔥 presque ! » quand c'est très proche). On peut aussi répondre à voix haute : le dessinateur touche alors le nom du joueur pour lui donner les points.
5. Le dessinateur appuie sur **✋ Fin de manche** : le mot est révélé sur la télé avec les points gagnés.
6. À la fin : **podium** avec confettis 🏆.

### Les points
- Trouver le mot : points du niveau + **bonus de rapidité** (jusqu'à +100) + **+50 pour le premier**.
- Le dessinateur gagne la moitié des points du niveau pour chaque joueur qui trouve.
- 💡 Une lettre est révélée à mi-temps (et une deuxième à 25 s de la fin pour les mots longs).

## Ajouter des mots ou des thèmes
Ouvrez `mots.js` avec un éditeur de texte (Bloc-notes suffit) et ajoutez des mots entre guillemets.

## Installer l'appli sur le téléphone
Une fois le jeu en ligne :
- **Android** : dans Chrome, touche **📲 Installer l'appli** sur l'écran d'accueil du jeu (ou menu ⋮ → « Installer l'application »).
- **iPhone** : dans Safari, bouton Partager → « Sur l'écran d'accueil ».

## Fichiers
| Fichier | Rôle |
|---|---|
| `server.js` | le serveur : relie téléphones et télé en temps réel (WebSocket, sans aucune dépendance) |
| `mots.js` | les listes de mots par thème et difficulté |
| `public/index.html`, `telephone.js` | l'écran du téléphone |
| `public/tv.html`, `tv.js` | l'écran de la télé |
| `public/manifest.webmanifest`, `sw.js`, `icons/` | l'installation sur téléphone (PWA) |
| `public/recepteur.js` | l'écran du Chromecast (récepteur Google Cast) |
| `render.yaml` | la configuration de l'hébergeur Render |
| `logos/` | les 4 propositions de logo |

`public/qrcode.js` : bibliothèque QR Code de Kazuhiko Arase (licence MIT).
