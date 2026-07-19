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
