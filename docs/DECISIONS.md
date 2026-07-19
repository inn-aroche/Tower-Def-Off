# Runeforge Defense — Journal de décisions

Décisions prises pendant ce build one-shot, avec le raisonnement. Sert de mémoire pour la suite (P0) et de justification pour les choix qui ne sont pas évidents en lisant juste le code.

## 1. Le skill `studio-jeu-mobile` n'existe pas dans cet environnement

La demande initiale invoquait un skill "studio-jeu-mobile" pour dérouler le protocole one-shot. Vérifié via `ListSkills`/`SearchSkills` : ce skill n'est pas installé/disponible ici. Décision : dérouler manuellement un protocole équivalent (GDD, art-bible, tracking plan, simulation d'économie, decisions.md, audit.md + build jouable) plutôt que bloquer sur l'absence d'outil.

## 2. Remplacement complet de PolyMaze TD plutôt qu'un pivot

Cette branche contenait déjà un tower defense fonctionnel (**PolyMaze TD** : moteur Three.js, campagne 50 niveaux, skins par étoiles) mais sans aucun des éléments demandés (classes, arbre de compétences, DA Clash Royale). Deux options existaient : pivoter le moteur existant, ou repartir de zéro. **L'utilisateur a explicitement choisi le remplacement complet** (question posée directement, réponse : "Remplacer complètement"). Tout `src/` et `tests/` de PolyMaze TD a été supprimé ; ce document couvre uniquement le nouveau jeu.

## 3. Canvas 2D plutôt que Three.js / 3D

PolyMaze TD utilisait Three.js (rendu 3D, texture pipeline, caméra orthographique). Pour Runeforge Defense : **Canvas 2D + DOM**, pas de dépendance `three`. Raisons :
- La DA visée (Clash Royale) se traduit très bien en formes vectorielles plates (cercles, rectangles arrondis, aplats de couleur + contour épais) — la 3D n'apporte rien ici et ajoute un pipeline d'assets (modèles, textures, éclairage) hors budget d'un one-shot.
- Bundle final : **14.5 KB gzippé** (vs. un bundle Three.js qui dépasse largement les 100 KB rien que pour la lib) — meilleur temps de chargement mobile, cohérent avec "session courte, sans friction".
- Zéro asset binaire à committer/maintenir (voir décision 4).

## 4. Aucun asset image — tout est vectoriel + emoji

Pas de sprites dessinés, pas de textures. Tours/ennemis/UI sont des formes canvas (cercles, rectangles arrondis) + icônes emoji (rendu par la police système, gratuit, net sur tous les devices modernes). Compromis assumé : moins de personnalité visuelle qu'une illustration dédiée, mais zéro pipeline d'art à instrumenter pour un one-shot, zéro poids de téléchargement, et un rendu cohérent quelle que soit la résolution d'écran. Détaillé dans `docs/ART_BIBLE.md` §1 et §6.

## 5. Mode "vagues sans fin" plutôt qu'une campagne à niveaux

Pas de campagne à niveaux verrouillés (contrairement à PolyMaze TD). Le twist (classe + arbre façon Diablo II) appelle naturellement une boucle **run → meta-progression → run**, pas une progression linéaire de niveaux. Réduit aussi drastiquement le scope de contenu à produire en one-shot (3 cartes au lieu de 50 niveaux) sans sacrifier la profondeur : la profondeur vient de l'arbre, pas du nombre de cartes.

## 6. Lancement de vague manuel — pas de minuteur automatique

Décision directement liée à l'interdit choisi ("pas de difficulté punitive / die & retry frustrant") : la vague suivante ne démarre **jamais** automatiquement. C'est un choix de design explicite, pas juste une implémentation par défaut — un minuteur forçant le rythme aurait été la première source de stress punitif dans un jeu au pouce.

## 7. Trois classes, pas quatre

Le brief initial imaginait jusqu'à un 4ᵉ archétype (invocateur/nécromant). Coupé pour tenir le budget d'un one-shot testable : Guerrier/Arcaniste/Rôdeur couvrent déjà trois identités de jeu bien différenciées (tank/PV, contrôle de zone, dégâts critiques + économie) avec des arbres de 12 nœuds chacun (36 nœuds au total, déjà consistant). Un 4ᵉ archétype est la prochaine extension naturelle (voir §11).

## 8. Classes = passif + ultime + arbre, pas de tours exclusives

Alternative envisagée : chaque classe débloque une tour signature exclusive. Écartée : cela aurait multiplié le nombre de tours à équilibrer (4 tours communes + 3 exclusives = 7 à tester) sans ajouter de profondeur proportionnelle, et aurait cassé la lisibilité "4 tours, tout le monde les connaît" utile pour une session de 5-15 min. La différenciation de classe passe par le **comment on joue** ces mêmes 4 tours (passifs, arbre), pas par **quoi on débloque**.

## 9. Aucune monétisation, aucun SDK plateforme

Palier P-1 = solo local-first. Pas de pub, pas d'IAP, pas d'intégration Poki/CrazyGames (contrairement à PolyMaze TD qui avait un `AdProvider`/`PokiProvider`/`CrazyGamesProvider`). Tout ce module a été supprimé avec le reste de l'ancien projet plutôt que gardé "au cas où" — code mort non maintenu = risque, pas filet de sécurité. À réintroduire explicitement si/quand un palier P0 avec monétisation est demandé.

## 10. Tracking 100% local, pas de backend

`src/tracking/Analytics.ts` journalise en `localStorage` uniquement (buffer capé à 200 événements). Aucune télémétrie ne quitte l'appareil — cohérent avec le palier P-1 et évite tout sujet de consentement RGPD à ce stade. Le schéma d'événements (`docs/TRACKING_PLAN.md`) est conçu pour qu'un futur transport réseau se branche sur `Analytics.track()` sans ré-instrumenter le jeu.

## 11. Correctif du pipeline `build:artifact` hérité

Le script `scripts/build-artifact.mjs` (hérité de PolyMaze TD) n'inlinait que le `<script>` JS dans le fragment HTML autonome, pas la feuille de style — ça ne posait pas de problème dans l'ancien projet (tout son CSS était en `<style>` inline dans `index.html`), mais Runeforge Defense charge `src/style.css` en import JS, que Vite extrait toujours en fichier séparé même avec `cssCodeSplit:false`. Sans correctif, le fragment publié comme Artifact aurait été un jeu sans aucun style. **Corrigé** : le script inline maintenant aussi le `<link rel="stylesheet">` en `<style>` inline. Vérifié en chargeant le fragment généré dans un navigateur headless — rendu identique au dev server.

## 12. Simulation d'économie : trouvaille assumée, non corrigée

La simulation (`docs/ECONOMY_SIMULATION.md`) révèle qu'après ~15-20 vagues, un joueur a acheté le maximum de tours (6, toutes tier 3) et l'or s'accumule sans plus d'utilité (jusqu'à 4000+ or inutilisé en fin de run). Ce n'est pas un problème de difficulté (l'or n'est de toute façon plus limitant à ce stade) mais un plafond de decision-making économique en fin de run. **Non corrigé dans ce one-shot** — corriger proprement demanderait un nouveau sink (plus de slots de tours, tours au-delà du tier 3, conversion or→Essence en fin de run) qui est une décision de design à part entière, pas un bugfix. Listé en roadmap P0.

## 13. Roadmap explicite hors scope P-1

Pour être honnête sur ce qui n'est **pas** fait plutôt que de le laisser implicite :
- 4ᵉ classe (invocateur/nécromant évoqué en brainstorm, jamais implémenté).
- Sink économique en fin de run (voir §12).
- Cartes supplémentaires / cartes à débloquer.
- Monétisation, SDK plateforme, compte joueur, cloud save (voir §9).
- `class_switched` : le type d'événement existe dans le schéma de tracking mais n'est pas câblé côté UI (voir `docs/TRACKING_PLAN.md`, note en bas de tableau) — non-bloquant, `class_selected.is_first_pick=false` capture déjà l'essentiel du signal.
