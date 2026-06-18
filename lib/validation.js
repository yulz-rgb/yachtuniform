// Zod validation schemas shared by server actions, API routes, and imports.
import { z } from 'zod';
import { isUniformCatalogRecord } from './catalogExtract.js';
import { splitList } from './csv';
import { parseColourImages } from './productColour.js';

const bodyType = z.enum(['woman', 'man']);

export const productInput = z.object({
  category: z.string().min(1, 'Category is required'),
  name: z.string().min(1, 'Name is required'),
  brand: z.string().optional().default(''),
  price: z.coerce.number().min(0).default(0),
  currency: z.string().default('EUR'),
  vatRate: z.coerce.number().min(0).max(100).default(0),
  colours: z.array(z.string()).default([]),
  swatch: z.string().default('#ffffff'),
  accent: z.string().default('#0b1f3a'),
  fabric: z.string().optional().default(''),
  details: z.string().optional().default(''),
  fit: z.array(bodyType).default(['woman', 'man']),
  roleTags: z.array(z.string()).default([]),
  leadTime: z.string().optional().default(''),
  minOrder: z.coerce.number().int().min(1).default(1),
  sizeRange: z.string().optional().default(''),
  imageHint: z.string().default('polo'),
  imageUrl: z.string().url().optional().or(z.literal('')).default(''),
  colourImages: z.record(z.string(), z.string()).default({}),
  supplierName: z.string().optional().default(''),
  productUrl: z.string().url().optional().or(z.literal('')).default(''),
  active: z.coerce.boolean().default(true),
});

export const lookInput = z.object({
  name: z.string().min(1, 'Look name is required'),
  description: z.string().optional().default(''),
  bodyType: bodyType.default('woman'),
  productIds: z.array(z.string()).default([]),
});

export const crewInput = z.object({
  name: z.string().min(1, 'Crew name is required'),
  role: z.string().min(1).default('interior'),
  bodyType: bodyType.default('woman'),
  topSize: z.string().optional().default(''),
  bottomSize: z.string().optional().default(''),
  shoeSize: z.string().optional().default(''),
  assignedLookId: z.string().optional().nullable(),
});

export const settingsInput = z.object({
  vessel: z.string().optional().default(''),
  priceNote: z.string().optional().default(''),
  currency: z.string().default('EUR'),
  logoCost: z.coerce.number().min(0).default(15),
  sparePercent: z.coerce.number().min(0).max(100).default(10),
  setsPerCrew: z.coerce.number().int().min(1).default(2),
  shippingFlat: z.coerce.number().min(0).default(0),
  embroiderySetup: z.coerce.number().min(0).default(0),
});

const TRUTHY = new Set(['1', 'true', 'yes', 'y', 'active']);

// Validate one raw catalog CSV record into a normalized product, or return errors.
export function validateCatalogRecord(raw, rowNumber) {
  if (!isUniformCatalogRecord(raw)) {
    return {
      ok: false,
      row: rowNumber,
      errors: ['name: Non-uniform item excluded (bags, towels, kids, leisure accessories, logo services)'],
      excluded: true,
    };
  }

  const candidate = {
    category: raw.category,
    name: raw.name,
    brand: raw.brand,
    price: raw.price,
    currency: raw.currency || 'EUR',
    vatRate: raw.vatRate || 0,
    colours: splitList(raw.colours),
    swatch: raw.swatch || '#ffffff',
    accent: raw.accent || '#0b1f3a',
    fabric: raw.fabric,
    details: raw.details,
    fit: splitList(raw.fit).filter((f) => f === 'woman' || f === 'man'),
    roleTags: splitList(raw.roleTags),
    leadTime: raw.leadTime,
    minOrder: raw.minOrder || 1,
    sizeRange: raw.sizeRange,
    imageHint: raw.imageHint || 'polo',
    imageUrl: raw.imageUrl || '',
    colourImages: parseColourImages(raw.colourImages),
    supplierName: raw.supplierName || '',
    productUrl: raw.productUrl || '',
    active: raw.active === '' ? true : TRUTHY.has(String(raw.active).toLowerCase()),
  };
  if (!candidate.fit.length) candidate.fit = ['woman', 'man'];

  const result = productInput.safeParse(candidate);
  if (!result.success) {
    return {
      ok: false,
      row: rowNumber,
      errors: result.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`),
    };
  }
  return { ok: true, row: rowNumber, value: result.data };
}
