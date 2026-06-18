export const bodyTypes = [
  { id: 'woman', label: 'Female', emoji: '♀' },
  { id: 'man', label: 'Male', emoji: '♂' },
];

// SKUs shipped as bootstrap/demo data. Used to detect when a workspace is still
// running on sample data so we can prompt the operator to import real catalog.
export const DEMO_SKUS = new Set([
  'GM-POL-WHT', 'GM-POL-NVY', 'UG-LIN-WHT', 'LYW-DRS-NVY', 'MP-SHT-NVY',
  'LYW-SKO-NVY', 'HH-CHI-STN', 'ST-SOF-NVY', 'DS-WHT-001', 'SS-BGE-001',
  'CAP-NVY-001', 'BLT-TAN-001',
]);

// Heuristic: a catalog is "demo" if it still carries the bootstrap price note or
// a meaningful number of the seeded sample SKUs are present.
export function isDemoCatalog(products = [], settings = {}) {
  if (String(settings?.priceNote || '').toLowerCase().includes('demo prices only')) {
    return true;
  }
  if (!products.length) return false;
  const demoHits = products.filter((p) => p.sku && DEMO_SKUS.has(p.sku)).length;
  return demoHits >= 3;
}

export const roles = [
  { id: 'captain', label: 'Captain', defaultQty: 1 },
  { id: 'chief-stew', label: 'Chief Stew', defaultQty: 1 },
  { id: 'interior', label: 'Interior Crew', defaultQty: 3 },
  { id: 'deck', label: 'Deck Crew', defaultQty: 3 },
  { id: 'chef', label: 'Chef', defaultQty: 1 },
  { id: 'engineer', label: 'Engineer', defaultQty: 1 },
];

export const categories = [
  { id: 'tops', label: 'Polos / Tops', layer: 20 },
  { id: 'shirts', label: 'Shirts', layer: 22 },
  { id: 'dresses', label: 'Dresses', layer: 25 },
  { id: 'bottoms', label: 'Shorts / Skorts', layer: 18 },
  { id: 'outerwear', label: 'Outerwear', layer: 30 },
  { id: 'shoes', label: 'Shoes', layer: 35 },
  { id: 'accessories', label: 'Accessories', layer: 40 },
];

export const navCategories = [
  { id: 'tops-shirts', label: 'Polos & Shirts', categories: ['tops', 'shirts'], subFilters: ['All', 'Polo', 'Shirt', 'Linen', 'Technical', 'Resort'] },
  { id: 'dresses', label: 'Dresses', categories: ['dresses'], subFilters: ['All', 'Service', 'Resort'] },
  { id: 'bottoms', label: 'Bottoms', categories: ['bottoms'], subFilters: ['All', 'Shorts', 'Skort', 'Trousers'] },
  { id: 'outerwear', label: 'Outerwear / Jackets', categories: ['outerwear'], subFilters: ['All', 'Softshell', 'Jacket'] },
  { id: 'shoes', label: 'Shoes', categories: ['shoes'], subFilters: ['All', 'Deck', 'Service'] },
  { id: 'accessories', label: 'Accessories', categories: ['accessories'], subFilters: ['All', 'Cap', 'Belt'] },
];

export const vessels = [
  'M/Y OCEAN BREEZE',
  'M/Y SEA HORIZON',
  'M/Y AZURE SPIRIT',
  'S/Y WIND DANCER',
];

export const defaultLooks = [
  {
    id: 'arrival-look',
    name: 'Arrival / Guest Meet',
    description: 'Smart, fresh first-impression look for guest arrival and dockside welcome.',
    bodyType: 'woman',
    productIds: ['polo-tech-white', 'shorts-stretch-navy', 'belt-tan', 'shoe-service-beige'],
  },
  {
    id: 'day-deck-look',
    name: 'Day Deck',
    description: 'Breathable deck outfit for hot working days, washdowns and tender runs.',
    bodyType: 'man',
    productIds: ['polo-tech-white', 'shorts-stretch-navy', 'shoe-deck-white', 'cap-navy'],
  },
  {
    id: 'evening-service-look',
    name: 'Evening Service',
    description: 'Cleaner dinner-service look for chief stew, interior and formal owner evenings.',
    bodyType: 'woman',
    productIds: ['dress-service-navy', 'shoe-service-beige'],
  },
  {
    id: 'watersports-look',
    name: 'Watersports',
    description: 'Quick-dry active look for tender runs, beach club and watersports support.',
    bodyType: 'woman',
    productIds: ['polo-tech-navy', 'shorts-stretch-navy', 'shoe-deck-white', 'cap-navy'],
  },
];

export const defaultCrew = [
  { id: 'crew-1', name: 'Emma J.', role: 'chief-stew', bodyType: 'woman', topSize: 'S', bottomSize: '36', shoeSize: '38', assignedLook: 'arrival-look', assignedLooks: ['arrival-look', 'evening-service-look'], setsPerCrew: 2, sizeConfirmed: true, fitNotes: 'Prefers slim fit', preferredFit: 'slim' },
  { id: 'crew-2', name: 'Lily M.', role: 'interior', bodyType: 'woman', topSize: 'M', bottomSize: '38', shoeSize: '39', assignedLook: 'arrival-look', assignedLooks: ['arrival-look'], sizeConfirmed: false },
  { id: 'crew-3', name: 'Sophie R.', role: 'interior', bodyType: 'woman', topSize: 'S', bottomSize: '36', shoeSize: '37', assignedLook: 'evening-service-look', assignedLooks: ['evening-service-look', 'watersports-look'], sizeConfirmed: true },
  { id: 'crew-4', name: 'James T.', role: 'deck', bodyType: 'man', topSize: 'L', bottomSize: '34', shoeSize: '43', assignedLook: 'day-deck-look', assignedLooks: ['day-deck-look'], sizeConfirmed: true },
  { id: 'crew-5', name: 'Marcus H.', role: 'deck', bodyType: 'man', topSize: 'M', bottomSize: '32', shoeSize: '42', assignedLook: 'day-deck-look', assignedLooks: ['day-deck-look'], sizeConfirmed: false },
  { id: 'crew-6', name: 'Captain', role: 'captain', bodyType: 'man', topSize: 'L', bottomSize: '34', shoeSize: '43', assignedLook: 'arrival-look', assignedLooks: ['arrival-look'], setsPerCrew: 3, sizeConfirmed: true },
];

export const defaultProducts = [
  {
    id: 'polo-tech-white', category: 'tops', name: 'Technical Crew Polo', brand: 'Gill Marine', sku: 'GM-POL-WHT',
    price: 52, currency: '€', colours: ['White', 'Navy', 'Stone'], swatch: '#f8fafc', accent: '#0b1f3a',
    fabric: 'Recycled polyester piqué, UPF 50, quick dry', details: 'Embroidery-ready left chest. Suitable for deck/interior.',
    fit: ['woman', 'man'], roleTags: ['deck', 'interior', 'chief-stew'], leadTime: '10–14 days', minOrder: 6, sizeRange: 'XS–XXL', imageHint: 'polo'
  },
  {
    id: 'polo-tech-navy', category: 'tops', name: 'Technical Crew Polo', brand: 'Gill Marine', sku: 'GM-POL-NVY',
    price: 52, currency: '€', colours: ['Navy'], swatch: '#0b1f3a', accent: '#f8fafc',
    fabric: 'Recycled polyester piqué, UPF 50, quick dry', details: 'Navy version for stain resistance and smart deck appearance.',
    fit: ['woman', 'man'], roleTags: ['deck', 'engineer'], leadTime: '10–14 days', minOrder: 6, sizeRange: 'XS–XXL', imageHint: 'polo'
  },
  {
    id: 'shirt-linen-white', category: 'shirts', name: 'Linen Resort Shirt', brand: 'Uniforms Galore', sku: 'UG-LIN-WHT',
    price: 68, currency: '€', colours: ['White', 'Sand'], swatch: '#ffffff', accent: '#d6b98c',
    fabric: 'Linen/cotton blend', details: 'Soft collar, breathable, strong visual for guest arrival and captain/chief stew meetings.',
    fit: ['woman', 'man'], roleTags: ['captain', 'chief-stew', 'boss'], leadTime: '14–21 days', minOrder: 4, sizeRange: 'XS–XXL', imageHint: 'shirt'
  },
  {
    id: 'dress-service-navy', category: 'dresses', name: 'Service Dress', brand: 'Liquid Yacht Wear', sku: 'LYW-DRS-NVY',
    price: 118, currency: '€', colours: ['Navy', 'White'], swatch: '#0f2747', accent: '#ffffff',
    fabric: 'Stretch crepe, wrinkle resistant', details: 'Chief stew / evening service option. Not suitable for heavy deck work.',
    fit: ['woman'], roleTags: ['chief-stew', 'interior'], leadTime: '21 days', minOrder: 2, sizeRange: 'EU 34–44', imageHint: 'dress'
  },
  {
    id: 'shorts-stretch-navy', category: 'bottoms', name: 'Stretch Deck Shorts', brand: 'Marinepool', sku: 'MP-SHT-NVY',
    price: 64, currency: '€', colours: ['Navy', 'Stone'], swatch: '#13294b', accent: '#ffffff',
    fabric: 'Cotton/nylon stretch twill', details: 'Practical pockets, hard-wearing deck finish, smart enough for guest-facing work.',
    fit: ['woman', 'man'], roleTags: ['deck', 'engineer', 'captain'], leadTime: '7–14 days', minOrder: 6, sizeRange: '28–40 / EU 34–46', imageHint: 'shorts'
  },
  {
    id: 'skort-navy', category: 'bottoms', name: 'Interior Skort', brand: 'Liquid Yacht Wear', sku: 'LYW-SKO-NVY',
    price: 72, currency: '€', colours: ['Navy', 'White'], swatch: '#0f2747', accent: '#ffffff',
    fabric: 'Stretch technical twill', details: 'Smart interior alternative to shorts with hidden comfort short.',
    fit: ['woman'], roleTags: ['interior', 'chief-stew'], leadTime: '14–21 days', minOrder: 3, sizeRange: 'EU 34–44', imageHint: 'skort'
  },
  {
    id: 'trouser-stone', category: 'bottoms', name: 'Stone Chino Trouser', brand: 'Helly Hansen Workwear', sku: 'HH-CHI-STN',
    price: 86, currency: '€', colours: ['Stone', 'Navy'], swatch: '#d8c7a1', accent: '#0b1f3a',
    fabric: 'Stretch cotton twill', details: 'Owner meeting, cooler evenings, captain/chief stew formal day look.',
    fit: ['woman', 'man'], roleTags: ['captain', 'chief-stew', 'boss'], leadTime: '10–14 days', minOrder: 4, sizeRange: '28–40 / EU 34–46', imageHint: 'trousers'
  },
  {
    id: 'jacket-softshell-navy', category: 'outerwear', name: 'Light Softshell Jacket', brand: 'Stormtech', sku: 'ST-SOF-NVY',
    price: 96, currency: '€', colours: ['Navy', 'Black'], swatch: '#071b35', accent: '#ffffff',
    fabric: 'Water-resistant softshell', details: 'Cooler evenings, crossing days, discreet logo on chest/sleeve.',
    fit: ['woman', 'man'], roleTags: ['deck', 'captain', 'engineer', 'chief-stew'], leadTime: '14 days', minOrder: 4, sizeRange: 'XS–XXL', imageHint: 'jacket'
  },
  {
    id: 'shoe-deck-white', category: 'shoes', name: 'Non-Marking Deck Shoe', brand: 'Sperry / Sebago Alternative', sku: 'DS-WHT-001',
    price: 89, currency: '€', colours: ['White'], swatch: '#f8fafc', accent: '#94a3b8',
    fabric: 'Non-marking rubber sole, leather/textile upper', details: 'Deck-safe sole. Confirm exact non-marking spec before ordering.',
    fit: ['woman', 'man'], roleTags: ['deck', 'captain'], leadTime: '7–10 days', minOrder: 1, sizeRange: 'EU 36–46', imageHint: 'shoes'
  },
  {
    id: 'shoe-service-beige', category: 'shoes', name: 'Minimal Service Sneaker', brand: 'Ecco / Veja Alternative', sku: 'SS-BGE-001',
    price: 76, currency: '€', colours: ['Beige', 'White'], swatch: '#efe3cc', accent: '#9a7b49',
    fabric: 'Wipe-clean leather-look upper', details: 'Interior service shoe. More refined than deck trainers.',
    fit: ['woman', 'man'], roleTags: ['interior', 'chief-stew', 'boss'], leadTime: '7–10 days', minOrder: 1, sizeRange: 'EU 35–45', imageHint: 'shoes'
  },
  {
    id: 'cap-navy', category: 'accessories', name: 'Logo Crew Cap', brand: 'Atlantis Headwear', sku: 'CAP-NVY-001',
    price: 18, currency: '€', colours: ['Navy', 'White', 'Stone'], swatch: '#0b1f3a', accent: '#ffffff',
    fabric: 'Cotton twill', details: 'Adjustable back strap, embroidery-ready front panel.',
    fit: ['woman', 'man'], roleTags: ['deck', 'interior'], leadTime: '10 days', minOrder: 12, sizeRange: 'One size', imageHint: 'cap'
  },
  {
    id: 'belt-tan', category: 'accessories', name: 'Braided Yacht Belt', brand: 'Andersons Alternative', sku: 'BLT-TAN-001',
    price: 34, currency: '€', colours: ['Tan', 'Navy'], swatch: '#a16207', accent: '#fef3c7',
    fabric: 'Elastic braid / leather-look trim', details: 'Finishes smart shorts/trouser looks; flexible sizing.',
    fit: ['woman', 'man'], roleTags: ['boss', 'chief-stew', 'deck'], leadTime: '7 days', minOrder: 1, sizeRange: 'S–XL', imageHint: 'belt'
  },
];
