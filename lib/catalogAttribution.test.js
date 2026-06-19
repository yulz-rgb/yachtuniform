import { describe, it, expect } from 'vitest';
import { enrichProductsWithDefaults, mergeCatalogWithDefaults, ensureFullBundledCatalog, productsMissingAttribution, isSparseServerCatalog } from './catalogAttribution.js';

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
      fit: ['man'],
    }];
    const [enriched] = enrichProductsWithDefaults(stored, defaults);
    expect(enriched.productUrl).toContain('mens-combed-cotton-t-shirt');
    expect(enriched.fit).toEqual(['man']);
  });

  it('restores supplierCatalogId for server rows keyed by brand + name', () => {
    const stored = [{
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Slam Deck Polo',
      brand: 'SLAM',
      supplierName: 'SLAM',
    }];
    const defaults = [{
      id: 'sys-mens-polos-slam-deck-polo',
      name: 'Slam Deck Polo',
      brand: 'SLAM',
      supplierName: 'The Superyacht Shop',
      supplierCatalogId: 'superyacht-shop',
    }];
    const [enriched] = enrichProductsWithDefaults(stored, defaults);
    expect(enriched.supplierCatalogId).toBe('superyacht-shop');
    expect(enriched.supplierName).toBe('The Superyacht Shop');
  });

  it('merges colour images from bundled defaults', () => {
    const stored = [{ id: 'marina-chef', name: 'Chef Jacket' }];
    const defaults = [{
      id: 'marina-chef',
      name: 'Chef Jacket',
      imageUrl: 'https://cdn.example.com/white.png',
      colourImages: { White: 'https://cdn.example.com/white.png', Navy: 'https://cdn.example.com/navy.png' },
    }];
    const [enriched] = enrichProductsWithDefaults(stored, defaults);
    expect(enriched.colourImages.Navy).toContain('navy.png');
    expect(enriched.imageUrl).toContain('white.png');
  });

  it('appends bundled catalog items missing from stored workspace', () => {
    const stored = [{ id: 'marina-polo', name: 'Polo' }];
    const defaults = [
      { id: 'marina-polo', name: 'Polo', brand: 'Kariban' },
      { id: 'sys-mens-polos-slam-deck-polo', name: 'Slam Deck Polo', brand: 'SLAM' },
    ];
    const merged = mergeCatalogWithDefaults(stored, defaults);
    expect(merged).toHaveLength(2);
    expect(merged[1].id).toBe('sys-mens-polos-slam-deck-polo');
  });

  it('merges server yacht rows by name without duplicating chef trousers', () => {
    const stored = [
      { id: 'cuid-chef', name: 'Unisex Chef Trousers', category: 'bottoms', fit: ['woman', 'man'] },
      { id: 'cuid-belt', name: 'Stretch Weave Belt', category: 'accessories', fit: ['woman', 'man'] },
    ];
    const defaults = [
      {
        id: 'marina-unisex-chef-trousers',
        name: 'Unisex Chef Trousers',
        category: 'bottoms',
        roleTags: ['chef'],
        fit: ['woman', 'man'],
      },
      {
        id: 'marina-ladies-chino-pant',
        name: 'Ladies Chino Pant',
        category: 'bottoms',
        roleTags: ['interior', 'chief-stew'],
        fit: ['woman'],
      },
      {
        id: 'marina-stretch-weave-belt',
        name: 'Stretch Weave Belt',
        category: 'accessories',
        roleTags: ['deck'],
        fit: ['woman', 'man'],
      },
    ];
    const merged = mergeCatalogWithDefaults(stored, defaults);
    expect(merged.filter((p) => p.name === 'Unisex Chef Trousers')).toHaveLength(1);
    expect(merged.some((p) => p.id === 'marina-ladies-chino-pant')).toBe(true);
    expect(merged.find((p) => p.name === 'Unisex Chef Trousers')?.roleTags).toEqual(['chef']);
  });

  it('returns full bundled catalog when stored workspace is incomplete', () => {
    const defaults = [
      { id: 'wave-a', name: 'Deck Polo', supplierName: 'Wave Uniforms', supplierCatalogId: 'wave-uniforms' },
      { id: 'sys-a', name: 'Chef Jacket', supplierName: 'The Superyacht Shop', supplierCatalogId: 'superyacht-shop' },
    ];
    const stored = [{ id: 'wave-a', name: 'Deck Polo', supplierName: 'Wave Uniforms' }];
    const full = ensureFullBundledCatalog(stored, defaults);
    expect(full).toHaveLength(2);
  });

  it('drops non-uniform stored rows such as suncare products', () => {
    const stored = [
      { id: 'lyw-sun-bum', name: 'Sun Bum After Sun Cool Down Gel', supplierName: 'Liquid Yacht Wear' },
      { id: 'wave-a', name: 'Deck Polo', supplierName: 'Wave Uniforms' },
    ];
    const defaults = [
      { id: 'wave-a', name: 'Deck Polo', supplierName: 'Wave Uniforms', brand: 'SLAM' },
    ];
    const merged = mergeCatalogWithDefaults(stored, defaults);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Deck Polo');
  });

  it('merges duplicate product names from different suppliers', () => {
    const stored = [{ id: 'wave-a', name: 'Deck Polo', supplierName: 'Wave Uniforms' }];
    const defaults = [
      { id: 'wave-a', name: 'Deck Polo', supplierName: 'Wave Uniforms', brand: 'SLAM' },
      { id: 'sys-a', name: 'Deck Polo', supplierName: 'The Superyacht Shop', brand: 'SLAM' },
    ];
    const merged = mergeCatalogWithDefaults(stored, defaults);
    expect(merged).toHaveLength(2);
    expect(merged.map((p) => p.supplierName).sort()).toEqual(['The Superyacht Shop', 'Wave Uniforms']);
  });

  it('detects sparse signed-in yacht catalogs', () => {
    expect(isSparseServerCatalog(
      [{ id: 'cuid-1', name: 'Unisex Chef Trousers' }],
      [{ id: 'marina-a', name: 'A' }, { id: 'marina-b', name: 'B' }, { id: 'marina-c', name: 'C' }],
    )).toBe(true);
    expect(isSparseServerCatalog(
      [{ id: 'marina-a', name: 'A' }, { id: 'marina-b', name: 'B' }],
      [{ id: 'marina-a', name: 'A' }, { id: 'marina-b', name: 'B' }, { id: 'marina-c', name: 'C' }],
    )).toBe(true);
    expect(isSparseServerCatalog(
      Array.from({ length: 90 }, (_, i) => ({ id: `p-${i}`, name: `Item ${i}` })),
      Array.from({ length: 100 }, (_, i) => ({ id: `p-${i}`, name: `Item ${i}` })),
    )).toBe(false);
  });
});
