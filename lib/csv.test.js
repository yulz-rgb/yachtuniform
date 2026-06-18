import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  parseCatalogCsv,
  toCsv,
  splitList,
  buildSupplierOrderCsv,
} from './csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('"c,d","e""f"')).toEqual([['c,d', 'e"f']]);
  });
  it('handles newlines inside quotes', () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']]);
  });
  it('skips fully empty rows', () => {
    expect(parseCsv('a\n\n b ')).toEqual([['a'], [' b ']]);
  });
});

describe('parseCatalogCsv', () => {
  it('maps headers to record keys', () => {
    const { headers, records } = parseCatalogCsv('name,price\nPolo,52');
    expect(headers).toEqual(['name', 'price']);
    expect(records[0]).toEqual({ name: 'Polo', price: '52' });
  });
});

describe('splitList', () => {
  it('splits on pipes and commas', () => {
    expect(splitList('White|Navy, Stone')).toEqual(['White', 'Navy', 'Stone']);
    expect(splitList('')).toEqual([]);
  });
});

describe('toCsv', () => {
  it('escapes quotes and wraps cells', () => {
    expect(toCsv([['a"b', 'c']])).toBe('"a""b","c"');
  });
});

describe('buildSupplierOrderCsv', () => {
  it('includes crew and purchase order sections', () => {
    const products = [{ id: 'a', sku: 'A', name: 'Polo', brand: 'GM', price: 10, minOrder: 1, category: 'tops', colours: ['White'], fit: ['woman'] }];
    const looks = [{ id: 'L1', name: 'Look', bodyType: 'woman', productIds: ['a'] }];
    const crew = [{ id: 'c1', name: 'C', role: 'interior', bodyType: 'woman', topSize: 'M', bottomSize: '38', shoeSize: '39', assignedLook: 'L1' }];
    const settings = { logoCost: 0, sparePercent: 0, setsPerCrew: 1, currency: 'EUR' };
    const csv = buildSupplierOrderCsv({ crew, looks, products, settings, vessel: 'M/Y Test' });
    expect(csv).toContain('Supplier Purchase Order');
    expect(csv).toContain('Polo');
    expect(csv).toContain('M/Y Test');
  });
});
