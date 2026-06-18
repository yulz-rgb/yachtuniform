export function getPreviewModelSrc(bodyType, view = 'front') {
  const side = view === 'back' ? 'back' : 'front';
  return `/preview/composite-${bodyType}-${side}.jpg`;
}

export const PREVIEW_BASE_SCALE = 0.92;
