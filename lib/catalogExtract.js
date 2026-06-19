// Heuristic extraction of catalog rows from PDF text or supplier web pages.
// Output shape matches raw CSV records before Zod validation.

import { cleanFabricComposition } from './fabric.js';
import { colourToHex, isLifestyleShopifyImage } from './productColour.js';
import {
  classifyUniformCategory,
  imageHintForCategory,
  inferDepartmentTags,
} from './uniformTaxonomy.js';

const PRICE_RE = /(?:€|EUR\s*|£|GBP\s*|\$|USD\s*)(\d{1,6}(?:[.,]\d{2})?)|(\d{1,6}(?:[.,]\d{2})?)\s*(?:€|EUR|£|GBP|\$|USD)/gi;

// Non-garment / upsell lines from supplier stores (linens, luggage, kids, logo services).
const NON_UNIFORM_NAME_PATTERNS = [
  /\bkids?\b/i,
  /\bchildren'?s?\b/i,
  /\btowel/i,
  /\bbag\b/i,
  /\bcarrier bags?\b/i,
  /\bumbrella\b/i,
  /\b(panama|straw|bob|outback)\s+hat\b/i,
  /\bjute\b/i,
  /\broll[- ]top\b/i,
  /\bbeach\b/i,
  /\bscarf\b/i,
  /\bbandana\b/i,
  /\bswim short/i,
  /\brash guard/i,
  /\basquith.*swim\b/i,
  /\bcrocs\b/i,
  /\bswimwear\b/i,
  /\bsou'?wester\b/i,
  /\bsunblock\b/i,
  /\bsunscreen\b/i,
  /\bgloves?\b/i,
  /\bskull caps?\b/i,
  /\bspf\s*\d/i,
  /\btote\b/i,
  /\baccessory case\b/i,
  /^chief steward/i,
  /\brole (sign|badge|title)\b/i,
  /\bcustomi[sz]ation\b/i,
  /\bpersonali[sz]ation\b/i,
  /\bembroidery text\b/i,
  /\blogo embroidery\b/i,
  /\badd my own logo\b/i,
  /\bimport your logo\b/i,
  /^logo$/i,
  /^do you want to import/i,
  /^item personali/i,
];

export function isUniformCatalogRecord(record) {
  const name = String(record?.name || '').trim();
  if (!name) return false;
  return !NON_UNIFORM_NAME_PATTERNS.some((re) => re.test(name));
}

export { imageHintForCategory };
export const guessCategory = classifyUniformCategory;

function parseMoney(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function detectCurrency(text) {
  if (/€|EUR/i.test(text)) return 'EUR';
  if (/£|GBP/i.test(text)) return 'GBP';
  if (/\$|USD/i.test(text)) return 'USD';
  return 'EUR';
}

export function brandFromHostname(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const base = host.split('.')[0] || '';
    if (!base) return '';
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return '';
  }
}

const SUPPLIER_NAMES_BY_HOST = {
  'marinayachtwear.com': 'Marina Yacht Wear',
  'thesuperyachtshop.com': 'The Superyacht Shop',
  'smallwoods.com': "Smallwood's Yachtwear",
  'liquidyachtwear.com': 'Liquid Yacht Wear',
  'crewalamode.com': 'Crew à la Mode',
  'sea-design.com': 'Sea Design',
  'dolphinwear.com': 'DWD Uniform Solutions',
  'nauticrewyachtwear.com': 'Nauticrew Yacht Wear',
  'cocoandkandy.com': 'Coco & Kandy Crew',
  'taylormadedesigns.co.uk': 'Taylor Made Designs',
  'azurtex.com': 'Azurtex',
  'ocean-form.com': 'Oceanform',
  'ethicalyachtwear.com': 'Ethical Yacht Wear',
  'allaroundtheyacht.com': 'All Around The Yacht',
  'oceanr.co': 'OceanR',
  'mallorcaclothing.com': 'Mallorca Clothing Company',
  'mallorcaclothing.sowebshop.com': 'Mallorca Clothing Company',
  'superyachtuniforms.com': 'Superyacht Uniform',
  'waveuniforms.com': 'Wave Uniforms',
  'pinmaryachtsupply.com': 'Pinmar Yacht Supply',
  'waypointuae.com': 'Waypoint UAE',
  'musto.com': 'Musto',
  'gillmarine.com': 'Gill',
  'dubarry.com': 'Dubarry',
  'unique-crew.com': 'Unique Crew SuperYacht Apparel',
};

export function supplierNameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (SUPPLIER_NAMES_BY_HOST[host]) return SUPPLIER_NAMES_BY_HOST[host];
    return brandFromHostname(url);
  } catch {
    return '';
  }
}

function normaliseName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\d.\s\-–—|]+/, '')
    .replace(/[\s\-–—|]+$/, '')
    .trim();
}

function rowFromParts({
  name, price, currency, brand, category, imageUrl, details,
  fabric = '', colours = '', fit = 'woman|man', sizeRange = '',
  supplierName = '', productUrl = '', colourImages = '',
  swatch = '#ffffff',
}) {
  const cleanName = normaliseName(name);
  if (!cleanName || cleanName.length < 3) return null;
  const cat = category || guessCategory(cleanName, details || '');
  return {
    category: cat,
    name: cleanName,
    brand: brand || '',
    price: price ?? 0,
    currency: currency || 'EUR',
    vatRate: 0,
    colours,
    swatch,
    accent: '#0b1f3a',
    fabric,
    details: details || '',
    fit,
    roleTags: '',
    leadTime: '',
    minOrder: 1,
    sizeRange,
    imageHint: imageHintForCategory(cat),
    imageUrl: imageUrl || '',
    colourImages: typeof colourImages === 'object' ? JSON.stringify(colourImages) : (colourImages || ''),
    supplierName,
    productUrl,
    active: 'true',
  };
}

function extractPriceFromLine(line) {
  PRICE_RE.lastIndex = 0;
  const match = PRICE_RE.exec(line);
  if (!match) return null;
  const raw = match[1] || match[2];
  const price = parseMoney(raw);
  if (price == null) return null;
  const currency = detectCurrency(match[0]);
  const name = line.slice(0, match.index).concat(line.slice(match.index + match[0].length));
  return { price, currency, name };
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&pound;/gi, '£')
    .replace(/&euro;/gi, '€')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function absoluteUrl(href, base) {
  try {
    const url = new URL(href, base);
    // EShop image paths may contain spaces or apostrophes in filenames.
    url.pathname = url.pathname.split('/').map((seg) => encodeURIComponent(decodeURIComponent(seg))).join('/');
    return url.href;
  } catch {
    return href || '';
  }
}

export function extractProductDetailPrice(html) {
  const match = String(html || '').match(
    /<span[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );
  if (!match) return { price: null, currency: null };
  const raw = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '')).trim();
  const priced = extractPriceFromLine(raw);
  if (!priced) return { price: null, currency: null };
  return { price: priced.price, currency: priced.currency };
}

function detectPageCurrency(html, text = '') {
  if (/lang=["']en-gb["']/i.test(html)) return 'GBP';
  if (/lang=["']en-us["']/i.test(html)) return 'USD';
  const visible = `${htmlToText(html).slice(0, 4000)} ${text}`;
  if (/£|GBP|&pound;/i.test(visible)) return 'GBP';
  if (/€|EUR|&euro;/i.test(visible)) return 'EUR';
  if (/(?:USD|\$)\s*\d|\d\s*(?:USD|\$)/i.test(visible)) return 'USD';
  return detectCurrency(visible);
}

/** Joomla EShop category pages list products without prices on the grid. */
export function extractEshopListingProducts(html, pageUrl = '') {
  if (!/id=["']product_list["']|products-list-container/i.test(html)) return [];

  const products = [];
  const seen = new Set();
  const itemRe = /<li>[\s\S]*?<h2>\s*([^<]+?)\s*<\/h2>[\s\S]*?<a\s+href=["']([^"']+)["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"]+)["'][^>]*>/gi;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const name = normaliseName(match[1]);
    if (!name || name.length < 3) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    products.push({
      name,
      productUrl: absoluteUrl(match[2], pageUrl),
      imageUrl: absoluteUrl(match[3], pageUrl),
    });
  }
  return products;
}

export function parseProductsFromCatalogText(text, hints = {}) {
  const currencyDefault = hints.currency || detectCurrency(text.slice(0, 500));
  const brand = hints.brand || '';
  const supplierName = hints.supplierName || hints.brand || '';
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\t+/g, ' | ').trim())
    .filter((l) => l.length >= 4);

  const rows = [];
  const seen = new Set();

  for (const line of lines) {
    if (/^(page|www\.|http|tel:|email|©|copyright)/i.test(line)) continue;
    const priced = extractPriceFromLine(line);
    if (!priced || priced.price <= 0) continue;
    const row = rowFromParts({
      name: priced.name,
      price: priced.price,
      currency: priced.currency || currencyDefault,
      brand,
      supplierName,
    });
    if (!row) continue;
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  // Pair consecutive lines: product name on one line, price on the next.
  for (let i = 0; i < lines.length - 1; i += 1) {
    const nameLine = lines[i];
    const next = lines[i + 1];
    if (extractPriceFromLine(nameLine)) continue;
    const priced = extractPriceFromLine(next);
    if (!priced) continue;
    if (nameLine.length < 4 || /^\d+$/.test(nameLine)) continue;
    const row = rowFromParts({
      name: nameLine,
      price: priced.price,
      currency: priced.currency || currencyDefault,
      brand,
    });
    if (!row) continue;
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return rows.slice(0, 200);
}

export function filterUniformCatalogRecords(records = []) {
  return records.filter(isUniformCatalogRecord);
}

export function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function collectJsonLdNodes(node, out) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectJsonLdNodes(n, out));
    return;
  }
  if (typeof node !== 'object') return;
  const type = node['@type'];
  const types = Array.isArray(type) ? type : type ? [type] : [];
  if (types.some((t) => /Product/i.test(String(t)))) out.push(node);
  if (types.some((t) => /ItemList/i.test(String(t))) && Array.isArray(node.itemListElement)) {
    node.itemListElement.forEach((item) => {
      if (item?.item) collectJsonLdNodes(item.item, out);
      else collectJsonLdNodes(item, out);
    });
  }
  Object.values(node).forEach((v) => collectJsonLdNodes(v, out));
}

export function extractJsonLdProducts(html) {
  const blocks = String(html || '').match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const products = [];
  for (const block of blocks) {
    const jsonText = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/, '').trim();
    try {
      const parsed = JSON.parse(jsonText);
      const nodes = [];
      collectJsonLdNodes(parsed, nodes);
      for (const node of nodes) {
        const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        const price = parseMoney(offer?.price ?? offer?.lowPrice ?? node.price);
        const row = rowFromParts({
          name: node.name,
          price: price ?? 0,
          currency: offer?.priceCurrency || node.priceCurrency || 'EUR',
          brand: typeof node.brand === 'string' ? node.brand : node.brand?.name,
          imageUrl: Array.isArray(node.image) ? node.image[0] : node.image,
          details: node.description,
        });
        if (row) products.push(row);
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return products;
}

export function extractProductsFromHtml(html, url = '') {
  const supplierName = supplierNameFromUrl(url);
  const brand = brandFromHostname(url);
  const jsonLd = extractJsonLdProducts(html);
  if (jsonLd.length >= 2) {
    return {
      records: jsonLd.slice(0, 200).map((row) => ({ ...row, supplierName: row.supplierName || supplierName })),
      method: 'json-ld',
      brand: supplierName || brand,
    };
  }

  const eshopCards = extractEshopListingProducts(html, url);
  if (eshopCards.length >= 1) {
    const currency = detectPageCurrency(html, htmlToText(html).slice(0, 2000));
    const records = eshopCards
      .map((card) => {
        const row = rowFromParts({
          name: card.name,
          price: 0,
          currency,
          brand,
          supplierName,
          imageUrl: card.imageUrl,
        });
        if (!row) return null;
        return { ...row, productUrl: card.productUrl };
      })
      .filter(Boolean);
    if (records.length) {
      return {
        records: records.slice(0, 200),
        method: 'eshop-listing',
        brand: supplierName || brand,
        needsPriceEnrichment: true,
      };
    }
  }

  const text = htmlToText(html);
  const records = parseProductsFromCatalogText(text, { brand, supplierName });
  return { records, method: records.length ? 'text' : 'none', brand: supplierName || brand };
}

export async function enrichRecordsWithDetailPrices(records, fetchHtml, { batchSize = 8, maxFetches = 30 } = {}) {
  if (!records?.length || typeof fetchHtml !== 'function') return records;

  const enriched = records.map((r) => ({ ...r }));
  const targets = enriched
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.productUrl)
    .slice(0, maxFetches);

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    await Promise.all(batch.map(async ({ record, index }) => {
      try {
        const detailHtml = await fetchHtml(record.productUrl);
        const { price, currency } = extractProductDetailPrice(detailHtml);
        if (price != null && price > 0) {
          enriched[index] = { ...enriched[index], price, currency: currency || record.currency };
        }
      } catch {
        // skip unreachable product pages
      }
    }));
  }

  return enriched;
}

const ESHOP_BRAND_ALIASES = {
  slam: 'SLAM',
  slam2: 'SLAM',
  gill: 'Gill',
  musto: 'Musto',
  'helly-hansen': 'Helly Hansen',
  'henri-lloyd': 'Henri Lloyd',
  sebago: 'Sebago',
  dubarry: 'Dubarry',
  'cutter-buck': 'Cutter & Buck',
  'b-c': 'B&C',
  teejays: 'TeeJays',
  'marine-pool': 'Marine Pool',
  stormtech: 'Stormtech',
  clique: 'Clique',
  russell: 'Russell',
  henbury: 'Henbury',
  craft: 'Craft',
  nimbus: 'Nimbus',
  sols: "Sol's",
  sprio: 'Spiro',
  toio: 'Toio',
  tombo: 'Tombo',
  'tropic-feel': 'Tropic Feel',
  'under-armour': 'Under Armour',
  'vmg-clothing': 'VMG Clothing',
};

function eshopPathSegments(url = '') {
  try {
    return new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    return [];
  }
}

/** Guest-amenity categories on The Superyacht Shop (outside /clothing). */
export const SUPERYACHT_GUEST_ACCESSORY_PATHS = [
  '/accessories/bath-toiletries',
  '/accessories/towels',
  '/accessories/giveaways',
];

/** True when the URL points at a product detail page (not a category grid). */
export function isEshopProductUrl(url = '', categoryUrlSet = null) {
  const segments = eshopPathSegments(url);
  if (!segments.length) return false;
  if (segments[0] !== 'clothing' && segments[0] !== 'accessories') return false;
  if (segments[1] === 'brands') return false;

  const normalized = String(url).replace(/\/$/, '');
  if (categoryUrlSet?.has(normalized)) return false;

  // Hub categories (chef, belts, caps…) list products one level below the hub path.
  return segments.length >= 3;
}

/** Collect clothing category URLs from Joomla EShop nav markup. */
export function extractEshopClothingCategoryUrls(html, origin = '') {
  const urls = new Set();
  const re = /href=["'](\/clothing\/[^"'#?]+)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const path = match[1].replace(/\/$/, '');
    if (path === '/clothing') continue;
    if (path.startsWith('/clothing/brands/')) continue;
  if (/\/page-\d+-\d+$/.test(path)) continue;
    urls.add(absoluteUrl(path, origin));
  }
  return [...urls].sort();
}

/** Follow EShop pagination links on a category listing page. */
export function extractEshopPaginationUrls(html, pageUrl = '') {
  const urls = new Set([String(pageUrl || '').replace(/\/$/, '')]);
  const re = /href=["']([^"']*?\/page-\d+-\d+)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    urls.add(absoluteUrl(match[1], pageUrl));
  }
  return [...urls];
}

function normalizeEshopBrand(raw = '') {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return '';
  if (ESHOP_BRAND_ALIASES[key]) return ESHOP_BRAND_ALIASES[key];
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function colourNameFromEshopImageUrl(url = '') {
  const file = decodeURIComponent(String(url).split('/').pop()?.split('?')[0] || '');
  const stem = file.replace(/\.[a-z0-9]+$/i, '').replace(/-max-\d+x\d+$/i, '');
  const afterSku = stem.replace(/^[^_]+_/, '').trim();
  return afterSku.replace(/\s+\d+$/, '').trim();
}

function parseEshopColourList(text = '') {
  const clean = String(text || '')
    .replace(/\.\s+Matching\b[\s\S]*$/i, '')
    .replace(/\.\s*$/g, '')
    .trim();
  return clean
    .split(/[,;|]/)
    .map((c) => c.trim().replace(/\.$/, ''))
    .filter((c) => c.length > 1 && !/^matching\b/i.test(c));
}

function extractEshopField(text, label) {
  const re = new RegExp(
    `\\b${label}:\\s*(.+?)(?=\\s+(?:FABRIC|SIZES|SIZE|COLOURS|COLOUR):|$)`,
    'i',
  );
  return text.match(re)?.[1]?.trim() || '';
}

export function extractEshopBrand(html) {
  const imgMatch = html.match(/\/manufacturers\/(?:resized\/)?([^."'/]+)/i);
  if (imgMatch?.[1]) return normalizeEshopBrand(imgMatch[1]);
  const altMatch = html.match(/<img[^>]*src=["'][^"']*\/manufacturers\/[^"']+["'][^>]*alt=["']([^"']+)["']/i);
  if (altMatch?.[1]) return normalizeEshopBrand(altMatch[1]);
  return '';
}

/** Parse a Joomla EShop product detail page. */
export function extractEshopProductDetail(html, pageUrl = '') {
  const { price, currency } = extractProductDetailPrice(html);
  const titleMatch = html.match(/<h1[^>]*>([^<]+)/i);
  const name = normaliseName(titleMatch?.[1] || '');

  const descBlock = html.match(/<div[^>]*id=["']description["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  const detailsText = stripHtmlTags(descBlock);
  const fabric = cleanFabricComposition(
    extractEshopField(detailsText, 'FABRIC') || extractFabricFromDescription(descBlock),
  );
  const sizeRaw = extractEshopField(detailsText, 'SIZES')
    .replace(/\s*Matching\b[\s\S]*$/i, '')
    .trim();
  const sizeRange = sizeRaw
    .replace(/\s+/g, '')
    .replace(/-/g, '–');
  const listedColours = parseEshopColourList(extractEshopField(detailsText, 'COLOURS'));
  const singleColour = extractEshopField(detailsText, 'COLOUR')
    || extractEshopField(detailsText, 'Color');

  const colourImages = {};
  const imgRe = /<a[^>]*class=["']product-image["'][^>]*href=["']([^"]+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRe.exec(html)) !== null) {
    const imageUrl = absoluteUrl(imgMatch[1], pageUrl);
    const colourGuess = colourNameFromEshopImageUrl(imageUrl);
    if (!colourGuess) continue;
    if (!colourImages[colourGuess]) colourImages[colourGuess] = imageUrl;
  }

  const colours = listedColours.length
    ? listedColours
    : (singleColour ? [singleColour] : Object.keys(colourImages).filter((c) => !/^[0-9a-f_]+$/i.test(c)));

  const mainImgMatch = html.match(
    /<img[^>]*class=["'][^"']*uk-align-center[^"']*["'][^>]*src=["']([^"]+)["']/i,
  ) || html.match(/<img[^>]*src=["']([^"]+)["'][^>]*class=["'][^"']*uk-align-center[^"']*["']/i);
  const imageUrl = mainImgMatch?.[1] ? absoluteUrl(mainImgMatch[1], pageUrl) : '';

  const prefer = ['White', 'Bright White', 'Bright white', 'Ivory'];
  let swatch = '#e2e8f0';
  for (const c of prefer) {
    if (colours.includes(c)) {
      swatch = colourToHex(c);
      break;
    }
  }
  if (swatch === '#e2e8f0' && colours[0]) swatch = colourToHex(colours[0]);

  return {
    name,
    brand: extractEshopBrand(html),
    price: price ?? 0,
    currency: currency || detectPageCurrency(html, detailsText),
    fabric,
    details: detailsText.slice(0, 500),
    sizeRange,
    colours,
    colourImages,
    imageUrl: imageUrl || Object.values(colourImages)[0] || '',
    swatch,
  };
}

function fitFromCategoryPath(categoryPath = '', name = '') {
  const path = String(categoryPath).toLowerCase();
  if (/\/mens(?:\/|$)/.test(path)) return ['man'];
  if (/\/ladies(?:\/|$)/.test(path)) return ['woman'];
  if (/\/accessories\//.test(path)) return ['woman', 'man'];
  return guessFitFromProductTitle(name, '');
}

/** Nav-section labels used for Superyacht Shop listing audits (484 apparent unique listings). */
export function classifySuperyachtNavSection(product = {}) {
  const path = String(product.productUrl || product.categoryPath || '').toLowerCase();
  const name = String(product.name || '').toLowerCase();
  const text = `${name} ${path}`;

  if (/\/accessories\//.test(path) || /\b(guest|slipper|robe|towel|amenity|toiletr|giveaway)\b/.test(text)) {
    return 'guest';
  }
  if (/\/clothing\/(chef|engineer)\//.test(path) || /\/clothing\/(chef|engineer)$/.test(path)) {
    return 'chefEngineer';
  }
  if (/\/clothing\/(board-shorts|rash-vests)\//.test(path)
    || /\/clothing\/(board-shorts|rash-vests)$/.test(path)) {
    return 'swim';
  }
  if (/\/clothing\/foul-weather-gear\//.test(path)
    || /\/clothing\/foul-weather-gear$/.test(path)
    || /\/clothing\/(ladies|mens)\/(jackets|fleece|gilets)\//.test(path)
    || /\/clothing\/(ladies|mens)\/(jackets|fleece|gilets)$/.test(path)
    || /\/formal-wear\/jackets/.test(path)
    || /\b(jacket|gilet|fleece|foul weather|softshell|midlayer|waterproof coat)\b/.test(name)) {
    return 'outerwear';
  }
  if (/\/clothing\/(belts|caps|epaulettes)\//.test(path)
    || /\/clothing\/(belts|caps|epaulettes)$/.test(path)
    || /\/footwear\//.test(path)
    || /\b(belt|epaulet|cap|hat|shoe|boot|deck shoe|loafer|sandal|clog)\b/.test(name)) {
    return 'accessories';
  }
  if (/\/clothing\/ladies\//.test(path) || /\b(women|ladies|womens|female)\b/.test(name)) {
    return 'ladies';
  }
  if (/\/clothing\/mens\//.test(path) || /\b(men'?s?|mens|male)\b/.test(name)) {
    return 'mens';
  }
  return 'other';
}

export function eshopCardToRecord(card, detail = {}, origin = '') {
  const name = normaliseName(detail.name || card.name);
  if (!name) return null;

  const productUrl = card.productUrl || '';
  const pathSegments = eshopPathSegments(productUrl);
  const slug = pathSegments.slice(1).join('-')
    || pathSegments[pathSegments.length - 1]
    || name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const categoryPath = card.categoryPath || productUrl;
  const context = `${categoryPath} ${detail.details || ''}`;
  const category = guessCategory(name, context);
  const fit = fitFromCategoryPath(categoryPath, name);
  const colours = detail.colours?.length ? detail.colours : [];
  const colourImages = detail.colourImages && Object.keys(detail.colourImages).length
    ? detail.colourImages
    : undefined;
  const supplierName = supplierNameFromUrl(origin) || 'The Superyacht Shop';
  const currency = detail.currency === 'GBP' ? '£' : (detail.currency || '£');

  return {
    id: `sys-${slug}`,
    category,
    name,
    brand: detail.brand || '',
    price: Number(detail.price) || 0,
    currency,
    colours,
    swatch: detail.swatch || colourToHex(colours[0]),
    accent: '#0b1f3a',
    fabric: detail.fabric || '',
    details: detail.details || '',
    fit,
    roleTags: inferDepartmentTags({ name, category, details: detail.details }),
    leadTime: '',
    minOrder: 1,
    sizeRange: detail.sizeRange || '',
    imageHint: imageHintForCategory(category),
    imageUrl: detail.imageUrl || card.imageUrl || '',
    colourImages,
    supplierName,
    productUrl,
    active: true,
  };
}

/** Crawl all clothing categories on a Joomla EShop store. */
export async function extractEshopCatalog(origin, fetchHtml, {
  rootPath = '/clothing',
  extraCategoryPaths = [],
  detailBatchSize = 6,
  listingDelayMs = 150,
  detailDelayMs = 100,
  onProgress,
} = {}) {
  const base = origin.replace(/\/$/, '');
  const rootUrl = `${base}${rootPath}`;
  const rootHtml = await fetchHtml(rootUrl);
  let categoryUrls = extractEshopClothingCategoryUrls(rootHtml, base);
  for (const path of extraCategoryPaths) {
    categoryUrls.push(`${base}${path}`);
  }
  categoryUrls = [...new Set(categoryUrls)];
  if (!categoryUrls.length) categoryUrls = [rootUrl];
  const categoryUrlSet = new Set(categoryUrls.map((u) => u.replace(/\/$/, '')));

  const productByUrl = new Map();

  for (let ci = 0; ci < categoryUrls.length; ci += 1) {
    const catUrl = categoryUrls[ci];
    onProgress?.({ phase: 'listing', category: catUrl, index: ci + 1, total: categoryUrls.length });

    let catHtml;
    try {
      catHtml = catUrl === rootUrl ? rootHtml : await fetchHtml(catUrl);
    } catch {
      continue;
    }

    const pageUrls = extractEshopPaginationUrls(catHtml, catUrl);

    for (const pageUrl of pageUrls) {
      let html;
      try {
        html = pageUrl === catUrl ? catHtml : await fetchHtml(pageUrl);
      } catch {
        continue;
      }
      const cards = extractEshopListingProducts(html, pageUrl);
      for (const card of cards) {
        if (!isEshopProductUrl(card.productUrl, categoryUrlSet)) continue;
        const key = card.productUrl;
        if (!productByUrl.has(key)) {
          productByUrl.set(key, {
            ...card,
            categoryPath: new URL(card.productUrl).pathname,
          });
        }
      }
      if (listingDelayMs) await new Promise((r) => setTimeout(r, listingDelayMs));
    }
  }

  const entries = [...productByUrl.values()];
  const records = [];

  for (let i = 0; i < entries.length; i += detailBatchSize) {
    const batch = entries.slice(i, i + detailBatchSize);
    onProgress?.({
      phase: 'details',
      index: i + batch.length,
      total: entries.length,
    });

    const enriched = await Promise.all(batch.map(async (card) => {
      try {
        const html = await fetchHtml(card.productUrl);
        const detail = extractEshopProductDetail(html, card.productUrl);
        return eshopCardToRecord(card, detail, base);
      } catch {
        return eshopCardToRecord(card, {}, base);
      }
    }));

    for (const row of enriched) {
      if (row) records.push(row);
    }
    if (detailDelayMs) await new Promise((r) => setTimeout(r, detailDelayMs));
  }

  return {
    records: filterUniformCatalogRecords(records),
    method: 'eshop-crawl',
    brand: supplierNameFromUrl(base),
    categoriesScanned: categoryUrls.length,
    productCount: records.length,
  };
}

export const SMALLWOODS_CATEGORY_PATHS = [
  '/industries/yachtwear',
  '/collections/evening-collection',
  '/collections/horizon-collection',
  '/collections/officers-collection',
  '/collections/pacific-collection',
  '/collections/sport-collection',
  '/collections/universal-collection',
  '/collections/elements-collection',
  '/styles',
  '/styles/blouses',
  '/styles/dresses',
  '/styles/pants',
  '/styles/shorts',
  '/styles/skorts',
  '/polo',
  '/t-shirts',
  '/shoes',
  '/foul-weather-gear',
];

function titleCaseColour(label = '') {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseMagentoJsonConfig(html) {
  const blocks = [...String(html || '').matchAll(/<script type="text\/x-magento-init">([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]);
      for (const val of Object.values(parsed)) {
        const cfg = val?.['Magento_Swatches/js/swatch-renderer']?.jsonConfig;
        if (cfg?.attributes) return cfg;
      }
    } catch {
      // ignore malformed init blocks
    }
  }
  return null;
}

function magentoAttribute(cfg, codeRe) {
  return Object.values(cfg?.attributes || {}).find((attr) => codeRe.test(String(attr.code || '')));
}

export function extractMagentoProductUrls(html, origin = '') {
  const urls = new Set();
  const patterns = [
    /href="(https?:\/\/[^"]+\.smallwoods\.com\/[a-z0-9-]+\.html)"/gi,
    /href="(\/[a-z0-9-]+\.html)"/gi,
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(html)) !== null) {
      const href = match[1];
      if (/\/(customer|checkout|catalog|wishlist|sales|contact|privacy|enable-cookies|no-route)\//i.test(href)) continue;
      urls.add(absoluteUrl(href, origin));
    }
  }
  return [...urls].sort();
}

export function extractMagentoPaginationUrls(html, pageUrl = '') {
  const urls = new Set([String(pageUrl || '').replace(/\/$/, '')]);
  const re = /href=["']([^"']*\?p=\d+)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    urls.add(absoluteUrl(match[1], pageUrl));
  }
  return [...urls];
}

export function extractMagentoListingProducts(html, pageUrl = '') {
  const products = [];
  const seen = new Set();
  const linkRe = /class="product-item-link"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRe.exec(html)) !== null) {
    const productUrl = absoluteUrl(match[1], pageUrl);
    const key = productUrl.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const blockStart = Math.max(0, match.index - 2500);
    const block = html.slice(blockStart, match.index + 500);
    const imageMatch = block.match(/data-lazysrc="([^"]+)"/i)
      || block.match(/class="product-image-photo[^"]*"[^>]*(?:data-lazysrc|src)="([^"]+)"/i);
    const priceMatch = block.match(/data-price-amount="([^"]+)"/i);

    products.push({
      name: normaliseName(decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ''))),
      productUrl,
      imageUrl: imageMatch?.[1] ? absoluteUrl(imageMatch[1], pageUrl) : '',
      price: parseMoney(priceMatch?.[1]) ?? 0,
    });
  }
  return products;
}

export function extractMagentoProductDetail(html, pageUrl = '') {
  const name = normaliseName(decodeHtmlEntities(
    html.match(/itemprop="name"[^>]*>([^<]+)/i)?.[1]
    || html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)/i)?.[1]
    || '',
  ));
  const price = parseMoney(html.match(/data-price-amount="([^"]+)"/i)?.[1]);
  const details = decodeHtmlEntities(html.match(/<meta name="description" content="([^"]+)"/i)?.[1] || '');
  const fabric = extractFabricFromDescription(details) || cleanFabricComposition(details.slice(0, 240));

  const cfg = parseMagentoJsonConfig(html);
  const colorAttr = magentoAttribute(cfg, /^colou?r$/i);
  const sizeAttr = magentoAttribute(cfg, /^size$/i);
  const colours = (colorAttr?.options || []).map((opt) => titleCaseColour(opt.label)).filter(Boolean);
  const sizeValues = (sizeAttr?.options || []).map((opt) => String(opt.label || '').trim()).filter(Boolean);
  const sizeRange = sizeValues.length >= 2
    ? `${sizeValues[0]}–${sizeValues[sizeValues.length - 1]}`
    : sizeValues.join(', ');

  const colourImages = {};
  for (const opt of colorAttr?.options || []) {
    const productId = opt.products?.[0];
    const image = cfg?.images?.[productId]?.[0]?.img || cfg?.images?.[productId]?.[0]?.full;
    if (image && opt.label) colourImages[titleCaseColour(opt.label)] = image;
  }

  const imageUrl = Object.values(colourImages)[0]
    || absoluteUrl(html.match(/data-lazysrc="([^"]+)"/i)?.[1] || '', pageUrl)
    || absoluteUrl(html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || '', pageUrl);

  const prefer = ['White', 'Stone', 'Ivory'];
  let swatch = '#e2e8f0';
  for (const c of prefer) {
    if (colours.includes(c)) {
      swatch = colourToHex(c);
      break;
    }
  }
  if (swatch === '#e2e8f0' && colours[0]) swatch = colourToHex(colours[0]);

  return {
    name,
    brand: "Smallwood's",
    price: price ?? 0,
    currency: /\bUSD\b/i.test(html) || /\$/.test(html) ? 'USD' : 'USD',
    fabric,
    details: details.slice(0, 500),
    sizeRange,
    colours,
    colourImages,
    imageUrl,
    swatch,
  };
}

function fitFromMagentoProduct(name = '', productUrl = '') {
  const text = `${name} ${productUrl}`.toLowerCase();
  if (/\bunisex\b/i.test(text)) return ['woman', 'man'];
  if (/\b(women'?s?|womens|ladies|female)\b/i.test(text)) return ['woman'];
  if (/\b(men'?s?|mens|male)\b/i.test(text)) return ['man'];
  if (/(?:^|\/)(?:womens?|women-s-|women-s)/i.test(text)) return ['woman'];
  if (/(?:^|\/)(?:mens?|men-s-|men-s)/i.test(text)) return ['man'];
  return guessFitFromProductTitle(name, '');
}

export function magentoCardToRecord(card, detail = {}, origin = '') {
  const name = normaliseName(detail.name || card.name);
  if (!name) return null;

  const productUrl = card.productUrl || '';
  let slug = '';
  try {
    slug = new URL(productUrl).pathname.replace(/^\//, '').replace(/\.html$/, '');
  } catch {
    slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  }

  const category = guessCategory(name, detail.details || '');
  const fit = fitFromMagentoProduct(name, productUrl);
  const colours = detail.colours?.length ? detail.colours : [];
  const colourImages = detail.colourImages && Object.keys(detail.colourImages).length
    ? detail.colourImages
    : undefined;
  const supplierName = supplierNameFromUrl(origin) || "Smallwood's Yachtwear";
  const currency = detail.currency === 'USD' ? '$' : (detail.currency || '$');

  return {
    id: `sw-${slug}`,
    category,
    name,
    brand: detail.brand || "Smallwood's",
    price: Number(detail.price ?? card.price) || 0,
    currency,
    colours,
    swatch: detail.swatch || colourToHex(colours[0]),
    accent: '#0b1f3a',
    fabric: detail.fabric || '',
    details: detail.details || '',
    fit,
    roleTags: inferDepartmentTags({ name, category, details: detail.details }),
    leadTime: '',
    minOrder: 1,
    sizeRange: detail.sizeRange || '',
    imageHint: imageHintForCategory(category),
    imageUrl: detail.imageUrl || card.imageUrl || '',
    colourImages,
    supplierName,
    productUrl,
    active: true,
  };
}

/** Crawl Smallwoods Magento categories + HTML sitemap for uniform, shoes, and accessories. */
export async function extractMagentoCatalog(origin, fetchHtml, {
  categoryPaths = SMALLWOODS_CATEGORY_PATHS,
  detailBatchSize = 6,
  listingDelayMs = 100,
  detailDelayMs = 80,
  onProgress,
} = {}) {
  const base = origin.replace(/\/$/, '');
  const productByUrl = new Map();

  try {
    const sitemapHtml = await fetchHtml(`${base}/htmlsitemap/`);
    for (const url of extractMagentoProductUrls(sitemapHtml, base)) {
      productByUrl.set(url.replace(/\/$/, ''), { productUrl: url.replace(/\/$/, ''), name: '' });
    }
  } catch {
    // sitemap optional
  }

  for (let ci = 0; ci < categoryPaths.length; ci += 1) {
    const path = categoryPaths[ci];
    const catUrl = `${base}${path}`;
    onProgress?.({ phase: 'listing', category: catUrl, index: ci + 1, total: categoryPaths.length });

    let catHtml;
    try {
      catHtml = await fetchHtml(catUrl);
    } catch {
      continue;
    }

    for (const pageUrl of extractMagentoPaginationUrls(catHtml, catUrl)) {
      let html;
      try {
        html = pageUrl === catUrl ? catHtml : await fetchHtml(pageUrl);
      } catch {
        continue;
      }
      for (const card of extractMagentoListingProducts(html, pageUrl)) {
        productByUrl.set(card.productUrl.replace(/\/$/, ''), card);
      }
      if (listingDelayMs) await new Promise((r) => setTimeout(r, listingDelayMs));
    }
  }

  const entries = [...productByUrl.values()];
  const records = [];

  for (let i = 0; i < entries.length; i += detailBatchSize) {
    const batch = entries.slice(i, i + detailBatchSize);
    onProgress?.({ phase: 'details', index: i + batch.length, total: entries.length });

    const enriched = await Promise.all(batch.map(async (card) => {
      try {
        const html = await fetchHtml(card.productUrl);
        const detail = extractMagentoProductDetail(html, card.productUrl);
        return magentoCardToRecord(card, detail, base);
      } catch {
        return magentoCardToRecord(card, {}, base);
      }
    }));

    for (const row of enriched) {
      if (row) records.push(row);
    }
    if (detailDelayMs) await new Promise((r) => setTimeout(r, detailDelayMs));
  }

  return {
    records: filterUniformCatalogRecords(records),
    method: 'magento-crawl',
    brand: supplierNameFromUrl(base),
    categoriesScanned: categoryPaths.length,
    productCount: records.length,
  };
}

const COLOUR_OPTION_RE = /^(couleur|color|colour|colors|colours)$/i;
const SIZE_OPTION_RE = /^(taille|size|sizes)$/i;

export function shopifyStoreOrigin(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

function stripHtmlTags(html) {
  return decodeHtmlEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

export function extractFabricFromDescription(bodyHtml) {
  const text = stripHtmlTags(bodyHtml);
  const patterns = [
    /\bMaterial[s]?:\s*([^.\n]+)/i,
    /\bFabric[s]?:\s*([^.\n]+)/i,
    /\bComposition:\s*([^.\n]+)/i,
    /\bMade from\s+(?:a\s+)?(?:[^.\n]*?\bblend\s+of\s+)?([^.\n]+)/i,
    /\bblend\s+of\s+([^.\n]+)/i,
    /\bconsisting\s+of\s+([^.\n]+)/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) {
      const cleaned = cleanFabricComposition(match[1]);
      if (cleaned) return cleaned;
    }
  }
  return cleanFabricComposition(text.slice(0, 500));
}

export function shopifyOptionValues(product, optionRe) {
  const opt = (product.options || []).find((o) => optionRe.test(String(o.name || '')));
  return opt?.values || [];
}

export function guessFitFromProductTitle(title, category = '') {
  const t = String(title || '');
  if (/\bunisex\b/i.test(t)) return ['woman', 'man'];
  if (/\b(ladies|women'?s?|female|girl)\b/i.test(t)) return ['woman'];
  if (/\b(men'?s?|male|boy)\b/i.test(t) && !/\b(women|ladies)\b/i.test(t)) return ['man'];
  if (category === 'dresses' && !/\b(men'?s?|male|boy)\b/i.test(t)) return ['woman'];
  if (/\bskort\b/i.test(t)) return ['woman'];
  return ['woman', 'man'];
}

export function shopifyColourOptionIndex(product) {
  return (product.options || []).findIndex((o) => COLOUR_OPTION_RE.test(String(o.name || '')));
}

function shopifyColourField(index) {
  if (index === 0) return 'option1';
  if (index === 1) return 'option2';
  if (index === 2) return 'option3';
  return 'option1';
}

/** Map each Shopify colour option to a product-shot image (white background, not lifestyle). */
export function shopifyColourImages(product) {
  const colourList = shopifyOptionValues(product, COLOUR_OPTION_RE);
  if (!colourList.length) return {};

  const colourIdx = shopifyColourOptionIndex(product);
  const colourField = shopifyColourField(colourIdx >= 0 ? colourIdx : 0);
  const images = product.images || [];
  const variants = product.variants || [];

  const productShots = images.filter((img) => !isLifestyleShopifyImage(img.src));
  const shotsWithVariants = productShots.filter((img) => (img.variant_ids || []).length > 0);
  const pool = shotsWithVariants.length ? shotsWithVariants : productShots;

  const map = {};
  for (const colour of colourList) {
    const variantIds = new Set(
      variants.filter((v) => v[colourField] === colour).map((v) => v.id),
    );
    const match = pool.find((img) =>
      (img.variant_ids || []).some((id) => variantIds.has(id)),
    );
    if (match?.src) map[colour] = match.src;
  }

  if (!Object.keys(map).length && colourList.length === 1) {
    const best = pool[0] || productShots[0];
    if (best?.src && !isLifestyleShopifyImage(best.src)) map[colourList[0]] = best.src;
  }

  return map;
}

export function pickDefaultShopifyImage(product, colourImages = {}) {
  const colours = shopifyOptionValues(product, COLOUR_OPTION_RE);
  const prefer = ['White', 'Blanc', 'Ivory'];
  for (const c of prefer) {
    if (colourImages[c]) {
      return { imageUrl: colourImages[c], colour: c, swatch: colourToHex(c) };
    }
  }
  const first = colours.find((c) => colourImages[c]);
  if (first) {
    return { imageUrl: colourImages[first], colour: first, swatch: colourToHex(first) };
  }
  const fallback = (product.images || []).find((img) => !isLifestyleShopifyImage(img.src));
  const imageUrl = fallback?.src
    || product.images?.[0]?.src
    || '';
  return {
    imageUrl,
    colour: colours[0] || '',
    swatch: colourToHex(colours[0]),
  };
}

export function shopifyProductToRecord(product, supplierDefault = '', origin = '') {
  const title = normaliseName(product.title);
  if (!title || title.length < 3) return null;

  const variants = product.variants || [];
  const prices = variants
    .map((v) => parseMoney(v.price))
    .filter((p) => p != null && p >= 0);
  const price = prices.length ? Math.min(...prices) : 0;

  const colourList = shopifyOptionValues(product, COLOUR_OPTION_RE);
  const sizeValues = shopifyOptionValues(product, SIZE_OPTION_RE);
  const sizeRange = sizeValues.length >= 2
    ? `${sizeValues[0]}–${sizeValues[sizeValues.length - 1]}`
    : sizeValues.join(', ');

  const plainDetails = stripHtmlTags(product.body_html);
  const fabric = extractFabricFromDescription(product.body_html);
  const colourImages = shopifyColourImages(product);
  const { imageUrl, swatch } = pickDefaultShopifyImage(product, colourImages);

  const brand = product.vendor || '';
  const context = `${product.product_type || ''} ${plainDetails.slice(0, 400)}`;
  const category = guessCategory(title, context);
  const fit = guessFitFromProductTitle(title, category).join('|');
  const storeOrigin = origin.replace(/\/$/, '');
  const productUrl = product.handle && storeOrigin
    ? `${storeOrigin}/products/${product.handle}`
    : '';

  return rowFromParts({
    name: title,
    price,
    currency: 'EUR',
    brand,
    category,
    imageUrl,
    fabric,
    details: plainDetails.slice(0, 500),
    colours: colourList.join('|'),
    colourImages,
    swatch,
    fit,
    sizeRange,
    supplierName: supplierDefault || supplierNameFromUrl(storeOrigin) || '',
    productUrl,
  });
}

export function parseShopifyCollectionHandle(url) {
  try {
    const match = new URL(url).pathname.match(/\/collections\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

export async function fetchShopifyCollectionProducts(origin, handle, fetchJson, { pageSize = 250, maxPages = 10 } = {}) {
  const products = [];
  const base = origin.replace(/\/$/, '');

  for (let page = 1; page <= maxPages; page += 1) {
    const url = `${base}/collections/${encodeURIComponent(handle)}/products.json?limit=${pageSize}&page=${page}`;
    const data = await fetchJson(url);
    const batch = data?.products;
    if (!Array.isArray(batch) || batch.length === 0) break;
    products.push(...batch);
    if (batch.length < pageSize) break;
  }

  return products;
}

export async function fetchAllShopifyProducts(origin, fetchJson, { pageSize = 50, maxPages = 40 } = {}) {
  const products = [];
  const base = origin.replace(/\/$/, '');

  for (let page = 1; page <= maxPages; page += 1) {
    const url = `${base}/products.json?limit=${pageSize}&page=${page}`;
    const data = await fetchJson(url);
    const batch = data?.products;
    if (!Array.isArray(batch) || batch.length === 0) break;
    products.push(...batch);
    if (batch.length < pageSize) break;
  }

  return products;
}

export async function extractShopifyCatalog(url, fetchJson, { maxProducts = 500 } = {}) {
  const origin = shopifyStoreOrigin(url);
  if (!origin) return { records: [], method: 'shopify', brand: '' };

  const supplierName = supplierNameFromUrl(url) || brandFromHostname(url);
  const collectionHandle = parseShopifyCollectionHandle(url);
  const maxPages = Math.max(1, Math.ceil(maxProducts / 50));
  const products = collectionHandle
    ? await fetchShopifyCollectionProducts(origin, collectionHandle, fetchJson, { maxPages })
    : await fetchAllShopifyProducts(origin, fetchJson, { maxPages });
  const records = products
    .map((p) => shopifyProductToRecord(p, supplierName, origin))
    .filter(Boolean);

  return {
    records: filterUniformCatalogRecords(records).slice(0, maxProducts),
    method: collectionHandle ? 'shopify-collection-json' : 'shopify-json',
    brand: supplierName,
  };
}

function parseXmlLocs(xml = '') {
  const locs = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let match;
  while ((match = re.exec(xml)) !== null) {
    locs.push(match[1].trim());
  }
  return locs;
}

function wooStorePrices(product) {
  const prices = product?.prices || {};
  const raw = prices.price ?? prices.regular_price ?? prices.sale_price ?? 0;
  const minor = Number(String(raw).replace(/[^\d]/g, ''));
  if (!Number.isFinite(minor) || minor <= 0) return 0;
  const decimals = Number(prices.currency_minor_unit ?? 2);
  return minor / (10 ** decimals);
}

function wooStoreCurrency(product) {
  const code = product?.prices?.currency_code || 'EUR';
  if (code === 'EUR') return 'EUR';
  if (code === 'GBP') return 'GBP';
  if (code === 'USD') return 'USD';
  return code;
}

function wooStoreProductToRecord(product, supplierName, origin) {
  const title = normaliseName(product?.name);
  if (!title || title.length < 3) return null;

  const price = wooStorePrices(product);
  const currency = wooStoreCurrency(product);
  const plainDetails = stripHtmlTags(product?.description || product?.short_description || '');
  const fabric = extractFabricFromDescription(product?.description || product?.short_description || '');
  const category = guessCategory(title, plainDetails);
  const fit = guessFitFromProductTitle(title, category).join('|');
  const imageUrl = product?.images?.[0]?.src || product?.images?.[0]?.thumbnail || '';
  const colourImages = {};
  for (const img of product?.images || []) {
    const alt = String(img?.name || img?.alt || '').trim();
    if (alt && img?.src) colourImages[alt] = img.src;
  }
  const colours = (product?.attributes || [])
    .filter((a) => COLOUR_OPTION_RE.test(String(a?.name || a?.taxonomy || '')))
    .flatMap((a) => a.terms?.map((t) => t.name) || a.options || [])
    .filter(Boolean)
    .join('|');

  return rowFromParts({
    name: title,
    price,
    currency,
    brand: product?.brands?.[0]?.name || supplierName,
    category,
    imageUrl,
    fabric,
    details: plainDetails.slice(0, 500),
    colours,
    colourImages: Object.keys(colourImages).length ? JSON.stringify(colourImages) : '',
    fit,
    supplierName,
    productUrl: product?.permalink || product?.permalink?.href || '',
  });
}

export async function extractWooCommerceStoreCatalog(origin, fetchJson, {
  supplierName = '',
  maxPages = 20,
  pageSize = 100,
  onProgress,
} = {}) {
  const base = origin.replace(/\/$/, '');
  const supplier = supplierName || supplierNameFromUrl(base);
  const records = [];

  for (let page = 1; page <= maxPages; page += 1) {
    onProgress?.({ phase: 'listing', index: page, total: maxPages });
    let batch;
    try {
      batch = await fetchJson(`${base}/wp-json/wc/store/v1/products?per_page=${pageSize}&page=${page}`);
    } catch {
      break;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const product of batch) {
      const row = wooStoreProductToRecord(product, supplier, base);
      if (row) records.push(row);
    }
    if (batch.length < pageSize) break;
  }

  return {
    records: filterUniformCatalogRecords(records),
    method: 'woocommerce-store-api',
    brand: supplier,
    productCount: records.length,
  };
}

async function fetchSitemapLocs(origin, fetchText, paths = []) {
  const base = origin.replace(/\/$/, '');
  const candidates = paths.length
    ? paths
    : ['/product-sitemap.xml', '/wp-sitemap-posts-product-1.xml', '/sitemap_index.xml', '/sitemap.xml'];

  for (const path of candidates) {
    try {
      const xml = await fetchText(`${base}${path}`);
      const locs = parseXmlLocs(xml);
      if (!locs.length) continue;
      if (locs.some((loc) => /product-sitemap|posts-product/i.test(loc))) {
        const nested = [];
        for (const loc of locs.filter((l) => /product-sitemap|posts-product/i.test(l)).slice(0, 5)) {
          try {
            nested.push(...parseXmlLocs(await fetchText(loc)));
          } catch {
            // skip nested sitemap
          }
        }
        if (nested.length) return nested;
      }
      const productLocs = locs.filter((loc) => /\/product\//i.test(loc) || /\/produit\//i.test(loc) || /\/shop\//i.test(loc));
      if (productLocs.length) return productLocs;
    } catch {
      // try next sitemap path
    }
  }
  return [];
}

export async function extractWooCommerceSitemapCatalog(origin, fetchHtml, fetchText, {
  supplierName = '',
  sitemapPaths = [],
  maxProducts = 400,
  detailBatchSize = 8,
  detailDelayMs = 80,
  onProgress,
} = {}) {
  const base = origin.replace(/\/$/, '');
  const supplier = supplierName || supplierNameFromUrl(base);
  const locs = await fetchSitemapLocs(base, fetchText, sitemapPaths);
  const productUrls = [...new Set(locs.filter((loc) => /\/product\//i.test(loc) || /\/produit\//i.test(loc)))].slice(0, maxProducts);
  const records = [];

  for (let i = 0; i < productUrls.length; i += detailBatchSize) {
    const batch = productUrls.slice(i, i + detailBatchSize);
    onProgress?.({ phase: 'details', index: i + batch.length, total: productUrls.length });

    await Promise.all(batch.map(async (productUrl) => {
      try {
        const html = await fetchHtml(productUrl);
        const jsonLd = extractJsonLdProducts(html);
        const row = jsonLd[0]
          ? { ...jsonLd[0], supplierName: supplier, productUrl, brand: jsonLd[0].brand || supplier }
          : null;
        if (row) records.push(row);
      } catch {
        // skip unreachable pages
      }
    }));

    if (detailDelayMs) await new Promise((r) => setTimeout(r, detailDelayMs));
  }

  return {
    records: filterUniformCatalogRecords(records),
    method: 'woocommerce-sitemap-jsonld',
    brand: supplier,
    productCount: records.length,
  };
}

export const SEA_DESIGN_SHOP_PATHS = [
  '/page/shop/formal',
  '/page/shop/dresses-jumpsuits',
  '/page/shop/bottoms',
  '/page/shop/tops/shirts-blouses',
  '/page/shop/tops/polos',
  '/page/shop/tops/t-shirts',
  '/page/shop/midlayers',
  '/page/shop/jackets-gilets-foul-weather',
  '/page/shop/engineer-s-workwear',
  '/page/shop/chef-wear',
  '/page/shop/headwear',
  '/page/shop/footwear',
  '/page/shop/bags-more-',
  '/page/shop/below-deck-collection',
];

export function extractSeaDesignListingProducts(html, pageUrl = '') {
  const products = [];
  const seen = new Set();
  const altRe = /alt=["']([^"']+?)\s+Thumbnail["']/gi;
  let match;
  while ((match = altRe.exec(html)) !== null) {
    const name = normaliseName(decodeHtmlEntities(match[1]));
    if (!name || name.length < 4) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    products.push({ name, productUrl: pageUrl, imageUrl: '' });
  }
  return products;
}

export async function extractSeaDesignCatalog(origin, fetchHtml, {
  supplierName = 'Sea Design',
  shopPaths = SEA_DESIGN_SHOP_PATHS,
  onProgress,
} = {}) {
  const base = origin.replace(/\/$/, '');
  const records = [];
  const seen = new Set();

  for (let i = 0; i < shopPaths.length; i += 1) {
    const path = shopPaths[i];
    const pageUrl = `${base}${path}`;
    onProgress?.({ phase: 'listing', category: pageUrl, index: i + 1, total: shopPaths.length });
    try {
      const html = await fetchHtml(pageUrl);
      for (const card of extractSeaDesignListingProducts(html, pageUrl)) {
        const key = card.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const row = rowFromParts({
          name: card.name,
          brand: card.name.split(/\s+/).slice(0, 2).join(' '),
          supplierName,
          productUrl: pageUrl,
          category: guessCategory(card.name),
          fit: guessFitFromProductTitle(card.name).join('|'),
        });
        if (row) records.push(row);
      }
    } catch {
      // skip unreachable category pages
    }
  }

  return {
    records: filterUniformCatalogRecords(records),
    method: 'sea-design-listing',
    brand: supplierName,
    productCount: records.length,
    categoriesScanned: shopPaths.length,
  };
}

export const WAYPOINT_UNIFORM_CATEGORY_SLUGS = [
  'Crew-uniforms-c156236501',
  'UNIFORM-c202352251',
  'Footwear-c156228754',
  'Chef-wear-c166212837',
  'Engineer-workwear-c166212838',
];

function extractWaypointProductLinks(html, origin = '') {
  const links = new Set();
  const re = /href=["'](?:https?:\/\/waypointuae\.com)?(\/products\/[^"'#?]+)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    links.add(absoluteUrl(match[1], origin));
  }
  return [...links];
}

export async function extractWaypointCatalog(origin, fetchHtml, {
  supplierName = 'Waypoint UAE',
  categorySlugs = WAYPOINT_UNIFORM_CATEGORY_SLUGS,
  detailBatchSize = 8,
  detailDelayMs = 80,
  onProgress,
} = {}) {
  const base = origin.replace(/\/$/, '');
  const productUrls = new Set();

  for (let i = 0; i < categorySlugs.length; i += 1) {
    const catUrl = `${base}/products/${categorySlugs[i]}`;
    onProgress?.({ phase: 'listing', category: catUrl, index: i + 1, total: categorySlugs.length });
    try {
      const html = await fetchHtml(catUrl);
      for (const url of extractWaypointProductLinks(html, base)) {
        if (/-c\d+$/.test(url)) continue;
        productUrls.add(url.replace(/\/$/, ''));
      }
    } catch {
      // skip category
    }
  }

  const urls = [...productUrls];
  const records = [];

  for (let i = 0; i < urls.length; i += detailBatchSize) {
    const batch = urls.slice(i, i + detailBatchSize);
    onProgress?.({ phase: 'details', index: i + batch.length, total: urls.length });
    await Promise.all(batch.map(async (productUrl) => {
      try {
        const html = await fetchHtml(productUrl);
        const jsonLd = extractJsonLdProducts(html);
        const row = jsonLd[0]
          ? { ...jsonLd[0], supplierName, productUrl, brand: jsonLd[0].brand || 'Waypoint' }
          : null;
        if (row) records.push(row);
      } catch {
        // skip
      }
    }));
    if (detailDelayMs) await new Promise((r) => setTimeout(r, detailDelayMs));
  }

  return {
    records: filterUniformCatalogRecords(records),
    method: 'waypoint-jsonld',
    brand: supplierName,
    productCount: records.length,
  };
}

export function isSafeFetchUrl(urlString) {
  try {
    const u = new URL(urlString);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local')) return false;
    if (/^127\./.test(host)) return false;
    if (/^10\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}
