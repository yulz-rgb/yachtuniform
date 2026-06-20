/** Preview asset paths and garment overlay slots for the live model frame. */

import { adjustmentKey, applyPreviewAdjustment } from './previewAdjustments.js';

/** Native cutout dimensions (public/preview/cutout-*.png). */
export const FIGURE_DIMENSIONS = {
  woman: {
    front: { width: 258, height: 918 },
    back: { width: 275, height: 969 },
  },
  man: {
    front: { width: 276, height: 896 },
    back: { width: 278, height: 895 },
  },
};

export const PREVIEW_MANNEQUIN_HEIGHT = FIGURE_DIMENSIONS.woman.front.height;
export const PREVIEW_MANNEQUIN_WIDTH = FIGURE_DIMENSIONS.woman.front.width;

export const PREVIEW_FILL_RATIO = 0.92;

/** Target model size relative to the original 340px-tall preview stack (3 = 300%). */
export const PREVIEW_SIZE_MULTIPLIER = 3;

export function figureDimensions(bodyType, view = 'front') {
  const body = bodyType === 'man' ? 'man' : 'woman';
  const angle = view === 'back' ? 'back' : 'front';
  return FIGURE_DIMENSIONS[body][angle];
}

export function cutoutSrc(bodyType, view = 'front') {
  const body = bodyType === 'man' ? 'man' : 'woman';
  const angle = view === 'back' ? 'back' : 'front';
  return `/preview/cutout-${body}-${angle}.png`;
}

const HINT_ALIASES = {
  engineering: 'overalls',
  'chef-wear': 'chef-jacket',
};

/** Resolve the garment shape key used for slot placement. */
export function resolveGarmentHint(product) {
  const name = product?.name || '';
  // Strip sleeve-length descriptors first so "Short Sleeve" doesn't get mistaken
  // for the "shorts" bottoms garment (e.g. "Dickies Short Sleeve Coveralls").
  const nameSansSleeve = name.replace(/\b(short|long)[\s-]*sleeves?\b/gi, ' ');
  if (/\bbelt\b/i.test(name)) return 'belt';
  if (/\b(cap|beanie|hat)\b/i.test(name) && product?.category === 'accessories') return 'cap';
  if (/\b(trouser|trousers|chino pant|chino pants|\bpant\b|\bpants\b|jogger|legging)\b/i.test(nameSansSleeve)
    && !/\b(short|skort|bermuda)\b/i.test(nameSansSleeve)) return 'trousers';
  if (/\b(short|skort|bermuda)\b/i.test(nameSansSleeve)) return 'shorts';
  const raw = product?.imageHint || product?.category || 'polo';
  return HINT_ALIASES[raw] || raw;
}

const CATEGORY_SLOT = {
  tops: 'torso',
  shirts: 'torso',
  epaulettes: 'epaulettes',
  'chef-wear': 'torso',
  'spa-wear': 'torso',
  engineering: 'torsoFull',
  dresses: 'dress',
  bottoms: 'legs',
  outerwear: 'outer',
  shoes: 'feet',
  accessories: 'accessory',
};

/** Percent-based placement tuned to cutout anatomy (front/back × woman/man). */
const BASE_SLOTS = {
  woman: {
    front: {
      torso: { top: 18.5, left: 4, width: 92, height: 34, z: 30, fit: 'cover', objectPosition: '50% 18%' },
      torsoFull: { top: 18, left: 4, width: 92, height: 42, z: 28, fit: 'cover', objectPosition: '50% 8%' },
      dress: { top: 18, left: 3, width: 94, height: 40, z: 28, fit: 'cover', objectPosition: '50% 6%' },
      legs: { top: 46, left: 10, width: 80, height: 30, z: 25, fit: 'cover', objectPosition: '50% 35%' },
      outer: { top: 17, left: 1, width: 98, height: 36, z: 40, fit: 'cover', objectPosition: '50% 10%' },
      feet: { top: 87, left: 14, width: 72, height: 11, z: 35, fit: 'contain', objectPosition: '50% 80%' },
      accessory: { top: 1, left: 27, width: 46, height: 10, z: 42, fit: 'contain', objectPosition: '50% 85%' },
      epaulettes: { top: 18.5, left: 8, width: 84, height: 9, z: 45, fit: 'cover', objectPosition: '50% 50%' },
      belt: { top: 47, left: 14, width: 72, height: 5, z: 43, fit: 'cover', objectPosition: '50% 50%' },
    },
    back: {
      torso: { top: 18.5, left: 4, width: 92, height: 34, z: 30, fit: 'cover', objectPosition: '50% 18%' },
      torsoFull: { top: 18, left: 4, width: 92, height: 42, z: 28, fit: 'cover', objectPosition: '50% 8%' },
      dress: { top: 18, left: 3, width: 94, height: 40, z: 28, fit: 'cover', objectPosition: '50% 6%' },
      legs: { top: 46, left: 10, width: 80, height: 30, z: 25, fit: 'cover', objectPosition: '50% 35%' },
      outer: { top: 17, left: 1, width: 98, height: 36, z: 40, fit: 'cover', objectPosition: '50% 10%' },
      feet: { top: 87, left: 14, width: 72, height: 11, z: 35, fit: 'contain', objectPosition: '50% 80%' },
      accessory: { top: 1, left: 27, width: 46, height: 10, z: 42, fit: 'contain', objectPosition: '50% 85%' },
      epaulettes: { top: 18.5, left: 8, width: 84, height: 9, z: 45, fit: 'cover', objectPosition: '50% 50%' },
      belt: { top: 47, left: 14, width: 72, height: 5, z: 43, fit: 'cover', objectPosition: '50% 50%' },
    },
  },
  man: {
    front: {
      torso: { top: 18, left: 4, width: 92, height: 34, z: 30, fit: 'cover', objectPosition: '50% 12%' },
      torsoFull: { top: 17, left: 2, width: 96, height: 43, z: 28, fit: 'cover', objectPosition: '50% 8%' },
      dress: { top: 18, left: 3, width: 94, height: 40, z: 28, fit: 'cover', objectPosition: '50% 6%' },
      legs: { top: 47, left: 10, width: 80, height: 24, z: 25, fit: 'cover', objectPosition: '50% 0%' },
      outer: { top: 16, left: 0, width: 100, height: 37, z: 40, fit: 'cover', objectPosition: '50% 10%' },
      feet: { top: 87, left: 12, width: 76, height: 11, z: 35, fit: 'contain', objectPosition: '50% 80%' },
      accessory: { top: 0.5, left: 25, width: 50, height: 10, z: 42, fit: 'contain', objectPosition: '50% 85%' },
      epaulettes: { top: 18, left: 6, width: 88, height: 9, z: 45, fit: 'cover', objectPosition: '50% 50%' },
      belt: { top: 46, left: 12, width: 76, height: 5, z: 43, fit: 'cover', objectPosition: '50% 50%' },
    },
    back: {
      torso: { top: 18, left: 4, width: 92, height: 34, z: 30, fit: 'cover', objectPosition: '50% 12%' },
      torsoFull: { top: 17, left: 2, width: 96, height: 43, z: 28, fit: 'cover', objectPosition: '50% 8%' },
      dress: { top: 18, left: 3, width: 94, height: 40, z: 28, fit: 'cover', objectPosition: '50% 6%' },
      legs: { top: 47, left: 10, width: 80, height: 24, z: 25, fit: 'cover', objectPosition: '50% 0%' },
      outer: { top: 16, left: 0, width: 100, height: 37, z: 40, fit: 'cover', objectPosition: '50% 10%' },
      feet: { top: 87, left: 12, width: 76, height: 11, z: 35, fit: 'contain', objectPosition: '50% 80%' },
      accessory: { top: 0.5, left: 25, width: 50, height: 10, z: 42, fit: 'contain', objectPosition: '50% 85%' },
      epaulettes: { top: 18, left: 6, width: 88, height: 9, z: 45, fit: 'cover', objectPosition: '50% 50%' },
      belt: { top: 46, left: 12, width: 76, height: 5, z: 43, fit: 'cover', objectPosition: '50% 50%' },
    },
  },
};

function applySlotTweaks(base, tweak = {}) {
  if (!tweak || !Object.keys(tweak).length) return base;
  const next = { ...base, ...tweak };
  if (typeof tweak.topDelta === 'number') next.top = base.top + tweak.topDelta;
  if (typeof tweak.heightDelta === 'number') next.height = base.height + tweak.heightDelta;
  if (typeof tweak.leftDelta === 'number') next.left = base.left + tweak.leftDelta;
  if (typeof tweak.widthDelta === 'number') next.width = base.width + tweak.widthDelta;
  delete next.topDelta;
  delete next.heightDelta;
  delete next.leftDelta;
  delete next.widthDelta;
  return next;
}

/** Per-garment-shape tweaks on top of category base slots. */
const HINT_OVERRIDES = {
  polo: { scale: 1.12, objectPosition: '50% 32%' },
  shirt: { topDelta: -1, heightDelta: 2, scale: 1.08, objectPosition: '50% 25%' },
  jacket: { topDelta: -2, heightDelta: 4, scale: 1.06, objectPosition: '50% 22%' },
  'chef-jacket': { topDelta: -1, heightDelta: 3, scale: 1.06, objectPosition: '50% 20%' },
  overalls: { heightDelta: 4, scale: 1.05, objectPosition: '50% 18%' },
  dress: { heightDelta: 2, scale: 1.08, objectPosition: '50% 15%' },
  shorts: { heightDelta: -2, topDelta: 1, scale: 1.12, objectPosition: '50% 40%' },
  skort: { heightDelta: -2, topDelta: 1, scale: 1.1, objectPosition: '50% 35%' },
  trousers: { heightDelta: 10, topDelta: -2, scale: 1.06, objectPosition: '50% 38%' },
  shoes: { fit: 'contain', scale: 1.08, objectPosition: '50% 100%', transformOrigin: 'center bottom' },
  cap: { topDelta: -0.5, heightDelta: 1, fit: 'contain', scale: 0.95, objectPosition: '50% 88%' },
  belt: { fit: 'cover', scale: 1.2, objectPosition: '50% 50%' },
  epaulettes: { fit: 'cover', scale: 1.05, objectPosition: '50% 50%' },
};

function slotForProduct(product, bodyType, view) {
  const body = bodyType === 'man' ? 'man' : 'woman';
  const angle = view === 'back' ? 'back' : 'front';
  const slotMap = BASE_SLOTS[body][angle];
  const hint = resolveGarmentHint(product);
  const categoryKey = CATEGORY_SLOT[product.category] || 'torso';
  const hintKey = ['cap', 'belt', 'epaulettes'].includes(hint) ? hint : categoryKey;
  const base = slotMap[hintKey] || slotMap[categoryKey] || slotMap.torso;
  const tweak = HINT_OVERRIDES[hint] || HINT_OVERRIDES[categoryKey] || {};
  return applySlotTweaks(base, tweak);
}

/** Order and de-dupe products for realistic layering (matches Mannequin logic). */
export function resolvePreviewProducts(selectedProducts = [], bodyType = 'woman') {
  const byCategory = Object.fromEntries(
    selectedProducts.filter(Boolean).map((p) => [p.category, p]),
  );
  const ordered = [];

  if (byCategory.dresses && bodyType === 'woman') {
    ordered.push(byCategory.dresses);
  } else if (byCategory.engineering) {
    ordered.push(byCategory.engineering);
  } else {
    const top = byCategory.tops || byCategory.shirts || byCategory['chef-wear'] || byCategory['spa-wear'];
    if (top) ordered.push(top);
    if (byCategory.bottoms) ordered.push(byCategory.bottoms);
  }

  if (byCategory.epaulettes) ordered.push(byCategory.epaulettes);
  if (byCategory.outerwear) ordered.push(byCategory.outerwear);
  if (byCategory.shoes) ordered.push(byCategory.shoes);

  selectedProducts
    .filter((p) => p?.category === 'accessories')
    .forEach((p) => ordered.push(p));

  const seen = new Set();
  return ordered.filter((p) => {
    if (!p?.imageUrl || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export function garmentLayers(bodyType, view, selectedProducts = [], adjustments = {}) {
  return resolvePreviewProducts(selectedProducts, bodyType)
    .map((product) => {
      const slot = slotForProduct(product, bodyType, view);
      const saved = adjustments[adjustmentKey(product.id, bodyType, view)] || {};
      return { product, slot: applyPreviewAdjustment(slot, saved) };
    })
    .sort((a, b) => a.slot.z - b.slot.z);
}
