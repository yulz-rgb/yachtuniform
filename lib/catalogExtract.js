// Heuristic extraction of catalog rows from PDF text or supplier web pages.
// Output shape matches raw CSV records before Zod validation.

import { cleanFabricComposition } from './fabric.js';
import { colourToHex, isLifestyleShopifyImage } from './productColour.js';

const PRICE_RE = /(?:€|EUR\s*|£|GBP\s*|\$|USD\s*)(\d{1,6}(?:[.,]\d{2})?)|(\d{1,6}(?:[.,]\d{2})?)\s*(?:€|EUR|£|GBP|\$|USD)/gi;

const CATEGORY_KEYWORDS = [
  ['epaulettes', /\b(epaulette|rank slide|shoulder board)\b/i],
  ['dresses', /\b(dress|gown)\b/i],
  ['chef-wear', /\b(chef jacket|chef coat|apron|galley)\b/i],
  ['engineering', /\b(overall|boiler suit|coverall)\b/i],
  ['spa-wear', /\b(tunic|spa wear|wellness)\b/i],
  ['outerwear', /\b(jacket|softshell|fleece|foul weather|wet weather|parka|gilet)\b/i],
  ['shoes', /\b(shoe|deck shoe|sneaker|footwear|loafer|trainer)\b/i],
  ['accessories', /\b(cap|belt|sunglasses|beanie|scarf|glove)\b/i],
  ['bottoms', /\b(short|trouser|pant|skort|skirt|chino)\b/i],
  ['shirts', /\b(shirt|blouse|oxford|linen shirt)\b/i],
  ['tops', /\b(polo|tee|t-shirt|top|henley|sweater|knit)\b/i],
];

// Non-garment / upsell lines from supplier stores (linens, luggage, kids, logo services).
const NON_UNIFORM_NAME_PATTERNS = [
  /\bkids?\b/i,
  /\bchildren'?s?\b/i,
  /\btowel/i,
  /\bbag\b/i,
  /\bumbrella\b/i,
  /\b(panama|straw|bob|outback)\s+hat\b/i,
  /\bjute\b/i,
  /\broll[- ]top\b/i,
  /\bbeach\b/i,
  /\bscarf\b/i,
  /\bbandana\b/i,
  /\bswim short/i,
  /\brash guard/i,
  /\bcrocs\b/i,
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

const IMAGE_HINT_BY_CATEGORY = {
  tops: 'polo',
  shirts: 'shirt',
  epaulettes: 'epaulettes',
  dresses: 'dress',
  bottoms: 'shorts',
  'chef-wear': 'chef-jacket',
  engineering: 'overalls',
  'spa-wear': 'shirt',
  outerwear: 'jacket',
  shoes: 'shoes',
  accessories: 'cap',
};

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

export function guessCategory(name, context = '') {
  const hay = `${name} ${context}`;
  for (const [id, re] of CATEGORY_KEYWORDS) {
    if (re.test(hay)) return id;
  }
  return 'tops';
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
    imageHint: IMAGE_HINT_BY_CATEGORY[cat] || 'polo',
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
    return new URL(href, base).href;
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
  const itemRe = /<li>[\s\S]*?<h2>\s*([^<]+?)\s*<\/h2>[\s\S]*?<a\s+href=["']([^"']+)["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
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

export async function extractShopifyCatalog(url, fetchJson) {
  const origin = shopifyStoreOrigin(url);
  if (!origin) return { records: [], method: 'shopify', brand: '' };

  const supplierName = supplierNameFromUrl(url) || 'Marina Yacht Wear';
  const products = await fetchAllShopifyProducts(origin, fetchJson);
  const records = products
    .map((p) => shopifyProductToRecord(p, supplierName, origin))
    .filter(Boolean);

  return {
    records: filterUniformCatalogRecords(records).slice(0, 500),
    method: 'shopify-json',
    brand: supplierName,
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
