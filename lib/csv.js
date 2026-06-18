// CSV helpers for supplier ordering and catalog import.
// Pure string<->row helpers so they can be unit tested without a browser.
import {
  buildOrderSummary, computeCrewRows, buildLookTotals, buildSizeAwareOrderSummary,
  buildPackingLists, groupOrderBySupplier, money,
} from './calc';

export function escapeCell(cell) {
  return `"${String(cell ?? '').replaceAll('"', '""')}"`;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\n');
}

// Minimal but robust CSV parser supporting quoted fields, escaped quotes,
// and commas/newlines inside quotes. Returns array of string arrays.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// Columns expected for catalog import. Documented in docs/catalog-template.csv.
export const CATALOG_COLUMNS = [
  'category',
  'name',
  'brand',
  'sku',
  'price',
  'currency',
  'vatRate',
  'colours',
  'swatch',
  'accent',
  'fabric',
  'details',
  'fit',
  'roleTags',
  'leadTime',
  'minOrder',
  'sizeRange',
  'imageHint',
  'imageUrl',
  'active',
];

// Parse a catalog CSV into raw row objects keyed by header. List fields
// (colours/fit/roleTags) are split on "|" or ",".
export function parseCatalogCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? '').trim();
    });
    return obj;
  });
  return { headers, records };
}

export function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/[|,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

// Build the supplier-facing order CSV from operational data.
export function buildSupplierOrderCsv({ crew, looks, products, settings, vessel }) {
  const lookTotals = buildLookTotals(looks, products);
  const rows = computeCrewRows(crew, lookTotals, settings);
  const out = [['Vessel', vessel || '']];
  out.push([]);
  out.push([
    'Crew Name',
    'Role',
    'Body',
    'Top Size',
    'Bottom Size',
    'Shoe Size',
    'Assigned Look',
    'Sets',
    'Per Set',
    'Line Total',
  ]);
  for (const r of rows) {
    out.push([
      r.name,
      r.role,
      r.bodyType,
      r.topSize,
      r.bottomSize,
      r.shoeSize,
      r.lookName,
      settings.setsPerCrew,
      r.perSet.toFixed(2),
      r.total.toFixed(2),
    ]);
  }
  out.push([]);
  out.push(['Supplier Purchase Order']);
  out.push([
    'Supplier',
    'SKU',
    'Product',
    'Brand',
    'Category',
    'Colours',
    'Size Range',
    'Unit Price',
    'Order Qty',
    'Min Order',
    'Line Total',
  ]);
  for (const line of buildOrderSummary(crew, looks, products, settings)) {
    out.push([
      line.supplier,
      line.sku,
      line.name,
      line.brand,
      line.category,
      line.colours.join('/'),
      line.sizeRange,
      line.unitPrice.toFixed(2),
      line.orderQty,
      line.minOrder,
      line.lineTotal.toFixed(2),
    ]);
  }
  out.push([]);
  out.push(['Size-aware purchase order']);
  out.push([
    'Supplier',
    'SKU',
    'Product',
    'Category',
    'Colour',
    'Size',
    'Unit Price',
    'Order Qty',
    'Min Order',
    'Crew Sources',
    'Line Total',
  ]);
  for (const line of buildSizeAwareOrderSummary(crew, looks, products, settings)) {
    out.push([
      line.supplier,
      line.sku,
      line.name,
      line.category,
      line.colour,
      line.size,
      line.unitPrice.toFixed(2),
      line.orderQty,
      line.minOrder,
      line.crewSources.join('; '),
      line.lineTotal.toFixed(2),
    ]);
  }
  return toCsv(out);
}

export function buildPackingListCsv({ crew, looks, products, settings, vessel }) {
  const lists = buildPackingLists(crew, looks, products, settings);
  const out = [['Vessel', vessel || ''], []];
  for (const list of lists) {
    out.push([`Packing list — ${list.name}`, list.role, list.looks.join(' + ')]);
    out.push(['Look', 'Product', 'SKU', 'Category', 'Size', 'Colour', 'Sets', 'Confirmed', 'Fit notes', 'Alterations']);
    for (const item of list.items) {
      out.push([
        item.lookName,
        item.productName,
        item.sku,
        item.category,
        item.size,
        item.colour,
        item.sets,
        item.sizeConfirmed ? 'Yes' : 'No',
        item.fitNotes,
        item.alterations,
      ]);
    }
    out.push([]);
  }
  return toCsv(out);
}

// One self-contained purchase order per supplier, each with a PO reference, the
// supplier's own line items, a total, and an acknowledgement block to sign back.
export function buildSupplierBreakdownCsv({ crew, looks, products, settings, vessel }) {
  const lines = buildSizeAwareOrderSummary(crew, looks, products, settings);
  const groups = groupOrderBySupplier(lines);
  const dateRef = new Date().toISOString().slice(0, 10);
  const slug = (vessel || 'yacht').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const out = [['Vessel', vessel || ''], ['Generated', dateRef], []];

  groups.forEach((group, i) => {
    const poRef = `PO-${slug || 'YACHT'}-${dateRef.replace(/-/g, '')}-${String(i + 1).padStart(2, '0')}`;
    out.push([`Purchase Order: ${group.supplier}`]);
    out.push(['PO Reference', poRef]);
    out.push(['SKU', 'Product', 'Category', 'Colour', 'Size', 'Unit Price', 'Order Qty', 'Min Order', 'Meets MOQ', 'Line Total']);
    for (const line of group.lines) {
      out.push([
        line.sku,
        line.name,
        line.category,
        line.colour,
        line.size,
        line.unitPrice.toFixed(2),
        line.orderQty,
        line.minOrder,
        line.meetsMoq ? 'Yes' : 'NO',
        line.lineTotal.toFixed(2),
      ]);
    }
    out.push(['', '', '', '', '', '', '', '', 'Supplier total', group.total.toFixed(2)]);
    out.push([]);
    out.push(['Supplier acknowledgement']);
    out.push(['Confirmed by (name)', '']);
    out.push(['Confirmed ship date', '']);
    out.push(['Notes / substitutions', '']);
    out.push([]);
    out.push([]);
  });

  if (groups.length === 0) {
    out.push(['No order lines — assign looks and crew sizes first.']);
  }
  return toCsv(out);
}

export { money };
