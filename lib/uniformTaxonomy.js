/**
 * Single source of truth for yacht uniform categories, department tags, and nav filters.
 * Human logic: one garment type, one primary crew department (occasionally two for interior/chief-stew).
 */

export const CATEGORY_IDS = [
  'tops', 'shirts', 'epaulettes', 'dresses', 'bottoms', 'chef-wear',
  'engineering', 'spa-wear', 'outerwear', 'shoes', 'accessories',
];

export const categories = [
  { id: 'tops', label: 'Polos & Tees', layer: 20 },
  { id: 'shirts', label: 'Formal Shirts', layer: 22 },
  { id: 'epaulettes', label: 'Epaulettes & Rank', layer: 23 },
  { id: 'dresses', label: 'Dresses', layer: 25 },
  { id: 'bottoms', label: 'Shorts / Skorts / Trousers', layer: 18 },
  { id: 'chef-wear', label: 'Galley Jackets & Aprons', layer: 19 },
  { id: 'engineering', label: 'Engineering Overalls', layer: 17 },
  { id: 'spa-wear', label: 'Spa Tunics', layer: 21 },
  { id: 'outerwear', label: 'Wet Weather & Outerwear', layer: 30 },
  { id: 'shoes', label: 'Footwear', layer: 35 },
  { id: 'accessories', label: 'Accessories', layer: 40 },
];

export const IMAGE_HINT_BY_CATEGORY = {
  tops: 'polo',
  shirts: 'shirt',
  epaulettes: 'epaulettes',
  dresses: 'dress',
  bottoms: 'shorts',
  'chef-wear': 'chef-jacket',
  engineering: 'overalls',
  'spa-wear': 'shirt',
  outerwear: 'jacket',
  shoes: 'shoes',
  accessories: 'cap',
};

export function imageHintForCategory(category) {
  return IMAGE_HINT_BY_CATEGORY[category] || 'polo';
}

function categoryFromSupplierPath(context = '') {
  const path = String(context).toLowerCase();
  if (/\/foul-weather/.test(path)) return 'outerwear';
  if (/\/board-shorts?\//.test(path) || /boardshort/.test(path)) return 'bottoms';
  if (/\/(trousers?|pants|trousers-leggings)\//.test(path) || /-(trousers?|pants)(?:-|$)/.test(path)) return 'bottoms';
  if (/\/(shorts?|skorts?)\//.test(path) || /-(shorts|skorts?)(?:-|$)/.test(path)) return 'bottoms';
  if (/\/polos?\//.test(path) || /-(polos?)(?:-|$)/.test(path)) return 'tops';
  if (/\/(t-shirts?|tees?)\//.test(path) || /-(t-?shirts?|tees?)(?:-|$)/.test(path)) return 'tops';
  if (/\/(sweat-shirts|rugby-shirts|knitwear)\//.test(path) || /-(hoodie|sweatshirt|rugby)/.test(path)) return 'tops';
  if (/\/shirts?\//.test(path) && !/\/(t-shirts?|sweat-shirts|rugby-shirts)\//.test(path)) return 'shirts';
  if (/\/(gilets?|rash-vests?|vests)\//.test(path) || /-(gilet|vest)(?:-|$)/.test(path)) return 'outerwear';
  if (/\/(jackets?|outerwear|softshell|fleece|foul-weather|formal-wear)\//.test(path) || /-(jacket|fleece|softshell)(?:-|$)/.test(path)) return 'outerwear';
  if (/\/dresses?\//.test(path) || /-(dress|dresses)(?:-|$)/.test(path)) return 'dresses';
  if (/\/(footwear|shoes?)\//.test(path)) return 'shoes';
  if (/\/chef\//.test(path)) return 'chef-wear';
  if (/\/(belts|caps|accessories)\//.test(path)) return 'accessories';
  if (/\/epaulettes?\//.test(path)) return 'epaulettes';
  if (/\/spa\//.test(path)) return 'spa-wear';
  if (/\/overalls?\//.test(path)) return 'engineering';
  return null;
}

function productUrlPath(product) {
  return String(product?.productUrl || product?.categoryPath || '');
}

const CONTEXT_CATEGORY_RULES = [
  ['chef-wear', /\b(chef jacket|chef coat|apron)\b/i],
  ['engineering', /\b(overall|boiler suit|coverall)\b/i],
  ['spa-wear', /\b(tunic|spa wear|wellness)\b/i],
  ['outerwear', /\b(jacket|softshell|fleece|foul weather|wet weather|parka|gilet|vest|puffer|windbreaker|blazer)\b/i],
  ['shoes', /\b(shoes?|sneakers?|deck shoe|footwear|loafers?|trainers?|clog|moccasin)\b/i],
  ['accessories', /\b(cap|belt|sunglasses|beanie|scarf|glove|tie|necktie)\b/i],
  ['bottoms', /\b(shorts?|trousers?|pants?|skort|skirt|chino|bermuda)\b/i],
  ['dresses', /\b(dress|gown)\b/i],
  ['tops', /\b(polo|tee|t-shirt|henley|sweater|knit|cardigan|pullover|hoodie|sweatshirt|sweat-shirt|jumper|sweat)\b/i],
  ['shirts', /\b(shirt|blouse|oxford|linen shirt|popeline)\b/i],
];

export function classifyUniformCategory(name, context = '') {
  const title = String(name || '');
  const hay = `${title} ${context}`;

  if (/\b(epaulettes|epaulets)\b/i.test(title) && !/\b(shirt|blouse|polo|dress|top|jacket)\b/i.test(title)) return 'epaulettes';
  if (/\b(coverall|coveralls|overall|boiler suit)\b/i.test(title)) return 'engineering';
  if (/\bdress\s*shirt\b/i.test(title)) return 'shirts';
  if (/\bpolo\s+dress\b/i.test(hay)) return 'dresses';
  if (/\b(dress|gown)\b/i.test(title) && !/\bpolo\s+dress\b/i.test(title)) return 'dresses';
  if (/\b(apron|chef jacket|chef coat)\b/i.test(title)) return 'chef-wear';
  if (/\b(birkenstock|allbirds|clarks|sebago|sperry|havaianas|teva|ecco|keen|tropicfeel)\b/i.test(title)) return 'shoes';
  if (/\b(polo|piqu[eé])\b/i.test(title)) return 'tops';
  if (/\bblouse\b/i.test(title)) return 'shirts';
  if (/\b(tee|t-shirt|tshirt)\b/i.test(title)) return 'tops';
  if (/\bshort\s+sleeve\b/i.test(title) && /\b(polo|piqu[eé]|blouse|shirt|tee|t-shirt)\b/i.test(title)) {
    if (/\b(polo|piqu[eé])\b/i.test(title)) return 'tops';
    if (/\bblouse\b/i.test(title)) return 'shirts';
    if (/\b(tee|t-shirt|tshirt)\b/i.test(title)) return 'tops';
    return 'shirts';
  }

  const urlCategory = categoryFromSupplierPath(context);
  if (urlCategory) return urlCategory;

  if (/\b(tie|necktie)\b/i.test(title)) return 'accessories';
  if (/\bblazer\b/i.test(title)) return 'outerwear';
  if (/\b(chino|trousers?|pants?|skort|skirt|bermuda|flat front|tailored fit|boardshorts?)\b/i.test(title)) return 'bottoms';
  if (/\bshorts\b/i.test(title) && !/\bshort\s+sleeve\b/i.test(title)) return 'bottoms';
  if (/\b(windbreaker|softshell|fleece|foul weather|wet weather|parka|gilet|puffer|vest|jacket)\b/i.test(title)) return 'outerwear';
  if (/\b(shoes?|sneakers?|moccasin|loafers?|footwear|clog)\b/i.test(title)) return 'shoes';
  if (/\b(l\/s|long sleeve)\b/i.test(title)
    && !/\b(polo|tee|t-shirt|henley|hoodie|sweat|jacket|softshell|vest|puffer|blouse|dress)\b/i.test(title)) return 'shirts';
  if (/\bpilot\b/i.test(title) && !/\b(jacket|vest|softshell|puffer)\b/i.test(title)) return 'shirts';
  if (/\bfull zip\b/i.test(title) && !/\b(polo|tee|t-shirt)\b/i.test(title)) {
    if (/\b(cardigan|knit|fleece|sweater|jumper|guernsey)\b/i.test(hay)) return 'tops';
    return 'outerwear';
  }
  if (/\bguernsey\b/i.test(title)) return 'tops';
  if (/\b(tee|t-shirt|tshirt|henley|hoodie|sweatshirt|sweat-shirt|sweater|jumper|cardigan)\b/i.test(title)) return 'tops';

  for (const [id, re] of CONTEXT_CATEGORY_RULES) {
    if (id === 'accessories' && /\bcap\s+sleeve\b/i.test(hay)) continue;
    if (id === 'dresses' && /\bdress\s*shirt\b/i.test(hay)) continue;
    if (id === 'bottoms' && /\b(t-shirt|tee\b|blouse|shirt|jacket|polo)\b/i.test(title)) continue;
    if (id === 'shirts' && /\b(t-shirt|tee\b|polo|henley|sweatshirt|sweat-shirt|hoodie)\b/i.test(hay)) continue;
    if (id === 'outerwear' && /\b(chino|trousers?|pants?|shorts?|skort|skirt)\b/i.test(title)) continue;
    if (re.test(hay)) return id;
  }
  return 'tops';
}

function titleLower(product) {
  const name = typeof product === 'string' ? product : product?.name;
  return String(name || '').toLowerCase();
}

function productContextLower(product) {
  return `${product?.name || ''} ${String(product?.details || '').slice(0, 240)}`.toLowerCase();
}

function productFitGender(product) {
  const fit = product?.fit;
  if (!Array.isArray(fit)) return null;
  const hasWoman = fit.includes('woman');
  const hasMan = fit.includes('man');
  if (hasWoman && !hasMan) return 'woman';
  if (hasMan && !hasWoman) return 'man';
  return null;
}

function isLadies(textOrProduct) {
  if (typeof textOrProduct === 'object' && textOrProduct !== null) {
    const fitGender = productFitGender(textOrProduct);
    if (fitGender === 'woman') return true;
    if (fitGender === 'man') return false;
    textOrProduct = titleLower(textOrProduct);
  }
  const text = String(textOrProduct || '');
  if (/\b(men'?s?|mens|male)\b/i.test(text) && !/\b(women|ladies|womens|female)\b/i.test(text)) return false;
  return /\b(ladies|women'?s?|womens|female)\b/i.test(text)
    || /\bshirt\s+w\b/i.test(text)
    || /\bchino\s+w\b/i.test(text);
}

function isMens(textOrProduct) {
  if (typeof textOrProduct === 'object' && textOrProduct !== null) {
    const fitGender = productFitGender(textOrProduct);
    if (fitGender === 'man') return true;
    if (fitGender === 'woman') return false;
    textOrProduct = titleLower(textOrProduct);
  }
  const title = String(textOrProduct || '');
  return /\b(men'?s?|mens|male)\b/i.test(title) && !isLadies(title);
}

function resolveLadies(product) {
  const fitGender = productFitGender(product);
  if (fitGender === 'woman') return true;
  if (fitGender === 'man') return false;
  const name = titleLower(product);
  if (/\b(men'?s?|mens|male)\b/i.test(name) && !/\b(women|ladies|womens|female)\b/i.test(name)) return false;
  if (/\b(ladies|women'?s?|womens|female)\b/i.test(name)) return true;
  const context = productContextLower(product).replace(/\bmatching ladies\b/g, '');
  return /\b(ladies|women'?s?|womens|female)\b/i.test(context)
    || /\bshirt\s+w\b/i.test(name)
    || /\bchino\s+w\b/i.test(name);
}

export function isOnePieceDress(product) {
  const name = titleLower(product);
  if (/\bpolo\s+dress\b/.test(name)) return true;
  if (/\/dresses?\//i.test(productUrlPath(product))) {
    return !/\b(shirt|jacket|vest|softshell|blouse|skort|tunic|apron)\b/.test(name);
  }
  if (!/\bdress\b/.test(name)) return false;
  if (/\bdress\s*shirt\b/.test(name)) return false;
  if (/\b(shirt|jacket|vest|softshell|blouse|polo|skort|tunic|apron)\b/.test(name)) return false;
  return true;
}

export function isDressShirt(product) {
  return product.category === 'shirts' && /\bdress\s*shirt\b/i.test(product.name);
}

export function isEpauletteShirt(product) {
  if (product.category !== 'shirts') return false;
  return /\b(epaulette|shoulder tabs?|with tabs)\b/i.test(product.name);
}

export function isBlouse(product) {
  return product.category === 'shirts' && /\bblouse\b/i.test(product.name);
}

function isPolo(product) {
  const title = titleLower(product);
  return product.category === 'tops'
    && (
      /\b(polo|piqu[eé])\b/i.test(title)
      || /\/polos?\//i.test(productUrlPath(product))
    );
}

function isTee(product) {
  const title = titleLower(product);
  return product.category === 'tops'
    && (
      (
        /\b(tee|t-shirt|tshirt)\b/i.test(title)
        && !/\b(polo|piqu[eé])\b/i.test(title)
      )
      || (
        /\/(t-shirts?|tees?)\//i.test(productUrlPath(product))
        && !/\b(polo|piqu[eé])\b/i.test(title)
      )
    );
}

function isKnitwear(product) {
  const title = titleLower(product);
  const context = productContextLower(product);
  return product.category === 'tops'
    && (
      /\b(knit|sweater|pullover|cardigan|sweatshirt|sweat-shirt|hoodie|jumper|sweat|guernsey|merino|rugby|blend)\b/i.test(title)
      || /\b(guernsey|channel jumper|quarter[- ]?zip|1\/4 zip|rugby)\b/i.test(context)
      || /(?:^|\s)\/?\d?\/?\s*\d?\s*zip\b/i.test(title)
      || /\/(knitwear|sweat-shirts|rugby-shirts)\//i.test(productUrlPath(product))
      || /-(hoodie|sweatshirt|rugby)/i.test(productUrlPath(product))
    );
}

function isWorkShort(product) {
  const title = titleLower(product);
  return product.category === 'bottoms'
    && (
      /\b(shorts?|bermuda|board shorts?|boardshorts?)\b/i.test(title)
      || /\/(shorts?|board-shorts?)\//i.test(productUrlPath(product))
    )
    && !/\bt-shirt\b/i.test(title);
}

function isDeckTrouser(product) {
  const title = titleLower(product);
  return product.category === 'bottoms'
    && (
      (
        /\b(trouser|trousers|pant|pants|chino)\b/i.test(title)
        && !/\b(shorts?|bermuda|board shorts?|boardshorts?|skort|skirt)\b/i.test(title)
        && !/\bt-shirt\b/i.test(title)
      )
      || /\/(trousers?|pants|trousers-leggings|board-shorts?)\//i.test(productUrlPath(product))
    );
}

function isFormalTrouser(product) {
  const title = titleLower(product);
  return product.category === 'bottoms'
    && /\b(chino|suit pant|elegance pant|cotton pant)\b/i.test(title)
    && !/\b(quick dry|technical|performance|cargo)\b/i.test(title);
}

function isWorkTrouser(product) {
  const title = titleLower(product);
  return product.category === 'bottoms'
    && /\b(trouser|trousers|pant|pants|cargo pant|trs)\b/i.test(title)
    && /\b(quick dry|technical|performance|cargo|legging|channel|offshore|evolution|qd)\b/i.test(title);
}

function isSkortOrSkirt(product) {
  const title = titleLower(product);
  return product.category === 'bottoms' && /\b(skort|skirt)\b/i.test(title);
}

function isSoftshell(product) {
  return product.category === 'outerwear' && /\bsoftshell\b/i.test(titleLower(product));
}

function isBlazer(product) {
  return product.category === 'outerwear' && /\bblazer\b/i.test(titleLower(product));
}

function isVest(product) {
  const title = titleLower(product);
  return product.category === 'outerwear' && (
    /\b(vest|puffer|gilet|rash)\b/i.test(title)
    || /\/(gilets?|rash-vests?|vests)\//i.test(productUrlPath(product))
    || /-(vest|gilet)/i.test(productUrlPath(product))
  );
}

function isFoulWeather(product) {
  const title = titleLower(product);
  return product.category === 'outerwear'
    && (
      /\b(foul|wet weather|windbreaker|hydraplus|offshore|os2|os3|coastal|gore[- ]?tex|sou'?wester|br1|br2|hpx)\b/i.test(title)
      || /\/foul-weather/i.test(productUrlPath(product))
    );
}

function isZipJacket(product) {
  const title = titleLower(product);
  return product.category === 'outerwear'
    && (
      /\bjacket\b/i.test(title)
      || /\bfull zip\b/i.test(title)
      || /\bhalf zip\b/i.test(title)
      || /\b1\/2 zip\b/i.test(title)
    )
    && !isSoftshell(product)
    && !isBlazer(product)
    && !isVest(product)
    && !isFoulWeather(product)
    && !/\bfleece\b/i.test(title);
}

function isTie(product) {
  return product.category === 'accessories' && /\b(tie|necktie)\b/i.test(titleLower(product));
}

function isTechnicalWorkwear(title) {
  return /\b(technical|performance|quick dry|cargo|coverall|coverguard|safety|dickies|engineer)\b/i.test(title);
}

function isEleganceLine(title) {
  return /\belegance\b/i.test(title);
}

function isOfficerKnit(product) {
  const title = titleLower(product);
  return isKnitwear(product)
    && /\b(cardigan|jumper|sweater|merinos)\b/i.test(title)
    && !/\b(hoodie|sweat)\b/i.test(title);
}

const EPAULETTE_RANK_DEPT = {
  Deck: ['deckhand', 'deck', 'captain', 'bosun', 'officer'],
  Engineering: ['engineer', 'engineering'],
  Interior: ['stew', 'stewardess', 'chief-stew', 'chief stewardess'],
  Galley: ['chef'],
};

export const NAV_GROUPS = [
  { id: 'by-supplier', label: 'By Supplier' },
  { id: 'by-brand', label: 'By Brand' },
  { id: 'by-department', label: 'By Department' },
  { id: 'by-category', label: 'By Category' },
];

/** @deprecated use NAV_GROUPS */
export const NAV_SECTION_LABELS = Object.fromEntries(NAV_GROUPS.map((g) => [g.id, g.label]));

export const ALL_SUPPLIERS_NAV_ID = 'all-suppliers';
export const ALL_BRANDS_NAV_ID = 'all-brands';

export const navCategories = [
  { id: ALL_SUPPLIERS_NAV_ID, group: 'by-supplier', label: 'All Suppliers', categories: CATEGORY_IDS, subFilters: ['All'] },
  { id: ALL_BRANDS_NAV_ID, group: 'by-brand', label: 'All Brands', categories: CATEGORY_IDS, subFilters: ['All'] },
  { id: 'bridge', group: 'by-department', label: 'Bridge', departments: ['captain', 'boss'], subFilters: ['All', 'Epaulette Shirts', 'Officer Shirts', 'Shirts', 'Trousers', 'Knitwear', 'Blazers', 'Ties'] },
  { id: 'deck', group: 'by-department', label: 'Deck', departments: ['deck'], subFilters: ['All', 'Polos', 'T-Shirts', 'Shorts', 'Trousers', 'Knitwear', 'Softshell', 'Jackets', 'Fleece', 'Vests', 'Foul Weather'] },
  { id: 'engineering', group: 'by-department', label: 'Engineering', departments: ['engineer'], subFilters: ['All', 'Overalls', 'Polos', 'T-Shirts', 'Shorts', 'Trousers', 'Shoes'] },
  { id: 'interior', group: 'by-department', label: 'Interior', departments: ['interior', 'chief-stew'], subFilters: ['All', 'Dresses', 'Skorts', 'Blouses', 'Dress Shirts', 'Polos', 'T-Shirts', 'Shorts', 'Trousers', 'Knitwear', 'Softshell', 'Jackets', 'Fleece', 'Vests', 'Foul Weather', 'Blazers'] },
  { id: 'galley', group: 'by-department', label: 'Galley', departments: ['chef'], subFilters: ['All', 'Jackets', 'Shirts', 'Tunics', 'Trousers', 'Aprons', 'Shoes'] },
  { id: 'spa', group: 'by-department', label: 'Spa', departments: ['spa'], subFilters: ['All', 'Tunics', 'Trousers'] },
  { id: 'footwear', group: 'by-category', label: 'Footwear', categories: ['shoes'], subFilters: ['All', 'Deck', 'Interior', 'Galley', 'Non-Marking'] },
  { id: 'accessories', group: 'by-category', label: 'Accessories', categories: ['accessories'], subFilters: ['All', 'Sunglasses', 'Belts', 'Hats', 'Watches', 'Ties'] },
  { id: 'polos', group: 'by-category', label: 'Polos', matchType: 'polo', subFilters: ['All'] },
  { id: 'tees', group: 'by-category', label: 'T-Shirts', matchType: 'tee', subFilters: ['All'] },
  { id: 'cat-shirts', group: 'by-category', label: 'Shirts', matchType: 'shirts', subFilters: ['All', 'Epaulette Shirts', 'Officer Shirts', 'Dress Shirts', 'Blouses', 'Deck Shirts', 'Shirts'] },
  { id: 'cat-dresses', group: 'by-category', label: 'Dresses', matchType: 'dresses', bodyTypes: ['woman'], subFilters: ['All'] },
  { id: 'cat-shorts', group: 'by-category', label: 'Shorts', matchType: 'shorts', subFilters: ['All'] },
  { id: 'cat-trousers', group: 'by-category', label: 'Trousers', matchType: 'trousers', subFilters: ['All'] },
  { id: 'knitwear-garment', group: 'by-category', label: 'Knitwear', matchType: 'knitwear', subFilters: ['All'] },
  { id: 'skorts-garment', group: 'by-category', label: 'Skorts & Skirts', matchType: 'skorts', bodyTypes: ['woman'], subFilters: ['All'] },
  { id: 'outerwear', group: 'by-category', label: 'Outerwear', categories: ['outerwear'], subFilters: ['All', 'Softshell', 'Jackets', 'Fleece', 'Foul Weather', 'Vests', 'Blazers'] },
  { id: 'epaulettes', group: 'by-category', label: 'Epaulettes & Rank', categories: ['epaulettes'], subFilters: ['All', 'Deck', 'Engineering', 'Interior', 'Galley'] },
  { id: 'overalls-garment', group: 'by-category', label: 'Overalls', categories: ['engineering'], subFilters: ['All'] },
  { id: 'chef-garment', group: 'by-category', label: 'Chef Wear', categories: ['chef-wear'], subFilters: ['All', 'Jackets', 'Aprons', 'Tunics', 'Trousers', 'Shoes'] },
  { id: 'spa-garment', group: 'by-category', label: 'Spa Wear', categories: ['spa-wear'], subFilters: ['All', 'Tunics', 'Trousers'] },
];

const MATCH_TYPE_MATCHERS = {
  polo: isPolo,
  tee: isTee,
  shirts: (p) => {
    if (p.category === 'chef-wear' && /\bshirt\b/i.test(titleLower(p))) return true;
    return p.category === 'shirts';
  },
  dresses: (p) => p.category === 'dresses' && isOnePieceDress(p),
  shorts: isWorkShort,
  trousers: (p) => isFormalTrouser(p) || isWorkTrouser(p) || isDeckTrouser(p),
  knitwear: isKnitwear,
  skorts: isSkortOrSkirt,
};

const FEMALE_ONLY_SUBFILTERS = new Set(['Blouses', 'Dresses', 'Skorts']);

export function navItemVisibleForBodyType(nav, bodyType = 'woman') {
  if (nav.bodyTypes?.length && !nav.bodyTypes.includes(bodyType)) return false;
  return true;
}

export function subFilterVisibleForBodyType(subFilter, bodyType = 'woman') {
  if (bodyType === 'man' && FEMALE_ONLY_SUBFILTERS.has(subFilter)) return false;
  return true;
}

export function navGroupForCategoryId(catId) {
  return navCategories.find((n) => n.id === catId)?.group || null;
}

export const DEPARTMENT_CATEGORIES = {
  bridge: ['shirts', 'tops', 'bottoms', 'outerwear', 'accessories'],
  deck: ['tops', 'bottoms', 'outerwear'],
  engineering: ['tops', 'bottoms', 'engineering', 'outerwear', 'shoes'],
  interior: ['tops', 'shirts', 'bottoms', 'dresses', 'outerwear'],
  galley: ['chef-wear', 'bottoms', 'shoes'],
  spa: ['spa-wear', 'bottoms'],
};

const SUBFILTER_MATCHERS = {
  'Epaulette Shirts': isEpauletteShirt,
  'Officer Shirts': (p) => {
    if (p.category !== 'shirts' || isEpauletteShirt(p) || isBlouse(p)) return false;
    const title = titleLower(p);
    if (/\bdeck\b/i.test(title)) return false;
    return isDressShirt(p)
      || isMens(title)
      || /\b(pilot shirt|oxford|popeline|poplin|mandarin)\b/i.test(title);
  },
  Shirts: (p) => {
    if (p.category === 'chef-wear' && /\bshirt\b/i.test(titleLower(p))) return true;
    if (p.category !== 'shirts' || isEpauletteShirt(p) || isBlouse(p) || isDressShirt(p)) return false;
    return !/\bdeck\b/i.test(titleLower(p));
  },
  Knitwear: isKnitwear,
  Blazers: isBlazer,
  Ties: isTie,
  Polos: isPolo,
  'T-Shirts': isTee,
  Shorts: isWorkShort,
  'Deck Shirts': isDeckWorkShirt,
  Overalls: (p) => p.category === 'engineering',
  Softshell: isSoftshell,
  Dresses: (p) => p.category === 'dresses' && isOnePieceDress(p),
  Skorts: isSkortOrSkirt,
  Blouses: isBlouse,
  'Dress Shirts': isDressShirt,
  Jackets: (p) => {
    if (p.category === 'chef-wear') {
      const title = titleLower(p);
      const ctx = `${title} ${productContextLower(p)}`;
      if (/\b(trouser|pants|apron|tunic)\b/i.test(title)) return false;
      return /\b(jacket|coat|jkt)\b/i.test(ctx);
    }
    if (p.category !== 'outerwear') return false;
    const title = titleLower(p);
    return isZipJacket(p) || isSoftshell(p) || isBlazer(p) || isFoulWeather(p)
      || /\bjacket\b/i.test(title)
      || /\bjkt\b/i.test(title)
      || (
        /\/(jackets?|formal-wear)\//i.test(productUrlPath(p))
        && !isVest(p) && !/\bfleece\b/i.test(title)
      );
  },
  Tunics: (p) => (p.category === 'spa-wear' || p.category === 'chef-wear') && /\btunic\b/i.test(titleLower(p)),
  Fleece: (p) => p.category === 'outerwear' && (
    /\bfleece\b/i.test(titleLower(p))
    || /\/fleece\//i.test(productUrlPath(p))
    || /-fleece/i.test(productUrlPath(p))
    || /\bfleece\b/i.test(productContextLower(p))
  ),
  Aprons: (p) => p.category === 'chef-wear' && /\baprons?\b/i.test(titleLower(p)),
  Shoes: (p) => p.category === 'shoes' || (p.category === 'chef-wear' && /\b(clog|shoe|moccasin|birkenstock)\b/i.test(titleLower(p))),
  Trousers: (p) => isFormalTrouser(p) || isWorkTrouser(p),
  Jacket: (p) => isZipJacket(p) || (p.category === 'outerwear' && /\bjacket\b/i.test(titleLower(p)) && !isSoftshell(p) && !isBlazer(p) && !isVest(p) && !/\bfleece\b/i.test(titleLower(p)) && !isFoulWeather(p)),
  'Foul Weather': isFoulWeather,
  Vests: isVest,
  'Non-Marking': (p) => p.category === 'shoes' && /\bnon[- ]?mark/i.test(titleLower(p)),
  Caps: (p) => p.category === 'accessories' && /\bcap\b/i.test(titleLower(p)),
  Hats: (p) => p.category === 'accessories' && /\b(cap|hat|beanie)\b/i.test(titleLower(p)),
  Watches: (p) => p.category === 'accessories' && /\bwatch/i.test(titleLower(p)),
  Belts: (p) => p.category === 'accessories' && /\bbelt\b/i.test(titleLower(p)),
  Sunglasses: (p) => p.category === 'accessories' && /\bsunglass/i.test(titleLower(p)),
  Deck: (p) => p.category === 'shoes' && /\b(deck|anchor|sneaker|yacht crew|all-terrain|at lite|at hdry|tropicfeel|coverguard|safety)\b/i.test(titleLower(p)),
  Interior: (p) => p.category === 'shoes' && /\b(ballerina|casual leather|sunset)\b/i.test(titleLower(p)),
  Galley: (p) => p.category === 'shoes' && /\b(chef|galley|kitchen|moccasin)\b/i.test(titleLower(p)),
};

function isDeckWorkShirt(product) {
  return product.category === 'shirts'
    && !isDressShirt(product)
    && !isBlouse(product)
    && !isEpauletteShirt(product);
}

/** One primary crew department per item (interior + chief-stew may pair). */
export function inferDepartmentTags(product) {
  const cat = product.category;
  const title = titleLower(product);
  const ladies = resolveLadies(product);

  if (cat === 'epaulettes') return [];

  if (cat === 'engineering') return ['engineer'];
  if (cat === 'chef-wear') return ['chef'];
  if (cat === 'spa-wear') return ['spa'];
  if (cat === 'dresses') return ['interior', 'chief-stew'];

  if (cat === 'shoes') {
    if (/\b(chef|galley|kitchen|moccasin)\b/i.test(title)) return ['chef'];
    if (/\b(ballerina|casual leather|sunset)\b/i.test(title)) return ['interior', 'chief-stew'];
    if (/\b(safety|coverguard)\b/i.test(title)) return ['engineer'];
    return ['deck'];
  }

  if (cat === 'accessories') {
    if (/\b(tie|necktie)\b/i.test(title)) return ['captain'];
    return ['deck'];
  }

  if (cat === 'outerwear') {
    if (/\bblazer\b/i.test(title)) return ['captain', 'interior', 'chief-stew'];
    return ladies ? ['interior', 'chief-stew'] : ['deck'];
  }

  if (cat === 'shirts') {
    if (/\bdeck\b/i.test(title)) return ladies ? ['interior', 'chief-stew'] : ['deck'];
    if (isEpauletteShirt(product)) return ['captain'];
    if (isBlouse(product)) return ['interior', 'chief-stew'];
    if (isDressShirt(product)) {
      return ladies ? ['captain', 'interior', 'chief-stew'] : ['captain'];
    }
    if (/\bmandarin\b/i.test(title)) return ['captain'];
    return ladies ? ['interior', 'chief-stew'] : ['captain'];
  }

  if (cat === 'tops') {
    if (/\b(polo|piqu)/i.test(title)) {
      if (isTechnicalWorkwear(title)) return ['engineer'];
      return ladies ? ['interior', 'chief-stew'] : ['deck'];
    }
    if (isOfficerKnit(product)) return ladies ? ['interior', 'chief-stew'] : ['captain'];
    if (isKnitwear(product)) return ladies ? ['interior', 'chief-stew'] : ['deck'];
    if (isTechnicalWorkwear(title)) return ['engineer'];
    return ladies ? ['interior', 'chief-stew'] : ['deck'];
  }

  if (cat === 'bottoms') {
    if (/\bdeck\b/i.test(title)) return ladies ? ['interior', 'chief-stew'] : ['deck'];
    if (/\b(chef|galley)\b/i.test(title)) return ['chef'];
    if (/\b(skort|skirt)\b/i.test(title)) return ['interior', 'chief-stew'];
    if (isEleganceLine(title)) {
      if (/\b(bermuda|short)\b/i.test(title)) {
        return ladies ? ['interior', 'chief-stew'] : ['deck'];
      }
      return ladies ? ['interior', 'chief-stew'] : ['captain'];
    }
    if (/\b(bermuda|shorts?|board shorts?)\b/i.test(title) && !/\bt-shirt\b/i.test(title)) {
      if (isTechnicalWorkwear(title)) return ['engineer'];
      return ladies ? ['interior', 'chief-stew'] : ['deck'];
    }
    if (/\b(quick dry|technical|performance|cargo)\b/i.test(title)) {
      return ladies ? ['interior', 'chief-stew'] : ['engineer'];
    }
    if (/\b(chino|suit pant|elegance pant|cotton pant)\b/i.test(title)) {
      return ladies ? ['interior', 'chief-stew'] : ['captain'];
    }
    return ladies ? ['interior', 'chief-stew'] : ['deck'];
  }

  return ['deck'];
}

export function productMatchesNav(product, nav) {
  if (nav.matchType) {
    const matcher = MATCH_TYPE_MATCHERS[nav.matchType];
    return matcher ? matcher(product) : false;
  }
  if (nav.categories?.length) return nav.categories.includes(product.category);
  if (!nav.departments?.length) return true;

  if (product.category === 'epaulettes') return false;

  const allowed = DEPARTMENT_CATEGORIES[nav.id];
  if (allowed && !allowed.includes(product.category)) return false;

  if (product.category === 'accessories') {
    if (isTie(product)) return nav.id === 'bridge';
    return false;
  }

  if (product.category === 'shoes') {
    if (nav.id === 'galley') return (product.roleTags || []).includes('chef');
    if (nav.id === 'engineering') return (product.roleTags || []).includes('engineer');
    return false;
  }

  if (product.category === 'shirts' && nav.id === 'deck') return false;

  const tags = product.roleTags || [];
  if (!tags.length) return false;

  const deptSet = new Set(nav.departments);
  if (deptSet.has('captain')) deptSet.add('boss');
  return tags.some((t) => deptSet.has(t));
}

function navSubFilters(navId) {
  const nav = navCategories.find((n) => n.id === navId);
  if (!nav?.subFilters?.length) return null;
  const subs = nav.subFilters.filter((s) => s !== 'All');
  return subs.length ? subs : null;
}

export function productMatchesSubFilter(product, subFilter, navId = '') {
  if (!subFilter || subFilter === 'All') {
    const subs = navSubFilters(navId);
    if (subs) {
      return subs.some((s) => productMatchesSubFilter(product, s, navId));
    }
    const nav = navCategories.find((n) => n.id === navId);
    if (nav?.matchType) {
      const matcher = MATCH_TYPE_MATCHERS[nav.matchType];
      return matcher ? matcher(product) : true;
    }
    return true;
  }

  if (navId === 'epaulettes' && EPAULETTE_RANK_DEPT[subFilter]) {
    if (product.category !== 'epaulettes') return false;
    const title = titleLower(product);
    return EPAULETTE_RANK_DEPT[subFilter].some((term) => title.includes(term));
  }

  if (subFilter === 'Trousers') {
    if (navId === 'cat-trousers') {
      return isFormalTrouser(product) || isWorkTrouser(product) || isDeckTrouser(product);
    }
    if (navId === 'bridge') return isFormalTrouser(product) && !isLadies(productContextLower(product));
    if (navId === 'interior') {
      return isFormalTrouser(product)
        || (resolveLadies(product) && (isWorkTrouser(product) || isDeckTrouser(product)));
    }
    if (navId === 'engineering' || navId === 'deck') {
      return isWorkTrouser(product) || isDeckTrouser(product);
    }
    if (navId === 'galley' || navId === 'spa') {
      if (navId === 'galley') {
        return (product.category === 'bottoms' || product.category === 'chef-wear')
          && (product.roleTags || []).includes('chef')
          && /\b(pant|pants|trouser|trousers|trs|baggy|drawstring)\b/i.test(
            `${titleLower(product)} ${productUrlPath(product)} ${productContextLower(product)}`,
          );
      }
      return product.category === 'bottoms' && (product.roleTags || []).includes('spa');
    }
    return isFormalTrouser(product) || isWorkTrouser(product);
  }

  const matcher = SUBFILTER_MATCHERS[subFilter];
  return matcher ? matcher(product) : true;
}

export function catalogNavForProduct(product) {
  const byCategory = (id) => navCategories.find((n) => n.id === id);

  if (isPolo(product)) {
    const nav = byCategory('polos');
    if (nav) return nav.id;
  }
  if (isTee(product)) {
    const nav = byCategory('tees');
    if (nav) return nav.id;
  }
  if (isKnitwear(product)) {
    const nav = byCategory('knitwear-garment');
    if (nav) return nav.id;
  }
  if (isWorkShort(product)) {
    const nav = byCategory('cat-shorts');
    if (nav) return nav.id;
  }
  if (isSkortOrSkirt(product)) {
    const nav = byCategory('skorts-garment');
    if (nav) return nav.id;
  }
  if (product.category === 'dresses' && isOnePieceDress(product)) return 'cat-dresses';
  if (product.category === 'engineering') return 'overalls-garment';
  if (product.category === 'chef-wear') return 'chef-garment';
  if (product.category === 'spa-wear') return 'spa-garment';
  if (product.category === 'shirts') return 'cat-shirts';
  if (isFormalTrouser(product) || isWorkTrouser(product) || isDeckTrouser(product)) {
    const nav = byCategory('cat-trousers');
    if (nav) return nav.id;
  }

  const categoryNav = navCategories.find((n) =>
    n.group === 'by-category'
    && n.categories?.includes(product.category),
  );
  if (categoryNav) return categoryNav.id;

  const tags = product.roleTags || [];
  if (tags.length) {
    const deptNav = navCategories.find((n) => {
      if (n.group !== 'by-department' || !n.departments?.length) return false;
      const deptSet = new Set(n.departments);
      if (deptSet.has('captain')) deptSet.add('boss');
      return tags.some((t) => deptSet.has(t));
    });
    if (deptNav) return deptNav.id;
  }

  return navCategories.find((n) => n.group === 'by-department')?.id || ALL_SUPPLIERS_NAV_ID;
}

export function normalizeUniformProduct(product) {
  const context = [product.productUrl, product.categoryPath, product.details].filter(Boolean).join(' ');
  const category = classifyUniformCategory(product.name, context);
  return {
    ...product,
    category,
    imageHint: imageHintForCategory(category),
    roleTags: inferDepartmentTags({ ...product, category }),
  };
}

export function validateUniformProduct(product) {
  const issues = [];
  const title = product.name || '';
  const context = [product.productUrl, product.categoryPath, product.details].filter(Boolean).join(' ');
  const expected = classifyUniformCategory(title, context);

  if (product.category !== expected) issues.push(`category should be ${expected}, got ${product.category}`);
  if (product.category === 'dresses' && !isOnePieceDress(product)) issues.push('not a one-piece dress');
  if (isDressShirt(product) && (product.roleTags || []).includes('deck')) issues.push('dress shirt must not be tagged deck');
  if (isDressShirt(product) && (product.roleTags || []).includes('engineer')) issues.push('dress shirt must not be tagged engineer');
  if (isBlouse(product) && (product.roleTags || []).includes('deck')) issues.push('blouse must not be tagged deck');
  if ((product.roleTags || []).includes('deck') && (product.roleTags || []).includes('engineer')) {
    issues.push('cannot tag both deck and engineer');
  }
  if (product.category === 'engineering' && !(product.roleTags || []).includes('engineer')) issues.push('overalls must be engineer only');
  if (!product.roleTags?.length && product.category !== 'epaulettes') issues.push('missing roleTags');

  const inferred = inferDepartmentTags(product);
  for (const tag of inferred) {
    if (!(product.roleTags || []).includes(tag)) issues.push(`missing roleTag: ${tag}`);
  }
  for (const tag of product.roleTags || []) {
    if (!inferred.includes(tag)) issues.push(`extra roleTag: ${tag}`);
  }
  return issues;
}

export function validateUniformCatalog(products = []) {
  const issues = [];
  for (const product of products) {
    for (const msg of validateUniformProduct(product)) issues.push(`${product.name}: ${msg}`);
  }

  for (const nav of navCategories) {
    if (nav.group !== 'by-department' || !nav.departments) continue;
    const visible = products.filter((p) => productMatchesNav(p, nav));
    for (const sub of nav.subFilters) {
      if (sub === 'All') continue;
      const filtered = visible.filter((p) => productMatchesSubFilter(p, sub, nav.id));
      if (sub === 'Overalls' && filtered.some((p) => p.category !== 'engineering')) {
        issues.push(`${nav.label}/${sub} has non-overalls`);
      }
      if (sub === 'Dresses' && filtered.some((p) => !isOnePieceDress(p))) {
        issues.push(`${nav.label}/${sub} has non-dresses`);
      }
      if (sub === 'Polos' && filtered.some((p) => !isPolo(p))) {
        issues.push(`${nav.label}/${sub} has non-polos: ${filtered.filter((p) => !isPolo(p)).map((p) => p.name).join(', ')}`);
      }
      if (sub === 'T-Shirts' && filtered.some((p) => !isTee(p))) {
        issues.push(`${nav.label}/${sub} has non-tees: ${filtered.filter((p) => !isTee(p)).map((p) => p.name).join(', ')}`);
      }
      if (sub === 'Epaulette Shirts' && filtered.some((p) => !isEpauletteShirt(p))) {
        issues.push(`${nav.label}/${sub} has non-epaulette shirts`);
      }
      if (sub === 'Dress Shirts' && filtered.some((p) => !isDressShirt(p))) {
        issues.push(`${nav.label}/${sub} has non-dress shirts`);
      }
      if (sub === 'Blouses' && filtered.some((p) => !isBlouse(p))) {
        issues.push(`${nav.label}/${sub} has non-blouses`);
      }
      if (sub === 'Shirts' && filtered.some((p) => isDressShirt(p) || isBlouse(p))) {
        issues.push(`${nav.label}/${sub} has formal/blouse shirts`);
      }
    }
    for (const p of visible) {
      const ladies = resolveLadies(p);
      const mens = isMens(p);
      if (nav.id === 'deck' && ladies) issues.push(`Deck nav shows ladies item: ${p.name}`);
      if (nav.id === 'interior' && mens && !isBlazer(p)) issues.push(`Interior nav shows mens item: ${p.name}`);
      if (nav.id === 'bridge' && ladies && !isDressShirt(p) && !isBlouse(p) && !isEpauletteShirt(p) && !isBlazer(p) && !isTie(p)) {
        issues.push(`Bridge nav shows ladies non-officer item: ${p.name}`);
      }
      if (isDressShirt(p) && nav.id === 'deck') issues.push(`Deck nav shows dress shirt: ${p.name}`);
      if (isBlouse(p) && (nav.id === 'deck' || nav.id === 'engineering')) {
        issues.push(`${nav.label} nav shows blouse: ${p.name}`);
      }
      if (p.category === 'epaulettes') issues.push(`${nav.label} nav shows rank epaulettes: ${p.name}`);
      const subs = nav.subFilters.filter((s) => s !== 'All');
      const matchesAny = subs.some((s) => productMatchesSubFilter(p, s, nav.id));
      if (!matchesAny) issues.push(`${nav.label} orphan (no sub-filter): ${p.name}`);
    }
  }
  return issues;
}
