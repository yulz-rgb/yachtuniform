#!/usr/bin/env node
/** Repair ids and re-normalize superyachtCatalog.js without re-crawling. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { superyachtProducts } from '../lib/superyachtCatalog.js';
import { normalizeUniformProduct } from '../lib/uniformTaxonomy.js';
import { filterUniformCatalogRecords, isUniformCatalogRecord } from '../lib/catalogExtract.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seen = new Map();

function slugFromUrl(productUrl = '') {
  try {
    const segments = new URL(productUrl).pathname.split('/').filter(Boolean);
    return segments.slice(1).join('-') || segments[segments.length - 1] || 'item';
  } catch {
    return 'item';
  }
}

function categoryPathScore(url = '') {
  const path = String(url).toLowerCase();
  if (/\/recycled-sustainable\//.test(path)) return 0;
  const segments = path.split('/clothing/')[1]?.split('/').filter(Boolean) || [];
  if (segments.length >= 2) return 3;
  if (segments.length === 1) return 1;
  return 0;
}

function pickPreferredProduct(current, candidate) {
  const currentScore = categoryPathScore(current.productUrl);
  const candidateScore = categoryPathScore(candidate.productUrl);
  if (candidateScore !== currentScore) return candidateScore > currentScore ? candidate : current;
  return String(candidate.productUrl || '').length >= String(current.productUrl || '').length
    ? candidate
    : current;
}

const deduped = new Map();
for (const product of superyachtProducts.filter(isUniformCatalogRecord)) {
  const key = `${product.name}::${(product.brand || '').toLowerCase()}`;
  const normalized = normalizeUniformProduct({
    ...product,
    sizeRange: String(product.sizeRange || '')
      .replace(/Matching.*/i, '')
      .replace(/([0-9]+)–([0-9]+)([A-Za-z])/g, '$1–$2'),
  });
  if (!deduped.has(key)) {
    deduped.set(key, normalized);
    continue;
  }
  deduped.set(key, pickPreferredProduct(deduped.get(key), normalized));
}

const repaired = [...deduped.values()].map((product) => {
  let slug = slugFromUrl(product.productUrl);
  let id = `sys-${slug}`;
  if (seen.has(id)) {
    const n = seen.get(id) + 1;
    seen.set(id, n);
    id = `${id}-${n}`;
  } else {
    seen.set(id, 1);
  }

  return { ...product, id };
});

const js = `// Auto-generated from https://www.thesuperyachtshop.com/clothing — run: node scripts/fetch-superyacht-catalog.mjs
// Repaired: node scripts/repair-superyacht-catalog.mjs
// ${repaired.length} products via eshop-crawl (The Superyacht Shop)

export const superyachtProducts = ${JSON.stringify(repaired, null, 2)};
`;

writeFileSync(join(root, 'lib/superyachtCatalog.js'), js);

const ids = repaired.map((p) => p.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
console.log(`Repaired ${repaired.length} products, ${dupes.length} duplicate ids remaining`);
