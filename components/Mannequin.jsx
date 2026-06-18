'use client';

// Mannequin preview with layered garment shapes. Falls back to a CSS shape when
// a product has no real image; uses the product photo when imageUrl is present.

export function GarmentShape({ product, showLabel = false }) {
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
    polo: <div className="garment polo" style={{ background: fill, borderColor: stroke }}>{imageOverlay}{showLabel && !product.imageUrl && <span>{label}</span>}</div>,
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

export function Mannequin({ bodyType, selectedProducts, compact = false, view = 'front' }) {
  const byCategory = Object.fromEntries(selectedProducts.map((p) => [p.category, p]));
  const accessories = selectedProducts.filter((p) => p.category === 'accessories');
  const hasTop = Boolean(
    byCategory.dresses
    || byCategory.engineering
    || byCategory.tops
    || byCategory.shirts
    || byCategory.epaulettes
    || byCategory['chef-wear']
    || byCategory['spa-wear']
    || byCategory.outerwear,
  );
  const hasBottom = Boolean(byCategory.bottoms || (byCategory.dresses && bodyType === 'woman'));
  return (
    <div className={`mannequin ${bodyType} ${compact ? 'compact' : ''} view-${view}`}>
      <div className="body head"><div className="hair" /></div>
      <div className="body neck" />
      <div className="body torso-base" />
      <div className="body arm left" /><div className="body arm right" />
      <div className="body leg left" /><div className="body leg right" />
      {!compact && bodyType === 'woman' && !hasTop && <div className="garment underwear-bra" aria-hidden />}
      {!compact && !hasBottom && <div className="garment underwear-shorts" aria-hidden />}
      {byCategory.dresses && bodyType === 'woman' ? <GarmentShape product={byCategory.dresses} /> :
        byCategory.engineering ? <GarmentShape product={byCategory.engineering} /> : <>
        <GarmentShape product={byCategory.tops || byCategory.shirts || byCategory.epaulettes || byCategory['chef-wear'] || byCategory['spa-wear']} />
        <GarmentShape product={byCategory.bottoms} />
      </>}
      <GarmentShape product={byCategory.outerwear} />
      <GarmentShape product={byCategory.shoes} />
      {accessories.map((p) => <GarmentShape key={p.id} product={p} />)}
    </div>
  );
}
