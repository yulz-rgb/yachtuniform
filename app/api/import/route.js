import { getActiveContext } from '../../../lib/auth';
import { applyCatalogImport } from '../../../lib/repository';
import { parseCatalogCsv } from '../../../lib/csv';
import { validateCatalogRecord } from '../../../lib/validation';
import { backendEnabled } from '../../../lib/config';
import { can } from '../../../lib/permissions';

// Validate a catalog CSV without persisting. Used for the import preview step.
export async function PUT(req) {
  const { csv } = await req.json();
  const { records } = parseCatalogCsv(csv || '');
  const valid = [];
  const invalid = [];
  records.forEach((raw, idx) => {
    const result = validateCatalogRecord(raw, idx + 2);
    if (result.ok) valid.push(result);
    else invalid.push(result);
  });
  return Response.json({
    total: records.length,
    valid: valid.length,
    invalid: invalid.length,
    errors: invalid,
    preview: valid.slice(0, 50).map((v) => v.value),
  });
}

// Validate + persist a catalog CSV into the active yacht.
export async function POST(req) {
  if (!backendEnabled) {
    return Response.json({ error: 'Backend not configured; import requires a database.' }, { status: 501 });
  }
  const ctx = await getActiveContext();
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(ctx.role, 'catalog.import')) {
    return Response.json({ error: 'Insufficient permissions to import' }, { status: 403 });
  }

  const { csv, filename } = await req.json();
  const { records } = parseCatalogCsv(csv || '');
  if (records.length === 0) {
    return Response.json({ error: 'No data rows found in CSV' }, { status: 400 });
  }

  const valid = [];
  const invalid = [];
  records.forEach((raw, idx) => {
    const result = validateCatalogRecord(raw, idx + 2);
    if (result.ok) valid.push(result);
    else invalid.push(result);
  });

  if (valid.length === 0) {
    return Response.json({ error: 'All rows failed validation', errors: invalid }, { status: 422 });
  }

  const result = await applyCatalogImport(ctx.yachtId, valid, filename || 'catalog.csv', ctx.user.id);
  return Response.json({ ...result, invalid: invalid.length, validationErrors: invalid });
}
