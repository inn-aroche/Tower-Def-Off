# WARDENS — Design tokens (source de vérité)

Importé depuis Claude Design le 2026-07-19 :
https://claude.ai/design/p/a7a8c58b-89b2-4733-a020-c9e1097ae01e?file=Game+Screens.dc.html

Fichiers bruts conservés dans ce dossier : `Game Screens.dc.html` (Hub, Collection,
Boutique, Amélioration, Résultats) et `Combat Screen.dc.html` (plateau PvP).
Ce sont des maquettes de référence visuelle (canvas Claude Design), pas du code
à exécuter dans le jeu — `ios-frame.jsx`/`support.js` sont l'outillage du canvas
de design, non repris dans le projet. Chaque écran implémenté (M2+) doit être
confronté à ces fichiers avant validation.

## Couleurs

| Rôle | Valeur |
|---|---|
| Fond crème (menus) | `#efe8d6` / `#efe6cd` |
| Fond ciel hub (dégradé) | `#a7d8f0` → `#cfe9dd` → `#e8dba8` → `#c9a15f` |
| Panneau carte (beige clair) | `linear-gradient(160deg,#fdf6e3,#f0e2b8)` bord `#c9a15f` |
| Nav basse / headers bruns | `linear-gradient(180deg,#3a2a1c,#2b1e14)` |
| CTA vert (Jouer / Continuer) | `linear-gradient(180deg,#8ee06a,#4caf50)` bord-bas `#2e7d32` |
| Or (pièces) | `radial-gradient(circle at 32% 28%,#fbe08a,#e8b923 55%,#a9780f 100%)` texte `#5c3d0a` |
| Gemmes (violet premium) | `linear-gradient(135deg,#e8c6fb,#9b59b6 60%,#6c3483)` losange, texte blanc |
| Passe héroïque / premium | `linear-gradient(135deg,#8e44ad,#5e3370)` |
| Plateau combat (zone verte joueur) | `#4a6b3a` → `#2f4a2f`, tuiles `#dff0c4`/`#c9e0a8`/`#bcd898` |
| Chemin ennemi (tuile) | `#f2d98d` / `#d8c98a` |
| Barre mana | fond `#1f1610`, remplissage `linear-gradient(90deg,#9b59b6,#c39bd3)` |
| Rareté commune | `linear-gradient(160deg,#8ecae6,#4a90c4)` bord `#2f6690` |
| Rareté rare | `linear-gradient(160deg,#82e07a,#4caf50)` bord `#2e7d32` |
| Rareté épique | `linear-gradient(160deg,#d9b3f0,#9b59b6)` bord `#6c3483` |
| Rareté légendaire | `linear-gradient(160deg,#ffb347,#ff6b35)` bord `#b23c17` |

## Typographie

- Titres / chiffres / boutons : **Baloo 2** (600-800), rond et amical.
- Corps / labels : **Nunito** (400-800).

## Formes par famille d'unité (pictogramme géométrique)

- Mêlée → cercle plein.
- Distance → triangle.
- Sort / soutien → losange (carré tourné 45°).
- Bâtiment/structure → carré coins arrondis, non tourné.
- (WARDENS ajoute) Gravité → sera un anneau/spirale à définir en M3, distinct des 4 formes ci-dessus.

## Composants récurrents

- Bouton CTA 3D : fond dégradé + bordure basse épaisse (4-6px, couleur foncée) + `inset 0 2-3px 0 rgba(255,255,255,.5)` (highlight du haut) → effet « enfoncement » au tap en réduisant l'épaisseur de bordure et translatant le contenu de quelques px.
  On simule cela via un état `:active`/`pressed` = pas de logique interne à l'artefact, à implémenter en CSS/DOM (M2+) ou canvas.
- Tuile unité collection : radius 12px, bordure basse 5px (couleur de rareté), badge niveau blanc en haut-droite `Lv{n}`.
  radius 16-20px pour les panneaux carte.
- Nav basse (3 items) : fond brun foncé, item central surélevé (bouton rond doré qui dépasse la barre de ~18px).
- Mana/XP : barre à fond sombre, remplissage dégradé, valeur centrée `x / 10` ou `x%`.

## Grille de combat (Combat Screen.dc.html)

La maquette simplifie à 6×6 par moitié (opposant en haut, joueur en bas) pour la
lisibilité visuelle. **Le brief de jeu (source de vérité gameplay) fixe la grille
réelle à 6 colonnes × 8 lignes côté joueur** — ne pas redécider, la maquette
n'est qu'une preview de style, pas la spec dimensionnelle.

## Statut d'implémentation

- M1 (boucle de combat) : art placeholder volontaire (formes/couleurs plates), pas de conformité pixel à ces maquettes — cf. verrou Phase 2 du skill studio-jeu-mobile ("Fun sans méta", pas de DA).
- M2+ : chaque écran doit être confronté à ce dossier avant validation (juice, DA, tokens ci-dessus).
