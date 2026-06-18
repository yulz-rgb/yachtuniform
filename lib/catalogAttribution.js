/** Keep manufacturer brand + supplier source URLs in sync with bundled catalog defaults. */

export function productsMissingAttribution(products = []) {
  if (!products.length) return true;
  const marinaLike = products.filter((p) => p.id?.startsWith('marina-') || p.sku);
  if (marinaLike.length < 10) return false;
  const withLinks = marinaLike.filter((p) => p.supplierName && p.productUrl).length;
  return withLinks < marinaLike.length * 0.5;
}

export function enrichProductsWithDefaults(stored = [], defaults = []) {
  const byId = new Map(defaults.map((p) => [p.id, p]));
  const bySku = new Map(defaults.filter((p) => p.sku).map((p) => [p.sku, p]));
  const byName = new Map(defaults.map((p) => [String(p.name || '').toLowerCase(), p]));

  return stored.map((p) => {
    const ref = byId.get(p.id)
      || (p.sku ? bySku.get(p.sku) : null)
      || byName.get(String(p.name || '').toLowerCase());
    if (!ref) return p;
    return {
      ...p,
      brand: p.brand || ref.brand || '',
      supplierName: p.supplierName || ref.supplierName || '',
      productUrl: p.productUrl || ref.productUrl || '',
    };
  });
}

export function resolveCatalogProducts(source, defaults = []) {
  const base = source?.length ? source : defaults;
  if (!base.length) return defaults;
  return enrichProductsWithDefaults(base, defaults);
}
