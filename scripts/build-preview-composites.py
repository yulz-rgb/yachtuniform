#!/usr/bin/env python3
"""Build transparent model cutouts from source photos."""

from __future__ import annotations

import sys
from functools import lru_cache
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.venv-rembg'))

from PIL import Image
from rembg import new_session, remove  # noqa: E402

PREVIEW = ROOT / 'public' / 'preview'


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


def main() -> None:
    PREVIEW.mkdir(parents=True, exist_ok=True)

    pairs = [
        ('model-woman-front.jpg', 'cutout-woman-front.png'),
        ('model-woman-back.jpg', 'cutout-woman-back.png'),
        ('model-man-front.jpg', 'cutout-man-front.png'),
        ('model-man-back.jpg', 'cutout-man-back.png'),
    ]
    for src_name, out_name in pairs:
        src = PREVIEW / src_name
        if not src.exists():
            raise SystemExit(f'missing model asset: {src}')
        cutout_model(src).save(PREVIEW / out_name, optimize=True)
        print(f'wrote {out_name}')


if __name__ == '__main__':
    main()
