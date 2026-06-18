#!/usr/bin/env node
/** Fetch Marina Yacht Wear catalog via Shopify JSON API and write import files. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseColourImages } from '../lib/productColour.js';
import {
  extractShopifyCatalog,
  fetchAllShopifyProducts,
} from '../lib/catalogExtract.js';

const SOURCE_URL = 'https://www.marinayachtwear.com/';
const SUPPLIER_NAME = 'Marina Yacht Wear';
const CATALOG_COLUMNS = [
  'category', 'name', 'brand', 'price', 'currency', 'vatRate', 'colours',
  'swatch', 'accent', 'fabric', 'details', 'fit', 'roleTags', 'leadTime', 'minOrder',
  'sizeRange', 'imageHint', 'imageUrl', 'colourImages', 'supplierName', 'productUrl', 'active',
];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function escapeCell(cell) {
  return `"${String(cell ?? '').replaceAll('"', '""')}"`;
}

function toCsv(rows) {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\n');
}

function splitList(value) {
  if (!value) return [];
  return String(value).split(/[|,]/).map((v) => v.trim()).filter(Boolean);
}

function recordToProduct(raw, handle) {
  const productUrl = handle ? `${SOURCE_URL.replace(/\/$/, '')}/products/${handle}` : '';
  return {
    id: `marina-${handle}`,
    category: raw.category,
    name: raw.name,
    brand: raw.brand,
    price: Number(raw.price) || 0,
    currency: raw.currency === 'EUR' ? '€' : raw.currency,
    colours: splitList(raw.colours),
    swatch: raw.swatch || '#ffffff',
    accent: raw.accent || '#0b1f3a',
    fabric: raw.fabric || '',
    details: raw.details || '',
    fit: splitList(raw.fit).filter((f) => f === 'woman' || f === 'man'),
    roleTags: splitList(raw.roleTags),
    leadTime: raw.leadTime || '',
    minOrder: Number(raw.minOrder) || 1,
    sizeRange: raw.sizeRange || '',
    imageHint: raw.imageHint || 'polo',
    imageUrl: raw.imageUrl || '',
    colourImages: parseColourImages(raw.colourImages),
    supplierName: raw.supplierName || SUPPLIER_NAME,
    productUrl: raw.productUrl || productUrl,
    active: raw.active !== 'false',
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'YachtUniformCatalogBot/1.0' },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function main() {
  const { records, method, brand } = await extractShopifyCatalog(SOURCE_URL, fetchJson);
  const shopifyProducts = await fetchAllShopifyProducts('https://www.marinayachtwear.com', fetchJson);
  const handleByTitle = new Map(shopifyProducts.map((p) => [p.title, p.handle]));

  const csvRows = [
    CATALOG_COLUMNS,
    ...records.map((raw) => CATALOG_COLUMNS.map((col) => String(raw[col] ?? ''))),
  ];
  const csvPath = join(root, 'docs/marina-yacht-wear-catalog.csv');
  writeFileSync(csvPath, toCsv(csvRows));

  const catalogProducts = records.map((raw) => {
    const handle = handleByTitle.get(raw.name)
      || raw.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return recordToProduct(raw, handle);
  });

  const jsPath = join(root, 'lib/marinaCatalog.js');
  const js = `// Auto-generated from ${SOURCE_URL} — run: node scripts/fetch-marina-catalog.mjs
// ${catalogProducts.length} products via ${method} (${brand})

export const marinaProducts = ${JSON.stringify(catalogProducts, null, 2)};
`;
  writeFileSync(jsPath, js);

  const withImages = catalogProducts.filter((p) => p.imageUrl).length;
  console.log(`Fetched ${records.length} products (${withImages} with images)`);
  console.log(`Wrote ${csvPath}`);
  console.log(`Wrote ${jsPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
