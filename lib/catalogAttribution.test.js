import { describe, it, expect } from 'vitest';
import { enrichProductsWithDefaults, productsMissingAttribution } from './catalogAttribution.js';

describe('catalogAttribution', () => {
  it('detects missing supplier links on marina products', () => {
    const stale = Array.from({ length: 10 }, (_, i) => ({ id: `marina-${i}` }));
    expect(productsMissingAttribution(stale)).toBe(true);
    expect(productsMissingAttribution([
      { id: 'marina-a', supplierName: 'Marina Yacht Wear', productUrl: 'https://example.com/a' },
      { id: 'marina-b', supplierName: 'Marina Yacht Wear', productUrl: 'https://example.com/b' },
    ])).toBe(false);
  });

  it('fills brand and supplier from bundled defaults', () => {
    const stored = [{ id: 'marina-polo', name: 'Polo' }];
    const defaults = [{
      id: 'marina-polo',
      name: 'Polo',
      brand: 'Kariban',
      supplierName: 'Marina Yacht Wear',
      productUrl: 'https://www.marinayachtwear.com/products/polo',
    }];
    const [enriched] = enrichProductsWithDefaults(stored, defaults);
    expect(enriched.brand).toBe('Kariban');
    expect(enriched.supplierName).toBe('Marina Yacht Wear');
    expect(enriched.productUrl).toContain('marinayachtwear.com');
  });

  it('matches bundled defaults by product name for server-stored ids', () => {
    const stored = [{ id: 'cuid-abc', name: "Men's Combed Cotton T-Shirt" }];
    const defaults = [{
      id: 'marina-mens-combed-cotton-t-shirt',
      name: "Men's Combed Cotton T-Shirt",
      brand: 'Marina Yacht Wear',
      supplierName: 'Marina Yacht Wear',
      productUrl: 'https://www.marinayachtwear.com/products/mens-combed-cotton-t-shirt',
    }];
    const [enriched] = enrichProductsWithDefaults(stored, defaults);
    expect(enriched.productUrl).toContain('mens-combed-cotton-t-shirt');
  });
});
