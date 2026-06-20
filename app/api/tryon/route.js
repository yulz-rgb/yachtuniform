import { hasAITryOn, generateTryOnImage } from '../../../lib/aiTryOn';
import { getActiveContext } from '../../../lib/auth';
import { backendEnabled } from '../../../lib/config';

const MAX_GARMENTS = 6;

export async function POST(req) {
  if (!hasAITryOn) {
    return Response.json({ error: 'AI try-on is not configured (missing GEMINI_API_KEY)' }, { status: 501 });
  }

  if (backendEnabled) {
    const ctx = await getActiveContext();
    if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const bodyType = body?.bodyType === 'man' ? 'man' : 'woman';
  const view = body?.view === 'back' ? 'back' : 'front';
  const garments = Array.isArray(body?.garments)
    ? body.garments
        .filter((g) => g && typeof g.imageUrl === 'string' && g.imageUrl)
        .slice(0, MAX_GARMENTS)
        .map((g) => ({
          imageUrl: g.imageUrl,
          name: typeof g.name === 'string' ? g.name.slice(0, 120) : '',
          label: typeof g.label === 'string' ? g.label.slice(0, 60) : 'garment',
        }))
    : [];

  if (!garments.length) {
    return Response.json({ error: 'No garments provided' }, { status: 400 });
  }

  try {
    const image = await generateTryOnImage({ bodyType, view, garments, origin: req.nextUrl.origin });
    return Response.json({ image });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 502 });
  }
}
