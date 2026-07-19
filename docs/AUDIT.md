# Runeforge Defense — Audit final (one-shot)

Date : voir dernier commit. Statut global : **MVP jouable, vérifié fonctionnellement, prêt pour playtest humain.**

## 1. Conformité au brief

| Exigence | Statut | Preuve |
|---|---|---|
| Twist : classes façon Diablo II + arbre de compétences personnalisable | ✅ | 3 classes, 12 nœuds/classe, prérequis par palier testés (`tests/skilltree.spec.ts`), agrégation des effets testée |
| Palier P-1 : solo local-first | ✅ | Aucune dépendance réseau. Persistance 100% `localStorage` (`SaveManager`). Aucun SDK plateforme, aucun compte |
| Session 5–15 min, un pouce | ✅ (mesuré) | Simulation d'économie : 13.0–13.5 min pour un joueur moyen (`docs/ECONOMY_SIMULATION.md`). Tous les contrôles tap-only vérifiés en navigateur (placement, amélioration, vente, ultime, lancement de vague) |
| DA géométrique/Clash Royale | ✅ | Palette + langage de forme documentés (`docs/ART_BIBLE.md`), vérifiés visuellement via captures d'écran Playwright |
| Interdit : pas de die & retry punitif | ✅ | Vague manuelle (jamais de minuteur forcé), Essence toujours conservée même en défaite, remboursement de vente 80%, régénération passive du Donjon entre vagues — détaillé §5 du GDD |
| Livrable : build web jouable | ✅ | `npm run build` (14.5 KB gzip) + `npm run build:artifact` (fragment HTML autonome, testé en navigateur isolé) |
| Livrable : GDD | ✅ | `docs/GDD.md` |
| Livrable : art-bible | ✅ | `docs/ART_BIBLE.md` |
| Livrable : tracking plan | ✅ | `docs/TRACKING_PLAN.md` |
| Livrable : simulation d'économie | ✅ | `docs/ECONOMY_SIMULATION.md` + script exécutable `scripts/economy-sim.mjs`, sortie réelle incluse (aucun chiffre inventé) |
| Livrable : decisions.md | ✅ | `docs/DECISIONS.md` |
| Livrable : audit.md | ✅ | ce document |

## 2. Ce qui a été vérifié, et comment

### Vérification automatisée
- **Typecheck strict** (`tsc -b --noEmit`, `strict: true`, `noUnusedLocals`, `noUnusedParameters`) : 0 erreur.
- **45 tests unitaires** (`vitest run`), tous verts, couvrant :
  - économie (coûts, remises d'arbre, remboursement, bonus de fin de vague, or par kill),
  - combat (ciblage "ennemi le plus avancé", dégâts élémentaires, zone, ralentissement, chaîne, pulsation Givre tier 3, critique),
  - arbre de compétences (verrouillage par palier/branche, agrégation des effets, isolation entre classes),
  - génération de vagues (déblocage progressif des types d'ennemis, vagues boss, croissance des PV),
  - grille (bornes de carte, cases constructibles, conversion pixel↔case, position sur le chemin),
  - sauvegarde (persistance, dépense d'Essence, idempotence, reset).
- **Build de production** (`npm run build`) : succès, 14.5 KB gzippé.
- **Build artefact autonome** (`npm run build:artifact`) : succès ; le fragment HTML généré a été chargé dans un Chromium headless **isolé du dev server** (fichier local, aucune requête réseau) pour confirmer qu'il est bien 100% autonome (CSS + JS inlinés, voir `docs/DECISIONS.md` §11).

### Vérification manuelle en navigateur (Playwright, viewport mobile 390×844)
Parcours réellement exécutés et capturés en écran, pas seulement lus dans le code :
1. Écran titre → sélection de classe → confirmation → Hub.
2. Hub → sélection de carte → run : la grille, le chemin, le portail d'invocation et le Donjon s'affichent correctement pour les 3 cartes.
3. Placement d'une tour (tap tray → tap case) : or déduit, tour visible, coût correct.
4. Lancement de vague, ennemis qui spawnent et avancent le long du chemin, tir de tour visible (ligne + impact), or gagné au kill, HUD mis à jour en temps réel.
5. Arbre de compétences : octroi d'Essence via sauvegarde, déblocage d'un nœud tier 1, vérification que le nœud tier 2 correspondant devient alors disponible (prérequis respecté visuellement, pas seulement en test unitaire).
6. Écran Réglages, overlay Pause (Reprendre/Abandonner).
7. Aucune erreur JavaScript console sur l'ensemble du parcours (`page.on('pageerror')` et `console.error` surveillés).

### Ce qui n'a *pas* été testé manuellement (limite assumée)
- **Un run complet jusqu'à la défaite** n'a pas été observé en navigateur (seulement simulé numériquement, §voir `docs/ECONOMY_SIMULATION.md`) — l'écran de résumé de run (`runSummary`) et le flux "Rejouer" n'ont donc été vérifiés que par lecture de code + tests unitaires des fonctions qu'ils appellent (`essenceEarned`, `SaveManager.recordRun`), pas par observation visuelle de bout en bout. Risque faible (code simple, chemin déjà exercé indirectement) mais à couvrir en premier lors d'un prochain build/QA.
- Les capacités ultimes (Bastion / Nova / Volée) ne sont vérifiées que par leur logique (`GameState.activateUltimate`), pas observées visuellement en combat réel.
- Test uniquement sur viewport mobile simulé (390×844) dans un navigateur headless — pas de test sur device physique iOS/Android réel (latence tactile, comportement clavier virtuel, Safari spécifiquement).
- Pas de test de performance sous charge (beaucoup de tours + beaucoup d'ennemis simultanés) — le moteur est simple (pas de object pooling, listes recréées par frame) ; probablement suffisant pour l'échelle visée (6 tours, quelques dizaines d'ennemis) mais non mesuré au FPS.

## 3. Risques et dette connus

| Risque | Sévérité | Détail |
|---|---|---|
| Économie sans sink en fin de run | Faible | Or inutilisé après ~vague 15-20 (voir `docs/ECONOMY_SIMULATION.md`) — n'affecte pas la difficulté, juste l'intérêt de la dernière partie de run |
| Pas de test de run complet en navigateur | Faible | Voir §2 ci-dessus — chemin de code simple, couvert unitairement |
| `class_switched` non câblé | Négligeable | Événement de tracking défini mais jamais émis (voir `docs/TRACKING_PLAN.md`) |
| Pas de test sur device réel | Moyen | Le confort tactile réel (taille des zones de tap, absence de zoom accidentel) n'est validé que par simulation de viewport, pas par un doigt humain sur un vrai écran |
| Équilibrage Mage/Rôdeur non différencié dans la simulation | Faible | Limite du modèle de simulation documentée dans `docs/ECONOMY_SIMULATION.md`, pas du jeu réel |

## 4. Recommandation

Le jeu est dans un état **jouable et cohérent avec le brief** pour un one-shot : les mécaniques cœur (placement, combat, économie, classes, arbre de compétences, sauvegarde locale) sont implémentées, testées et vérifiées en navigateur. La prochaine étape naturelle avant tout palier P0 serait un **playtest humain court** (5-10 parties par une vraie personne, sur téléphone) pour confirmer que la difficulté ressentie correspond à la simulation, et pour trancher les points listés en roadmap dans `docs/DECISIONS.md` §13 (sink économique, 4ᵉ classe, etc.) à la lumière d'un usage réel plutôt qu'en devinant.
