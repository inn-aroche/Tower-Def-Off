# Runeforge Defense — Art Bible

Direction artistique demandée : **façon Clash Royale**. Traduction pour un rendu 100 % vectoriel (canvas 2D + DOM), sans aucun asset image externe — un choix délibéré pour un one-shot autonome (voir `docs/DECISIONS.md`).

## 1. Principes

1. **Silhouettes lisibles au premier coup d'œil.** Chaque tour, ennemi et élément d'UI doit se reconnaître à sa forme + sa couleur, même en mouvement, même petit (contrainte mobile).
2. **Contour sombre épais partout** (`--ink #24303c`, 2–3.5px selon la taille de l'élément). C'est LA signature visuelle Clash Royale : tout objet a un cerne foncé qui le détache du fond, jamais de forme "flottante" sans contour.
3. **Couleurs saturées, pas de dégradés subtils.** Le fond peut avoir un léger gradient (ciel), mais les objets de gameplay (tours, ennemis, Donjon) sont en aplat de couleur franche + contour, jamais en dégradé complexe : lisibilité avant tout, y compris à 60px sur un écran de 5 pouces.
4. **UI "bois et or"** : panneaux en dégradé bois (`--wood-light → --wood-dark`), accents or (`--gold`), texte crème (`--cream`). Boutons chunky, coins très arrondis, ombre portée basse épaisse simulant un bouton "pressable" en 3D (bevel bottom-border), qui s'enfonce visuellement au tap (`:active { translateY(3px) }`).
5. **Emoji comme iconographie**, pas de sprite dessiné à la main. Choix pragmatique et cohérent : rendu net sur toutes les plateformes mobiles (police emoji native), zéro poids d'asset, zéro pipeline d'import. Toujours à taille généreuse (jamais < 20px) pour rester lisible.

## 2. Palette (source de vérité : `src/render/theme.ts` + `src/style.css`)

| Rôle | Variable | Hex |
|---|---|---|
| Ciel (haut) | `skyTop` | `#3a4d63` |
| Ciel (bas) | `skyBottom` | `#24313f` |
| Herbe A / B | `grassA` / `grassB` | `#6fbf5e` / `#63ad53` |
| Chemin A / B | `pathA` / `pathB` | `#c9975a` / `#bd8a4d` |
| Contour chemin | `pathOutline` | `#5b3a22` |
| Contour universel | `outlineDark` / `--ink` | `#1f2733` / `#24303c` |
| Or (Donjon, accents) | `keepGold` / `--gold` | `#ffd166` |
| Or foncé | `keepGoldDark` / `--gold-dark` | `#c99a2e` |
| Portail d'invocation | `spawnPurple` | `#7c5cff` |
| PV haut / moyen / bas | `hpGreen` / `hpYellow` / `hpRed` | `#59c46a` / `#f4c14e` / `#e15b5b` |
| Fond de barre de PV | `hpTrack` | `#1a222c` |
| Texte critique | `critText` | `#ff8a3d` |
| Bois clair / foncé (UI) | `--wood-light` / `--wood-dark` | `#9a6a3f` / `#6b4423` |
| Crème (texte) | `--cream` | `#fdf3e0` |

Couleurs par tour (identité visuelle) :
- 🏹 Flèche — `#5bc8f5` (bleu ciel, précision)
- 💣 Canon — `#ff8a3d` (orange, impact)
- ❄️ Givre — `#7fe7e0` (cyan glacé)
- 🔮 Arcane — `#c58cff` (violet, magie)

Couleurs par classe :
- 🛡️ Guerrier — `#5b8def` (bleu acier)
- 🔮 Arcaniste — `#a875ff` (violet)
- 🏹 Rôdeur — `#ffb545` (orange doré)

## 3. Langage de forme

- **Tours** : cercle plein + icône emoji centrée + pastilles dorées sous la tour indiquant le tier (1 à 3 pastilles).
- **Ennemis** : cercle (boss : 1.5× plus grand, contour plus épais) + icône emoji + barre de PV flottante au-dessus, code couleur vert/jaune/rouge selon le pourcentage de vie restant.
- **Donjon** : carré à coins arrondis, doré, couronne 👑 centrée. Passe au bleu glacé (`#8fd6ff`) quand le bouclier (ultime Guerrier) est actif — signal de statut immédiat, pas besoin de lire un texte.
- **Portail d'invocation** : cercle violet uni en haut du chemin — pas d'animation complexe, juste une teinte distincte du reste du plateau pour que l'œil identifie immédiatement "c'est ici que ça spawn".
- **Grille** : damier à deux tons (herbe / chemin), sans texture, pour un rendu net à n'importe quelle résolution d'écran.

## 4. Effets visuels (juice)

- **Tir** : trait fin coloré tour→cible + point d'impact, durée 0.18s, fondu linéaire.
- **Critique** : même effet, en orange vif (`critText`) et plus épais — doit se voir même en jeu rapide.
- **Zone (canon / nova givre)** : anneau qui s'étend et s'estompe, 0.35s.
- **Chaîne (arcane)** : segments reliant chaque cible touchée, dans la couleur de la tour.

Toujours des effets courts (< 400ms) et non bloquants : le rythme du jeu ne doit jamais être ralenti par une animation, cohérent avec l'interdit "pas de frustration".

## 5. UI / Layout

- **Boutons primaires** : dégradé or, texte foncé, ombre basse épaisse. Réservés aux actions principales (Jouer, Confirmer, Lancer la vague).
- **Boutons secondaires** : dégradé bois, texte crème. Actions de navigation (Retour, Réglages).
- **Boutons de danger** : dégradé rouge. Vente de tour, réinitialisation de sauvegarde — signalent une action à conséquence.
- **Cartes de sélection** (classe / carte) : fond semi-transparent sombre, contour or si sélectionné.
- **Arbre de compétences** : nœuds en 3 colonnes (branches), état visuel à 3 niveaux — verrouillé (grisé), disponible (contour or), débloqué (rempli or).
- Tout élément interactif fait **au minimum 48×48px** de zone tactile, conformément à la cible "un pouce".

## 6. Ce que cette DA n'est pas

- Pas de skeuomorphisme poussé (pas de bois texturé photoréaliste, pas d'ombres portées complexes façon Clash Royale AAA) — le budget est un rendu 100 % vectoriel canvas/CSS, pas des illustrations peintes. L'intention Clash Royale est portée par la palette, les contours épais, et les proportions "chunky", pas par le niveau de détail pictural.
- Pas d'animations de personnages articulées : les ennemis/tours sont des formes géométriques statiques + icône, pas des sprites animés image par image.
