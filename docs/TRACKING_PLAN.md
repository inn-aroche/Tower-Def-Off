# Runeforge Defense — Tracking Plan

## Contexte : palier P-1, local-first

Ce jeu n'a **aucun backend**. Aucun événement ne quitte l'appareil du joueur. `src/tracking/Analytics.ts` implémente un logger local (buffer en mémoire + `localStorage`, capé à 200 événements en rotation FIFO) qui sert à :
- déboguer/QA en local (les événements s'affichent en `console.debug` en mode dev),
- documenter dès maintenant le schéma exact qu'un futur palier (P0, avec backend) devrait envoyer à un vrai outil d'analytics — sans avoir à ré-instrumenter le jeu, seulement à brancher un transport réseau sur `Analytics.track()`.

Aucune donnée personnelle n'est collectée (pas d'identifiant joueur, pas d'IP, pas de device fingerprint) : uniquement des événements de gameplay.

## Comment lire ce document

Chaque événement listé ci-dessous est **implémenté et déclenché réellement** dans le code (colonne "Déclenché par"), pas une spec aspirationnelle. La source de vérité des noms/propriétés est `src/tracking/Analytics.ts` (type `TrackingEvent`) — si ce document et le code divergent un jour, le code fait foi.

## Événements

| Événement | Propriétés | Déclenché par | Sert à mesurer |
|---|---|---|---|
| `app_open` | *(aucune)* | Tap sur "Jouer" à l'écran titre | Nombre de sessions démarrées |
| `class_selected` | `class_id`, `is_first_pick` | Confirmation d'un choix de classe | Répartition des classes choisies ; `is_first_pick` distingue le premier choix (onboarding) d'un changement ultérieur |
| `class_switched` | `from`, `to` | *(réservé — voir note ci-dessous)* | Fréquence de changement de classe |
| `run_start` | `class_id`, `map_id`, `starting_gold` | Sélection d'une carte, début du run | Distribution classe × carte ; `starting_gold` capture déjà le bonus économie de l'arbre |
| `wave_start` | `wave`, `is_boss_wave` | Tap sur "Lancer la vague" | Progression moyenne par run, taux d'atteinte des vagues boss |
| `wave_cleared` | `wave`, `gold`, `keep_hp_pct` | Toutes les vagues d'une vague sont mortes/arrivées | Marge de survie réelle (`keep_hp_pct`) — sert à détecter une difficulté trop punitive |
| `tower_placed` | `tower_kind`, `cost`, `wave` | Placement réussi d'une tour | Popularité des tours, courbe de dépense |
| `tower_upgraded` | `tower_kind`, `tier`, `cost`, `wave` | Amélioration réussie | Vitesse de montée en puissance |
| `tower_sold` | `tower_kind`, `tier`, `refund`, `wave` | Vente d'une tour | Taux d'erreurs de placement (ventes = replanification) |
| `ultimate_used` | `class_id`, `wave` | Activation réussie de l'ultime | Taux d'usage de la capacité signature par classe |
| `run_end` | `reason` (`defeat`\|`quit`), `waves_survived`, `kills`, `essence_earned`, `duration_s` | Défaite (PV Donjon = 0) ou abandon via Pause | **Métrique clé** : `duration_s` valide la cible de session 5–15 min (voir `docs/ECONOMY_SIMULATION.md`) ; `reason` distingue abandon volontaire et défaite |
| `skill_node_unlocked` | `class_id`, `branch`, `tier`, `essence_spent` | Déblocage d'un nœud dans l'arbre | Branches privilégiées par classe, vitesse de complétion de l'arbre |
| `settings_changed` | `key`, `value` | Modification d'un réglage | Taux d'usage des réglages (ex : désactivation du son) |

**Note sur `class_switched`** : le type d'événement existe dans le schéma (`Analytics.ts`) mais n'est pas encore câblé côté UI — le bouton "Changer de classe" renvoie actuellement vers l'écran de sélection, qui émet `class_selected` avec `is_first_pick: false`. Émettre `class_switched` en plus demanderait de connaître l'ancienne classe au moment du clic ; laissé pour une itération future plutôt que de complexifier `UIManager` dans ce one-shot. Non-bloquant : `class_selected.is_first_pick=false` capture déjà le signal "changement de classe".

## Ce que ce plan permet de répondre, une fois des données réelles collectées

- **La session dure-t-elle 5–15 min comme visé ?** → distribution de `run_end.duration_s`.
- **La difficulté est-elle punitive ?** → distribution de `wave_cleared.keep_hp_pct` (si beaucoup de valeurs proches de 0, la marge est trop fine) et ratio `run_end.reason=defeat` vs `quit`.
- **L'arbre de compétences est-il engageant ?** → fréquence de `skill_node_unlocked` par session revenante (nécessite un identifiant de session pour agréger — hors scope P-1, à ajouter avec le backend P0).
- **Quelle classe/tour est sur- ou sous-utilisée ?** → distribution de `class_selected` et `tower_placed`.
- **L'ultime de chaque classe est-il utile ou ignoré ?** → fréquence de `ultimate_used` rapportée au nombre de vagues jouées.

## Hors scope à ce palier (P-1)

- Pas d'identifiant utilisateur persistant inter-appareils (pas de compte).
- Pas d'envoi réseau, pas de tiers (aucun SDK analytics externe).
- Pas de rétention/funnel cross-session — chaque appareil ne connaît que son propre historique local, écrasé au-delà de 200 événements.

## Feuille de route P0 (si un backend est ajouté un jour)

1. Remplacer le `localStorage` de `Analytics.track()` par un envoi batché vers un endpoint (garder le même schéma d'événements — zéro ré-instrumentation du gameplay).
2. Ajouter un identifiant de session anonyme (UUID généré côté client, pas de PII) pour permettre l'agrégation par session/rétention.
3. Ajouter un consentement explicite avant tout envoi réseau (actuellement non nécessaire : rien ne sort de l'appareil).
