# Runeforge Defense — Game Design Document

**Palier :** P-1 (solo, local-first, aucun serveur, aucune monétisation)
**Plateforme cible :** Web mobile (portrait), jouable au pouce
**Session :** 5–15 minutes
**Statut :** MVP jouable (voir `docs/AUDIT.md`)

---

## 1. Pitch

Un tower defense mobile classique en surface — mais avant chaque partie, le joueur choisit une **classe façon Diablo II** (Guerrier, Arcaniste, Rôdeur), et fait progresser un **arbre de compétences persistant** propre à cette classe entre les runs. Le placement de tours reste simple et lisible ; la profondeur vient de la construction du personnage, pas de la complexité tactique instantanée — ce qui convient à des sessions courtes, au pouce, sans setup.

## 2. Le twist en détail

- Au premier lancement, le joueur choisit une classe. Ce choix définit :
  - un **passif permanent** (actif dans toutes les parties jouées avec cette classe),
  - une **capacité ultime** unique (bouton dédié, cooldown, un tap = un pouce),
  - un **arbre de compétences propre à la classe** (3 branches × 4 paliers).
- L'**Essence** (monnaie méta, persistante) se gagne à la fin de chaque run, qu'il soit gagné ou perdu, proportionnellement aux vagues survécues. Elle sert à débloquer des nœuds dans l'arbre de la classe active.
- Le joueur peut changer de classe à tout moment depuis le menu (`Changer de classe`) — l'Essence est un pool **partagé**, mais chaque classe conserve son **propre arbre débloqué** : on peut donc essayer les trois classes, mais se spécialiser dans celle qu'on préfère, exactement comme on investit dans un build de personnage plutôt que dans un autre.
- Ce système permet de « progresser plus vite » (l'arbre rend chaque run plus fort) tout en étant personnalisable (le choix de la classe de départ oriente tout l'arbre disponible).

## 3. Boucle de jeu

1. **Hub** : le joueur voit sa classe active, son Essence, sa meilleure vague.
2. **Sélection de carte** : 3 cartes au tracé fixe, toutes débloquées d'emblée (pas de progression à rallonge avant de pouvoir jouer — palier P-1 minimaliste).
3. **Run** : vagues d'ennemis illimitées et croissantes en difficulté (mode « combien de vagues tiendrez-vous ? »). Le joueur place des tours, les améliore, déclenche son ultime, et lance manuellement chaque vague (`Lancer la vague`) quand il est prêt.
4. **Défaite** (PV du Donjon à 0) : écran de résumé (vagues survécues, kills, Essence gagnée). L'Essence gagnée est **toujours conservée**, qu'importe la performance.
5. **Retour au Hub** : dépenser l'Essence dans l'arbre de compétences, ou relancer immédiatement une partie.

Il n'y a pas de campagne à niveaux : le format « run sans fin, meta-progression entre les runs » est délibérément choisi pour coller à des sessions de 5–15 minutes et à la référence Diablo II (on rejoue son personnage, on ne « termine » pas un niveau one-shot).

## 4. Contrôle au pouce (one-thumb)

- Aucune tenue à deux mains requise, aucun geste multi-touch nécessaire au cœur du jeu.
- Placer une tour : tap sur une icône du plateau de tours (en bas) puis tap sur une case constructible.
- Améliorer / vendre une tour : tap sur une tour posée → popup à deux gros boutons.
- Déclencher l'ultime : un bouton rond unique, toujours au même endroit (bas droite de la zone d'action).
- Lancer une vague : un bouton pleine largeur, jamais minuscule.
- Aucun scroll horizontal en jeu ; le plateau est dimensionné pour tenir sur un écran de téléphone en portrait.

## 5. Interdit respecté : pas de die & retry punitif

- **Pas de mort permanente de la progression.** Perdre un run ne fait perdre ni l'Essence gagnée pendant ce run, ni l'arbre de compétences déjà débloqué.
- **Relance instantanée** : le bouton "Rejouer" de l'écran de résumé ramène directement à la sélection de carte, sans pénalité de temps.
- **Rythme choisi par le joueur** : les vagues ne démarrent jamais automatiquement sur un minuteur — c'est toujours un tap explicite du joueur (`Lancer la vague`) qui déclenche la suivante. Le joueur a autant de temps qu'il veut pour observer son économie et planifier.
- **Régénération passive du Donjon** : +5 % des PV max entre chaque vague (davantage avec l'arbre Guerrier), pour éviter la spirale de la mort sans retour possible.
- **Remboursement de vente généreux** (80 % investi) : une erreur de placement de tour n'est jamais une perte sèche.
- **Difficulté progressive et lisible**, jamais un pic soudain injuste (voir `docs/ECONOMY_SIMULATION.md` pour la validation empirique de la courbe).

## 6. Classes

### 🛡️ Guerrier — *Rempart*
- **Passif :** PV max du Donjon +30 %.
- **Ultime — Bastion :** le Donjon devient invulnérable 6 s (cooldown 45 s).
- **Branches :** Fortification (PV/régén/réduction de dégâts), Discipline (économie), Valeur (puissance de l'ultime).

### 🔮 Arcaniste — *Flux élémentaire*
- **Passif :** Dégâts des tours Givre/Arcane +15 %.
- **Ultime — Nova Arcanique :** dégâts de zone à tous les ennemis visibles + gel 2 s (cooldown 40 s).
- **Branches :** Flux Arcanique (dégâts/contrôle élémentaires), Sagesse (économie), Puissance (puissance de l'ultime).

### 🏹 Rôdeur — *Œil de lynx*
- **Passif :** +15 % critique (x2 dégâts) sur toutes les tours, +1 or par kill.
- **Ultime — Volée de flèches :** toutes les tours tirent une salve gratuite renforcée (cooldown 35 s).
- **Branches :** Précision (critique), Fortune (économie), Instinct (puissance de l'ultime).

Chaque branche a 4 paliers, coût en Essence 1/2/3/5 (11 par branche, 33 pour débloquer tout l'arbre d'une classe). Le détail exact des nœuds est dans `src/data/classes.ts` (source de vérité — ce document résume l'intention, le code fait foi sur les chiffres).

## 7. Tours (communes aux 3 classes)

| Tour | Rôle | Spécificité |
|---|---|---|
| 🏹 Flèche | Dégâts fiables, cadence rapide | Tier 3 : perce 1 cible supplémentaire |
| 💣 Canon | Dégâts de zone | Tier 3 : rayon de zone augmenté |
| ❄️ Givre | Contrôle (ralentit) | Tier 3 : pulsation de zone périodique autour de la tour |
| 🔮 Arcane | Dégâts en chaîne | Tier 3 : touche jusqu'à 4 cibles en chaîne |

3 tiers par tour, coût croissant, revente à 80 % de l'investi total.

## 8. Ennemis

| Ennemi | Profil | Apparaît dès |
|---|---|---|
| 👹 Maraudeur | Standard | Vague 1 |
| 🦇 Furtif | Rapide, peu de PV | Vague 2 |
| 🗿 Colosse | Lent, très résistant | Vague 4 |
| 👑 Seigneur de Guerre (boss) | Très résistant, gros dégâts au Donjon | Toutes les 5 vagues |

Les PV et récompenses en or croissent avec le numéro de vague (voir `src/data/enemies.ts` et `docs/ECONOMY_SIMULATION.md`).

## 9. Cartes

3 cartes au tracé fixe et distinct (« Sentier Sinueux », « Chemin en Z », « Chemin Serpentin »), toutes disponibles dès le début. Aucune carte à débloquer : à ce palier, la variabilité vient de la classe et de l'arbre, pas d'un grind de cartes.

## 10. Ce qui est explicitement hors scope (P-1)

- Pas de compte, pas de cloud save, pas de classement en ligne.
- Pas de publicité, pas d'achat in-app, pas de SDK plateforme (Poki/CrazyGames) — voir `docs/DECISIONS.md` pour la feuille de route.
- Pas de 4ᵉ classe, pas de tours exclusives par classe, pas de PvP/coop.
- Pas de campagne à niveaux verrouillés.

Ces coupes sont volontaires pour tenir un one-shot livrable et testable ; elles sont candidates naturelles pour un palier P0.
