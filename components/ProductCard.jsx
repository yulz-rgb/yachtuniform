'use client';

import { Plus, Trash2 } from 'lucide-react';
import { money } from '../lib/calc';

export function ProductCard({ product, isSelected, onToggle, onEdit, readOnly = false }) {
  const imgBg = isSelected
    ? `radial-gradient(ellipse at 65% 25%, ${product.swatch}55 0%, #e8f2fa 55%, #f4f8fc 100%)`
    : `radial-gradient(ellipse at 65% 25%, ${product.swatch}28 0%, #eef4f9 55%, #f7f9fc 100%)`;
  return (
    <article className={`product-card ${isSelected ? 'selected' : ''} ${product.active === false ? 'inactive' : ''}`}>
      <div className="product-card-image" style={{ background: imgBg }}>
        <span className="brand-tag">{product.brand}</span>
        {isSelected && <span className="in-look-badge">✓ In Look</span>}
        {product.active === false && <span className="inactive-badge">Inactive</span>}
        <div className="product-photo">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="product-photo-img" src={product.imageUrl} alt={product.name} />
          ) : (
            <div className="product-photo-shirt" style={{ background: product.swatch, borderColor: product.accent }} />
          )}
        </div>
      </div>
      <div className="product-card-body">
        <div className="brand">{product.brand}</div>
        <h3>{product.name}</h3>
        <div className="product-price">{money(product.price, product.currency)}</div>
        <div className="color-swatches">
          {(product.colours || []).slice(0, 4).map((c, i) => (
            <span key={c} className="color-swatch" title={c} style={{ background: i === 0 ? product.swatch : '#e2e8f0' }} />
          ))}
        </div>
        <div className="product-specs">
          <div className="product-spec"><strong>Fabric</strong>{product.fabric?.split(',')[0] || '—'}</div>
          <div className="product-spec"><strong>Sizes</strong>{product.sizeRange || 'TBC'}</div>
          <div className="product-spec"><strong>Lead</strong>{product.leadTime || 'TBC'}</div>
          <div className="product-spec"><strong>SKU</strong>{product.sku || '—'}</div>
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
