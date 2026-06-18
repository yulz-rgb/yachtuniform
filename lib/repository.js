// Tenant-scoped data access. Every function REQUIRES a yachtId and only ever
// touches rows for that yacht. Decimal columns are serialized to plain numbers
// so the data is safe to pass to client components.
import { getDb } from './db';

function n(value) {
  if (value === null || value === undefined) return 0;
  return typeof value === 'object' && typeof value.toNumber === 'function'
    ? value.toNumber()
    : Number(value);
}

function serializeProduct(p) {
  return {
    id: p.id,
    category: p.category,
    name: p.name,
    brand: p.brand || '',
    price: n(p.price),
    currency: p.currency,
    vatRate: n(p.vatRate),
    colours: p.colours || [],
    swatch: p.swatch,
    accent: p.accent,
    fabric: p.fabric || '',
    details: p.details || '',
    fit: p.fit || [],
    roleTags: p.roleTags || [],
    leadTime: p.leadTime || '',
    minOrder: p.minOrder,
    sizeRange: p.sizeRange || '',
    imageHint: p.imageHint,
    imageUrl: p.imageUrl || '',
    active: p.active,
    supplierName: p.supplier?.name || p.brand || '',
  };
}

function serializeLook(l) {
  return {
    id: l.id,
    name: l.name,
    description: l.description || '',
    bodyType: l.bodyType,
    productIds: (l.items || []).map((i) => i.productId),
  };
}

function serializeCrew(c) {
  return {
    id: c.id,
    name: c.name,
    role: c.role,
    bodyType: c.bodyType,
    topSize: c.topSize || '',
    bottomSize: c.bottomSize || '',
    shoeSize: c.shoeSize || '',
    assignedLook: c.assignedLookId || '',
  };
}

function serializeSettings(s) {
  if (!s) return null;
  return {
    vessel: s.vessel || '',
    priceNote: s.priceNote || '',
    currency: s.currency,
    logoCost: n(s.logoCost),
    sparePercent: n(s.sparePercent),
    setsPerCrew: s.setsPerCrew,
    shippingFlat: n(s.shippingFlat),
    embroiderySetup: n(s.embroiderySetup),
  };
}

export async function getWorkspace(yachtId) {
  const db = getDb();
  const [products, looks, crew, settings] = await Promise.all([
    db.product.findMany({
      where: { yachtId },
      orderBy: [{ sortIndex: 'asc' }, { createdAt: 'asc' }],
      include: { supplier: true },
    }),
    db.look.findMany({
      where: { yachtId },
      orderBy: [{ sortIndex: 'asc' }, { createdAt: 'asc' }],
      include: { items: true },
    }),
    db.crewMember.findMany({
      where: { yachtId },
      orderBy: [{ sortIndex: 'asc' }, { createdAt: 'asc' }],
    }),
    db.projectSettings.findUnique({ where: { yachtId } }),
  ]);
  return {
    products: products.map(serializeProduct),
    looks: looks.map(serializeLook),
    crew: crew.map(serializeCrew),
    settings: serializeSettings(settings),
  };
}

export async function upsertProduct(yachtId, input, id) {
  const db = getDb();
  const data = {
    category: input.category,
    name: input.name,
    brand: input.brand,
    price: input.price,
    currency: input.currency,
    vatRate: input.vatRate,
    colours: input.colours,
    swatch: input.swatch,
    accent: input.accent,
    fabric: input.fabric,
    details: input.details,
    fit: input.fit,
    roleTags: input.roleTags,
    leadTime: input.leadTime,
    minOrder: input.minOrder,
    sizeRange: input.sizeRange,
    imageHint: input.imageHint,
    imageUrl: input.imageUrl || null,
    active: input.active,
  };
  const product = id
    ? await db.product.update({ where: { id, yachtId }, data, include: { supplier: true } })
    : await db.product.create({ data: { ...data, yachtId }, include: { supplier: true } });
  return serializeProduct(product);
}

export async function deleteProduct(yachtId, id) {
  const db = getDb();
  await db.product.delete({ where: { id, yachtId } });
}

export async function createLook(yachtId, input) {
  const db = getDb();
  const look = await db.look.create({
    data: {
      yachtId,
      name: input.name,
      description: input.description,
      bodyType: input.bodyType,
      items: { create: (input.productIds || []).map((productId) => ({ productId })) },
    },
    include: { items: true },
  });
  return serializeLook(look);
}

export async function updateLook(yachtId, id, input) {
  const db = getDb();
  await db.look.update({
    where: { id, yachtId },
    data: {
      name: input.name,
      description: input.description,
      bodyType: input.bodyType,
    },
  });
  if (Array.isArray(input.productIds)) {
    await db.lookItem.deleteMany({ where: { lookId: id } });
    if (input.productIds.length) {
      await db.lookItem.createMany({
        data: input.productIds.map((productId) => ({ lookId: id, productId })),
        skipDuplicates: true,
      });
    }
  }
  const look = await db.look.findFirst({ where: { id, yachtId }, include: { items: true } });
  return serializeLook(look);
}

export async function deleteLook(yachtId, id) {
  const db = getDb();
  await db.look.delete({ where: { id, yachtId } });
}

export async function upsertCrew(yachtId, input, id) {
  const db = getDb();
  const data = {
    name: input.name,
    role: input.role,
    bodyType: input.bodyType,
    topSize: input.topSize,
    bottomSize: input.bottomSize,
    shoeSize: input.shoeSize,
    assignedLookId: input.assignedLookId || null,
  };
  const crew = id
    ? await db.crewMember.update({ where: { id, yachtId }, data })
    : await db.crewMember.create({ data: { ...data, yachtId } });
  return serializeCrew(crew);
}

export async function deleteCrew(yachtId, id) {
  const db = getDb();
  await db.crewMember.delete({ where: { id, yachtId } });
}

export async function updateSettings(yachtId, input) {
  const db = getDb();
  const settings = await db.projectSettings.upsert({
    where: { yachtId },
    update: input,
    create: { ...input, yachtId },
  });
  return serializeSettings(settings);
}

// Apply a validated catalog import. Products are matched by name within the yacht.
export async function applyCatalogImport(yachtId, validatedRows, filename, userId) {
  const db = getDb();
  let created = 0;
  let updated = 0;
  const errors = [];

  for (const row of validatedRows) {
    const input = row.value;
    try {
      const existing = input.name
        ? await db.product.findFirst({ where: { yachtId, name: input.name } })
        : null;
      if (existing) {
        await upsertProduct(yachtId, input, existing.id);
        updated += 1;
      } else {
        await upsertProduct(yachtId, input);
        created += 1;
      }
    } catch (err) {
      errors.push({ row: row.row, message: String(err?.message || err) });
    }
  }

  const batch = await db.importBatch.create({
    data: {
      yachtId,
      filename,
      status: errors.length ? 'FAILED' : 'COMPLETED',
      createdCount: created,
      updatedCount: updated,
      skippedCount: errors.length,
      errors: errors.length ? errors : undefined,
      createdById: userId || null,
    },
  });
  await logAudit(yachtId, userId, 'IMPORT', 'ImportBatch', batch.id, {
    filename,
    created,
    updated,
    failed: errors.length,
  });
  return { created, updated, failed: errors.length, errors, batchId: batch.id };
}

export async function createOrderSnapshot(yachtId, { name, totals, snapshot, userId }) {
  const db = getDb();
  const order = await db.orderProject.create({
    data: {
      yachtId,
      name,
      status: 'DRAFT',
      totals,
      snapshot,
      createdById: userId || null,
    },
  });
  await logAudit(yachtId, userId, 'CREATE', 'OrderProject', order.id, { name });
  return order;
}

const NEXT_STATUS = {
  DRAFT: 'CAPTAIN_REVIEW',
  CAPTAIN_REVIEW: 'OWNER_APPROVAL',
  OWNER_APPROVAL: 'APPROVED',
};

export async function advanceOrderStatus(yachtId, orderId, { userId, notes }) {
  const db = getDb();
  const order = await db.orderProject.findFirst({ where: { id: orderId, yachtId } });
  if (!order) throw new Error('Order not found');
  const next = NEXT_STATUS[order.status];
  if (!next) return order;
  const updated = await db.orderProject.update({
    where: { id: orderId },
    data: {
      status: next,
      notes: notes ?? order.notes,
      approvedById: next === 'APPROVED' ? userId || null : order.approvedById,
      approvedAt: next === 'APPROVED' ? new Date() : order.approvedAt,
    },
  });
  await logAudit(yachtId, userId, 'STATUS', 'OrderProject', orderId, {
    from: order.status,
    to: next,
  });
  return updated;
}

function serializeOrder(o) {
  if (!o) return null;
  return {
    id: o.id,
    name: o.name,
    status: o.status,
    totals: o.totals || null,
    notes: o.notes || '',
    createdById: o.createdById || null,
    approvedById: o.approvedById || null,
    approvedAt: o.approvedAt ? o.approvedAt.toISOString() : null,
    createdAt: o.createdAt ? o.createdAt.toISOString() : null,
    updatedAt: o.updatedAt ? o.updatedAt.toISOString() : null,
  };
}

export async function getOrder(yachtId, orderId) {
  const db = getDb();
  const order = await db.orderProject.findFirst({ where: { id: orderId, yachtId } });
  return serializeOrder(order);
}

// The order currently moving through approval (most recently updated, not yet
// archived). Used to rehydrate the approval panel after a refresh.
export async function getActiveOrder(yachtId) {
  const db = getDb();
  const order = await db.orderProject.findFirst({
    where: { yachtId },
    orderBy: [{ updatedAt: 'desc' }],
  });
  return serializeOrder(order);
}

export async function listOrders(yachtId, take = 10) {
  const db = getDb();
  const orders = await db.orderProject.findMany({
    where: { yachtId },
    orderBy: [{ createdAt: 'desc' }],
    take,
  });
  return orders.map(serializeOrder);
}

export async function recordArtifact(yachtId, { type, blobUrl, orderProjectId, userId }) {
  const db = getDb();
  return db.exportArtifact.create({
    data: { yachtId, type, blobUrl, orderProjectId: orderProjectId || null, createdById: userId || null },
  });
}

export async function listArtifacts(yachtId, take = 12) {
  const db = getDb();
  const rows = await db.exportArtifact.findMany({
    where: { yachtId },
    orderBy: [{ createdAt: 'desc' }],
    take,
  });
  return rows.map((a) => ({
    id: a.id,
    type: a.type,
    blobUrl: a.blobUrl,
    orderProjectId: a.orderProjectId || null,
    createdAt: a.createdAt ? a.createdAt.toISOString() : null,
  }));
}

// Replace the full operational workspace for a yacht in one transaction.
// Client-provided ids are preserved so LookItem/crew references stay valid.
// Suitable for the small per-yacht datasets in this product.
export async function persistWorkspace(yachtId, snapshot) {
  const db = getDb();
  const products = Array.isArray(snapshot.products) ? snapshot.products : [];
  const looks = Array.isArray(snapshot.looks) ? snapshot.looks : [];
  const crew = Array.isArray(snapshot.crew) ? snapshot.crew : [];
  const settings = snapshot.settings || {};

  const productIds = new Set(products.map((p) => p.id).filter(Boolean));

  await db.$transaction(async (tx) => {
    await tx.lookItem.deleteMany({ where: { look: { yachtId } } });
    await tx.crewMember.deleteMany({ where: { yachtId } });
    await tx.look.deleteMany({ where: { yachtId } });
    await tx.product.deleteMany({ where: { yachtId } });

    for (let i = 0; i < products.length; i += 1) {
      const p = products[i];
      await tx.product.create({
        data: {
          id: p.id || undefined,
          yachtId,
          category: p.category || 'tops',
          name: p.name || 'Untitled',
          brand: p.brand || null,
          price: Number(p.price) || 0,
          currency: p.currency || 'EUR',
          vatRate: Number(p.vatRate) || 0,
          colours: p.colours || [],
          swatch: p.swatch || '#ffffff',
          accent: p.accent || '#0b1f3a',
          fabric: p.fabric || null,
          details: p.details || null,
          fit: p.fit && p.fit.length ? p.fit : ['woman', 'man'],
          roleTags: p.roleTags || [],
          leadTime: p.leadTime || null,
          minOrder: Number(p.minOrder) || 1,
          sizeRange: p.sizeRange || null,
          imageHint: p.imageHint || 'polo',
          imageUrl: p.imageUrl || null,
          active: p.active !== false,
          sortIndex: i,
        },
      });
    }

    const lookIds = new Set();
    for (let i = 0; i < looks.length; i += 1) {
      const l = looks[i];
      const validItemIds = (l.productIds || []).filter((id) => productIds.has(id));
      const created = await tx.look.create({
        data: {
          id: l.id || undefined,
          yachtId,
          name: l.name || 'New Look',
          description: l.description || null,
          bodyType: l.bodyType === 'man' ? 'man' : 'woman',
          sortIndex: i,
          items: { create: validItemIds.map((productId) => ({ productId })) },
        },
      });
      lookIds.add(created.id);
    }

    for (let i = 0; i < crew.length; i += 1) {
      const c = crew[i];
      const assigned = c.assignedLook && lookIds.has(c.assignedLook) ? c.assignedLook : null;
      await tx.crewMember.create({
        data: {
          id: c.id || undefined,
          yachtId,
          name: c.name || 'New Crew',
          role: c.role || 'interior',
          bodyType: c.bodyType === 'man' ? 'man' : 'woman',
          topSize: c.topSize || null,
          bottomSize: c.bottomSize || null,
          shoeSize: c.shoeSize || null,
          assignedLookId: assigned,
          sortIndex: i,
        },
      });
    }

    await tx.projectSettings.upsert({
      where: { yachtId },
      update: {
        vessel: settings.vessel ?? undefined,
        priceNote: settings.priceNote ?? undefined,
        currency: settings.currency ?? undefined,
        logoCost: settings.logoCost ?? undefined,
        sparePercent: settings.sparePercent ?? undefined,
        setsPerCrew: settings.setsPerCrew ?? undefined,
        shippingFlat: settings.shippingFlat ?? undefined,
        embroiderySetup: settings.embroiderySetup ?? undefined,
      },
      create: {
        yachtId,
        vessel: settings.vessel || null,
        priceNote: settings.priceNote || '',
        currency: settings.currency || 'EUR',
        logoCost: settings.logoCost ?? 15,
        sparePercent: settings.sparePercent ?? 10,
        setsPerCrew: settings.setsPerCrew ?? 2,
        shippingFlat: settings.shippingFlat ?? 0,
        embroiderySetup: settings.embroiderySetup ?? 0,
      },
    });
  });

  return getWorkspace(yachtId);
}

// ── Membership / team management ──────────────────────────────────────────
export async function listMembers(yachtId) {
  const db = getDb();
  const members = await db.membership.findMany({
    where: { yachtId },
    include: { user: true },
    orderBy: [{ createdAt: 'asc' }],
  });
  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    email: m.user?.email || '',
    name: m.user?.name || '',
    createdAt: m.createdAt ? m.createdAt.toISOString() : null,
  }));
}

export async function findUserByEmail(email) {
  const db = getDb();
  if (!email) return null;
  return db.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
}

// Add an existing user (already onboarded via Clerk) to a yacht. Idempotent on
// the unique (userId, yachtId) constraint.
export async function addMembership(yachtId, userId, role) {
  const db = getDb();
  const existing = await db.membership.findFirst({ where: { yachtId, userId } });
  if (existing) {
    return db.membership.update({ where: { id: existing.id }, data: { role } });
  }
  return db.membership.create({ data: { yachtId, userId, role } });
}

export async function setMemberRole(yachtId, membershipId, role) {
  const db = getDb();
  const membership = await db.membership.findFirst({ where: { id: membershipId, yachtId } });
  if (!membership) throw new Error('Membership not found');
  return db.membership.update({ where: { id: membershipId }, data: { role } });
}

export async function removeMember(yachtId, membershipId) {
  const db = getDb();
  const membership = await db.membership.findFirst({ where: { id: membershipId, yachtId } });
  if (!membership) throw new Error('Membership not found');
  await db.membership.delete({ where: { id: membershipId } });
}

// Count owners so the UI/guards can prevent removing the last owner.
export async function countOwners(yachtId) {
  const db = getDb();
  return db.membership.count({ where: { yachtId, role: 'OWNER' } });
}

export async function updateYacht(yachtId, { name }) {
  const db = getDb();
  return db.yacht.update({ where: { id: yachtId }, data: { name } });
}

export async function logAudit(yachtId, userId, action, entity, entityId, meta) {
  const db = getDb();
  try {
    await db.auditEvent.create({
      data: { yachtId: yachtId || null, userId: userId || null, action, entity, entityId, meta },
    });
  } catch {
    // auditing must never break the primary operation
  }
}
