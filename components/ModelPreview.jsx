'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  RotateCw,
  Sun,
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
  garmentAiLabel,
  garmentLayers,
  modelPhotoDimensions,
  resolvePreviewProducts,
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
import {
  subscribeAiTryOn,
  getAiTryOnEntry,
  getAiTryOnServerSnapshot,
  setAiTryOnEntry,
  isAiTryOnUnavailable,
  markAiTryOnUnavailable,
} from '../lib/aiTryOnClient';

const AI_DEBOUNCE_MS = 500;

function garmentSignature(previewProducts) {
  return previewProducts
    .map((p) => productImageForColour(p, defaultProductColour(p)))
    .filter(Boolean)
    .sort()
    .join('|');
}

/** Drives the real AI clothing-fit render: posts the model + garment photos to
 * /api/tryon and returns a single photorealistic composite, replacing the
 * manual layered-overlay approach whenever the AI service is available.
 * Results live in the lib/aiTryOnClient external store (not component state) so
 * the async fetch below never needs to call a React setState inside an effect. */
function useAiTryOn(bodyType, view, previewProducts) {
  const signature = garmentSignature(previewProducts);
  const key = signature ? `${bodyType}|${view}|${signature}` : null;

  const entry = useSyncExternalStore(
    subscribeAiTryOn,
    () => getAiTryOnEntry(key),
    getAiTryOnServerSnapshot,
  );

  // Kept in a ref (not an effect dependency) so re-renders that don't change the
  // garment signature never reset the debounce timer below.
  const previewProductsRef = useRef(previewProducts);
  useEffect(() => {
    previewProductsRef.current = previewProducts;
  });

  useEffect(() => {
    if (isAiTryOnUnavailable() || !key) return undefined;
    if (getAiTryOnEntry(key).src) return undefined; // already resolved/cached

    let alive = true;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setAiTryOnEntry(key, { loading: true });

      const garments = previewProductsRef.current
        .map((product) => ({
          imageUrl: productImageForColour(product, defaultProductColour(product)),
          name: product.name,
          label: garmentAiLabel(product),
        }))
        .filter((g) => g.imageUrl);

      try {
        const res = await fetch('/api/tryon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bodyType, view, garments }),
          signal: controller.signal,
        });

        if (res.status === 501) {
          markAiTryOnUnavailable();
          if (alive) setAiTryOnEntry(key, { src: null, loading: false });
          return;
        }
        if (!res.ok) throw new Error('AI try-on request failed');

        const data = await res.json();
        if (!alive) return;
        setAiTryOnEntry(key, { src: data.image, loading: false });
      } catch (err) {
        if (alive && err.name !== 'AbortError') {
          setAiTryOnEntry(key, { loading: false });
        }
      }
    }, AI_DEBOUNCE_MS);

    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [bodyType, view, signature, key]);

  return entry;
}

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
  const [view, setView] = useState('front');
  const [brightness, setBrightness] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [adjustMode, setAdjustMode] = useState(false);
  const adjustments = useSyncExternalStore(
    subscribePreviewAdjustments,
    getPreviewAdjustmentsSnapshot,
    getPreviewAdjustmentsServerSnapshot,
  );
  const [activeLayerId, setActiveLayerId] = useState(null);
  const frameRef = useRef(null);

  const figureSize = figureDimensions(bodyType, view);
  const layers = garmentLayers(bodyType, view, selectedProducts, adjustments);
  const previewProducts = resolvePreviewProducts(selectedProducts, bodyType);
  const aiTryOn = useAiTryOn(bodyType, view, previewProducts);
  const aiActive = Boolean(aiTryOn.src);
  // The AI render is a single photo with its own native framing, distinct from
  // the cutout silhouette used by the manual overlay fallback below.
  const activeSize = aiActive ? modelPhotoDimensions(bodyType, view) : figureSize;
  // Fit adjustment only applies to the CSS-overlay fallback; once a real AI
  // render is showing there is nothing to nudge.
  const adjustModeActive = adjustMode && !aiActive;

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
      setFitScale(targetHeight / activeSize.height);
    };

    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [activeSize.height]);

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

  const modelSrc = cutoutSrc(bodyType, view);

  return (
    <div
      ref={frameRef}
      className={`preview-frame${adjustModeActive ? ' is-adjusting' : ''}`}
    >
      <div className="preview-toolbar" role="toolbar" aria-label="Model preview controls">
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
        {aiActive ? null : (
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
        )}
      </div>

      {adjustMode && !aiActive ? (
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
        {aiActive ? (
          <div
            className="preview-figure-stack preview-ai-frame"
            style={{
              width: activeSize.width,
              height: activeSize.height,
              transform: `scale(${fitScale})`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={aiTryOn.src} alt="" className="preview-ai-image" draggable={false} />
            {aiTryOn.loading ? <div className="preview-ai-status">Updating fit…</div> : null}
          </div>
        ) : (
          <div
            className={`preview-figure-stack view-${view}`}
            style={{
              width: activeSize.width,
              height: activeSize.height,
              transform: `scale(${fitScale})`,
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
                adjustMode={adjustModeActive}
                isAdjustTarget={adjustModeActive && product.id === effectiveActiveLayerId}
                onSelect={setActiveLayerId}
              />
            ))}
            {aiTryOn.loading && previewProducts.length ? (
              <div className="preview-ai-status">Generating AI try-on…</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
