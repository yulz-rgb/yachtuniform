import { describe, it, expect } from 'vitest';
import {
  productMatchesNav,
  catalogNavForProduct,
  navCategories,
  productMatchesBodyType,
  productMatchesDressFilter,
  resolveProductFit,
} from './catalog.js';

describe('productMatchesNav', () => {
  const bridge = navCategories.find((n) => n.id === 'bridge');
  const footwear = navCategories.find((n) => n.id === 'footwear');

  it('shows untagged products in department navs', () => {
    const polo = { category: 'tops', roleTags: [] };
    expect(productMatchesNav(polo, bridge)).toBe(true);
  });

  it('filters tagged products to matching departments', () => {
    const deckPolo = { category: 'tops', roleTags: ['deck'] };
    const deckNav = navCategories.find((n) => n.id === 'deck');
    expect(productMatchesNav(deckPolo, deckNav)).toBe(true);
    expect(productMatchesNav(deckPolo, bridge)).toBe(false);
  });

  it('still filters shared category navs by category', () => {
    const shoe = { category: 'shoes', roleTags: [] };
    const polo = { category: 'tops', roleTags: [] };
    expect(productMatchesNav(shoe, footwear)).toBe(true);
    expect(productMatchesNav(polo, footwear)).toBe(false);
  });
});

describe('catalogNavForProduct', () => {
  it('routes shared categories to their catalog nav', () => {
    expect(catalogNavForProduct({ category: 'shoes', roleTags: [] })).toBe('footwear');
    expect(catalogNavForProduct({ category: 'accessories', roleTags: [] })).toBe('accessories');
  });

  it('routes tagged products to matching department nav', () => {
    expect(catalogNavForProduct({ category: 'tops', roleTags: ['deck'] })).toBe('deck');
    expect(catalogNavForProduct({ category: 'tops', roleTags: ['interior'] })).toBe('interior');
  });

  it('defaults untagged garments to bridge', () => {
    expect(catalogNavForProduct({ category: 'tops', roleTags: [] })).toBe('bridge');
  });
});

describe('productMatchesDressFilter', () => {
  it('includes actual dresses', () => {
    expect(productMatchesDressFilter({ name: 'Ladies V-Neck Dress' })).toBe(true);
    expect(productMatchesDressFilter({ name: 'Ladies 3/4 Sleeve Dress' })).toBe(true);
    expect(productMatchesDressFilter({ name: 'Straight Dress Kariban Premium' })).toBe(true);
  });

  it('excludes dress shirts, jackets, and prose false positives', () => {
    expect(productMatchesDressFilter({ name: 'Ladies Popeline Long Sleeve Dress Shirt RUSSEL' })).toBe(false);
    expect(productMatchesDressFilter({ name: 'Ladies Long Sleeve Elegance Dress Shirt with Shoulder Tabs' })).toBe(false);
    expect(productMatchesDressFilter({ name: 'Ladies No Sleeve Softshell Jacket RUSSELL' })).toBe(false);
    expect(productMatchesDressFilter({
      name: 'Softshell Vest',
      details: 'ensures your crew is dressed to impress',
    })).toBe(false);
  });
});

describe('productMatchesBodyType', () => {
  it('shows mens and unisex for male model, not ladies', () => {
    expect(productMatchesBodyType({ name: "Men's Chino Bermuda", fit: ['man'] }, 'man')).toBe(true);
    expect(productMatchesBodyType({ name: 'Unisex Chef Trousers', fit: ['woman', 'man'] }, 'man')).toBe(true);
    expect(productMatchesBodyType({ name: 'Ladies Quick Dry Bermuda', fit: ['woman'] }, 'man')).toBe(false);
    expect(productMatchesBodyType({ name: 'Ladies Quick Dry Bermuda', fit: ['woman', 'man'] }, 'man')).toBe(false);
  });

  it('shows ladies and unisex for female model, not mens-only', () => {
    expect(productMatchesBodyType({ name: 'Ladies V-Neck Pique T-Shirt', fit: ['woman'] }, 'woman')).toBe(true);
    expect(productMatchesBodyType({ name: 'Unisex Chef Trousers', fit: ['woman', 'man'] }, 'woman')).toBe(true);
    expect(productMatchesBodyType({ name: "Men's Chino Bermuda", fit: ['man'] }, 'woman')).toBe(false);
    expect(productMatchesBodyType({ name: "Men's Chino Bermuda", fit: ['woman', 'man'] }, 'woman')).toBe(false);
  });

  it('treats dresses as womens even when fit is mis-tagged', () => {
    const dress = { name: 'Straight Dress Kariban Premium', category: 'dresses', fit: ['woman', 'man'] };
    expect(resolveProductFit(dress)).toEqual(['woman']);
    expect(productMatchesBodyType(dress, 'man')).toBe(false);
  });

  it('excludes mens items with wrong fit data for female model', () => {
    const bad = {
      name: "Men's Chino Bermuda",
      fit: ['woman', 'man'],
      productUrl: 'https://www.marinayachtwear.com/products/mens-chino-bermuda-kariban',
    };
    expect(productMatchesBodyType(bad, 'woman')).toBe(false);
    expect(productMatchesBodyType(bad, 'female')).toBe(false);
    expect(productMatchesBodyType(bad, 'man')).toBe(true);
  });

  it('detects mens fit from sku or url when name is generic', () => {
    const bad = {
      name: 'Chino Bermuda',
      sku: 'mens-chino-bermuda-kariban',
      fit: ['woman', 'man'],
    };
    expect(productMatchesBodyType(bad, 'woman')).toBe(false);
    expect(productMatchesBodyType(bad, 'man')).toBe(true);
  });
});
