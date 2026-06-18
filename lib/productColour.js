/** Colour names → hex swatches and per-colour product image helpers. */

const COLOUR_HEX = {
  white: '#ffffff',
  blanc: '#ffffff',
  ivory: '#fffff0',
  black: '#111827',
  navy: '#0b1f3a',
  marine: '#0b1f3a',
  'dark grey': '#4b5563',
  'dark gray': '#4b5563',
  grey: '#9ca3af',
  gray: '#9ca3af',
  charcoal: '#374151',
  beige: '#d6c4a8',
  sand: '#d6b98c',
  khaki: '#8b7d5a',
  red: '#b91c1c',
  burgundy: '#7f1d1d',
  blue: '#1d4ed8',
  'light blue': '#60a5fa',
  green: '#166534',
  olive: '#4d5d2f',
  yellow: '#eab308',
  orange: '#ea580c',
  pink: '#db2777',
  purple: '#7c3aed',
  brown: '#78350f',
  tan: '#c4a574',
  cream: '#fef3c7',
  silver: '#cbd5e1',
  gold: '#ca8a04',
};

const PREFERRED_DEFAULT_COLOURS = ['White', 'Blanc', 'Ivory'];

export function colourToHex(name) {
  if (!name) return '#e2e8f0';
  const key = String(name).trim().toLowerCase();
  if (COLOUR_HEX[key]) return COLOUR_HEX[key];
  if (key.includes('navy') || key.includes('marine')) return COLOUR_HEX.navy;
  if (key.includes('white') || key.includes('blanc')) return COLOUR_HEX.white;
  if (key.includes('black')) return COLOUR_HEX.black;
  if (key.includes('grey') || key.includes('gray')) return COLOUR_HEX.grey;
  if (key.includes('beige') || key.includes('sand')) return COLOUR_HEX.beige;
  return '#e2e8f0';
}

export function isLifestyleShopifyImage(src = '') {
  const file = decodeURIComponent(String(src).split('/').pop()?.split('?')[0] || '');
  return /yacht_crew|_wearing_|stewardess|on_superyacht|on_a_superyacht|capture_d_ecran|men_s_yacht|ladies_yacht|dress_shirts_-_/i.test(file);
}

export function defaultProductColour(product) {
  const colours = product?.colours || [];
  const images = product?.colourImages || {};
  for (const preferred of PREFERRED_DEFAULT_COLOURS) {
    if (colours.includes(preferred) && (images[preferred] || product?.imageUrl)) return preferred;
  }
  const withImage = colours.find((c) => images[c]);
  if (withImage) return withImage;
  return colours[0] || PREFERRED_DEFAULT_COLOURS[0];
}

export function productImageForColour(product, colour) {
  if (!product) return '';
  const chosen = colour || defaultProductColour(product);
  if (chosen && product.colourImages?.[chosen]) return product.colourImages[chosen];
  return product.imageUrl || '';
}

export function productSwatchForColour(product, colour) {
  const chosen = colour || defaultProductColour(product);
  return colourToHex(chosen) || product?.swatch || '#ffffff';
}

export function withProductColour(product, colour) {
  if (!product) return product;
  const chosen = colour || defaultProductColour(product);
  return {
    ...product,
    selectedColour: chosen,
    imageUrl: productImageForColour(product, chosen),
    swatch: productSwatchForColour(product, chosen),
  };
}

export function parseColourImages(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
