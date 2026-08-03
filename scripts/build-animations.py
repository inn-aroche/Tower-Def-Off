"""Turn an animation pack (frames/ + .animations.json) into an inlined TS module.

Steps per frame: drop stray segmentation specks (keep components >= 4% of the biggest one),
crop every frame of a clip to ONE shared bbox so they stay aligned, resize to the board's real
pixel budget, encode webp, emit base64 data URIs plus the anchor recomputed for the crop.
"""
import base64, glob, io, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

PACK = sys.argv[1]
OUT = sys.argv[2]
# The pack names itself after the art brief ("enemy_goblin"); the game keys characters by their
# own id ("goblin"). Pass the game id explicitly rather than hoping the two conventions match.
ENTITY_ID = sys.argv[3] if len(sys.argv) > 3 else None
MAX_PX = 112  # board cell is ~62 CSS px; the sprite is drawn at ~0.75 cell, x2 DPR

def find_manifest(d):
    names = [f for f in os.listdir(d) if f.endswith('.animations.json')]
    return os.path.join(d, names[0]) if names else None


# A pack directory, or a root holding one directory per character (--all).
PACKS = []
if '--all' in sys.argv:
    for name in sorted(os.listdir(PACK)):
        sub = os.path.join(PACK, name)
        if os.path.isdir(sub) and find_manifest(sub):
            PACKS.append((sub, name))
else:
    PACKS.append((PACK, ENTITY_ID))



def despeckle(im: Image.Image) -> Image.Image:
    a = np.array(im)
    mask = a[:, :, 3] > 24
    lbl, n = ndimage.label(mask)
    if n <= 1:
        return im
    sizes = ndimage.sum(mask, lbl, range(1, n + 1))
    keep = np.isin(lbl, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.04])
    a[:, :, 3] = np.where(keep, a[:, :, 3], 0)
    return Image.fromarray(a)


def build_pack(pack_dir):
    manifest = json.load(open(find_manifest(pack_dir)))
    fw, fh = manifest['frameSize']['width'], manifest['frameSize']['height']
    ax, ay = manifest['anchor']['x'], manifest['anchor']['y']
    clips, report, grand = {}, [], 0
    for name, spec in manifest['animations'].items():
        ims = [despeckle(Image.open(os.path.join(pack_dir, f)).convert('RGBA')) for f in spec['frames']]
        bbs = [im.getbbox() for im in ims if im.getbbox()]
        x0 = min(b[0] for b in bbs); y0 = min(b[1] for b in bbs)
        x1 = max(b[2] for b in bbs); y1 = max(b[3] for b in bbs)
        cw, ch = x1 - x0, y1 - y0
        scale = MAX_PX / max(cw, ch)
        tw, th = max(1, round(cw * scale)), max(1, round(ch * scale))
        uris, total = [], 0
        for im in ims:
            c = im.crop((x0, y0, x1, y1)).resize((tw, th), Image.LANCZOS)
            buf = io.BytesIO(); c.save(buf, 'WEBP', quality=80, method=6)
            total += len(buf.getvalue())
            uris.append('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
        clips[name] = {
            'fps': spec['fps'], 'loop': bool(spec['loop']), 'frames': uris,
            # The manifest anchor is expressed on the padded source frame; cropping to content
            # removes the padding under the feet, so the foot line can land past the new bottom
            # edge. Clamp: after the crop, "the bottom of the artwork" IS the ground contact.
            'anchorX': min(1.0, max(0.0, (ax * fw - x0) / cw)),
            'anchorY': min(1.0, max(0.0, (ay * fh - y0) / ch)),
            'w': tw, 'h': th,
        }
        grand += total
        report.append(f'  {name}: {len(ims)} frames, {tw}x{th}, {total // 1024} KB')
    return clips, report, grand


sets, lines, grand_total = {}, [], 0
for pack_dir, entity_id in PACKS:
    clips, report, total = build_pack(pack_dir)
    sets[entity_id or json.load(open(find_manifest(pack_dir)))['id']] = clips
    lines.append(f'{entity_id}: {total // 1024} KB')
    lines.extend(report)
    grand_total += total

body = json.dumps(sets, ensure_ascii=False)
with open(OUT, 'w') as f:
    f.write('''/**
 * GENERATED — do not edit by hand. Built from an animation pack by
 * scripts/build-animations (see decisions.md, phase 20).
 *
 * Frame animations as inlined webp data URIs, so a published build stays self-contained (a strict
 * CSP forbids fetching assets from anywhere else).
 */
import type { AnimSet } from './anim';

export const ANIMATIONS: Record<string, AnimSet> = ''')
    f.write(body)
    f.write(';\n')

print('\n'.join(lines))
print(f'--- {len(sets)} characters, {grand_total // 1024} KB of webp')
print('module', os.path.getsize(OUT) // 1024, 'KB')
