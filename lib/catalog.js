import { marinaProducts } from './marinaCatalog.js';
import { superyachtProducts } from './superyachtCatalog.js';
import { smallwoodsProducts } from './smallwoodsCatalog.js';
import { supplierCatalogExports } from './supplierCatalogs/index.js';
import { IMPORTED_SUPPLIER_IDS } from './supplierSources.js';
import { filterUniformCatalogRecords, guessFitFromProductTitle } from './catalogExtract.js';
import { cleanFabricComposition } from './fabric.js';
import { parseColourImages } from './productColour.js';
import { splitList } from './csv.js';
import {
  categories,
  navCategories,
  NAV_GROUPS,
  NAV_SECTION_LABELS,
  DEPARTMENT_CATEGORIES,
  classifyUniformCategory,
  imageHintForCategory,
  inferDepartmentTags,
  normalizeUniformProduct,
  validateUniformCatalog,
  validateUniformProduct,
  isOnePieceDress as productMatchesDressFilter,
  productMatchesNav,
  productMatchesSubFilter,
  catalogNavForProduct,
} from './uniformTaxonomy.js';

export {
  categories,
  navCategories,
  NAV_GROUPS,
  NAV_SECTION_LABELS,
  DEPARTMENT_CATEGORIES,
  productMatchesNav,
  productMatchesSubFilter,
  catalogNavForProduct,
  productMatchesDressFilter,
  normalizeUniformProduct,
  validateUniformCatalog,
  validateUniformProduct,
  classifyUniformCategory,
  inferDepartmentTags,
};

const VALID_BODY_TYPES = new Set(['woman', 'man']);

export function normalizeBodyType(bodyType) {
  if (bodyType === 'man' || bodyType === 'male') return 'man';
  if (bodyType === 'woman' || bodyType === 'female') return 'woman';
  return 'woman';
}

export function normalizeFitArray(fit) {
  if (Array.isArray(fit)) return fit.filter((f) => VALID_BODY_TYPES.has(f));
  if (typeof fit === 'string' && fit) {
    return fit.split(/[|,]/).map((v) => v.trim()).filter((f) => VALID_BODY_TYPES.has(f));
  }
  return [];
}

function productGenderText(product) {
  return [
    product?.name,
    product?.sku,
    product?.id,
    product?.productUrl,
    String(product?.details || '').slice(0, 240),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\u2019/g, "'");
}

/** Gender from name, SKU, id, URL, and details — overrides bad fit arrays. */
export function inferGenderedFit(product) {
  const text = productGenderText(product).toLowerCase();
  const category = product?.category || '';

  if (/\bunisex\b/i.test(text)) return ['woman', 'man'];
  if (/\b(ladies|women'?s?|womens|female|girl)\b/i.test(text)) return ['woman'];
  if (/\b(men'?s?|mens|male|boy)\b/i.test(text) && !/\b(women|ladies|womens)\b/i.test(text)) return ['man'];
  if (/(?:^|[/_-])mens(?:[/_-]|$)|(?:^|[/_-])men-s-|\bmen[-_]s\b|\/products\/mens-/i.test(text)) return ['man'];
  if (/(?:^|[/_-])ladies(?:[/_-]|$)|(?:^|[/_-])women(?:[/_-]|$)|\/products\/ladies-/i.test(text)) return ['woman'];
  if (category === 'dresses' && !/\b(men'?s?|mens|male|boy)\b/i.test(text)) return ['woman'];
  if (/\bskort\b/i.test(text)) return ['woman'];
  return null;
}

/** Effective fit for catalog filtering — metadata and category override bad or missing fit data. */
export function resolveProductFit(product) {
  const inferred = inferGenderedFit(product);
  if (inferred) return inferred;

  const explicit = normalizeFitArray(product?.fit);
  if (explicit.length === 1) return explicit;
  if (explicit.length > 1) return explicit;

  return guessFitFromProductTitle(product?.name || '', product?.category || '');
}

export function productMatchesBodyType(product, bodyType) {
  return resolveProductFit(product).includes(normalizeBodyType(bodyType));
}

export const bodyTypes = [
  { id: 'woman', label: 'Female', emoji: '♀' },
  { id: 'man', label: 'Male', emoji: '♂' },
];

// Heuristic: a catalog is "demo" if it still carries the bootstrap price note or
// a meaningful number of bundled Marina sample products are present.
export function isDemoCatalog(products = [], settings = {}) {
  if (String(settings?.priceNote || '').toLowerCase().includes('demo prices only')) {
    return true;
  }
  if (!products.length) return false;
  const marinaHits = products.filter((p) => p.id?.startsWith('marina-')).length;
  const sysHits = products.filter((p) => p.id?.startsWith('sys-')).length;
  const swHits = products.filter((p) => p.id?.startsWith('sw-')).length;
  return marinaHits >= 3 || sysHits >= 3 || swHits >= 3;
}

export const roles = [
  { id: 'captain', label: 'Captain', defaultQty: 1 },
  { id: 'chief-stew', label: 'Chief Stew', defaultQty: 1 },
  { id: 'interior', label: 'Interior Crew', defaultQty: 3 },
  { id: 'deck', label: 'Deck Crew', defaultQty: 3 },
  { id: 'chef', label: 'Chef', defaultQty: 1 },
  { id: 'engineer', label: 'Engineer', defaultQty: 1 },
  { id: 'spa', label: 'Spa / Wellness', defaultQty: 1 },
];

const mapCatalogProduct = (p) => {
  const normalized = normalizeUniformProduct(p);
  const supplierKey = p.supplierCatalogId
    || String(p.supplierName || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
  const nameSlug = String(p.name || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return {
    ...normalized,
    id: p.id || `${supplierKey}-${nameSlug}`,
    supplierCatalogId: p.supplierCatalogId,
    fabric: cleanFabricComposition(p.fabric),
    colours: Array.isArray(p.colours) ? p.colours.filter(Boolean) : splitList(p.colours),
    fit: normalizeFitArray(p.fit),
    roleTags: Array.isArray(normalized.roleTags) ? normalized.roleTags : splitList(normalized.roleTags),
    colourImages: typeof p.colourImages === 'object' && p.colourImages !== null
      ? p.colourImages
      : parseColourImages(p.colourImages),
    active: p.active !== false && p.active !== 'false',
    price: Number(p.price) || 0,
  };
};

function ensureUniqueProductIds(products) {
  const seen = new Map();
  return products.map((product, index) => {
    const baseId = product.id || `item-${index}`;
    const count = seen.get(baseId) || 0;
    seen.set(baseId, count + 1);
    if (count === 0) return { ...product, id: baseId };
    return { ...product, id: `${baseId}--${count + 1}` };
  });
}

export const marinaDefaultProducts = filterUniformCatalogRecords(marinaProducts).map(mapCatalogProduct);

const importedSupplierProducts = supplierCatalogExports
  .filter((entry) => IMPORTED_SUPPLIER_IDS.includes(entry.id))
  .flatMap((entry) => entry.products.map((p) => ({ ...p, supplierCatalogId: entry.id })));

export const defaultProducts = ensureUniqueProductIds(
  filterUniformCatalogRecords(importedSupplierProducts).map(mapCatalogProduct),
);

export const importedSupplierCatalog = IMPORTED_SUPPLIER_IDS.map((id) => {
  const entry = supplierCatalogExports.find((s) => s.id === id);
  const count = defaultProducts.filter((p) => p.supplierCatalogId === id).length;
  return { id, name: entry?.name || id, count };
});

export const vessels = [
  'M/Y OCEAN BREEZE',
  'M/Y SEA HORIZON',
  'M/Y AZURE SPIRIT',
  'S/Y WIND DANCER',
];

export const defaultLooks = [
  {
    id: 'arrival-look',
    name: 'Arrival / Guest Meet',
    description: 'Smart first-impression uniform for dockside welcome and owner arrival.',
    bodyType: 'woman',
    productIds: [
      'marina-ladies-luxury-stretch-polo-tee-jays',
      'marina-ladies-chino-pant',
      'marina-braided-elastic-belt',
      'marina-tropicfeel-sunset-sneakers',
    ],
  },
  {
    id: 'day-deck-look',
    name: 'Day Deck',
    description: 'Breathable deck outfit for hot working days, washdowns and tender runs.',
    bodyType: 'man',
    productIds: [
      'marina-mens-long-sleeve-technical-polo',
      'marina-mens-chino-bermuda-kariban',
      'marina-tropicfeel-at-hdry®-all-sneakers',
      'marina-panel-polyester-cap',
    ],
  },
  {
    id: 'evening-service-look',
    name: 'Evening Service',
    description: 'Cleaner dinner-service look for chief stew, interior and formal owner evenings.',
    bodyType: 'woman',
    productIds: [
      'marina-ladies-v-neck-dress',
      'marina-tropicfeel-sunset-sneakers',
    ],
  },
  {
    id: 'watersports-look',
    name: 'Watersports',
    description: 'Quick-dry active look for tender runs, beach club and watersports support.',
    bodyType: 'woman',
    productIds: [
      'marina-ladies-luxury-stretch-polo-tee-jays',
      'marina-ladies-cargo-board-short',
      'marina-tropicfeel-at-hdry®-all-sneakers',
      'marina-panel-polyester-cap',
    ],
  },
];

export const defaultCrew = [
  { id: 'crew-1', name: 'Emma J.', role: 'chief-stew', bodyType: 'woman', topSize: 'S', bottomSize: '36', shoeSize: '38', assignedLook: 'arrival-look', assignedLooks: ['arrival-look', 'evening-service-look'], setsPerCrew: 2, sizeConfirmed: true, fitNotes: 'Prefers slim fit', preferredFit: 'slim' },
  { id: 'crew-2', name: 'Lily M.', role: 'interior', bodyType: 'woman', topSize: 'M', bottomSize: '38', shoeSize: '39', assignedLook: 'arrival-look', assignedLooks: ['arrival-look'], sizeConfirmed: false },
  { id: 'crew-3', name: 'Sophie R.', role: 'interior', bodyType: 'woman', topSize: 'S', bottomSize: '36', shoeSize: '37', assignedLook: 'evening-service-look', assignedLooks: ['evening-service-look', 'watersports-look'], sizeConfirmed: true },
  { id: 'crew-4', name: 'James T.', role: 'deck', bodyType: 'man', topSize: 'L', bottomSize: '34', shoeSize: '43', assignedLook: 'day-deck-look', assignedLooks: ['day-deck-look'], sizeConfirmed: true },
  { id: 'crew-5', name: 'Marcus H.', role: 'deck', bodyType: 'man', topSize: 'M', bottomSize: '32', shoeSize: '42', assignedLook: 'day-deck-look', assignedLooks: ['day-deck-look'], sizeConfirmed: false },
  { id: 'crew-6', name: 'Captain', role: 'captain', bodyType: 'man', topSize: 'L', bottomSize: '34', shoeSize: '43', assignedLook: 'arrival-look', assignedLooks: ['arrival-look'], setsPerCrew: 3, sizeConfirmed: true },
];
