import { marinaProducts } from './marinaCatalog.js';
import { filterUniformCatalogRecords, guessFitFromProductTitle } from './catalogExtract.js';
import { cleanFabricComposition } from './fabric.js';

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
  return marinaHits >= 3;
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

// Garment categories for sizing, layering, CSV import, and product editor.
export const categories = [
  { id: 'tops', label: 'Polos & Tees', layer: 20 },
  { id: 'shirts', label: 'Formal Shirts', layer: 22 },
  { id: 'epaulettes', label: 'Epaulettes & Rank', layer: 23 },
  { id: 'dresses', label: 'Dresses', layer: 25 },
  { id: 'bottoms', label: 'Shorts / Skorts / Trousers', layer: 18 },
  { id: 'chef-wear', label: 'Galley Jackets & Aprons', layer: 19 },
  { id: 'engineering', label: 'Engineering Overalls', layer: 17 },
  { id: 'spa-wear', label: 'Spa Tunics', layer: 21 },
  { id: 'outerwear', label: 'Wet Weather & Outerwear', layer: 30 },
  { id: 'shoes', label: 'Footwear', layer: 35 },
  { id: 'accessories', label: 'Accessories', layer: 40 },
];

// Sidebar taxonomy aligned with major yacht uniform suppliers:
//   Departments — yachtneeds.com, Threads & Threads (bridge / deck / engineering / interior / galley)
//   Shared catalog — YU Yacht Uniforms & Nauticrew (epaulettes, footwear, wet weather, accessories)
export const NAV_SECTION_LABELS = { department: 'Departments', shared: 'Catalog' };

export const navCategories = [
  { id: 'bridge', section: 'department', label: 'Bridge', departments: ['captain', 'boss'], subFilters: ['All', 'Epaulette Shirts', 'Officer Shirts', 'Trousers', 'Knitwear'] },
  { id: 'deck', section: 'department', label: 'Deck', departments: ['deck'], subFilters: ['All', 'Polos', 'T-Shirts', 'Shorts', 'Shirts'] },
  { id: 'engineering', section: 'department', label: 'Engineering', departments: ['engineer'], subFilters: ['All', 'Overalls', 'Polos', 'Trousers', 'Softshell'] },
  { id: 'interior', section: 'department', label: 'Interior', departments: ['interior', 'chief-stew'], subFilters: ['All', 'Dresses', 'Skorts', 'Blouses', 'Polos', 'Trousers'] },
  { id: 'galley', section: 'department', label: 'Galley', departments: ['chef'], subFilters: ['All', 'Jackets', 'Trousers', 'Aprons', 'Shoes'] },
  { id: 'spa', section: 'department', label: 'Spa', departments: ['spa'], subFilters: ['All', 'Tunics', 'Trousers'] },
  { id: 'epaulettes', section: 'shared', label: 'Epaulettes & Rank', categories: ['epaulettes'], subFilters: ['All', 'Deck', 'Engineering', 'Interior', 'Galley'] },
  { id: 'footwear', section: 'shared', label: 'Footwear', categories: ['shoes'], subFilters: ['All', 'Deck', 'Interior', 'Galley', 'Non-Marking'] },
  { id: 'outerwear', section: 'shared', label: 'Wet Weather & Outerwear', categories: ['outerwear'], subFilters: ['All', 'Softshell', 'Jacket', 'Fleece', 'Foul Weather'] },
  { id: 'accessories', section: 'shared', label: 'Accessories', categories: ['accessories'], subFilters: ['All', 'Caps', 'Belts', 'Sunglasses'] },
];

/** True for one-piece dresses — excludes dress shirts, jackets, and similar false positives. */
export function productMatchesDressFilter(product) {
  const name = (product.name || '').toLowerCase();
  if (!/\bdress\b/.test(name)) return false;
  if (/\bdress\s*shirt\b/.test(name)) return false;
  if (/\b(shirt|jacket|vest|softshell|blouse|polo|skort|tunic|apron)\b/.test(name)) return false;
  return true;
}

export function productMatchesNav(product, nav) {
  if (nav.departments?.length) {
    const tags = product.roleTags || [];
    // Unassigned products stay visible in every department until tagged.
    if (tags.length) {
      const deptSet = new Set(nav.departments);
      if (deptSet.has('captain')) deptSet.add('boss');
      if (!tags.some((t) => deptSet.has(t))) return false;
    }
  }
  if (nav.categories?.length && !nav.categories.includes(product.category)) return false;
  return true;
}

export function catalogNavForProduct(product) {
  const categoryNav = navCategories.find((n) => n.categories?.includes(product.category));
  if (categoryNav) return categoryNav.id;

  const tags = product.roleTags || [];
  if (tags.length) {
    const deptNav = navCategories.find((n) => {
      if (!n.departments?.length) return false;
      const deptSet = new Set(n.departments);
      if (deptSet.has('captain')) deptSet.add('boss');
      return tags.some((t) => deptSet.has(t));
    });
    if (deptNav) return deptNav.id;
  }

  return navCategories.find((n) => n.departments?.length)?.id || navCategories[0]?.id;
}

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

export const defaultProducts = filterUniformCatalogRecords(marinaProducts).map((p) => ({
  ...p,
  fabric: cleanFabricComposition(p.fabric),
}));
