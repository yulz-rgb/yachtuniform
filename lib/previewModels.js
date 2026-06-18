export function getPreviewModelSrc(bodyType, view = 'front', hideBg = false) {
  const side = view === 'back' ? 'back' : 'front';
  if (hideBg) return `/preview/model-${bodyType}-${side}.jpg`;
  return `/preview/composite-${bodyType}-${side}.jpg`;
}

export const PREVIEW_BASE_SCALE = 1.25;
