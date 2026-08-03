"""Build, rig, animate and render a WARDENS character in Blender (headless).

Run:  python3 scripts/blender/build_character.py <character-id> <out-dir>

Why a script and not a hand-made model: the whole point is that every frame of every clip comes
from the SAME model under the SAME camera. That is what the AI-generated frame packs could not
give us — there, the character silhouette drifted between frames. Here it cannot, by construction.

The character is a chibi built from primitives, rigid-parented to an armature (each body part
follows one bone). Chibi proportions are blocky enough that rigid parts read fine, and rigid
parenting is far more reliable to script than skin weights.

Output: frames/<clip>/<id>_<clip>_NN.png + <id>.animations.json, in the exact layout that
scripts/build-animations.py already consumes.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

# ── character library ────────────────────────────────────────────────────────
# Everything that differs between characters lives here, so adding a unit is data, not code.
STEEL = (0.55, 0.57, 0.62, 1)
GOLD = (0.85, 0.66, 0.20, 1)


def unit(archetype, cloth, cloth2, *, skin=(0.94, 0.76, 0.60, 1), metal=STEEL, glow=GOLD,
         ears='none', hood=False, prop=None, shield=False, clips=('idle', 'attack'), **extra):
    """One roster entry. Keeping these as data is what makes 'do it for every unit' tractable."""
    return {'archetype': archetype, 'skin': skin, 'cloth': cloth, 'cloth2': cloth2, 'metal': metal,
            'glow': glow, 'ears': ears, 'hood': hood, 'prop': prop, 'shield': shield,
            'clips': list(clips), **extra}


GREEN_CLOTH = (0.16, 0.42, 0.20, 1)
BROWN = (0.40, 0.24, 0.12, 1)
ICE = (0.55, 0.82, 0.92, 1)
ARCANE = (0.34, 0.20, 0.48, 1)

CHARACTERS = {
    # ── enemies: they march and they die, they never stop to fight ──────────────
    'goblin': {
        'archetype': 'humanoid', 'skin': (0.30, 0.62, 0.10, 1), 'cloth': (0.40, 0.20, 0.08, 1),
        'cloth2': (0.14, 0.22, 0.08, 1), 'metal': STEEL, 'glow': (1.0, 0.52, 0.06, 1),
        'ears': 'long', 'hood': True, 'prop': 'lantern', 'shield': False,
        'clips': ['idle', 'walk', 'attack', 'death'],
    },

    # ── defensive units: they hold a cell and strike from it ───────────────────
    'swordsman': unit('humanoid', (0.42, 0.45, 0.52, 1), (0.30, 0.20, 0.14, 1),
                      prop='sword', shield=True, helmet='plain', glow=(0.30, 0.62, 0.95, 1)),
    'archer': unit('humanoid', GREEN_CLOTH, BROWN, hood=True, prop='bow'),
    'lancer': unit('humanoid', (0.38, 0.41, 0.48, 1), (0.26, 0.28, 0.34, 1),
                   prop='spear', shield=True, glow=(0.30, 0.62, 0.95, 1), helmet='horned'),
    'scout': unit('humanoid', (0.22, 0.46, 0.24, 1), BROWN, hood=True, prop='sword'),
    'catapult': unit('machine', (0.44, 0.28, 0.14, 1), (0.30, 0.19, 0.10, 1),
                     glow=(0.52, 0.50, 0.48, 1)),
    'guardian': unit('humanoid', (0.46, 0.49, 0.56, 1), (0.20, 0.34, 0.55, 1),
                     prop='spear', shield=True, glow=(0.30, 0.62, 0.95, 1), helmet='plume'),
    'frost_archer': unit('humanoid', (0.62, 0.80, 0.90, 1), (0.75, 0.72, 0.40, 1),
                         hood=True, prop='bow', glow=ICE),
    'gravity_well': unit('arcane', (0.24, 0.20, 0.32, 1), (0.18, 0.15, 0.26, 1),
                         glow=(0.60, 0.25, 0.90, 1), core='ring'),
    'repulsor': unit('arcane', (0.26, 0.22, 0.34, 1), (0.18, 0.15, 0.26, 1),
                     glow=(0.72, 0.35, 0.95, 1)),
    'golem': unit('golem', (0.44, 0.34, 0.24, 1), (0.34, 0.26, 0.18, 1),
                  glow=(0.55, 0.90, 0.25, 1)),
    'storm_caller': unit('humanoid', (0.16, 0.28, 0.52, 1), GOLD, hood=True, prop='staff',
                         glow=(0.40, 0.80, 1.0, 1)),
    'singularity': unit('arcane', (0.20, 0.16, 0.30, 1), (0.14, 0.12, 0.22, 1),
                        glow=(0.85, 0.45, 1.0, 1), core='vortex'),

    # ── offensive units: these march up the path, so they need a walk cycle ────
    'raider': unit('humanoid', (0.44, 0.26, 0.14, 1), (0.28, 0.18, 0.10, 1), skin=(0.32, 0.60, 0.14, 1),
                   ears='long', hood=True, prop='axe', clips=('idle', 'walk', 'attack')),
    'skirmisher': unit('humanoid', (0.28, 0.44, 0.26, 1), BROWN, hood=True, prop='bow',
                       clips=('idle', 'walk', 'attack')),
    'champion': unit('humanoid', (0.50, 0.42, 0.22, 1), (0.34, 0.26, 0.16, 1), metal=GOLD,
                     prop='sword', shield=True, helmet='crested', clips=('idle', 'walk', 'attack')),
}

CLIPS = {
    'idle': {'frames': 4, 'fps': 4, 'loop': True},
    'walk': {'frames': 8, 'fps': 9, 'loop': True},
    'attack': {'frames': 5, 'fps': 10, 'loop': False},
    'death': {'frames': 10, 'fps': 9, 'loop': False},
}

RES = 192


# ── helpers ──────────────────────────────────────────────────────────────────
def material(name, rgba, emission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = 0.75
    if emission:
        bsdf.inputs['Emission Color'].default_value = rgba
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


_ink = None


def ink_material():
    """The outline shell's material.

    Cycles has no backface culling, so a plain black shell just paints over the whole character
    (first attempt: a black silhouette). Instead the material culls by hand — the shell's normals
    are flipped, so the faces near the camera read as *backfacing* and are made transparent, while
    the far faces emit black and are only visible where they poke past the model's silhouette.
    """
    global _ink
    if _ink is None:
        _ink = bpy.data.materials.new('ink')
        _ink.use_nodes = True
        nt = _ink.node_tree
        nt.nodes.remove(nt.nodes['Principled BSDF'])
        out = nt.nodes['Material Output']
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        path = nt.nodes.new('ShaderNodeLightPath')
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (0.05, 0.036, 0.030, 1)
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        front = nt.nodes.new('ShaderNodeMath')
        front.operation = 'SUBTRACT'
        front.inputs[0].default_value = 1.0
        visible = nt.nodes.new('ShaderNodeMath')
        visible.operation = 'MULTIPLY'
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(geo.outputs['Backfacing'], front.inputs[1])       # 1 - backfacing
        nt.links.new(front.outputs['Value'], visible.inputs[0])
        # …and only for camera rays. Otherwise the shell blocks light and the character renders
        # inside its own shadow — which is exactly what happened on the first working outline.
        nt.links.new(path.outputs['Is Camera Ray'], visible.inputs[1])
        nt.links.new(visible.outputs['Value'], mix.inputs['Fac'])
        nt.links.new(tr.outputs['BSDF'], mix.inputs[1])
        nt.links.new(em.outputs['Emission'], mix.inputs[2])
        nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    return _ink


def shape(kind, name, loc, scale, mat, rot=(0, 0, 0), outline=0.04):
    """A primitive with a dark contour.

    The contour is an inverted hull: a Solidify modifier grows a shell outwards with flipped
    normals and a second material slot, so the black shell only shows where it pokes past the
    silhouette. That's the classic toon outline — and it works in Cycles, unlike Freestyle, which
    crashes every frame on headless Blender 5.
    """
    if kind == 'sphere':
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=loc)
    elif kind == 'cone':
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=1, depth=2, location=loc)
    elif kind == 'cylinder':
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=1, depth=2, location=loc)
    elif kind == 'torus':
        bpy.ops.mesh.primitive_torus_add(major_segments=28, minor_segments=10,
                                         major_radius=1, minor_radius=0.28, location=loc)
    else:
        bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    ob.rotation_euler = rot
    ob.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    if outline:
        ob.data.materials.append(ink_material())
        mod = ob.modifiers.new('outline', 'SOLIDIFY')
        # Thickness is local, and the parts are scaled non-uniformly, so there is no single
        # "correct" value. Dividing by the SMALLEST axis turned flat parts (brows, ears) into black
        # blobs; the largest axis keeps the contour thin enough to read as a line everywhere.
        mod.thickness = outline / max(1e-3, max(abs(s) for s in scale))
        mod.offset = 1
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.material_offset = 1
        mod.material_offset_rim = 1
    return ob


def build_humanoid(spec):
    """A chibi character. Z is up, the character faces -Y (toward the camera)."""
    skin = material('skin', spec['skin'])
    cloth = material('cloth', spec['cloth'])
    cloth2 = material('cloth2', spec['cloth2'])
    metal = material('metal', spec['metal'])
    glow = material('glow', spec['glow'], emission=3.0)

    parts = {'hips': [], 'torso': [], 'head': [], 'arm.L': [], 'arm.R': [], 'leg.L': [], 'leg.R': []}

    parts['hips'].append(shape('sphere', 'pelvis', (0, 0, 0.62), (0.30, 0.26, 0.20), cloth2))
    parts['torso'].append(shape('sphere', 'chest', (0, 0, 0.86), (0.34, 0.29, 0.28), cloth))
    # belt hugs the waist (a flat cube reads as a plank sticking out of the body)
    parts['torso'].append(shape('sphere', 'belt', (0, 0, 0.68), (0.33, 0.28, 0.055), cloth2))
    parts['torso'].append(shape('cube', 'buckle', (0, -0.26, 0.68), (0.055, 0.03, 0.05), metal, outline=0))
    parts['torso'].append(
        shape('sphere', 'pauldron', (0.34, -0.05, 1.00), (0.17, 0.15, 0.07), metal, rot=(0, 0.5, 0)))

    parts['head'].append(shape('sphere', 'head', (0, 0, 1.32), (0.42, 0.40, 0.40), skin))
    if spec['ears'] == 'long':
        for side, sx in (('L', 1), ('R', -1)):
            parts['head'].append(
                shape('cone', f'ear.{side}', (sx * 0.40, 0.02, 1.46), (0.09, 0.05, 0.30), skin,
                      rot=(0, sx * 1.15, 0)))
    helmet = spec.get('helmet')
    if helmet:
        parts['head'].append(shape('sphere', 'helm', (0, 0.02, 1.40), (0.44, 0.42, 0.34), metal))
        parts['head'].append(shape('sphere', 'visor', (0, -0.20, 1.28), (0.40, 0.26, 0.10), metal))
        if helmet == 'horned':
            for side, sx in (('L', 1), ('R', -1)):
                parts['head'].append(
                    shape('cone', f'horn.{side}', (sx * 0.40, 0.04, 1.60), (0.08, 0.08, 0.26), glow,
                          rot=(0, sx * 0.7, 0)))
        elif helmet == 'crested':
            parts['head'].append(shape('sphere', 'crest', (0, 0.10, 1.70), (0.05, 0.20, 0.14), glow))
        elif helmet == 'plume':
            parts['head'].append(shape('cone', 'plume', (0, 0.16, 1.72), (0.10, 0.10, 0.20), glow,
                                       rot=(0.5, 0, 0)))
    if spec['hood']:
        # hood shell: a slightly larger sphere pushed back, open at the face
        parts['head'].append(shape('sphere', 'hood', (0, 0.16, 1.44), (0.45, 0.42, 0.40), cloth))
        parts['head'].append(shape('cone', 'hoodtip', (0, 0.34, 1.60), (0.20, 0.20, 0.26), cloth,
                                   rot=(1.1, 0, 0)))

    # A face is what turns a blob into a character: brow, eyes, pupils.
    white = material('eye', (0.98, 0.85, 0.20, 1), emission=0.6)
    black = material('pupil', (0.05, 0.04, 0.04, 1))
    for side, sx in (('L', 1), ('R', -1)):
        parts['head'].append(
            shape('sphere', f'eye.{side}', (sx * 0.16, -0.33, 1.36), (0.10, 0.05, 0.07), white,
                  outline=0))
        parts['head'].append(
            shape('sphere', f'pupil.{side}', (sx * 0.16, -0.37, 1.35), (0.035, 0.03, 0.045), black,
                  outline=0))
        parts['head'].append(
            shape('cube', f'brow.{side}', (sx * 0.17, -0.34, 1.45), (0.11, 0.02, 0.022), cloth,
                  rot=(0, 0, sx * -0.35), outline=0))
    parts['head'].append(shape('sphere', 'snout', (0, -0.33, 1.22), (0.15, 0.10, 0.09), skin))

    for side, sx in (('L', 1), ('R', -1)):
        parts[f'arm.{side}'].append(
            shape('sphere', f'arm.{side}', (sx * 0.40, 0, 0.86), (0.13, 0.13, 0.24), cloth))
        parts[f'arm.{side}'].append(
            shape('sphere', f'hand.{side}', (sx * 0.42, -0.02, 0.64), (0.12, 0.12, 0.11), skin))
        parts[f'leg.{side}'].append(
            shape('sphere', f'leg.{side}', (sx * 0.17, 0, 0.30), (0.14, 0.14, 0.28), cloth2))
        parts[f'leg.{side}'].append(
            shape('sphere', f'foot.{side}', (sx * 0.17, -0.08, 0.09), (0.16, 0.20, 0.09), cloth))

    add_prop(parts, spec, skin, cloth, metal, glow)
    return rig(parts)


def add_prop(parts, spec, skin, cloth, metal, glow):
    """Weapons and held items. The hand they hang from is arm.R, so they follow the attack swing."""
    prop = spec.get('prop')
    if prop == 'lantern':
        parts['arm.R'].append(shape('sphere', 'lantern', (-0.50, -0.16, 0.56), (0.16, 0.16, 0.16), glow))
    elif prop == 'sword':
        parts['arm.R'].append(shape('cube', 'blade', (-0.52, -0.10, 0.92), (0.035, 0.02, 0.34), metal,
                                    rot=(0.25, 0, 0)))
        parts['arm.R'].append(shape('cube', 'guard', (-0.52, -0.10, 0.60), (0.12, 0.05, 0.03), cloth))
    elif prop == 'axe':
        parts['arm.R'].append(shape('cylinder', 'haft', (-0.52, -0.10, 0.80), (0.026, 0.026, 0.28), cloth))
        parts['arm.R'].append(shape('cube', 'head.axe', (-0.60, -0.10, 1.00), (0.13, 0.04, 0.13), metal,
                                    rot=(0, 0.3, 0)))
    elif prop == 'spear':
        parts['arm.R'].append(shape('cylinder', 'shaft', (-0.52, -0.10, 0.92), (0.024, 0.024, 0.48), cloth))
        parts['arm.R'].append(shape('cone', 'tip', (-0.52, -0.10, 1.44), (0.055, 0.055, 0.12), metal))
    elif prop == 'bow':
        parts['arm.R'].append(shape('torus', 'bow', (-0.50, -0.12, 0.80), (0.30, 0.09, 0.30), cloth,
                                    rot=(0, 0.25, 0)))
        parts['arm.R'].append(shape('cylinder', 'arrow', (-0.50, -0.16, 0.80), (0.014, 0.014, 0.22), metal,
                                    rot=(math.pi / 2, 0, 0)))
    elif prop == 'staff':
        parts['arm.R'].append(shape('cylinder', 'staff', (-0.52, -0.10, 0.92), (0.026, 0.026, 0.50), cloth))
        parts['arm.R'].append(shape('sphere', 'orb', (-0.52, -0.10, 1.46), (0.13, 0.13, 0.13), glow))
    if spec.get('shield'):
        parts['arm.L'].append(shape('sphere', 'shield', (0.50, -0.16, 0.80), (0.24, 0.07, 0.28), metal))
        parts['arm.L'].append(shape('sphere', 'boss', (0.50, -0.24, 0.80), (0.09, 0.04, 0.10), glow))


def rig(parts):
    """Binds the parts to a shared 8-bone skeleton. Every archetype uses the same bone names, so
    one set of animation functions drives characters, siege engines and arcane devices alike."""
    # ── armature ────────────────────────────────────────────────────────────
    bpy.ops.object.armature_add(location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = 'rig'
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    eb.remove(eb[0])

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        if parent:
            b.parent = eb[parent]
        return b

    bone('root', (0, 0, 0), (0, 0, 0.5))
    bone('hips', (0, 0, 0.55), (0, 0, 0.75), 'root')
    bone('torso', (0, 0, 0.75), (0, 0, 1.10), 'hips')
    bone('head', (0, 0, 1.10), (0, 0, 1.60), 'torso')
    for side, sx in (('L', 1), ('R', -1)):
        bone(f'arm.{side}', (sx * 0.36, 0, 1.02), (sx * 0.42, 0, 0.60), 'torso')
        bone(f'leg.{side}', (sx * 0.17, 0, 0.55), (sx * 0.17, 0, 0.05), 'hips')
    bpy.ops.object.mode_set(mode='OBJECT')

    # Bone parenting puts the child's origin at the bone TAIL, not its head — computing the
    # parent-inverse by hand got every part offset by one bone length. Instead: remember each
    # part's world matrix, parent it, then restore that matrix so nothing moves at bind time.
    bpy.context.view_layer.update()
    for bone_name, meshes in parts.items():
        for m in meshes:
            world = m.matrix_world.copy()
            m.parent = arm
            m.parent_type = 'BONE'
            m.parent_bone = bone_name
            bpy.context.view_layer.update()
            m.matrix_world = world
    bpy.context.view_layer.update()
    return arm


def build_machine(spec):
    """A siege engine: wheeled frame + a throwing arm bound to arm.R so 'attack' recoils it."""
    wood = material('wood', spec['cloth'])
    metal = material('metal', spec['metal'])
    glow = material('glow', spec['glow'], emission=3.0)
    parts = {'hips': [], 'torso': [], 'head': [], 'arm.L': [], 'arm.R': [], 'leg.L': [], 'leg.R': []}
    parts['hips'].append(shape('cube', 'frame', (0, 0, 0.34), (0.42, 0.30, 0.16), wood))
    parts['hips'].append(shape('cube', 'beam', (0, 0, 0.54), (0.12, 0.26, 0.10), wood))
    for side, sx in (('L', 1), ('R', -1)):
        for j, fy in ((0, -0.24), (1, 0.24)):
            parts['hips'].append(
                shape('cylinder', f'wheel.{side}{j}', (sx * 0.44, fy, 0.20), (0.19, 0.19, 0.07), wood,
                      rot=(0, math.pi / 2, 0)))
    if spec.get('barrel') == 'cannon':
        parts['arm.R'].append(shape('cylinder', 'barrel', (0, -0.10, 0.72), (0.20, 0.20, 0.40), metal,
                                    rot=(math.radians(74), 0, 0)))
        parts['arm.R'].append(shape('torus', 'muzzle', (0, -0.36, 0.83), (0.21, 0.21, 0.21), metal,
                                    rot=(math.radians(74), 0, 0)))
    else:
        parts['arm.R'].append(shape('cube', 'throwarm', (0, 0.18, 0.86), (0.055, 0.42, 0.05), wood,
                                    rot=(math.radians(-30), 0, 0)))
        parts['arm.R'].append(shape('sphere', 'boulder', (0, 0.52, 1.12), (0.19, 0.19, 0.19), glow))
    return rig(parts)


def build_arcane(spec):
    """A gravity device: a stone base with a floating core bound to 'head', so the shared idle
    animation makes it hover and the attack pose makes it lurch."""
    stone = material('stone', spec['cloth'])
    metal = material('metal', spec['metal'])
    # Emission 6 washed the core to a featureless white ball and made all three devices identical.
    glow = material('glow', spec['glow'], emission=1.6)
    parts = {'hips': [], 'torso': [], 'head': [], 'arm.L': [], 'arm.R': [], 'leg.L': [], 'leg.R': []}
    parts['hips'].append(shape('cylinder', 'base', (0, 0, 0.16), (0.46, 0.46, 0.16), stone))
    parts['hips'].append(shape('cylinder', 'ring', (0, 0, 0.34), (0.34, 0.34, 0.05), metal))
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        parts['torso'].append(
            shape('cone', f'spike{i}', (math.cos(a) * 0.40, math.sin(a) * 0.40, 0.54),
                  (0.08, 0.08, 0.22), stone, rot=(math.cos(a) * -0.3, math.sin(a) * 0.3, 0)))
    core = spec.get('core', 'orb')
    if core == 'ring':
        parts['head'].append(shape('torus', 'vortex', (0, 0, 0.92), (0.40, 0.40, 0.40), glow,
                                   rot=(0.25, 0, 0)))
        parts['head'].append(shape('cylinder', 'beam', (0, 0, 0.92), (0.10, 0.10, 0.26), glow,
                                   outline=0))
    elif core == 'vortex':
        parts['head'].append(shape('cone', 'funnel', (0, 0, 0.98), (0.40, 0.40, 0.34), glow,
                                   rot=(math.pi, 0, 0)))
        parts['head'].append(shape('sphere', 'eye', (0, 0, 0.74), (0.13, 0.13, 0.13), glow, outline=0))
    else:
        parts['head'].append(shape('sphere', 'core', (0, 0, 0.88), (0.28, 0.28, 0.28), glow))
        parts['head'].append(shape('torus', 'halo', (0, 0, 0.88), (0.44, 0.44, 0.44), metal,
                                   rot=(math.radians(72), 0, 0)))
    return rig(parts)


def build_golem(spec):
    """A rock creature — the humanoid skeleton with boulders instead of limbs."""
    rock = material('rock', spec['cloth'])
    rock2 = material('rock2', spec['cloth2'])
    glow = material('glow', spec['glow'], emission=2.2)
    parts = {'hips': [], 'torso': [], 'head': [], 'arm.L': [], 'arm.R': [], 'leg.L': [], 'leg.R': []}
    parts['hips'].append(shape('sphere', 'pelvis', (0, 0, 0.58), (0.34, 0.30, 0.22), rock2))
    parts['torso'].append(shape('sphere', 'chest', (0, 0, 0.92), (0.46, 0.38, 0.34), rock))
    parts['torso'].append(shape('sphere', 'core', (0, -0.34, 0.92), (0.11, 0.06, 0.11), glow, outline=0))
    parts['head'].append(shape('sphere', 'head', (0, 0, 1.32), (0.30, 0.28, 0.26), rock2))
    for side, sx in (('L', 1), ('R', -1)):
        parts['head'].append(
            shape('sphere', f'eye.{side}', (sx * 0.13, -0.24, 1.34), (0.06, 0.04, 0.05), glow, outline=0))
        parts[f'arm.{side}'].append(
            shape('sphere', f'arm.{side}', (sx * 0.50, 0, 0.88), (0.19, 0.19, 0.30), rock))
        parts[f'arm.{side}'].append(
            shape('sphere', f'fist.{side}', (sx * 0.54, -0.02, 0.56), (0.20, 0.20, 0.18), rock2))
        parts[f'leg.{side}'].append(
            shape('sphere', f'leg.{side}', (sx * 0.20, 0, 0.28), (0.19, 0.19, 0.26), rock2))
    return rig(parts)


ARCHETYPES = {
    'humanoid': build_humanoid,
    'machine': build_machine,
    'arcane': build_arcane,
    'golem': build_golem,
}


def build(spec):
    return ARCHETYPES[spec.get('archetype', 'humanoid')](spec)


# ── animation ────────────────────────────────────────────────────────────────
def key(arm, bone, frame, rot=None, loc=None):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = 'XYZ'
    if rot is not None:
        pb.rotation_euler = rot
        pb.keyframe_insert('rotation_euler', frame=frame)
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert('location', frame=frame)


def animate(arm, clip, n):
    """Keys one clip over frames 1..n. Loops are built so frame n+1 == frame 1."""
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)

    if clip == 'idle':
        for i in range(n + 1):
            f, p = i + 1, i / n * 2 * math.pi
            key(arm, 'root', f, loc=(0, 0, 0.02 * math.sin(p)))
            key(arm, 'torso', f, rot=(0.05 * math.sin(p), 0, 0))
            key(arm, 'head', f, rot=(0.07 * math.sin(p + 0.6), 0.05 * math.sin(p * 0.5), 0))
            key(arm, 'arm.L', f, rot=(0.10 * math.sin(p + 1.0), 0, 0.06))
            key(arm, 'arm.R', f, rot=(0.10 * math.sin(p + 1.4), 0, -0.06))

    elif clip == 'walk':
        for i in range(n + 1):
            f, p = i + 1, i / n * 2 * math.pi
            key(arm, 'root', f, loc=(0, 0, 0.055 * abs(math.sin(p))))
            key(arm, 'hips', f, rot=(0, 0, 0.10 * math.sin(p)))
            key(arm, 'torso', f, rot=(0.10, 0, -0.10 * math.sin(p)))
            key(arm, 'head', f, rot=(-0.06, 0, 0.05 * math.sin(p)))
            key(arm, 'leg.L', f, rot=(0.75 * math.sin(p), 0, 0))
            key(arm, 'leg.R', f, rot=(0.75 * math.sin(p + math.pi), 0, 0))
            key(arm, 'arm.L', f, rot=(0.55 * math.sin(p + math.pi), 0, 0.05))
            key(arm, 'arm.R', f, rot=(0.55 * math.sin(p), 0, -0.05))

    elif clip == 'attack':
        # wind up, strike, recover — a one-shot, so no wrap frame
        poses = [(0.0, -0.3), (0.25, -1.4), (0.6, 1.1), (0.35, 0.9), (0.1, 0.3), (0.0, -0.1)]
        for i, (lean, swing) in enumerate(poses):
            f = i + 1
            key(arm, 'root', f, loc=(0, -0.06 * lean, 0))
            key(arm, 'torso', f, rot=(lean * 0.5, 0, -lean * 0.35))
            key(arm, 'head', f, rot=(lean * 0.3, 0, 0))
            key(arm, 'arm.R', f, rot=(swing, 0, -0.2))
            key(arm, 'arm.L', f, rot=(-swing * 0.3, 0, 0.2))
            key(arm, 'leg.L', f, rot=(-lean * 0.3, 0, 0))

    elif clip == 'death':
        # stagger, then fall backwards and settle flat
        for i in range(n):
            f = i + 1
            t = i / (n - 1)
            fall = min(1.0, max(0.0, (t - 0.18) / 0.62)) ** 0.7  # ease out
            wob = math.sin(t * 9) * (1 - t) * 0.12
            key(arm, 'root', f, rot=(-fall * math.pi / 2 * 0.92, 0, 0),
                loc=(0, fall * 0.42, -fall * 0.30))
            key(arm, 'torso', f, rot=(0.25 * (1 - fall) + wob, 0, wob))
            key(arm, 'head', f, rot=(-0.35 * fall + wob, 0, 0))
            key(arm, 'arm.L', f, rot=(-1.1 * fall, 0, 0.5 * fall))
            key(arm, 'arm.R', f, rot=(-0.9 * fall, 0, -0.4 * fall))
            key(arm, 'leg.L', f, rot=(0.7 * fall, 0, 0.2 * fall))
            key(arm, 'leg.R', f, rot=(0.5 * fall, 0, -0.2 * fall))


# ── scene ────────────────────────────────────────────────────────────────────
def setup_scene():
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = 64
    s.render.resolution_x = s.render.resolution_y = RES
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'

    # Dark outline, like the painted reference art.
    # Freestyle outlines are left OFF: on Blender 5 headless the lineset ships without a linestyle
    # and every frame throws 'NoneType has no attribute use_chaining'. Not worth the render time —
    # the dark outline of the reference art is better added at compositing time if we want it.
    s.render.use_freestyle = False

    # 3/4 front view, slightly above — matches the existing 2D assets.
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.35
    cam = bpy.data.objects.new('cam', cam_data)
    s.collection.objects.link(cam)
    s.camera = cam
    cam.location = (1.6, -3.5, 2.15)
    # Aim at the character's mid-height with a Track To constraint — hand-computed Euler angles
    # are what put the head out of frame on the first attempt.
    target = bpy.data.objects.new('cam_target', None)
    target.location = (0, 0, 0.86)
    s.collection.objects.link(target)
    c = cam.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'

    def light(kind, loc, energy, size=3.0, rot=(0, 0, 0)):
        d = bpy.data.lights.new('l', type=kind)
        d.energy = energy
        if kind == 'AREA':
            d.size = size
        o = bpy.data.objects.new('l', d)
        o.location = loc
        o.rotation_euler = rot
        s.collection.objects.link(o)

    light('SUN', (2, -3, 5), 3.2, rot=(math.radians(35), 0, math.radians(35)))
    light('AREA', (-2.5, -2, 2), 220)   # fill
    light('AREA', (0, 3, 2.6), 160)     # rim


def render_clip(arm, clip, cfg, out_dir, char_id):
    n = cfg['frames']
    animate(arm, clip, n)
    s = bpy.context.scene
    d = os.path.join(out_dir, 'frames', clip)
    os.makedirs(d, exist_ok=True)
    for i in range(n):
        s.frame_set(i + 1)
        s.render.filepath = os.path.join(d, f'{char_id}_{clip}_{i:02d}.png')
        bpy.ops.render.render(write_still=True)
    return [f'frames/{clip}/{char_id}_{clip}_{i:02d}.png' for i in range(n)]


def build_one(char_id, out_dir):
    global _ink
    spec = CHARACTERS[char_id]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _ink = None  # the cached material does not survive a scene reset (StructRNA removed)
    setup_scene()
    arm = build(spec)
    os.makedirs(out_dir, exist_ok=True)

    animations = {}
    # Only render what the game can actually show: a defence never walks, and an enemy never
    # stops to attack. Rendering the unused clips is pure bundle weight (measured in phase 20).
    for clip in spec.get('clips', ['idle', 'walk', 'attack', 'death']):
        cfg = CLIPS[clip]
        frames = render_clip(arm, clip, cfg, out_dir, char_id)
        animations[clip] = {'fps': cfg['fps'], 'loop': cfg['loop'], 'frames': frames}

    # The rig itself is the reusable asset — export it so the model can be re-posed later.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, f'{char_id}.glb'),
                              export_format='GLB', use_selection=True)

    manifest = {
        'id': char_id,
        'format': 'png-frame-animation',
        'frameSize': {'width': RES, 'height': RES},
        # The camera frames the character with its feet near the bottom of the shot.
        'anchor': {'x': 0.5, 'y': 0.94},
        'animations': animations,
        'source': 'blender-generated (scripts/blender/build_character.py)',
    }
    with open(os.path.join(out_dir, f'{char_id}.animations.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    print('done:', char_id, '->', out_dir)


def main():
    target, out_root = sys.argv[1], sys.argv[2]
    ids = list(CHARACTERS) if target == 'all' else [target]
    for char_id in ids:
        build_one(char_id, os.path.join(out_root, char_id) if target == 'all' else out_root)


if __name__ == '__main__':
    main()
