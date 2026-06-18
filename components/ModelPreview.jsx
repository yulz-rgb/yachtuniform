'use client';

import { useCallback, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Sun } from 'lucide-react';
import { Mannequin } from './Mannequin';

const BASE_SCALE = 2.5;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.12;

export function ModelPreview({ bodyType, selectedProducts, hideBg }) {
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState('front');
  const [brightness, setBrightness] = useState(1);
  const frameRef = useRef(null);

  const clampZoom = useCallback(
    (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    [],
  );

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();
      setZoom((current) => clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    },
    [clampZoom],
  );

  return (
    <div
      ref={frameRef}
      className={`preview-frame ${hideBg ? 'no-bg' : 'has-yacht-bg'}`}
      onWheel={handleWheel}
    >
      <div className="preview-toolbar" role="toolbar" aria-label="Model preview controls">
        <button type="button" className="preview-tool" onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))} title="Zoom out" aria-label="Zoom out">
          <ZoomOut size={14} aria-hidden />
        </button>
        <button type="button" className="preview-tool" onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))} title="Zoom in" aria-label="Zoom in">
          <ZoomIn size={14} aria-hidden />
        </button>
        <button
          type="button"
          className={`preview-tool ${view === 'back' ? 'active' : ''}`}
          onClick={() => setView((v) => (v === 'front' ? 'back' : 'front'))}
          title={view === 'front' ? 'Show back view' : 'Show front view'}
          aria-label={view === 'front' ? 'Show back view' : 'Show front view'}
        >
          <RotateCw size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="preview-tool"
          onClick={() => setBrightness((b) => (b >= 1.25 ? 1 : b + 0.08))}
          title="Adjust brightness"
          aria-label="Adjust brightness"
        >
          <Sun size={14} aria-hidden />
        </button>
      </div>

      <div className="preview-viewport">
        <div
          className={`preview-model-stage view-${view}`}
          style={{
            transform: `scale(${BASE_SCALE * zoom}) rotateY(${view === 'back' ? 180 : 0}deg)`,
            filter: brightness !== 1 ? `brightness(${brightness})` : undefined,
          }}
        >
          <Mannequin bodyType={bodyType} selectedProducts={selectedProducts} view={view} />
        </div>
      </div>
    </div>
  );
}
