// AI virtual try-on: composites the selected garments onto the model photo with
// Gemini 2.5 Flash Image ("nano banana") — a multi-image-input model that is
// currently the cheapest capable option for this (~$0.039/image, single API key,
// no GPU hosting). Replaces naive CSS overlay compositing with a real photo edit
// so garments actually render on the model's body, pose, and lighting.
import { readFile } from 'fs/promises';
import path from 'path';

const GEMINI_MODEL = 'gemini-2.5-flash-image';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const FETCH_TIMEOUT_MS = 45000;
const MAX_CACHE_ENTRIES = 80;

export const hasAITryOn = Boolean(process.env.GEMINI_API_KEY);

// Process-local cache so identical (bodyType, view, garment) combinations across
// requests/users don't re-spend API tokens — the single biggest lever on cost.
const cache = new Map();

function cacheKey(bodyType, view, garments) {
  const signature = garments.map((g) => g.imageUrl).sort().join('|');
  return `${bodyType}:${view}:${signature}`;
}

// The current model source photos live at public/preview/model-*.png, but their
// bytes are actually JPEG (mismatched extension from how they were authored) —
// sniff the real format from the file header rather than trusting the name.
function sniffImageMimeType(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  return 'image/jpeg';
}

async function loadModelImage(bodyType, view) {
  const filePath = path.join(process.cwd(), 'public', 'preview', `model-${bodyType}-${view}.png`);
  const buffer = await readFile(filePath);
  return { mimeType: sniffImageMimeType(buffer), data: buffer.toString('base64') };
}

async function loadGarmentImage(src, origin) {
  if (src.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(src);
    if (!match) throw new Error('Unsupported garment image data URL');
    return { mimeType: match[1], data: match[2] };
  }
  const url = src.startsWith('/') ? `${origin}${src}` : src;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Failed to fetch garment image (${response.status})`);
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { mimeType, data: buffer.toString('base64') };
}

function buildPrompt(garments) {
  const garmentLines = garments.map((g, i) => {
    const ordinal = i + 2; // image 1 is the person
    const named = g.name ? ` ("${g.name}")` : '';
    return `Image ${ordinal} shows the ${g.label}${named} — dress the person in exactly this item.`;
  });

  return [
    'You are a professional fashion photo editor performing a virtual clothing try-on for an e-commerce lookbook.',
    'Image 1 is a studio photo of a person wearing minimal base attire (swimwear) that exists only as a body and pose reference.',
    ...garmentLines,
    'Fully cover and replace the base attire wherever a selected garment covers that body region, and dress the person in the selected garment(s) instead.',
    'Match each garment\'s exact color, pattern, fabric texture, logo, and trim precisely as shown in its reference image — do not invent a different design.',
    'Fit every garment naturally and snugly to the person\'s real body shape and pose, with correct proportions, drape, seams, and realistic fabric folds and shadows, as if they are actually wearing it — a perfect, true-to-size fit, not a flat sticker or overlay.',
    'Keep the person\'s face, body shape, skin tone, hair, pose, camera framing, and the plain studio background completely unchanged. Do not alter anything except the clothing described above.',
    'Output a single photorealistic full-body image with the same framing and proportions as image 1.',
  ].join(' ');
}

export async function generateTryOnImage({ bodyType, view, garments, origin }) {
  const key = cacheKey(bodyType, view, garments);
  const cached = cache.get(key);
  if (cached) return cached;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const [modelImage, ...garmentImages] = await Promise.all([
    loadModelImage(bodyType, view),
    ...garments.map((g) => loadGarmentImage(g.imageUrl, origin)),
  ]);

  const parts = [
    { text: buildPrompt(garments) },
    { inlineData: modelImage },
    ...garmentImages.map((inlineData) => ({ inlineData })),
  ];

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AI try-on generation failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const json = await response.json();
  const resultParts = json?.candidates?.[0]?.content?.parts || [];
  const imagePart = resultParts.find((p) => p?.inlineData?.data);
  if (!imagePart) throw new Error('AI try-on returned no image');

  const dataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, dataUrl);

  return dataUrl;
}
