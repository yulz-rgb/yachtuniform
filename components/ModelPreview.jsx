'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sun,
  ImageOff,
  Move,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import {
  PREVIEW_FILL_RATIO,
  cutoutSrc,
  figureDimensions,
  garmentLayers,
} from '../lib/previewAssets';
import {
  subscribePreviewAdjustments,
  getPreviewAdjustmentsSnapshot,
  getPreviewAdjustmentsServerSnapshot,
  nudgePreviewAdjustment,
  resetAllPreviewAdjustments,
  resetPreviewAdjustment,
  NUDGE,
} from '../lib/previewAdjustments';
import { fitProductImage } from '../lib/previewImage';
import { productImageForColour, defaultProductColour } from '../lib/productColour';

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.1;

function GarmentLayer({
  product,
  slot,
  adjustMode,
  isAdjustTarget,
  onSelect,
}) {
  const colour = defaultProductColour(product);
  const rawSrc = productImageForColour(product, colour);
  // Only the async-fitted result lives in state; the displayed src/keyed flag are
  // derived during render so we never call setState synchronously inside the effect.
  const [fitted, setFitted] = useState({ src: null, value: null, keyed: false });

  useEffect(() => {
    if (!rawSrc) return undefined;
    let alive = true;
    fitProductImage(rawSrc).then((next) => {
      if (!alive) return;
      setFitted({
        src: rawSrc,
        value: next,
        keyed: Boolean(next && next !== rawSrc && next.startsWith('data:')),
      });
    });

    return () => {
      alive = false;
    };
  }, [rawSrc]);

  if (!rawSrc) return null;

  const fittedMatches = fitted.src === rawSrc;
  const src = fittedMatches && fitted.value ? fitted.value : rawSrc;
  const keyed = fittedMatches ? fitted.keyed : false;

  const scale = slot.scale || 1;

  return (
    <div
      className={`preview-garment-layer${isAdjustTarget ? ' is-adjust-target' : ''}`}
      style={{
        top: `${slot.top}%`,
        left: `${slot.left}%`,
        width: `${slot.width}%`,
        height: `${slot.height}%`,
        zIndex: slot.z,
        pointerEvents: adjustMode ? 'auto' : 'none',
        cursor: adjustMode ? 'pointer' : undefined,
      }}
      onClick={adjustMode ? () => onSelect(product.id) : undefined}
      onKeyDown={adjustMode ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(product.id);
        }
      } : undefined}
      role={adjustMode ? 'button' : undefined}
      tabIndex={adjustMode ? 0 : undefined}
      aria-label={adjustMode ? `Adjust ${product.name}` : undefined}
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
          transformOrigin: slot.transformOrigin || 'center center',
        }}
      />
    </div>
  );
}

function AdjustPanel({
  layers,
  activeLayerId,
  onSelectLayer,
  onNudge,
  onResetLayer,
  onResetAll,
}) {
  const activeLayer = layers.find((layer) => layer.product.id === activeLayerId);

  if (!layers.length) {
    return (
      <div className="preview-adjust-panel">
        <p className="preview-adjust-empty">Select outfit pieces to adjust their fit.</p>
      </div>
    );
  }

  return (
    <div className="preview-adjust-panel" role="region" aria-label="Garment fit adjustment">
      <div className="preview-adjust-head">
        <span className="preview-adjust-title">Adjust fit</span>
        <button type="button" className="preview-adjust-reset" onClick={onResetAll} title="Reset all saved adjustments">
          Reset all
        </button>
      </div>

      <label className="preview-adjust-field">
        <span>Layer</span>
        <select
          value={activeLayerId || ''}
          onChange={(event) => onSelectLayer(event.target.value)}
        >
          {layers.map(({ product }) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </label>

      {activeLayer ? (
        <>
          <div className="preview-adjust-grid" aria-label="Move garment">
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('topDelta', -NUDGE.position)} aria-label="Move up">
              <ChevronUp size={14} aria-hidden />
            </button>
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('leftDelta', -NUDGE.position)} aria-label="Move left">
              <ChevronLeft size={14} aria-hidden />
            </button>
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('leftDelta', NUDGE.position)} aria-label="Move right">
              <ChevronRight size={14} aria-hidden />
            </button>
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('topDelta', NUDGE.position)} aria-label="Move down">
              <ChevronDown size={14} aria-hidden />
            </button>
          </div>

          <div className="preview-adjust-row">
            <span>Width</span>
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('widthDelta', -NUDGE.size)} aria-label="Narrow">
              <Minus size={14} aria-hidden />
            </button>
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('widthDelta', NUDGE.size)} aria-label="Widen">
              <Plus size={14} aria-hidden />
            </button>
          </div>

          <div className="preview-adjust-row">
            <span>Height</span>
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('heightDelta', -NUDGE.size)} aria-label="Shorten">
              <Minus size={14} aria-hidden />
            </button>
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('heightDelta', NUDGE.size)} aria-label="Lengthen">
              <Plus size={14} aria-hidden />
            </button>
          </div>

          <div className="preview-adjust-row">
            <span>Scale</span>
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('scaleDelta', -NUDGE.scale)} aria-label="Scale down">
              <Minus size={14} aria-hidden />
            </button>
            <button type="button" className="preview-adjust-btn" onClick={() => onNudge('scaleDelta', NUDGE.scale)} aria-label="Scale up">
              <Plus size={14} aria-hidden />
            </button>
          </div>

          <button
            type="button"
            className="preview-adjust-reset-layer"
            onClick={() => onResetLayer(activeLayer.product.id)}
          >
            <RotateCcw size={12} aria-hidden />
            Reset layer
          </button>
        </>
      ) : null}
    </div>
  );
}

export function ModelPreview({ bodyType, selectedProducts = [] }) {
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState('front');
  const [brightness, setBrightness] = useState(1);
  const [showBackground, setShowBackground] = useState(true);
  const [fitScale, setFitScale] = useState(1);
  const [adjustMode, setAdjustMode] = useState(false);
  const adjustments = useSyncExternalStore(
    subscribePreviewAdjustments,
    getPreviewAdjustmentsSnapshot,
    getPreviewAdjustmentsServerSnapshot,
  );
  const [activeLayerId, setActiveLayerId] = useState(null);
  const frameRef = useRef(null);

  const clampZoom = useCallback(
    (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    [],
  );

  const figureSize = figureDimensions(bodyType, view);
  const layers = garmentLayers(bodyType, view, selectedProducts, adjustments);

  // Derive the effective selection during render instead of syncing it via an effect.
  // `activeLayerId` is the user's explicit pick; when it is unset or no longer present
  // in the current layers we fall back to the topmost layer.
  const activeLayerIsValid =
    activeLayerId != null && layers.some((layer) => layer.product.id === activeLayerId);
  const effectiveActiveLayerId = activeLayerIsValid
    ? activeLayerId
    : layers.length
      ? layers[layers.length - 1].product.id
      : null;

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
      if (adjustMode) return;
      event.preventDefault();
      setZoom((current) => clampZoom(current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };

    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [adjustMode, clampZoom]);

  const handleNudge = useCallback((field, delta) => {
    if (!effectiveActiveLayerId) return;
    nudgePreviewAdjustment(effectiveActiveLayerId, bodyType, view, field, delta);
  }, [effectiveActiveLayerId, bodyType, view]);

  const handleResetLayer = useCallback((productId) => {
    resetPreviewAdjustment(productId, bodyType, view);
  }, [bodyType, view]);

  const handleResetAll = useCallback(() => {
    resetAllPreviewAdjustments();
  }, []);

  const figureScale = fitScale * zoom;
  const modelSrc = cutoutSrc(bodyType, view);

  return (
    <div
      ref={frameRef}
      className={`preview-frame ${showBackground ? 'has-yacht-bg' : 'no-bg'}${adjustMode ? ' is-adjusting' : ''}`}
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
        <button
          type="button"
          className={`preview-tool ${adjustMode ? 'active' : ''}`}
          onClick={() => setAdjustMode((mode) => !mode)}
          title={adjustMode ? 'Exit fit adjustment' : 'Adjust garment fit'}
          aria-label={adjustMode ? 'Exit fit adjustment' : 'Adjust garment fit'}
          aria-pressed={adjustMode}
        >
          <Move size={14} aria-hidden />
        </button>
      </div>

      {adjustMode ? (
        <AdjustPanel
          layers={layers}
          activeLayerId={effectiveActiveLayerId}
          onSelectLayer={setActiveLayerId}
          onNudge={handleNudge}
          onResetLayer={handleResetLayer}
          onResetAll={handleResetAll}
        />
      ) : null}

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
            <GarmentLayer
              key={product.id}
              product={product}
              slot={slot}
              adjustMode={adjustMode}
              isAdjustTarget={adjustMode && product.id === effectiveActiveLayerId}
              onSelect={setActiveLayerId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
