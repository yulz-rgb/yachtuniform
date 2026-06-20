import { describe, it, expect } from 'vitest';
import {
  cutoutSrc,
  figureDimensions,
  garmentLayers,
  resolveGarmentHint,
  resolvePreviewProducts,
} from './previewAssets';

describe('previewAssets', () => {
  it('returns cutout paths for body type and view', () => {
    expect(cutoutSrc('woman', 'front')).toBe('/preview/cutout-woman-front.png');
    expect(cutoutSrc('man', 'back')).toBe('/preview/cutout-man-back.png');
  });

  it('returns native figure dimensions per body type and view', () => {
    expect(figureDimensions('woman', 'front')).toEqual({ width: 258, height: 918 });
    expect(figureDimensions('man', 'front')).toEqual({ width: 276, height: 896 });
  });

  it('resolves garment hints from product metadata', () => {
    expect(resolveGarmentHint({ imageHint: 'polo', name: 'Deck Polo' })).toBe('polo');
    expect(resolveGarmentHint({ imageHint: 'cap', name: 'Braided Elastic Belt', category: 'accessories' })).toBe('belt');
    expect(resolveGarmentHint({ imageHint: 'shorts', name: 'Ladies Chino Pant', category: 'bottoms' })).toBe('trousers');
    expect(resolveGarmentHint({ category: 'engineering', imageHint: 'overalls' })).toBe('overalls');
    // "Short Sleeve" is a sleeve-length descriptor, not the shorts bottoms garment.
    expect(resolveGarmentHint({ category: 'engineering', imageHint: 'overalls', name: 'Dickies Short Sleeve Coveralls' })).toBe('overalls');
    expect(resolveGarmentHint({ imageHint: 'chef-jacket', name: 'Ladies Short Sleeve Chef Jacket' })).toBe('chef-jacket');
    expect(resolveGarmentHint({ imageHint: 'shorts', name: 'Bermuda Shorts' })).toBe('shorts');
  });

  it('layers outfit pieces without duplicate categories', () => {
    const products = [
      { id: '1', category: 'tops', imageUrl: 'https://example.com/polo.jpg', name: 'Polo', imageHint: 'polo' },
      { id: '2', category: 'bottoms', imageUrl: 'https://example.com/shorts.jpg', name: 'Shorts', imageHint: 'shorts' },
      { id: '3', category: 'outerwear', imageUrl: 'https://example.com/jacket.jpg', name: 'Jacket', imageHint: 'jacket' },
    ];
    const layers = garmentLayers('woman', 'front', products);
    expect(layers).toHaveLength(3);
    expect(layers[layers.length - 1].product.category).toBe('outerwear');
    expect(layers[0].slot.fit).toBe('cover');
  });

  it('prefers dress over separate top and bottom for women', () => {
    const products = [
      { id: 'd', category: 'dresses', imageUrl: 'https://example.com/dress.jpg', name: 'Dress', imageHint: 'dress' },
      { id: 't', category: 'tops', imageUrl: 'https://example.com/polo.jpg', name: 'Polo', imageHint: 'polo' },
      { id: 'b', category: 'bottoms', imageUrl: 'https://example.com/shorts.jpg', name: 'Shorts', imageHint: 'shorts' },
    ];
    const resolved = resolvePreviewProducts(products, 'woman');
    expect(resolved.map((p) => p.id)).toEqual(['d']);
  });

  it('stacks epaulettes on top of shirts', () => {
    const products = [
      { id: 's', category: 'shirts', imageUrl: 'https://example.com/shirt.jpg', name: 'Shirt', imageHint: 'shirt' },
      { id: 'e', category: 'epaulettes', imageUrl: 'https://example.com/ep.jpg', name: 'Rank', imageHint: 'epaulettes' },
    ];
    const resolved = resolvePreviewProducts(products, 'man');
    expect(resolved.map((p) => p.id)).toEqual(['s', 'e']);
    const layers = garmentLayers('man', 'front', products);
    expect(layers.find((l) => l.product.id === 'e').slot.z).toBeGreaterThan(
      layers.find((l) => l.product.id === 's').slot.z,
    );
  });

  it('skips products without images', () => {
    const layers = garmentLayers('woman', 'front', [{ id: 'x', category: 'tops', name: 'No img' }]);
    expect(layers).toHaveLength(0);
  });
});
