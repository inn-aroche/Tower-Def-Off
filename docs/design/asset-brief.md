# WARDENS — Brief d'assets visuels (pour génération IA)

> But : produire un jeu de tower-defense mobile **stylisé cartoon**, lisible sur petit écran, chaleureux
> (bois/or/crème), lecture du plateau légèrement en plongée. À coller à un générateur d'images (Gemini/Imagen).
>
> **Mode d'emploi** : préfixe **l'Art Bible** ci-dessous à *chaque* prompt, puis génère les assets un par un
> avec le prompt de chaque ligne. Respecte **le nom de fichier** (= id dans le code) pour un branchement direct.

---

## 0) ART BIBLE — à préfixer à chaque prompt

```
Style: mobile game asset, stylized cartoon / "chibi" fantasy, clean thick outlines, soft cel shading,
rounded friendly shapes, high readability at small size (must read clearly at 48px). Consistent 3/4
top-down view (as seen on a tower-defense board tilted ~35° toward the camera). Single soft light from
top-left, gentle contact shadow. Warm storybook fantasy mood. NO text, NO logos, NO UI frame, NO
background — fully TRANSPARENT background, subject centered with ~10% padding. Cohesive palette:
parchment cream #efe8d6, warm brown #3b2a1a, gold #e8b923, gem purple #9b59b6, leaf green #4caf50,
sky blue #4a90c4, teal #1aa39a. Output: PNG-24 with alpha, square canvas 512×512.
```

**Règles techniques (valables partout)**
- Fond **transparent**, sujet **centré**, silhouette lisible à 48 px.
- Lumière **haut-gauche** constante, petite ombre de contact.
- **Un fichier = un id de code** (voir noms ci-dessous), en minuscules, `snake_case`.
- Fournir en **512×512** pour les sprites de plateau (le jeu les affiche ~48–64 px, marge pour le @2x/@3x).
- Fonds/écrans : voir tailles indiquées.
- Palette **verrouillée** (les hex ci-dessus) — pas de couleurs hors palette sauf accents d'ennemi indiqués.
- **Perspective identique** pour toutes les unités et tous les ennemis (ils cohabitent sur la même grille).

---

## 1) UNITÉS JOUEUR — 12 unités × 3 paliers de fusion = **36 sprites** (min. 12 si budget serré)

Le jeu **fusionne** les unités (niv 1→2→3) : idéalement 3 variantes qui montent en puissance visuelle
(niv 1 = simple, niv 2 = équipement amélioré + aura légère, niv 3 = version « héroïque » brillante).
Nom de fichier : `unit_<id>_t1.png`, `_t2.png`, `_t3.png`. Familles : **melee** (accent bleu #4a90c4),
**ranged** (accent vert #4caf50), **gravity** (accent teal #1aa39a, arcane/tech, pas d'arme).

| # | id | Nom (FR) | Famille · Rareté | Prompt sujet |
|---|----|----------|------------------|--------------|
| 1 | `swordsman` | Épéiste | melee · commune | jeune fantassin humain, armure de cuir et plaques de fer, courte épée, tabard bleu |
| 2 | `archer` | Archère | ranged · commune | archère à capuche verte, arc long, carquois, feuillage |
| 3 | `lancer` | Lancier | melee · commune | lancier à longue portée, armure légère bleue, longue lance |
| 4 | `scout` | Éclaireuse | ranged · commune | éclaireuse agile et légère, dagues de lancer, cape courte verte, sensation de vitesse |
| 5 | `catapult` | Catapulte | ranged · rare | petite catapulte de siège en bois, rocher prêt, servie par un artisan |
| 6 | `guardian` | Gardien | melee · rare | chevalier lourd à grand bouclier, très défensif, armure bleu acier |
| 7 | `frost_archer` | Archère de givre | ranged · rare | archère de glace, arc gelé, accents bleu pâle et blanc, souffle de givre |
| 8 | `gravity_well` | Puits de gravité | gravity · commune | obélisque/orbe arcanique flottant émettant un champ teal, aucune arme |
| 9 | `repulsor` | Répulseur | gravity · rare | pylône arcane/tech repoussant vers l'extérieur, ondes teal |
| 10 | `golem` | Golem de pierre | melee · épique | grand golem de pierre imposant, fissures lumineuses, mousse |
| 11 | `storm_caller` | Chaman des tempêtes | ranged · épique | chaman à bâton, nuages d'orage, éclairs, accents violet/or épiques |
| 12 | `singularity` | Singularité | gravity · épique | dispositif contenant un mini trou noir, vortex de vide, violet + teal, très puissant |

> Astuce paliers : t1 = base ; t2 = même perso, meilleur équipement + légère lueur de rareté ;
> t3 = version « héroïque », effet lumineux, pose plus dynamique.

---

## 2) ENNEMIS — **12 sprites** (bosses plus grands)

Nom de fichier : `enemy_<id>.png`. Vue et style identiques aux unités. Les **bosses** sont ~1,5× plus
grands, avec **couronne** et un motif de capacité. Accents de couleur indiqués = teinte dominante.

**Basiques**
| id | Nom | Prompt sujet |
|----|-----|--------------|
| `goblin` | Gobelin | petit gobelin vert, arme grossière, expressif (accent #c79a6a) |
| `runner` | Coureur | gobelin maigre et ultra-rapide, posture de course, poussière de vitesse (accent #f0c46a) |
| `brute` | Brute | grosse brute musclée type ogre, gourdin, trapue (accent #c98a8a) |
| `troll` | Troll | énorme troll lent, masse de PV, imposant mur de chair (accent #a98acb) |

**Élites** (motif de trait visible)
| id | Nom | Prompt sujet |
|----|-----|--------------|
| `wraith` | Spectre volant | spectre volant translucide, ailes fantomatiques, **flotte** au-dessus du sol (bleu-violet #7f8fd0) |
| `saboteur` | Saboteur | gobelin kamikaze couvert de dynamite/bombes, mèche allumée, menaçant (rouge #c0392b) |
| `juggernaut` | Juggernaut | bête/chevalier lourdement **blindé**, plaques métalliques épaisses, boulons (gris acier #5d6d7e) |
| `ogre` | Ogre régénérant | ogre vert dont la chair **se régénère**, veines vertes lumineuses, motif de soin (vert #5a7d3c) |

**Bosses** (grands, couronnés)
| id | Nom | Prompt sujet |
|----|-----|--------------|
| `warlord` | Seigneur de guerre | seigneur de guerre en armure, bannière, **onde de choc** (paralysie), couronne, rouge sombre #a83232 |
| `necromancer` | Nécromancien | nécromancien en robe, bâton, **invoque** des sbires, aura violette #5b3a6e, couronne |
| `stone_colossus` | Colosse de pierre | titan de pierre géant, **bouclier** d'énergie, blindé, gris #6b6b6b, couronne |
| `high_priestess` | Grande Prêtresse | prêtresse sombre, **aura de soin** rayonnante, lilas #c9a0dc, couronne |

---

## 3) PLATEAU & ENVIRONNEMENT

Le plateau est une grille **6×10**. Nom : `board_<...>.png`.

| id | Taille | Prompt |
|----|--------|--------|
| `tile_grass_a` | 256×256 (tileable) | tuile d'herbe stylisée claire, subtile, top-down, bords raccordables |
| `tile_grass_b` | 256×256 (tileable) | tuile d'herbe variante légèrement plus foncée (damier) |
| `tile_path_straight` | 256×256 | tuile de chemin de terre/pierre clair, top-down, raccordable |
| `tile_path_corner` | 256×256 | tuile de chemin en angle (virage) |
| `base_core` | 512×512 | le **cœur à défendre** en bout de chemin : petit donjon/cristal fortifié, drapeau |
| `spawn_portal` | 512×512 | **portail d'apparition** des ennemis (faille/portail sombre) |
| `decor_props` | planche 1024×1024 | props décoratifs séparés (rochers, arbustes, torches, souche) sur fond transparent |
| `bg_combat` | 1440×2560 (portrait) | fond illustré derrière le plateau : lisière de forêt fantasy, ambiance chaleureuse, flou léger |

---

## 4) EFFETS (VFX) — sprites ou planches d'animation

Nom : `fx_<id>.png` (ou planche `fx_<id>_sheet.png`, préciser nb de frames). Fond transparent.

| id | Prompt |
|----|--------|
| `fx_hit` | petite étincelle d'impact jaune (#ffe9a8), 1 frame ou 4 frames |
| `fx_merge` | éclat doré + anneau lumineux (fusion réussie), 6 frames |
| `fx_death` | bouffée de fumée/poussière à la mort d'un ennemi, 6 frames |
| `fx_stun` | éclairs bleus ⚡ + anneau (unité paralysée), 4 frames |
| `fx_shield` | bulle de bouclier bleu translucide (#78beff) |
| `fx_heal_aura` | anneau/particules verts de soin |
| `fx_boss_spawn` | onde de choc au sol orange (#ffb347) à l'arrivée d'un boss, 6 frames |
| `fx_summon` | petit anneau d'invocation violet |
| `proj_arrow` | flèche stylisée (projectile ranged) |
| `proj_boulder` | rocher de catapulte |
| `proj_ice` | éclat de glace (archère de givre) |
| `proj_bolt` | éclair (chaman des tempêtes) |
| `field_gravity` | texture radiale teal semi-transparente (champ de gravité au sol) |

---

## 5) KIT UI & ICÔNES

Nom : `ui_<id>.png` / `icon_<id>.png`. Style cohérent (bois/or/crème, contours nets).

| id | Taille | Prompt |
|----|--------|--------|
| `frame_common` / `frame_rare` / `frame_epic` | 256×256 | cadres de carte/tuile par rareté (bleu / vert / violet-or), 9-slice friendly |
| `icon_family_melee` | 128×128 | icône épée (famille mêlée, bleu) |
| `icon_family_ranged` | 128×128 | icône arc/flèche (famille distance, vert) |
| `icon_family_gravity` | 128×128 | icône orbe/anneau arcane (famille gravité, teal) |
| `icon_mana` | 128×128 | orbe de mana violet brillant |
| `icon_heart` | 128×128 | cœur de vie rouge stylisé |
| `icon_coin` | 128×128 | pièce d'or |
| `icon_gem` | 128×128 | gemme violette taillée |
| `icon_star_on` / `icon_star_off` | 128×128 | étoile pleine (or) / vide (grise) |
| `icon_nav_collection` | 96×96 | icône grille (collection) |
| `icon_nav_play` | 96×96 | icône lecture/épées (jouer) |
| `icon_nav_shop` | 96×96 | icône diamant/boutique |
| `ui_button_wood` | 512×192 | bouton bois/or « juicy » (9-slice), état repos |
| `ui_panel_parchment` | 512×512 | panneau parchemin (9-slice) |
| `ui_wave_banner` | 512×160 | bandeau « vague » en bois |

---

## 6) COFFRES & LIGUES

| id | Taille | Prompt |
|----|--------|--------|
| `chest_common_closed` / `chest_common_open` | 512×512 | coffre en bois commun, états fermé + ouvert lumineux |
| `chest_epic_closed` / `chest_epic_open` | 512×512 | coffre épique doré/violet, états fermé + ouvert avec rayons |
| `league_wood` | 256×256 | écusson de ligue **Bois** |
| `league_bronze` | 256×256 | écusson **Bronze** |
| `league_silver` | 256×256 | écusson **Argent** |
| `league_gold` | 256×256 | écusson **Or** |
| `league_platinum` | 256×256 | écusson **Platine** (le plus prestigieux) |

---

## 7) BRANDING & STORE (obligatoire pour publier)

| id | Taille | Prompt |
|----|--------|--------|
| `app_icon` | 1024×1024 | icône d'app : un bouclier héroïque WARDENS avec épées croisées, lisible en tout petit, fond plein |
| `icon_adaptive_fg` / `icon_adaptive_bg` | 1024×1024 | Android adaptive : premier plan (bouclier) sur transparent + fond plein séparé |
| `splash` | 2048×2048 | écran de démarrage : logo WARDENS centré sur fond parchemin/forêt |
| `logo_wordmark` | 2048×512 | logotype « WARDENS » fantasy, lettres bois/or, contours nets, transparent |
| `store_feature_graphic` | 1024×500 | bannière Play Store : héros + ennemis, ambiance, place pour le titre |
| `store_screenshots` | 1080×1920 ×5 | gabarits de captures (combat, fusion, boss, arène, survie) avec accroche |

---

## 8) PORTRAITS DE BOSS (optionnel mais fort effet)

Nom : `portrait_<bossid>.png`, 768×768, buste illustré (pour l'intro de boss / écran de résultats).
Bosses : `warlord`, `necromancer`, `stone_colossus`, `high_priestess`.

---

## 9) AUDIO (hors Gemini image — pour info / autre outil)

Pas de la génération d'image, mais fait partie de la « direction » — à confier à un outil audio / sound designer :
- **Musique** : thème Hub (calme héroïque), thème Combat (tension montante), thème Boss, jingle Victoire/Défaite. Boucles ~60–90 s.
- **SFX** (aujourd'hui synthétisés) à remplacer par du mixé : invocation, **fusion** (son signature), tir par famille, impact, mort, arrivée de boss, paralysie, soin, clic UI, ouverture de coffre.

---

## Priorités si le budget d'assets est limité
1. **12 unités (t1) + 12 ennemis** → transforme immédiatement le rendu.
2. **Tuiles plateau + base + portail + fond combat** → l'arène « respire ».
3. **App icon + logo + 5 captures store** → publiable.
4. Ensuite : paliers de fusion t2/t3, VFX, portraits de boss, coffres, écussons.

## Récap quantités
- Unités : 12 (base) → 36 (avec paliers)
- Ennemis : 12
- Plateau/env : ~8
- VFX : ~13
- UI/icônes : ~20
- Coffres/ligues : ~9
- Branding/store : ~10
- Portraits boss : 4
**Total ≈ 76 assets** (≈ 52 si on saute paliers de fusion + portraits).
