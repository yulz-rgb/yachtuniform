// Pure, framework-free procurement calculations.
// Every function here is deterministic and unit-tested in calc.test.js.

import { crewLookIds, memberSets } from './crew.js';

const CURRENCY_SYMBOLS = { EUR: '\u20ac', USD: '$', GBP: '\u00a3' };

const TOP_CATEGORIES = new Set(['tops', 'shirts', 'dresses', 'outerwear', 'accessories']);
const BOTTOM_CATEGORIES = new Set(['bottoms']);
const SHOE_CATEGORIES = new Set(['shoes']);

export function currencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || '\u20ac';
}

export function money(value, currency = 'EUR') {
  const n = Number(value || 0);
  return `${currencySymbol(currency)}${n.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function indexById(items = []) {
  const map = {};
  for (const item of items) map[item.id] = item;
  return map;
}

export function lookProductIds(look) {
  if (!look) return [];
  if (Array.isArray(look.productIds)) return look.productIds;
  if (Array.isArray(look.items)) return look.items.map((i) => i.productId);
  return [];
}

export function lookProducts(look, productsById) {
  return lookProductIds(look)
    .map((id) => productsById[id])
    .filter(Boolean);
}

export function lookSubtotal(look, productsById) {
  return lookProducts(look, productsById).reduce((sum, p) => sum + num(p.price), 0);
}

export function buildLookTotals(looks = [], products = []) {
  const byId = indexById(products);
  return looks.map((look) => {
    const items = lookProducts(look, byId);
    return {
      ...look,
      products: items,
      itemCount: items.length,
      subtotal: items.reduce((sum, p) => sum + num(p.price), 0),
    };
  });
}

function normalizeSettings(settings = {}) {
  return {
    logoCost: num(settings.logoCost, 0),
    sparePercent: num(settings.sparePercent, 0),
    setsPerCrew: Math.max(1, num(settings.setsPerCrew, 1)),
    shippingFlat: num(settings.shippingFlat, 0),
    embroiderySetup: num(settings.embroiderySetup, 0),
    currency: settings.currency || 'EUR',
    budgetCap: num(settings.budgetCap, 0),
    neededByDate: settings.neededByDate || '',
    sizeSystem: settings.sizeSystem || 'EU',
  };
}

function memberLooks(member, lookById, fallback) {
  const ids = crewLookIds(member);
  const resolved = ids.map((id) => lookById[id]).filter(Boolean);
  return resolved.length ? resolved : (fallback ? [fallback] : []);
}

export function sizeForProduct(product, member) {
  if (!product) return '—';
  if (SHOE_CATEGORIES.has(product.category)) return member.shoeSize || '—';
  if (BOTTOM_CATEGORIES.has(product.category)) return member.bottomSize || '—';
  if (TOP_CATEGORIES.has(product.category)) return member.topSize || '—';
  return member.topSize || '—';
}

function roleMatchesProduct(memberRole, product) {
  const tags = product.roleTags || [];
  if (!tags.length) return true;
  const role = memberRole || 'interior';
  const aliases = {
    'chief-stew': ['chief-stew', 'interior', 'boss'],
    interior: ['interior', 'chief-stew'],
    captain: ['captain', 'boss', 'deck'],
    deck: ['deck', 'engineer'],
    engineer: ['engineer', 'deck'],
  };
  const allowed = new Set([role, ...(aliases[role] || [])]);
  return tags.some((t) => allowed.has(t));
}

function parseLeadDays(leadTime) {
  const m = String(leadTime || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function computeCrewRows(crew = [], lookTotals = [], settings = {}) {
  const s = normalizeSettings(settings);
  const lookById = indexById(lookTotals);
  const fallback = lookTotals[0];

  return crew.map((member) => {
    const assigned = memberLooks(member, lookById, fallback);
    const products = assigned.flatMap((l) => l.products || []);
    const itemCount = products.length;
    const garmentPerSet = assigned.reduce((sum, l) => sum + num(l.subtotal), 0);
    const logoPerSet = itemCount * s.logoCost;
    const vatPerSet = products.reduce(
      (sum, p) => sum + num(p.price) * (num(p.vatRate) / 100),
      0,
    );
    const sets = memberSets(member, s);
    const perSet = garmentPerSet + logoPerSet;
    const total = perSet * sets;
    const lookNames = assigned.map((l) => l.name).join(' + ');

    return {
      ...member,
      lookId: assigned[0]?.id,
      lookName: lookNames || 'Unassigned',
      lookNames: assigned.map((l) => l.name),
      itemCount,
      garmentPerSet,
      logoPerSet,
      vatPerSet,
      perSet,
      sets,
      total,
      vatTotal: vatPerSet * sets,
    };
  });
}

export function computeBudget(crew = [], lookTotals = [], settings = {}) {
  const s = normalizeSettings(settings);
  const rows = computeCrewRows(crew, lookTotals, settings);
  const itemsTotal = rows.reduce((sum, r) => sum + r.garmentPerSet * r.sets, 0);
  const logoTotal = rows.reduce((sum, r) => sum + r.logoPerSet * r.sets, 0);
  const baseTotal = itemsTotal + logoTotal;
  const spareTotal = baseTotal * (s.sparePercent / 100);
  const vatTotal = rows.reduce((sum, r) => sum + r.vatTotal, 0);
  const shippingTotal = s.shippingFlat;
  const setupTotal = s.embroiderySetup;
  const grandTotal = baseTotal + spareTotal + vatTotal + shippingTotal + setupTotal;
  const budgetCap = s.budgetCap;
  const overBudget = budgetCap > 0 && grandTotal > budgetCap;

  return {
    crewCount: crew.length,
    itemsTotal,
    logoTotal,
    baseTotal,
    spareTotal,
    vatTotal,
    shippingTotal,
    setupTotal,
    grandTotal,
    budgetCap,
    overBudget,
    budgetDelta: budgetCap > 0 ? grandTotal - budgetCap : 0,
    currency: s.currency,
    rows,
  };
}

export function buildOrderSummary(crew = [], looks = [], products = [], settings = {}) {
  const s = normalizeSettings(settings);
  const productsById = indexById(products);
  const lookTotals = buildLookTotals(looks, products);
  const lookById = indexById(lookTotals);
  const counts = new Map();

  for (const member of crew) {
    const sets = memberSets(member, s);
    for (const look of memberLooks(member, lookById, lookTotals[0])) {
      for (const product of look.products) {
        counts.set(product.id, (counts.get(product.id) || 0) + sets);
      }
    }
  }

  const lines = [];
  for (const [productId, baseQty] of counts.entries()) {
    const product = productsById[productId];
    if (!product) continue;
    const withSpare = Math.ceil(baseQty * (1 + s.sparePercent / 100));
    const meetsMoq = withSpare >= num(product.minOrder, 1);
    lines.push({
      productId,
      sku: product.sku || '',
      name: product.name,
      brand: product.brand || '',
      supplier: product.supplierName || product.brand || '',
      category: product.category,
      colours: product.colours || [],
      sizeRange: product.sizeRange || '',
      unitPrice: num(product.price),
      currency: product.currency || s.currency,
      baseQty,
      orderQty: withSpare,
      minOrder: num(product.minOrder, 1),
      meetsMoq,
      lineTotal: withSpare * num(product.price),
      leadTime: product.leadTime || '',
    });
  }
  lines.sort((a, b) => a.supplier.localeCompare(b.supplier) || a.name.localeCompare(b.name));
  return lines;
}

// Size- and colour-aware supplier lines for procurement-ready ordering.
export function buildSizeAwareOrderSummary(crew = [], looks = [], products = [], settings = {}) {
  const s = normalizeSettings(settings);
  const productsById = indexById(products);
  const lookTotals = buildLookTotals(looks, products);
  const lookById = indexById(lookTotals);
  const lineMap = new Map();

  for (const member of crew) {
    const sets = memberSets(member, s);
    for (const look of memberLooks(member, lookById, lookTotals[0])) {
      for (const product of look.products) {
        const size = sizeForProduct(product, member);
        const colour = (product.colours || [])[0] || '';
        const key = `${product.id}|${size}|${colour}`;
        const existing = lineMap.get(key) || {
          productId: product.id,
          sku: product.sku || '',
          name: product.name,
          brand: product.brand || '',
          supplier: product.supplierName || product.brand || '',
          category: product.category,
          colour,
          size,
          unitPrice: num(product.price),
          currency: product.currency || s.currency,
          minOrder: num(product.minOrder, 1),
          leadTime: product.leadTime || '',
          baseQty: 0,
          crewSources: [],
        };
        existing.baseQty += sets;
        existing.crewSources.push(member.name || 'Crew');
        lineMap.set(key, existing);
      }
    }
  }

  const lines = [];
  for (const line of lineMap.values()) {
    const withSpare = Math.ceil(line.baseQty * (1 + s.sparePercent / 100));
    lines.push({
      ...line,
      orderQty: withSpare,
      meetsMoq: withSpare >= line.minOrder,
      lineTotal: withSpare * line.unitPrice,
      crewSources: [...new Set(line.crewSources)],
    });
  }
  lines.sort((a, b) => a.supplier.localeCompare(b.supplier) || a.name.localeCompare(b.name) || a.size.localeCompare(b.size));
  return lines;
}

export function buildPackingLists(crew = [], looks = [], products = [], settings = {}) {
  const lookTotals = buildLookTotals(looks, products);
  const lookById = indexById(lookTotals);
  const s = normalizeSettings(settings);

  return crew.map((member) => {
    const assigned = memberLooks(member, lookById, lookTotals[0]);
    const items = [];
    for (const look of assigned) {
      for (const product of look.products) {
        items.push({
          lookName: look.name,
          productName: product.name,
          sku: product.sku || '',
          category: product.category,
          size: sizeForProduct(product, member),
          colour: (product.colours || [])[0] || '',
          sets: memberSets(member, s),
          fitNotes: member.fitNotes || '',
          alterations: member.alterations || '',
          sizeConfirmed: Boolean(member.sizeConfirmed),
        });
      }
    }
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      looks: assigned.map((l) => l.name),
      items,
      sizeConfirmed: Boolean(member.sizeConfirmed),
    };
  });
}

export function buildDashboardTasks(crew = [], looks = [], products = [], settings = {}, extras = {}) {
  const warnings = validateOrder(crew, looks, products, settings);
  const budget = computeBudget(crew, buildLookTotals(looks, products), settings);
  const tasks = [];

  const missingSizes = crew.filter((c) => !c.topSize || !c.bottomSize || !c.shoeSize);
  if (missingSizes.length) {
    tasks.push({
      id: 'missing-sizes',
      priority: 'critical',
      title: `${missingSizes.length} crew missing sizes`,
      detail: missingSizes.map((c) => c.name).slice(0, 5).join(', '),
      action: 'crew',
    });
  }

  const unconfirmed = crew.filter((c) => !c.sizeConfirmed);
  if (unconfirmed.length) {
    tasks.push({
      id: 'unconfirmed-sizes',
      priority: 'high',
      title: `${unconfirmed.length} sizes not confirmed`,
      detail: 'Request stewardess sign-off before ordering.',
      action: 'crew',
    });
  }

  const moqErrors = warnings.filter((w) => w.code === 'BELOW_MOQ');
  if (moqErrors.length) {
    tasks.push({
      id: 'moq',
      priority: 'critical',
      title: `${moqErrors.length} items below supplier MOQ`,
      detail: moqErrors[0].message,
      action: 'procurement',
    });
  }

  if (budget.overBudget) {
    tasks.push({
      id: 'budget',
      priority: 'high',
      title: 'Project over budget cap',
      detail: `Grand total ${money(budget.grandTotal, budget.currency)} exceeds cap ${money(budget.budgetCap, budget.currency)}.`,
      action: 'budget',
    });
  }

  const leadRisks = warnings.filter((w) => w.code === 'LATE_LEAD_TIME');
  if (leadRisks.length) {
    tasks.push({
      id: 'lead-time',
      priority: 'high',
      title: `${leadRisks.length} lead-time risks`,
      detail: leadRisks[0].message,
      action: 'procurement',
    });
  }

  if (extras.orderStatus && extras.orderStatus !== 'APPROVED') {
    tasks.push({
      id: 'approval',
      priority: 'medium',
      title: `Order in ${extras.orderStatus.replace(/_/g, ' ').toLowerCase()}`,
      detail: 'Advance approval or add review notes.',
      action: 'approval',
    });
  }

  const roleWarnings = warnings.filter((w) => w.code === 'ROLE_MISMATCH');
  if (roleWarnings.length) {
    tasks.push({
      id: 'role-fit',
      priority: 'medium',
      title: `${roleWarnings.length} role/look mismatches`,
      detail: roleWarnings[0].message,
      action: 'looks',
    });
  }

  return tasks;
}

export function compareLooks(lookIds = [], looks = [], products = []) {
  const totals = buildLookTotals(looks, products);
  const byId = indexById(totals);
  return lookIds.map((id) => byId[id]).filter(Boolean).map((look) => ({
    id: look.id,
    name: look.name,
    description: look.description,
    bodyType: look.bodyType,
    itemCount: look.itemCount,
    subtotal: look.subtotal,
    products: look.products.map((p) => ({ id: p.id, name: p.name, price: num(p.price), category: p.category })),
  }));
}

// Group order lines into one purchase order per supplier, so each supplier
// receives only their items with a clear total and a PO reference.
export function groupOrderBySupplier(lines = []) {
  const groups = new Map();
  for (const line of lines) {
    const key = line.supplier || 'Unassigned supplier';
    const group = groups.get(key) || {
      supplier: key,
      currency: line.currency || 'EUR',
      lines: [],
      itemCount: 0,
      total: 0,
      hasMoqIssue: false,
    };
    group.lines.push(line);
    group.itemCount += num(line.orderQty);
    group.total += num(line.lineTotal);
    if (line.meetsMoq === false) group.hasMoqIssue = true;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.supplier.localeCompare(b.supplier));
}

export function validateOrder(crew = [], looks = [], products = [], settings = {}) {
  const warnings = [];
  const productsById = indexById(products);
  const lookTotals = buildLookTotals(looks, products);
  const lookById = indexById(lookTotals);
  const s = normalizeSettings(settings);
  const daysLeft = daysUntil(s.neededByDate);

  const skuCounts = new Map();
  for (const p of products) {
    if (!p.sku) continue;
    skuCounts.set(p.sku, (skuCounts.get(p.sku) || 0) + 1);
  }
  for (const [sku, count] of skuCounts.entries()) {
    if (count > 1) {
      warnings.push({
        level: 'warning',
        code: 'DUPLICATE_SKU',
        message: `SKU "${sku}" appears on ${count} products.`,
      });
    }
  }

  for (const member of crew) {
    if (!member.topSize || !member.bottomSize || !member.shoeSize) {
      warnings.push({
        level: 'warning',
        code: 'MISSING_SIZE',
        message: `${member.name || 'Crew member'} is missing one or more sizes.`,
      });
    }
    if (!member.sizeConfirmed) {
      warnings.push({
        level: 'info',
        code: 'SIZE_UNCONFIRMED',
        message: `${member.name || 'Crew member'} has not confirmed sizing.`,
      });
    }

    const assigned = memberLooks(member, lookById, null);
    if (!assigned.length) {
      warnings.push({
        level: 'warning',
        code: 'NO_LOOK',
        message: `${member.name || 'Crew member'} has no assigned look.`,
      });
      continue;
    }

    for (const look of assigned) {
      for (const product of look.products) {
        const fit = product.fit || [];
        const body = member.bodyType;
        if (fit.length && body && !fit.includes(body)) {
          warnings.push({
            level: 'warning',
            code: 'FIT_MISMATCH',
            message: `${product.name} in "${look.name}" is not available for ${body}.`,
          });
        }
        if (!roleMatchesProduct(member.role, product)) {
          warnings.push({
            level: 'warning',
            code: 'ROLE_MISMATCH',
            message: `${product.name} may not suit ${member.role} role for ${member.name}.`,
          });
        }
        if (product.active === false) {
          warnings.push({
            level: 'error',
            code: 'INACTIVE_PRODUCT',
            message: `Inactive product "${product.name}" is in "${look.name}".`,
          });
        }
        if (num(product.price) === 0) {
          warnings.push({
            level: 'warning',
            code: 'STALE_PRICE',
            message: `${product.name} has zero price — update before ordering.`,
          });
        }
        if (!(product.supplierName || product.brand)) {
          warnings.push({
            level: 'warning',
            code: 'MISSING_SUPPLIER',
            message: `${product.name} has no supplier or brand.`,
          });
        }
        if (daysLeft !== null && daysLeft >= 0) {
          const leadDays = parseLeadDays(product.leadTime);
          if (leadDays !== null && leadDays > daysLeft) {
            warnings.push({
              level: 'warning',
              code: 'LATE_LEAD_TIME',
              message: `${product.name} lead time (${product.leadTime}) may miss needed-by ${s.neededByDate}.`,
            });
          }
        }
      }
    }
  }

  for (const line of buildOrderSummary(crew, looks, products, settings)) {
    if (!line.meetsMoq) {
      warnings.push({
        level: 'error',
        code: 'BELOW_MOQ',
        message: `${line.name} order qty ${line.orderQty} is below supplier minimum ${line.minOrder}.`,
      });
    }
    if (!line.sku) {
      warnings.push({
        level: 'warning',
        code: 'MISSING_SKU',
        message: `${line.name} has no SKU and cannot be ordered reliably.`,
      });
    }
  }

  const budget = computeBudget(crew, lookTotals, settings);
  if (budget.overBudget) {
    warnings.push({
      level: 'error',
      code: 'BUDGET_EXCEEDED',
      message: `Grand total ${money(budget.grandTotal, budget.currency)} exceeds budget cap ${money(budget.budgetCap, budget.currency)}.`,
    });
  }

  return warnings;
}
