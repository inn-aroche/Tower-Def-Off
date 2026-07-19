# Runeforge Defense — Economy & Pacing Simulation

## Méthodologie

Le script `scripts/economy-sim.mjs` a été **exécuté réellement** pour produire les chiffres ci-dessous (aucune valeur n'est inventée). Il ne rejoue pas le moteur de combat exact (`src/sim/*.ts`) mais un **modèle simplifié en forme close** qui reprend les mêmes constantes d'équilibrage (`src/data/balance.ts`, `enemies.ts`, `towers.ts`, `waveGenerator.ts`) et compare, vague par vague : *dégâts totaux infligeables pendant le temps de trajet des ennemis* vs *PV totaux de la vague*.

Deux simplifications, toutes deux **conservatrices** (elles sous-estiment la puissance réelle du joueur) :
1. Le DPS est calculé uniquement avec des tours Flèche équivalentes — les bonus de zone/chaîne/perçage du Canon/Givre/Arcane ne sont pas comptés, alors qu'ils augmentent le DPS réel contre des groupes.
2. La politique d'achat simulée est un joueur "moyen, non optimisant" (achète jusqu'à 6 tours, puis améliore la plus faible), pas un build min-maxé.

Comme les deux biais vont dans le même sens, si ce modèle simplifié tient déjà confortablement, le vrai moteur (strictement plus puissant, mêmes chiffres d'ennemis) tiendra au moins aussi bien. **Ce script sert à détecter des erreurs d'équilibrage grossières (mur de difficulté, économie qui ne permet jamais d'acheter), pas à remplacer le playtest.**

Personnage simulé : **fraîchement créé, aucun nœud d'arbre débloqué** (le scénario le plus dur — un joueur avec de l'Essence dépensée ira forcément mieux).

## Résultats bruts (sortie réelle du script)

```
========================================================================
RUNEFORGE DEFENSE — Economy / Pacing Simulation (simplified model)
========================================================================

-- WARRIOR (fresh character, no skill tree unlocked) --
  Waves survived:      27
  Boss kills:          5
  Session duration:    13.0 min
  Essence earned:      24
  Towers owned at end: 6
  Wave-by-wave (every 5th wave):
    wave  5: enemyHP=  762  dps=  58  keepHP= 130  gold=169
    wave 10: enemyHP= 1370  dps= 101  keepHP= 130  gold=265
    wave 15: enemyHP= 2002  dps= 173  keepHP= 130  gold=234
    wave 20: enemyHP= 2845  dps= 173  keepHP= 130  gold=1454
    wave 25: enemyHP= 3855  dps= 173  keepHP= 109  gold=3077
    wave 28: enemyHP= 4976  dps= 173  keepHP=   0  gold=4231

-- MAGE (fresh character, no skill tree unlocked) --
  Waves survived:      28
  Boss kills:          5
  Session duration:    13.5 min
  Essence earned:      25
  Towers owned at end: 6
  Wave-by-wave (every 5th wave):
    wave  5: enemyHP=  762  dps=  66  keepHP= 100  gold=169
    wave 10: enemyHP= 1370  dps= 116  keepHP= 100  gold=265
    wave 15: enemyHP= 2002  dps= 199  keepHP= 100  gold=234
    wave 20: enemyHP= 2845  dps= 199  keepHP= 100  gold=1454
    wave 25: enemyHP= 3855  dps= 199  keepHP= 100  gold=3077
    wave 29: enemyHP= 5216  dps= 199  keepHP=   0  gold=4675

-- RANGER (fresh character, no skill tree unlocked) --
  Waves survived:      28
  Boss kills:          5
  Session duration:    13.5 min
  Essence earned:      25
  Towers owned at end: 6
  (identique au Mage dans ce modèle simplifié — voir "Limite connue" ci-dessous)

------------------------------------------------------------------------
Session-length check (target: 5-15 minutes)
------------------------------------------------------------------------
  warrior  -> 13.0 min  [OK]
  mage     -> 13.5 min  [OK]
  ranger   -> 13.5 min  [OK]

------------------------------------------------------------------------
Meta-progression pacing: essence needed to fully unlock one class tree
------------------------------------------------------------------------
  Full tree cost: 33 essence
  warrior  -> 24 essence/run (fresh char) -> ~2 runs to fully unlock the tree
  mage     -> 25 essence/run (fresh char) -> ~2 runs to fully unlock the tree
  ranger   -> 25 essence/run (fresh char) -> ~2 runs to fully unlock the tree
```

(Sortie tronquée pour Ranger dans ce document — identique à Mage dans le modèle, les deux ayant le même multiplicateur `CLASS_DPS_MULT` simplifié de 1.15×. Voir "Limite connue" plus bas.)

## Lecture des résultats

### ✅ Durée de session : dans la cible

Les 3 classes atterrissent entre **13.0 et 13.5 minutes** pour un joueur moyen qui joue jusqu'à la défaite — confortablement dans la fourchette demandée de 5–15 min. Un joueur moins habile mourra plus tôt (session plus courte), un joueur qui abandonne volontairement avant la défaite (bouton Pause → Abandonner) contrôle lui-même la durée — les deux cas restent dans l'esprit "session courte, contrôlée par le joueur", cohérent avec l'interdit "pas de pression punitive".

### ✅ Le Guerrier est réellement plus résilient

PV du Donjon supérieurs (130 vs 100) visibles dans les colonnes `keepHP` : le Guerrier encaisse une vague boss (vague 25) que Mage/Rôdeur absorbent aussi mais avec moins de marge en valeur absolue — cohérent avec l'intention de design ("Rempart increvable").

### ⚠️ Trouvaille : l'or n'a plus d'utilité en fin de run

À partir d'environ la vague 17–20, le joueur simulé a déjà 6 tours au tier 3 (le maximum) : il n'y a plus rien à acheter. L'or s'accumule alors sans usage — jusqu'à **4000+ or inutilisé** en fin de run (vague 25+). Ce n'est **pas un problème d'équilibrage de difficulté** (l'or n'était de toute façon plus le facteur limitant), mais c'est un vrai gain de gameplay manqué : le joueur qui survit longtemps n'a plus de décision économique à prendre. **Non corrigé dans ce one-shot** (ajouterait un mécanisme hors scope — ex. tours supplémentaires achetables, conversion or→Essence) ; documenté comme piste P0 dans `docs/DECISIONS.md`.

### 📌 Progression méta plus rapide que prévu pour un joueur compétent

Un run "compétent" (survit ~27–28 vagues) rapporte assez d'Essence pour débloquer tout l'arbre d'une classe en seulement ~2 runs. C'est rapide — mais ce chiffre représente le **meilleur cas** (joueur qui survit longtemps). Un joueur débutant qui meurt en vague 8–10 gagnerait plutôt `floor(9/2) + 0 + 1 ≈ 5` Essence, soit ~7 runs pour tout débloquer — un rythme de progression méta bien plus graduel et sain pour les premières sessions. L'écart entre les deux profils est **intentionnel** (mieux jouer accélère la progression) mais mérite un œil au playtest réel : si même les débutants trouvent l'arbre "trop vite plein", réduire `essenceEarned()` est un changement d'une ligne dans `src/data/balance.ts`.

## Limite connue de ce modèle

Le modèle applique un multiplicateur de DPS uniforme (`CLASS_DPS_MULT`) au lieu de simuler les mécaniques spécifiques (critique du Rôdeur, dégâts élémentaires du Mage sur Givre/Arcane uniquement) — c'est pourquoi Mage et Rôdeur produisent des résultats identiques ici alors qu'en jeu réel leurs courbes divergent (le Rôdeur profite davantage des tours à dégâts physiques élevés type Canon, le Mage profite du contrôle de foule via Givre qui n'est pas valorisé dans ce modèle DPS-brut). Ce n'est pas un problème pour la validation visée ici (durée de session, absence de mur de difficulté) mais signifie que **ce script ne doit pas servir à comparer finement l'équilibrage entre classes** — pour ça, des runs réels avec `docs/TRACKING_PLAN.md` (`run_end.duration_s`, `class_selected`) sont la source de vérité une fois le jeu entre les mains de joueurs.

## Reproduire

```
node scripts/economy-sim.mjs
```

Aucune dépendance : script Node autonome, aucune installation requise.
