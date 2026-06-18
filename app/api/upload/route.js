import { getActiveContext } from '../../../lib/auth';
import { uploadBlob } from '../../../lib/blob';
import { hasBlob, backendEnabled } from '../../../lib/config';
import { can } from '../../../lib/permissions';

export async function POST(req) {
  if (!hasBlob) {
    return Response.json({ error: 'Blob storage not configured' }, { status: 501 });
  }
  if (backendEnabled) {
    const ctx = await getActiveContext();
    if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!can(ctx.role, 'product.upload')) {
      return Response.json({ error: 'Insufficient permissions to upload images' }, { status: 403 });
    }
  }
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: 'File too large (max 8MB)' }, { status: 413 });
  }
  try {
    const url = await uploadBlob(`products/${file.name}`, file, { contentType: file.type });
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
