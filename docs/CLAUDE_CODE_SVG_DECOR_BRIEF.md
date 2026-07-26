# Brief Claude Code — Assets décor SVG

Créer et maintenir des éléments de décor obligatoirement en SVG pour le jeu mobile tower defense.

## Direction artistique
- Cartoon mobile game moderne
- Vue top-down / 3-4
- Fond transparent
- Formes simples, shading léger
- Pas de contour noir épais
- Ombre douce intégrée
- Lisible sur mobile entre 64px et 160px

## Contraintes techniques
- Un fichier SVG par asset
- `viewBox="0 0 256 256"`
- Pas d'image raster embarquée
- Utiliser uniquement des formes SVG natives : `path`, `rect`, `circle`, `ellipse`, `polygon`, `linearGradient`
- Nommage en `snake_case`

## Biomes
Forêt : pine_tree, round_tree, bush, flower_patch, mushroom_cluster, rock_cluster, fence_segment, stump, crystal_cluster.

Canyon : cactus, bone_pile, skull_rock, dead_tree, dry_bush, wooden_sign, sandstone_rock.

Marais : lily_pond, twisted_root, toxic_mushroom, swamp_grass, broken_totem, slime_puddle, glowing_reed.

## Usage gameplay
Les assets doivent décorer les bords de map et les cases inactives sans gêner la lecture du chemin, des ennemis ou des unités.
