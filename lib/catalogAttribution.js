/** Keep manufacturer brand + supplier source URLs in sync with bundled catalog defaults. */

import { filterUniformCatalogRecords } from './catalogExtract.js';
import { normalizeUniformProduct } from './uniformTaxonomy.js';

function productNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

/** Stable merge key — id when present, otherwise supplier + name (avoids cross-supplier drops). */
export function catalogProductKey(product) {
  const id = String(product?.id || '').trim();
  if (id) return `id:${id}`;
  const supplier = String(product?.supplierName || product?.brand || '').trim().toLowerCase();
  return `name:${supplier}::${productNameKey(product?.name)}`;
}

export function productsMissingAttribution(products = []) {
  if (!products.length) return true;
  const marinaLike = products.filter((p) => p.id?.startsWith('marina-'));
  if (marinaLike.length < 10) return false;
  const withLinks = marinaLike.filter((p) => p.supplierName && p.productUrl).length;
  return withLinks < marinaLike.length * 0.5;
}

function buildUniqueNameMap(defaults = []) {
  const counts = new Map();
  for (const p of defaults) {
    const key = productNameKey(p.name);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const map = new Map();
  for (const p of defaults) {
    const key = productNameKey(p.name);
    if (counts.get(key) === 1) map.set(key, p);
  }
  return map;
}

function findDefaultRef(p, { byId, byKey, byNameSupplier, byBrandName, byUniqueName }) {
  if (p.id && byId.has(p.id)) return byId.get(p.id);
  const keyHit = byKey.get(catalogProductKey(p));
  if (keyHit) return keyHit;

  const name = productNameKey(p.name);
  const supplier = String(p.supplierName || '').trim().toLowerCase();
  const brand = String(p.brand || '').trim().toLowerCase();

  if (supplier) {
    const supplierHit = byNameSupplier.get(`${supplier}::${name}`);
    if (supplierHit) return supplierHit;
  }
  if (brand) {
    const brandHit = byBrandName.get(`${brand}::${name}`);
    if (brandHit) return brandHit;
  }
  if (supplier && supplier !== brand) {
    const brandAsSupplierHit = byBrandName.get(`${supplier}::${name}`);
    if (brandAsSupplierHit) return brandAsSupplierHit;
  }

  return byUniqueName.get(name) || null;
}

export function enrichProductsWithDefaults(stored = [], defaults = []) {
  const byId = new Map(defaults.filter((p) => p.id).map((p) => [p.id, p]));
  const byKey = new Map(defaults.map((p) => [catalogProductKey(p), p]));
  const byNameSupplier = new Map(
    defaults.map((p) => [`${String(p.supplierName || '').trim().toLowerCase()}::${productNameKey(p.name)}`, p]),
  );
  const byBrandName = new Map(
    defaults.map((p) => [`${String(p.brand || '').trim().toLowerCase()}::${productNameKey(p.name)}`, p]),
  );
  const byUniqueName = buildUniqueNameMap(defaults);
  const lookup = { byId, byKey, byNameSupplier, byBrandName, byUniqueName };

  return stored.map((p) => {
    const ref = findDefaultRef(p, lookup);
    if (!ref) return normalizeUniformProduct(p);
    return normalizeUniformProduct({
      ...ref,
      ...p,
      id: p.id || ref.id,
      brand: p.brand || ref.brand || '',
      supplierName: ref.supplierName || p.supplierName || p.brand || '',
      supplierCatalogId: p.supplierCatalogId || ref.supplierCatalogId,
      productUrl: p.productUrl || ref.productUrl || '',
      fit: ref.fit?.length ? ref.fit : p.fit,
      colourImages: { ...(ref.colourImages || {}), ...(p.colourImages || {}) },
      imageUrl: p.imageUrl || ref.imageUrl || '',
      swatch: p.swatch || ref.swatch,
      price: p.price ?? ref.price,
    });
  });
}

function enrichedMatchesDefault(enriched, defaultProduct) {
  if (productNameKey(enriched.name) !== productNameKey(defaultProduct.name)) return false;
  const enrichedSupplier = String(enriched.supplierName || enriched.brand || '').trim().toLowerCase();
  const defaultSupplier = String(defaultProduct.supplierName || '').trim().toLowerCase();
  const defaultBrand = String(defaultProduct.brand || '').trim().toLowerCase();
  return enrichedSupplier === defaultSupplier || (defaultBrand && enrichedSupplier === defaultBrand);
}

/** Enrich stored rows and append bundled catalog items missing from workspace state. */
export function mergeCatalogWithDefaults(stored = [], defaults = []) {
  const uniformStored = filterUniformCatalogRecords(stored);
  const uniformDefaults = filterUniformCatalogRecords(defaults);

  if (!uniformDefaults.length) {
    return uniformStored.map((p) => normalizeUniformProduct(p));
  }
  if (!uniformStored.length) {
    return uniformDefaults.map((p) => ({ ...p }));
  }

  const enriched = enrichProductsWithDefaults(uniformStored, uniformDefaults);
  const seenKeys = new Set(enriched.map(catalogProductKey));

  const added = uniformDefaults.filter((p) => {
    if (seenKeys.has(catalogProductKey(p))) return false;
    if (enriched.some((e) => enrichedMatchesDefault(e, p))) return false;
    return true;
  });

  return added.length ? [...enriched, ...added] : enriched;
}

export function resolveCatalogProducts(source, defaults = []) {
  return ensureFullBundledCatalog(source, defaults);
}

/** Always return the full bundled catalog — append stored custom rows without dropping suppliers. */
export function ensureFullBundledCatalog(stored = [], defaults = []) {
  if (!defaults.length) {
    return stored.length ? stored.map((p) => normalizeUniformProduct(p)) : [];
  }
  if (!stored.length) return defaults.map((p) => ({ ...p }));
  const merged = mergeCatalogWithDefaults(stored, defaults);
  if (merged.length >= defaults.length) return merged;
  return mergeCatalogWithDefaults([], defaults);
}

export function isSparseServerCatalog(stored = [], defaults = []) {
  if (!stored.length || !defaults.length) return false;
  return stored.length < defaults.length * 0.85;
}
