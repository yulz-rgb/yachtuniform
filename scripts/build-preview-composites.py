#!/usr/bin/env python3
"""Composite underwear model cutouts onto a plain white studio background."""

from __future__ import annotations

import sys
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.venv-rembg'))

from rembg import new_session, remove  # noqa: E402

PREVIEW = ROOT / 'public' / 'preview'
OUT_W, OUT_H = 960, 960
MODEL_HEIGHT_RATIO = 0.76
TOP_MARGIN_RATIO = 0.06
WHITE = (255, 255, 255)


@lru_cache(maxsize=1)
def rembg_session():
    return new_session('u2net_human_seg')


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    rgba = img.convert('RGBA')
    px = rgba.load()
    w, h = rgba.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 16:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x <= min_x:
        return 0, 0, w, h
    return min_x, min_y, max_x + 1, max_y + 1


def cutout_model(src: Path) -> Image.Image:
    raw = src.read_bytes()
    cut = remove(raw, session=rembg_session(), post_process_mask=True)
    img = Image.open(BytesIO(cut)).convert('RGBA')
    return img.crop(content_bbox(img))


def build_white_background() -> Image.Image:
    return Image.new('RGB', (OUT_W, OUT_H), WHITE)


def composite(model_path: Path, out_path: Path, canvas_base: Image.Image) -> None:
    model = cutout_model(model_path)
    target_h = int(OUT_H * MODEL_HEIGHT_RATIO)
    scale = target_h / model.height
    target_w = int(model.width * scale)
    model = model.resize((target_w, target_h), Image.Resampling.LANCZOS)
    canvas = canvas_base.copy().convert('RGBA')
    x = (OUT_W - target_w) // 2
    y = int(OUT_H * TOP_MARGIN_RATIO)
    canvas.alpha_composite(model, (x, y))
    canvas.convert('RGB').save(out_path, quality=92, optimize=True)
    print(f'wrote {out_path.name}')


def main() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)
    white = build_white_background()
    white.save(PREVIEW / 'yacht-deck-clean.jpg', quality=92, optimize=True)

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
        composite(src, PREVIEW / out_name, white)


if __name__ == '__main__':
    main()
