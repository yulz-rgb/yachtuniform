'use client';

import { Plus, Trash2 } from 'lucide-react';
import { money } from '../lib/calc';
import {
  defaultProductColour,
  productImageForColour,
  productSwatchForColour,
} from '../lib/productColour';
import { LookItemControls } from './LookItemControls';
import { ProductAttribution } from './ProductAttribution';
import { ProductPhoto } from './ProductPhoto';
import { ProductSpecs } from './ProductSpecs';

export function ProductCard({
  product,
  isSelected,
  onToggle,
  onEdit,
  readOnly = false,
  selectedColour,
  onColourSelect,
  allocation = null,
  roleOptions = [],
  customRoleIds = new Set(),
  eligibleCount = 0,
  baseQty = 0,
  orderQty = 0,
  disabled = false,
  onAllocationChange,
  onAddRole,
  onRemoveRole,
}) {
  const activeColour = selectedColour || defaultProductColour(product);
  const displayImage = productImageForColour(product, activeColour);
  const displaySwatch = productSwatchForColour(product, activeColour);
  const imgBg = isSelected
    ? `radial-gradient(ellipse at 65% 25%, ${displaySwatch}55 0%, #ffffff 55%, #f8fafc 100%)`
    : `radial-gradient(ellipse at 65% 25%, ${displaySwatch}28 0%, #ffffff 55%, #f8fafc 100%)`;

  function handleColourClick(e, colour) {
    e.stopPropagation();
    onColourSelect?.(product, colour);
  }

  return (
    <article className={`product-card ${isSelected ? 'selected' : ''} ${product.active === false ? 'inactive' : ''}`}>
      <div className="product-card-image" style={{ background: imgBg }}>
        {isSelected && <span className="in-look-badge">In look</span>}
        {product.active === false && <span className="inactive-badge">Inactive</span>}
        <div className="product-photo">
          {displayImage ? (
            <ProductPhoto src={displayImage} alt={`${product.name} — ${activeColour}`} />
          ) : (
            <div className="product-photo-shirt" style={{ background: displaySwatch, borderColor: product.accent }} />
          )}
        </div>
      </div>
      <div className="product-card-body">
        <ProductAttribution product={product} />
        <h3>{product.name}</h3>
        <div className="product-price">{money(product.price, product.currency)}</div>
        {isSelected && allocation && onAllocationChange && (
          <LookItemControls
            item={allocation}
            roleOptions={roleOptions}
            customRoleIds={customRoleIds}
            eligibleCount={eligibleCount}
            baseQty={baseQty}
            orderQty={orderQty}
            compact
            disabled={disabled}
            onChange={onAllocationChange}
            onAddRole={onAddRole}
            onRemoveRole={onRemoveRole}
          />
        )}
        <ProductSpecs product={product} />
        <div className="color-swatches">
          {(product.colours || []).slice(0, 8).map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${c === activeColour ? 'selected' : ''}`}
              aria-label={`${product.name} in ${c}`}
              aria-pressed={c === activeColour}
              style={{ background: productSwatchForColour(product, c) }}
              onClick={(e) => handleColourClick(e, c)}
            >
              <span className="color-swatch-label">{c}</span>
            </button>
          ))}
        </div>
        {readOnly ? (
          <div className="card-actions">
            <span className={`card-status ${isSelected ? 'in' : ''}`}>{isSelected ? '✓ In this look' : 'Not in look'}</span>
          </div>
        ) : (
          <div className="card-actions">
            <button className={`card-btn ${isSelected ? 'danger' : 'primary'}`} onClick={() => onToggle(product)}>
              {isSelected ? <><Trash2 size={12} /> Remove</> : <><Plus size={12} /> Add</>}
            </button>
            <button className="card-btn" onClick={() => onEdit(product)}>Edit</button>
          </div>
        )}
      </div>
    </article>
  );
}
