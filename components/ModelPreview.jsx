'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Sun } from 'lucide-react';
import { Mannequin } from './Mannequin';
import { PREVIEW_FILL_RATIO, PREVIEW_MANNEQUIN_HEIGHT } from '../lib/previewModels';

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.12;

export function ModelPreview({ bodyType, selectedProducts = [] }) {
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState('front');
  const [brightness, setBrightness] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const frameRef = useRef(null);

  const clampZoom = useCallback(
    (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    [],
  );

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const updateFit = () => {
      const targetHeight = frame.clientHeight * PREVIEW_FILL_RATIO;
      setFitScale(targetHeight / PREVIEW_MANNEQUIN_HEIGHT);
    };

    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setView('front');
    setZoom(1);
  }, [bodyType]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      setZoom((current) => clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };

    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [clampZoom]);

  const figureScale = fitScale * zoom;

  return (
    <div
      ref={frameRef}
      className="preview-frame has-yacht-bg"
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

      <div
        className="preview-viewport"
        style={{ filter: brightness !== 1 ? `brightness(${brightness})` : undefined }}
      >
        <div
          className={`preview-figure-stack view-${view}`}
          style={{ transform: `scale(${figureScale})` }}
        >
          <Mannequin
            bodyType={bodyType}
            selectedProducts={selectedProducts}
            view={view}
          />
        </div>
      </div>
    </div>
  );
}
