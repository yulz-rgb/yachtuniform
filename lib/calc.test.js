import { describe, it, expect } from 'vitest';
import {
  money,
  buildLookTotals,
  computeBudget,
  buildOrderSummary,
  validateOrder,
} from './calc';

const products = [
  { id: 'a', sku: 'A', name: 'Polo', price: 10, vatRate: 10, minOrder: 6, category: 'tops', fit: ['woman', 'man'], colours: ['White'] },
  { id: 'b', sku: 'B', name: 'Shorts', price: 20, vatRate: 0, minOrder: 2, category: 'bottoms', fit: ['woman'] },
];
const looks = [{ id: 'L1', name: 'Look 1', bodyType: 'woman', productIds: ['a', 'b'] }];
const crew = [
  { id: 'c1', name: 'Crew 1', role: 'interior', bodyType: 'woman', topSize: 'M', bottomSize: '38', shoeSize: '39', assignedLook: 'L1' },
];
const settings = { logoCost: 5, sparePercent: 10, setsPerCrew: 2, shippingFlat: 50, embroiderySetup: 100, currency: 'EUR' };

describe('money', () => {
  it('formats with currency symbol and 2 decimals', () => {
    expect(money(1234.5, 'EUR')).toBe('\u20ac1,234.50');
    expect(money(0)).toBe('\u20ac0.00');
    expect(money(99, 'USD')).toBe('$99.00');
  });
});

describe('buildLookTotals', () => {
  it('computes subtotal and item count', () => {
    const [look] = buildLookTotals(looks, products);
    expect(look.subtotal).toBe(30);
    expect(look.itemCount).toBe(2);
  });
});

describe('computeBudget', () => {
  const b = computeBudget(crew, buildLookTotals(looks, products), settings);
  it('computes line components', () => {
    expect(b.itemsTotal).toBe(60);
    expect(b.logoTotal).toBe(20);
    expect(b.baseTotal).toBe(80);
    expect(b.spareTotal).toBeCloseTo(8, 5);
    expect(b.vatTotal).toBeCloseTo(2, 5);
    expect(b.shippingTotal).toBe(50);
    expect(b.setupTotal).toBe(100);
  });
  it('computes grand total including VAT, shipping and setup', () => {
    expect(b.grandTotal).toBeCloseTo(240, 5);
  });
  it('returns a per-crew row with totals', () => {
    expect(b.rows).toHaveLength(1);
    expect(b.rows[0].total).toBe(80);
  });
});

describe('buildOrderSummary', () => {
  const lines = buildOrderSummary(crew, looks, products, settings);
  it('aggregates quantity across sets with spare and flags MOQ', () => {
    const a = lines.find((l) => l.productId === 'a');
    const bLine = lines.find((l) => l.productId === 'b');
    expect(a.orderQty).toBe(3); // ceil(2 * 1.1)
    expect(a.meetsMoq).toBe(false); // below min order 6
    expect(bLine.meetsMoq).toBe(true);
    expect(bLine.lineTotal).toBe(60);
  });
});

describe('validateOrder', () => {
  it('flags products below MOQ as errors', () => {
    const warnings = validateOrder(crew, looks, products, settings);
    expect(warnings.some((w) => w.code === 'BELOW_MOQ' && w.level === 'error')).toBe(true);
  });
  it('flags missing sizes', () => {
    const incompleteCrew = [{ ...crew[0], topSize: '' }];
    const warnings = validateOrder(incompleteCrew, looks, products, settings);
    expect(warnings.some((w) => w.code === 'MISSING_SIZE')).toBe(true);
  });
  it('flags fit mismatch when body type unsupported', () => {
    const manCrew = [{ ...crew[0], bodyType: 'man' }];
    const warnings = validateOrder(manCrew, looks, products, settings);
    expect(warnings.some((w) => w.code === 'FIT_MISMATCH')).toBe(true);
  });
});
