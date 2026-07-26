# WARDENS — Journal de décisions

Studio-jeu-mobile, mode pipeline. Une entrée par mission : brief PM → critères PO →
implémentation → test → verrou. Rien n'est retuné sans re-simulation (`npm run simulate`).

---

## 2026-07-19 — Reset du repo (pré-M1)

Le repo (branche `claude/wardens-tower-defense-1z763v`) contenait déjà 24 commits d'un projet
nommé **polymaze-td** : un tower defense labyrinthe classique (une tour = un emplacement fixe,
un seul chemin, pas de merge, pas de deck) — sans rapport avec le brief WARDENS actuel. Décision
validée avec l'utilisateur : repartir de zéro. `src/`, `tests/`, `scripts/` de l'ancien jeu ont
été supprimés et reconstruits selon l'architecture sim/render/data/platform du skill
studio-jeu-mobile. `package.json` renommé `wardens`, dépendance `three` retirée (rendu Canvas 2D
suffit à la maquette et à l'étape placeholder).

---

## Phase 1 — Concept — verrou

Checklist `references/quality-gates.md` :

- [x] **Promesse en une phrase** : « Un tower defense à fusion où tu domptes la gravité pour
      dévier des hordes, sur un plateau généreux qui pardonne l'expérimentation. »
- [x] **Genre / cible / session** : tower defense mobile à merge (type Rush Royale), F2P,
      cible joueurs de stratégie casual 25-45 ans, sessions 3-6 min (une vague PvE ou un combat
      PvP), portrait only.
- [x] **Core loop en 4 temps** : invoquer (mana croissant, unité aléatoire du deck) → défendre
      (les unités posées tirent automatiquement sur les ennemis qui descendent) → fusionner
      (2 unités identiques même niveau → dilemme puissance vs surface de plateau) → récompense/
      relance (victoire = or/doublons/coffre, jauge de progression saga ou trophées de ligue).
- [x] **3 comparables analysés** (`references/benchmarks.md` + connaissance du genre) :
  - *Rush Royale* — grille + merge + deck ; on reprend la boucle et l'économie de mana
    croissante ; on diffère sur l'exécution (plus généreuse : pas de wall units frustrants,
    fusion sans adjacence stricte) et sur le différenciateur gravité.
  - *Clash Royale* — mana continue x/10, decks courts, ligues PvP ; on reprend la jauge et le
    framing PvP ; on diffère radicalement sur le netcode (bots calibrés en v1, jamais de temps
    réel synchrone — palier P-2, cf. plus bas) et sur le placement libre (grille pleine, pas de
    couloir).
  - *Bloons TD / TD classiques* — placement + vagues PvE ; on reprend la lisibilité de la
    défense de base ; on diffère sur l'absence de vente/déplacement de tour (le seul levier de
    puissance est la fusion, pas l'achat direct d'upgrades en combat).
- [x] **Différenciateur nommé** : la famille **gravité** — aucune unité de dégâts direct, elle
      ralentit/regroupe les ennemis (champ de zone cross-lane), créant des synergies avec les
      familles de dégâts (fenêtres de tir prolongées) qu'aucun concurrent direct n'exploite
      comme pilier de deck-building.
- [x] **Hypothèse de monétisation** : hybride passe héroïque mensuel + gemmes + coffres
      (contenu affiché, prix honnêtes) + rewarded opt-in (coffre bonus post-victoire,
      accélération de recherche) ; **zéro interstitiel en v1**, zéro énergie. Hooks
      `NullProvider` dès M1 (voir `src/platform`), intégration réelle en M5.
- [x] **Coût de contenu estimé compatible studio** : M1-M2 sont mono-mode (PvE, moteur seul) ;
      M3 introduit 12 unités (pas 40+) ; M4 réutilise le même moteur de sim pour les bots PvP
      (pas de netcode à écrire) — volume de contenu initial délibérément resserré.

**Verrou Phase 1 : 🟢 vert.** Aucune redécision needed — le brief fourni couvre déjà tous les
items ; cette entrée les documente pour traçabilité.

### Palier d'architecture — P-2 (statué, non redécidé)

PvP = bots calibrés par ligue en v1 (même moteur de sim joue les deux côtés, aucun netcode) ;
asynchrone serveur-autoritaire en v2 (hors scope actuel). Classification : **P-2 social
asynchrone** par anticipation de la v2 (état de ligue/trophées qui vivra en base), mais
**dérisqué en mode P-1** pour M1-M4 (toute la sim tourne en local, bots = data, pas de serveur).
Chemin de dérisquage recommandé par `references/paliers-backend.md` appliqué à la lettre.

Chantiers du palier, chiffrés (S/M/L) :

| Chantier | Taille | Statut |
|---|---|---|
| Sim déterministe (RNG seedée, timestep fixe) réutilisable serveur plus tard | S | ✅ fait en M1 |
| Bots scriptés par ligue (agressivité, qualité de merge, deck) en `data/` | M | prévu M4 |
| Simulation d'équilibrage bots-vs-bots (win rate par famille 50±7%) | M | prévu M4 (script M1 pose déjà le harnais) |
| Auth Supabase anonyme + tables ligue/trophées server-authoritative | M | prévu v2, hors périmètre M1-M6 |
| Edge Functions validant les résultats de combat (anti-triche P-2) | M | prévu v2 |
| ADR palier P-2 complet (schéma, coût/1000 DAU) | S | à produire avant M4 (verrou Phase 2 du skill pour ce palier) |

---

## M1 — Boucle de combat jouable

**Brief PM.** Livrer la core loop seule, jouable, art placeholder : grille, mana continue,
invocation aléatoire, fusion, vagues PvE simples, victoire/défaite. Objectif : *fun sans méta*
(verrou Phase 2 du skill), premier succès valorisant en moins de 60 s.

**Critères PO (acceptance).**
1. Grille 6×8 côté joueur, unités posées librement sur cases vides.
2. Mana continue affichée x/10, régénération continue ; invoquer coûte un mana croissant à
   chaque invocation (pression à fusionner plutôt qu'à spammer).
3. Invocation pose une unité aléatoire du deck au niveau 1.
4. Fusion de 2 unités identiques même niveau → niveau supérieur, une case libérée.
5. Au moins une unité de la famille gravité est jouable et son usage est trackable (KPI
   différenciateur).
6. Vagues PvE scriptées, victoire quand toutes les vagues sont vidées avec vie > 0, défaite
   quand vie ≤ 0.
7. Sim pure dans `src/sim` (déterministe, RNG seedée, zéro DOM), équilibrage 100% dans
   `src/data`, aucune constante de combat en dur dans le rendu.
8. Script headless de validation d'équilibrage exécutable (`npm run simulate`) — aucune campagne
   livrée sans passer par lui.
9. Tracking plan instrumenté dès ce stade : `combat_start`, `unit_summoned`, `unit_merged`,
   `gravity_unit_played`, `combat_end` (funnel + usage du différenciateur, pas seulement déclaré).
10. Sauvegarde locale versionnée (schema v1) qui persiste la progression de campagne.

**Implémentation.**
- `src/sim/{Rng,Grid,Economy,Wave,Combat,CombatSim}.ts` — moteur pur, aucune dépendance DOM.
  Ciblage : une unité de dégâts vise l'ennemi le plus avancé dans sa colonne et sa portée
  (fenêtre `[row-range, row]`) ; une unité gravité n'inflige aucun dégât, elle applique un
  ralentisseur de zone (colonnes ± `influenceCols`, lignes ± `rangeRows`) — pas de stacking,
  le ralentissement le plus fort l'emporte.
- `src/data/{economy,units,enemies,levels}.ts` — 4 unités de dégâts (Épéiste, Archère, Lancier,
  Catapulte) + 1 unité gravité (Puits de gravité), 4 types d'ennemis, 5 premiers niveaux de
  campagne (sur les 20 prévus en M3).
- `src/render/{BoardLayout,CombatRenderer}.ts` — art placeholder assumé (formes/couleurs
  plates par famille), pas de conformité pixel aux maquettes à ce stade (cf. verrou Phase 2 :
  *art placeholder*). `BoardLayout` est pure (testée unitairement) et partagée entre rendu et
  input pour ne jamais diverger.
- `src/platform/{types,LocalStorageSave,NullProviders}.ts` — Save réel (localStorage, enveloppe
  versionnée `schemaVersion`), Ads/IAP en `NullProvider` (jamais d'interstitiel, cf. règle
  studio), Analytics en sink mémoire + `console.debug` (backend réel plus tard).
- `src/main.ts` — boucle à timestep fixe (30 Hz, accumulateur plafonné), input tap-to-place /
  tap-tap-to-merge, progression de campagne sauvegardée à la victoire.
- Maquettes Claude Design importées et archivées dans `docs/design/` (`Game Screens.dc.html`,
  `Combat Screen.dc.html`, `design-tokens.md`) — source de vérité pour la conformité visuelle
  dès M2 ; non utilisées telles quelles en M1 (placeholder assumé).

**Tests.**
- 35 tests unitaires (`npm test`) : RNG déterministe, grille, économie (coût croissant + cap,
  régénération), planification de vagues, ciblage/dégâts/gravité, intégration `CombatSim`
  (invocation, fusion, victoire, défaite, déterminisme bit-à-bit à seed égal, arrêt propre une
  fois l'issue connue), et layout plateau (round-trip pixel↔case).
- `npm run typecheck` et `npm run build` verts.
- `npm run simulate` (40 seeds/niveau, joueur scripté déterministe — priorité à la colonne la
  moins défendue, lignes ≥2 pour ne pas gâcher la portée contre le bord haut, fusion gloutonne
  dès qu'une paire identique existe) :

  | Niveau | Win% | Vie moy. (victoire) | Durée moy. | Kills moy. |
  |---|---|---|---|---|
  | Premières Lueurs | 78% | 3.5 | 48.9s | 11.6 |
  | Sentier des Coureurs | 73% | 3.6 | 41.4s | 10.5 |
  | Marche des Brutes | 85% | 3.8 | 48.5s | 6.5 |
  | Convergence | 68% | 4.1 | 52.3s | 9.9 |
  | L'Ombre du Troll | 55% | 3.5 | 57.7s | 9.8 |

  Chaque niveau gagnable par un bot volontairement sous-optimal (placement heuristique simple,
  pas de ciblage de lane par rapport aux ennemis réels) ; tendance globale à la baisse du win
  rate en fin de campagne (courbe de difficulté cohérente). Un vrai joueur humain devrait
  largement dépasser ces chiffres — la marge est jugée saine pour un premier passage, à
  resurveiller au premier playtest externe (verrou Phase 2).
  Premier passage : le script a d'abord révélé 0% partout (coût de mana croissant trop agressif
  couplé à une portée mêlée de 1 case insuffisante pour tuer un gobelin avant qu'il ne sorte de
  la fenêtre de tir) — corrigé en retunant `economy.ts` (régén 0.5→1.2/s, coût base 3→2, cap
  9→7) et les portées mêlée (`swordsman`/`lancer` +1 case) avant de retunner les vagues 3-5
  (vie de départ relevée, quelques compteurs d'ennemis réduits, HP Troll 220→160, HP Brute
  60→50). Exactement le scénario que la discipline « aucun tuning sans re-simulation » est
  censée attraper.
- Vérification manuelle en navigateur (Playwright + build `preview`) : grille, HUD, invocation,
  déplacement des ennemis, dégâts, barre de mana et élimination confirmés visuellement sur
  `level-01` (aucune erreur console hors 404 favicon, inoffensif).

**Décision — verrou Mission 1 : 🟢 vert.**

Reste à faire pour M2 (« Écran de combat conforme à la maquette + juice ») :
- Remplacer l'art placeholder par les tokens de `docs/design/design-tokens.md` (formes/couleurs
  par famille et rareté, CTA 3D, pictogramme dédié à la famille gravité — actuellement un simple
  cercle teal, à distinguer visuellement des 4 formes de la maquette).
- Juice : impacts, feedback de fusion, SFX, haptics-ready (aucun de ces éléments n'existe
  encore — M1 est volontairement « feel first » sans polish).
- Le funnel FTUE (tutoriel guidé) n'existe pas encore — M1 suppose un joueur qui comprend déjà
  la mécanique ; à instrumenter/construire en M2-M3.
- 5+ playtests externes avec signal « encore une » (verrou Phase 2 du skill) restent à mener
  hors de cette session — condition pour valider définitivement Phase 2, pas seulement la
  mission M1.

---

## M2 — Écran de combat conforme à la maquette + refonte du modèle de jeu

**Contexte — retour de l'utilisateur sur l'aperçu M1.** Trois remarques : (1) « les ennemis
passent au-dessus des unités » ; (2) « je ne peux pas les choisir » ; (3) « ça ne ressemble pas
au wireframe ». Diagnostic : (1) était le modèle Rush Royale (unités = tireurs, pas des murs)
mais rendu illisible par l'art plat ; (2) et (3) touchaient des choix verrouillés du brief.
Deux décisions de design ont été tranchées **avec l'utilisateur** via question explicite — ce
sont des **déviations assumées du brief**, actées ici :

### Déviation 1 — invocation par choix de carte (remplace « unité aléatoire »)
Le brief verrouillait « l'invocation pose une unité ALÉATOIRE du deck ». L'utilisateur a choisi
**choisir la carte**. Corollaire cohérent (confirmé par les badges de coût 2/3/4/5 du wireframe) :
passage du modèle « mana croissant global » à un modèle **coût fixe par carte + mana continue**
façon Clash Royale. Conséquence design : le dilemme de fusion s'affaiblit (on peut forcer des
paires) mais le contrôle joueur augmente — arbitrage assumé. `economy.ts` ne porte plus le coût
d'invocation ; le coût vit sur chaque `UnitDef` (`cost`).

### Déviation 2 — chemin défini (remplace « descente en colonnes »)
Les ennemis suivent désormais un **tracé serpentant** 4-connecté (`src/sim/Path.ts`,
`CAMPAIGN_PATH` dans `levels.ts`) ; les unités se posent sur les cases **herbe** hors-chemin.
Le ciblage devient **spatial** (rayon euclidien en cases, `UnitLevelStats.range`) au lieu de
« même colonne ». Supprime totalement la superposition ennemi/unité et colle au wireframe.

**Implémentation.**
- Sim : `Path.ts` (interpolation le long des waypoints, test de 4-connexité, appartenance).
  `CombatSim` fait avancer les ennemis via `pathProgress`, applique la gravité en zone (rayon),
  cible spatialement, pose hors-chemin, paie le coût fixe de la carte. `summon(unitId, col, row)`
  (signature par carte). Rng conservé (utile M4 bots) mais la sim est désormais **déterministe**.
- Data : `units.ts` (cost + range par niveau), `levels.ts` (chemin partagé + vagues), `enemies.ts`
  (speed = cases/s le long du chemin), `economy.ts` (mana continue seule).
- Rendu (`CombatRenderer.ts` + `HudLayout.ts`) : header sombre (niveau, vague, timer, vies),
  plateau stylé avec ruban de chemin sableux + marqueurs spawn/base, unités avec pictogramme par
  famille (cercle mêlée / triangle distance / **anneau gravité** — la forme dédiée que les tokens
  réclamaient) et badge de niveau, ennemis dessinés en dernier **avec ombre portée** (lisibles
  au-dessus du terrain), barre de mana violette, **main de cartes tappable** avec badges de coût,
  état sélectionné et grisage si non abordable.
- Input (`main.ts`) : deux modes — sélectionner une carte puis poser sur une case herbe libre ;
  ou (sans carte) sélectionner une unité puis une seconde identique pour fusionner. `HudLayout`
  partagé rendu/hit-test.

**Tests & simulation.**
- 40 tests unitaires verts (`npm test`), dont `path.spec.ts` (connexité, interpolation, clamp)
  et la refonte de `combat.spec`/`combat-sim.spec` pour le ciblage spatial + invocation par carte.
- **Bug attrapé par la simulation** : les kills étaient double-comptés quand deux unités achevaient
  le même ennemi dans le même tick (58 kills sur un niveau qui n'en fait apparaître que 21). Corrigé
  (`this.kills += killedSet.size`) + test de non-régression ajouté. Exactement ce que le harnais est
  censé attraper.
- `npm run simulate` : la sim étant déterministe, on balaie désormais un **paramètre de skill**
  (intervalle d'action du joueur scripté, 8 échantillons de 0 à 2,8 s) et on reporte le win% sur ce
  balayage :

  | Niveau | Win% (balayage) | Vie moy. (victoire) | Durée moy. | Kills moy. |
  |---|---|---|---|---|
  | Premières Lueurs | 100% | 12.0 | 38.0s | 21.0 |
  | Sentier des Coureurs | 100% | 12.0 | 36.5s | 20.0 |
  | Marche des Brutes | 100% | 13.0 | 35.3s | 14.0 |
  | Convergence | 100% | 14.5 | 37.5s | 24.5 |
  | L'Ombre du Troll | 100% | 13.0 | 35.8s | 38.0 |

  Lecture honnête : tous les niveaux sont gagnables même par le joueur scripté **lent** — campagne
  actuellement **volontairement clémente** (approprié pour un début de saga sans dark pattern). Le
  boss (L5) fait déjà perdre de la vie (13/15). Pousser plus la difficulté ne ferait que des
  éponges à PV pour forcer un bot fort à perdre — hors sujet ici. **La vraie courbe de difficulté
  (20 nœuds, chemins par niveau, pacing) est un chantier M3** ; ce balayage sert de garde-fou de
  winnabilité, pas de calibrage final.
- Vérification navigateur (Playwright sur le build) : chemin serpentant, ennemis en file avec
  ombre au-dessus du terrain, sélection de carte, pose sur herbe, tir/dégâts (barres de PV rouges),
  mana — tous confirmés visuellement sur `level-01` (aucune erreur console hors 404 favicon).

**Décision — verrou Mission 2 : 🟡 partiel.** Le combat est jouable, lisible et fidèle à la
structure du wireframe ; les trois remarques utilisateur sont traitées. **Reste avant de clore
la Phase 3 (vertical slice) du skill :**
- **Juice** encore absent : impacts, feedback de fusion satisfaisant, screenshake dosé, SFX,
  haptics-ready (verrou Phase 3 « feedbacks juicy »).
- **Perspective 3D** du plateau (le wireframe a un `rotateX`) non reprise — plateau top-down
  stylé pour l'instant (hit-testing simple) ; à évaluer en polish.
- **FTUE / onboarding** guidé toujours à construire (verrou Phase 3 « onboarding qui fait jouer »).
- **Sprites** : toujours des formes géométriques placeholder, pas d'art final.
- **Courbe de difficulté** de la campagne à calibrer en M3 (cf. simulation ci-dessus).

---

## Tweak — Plateau allongé en 6×10

Sur retour utilisateur (« longueur de 10 »), le plateau passe de 6×8 à **6×10** (rangées 8→10,
léger écart assumé au « ~6×8 » du brief). Le chemin serpentant partagé est rallongé jusqu'à la
base sur la nouvelle rangée du bas. Re-simulé, tests/typecheck/build verts.

---

## M3 — Méta minimale (Fondation + Hub + Collection + Amélioration + Deck)

Choix utilisateur : commencer par « Fondation + M3 méta ». Livré : un shell de navigation, une
sauvegarde étendue et les 4 écrans méta clés, avec le combat intégré à la boucle.

### Décision d'architecture — écrans méta en DOM+CSS, combat en Canvas
Conforme au brief (« Canvas ou DOM+CSS pour les écrans méta, Canvas pour le plateau »). Un
`Router` (`src/app/Router.ts`) monte un écran à la fois dans `#app` ; les écrans méta construisent
du DOM stylé par des tokens CSS (`src/ui/theme.ts`, dérivés de `docs/design/design-tokens.md`),
le combat crée son canvas. Avantages : boutons/scroll/grilles natifs, fidélité aux maquettes,
combat inchangé. `main.ts` ne démarre plus sur le combat mais sur le Hub.

### Fondation
- **Sauvegarde v2 versionnée** (`meta/SaveData.ts`) : monnaies (or/gemmes), collection possédée
  (niveau méta + doublons par unité), deck actif, progression saga (nœud débloqué + étoiles),
  ligue (trophées, stub M4). **Migration v1→v2** testée (garde `soundOn`, mappe
  `currentLevelIndex`→`unlockedNode`, sème le starter).
- **AppState** (`app/AppState.ts`) : source de vérité unique, mutateurs qui persistent
  (addGold, upgrade, toggleDeck, recordVictory…). Les écrans lisent/écrivent via lui.

### Contenu (data)
- **12 unités** (`data/units.ts`) sur 3 familles (mêlée/distance/gravité) et 3 raretés
  (commune/rare/épique), dont **3 gravité** (Puits de gravité, Répulseur, Singularité).
- **Deux axes de puissance distincts** : le **merge en combat** (tiers Lv1→Lv3 temporaires, sur
  le plateau) et le **niveau méta permanent** (écran Amélioration, via doublons + or) qui **scale
  les stats de base** au démarrage du combat (`meta.ts` `scaleUnitDef` : +15 %/niv dégâts,
  +4 %/niv portée). Économie d'amélioration : courbe doublons+or par rareté, cap niveau 6.
- **Campagne 20 nœuds** (`data/campaign.ts`) : 5 templates cyclés avec un **multiplicateur de PV
  ennemis croissant** (1.0 → 3.1). Récompenses de victoire **déterministes** (or/gemmes/doublons).

### Écrans
- **Hub saga** : barre monnaies, bannière événement, **carte à 20 nœuds** (débloqués/verrouillés,
  étoiles), bouton Deck, nav basse Collection/Jouer/Boutique(toast « arrive en M5 »).
- **Collection** : grille des 12, filtres de rareté, possédées vs verrouillées, compteur X/12.
- **Amélioration d'unité** : tuile héros, pips de niveau, stats avant→après, progression doublons
  + coût or, bouton Améliorer, ajout/retrait du deck.
- **Deck builder** : slots 4-5, grille des unités possédées, coûts, contrainte min 4/max 5.
- **Résultats** : victoire/défaite, étoiles, récompenses, Continuer/Rejouer.
- **Combat** intègre désormais le **deck actif scalé** + la difficulté du nœud, et à l'issue :
  calcule étoiles/récompenses, crédite, débloque le nœud suivant, sauvegarde, route vers Résultats.

### Tests & simulation
- **50 tests** verts (`npm test`), dont `meta.spec.ts` : migration de save, courbe d'upgrade,
  `metaScale`, bornes du deck (min 4/max 5/possession), `recordVictory` (gains + unlock +
  meilleures étoiles conservées), étoiles par vie restante.
- `npm run simulate` désormais sur les **20 nœuds** avec le multiplicateur de PV : vraie courbe —
  nœuds de début à 100 % vie haute, **nœuds boss 10/15/20 à 88 %/63 %/63 %** avec vie mince
  (nœud 20 gagné à ~3 PV). Tous gagnables par le joueur scripté rapide.
- Vérif navigateur (Playwright) des 5 écrans + lancement combat depuis un nœud + upgrade
  end-to-end (correction au passage : la pastille de monnaie du bandeau ne se rafraîchissait pas
  après un achat in-screen — corrigée).

### Points ouverts / dette assumée
- **Gravité contrainte au ralentissement** : le modèle « chemin défini » (déviation M2) empêche le
  « courbe/regroupe » du différenciateur ; les 3 unités gravité se distinguent par profil de champ
  (large-doux / focalisé-fort / épique lourd). À rouvrir en design combat (ennemis hors-chemin ?
  distorsion locale du chemin ?).
- **Récompenses farmables** : rejouer un nœud recrédite (pas de cap). Acceptable en M3, à plafonner
  en M4/M5.
- **Polices** : `fonts.googleapis.com` est bloqué dans le bac à sable/artefact (CSP) → repli
  système dans l'aperçu ; Baloo 2/Nunito se chargeront sur device. À embarquer en local (self-host)
  au plus tard en M6.
- Restent Phase 3 (juice, FTUE, sprites, 60fps device) et les missions M4 (PvP/ligues) et M5
  (boutique/passe/monét.).

**Décision — verrou Mission 3 : 🟢 vert** pour la « méta minimale » (hub 20 nœuds, collection 12,
amélioration/fusion, deck, sauvegarde). Les items Phase 3 du skill (onboarding, juice, art)
restent explicitement à faire avant de fermer la Phase 3.

---

## M4 — Arène PvP (bots calibrés) + ligues + trophées

Mode « avance au max » (autonomie). Livré : l'arène PvP contre bots, le système de ligues à
trophées, et la simulation de calibrage — conforme au palier **P-2** (bots présentés comme
adversaires en v1, aucun temps réel synchrone).

### Modèle PvP retenu (décision de design)
Fidèle au genre (Rush Royale) et à la maquette Combat : les deux camps **affrontent le même flux
de vagues** (mêmes vagues, même vie de départ) ; le gagnant est **celui qui laisse le moins
fuir** (plus de vie restante à la fin, ou dernière base debout). Ce n'est PAS un affrontement
d'unités entre joueurs. Concrètement, `PvpCombatScreen` fait tourner **deux `CombatSim` en
parallèle** — le joueur (interactif, son deck scalé par niveaux méta) et le bot (headless, piloté
par `BotDriver`). L'adversaire est affiché en **bandeau DOM** au-dessus du canvas (nom + barre de
vie live), exactement comme le header adversaire du wireframe.

### BotDriver partagé (sim ↔ live) — décision d'archi
La politique de bot vit dans `src/sim/BotPolicy.ts` (`BotDriver` : merge glouton + achat/pose par
intervalle de réaction). **Le même code pilote l'adversaire en jeu ET les simulations headless** —
donc ce que les scripts d'équilibrage valident est exactement ce qu'un joueur affronte. Le
`simulate-balance` de campagne a été refactoré pour l'utiliser (fin des copies dupliquées).

### Ligues & trophées
- **5 ligues** (`data/arena.ts`) : Bois / Bronze / Argent / Or / Platine, seuils de trophées
  croissants, chacune avec une **policy bot** (intervalle de réaction ↓, deck ↑, `botPower` ↑ qui
  scale les stats du bot comme un niveau méta). Victoire **+30**, défaite **−20**, trophées
  plancher 0. `AppState.currentLeague()` dérive la ligue des trophées.
- Écrans : **Arène** (ligue courante, trophées, prochain palier, bouton Combattre, échelle des
  ligues), **PvP** (ci-dessus), **Résultats PvP** (issue, comparaison de vie Toi vs adversaire,
  Δtrophées, total). Accès via un bouton **⚔ Arène** sur le Hub.

### Calibrage (verrou skill « win rates »)
`npm run simulate:pvp` oppose un **joueur de référence** (deck de départ, réaction 1,1 s) à chaque
ligue sur les vagues d'arène. La sim étant déterministe, le signal visé n'est pas « 50 % partout »
mais une **rampe monotone** : le joueur starter **gagne** en bas, **conteste** son palier, **perd**
en haut (les hautes ligues exigent un deck amélioré — ce qui referme la boucle méta M3→M4). Après
tuning (durcissement des vagues d'arène pour créer des fuites différenciantes + ajout d'une unité
bon marché aux decks Or/Platine pour lisser la rampe) :

  | Ligue | bot act | power | win% joueur starter |
  |---|---|---|---|
  | Bois | 2.4 | 1.00 | 100 % (gagne) |
  | Bronze | 1.9 | 1.15 | 100 % (gagne) |
  | Argent | 1.5 | 1.35 | 50 % (nul, son palier) |
  | Or | 1.1 | 1.60 | 0 % (perd — deck à améliorer) |
  | Platine | 0.8 | 1.90 | 0 % (perd) |

  Insight de design capté par la sim : à score « qui fuit le moins », **la courbe de coût du deck
  compte plus que la puissance brute** (un deck tout-cher fuit la ruée initiale) → les decks bots
  incluent désormais une unité bon marché.

### Tests
- 54 tests verts, dont `arena.spec.ts` : mapping trophées→ligue, monotonie des ligues, scaling
  `botUnitDefs`, `AppState.addTrophies` (clamp 0) + `currentLeague`.
- Vérif navigateur (Playwright) : Arène (ligue/échelle) et PvP live (bandeau adversaire, vie qui
  descend) confirmés.

### Dette assumée
- **Résultats PvP farmables** (rejouer recrédite) — à plafonner en M5.
- Calibrage = **proxy déterministe** (un match/ligue) ; à affiner quand la télémétrie de deck
  réel existera (M5+). La vraie cible « familles à 50±7 % » reste un chantier data ultérieur.

**Décision — verrou Mission 4 : 🟢 vert** pour l'arène bots + ligues + résultats + calibrage.

---

## M5 — Boutique + coffres + passe + paramètres + hooks monétisation

Dernier écran manquant de la maquette + la couche monétisation. Règle studio respectée : **aucun
dark pattern** (pas d'énergie, coffres à **contenu affiché**, prix honnêtes, **jamais
d'interstitiel**, rewarded **opt-in**).

### Décision — monétisation en NullProvider, mais boutique jouable
Les hooks `AdProvider`/`IapProvider` sont **injectés dans `AppState`** et réellement appelés par la
boutique, mais restent des **NullProviders** en v1 (pas de facturation). Pour que la boutique soit
néanmoins **jouable et démontre la boucle**, on sépare :
- **Offres argent réel** (passe héroïque, packs de gemmes/or, no-ads) → passent par
  `iap.purchase()` → NullIap renvoie « échec » → toast honnête « Paiements désactivés (démo v1) ».
- **Échange en gemmes** (monnaie premium douce déjà en jeu) → **fonctionnel** : dépenser des
  gemmes pour des **coffres** ou de l'or.
- **Rewarded opt-in** (« coffre bonus – pub optionnelle ») → `ads.showRewarded()` → NullAd
  « indisponible » → toast. Le hook est câblé, prêt pour AdMob (M6+).

### Coffres = déblocage des unités verrouillées (boucle de progression)
`data/shop.ts` : tables de coffres **déterministes** (RNG seedée par un compteur `chestsOpened`
persistant — aucun aléa ambiant). Un coffre donne or + doublons pondérés par rareté ; **un doublon
d'unité non possédée la débloque** (commun : rare occasionnel ; épique : bonnes chances de rare/
épique). C'est le canal qui débloque les 5 unités verrouillées → referme la boucle
collection→deck→combat. Écran **Ouverture de coffre** avec reveal (or + tuiles, badge « NOUVEAU »).

### Écrans & save
- **Boutique** (fidèle à la maquette : passe, packs, coffres, no-ads), **Ouverture de coffre**,
  **Paramètres** (son persistant, restaurer les achats [stub], infos build, **réinitialiser la
  progression** avec confirmation).
- Accès : nav basse **Boutique** (câblée partout), **engrenage** sur le Hub → Paramètres.
- **Sauvegarde v3** (`shop: { chestsOpened, noAds, passActive }`) + **migration v2→v3** (report
  intégral + seed du bloc shop) et v1→v3, testées.

### Tests
- 61 tests verts. `shop.spec.ts` : déterminisme des coffres, épique > commun, `spendGems` (refus si
  insuffisant), `openChest` (gain + avance compteur), déblocage d'une unité verrouillée via doublon,
  `applyPurchase` (no-ads/pass). `meta.spec` : migration v2→v3.
- Vérif navigateur (Playwright) : Boutique, ouverture de coffre (+330 or + unités), Paramètres.

### Dette assumée
- Achats réels non fonctionnels (NullProvider assumé v1) ; intégration store réelle = M6+.
- Coffres/rewards toujours **farmables** (rejeu) — plafonds/quotas quotidiens à ajouter avec les
  quêtes quotidiennes (non livrées : dailies/quêtes restent un chantier rétention post-M5).
- Passe héroïque : piste de récompenses détaillée non construite (juste l'achat stub).

**Décision — verrou Mission 5 : 🟢 vert** pour boutique + coffres + paramètres + hooks
monétisation propres (NullProvider). Tous les écrans de la maquette sont désormais implémentés.

---

## M6 — Préparation Capacitor + audit complet

### Préparation Capacitor
- `capacitor.config.ts` (appId `com.wardens.game`, `webDir: dist`, fond crème anti-flash), deps
  `@capacitor/{core,cli,android,ios}`, scripts `cap:sync` / `cap:android` / `cap:ios`,
  `docs/capacitor.md` (setup one-time + boucle build/sync + mapping plugins→interfaces
  `src/platform`). Le build web (`base: './'`) est déjà self-contained ⇒ wrapping sans changement
  de code. `android/` et `ios/` ignorés jusqu'à `cap add`.
- `README.md` (run, checks, archi) et `CLAUDE.md` (règles pour futurs agents) ajoutés.

### Audit — anatomie d'un jeu complet (12 points du skill)

| # | Élément | État | Note |
|---|---|---|---|
| 1 | Promesse claire | 🟢 | TD à merge + gravité, portrait F2P |
| 2 | Core loop | 🟢 | invoquer→défendre→fusionner→récompense, jouable M1, affinée M2 |
| 3 | Onboarding | 🔴 | **pas de FTUE guidée** — chantier Phase 3 |
| 4 | Progression 3 horizons | 🟢 | session (combat) · multi-jours (saga 20 nœuds + upgrades) · aspirationnel (ligues, collection 12) |
| 5 | Feedbacks (juice) | 🔴 | **aucun** (pas d'impacts/SFX/haptics/screenshake) — chantier Phase 3 |
| 6 | Système d'objectifs | 🟡 | nœuds + étoiles + ligues ; **pas de dailies/quêtes** (rétention) |
| 7 | Économie cohérente | 🟢 | or/gemmes/doublons, courbe d'upgrade, coffres, **simulée** |
| 8 | Difficulté maîtrisée | 🟢 | rampe 20 nœuds validée par sim (100 %→63 % boss) |
| 9 | Boucle de rétention | 🟡 | collection/ligues/coffres ; dailies/streaks/events **manquants** |
| 10 | Monétisation propre | 🟢 | hybride passe+gemmes+coffres+rewarded opt-in, **zéro dark pattern**, hooks NullProvider |
| 11 | Lisibilité UX/UI | 🟢 | tokens maquette, nav claire, thumb-friendly ; **art placeholder** (formes) |
| 12 | KPI & observabilité | 🟡 | events câblés (combat, merge, gravité, chest, rewarded, pvp) via NullAnalytics ; **backend réel + funnel FTUE** à brancher |

### Verrous du pipeline (skill)
- **Phase 1 Concept** 🟢 · **Phase 2 Prototype** 🟢 (fun sans méta prouvé en sim ; playtests
  externes restent à mener) · **Phase 3 Vertical slice** 🔴 (juice + FTUE + art + 60fps device non
  faits) · **Phase 4 Production** 🟡 (contenu/économie/monét. en place et simulés ; manquent
  dailies, art final, équilibrage sur joueurs réels) · **Phases 5-6 Soft launch/Live** ⏳ (hors
  périmètre — nécessitent de vrais joueurs).

### Palier P-2 — état de préparation
Toute la v1 tourne **en local, déterministe** ; les bots PvP sont des données jouées par le même
moteur (aucun netcode). Le chemin de dérisquage P-2 de `references/paliers-backend.md` est tenu :
sim réutilisable côté serveur ✅, bots en data ✅, sim d'équilibrage ✅. **Restent pour la v2**
(hors périmètre actuel, chiffrés dans l'entrée Phase 1) : auth Supabase, tables ligue/trophées
server-authoritative, Edge Functions de validation anti-triche, ADR palier complet.

### Dette technique consolidée (backlog priorisé)
1. **Juice + FTUE + sprites** (Phase 3) — le plus gros bloqueur avant tout playtest sérieux.
2. **Gravité : bend/regroup** contraint par le chemin fixe → rouvrir le design combat.
3. **Dailies / quêtes / events** (rétention) + plafonds anti-farm sur coffres et récompenses PvE/PvP.
4. **Backend réel** : analytics (funnel FTUE), puis P-2 v2 (cloud save, ligues serveur).
5. **Polices self-hostées** (retirer le CDN Google Fonts) avant soumission store.
6. **Passe héroïque** : piste de récompenses détaillée (juste l'achat stub aujourd'hui).

### Décision kill / pivot / scale
**Ni kill ni pivot** : la core loop est cohérente et le jeu complet est jouable de bout en bout
(hub→deck→combat→récompenses→upgrade→arène→boutique). Pas encore de **scale** : le scale exige un
signal de rétention sur de vrais joueurs (D1/D7), impossible à obtenir en sim. **Prochaine étape
décisive = Phase 3 (juice + FTUE + art) puis un vrai playtest** pour décider du scale.

**Décision — verrou Mission 6 : 🟢 vert** pour la préparation Capacitor et l'audit. Le pipeline
M1-M6 « one-shot » est bouclé ; la suite (Phase 3 polish → soft launch) demande des itérations
avec de vrais joueurs, comme prévu par le skill.

---

## Phase 3 (1/3) — Juice du combat

Premier gros levier de « feel » attaqué (le plus gros rouge de l'audit). Objectif : rendre le
combat nerveux et lisible **sans jamais casser la pureté déterministe de la sim**.

### Décision d'archi — la sim émet des événements, le rendu joue le juice
`src/sim` ne peut pas toucher au DOM/rendu. Solution : `CombatSim` accumule des **`CombatEvent`
purs** (données seules — `attack` / `damage` / `kill` / `merge` / `summon` / `baseHit`, en
coordonnées de cellule) drainés une fois par frame via `consumeEvents()`. La sim reste
déterministe (les events n'influencent aucun état de jeu) — les 63 tests et les 2 simulations
d'équilibrage passent inchangés. `src/render/Effects.ts` transforme ces events en feedbacks.

### Feedbacks livrés (`Effects.ts`)
- **Dégâts** : nombres flottants montants + **flash blanc** sur l'ennemi touché + micro-particules.
- **Éclairs d'attaque** : trait bref unité→cible, couleur par famille.
- **Mort** : éclatement de particules (couleur de l'ennemi) + anneau.
- **Fusion (signature)** : anneau doré qui s'étend + gerbe de particules + texte **« Niv N ! »** +
  léger screenshake — le merge est enfin satisfaisant.
- **Invocation** : petit pop d'anneau.
- **Fuite de base** : screenshake + **vignette rouge** pulsée.
- **Champs de gravité visualisés** : disque + anneau teal pulsant au rayon d'effet de chaque unité
  gravité → **le différenciateur devient enfin lisible sur le plateau** (rouge #2 de l'audit levé).
- **Haptics web** (`platform/Haptics.ts`, `navigator.vibrate`, interface + `Null` par défaut) sur
  fusion (medium) et fuite de base (heavy) ; swap `@capacitor/haptics` au wrapping.
- **`prefers-reduced-motion`** respecté (pas de shake, moins de particules).

Intégré dans le combat PvE **et** PvP (bot headless : ses events sont drainés puis ignorés, seul
le plateau joueur est rendu). Tests ajoutés : émission `summon`/`attack`/`damage`/`kill` et
`merge` via `consumeEvents`.

**Reste Phase 3** : SFX (audio), FTUE/onboarding guidé, sprites (art final), perspective 3D du
plateau, validation 60 fps device — puis playtests externes. La gravité « courbe/regroupe »
(vs simple ralentissement) reste un chantier de design combat séparé.

## Phase 3 (2/3) — SFX audio

`AudioProvider` (interface plateforme) + **`WebAudioProvider` procédural** (`platform/Audio.ts`) :
sons **synthétisés en WebAudio, zéro fichier asset** — donc fonctionnels partout, y compris
l'artefact partagé. Enveloppes courtes : invocation (pluck triangle montant), **fusion**
(arpège C5→G5 brillant — le son signature), élimination (burst de bruit filtré), fuite de base
(thud sinus grave + bruit), impact (tick throttlé pour éviter la cacophonie). Gated par le réglage
**Son** (`app.soundOn`), `resume()` sur le premier geste (politique autoplay), dégrade
gracieusement sans `AudioContext` (node/headless). Câblé sur les mêmes `CombatEvent` que le juice
visuel (PvE + PvP). `NullAudioProvider` par défaut. Tests : Null no-op + WebAudio safe headless.

## Phase 3 (3/3) — FTUE (tutoriel guidé)

`ui/Tutorial.ts` (`TutorialCoach`) : coach marks **non bloquants** au **premier combat de campagne**
(nœud 0 seulement), pilotés **uniquement par l'observation du snapshot sim** (aucun hook dans la
logique de combat) — 4 étapes : poser une carte → poser une 2ᵉ identique → fusionner → défendre.
Surbrillance pulsée de la zone (main de cartes / plateau) + scrim, bandeau d'instruction, lien
**Passer**. Auto-dismiss après la fusion. Flag persistant **`progress.tutorialSeen`** ⇒ ne
réapparaît jamais. **Sauvegarde v4** (+ migration v3→v4 et v2→v4, testées). Rouge #3 de l'audit
(onboarding) **levé**.

Après cette passe, la Phase 3 n'a plus que **l'art final (sprites) + perspective 3D + validation
60 fps device** avant playtests — les 3 gros rouges « feel/lisibilité » (juice, audio, onboarding)
sont traités.

## Phase 4 (1/3) — Bestiaire : ennemis à traits + boss à capacités

**Brief** : sortir du « tout le monde marche et tape » — donner au joueur des *problèmes*
différents à résoudre (le cœur d'un bon TD). **12 ennemis** en 3 paliers (`data/enemies.ts`) :
- **Basiques** : gobelin, coureur (rapide), brute (tanky), troll (mur de PV).
- **Élites** (dès le nœud 7, injectés en dernière vague) : **spectre volant** (`flying` — coupe en
  ligne droite, ignore la gravité et le chemin), **saboteur** (`stunOnDeath` — explose et **paralyse
  tes unités** autour à sa mort → punit le kill au corps-à-corps), **juggernaut** (`armor 6` —
  réduit chaque coup, floor à 1), **ogre** (`regenPerSec` — se régénère, force le focus-fire).
- **Boss** (nœuds 5/10/15/20, arrivée téléphonée : ring + screenshake) : **nécromancien** (invoque
  des gobelins en boucle), **seigneur de guerre** (paralyse périodiquement tes unités),
  **colosse de pierre** (`armor` + **bouclier** périodique = intouchable par fenêtres),
  **grande prêtresse** (**aura de soin** — soigne les ennemis proches, à tuer en priorité).

**Sim (pur, déterministe, zéro RNG)** : traits résolus par géométrie/timers absolus — vol mappé sur
l'échelle `pathProgress` via `flyFactor` (breach/ciblage restent uniformes), `armor` dans
`resolveAttacks` (`max(1, dmg-armor)`), `regen` clampé à `maxHp`, capacités via `tickAbility`
(aura continue ; bouclier/invocation/paralysie périodiques par `abilityTimerSec`). `LiveEnemy`
gagne `maxHp/shieldedUntilSec/abilityTimerSec`, `PlacedUnit` gagne `stunnedUntilSec`. Nouveaux
`CombatEvent` : `stun`, `spawn(boss)`. Les balance-sims restent valides (aucune RNG introduite).

**Rendu** (`CombatRenderer`) : volants avec **ombre au sol décalée + ailes battantes + bob**,
armure = **anneau métallique pointillé**, régén = **pulse vert**, bouclier = **bulle bleue**,
boss = **rayon accru + couronne + label + barre de PV renforcée**, unités paralysées = **voile gris
+ ⚡**. Events `stun` (éclair + anneau) et `spawn` boss (ring orange + shake) dans `Effects`.

**Rebalance obligatoire** (les élites/boss durcissent la courbe). Après `npm run simulate` :
la courbe initiale échouait (**nœud 20 à 0 %**, boss finaux trop tanky×mult composé). Corrections :
rampe HP **0,11 → 0,09** par nœud, colosse **1300→1050 PV** (bouclier 6/2,2 → 7/1,7), seigneur
**900→820** (stun 5/2 → 6/1,8), prêtresse soin **30→22/s**. Résultat : **tous les nœuds gagnables**,
boss = vraies portes de skill (nœud 10 : 75 %, 15 : 63 %, **20 : 25 %** — le boss final exige la
maîtrise). Tests sim ajoutés : armure, bouclier bloque le ciblage, unité paralysée n'attaque pas,
vol en ligne droite, spawn boss événementiel, invocation, régén (comparé à un jumeau sans régén).

**Verrous** : `typecheck` + **74 tests** + `build` verts, `simulate` OK (toutes portes gagnables),
smoke navigateur (combat rendu sans erreur JS ; seules erreurs = CDN Google Fonts bloqué =
fallback système attendu). Non-négociables tenus : sim pure, tout l'équilibrage en `data`.

## Phase 4 (2/3) — Mode Survie (endless)

**Brief** : un mode « une main de plus » à score, orthogonal à la campagne — vagues infinies,
difficulté qui finit *toujours* par submerger, meilleur score gardé. C'est le mode rétention des
TD modernes.

**Data (`data/survival.ts`, tout l'équilibrage ici)** : `survivalWave(n)` — **générateur pur**
(zéro RNG) : fodder qui grossit, menaces du bestiaire introduites par paliers
(coureur→brute→spectre→saboteur→juggernaut→ogre→troll), **boss toutes les 5 vagues** (cycle des 4,
doublés dès la vague 20). HP en **rampe exponentielle `1.075^n`** (douce tôt — v5 ≈ ×1,4, v10 ≈ ×2 —
puis mur — v25 ≈ ×5,4, v35 ≈ ×10,7) : quelle que soit la défense, un mur imbattable arrive
forcément → la seule question est *quelle vague*. Récompenses honnêtes (or = vague×12, gemmes = ⌊v/5⌋).

**Sim** : `CombatSim` gagne un mode `survival` optionnel — ignore les vagues du niveau et **génère
le planning à la volée** (`scheduleSurvivalWave`, tri local, ordre global préservé par le gap), HP
mise à l'échelle **au spawn** via `hpMult` par vague (la campagne, elle, pré-scale ses defs — les
deux cohabitent). En survie l'issue n'est **jamais** `victory` : seule la chute de base termine.
Snapshot expose `endless` ⇒ le HUD affiche « VAGUE n · ∞ ». Toujours déterministe (2 runs identiques
= snapshots égaux, testé).

**Méta/écrans** : **save v5** (`survival.bestWave`, migration v4→v5 + les anciennes rebranchées,
testées). `AppState.recordSurvival` (garde le record, paie, dit si nouveau record). Nouvel écran de
combat `SurvivalScreen` (variante sans FTUE/récompenses de nœud), `SurvivalResultsScreen`
(vague atteinte en gros, record, stats), carte d'entrée proéminente sur le Hub.

**Sim d'équilibrage** (`npm run simulate:survival`, ajouté aux gates) : au lieu d'un taux de
victoire (il n'y en a pas), on mesure **la profondeur atteinte** sur le sweep de skill. 1ʳᵉ passe :
rampe linéaire 0,08 ⇒ le bot tenait jusqu'au plafond 12 min (vague 42, **run non convergent**) →
bascule en exponentiel `1.075^n`. Résultat : **tous les runs se terminent** (vagues 27–32) et le
skill change la profondeur (le plus lent cale plus tôt). Le plateau entre skills rapides vient du
deck fixe du bot (le plateau se remplit, DPS plafonné) ; un humain qui améliore ses unités varie
davantage.

**Verrous** : `typecheck` + **86 tests** + `build` verts, `simulate:survival` OK (converge + skill
compte), smoke navigateur (Hub → Survie → combat rendu « VAGUE 1 · ∞ », zéro erreur JS). Non-négos
tenus : sim pure/déterministe, tout l'équilibrage en `data`, save versionnée + migration testée.

## Phase 4 (3/3) — 2ᵉ mode PvP : Blitz (mana rapide, boss dans l'arène)

**Brief** : un 2ᵉ format PvP court et nerveux, avec un **boss** partagé — plus de variété que le seul
duel classique.

**Data (`data/arena.ts`)** : `BLITZ_ECONOMY` (mana ×2,2 : regen 1,1→2,4, start 6→10 ⇒ le plateau
se remplit vite) + `BLITZ_ARENA_LEVEL` — 2 vagues denses, base plus fragile (22 PV), **capées par
un Nécromancien** (boss invocateur) que les **deux camps** affrontent (duel symétrique : celui qui
fuit le moins gagne). Réutilise la **même ligue/le même bot** que le classique — donc la calibration
d'échelle de puissance déjà validée tient par construction.

**Intégration** : route `pvp` gagne un flag `blitz`, `PvpCombatScreen` choisit économie+niveau+libellé
(« ⚡ Blitz · <ligue> ») selon le flag, deux boutons sur l'Arène (Classique / ⚡ Blitz), libellé Blitz
sur l'écran de résultats, « Rejouer » conserve le mode. Zéro nouveau système de sim : Blitz = data +
routage.

**Calibration (`npm run simulate:pvp`, étendu aux 2 modes)** : le match unique déterministe est
binaire (victoire/défaite nette), donc jamais « contesté » — j'ai basculé sur un **sweep de skill du
joueur** (comme la sim campagne) : le taux de victoire par ligue devient continu. Résultat, rampe
équitable et monotone dans les deux modes :
- Classique : Bois 92 % · Bronze 67 % · **Argent 33 %** · Or 0 % · Platine 0 %
- Blitz : Bois 100 % · Bronze 67 % · **Argent 50 % · Or 33 %** · Platine 8 %
Le joueur starter gagne en bas, conteste son palier, perd en haut (il faut améliorer son deck) — dans
les deux modes. Blitz est un peu plus « swingy » (courbe plus étalée), ce qui colle à son identité.

**Verrous** : `typecheck` + **88 tests** (dont data Blitz : mana plus rapide, boss présent) + `build`
verts, `simulate:pvp` OK (2 modes), smoke navigateur (Arène → ⚡ Blitz : combat rendu, **Nécromancien
couronné**, spectres volants ailés, mana pleine, zéro erreur JS). Non-négos tenus : sim
pure/déterministe, tout l'équilibrage en `data`.

## Phase 5 (1/3) — Maps multiples

**Brief** : lever la limite « une seule carte » — le plus visible des manques. **4 tracés** distincts
pour le plateau 6×10 (`data/maps.ts`) : Serpent (l'original), Cascade (grand zig-zag pleine largeur),
Creux (spirale gauche), Double-S. Tous 4-connectés, entrée en haut, base en bas, < moitié du plateau
en chemin (assez d'herbe pour poser). La campagne **cycle les maps par nœud** (`mapForNode`), donc
chaque combat change de tracé — le rendu et les règles de pose lisent déjà `level.path`, donc c'est
transparent. `CampaignNode.mapName` exposé pour l'UI.

**Verrous** : `tests/maps.spec.ts` valide exhaustivement chaque tracé (bornes, 4-connexité, cellules
distinctes, entrée haut / base bas, herbe suffisante) + que la campagne utilise bien des maps variées.
`typecheck` + **92 tests** + `build` verts. `simulate` re-passé : tous les nœuds restent gagnables
(un tracé plus long donne plus de temps au défenseur ⇒ la difficulté ne peut qu'assouplir ; le boss
final reste une vraie porte à ~13 %). Non-négos tenus : maps = pure data, sim inchangée.

## Phase 5 (2/3) — Capacités d'unités

**Brief** : donner de la profondeur au deck — sortir des unités « juste des stats ». **4 capacités
signature**, toutes déterministes (géométrie + timers, zéro RNG), dans le sim pur :
- **Éclaboussure** (Catapulte) : l'attaque touche aussi les ennemis autour de la cible.
- **Chaîne** (Chaman des tempêtes) : l'éclair rebondit sur N ennemis proches (dégâts réduits).
- **Givre** (Archère de givre) : ralentit l'ennemi touché — se **cumule** avec les champs de gravité.
- **Ralliement** (Gardien) : aura passive, +25 % de dégâts aux unités alliées proches.

**Sim** : `UnitAbility` sur `UnitDef` ; `resolveAttacks` calcule les dégâts effectifs via un
`boostMultiplier` (auras alliées), puis applique les effets secondaires (`applyOnHit` : splash en
rayon, chaîne aux plus proches, givre = `chilledUntilSec`/`chillFactor` sur l'ennemi). `LiveEnemy`
gagne le givre ; `CombatSim` l'applique au déplacement (×chill, cumulé au ralentissement gravité).
Les dégâts secondaires émettent des events `damage` ⇒ le juice (chiffres/flash) marche tout seul.

**Rendu** : zone d'aura dorée sous le Gardien, teinte givre bleue sur les ennemis gelés. **Écran
détail d'unité** : panneau de capacité (titre + description) — la profondeur devient **visible** pour
le joueur (`abilityLabel`).

**Verrous** : `typecheck` + **96 tests** (dont 4 nouveaux : splash, chaîne, givre, aura) + `build`
verts. `simulate` (campagne) OK et `simulate:pvp` OK sur les 2 modes : les capacités buffent les **deux
camps** (le deck de départ a la Catapulte, les bots ont Catapulte/Chaman/Gardien), donc les rampes
tiennent. Smoke navigateur : panneau de capacité rendu, combat sans erreur JS.

## Phase 5 (3/3) — Quêtes journalières + succès + coffre quotidien

**Brief** : la couche de rétention — donner une raison de revenir chaque jour, sans dark pattern
(tout est gratuit, rien derrière un paywall ou un timer-à-skip).

**Data (`data/progression.ts`)** : 8 **succès** à vie (paliers : victoires, éliminations, wins PvP,
fusions, meilleure vague Survie, unités débloquées, trophées). **Quêtes du jour** : 3 tirées d'un
pool par un **hash déterministe de la date** (stables dans la journée, variées d'un jour à l'autre,
une par métrique). **Coffre quotidien** gratuit (or + gemmes). `todayStr()` = jour calendaire local
(couche méta uniquement — jamais dans le sim déterministe).

**Save v6** (`progression` : stats à vie, succès réclamés, compteurs du jour + date, date du dernier
coffre) + **migration v5→v6** (et anciennes rebranchées), testée. **AppState** : `recordCombatEnd`
(alimente stats à vie + compteurs du jour, reset au changement de date), `claimAchievement` /
`claimDailyQuest` / `claimDailyChest`, `hasClaimable` (pilote la pastille du Hub). Les **3 écrans de
combat** (Campagne, Survie, PvP) reportent leur issue (victoire, kills, fusions, pvp/blitz).

**Écran Défis** (`ChallengesScreen`) : coffre + quêtes (barres de progression + réclamer) + succès,
re-render en place. **Entrée Hub** : bouton 🎯 avec **pastille rouge** quand quelque chose est
réclamable.

**Verrous** : `typecheck` + **105 tests** (migration v6, déterminisme des quêtes, claim succès/quête/
coffre, reset quotidien, `hasClaimable`) + `build` verts. Smoke navigateur : écran rendu, coffre
réclamé, zéro erreur JS. Non-négos tenus : progression = data + méta, sim intacte, save versionnée
+ migration testée, économie honnête.

## Phase 6 (1/3) — Ressource Éclats ✦ + amélioration de la base

**Brief (retour utilisateur)** : améliorer une unité ne doit pas coûter *que* de l'or — des **cartes**
(doublons) et, à un certain palier, une **ressource plus rare**. Et pouvoir **améliorer la base**.

**Éclats ✦** : nouvelle monnaie (`currencies.shards`). `upgradeCost` renvoie désormais `{duplicates,
gold, shards}` — les Éclats rejoignent la recette aux **hauts niveaux** (4→5 : 3 ✦, 5→6 : 6 ✦). Source
principale : **coffres** (épique +3, commun +1). Départ : 4 ✦. Libellé « Doublons » → **« Cartes »**.

**Base** : `base.level` (1→8). `baseBonusLife(level)` = +2 PV de départ par niveau, **appliqué en PvE
seulement** (campagne + survie ; l'arène reste symétrique et intouchée). `baseUpgradeCost` = or (+ ✦
dès le niveau 4). `AppState` : `upgradeBase`, `canUpgradeBase`, `baseBonusLife`, `shards`/`addShards`.

**Save v7** (`currencies.shards`, `base.level`) + **migration v6→v7** (et v5→v1 rebranchées via un
helper `withV7` qui injecte shards + base sur les anciennes formes), testée.

**Verrous** : `typecheck` + **107 tests** (coût avec Éclats, refus si ✦ manquants, amélioration base +
bonus de vie, migration v7) + `build` verts. `simulate` / `simulate:pvp` / `simulate:survival` OK
(le baseline des sims part d'une base niveau 1 ⇒ équilibrage inchangé ; le bonus est un power-up
joueur). Le bouton d'amélioration de la base arrive avec l'écran fusionné (phase suivante).
Non-négos : sim intacte, tout l'équilibrage en data, save versionnée + migration testée, éco honnête.

## Phase 6 (2/3) — Fusion Deck + Collection (UX, réf Rush Royale)

**Brief (retour utilisateur + réf IMG_6688)** : Deck et Collection au même endroit.

**`CollectionScreen` réécrit** en écran unifié « Deck & Collection » : en haut le **loadout de combat**
(slot Héros — placeholder « Bientôt » en attendant la phase héros — + 5 slots d'unités, retirables au
toucher), puis **onglets Unités / Base / Ressources**. Onglet *Unités* : filtre par rareté + grille
de collection (membres du deck **surlignés or**, verrouillés grisés) → toucher ouvre le détail
(équiper/améliorer). Onglet *Base* : carte 🏰 avec niveau, bonus de PV, bouton d'amélioration (or + ✦)
— **c'est là que vit l'amélioration de la base** de la phase précédente. Onglet *Ressources* :
récap or/gemmes/**Éclats** avec provenance. La barre de monnaies affiche désormais les **Éclats**.

Route `deck` → même écran (alias) ; `DeckScreen` supprimé. Nav Hub/bas inchangée.

**Verrous** : `typecheck` + **107 tests** + `build` verts. Smoke navigateur : loadout + 3 onglets
rendus (unités surlignées, base améliorable, ressources), zéro erreur JS. UX : un seul endroit pour
voir son deck, parcourir/améliorer la collection, et gonfler sa base.

## Phase 6 (3/3) — Héros déployable (PV + pouvoirs)

**Brief (retour utilisateur, choix « champion déployable »)** : un héros activable tous les X temps
sur le champ de bataille, avec des PV et des pouvoirs.

**Sim (pur, déterministe)** : `CombatSim` accepte un `hero?: HeroConfig`. Une **jauge d'énergie** se
remplit (`rechargeSec`) tant qu'il n'est pas déployé ; `deployHero(col,row)` le pose sur une case
d'herbe quand la jauge est pleine. Une fois déployé : il **attaque** l'ennemi le plus avancé à portée,
lance un **pouvoir signature** périodique (`tickHero`), et **encaisse des dégâts de contact** des
ennemis proches (rayon 1,15 ⇒ un ennemi sur la case adjacente le grignote) ; il part à l'expiration
(`durationSec`) **ou à la mort** (PV ≤ 0), puis la jauge repart. Pouvoirs : `nova` (dégâts de zone),
`frost_nova` (gèle/ralentit), `rally` (soigne la base). Snapshot expose `hero` ; events `heroDeploy`,
`heroPower`, `heroDeath`. Ses kills passent par la même boucle de retrait (kill juice + explosions).

**Data** (`data/heroes.ts`) : 3 héros — **Pyromancien** (nova, starter), **Roi de givre** (frost),
**Paladin** (rally, très tanky). `scaleHeroConfig(level)` (PV/dégâts ~×1,12/niv). Cartes de promotion
+ or par niveau (max 6).

**Méta** : **save v8** (`heroes: { active, owned:{level,cards} }`, starter = Pyromancien) + migration
v7→v8 testée. `AppState` : héros actif, `activeHeroConfig` (scalé), sélection, promotion (cartes+or),
`addHeroCards` (les **coffres** distribuent des cartes héros en rotation). Écran **Héros** (choisir
l'actif + promouvoir), branché sur le **slot Héros** du loadout (fini le placeholder « Bientôt »).

**Combat** : bouton héros (jauge %/PRÊT/ACTIF) en campagne **et survie** (PvE ; l'arène PvP reste sans
héros pour la symétrie). Placement au toucher. **Rendu** : héros sur le plateau (jeton violet + aura
pulsée + barre de PV) ; events héros câblés dans le juice (`Effects`) + audio/haptique.

**Verrous** : `typecheck` + **118 tests** (jauge, refus avant recharge, attaque, dégâts de contact,
expiration→recharge, déterminisme, scaling, promotion, migration v8) + `build` verts. 3 sims OK
(le héros ne touche pas le baseline d'équilibrage — power-up joueur PvE). Smoke navigateur : écran
Héros rendu, **héros déployé sur le plateau** (aura + PV), zéro erreur JS.

## Phase 7 — Refonte héros + contenu (retours utilisateur)

- **Héros = il remonte le chemin** : à l'activation (bouton, plus de placement), il entre à la base
  et marche vers le spawn en combattant (`activateHero`, `marchSpeed`, position sur le chemin).
- **20 héros en cartes + fiche** : roster porté à 20 (5 pouvoirs : nova, givre, ralliement, chaîne,
  repoussée — les 2 derniers ajoutés au sim). Grille de cartes + `HeroDetailScreen` (toutes les
  caractéristiques, activer, promouvoir avec ressources manquantes).
- **Bandeau d'info en combat** : sélectionner une carte/unité affiche son nom, sa famille et ce
  qu'elle fait.
- **100 unités** : les 12 cœur (tunées, deck par défaut) + 88 générées déterministe­ment (courbes de
  stats par famille/rareté/palier, noms thématiques, capacités éparses). Verrouillées au départ,
  hors deck par défaut ⇒ les sims d'équilibrage (decks fixes) restent la référence.
- **UX** : bouton Deck retiré du Hub ; onglet Ressources → Héros dans la Collection ; « ressources
  manquantes » explicitées sur toutes les améliorations.

**Verrous** (sur l'ensemble de la phase) : `typecheck` + **126 tests** + `build` verts, 3 sims OK.
Note : les 88 unités et une partie des 20 héros sont du contenu de largeur, non équilibré par
simulation (playtests + curation à venir) — assumé et documenté.

## Phase 8 — Vue perspective 2.5D du plateau (retour utilisateur)

Demande : « améliorer la vue pour donner une vision type 3D ». Choix validé avec l'utilisateur :
**perspective inclinée (2.5D)** plutôt que diorama à plat ou isométrique complet. C'était déjà au
design (asset-brief l.16 « board tilted ~35° toward the camera » ; Phase 3 « reste : perspective 3D
du plateau »).

- **`render/BoardProjection.ts`** (pur, déterministe, dérivé du seul `BoardLayout`) : projection
  perspective fermée et **inversible**. Profondeur `v=row/rows` (0 = fond, 1 = premier plan),
  `scale(v)=MIN+(1-MIN)v` (foreshortening horizontal + taille), `g(v)=A·v+(1-A)v²` (rangées qui se
  resserrent vers l'horizon). `unprojectCell` résout la quadratique ⇒ **le toucher retombe pile sur
  la case** (round-trip exact sur les centres, testé). Un seul point de vérité partagé par le rendu,
  les effets et le hit-testing ⇒ aucune dérive possible.
- **`render/CombatRenderer.ts`** : `drawBoard` réécrit — ciel/brume derrière le trapèze, dalle avec
  épaisseur (rim extrudé), tuiles-trapèzes en damier avec brume atmosphérique sur les rangées
  lointaines, **route effilée** (largeur ∝ profondeur), auras gravité/ralliement en **ellipses au
  sol** (polygone projeté + dégradé radial), portail/base projetés. **Unités = jetons surélevés**
  (cap clair sur socle sombre + ombre), ennemis/héros foreshortés, le tout **peint de l'arrière vers
  l'avant** (algorithme du peintre) pour une occlusion correcte.
- **`render/Effects.ts`** : particules/nombres/faisceaux/anneaux passent par la même projection
  (tailles mises à l'échelle par la profondeur, anneaux d'impact en ellipses).
- **Input** : `CombatScreen` / `PvpCombatScreen` / `SurvivalScreen` passent de `pixelToCell` (repère
  plat, conservé pour le HUD et son test) à `unprojectCell`.
- **Artefact partagé** : bandeau de build « WARDENS · 100 unités · … » **retiré** (demande
  utilisateur) ; bundle réinliné, même chemin de fichier ⇒ même URL.

**Périmètre** : rendu + input + tests uniquement, **aucun changement `src/data`** ⇒ pas de
re-simulation requise (la règle ne s'applique qu'aux constantes d'équilibrage). La sim reste en
espace-case, inchangée et déterministe.

**Verrous** : `typecheck` + **130 tests** (+4 : round-trip projection, foreshortening, bornes,
centrage) + `build` verts. Vérif navigateur (Playwright sur http) : board 2.5D en combat + pose
d'unité tombant sur la bonne case + artefact auto-porté qui démarre sans erreur (hors polices CDN
bloquées = fallback système attendu).

## Phase 9 — Pivot vue : plat en relief (retour utilisateur, remplace la 2.5D)

Retour utilisateur sur la Phase 8 : la perspective 2.5D **étire l'image et déforme les cases**.
Décision : **abandonner la 2.5D**, revenir à une grille **plate à cases carrées**, et donner la
profondeur par un **traitement en relief (diorama)** qui ne déforme jamais la grille.

- **Supprimé** : `render/BoardProjection.ts` + son test ; l'input (`CombatScreen`/`Pvp`/`Survival`)
  et `Effects.draw` reviennent au mapping case↔pixel **linéaire carré** (`pixelToCell`,
  `originX + x·cs`).
- **`drawBoard` réécrit à plat + relief** : dalle surélevée (ombre portée + épaisseur/bord de terre
  sous l'avant), tuiles carrées **biseautées** (liseré clair haut-gauche, ombre bas-droite),
  **vignette** douce qui simule une lumière zénithale, **jetons d'unité surélevés** (ombre portée +
  liseré sombre = épaisseur), entités peintes ligne du fond → ligne de devant pour un chevauchement
  correct. Les cases gardent leur forme, le toucher reste pixel-exact.
- L'artefact partagé est réinliné (même chemin ⇒ même URL) ; toujours sans bandeau de build.

**Périmètre** : rendu + input, **aucun changement `src/data`** ⇒ pas de re-simulation. **Verrous** :
`typecheck` + **126 tests** + `build` verts, vérif navigateur (plateau plat en relief, pose d'unité
sur la bonne case).

### Assets — séparation des 10 planches ChatGPT (livré hors-repo)

10 planches-collages reçues (unités ×3 variantes, ennemis/boss, tuiles/décor, FX/projectiles,
branding, icônes UI, cadres, coffres/badges). Script de **segmentation** (`scratchpad/segment.py`,
hors repo) : détection par contours encrés + composantes connexes / bandes de lignes → **114
éléments** découpés (découpe avec fond + détourage alpha best-effort) + planches-contact. Livrés à
l'utilisateur en zip. Intégration réelle dans le rendu (remplacer les primitives Canvas par les
sprites) = chantier suivant, à cadrer.

## Phase 10 — Intégration des sprites (assets ChatGPT) : unités

Première passe d'intégration des vrais assets dans le rendu de combat (demandée : commencer par
les unités, le plus visible).

- **Détourage propre** (`scratchpad/matte.py`, hors repo) : sur la planche d'unités (img1), matte par
  **flood-fill du fond depuis les bords jusqu'aux contours encrés** → le halo/glow est retiré,
  alpha net qui épouse le sprite. Rognage + downscale ~220 px + **webp q90** (~250 Ko les 12).
- **`src/render/sprites.ts`** : 12 sprites en **data-URI webp base64**, mappés aux 12 unités cœur
  (mapping éditable ; les doublons/gravité réutilisent un sprite). Inline ⇒ présents dans le bundle
  et donc dans l'artefact auto-porté (pas d'asset externe, CSP-safe).
- **`CombatRenderer`** : cache d'`Image` paresseux + garde headless ; le plateau dessine le **sprite**
  (taille ~1.08 case, pieds en bas de case, ombre portée, halo si sélectionné) au lieu du jeton, et
  **repli sur le jeton dessiné** pour les 88 unités générées (pas de sprite). Les **cartes en main**
  affichent aussi le sprite (repli pictogramme).
- Bundle : 138 Ko → **443 Ko** (251 Ko gzip) — acceptable pour l'aperçu (sprites inline).

**Verrous** : `typecheck` + **126 tests** + `build` verts ; vérif navigateur (sprites unités sur le
plateau + cartes, plateau plat cases carrées). Aucun changement `src/data` ⇒ pas de re-simulation.
**Suite** : ennemis/boss (img4), tuiles/décor (img5), FX/projectiles (img6), icônes UI (img8),
coffres/badges (img10) ; puis curation du mapping + détourage des variantes.

## Phase 11 — Intégration sprites : ennemis + boss

Suite de l'intégration (après les unités). Planche img4 recoupée en **grille 5×3** (avec retrait
haut pour éviter les ombres de la rangée du dessus), matte flood-fill, downscale ~200 px webp
(~250 Ko les 15). Mapping vers les ids ennemis/boss (`ENEMY_SPRITES` dans `sprites.ts`) : goblin,
runner, ogre, wraith, saboteur, juggernaut + boss warlord/necromancer/stone_colossus/high_priestess ;
brute & troll réutilisent le sprite d'ogre (éditable). `CombatRenderer` dessine le **sprite** à la
place du cercle (ombre/barre de vie/statuts armure-bouclier-givre/couronne+nom de boss conservés) ;
repli sur le cercle coloré si pas de sprite. Bundle ~443 → ~560 Ko.

**Verrous** : `typecheck` + **126 tests** + `build` verts ; vérif navigateur (gobelins qui descendent
le chemin + unités en sprites). Aucun changement `src/data`. **Suite** : tuiles/décor (img5),
FX/projectiles (img6), icônes UI/coffres/cadres (img8/9/10), collection/hub.

## Phase 12 — Intégration sprites : tuiles & décor (plateau)

Suite de l'intégration. Planche img5 → 4 sprites mattés (`TILE_SPRITES`) : **herbe** (tuile carrée
bordée), **base/fontaine**, **portail de spawn** (chemin non utilisé pour l'instant — tuiles
directionnelles). `CombatRenderer` : la **tuile d'herbe est dessinée par case** (fond de secours
dessous, repli sur le damier biseauté si pas chargée) → plateau-jardin illustré ; la **route** (ruban)
reste dessinée par-dessus ; **spawn = portail violet** et **base = fontaine bleue** en sprites (repli
sur les formes dessinées). Cases toujours carrées, toucher inchangé. Bundle ~560 → ~640 Ko.

**Verrous** : `typecheck` + **126 tests** + `build` verts ; vérif navigateur (plateau texturé +
portail + base, unités/ennemis en sprites par-dessus). Aucun changement `src/data`. **Suite** :
FX/projectiles (img6), icônes UI/coffres/cadres (img8/9/10), Hub/Collection.

## Phase 13 — Intégration sprites : FX & projectiles

Ajout **additif** (les effets procéduraux existants restent) de sprites FX depuis img6 (matte, top-crop
pour exclure les étiquettes texte des projectiles). `FX_SPRITES` : proj_arrow/boulder/ice + fx_hit/
merge/death/summon. `Effects.ts` : deux nouveaux types — **projectiles** (sprite volant orienté le long
de la trajectoire ; les tirs *à distance* lancent une flèche au lieu du beam, burst d'impact `fx_hit`
à l'arrivée) et **bursts** (sprite d'impact qui grandit + s'estompe) sur kill (`fx_death`), summon
(`fx_summon`), merge (`fx_merge`). Chargement d'`Image` paresseux + garde headless. Mêlée/gravité
gardent leur beam procédural. Bundle ~640 → ~700 Ko.

**Verrous** : `typecheck` + **126 tests** + `build` verts ; vérif navigateur (flèche en vol vers les
gobelins + impacts). Aucun changement `src/data`. **Suite** : icônes UI/coffres/cadres (img8/9/10),
Hub/Collection ; variété du sol ; projectile par sous-type (boulet catapulte, glace givre).

## Phase 14 — Bouton Quitter en combat (retour utilisateur)

Retour : « pas de bouton pour quitter la partie ». Le retour (`‹`) existait mais était minuscule,
sans libellé et **recouvert par le texte “VAGUE x/y”** du canvas → invisible. Corrigé sur les 3
écrans de combat (campagne, PvP, Survie) : bouton **« ✕ Quitter »** lisible (pilule bordée d'or) +
**confirmation** (`confirmDialog` dans `common.ts` : scrim + Annuler/Quitter) pour éviter l'abandon
accidentel ; après la fin de partie, il quitte directement. Titre du canvas décalé (`x=96`) pour ne
plus masquer le bouton. Messages adaptés par mode (campagne/survie : « progression perdue » ; PvP :
« défaite »).

**Verrous** : `typecheck` + **126 tests** + `build` verts ; vérif navigateur (bouton visible +
dialogue de confirmation). Aucun changement `src/data`.

## Phase 15 — Passe de style du mode jeu (nouvelle planche de référence)

Nouvelle planche de style reçue (logo, icônes app, key art, roster, 5 maquettes d'écran). Demande :
« voici à quoi ça doit ressembler, je fais surtout référence au **mode jeu** ». Le fichier image
n'étant pas arrivé sur le disque de la session, il est **documenté** dans
`docs/design/style-reference-battle.md` (prescriptions + écarts restants) plutôt qu'archivé.

Écarts corrigés dans `CombatRenderer` (rendu seul, aucun changement `src/data`) :

- **Sol** : la grille de tuiles encadrées de pierre devient un **champ vert continu**. La tuile
  d'herbe est échantillonnée sur sa **zone intérieure** (le cadre de pierre peint est rogné) puis
  répétée avec **miroir par case** pour casser la répétition, dans un **canvas hors-écran mis en
  cache** (reconstruit seulement si la taille du plateau change ⇒ 1 seul `drawImage` par frame).
  Les cases restent lisibles via des **lignes très discrètes** au lieu d'un cadre par tuile.
- **Cartes** : cadres **ardoise arrondis** à liseré or, puits d'art interne, portrait plein cadre,
  **badge de coût violet** dégradé, nom sur bandeau bas, **halo doré** sur la sélection.
- **Mana** : piste sombre, remplissage dégradé + reflet, **10 créneaux** marqués, **badge rond
  chiffré** à gauche.
- **HUD haut** : **pastilles** — timer et vies côte à côte en haut à droite (déplacés pour ne plus
  chevaucher le lien « Passer » de la FTUE), pastille de vague sous le titre.

`HudLayout` (rects de hit-testing) **inchangé** ⇒ aucun risque de dérive du toucher.

**Verrous** : `typecheck` + **126 tests** + `build` verts ; vérif navigateur (champ continu, cartes,
mana, HUD sans collision). **Reste** (documenté) : DA des personnages plus proche de la planche,
écrans hors-combat, décor de bord d'arène.
