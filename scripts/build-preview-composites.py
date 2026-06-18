#!/usr/bin/env python3
"""Composite underwear model cutouts onto a clean yacht-deck background."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / 'public' / 'preview'
REF = Path('/Users/lana/.cursor/projects/Users-lana-Downloads-yacht-uniform-lookbook-template-v2/assets/3176760c-f230-45b2-82d7-2b79ee125c88-f1e32456-183a-4898-969d-eddf39893f36.png')
OUT_W, OUT_H = 960, 960
MODEL_HEIGHT_RATIO = 0.9


def sample_bg_color(img: Image.Image) -> tuple[int, int, int]:
    w, h = img.size
    points = [(4, 4), (w - 5, 4), (4, h - 5), (w - 5, h - 5), (w // 2, 4), (w // 2, h - 5)]
    rs = gs = bs = 0
    for x, y in points:
        r, g, b = img.convert('RGB').getpixel((x, y))
        rs += r
        gs += g
        bs += b
    return rs // len(points), gs // len(points), bs // len(points)


def cutout_model(src: Path, bg: tuple[int, int, int]) -> Image.Image:
    img = Image.open(src).convert('RGBA')
    px = img.load()
    w, h = img.size
    br, bgc, bb = bg
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            dist = math.sqrt((r - br) ** 2 + (g - bgc) ** 2 + (b - bb) ** 2)
            if dist < 28:
                px[x, y] = (r, g, b, 0)
            elif dist < 52:
                fade = int(255 * (dist - 28) / 24)
                px[x, y] = (r, g, b, min(a, fade))
    return img.filter(ImageFilter.SMOOTH_MORE)


def build_deck_background() -> Image.Image:
    ref = Image.open(REF).convert('RGB')
    sky = ref.crop((300, 115, 345, 295)).resize((OUT_W, int(OUT_H * 0.6)), Image.Resampling.LANCZOS)
    deck = ref.crop((218, 492, 328, 528)).resize((OUT_W, int(OUT_H * 0.42)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (OUT_W, OUT_H))
    canvas.paste(sky, (0, 0))
    canvas.paste(deck, (0, int(OUT_H * 0.58)))
    return canvas


def composite(model_path: Path, out_path: Path, deck: Image.Image) -> None:
    bg = sample_bg_color(Image.open(model_path))
    model = cutout_model(model_path, bg)
    target_h = int(OUT_H * MODEL_HEIGHT_RATIO)
    scale = target_h / model.height
    target_w = int(model.width * scale)
    model = model.resize((target_w, target_h), Image.Resampling.LANCZOS)
    canvas = deck.copy().convert('RGBA')
    x = (OUT_W - target_w) // 2
    y = OUT_H - target_h - int(OUT_H * 0.03)
    canvas.alpha_composite(model, (x, y))
    canvas.convert('RGB').save(out_path, quality=92, optimize=True)
    print(f'wrote {out_path.name}')


def main() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    deck = build_deck_background()
    deck.save(PREVIEW / 'yacht-deck-clean.jpg', quality=92, optimize=True)

    pairs = [
        ('model-woman-front.jpg', 'composite-woman-front.jpg'),
        ('model-woman-back.jpg', 'composite-woman-back.jpg'),
        ('model-man-front.jpg', 'composite-man-front.jpg'),
        ('model-man-back.jpg', 'composite-man-back.jpg'),
    ]
    for src_name, out_name in pairs:
        src = PREVIEW / src_name
        if not src.exists():
            raise SystemExit(f'missing model asset: {src}')
        composite(src, PREVIEW / out_name, deck)


if __name__ == '__main__':
    main()
