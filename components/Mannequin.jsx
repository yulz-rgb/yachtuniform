'use client';

// Mannequin preview with layered garment shapes. Falls back to a CSS shape when
// a product has no real image; uses the product photo when imageUrl is present.

export function GarmentShape({ product, showLabel = true }) {
  if (!product) return null;
  const fill = product.swatch || '#ffffff';
  const stroke = product.accent || '#0b1f3a';
  const hint = product.imageHint || product.category;
  const label = product.name?.split(' ').slice(0, 2).join(' ');
  const imageOverlay = product.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="garment-photo" src={product.imageUrl} alt={product.name || ''} />
  ) : null;
  const shapes = {
    dress: <div className="garment dress" style={{ background: fill, borderColor: stroke }}>{imageOverlay}{showLabel && !product.imageUrl && <span>{label}</span>}</div>,
    shirt: <div className="garment shirt" style={{ background: fill, borderColor: stroke }}>{imageOverlay}{showLabel && !product.imageUrl && <span>{label}</span>}</div>,
    jacket: <div className="garment jacket" style={{ background: fill, borderColor: stroke }}>{imageOverlay}{showLabel && !product.imageUrl && <span>{label}</span>}</div>,
    shorts: <div className="garment shorts" style={{ background: fill, borderColor: stroke }}>{imageOverlay}{showLabel && !product.imageUrl && <span>{label}</span>}</div>,
    skort: <div className="garment skort" style={{ background: fill, borderColor: stroke }}>{imageOverlay}{showLabel && !product.imageUrl && <span>{label}</span>}</div>,
    trousers: <div className="garment trousers" style={{ background: fill, borderColor: stroke }}>{imageOverlay}{showLabel && !product.imageUrl && <span>{label}</span>}</div>,
    shoes: <><div className="garment shoe left" style={{ background: fill, borderColor: stroke }}>{product.imageUrl && imageOverlay}</div><div className="garment shoe right" style={{ background: fill, borderColor: stroke }} /></>,
    cap: <div className="garment cap" style={{ background: fill, borderColor: stroke }}>{imageOverlay}</div>,
    belt: <div className="garment belt" style={{ background: fill, borderColor: stroke }} />,
  };
  return shapes[hint] || <div className="garment polo" style={{ background: fill, borderColor: stroke }}>{imageOverlay}{showLabel && !product.imageUrl && <span>{label}</span>}</div>;
}

export function Mannequin({ bodyType, selectedProducts, compact = false }) {
  const byCategory = Object.fromEntries(selectedProducts.map((p) => [p.category, p]));
  const accessories = selectedProducts.filter((p) => p.category === 'accessories');
  return (
    <div className={`mannequin ${bodyType} ${compact ? 'compact' : ''}`}>
      <div className="body head"><div className="hair" /></div>
      <div className="body neck" />
      <div className="body torso-base" />
      <div className="body arm left" /><div className="body arm right" />
      <div className="body leg left" /><div className="body leg right" />
      {byCategory.dresses && bodyType === 'woman' ? <GarmentShape product={byCategory.dresses} showLabel={!compact} /> : <>
        <GarmentShape product={byCategory.tops || byCategory.shirts} showLabel={!compact} />
        <GarmentShape product={byCategory.bottoms} showLabel={!compact} />
      </>}
      <GarmentShape product={byCategory.outerwear} showLabel={!compact} />
      <GarmentShape product={byCategory.shoes} showLabel={!compact} />
      {accessories.map((p) => <GarmentShape key={p.id} product={p} showLabel={!compact} />)}
    </div>
  );
}
