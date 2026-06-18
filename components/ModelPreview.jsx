'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Sun, ImageOff } from 'lucide-react';
import {
  PREVIEW_FILL_RATIO,
  cutoutSrc,
  figureDimensions,
  garmentLayers,
} from '../lib/previewAssets';
import { keyProductImage } from '../lib/previewImage';
import { productImageForColour, defaultProductColour } from '../lib/productColour';

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.1;

function GarmentLayer({ product, slot }) {
  const colour = defaultProductColour(product);
  const rawSrc = productImageForColour(product, colour);
  const [src, setSrc] = useState(rawSrc);
  const [keyed, setKeyed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSrc(rawSrc);
    setKeyed(false);
    if (!rawSrc) return undefined;

    keyProductImage(rawSrc).then((next) => {
      if (!alive) return;
      setSrc(next);
      setKeyed(next !== rawSrc);
    });

    return () => {
      alive = false;
    };
  }, [rawSrc]);

  if (!rawSrc) return null;

  const scale = slot.scale || 1;

  return (
    <div
      className="preview-garment-layer"
      style={{
        top: `${slot.top}%`,
        left: `${slot.left}%`,
        width: `${slot.width}%`,
        height: `${slot.height}%`,
        zIndex: slot.z,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`preview-garment-img${keyed ? ' is-keyed' : ''}`}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: slot.fit || 'cover',
          objectPosition: slot.objectPosition || '50% 50%',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
        }}
      />
    </div>
  );
}

export function ModelPreview({ bodyType, selectedProducts = [] }) {
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState('front');
  const [brightness, setBrightness] = useState(1);
  const [showBackground, setShowBackground] = useState(true);
  const [fitScale, setFitScale] = useState(1);
  const frameRef = useRef(null);

  const clampZoom = useCallback(
    (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    [],
  );

  const figureSize = figureDimensions(bodyType, view);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const updateFit = () => {
      const targetHeight = frame.clientHeight * PREVIEW_FILL_RATIO;
      setFitScale(targetHeight / figureSize.height);
    };

    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [figureSize.height]);

  useLayoutEffect(() => {
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
  const layers = garmentLayers(bodyType, view, selectedProducts);
  const modelSrc = cutoutSrc(bodyType, view);

  return (
    <div
      ref={frameRef}
      className={`preview-frame ${showBackground ? 'has-yacht-bg' : 'no-bg'}`}
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
          onClick={() => setBrightness((b) => (b >= 1.2 ? 1 : b + 0.06))}
          title="Adjust brightness"
          aria-label="Adjust brightness"
        >
          <Sun size={14} aria-hidden />
        </button>
        <button
          type="button"
          className={`preview-tool ${!showBackground ? 'active' : ''}`}
          onClick={() => setShowBackground((s) => !s)}
          title={showBackground ? 'Hide background' : 'Show background'}
          aria-label={showBackground ? 'Hide background' : 'Show background'}
        >
          <ImageOff size={14} aria-hidden />
        </button>
      </div>

      <div
        className="preview-viewport"
        style={{ filter: brightness !== 1 ? `brightness(${brightness})` : undefined }}
      >
        <div
          className={`preview-figure-stack view-${view}`}
          style={{
            width: figureSize.width,
            height: figureSize.height,
            transform: `scale(${figureScale})`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={modelSrc}
            alt=""
            className="preview-model-cutout"
            draggable={false}
          />
          {layers.map(({ product, slot }) => (
            <GarmentLayer key={product.id} product={product} slot={slot} />
          ))}
        </div>
      </div>
    </div>
  );
}
