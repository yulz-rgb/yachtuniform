import { describe, it, expect } from 'vitest';
import {
  parseProductsFromCatalogText,
  extractJsonLdProducts,
  extractProductsFromHtml,
  extractEshopListingProducts,
  extractProductDetailPrice,
  enrichRecordsWithDetailPrices,
  guessCategory,
  brandFromHostname,
  isSafeFetchUrl,
  isUniformCatalogRecord,
  filterUniformCatalogRecords,
} from './catalogExtract';

describe('isUniformCatalogRecord', () => {
  it('keeps crew garments and accessories', () => {
    expect(isUniformCatalogRecord({ name: 'Logo Crew Cap' })).toBe(true);
    expect(isUniformCatalogRecord({ name: 'Men\'s Quick Dry Polo' })).toBe(true);
    expect(isUniformCatalogRecord({ name: 'Classic Leather Belt' })).toBe(true);
    expect(isUniformCatalogRecord({ name: 'Panel Polyester Cap' })).toBe(true);
  });

  it('drops non-uniform supplier lines', () => {
    const excluded = [
      'Kids Cotton Cap',
      'Bath Towel Bio 150x100cm',
      'Waterproof shoulder bag',
      'Jute beach bag',
      'Panama Hat',
      'Marbella Straw Hat',
      'Cargo Bob Hat',
      'Outback Hat UPF 50+',
      'Storm Umbrella',
      'Satin Scarf',
      'Square Bandana',
      'Men\'s Short Sleeve Rash Guard',
      'Men\'s Swim Shorts',
      'Crocs Shoes',
      'Customization',
      'logo embroidery',
      'Embroidery Text (6.90€)',
      'Add my own logo ?',
      'Item Personalization',
      'Do you want to import your logo?',
    ];
    for (const name of excluded) {
      expect(isUniformCatalogRecord({ name })).toBe(false);
    }
  });
});

describe('filterUniformCatalogRecords', () => {
  it('removes non-uniform rows from mixed lists', () => {
    const rows = [
      { name: 'Deck Polo' },
      { name: 'Kids Cotton Cap' },
      { name: 'Bath Towel Bio 150x100cm' },
    ];
    expect(filterUniformCatalogRecords(rows).map((r) => r.name)).toEqual(['Deck Polo']);
  });
});

describe('parseProductsFromCatalogText', () => {
  it('extracts name and price from catalog lines', () => {
    const text = `
      Technical Crew Polo    €52.00
      Stretch Deck Shorts    EUR 64
      Service Dress — £118
    `;
    const rows = parseProductsFromCatalogText(text, { brand: 'Gill' });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].name).toContain('Technical Crew Polo');
    expect(rows[0].price).toBe(52);
    expect(rows[0].brand).toBe('Gill');
  });

  it('pairs name line with price on next line', () => {
    const text = 'Logo Crew Cap\n€18.00\nNon-Marking Deck Shoe\n89 EUR';
    const rows = parseProductsFromCatalogText(text);
    expect(rows.some((r) => r.name.includes('Logo Crew Cap') && r.price === 18)).toBe(true);
  });
});

describe('extractJsonLdProducts', () => {
  it('reads Product schema blocks', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Deck Polo","offers":{"price":"45","priceCurrency":"EUR"},"brand":"Musto"}</script>`;
    const rows = extractJsonLdProducts(html);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Deck Polo');
    expect(rows[0].price).toBe(45);
  });
});

describe('extractProductsFromHtml', () => {
  it('falls back to text extraction', () => {
    const html = '<html><body><p>Softshell Jacket €120</p></body></html>';
    const { records, method } = extractProductsFromHtml(html, 'https://www.musto.com/catalog');
    expect(records.length).toBeGreaterThan(0);
    expect(method).toBe('text');
    expect(records[0].brand).toBe('Musto');
  });

  it('extracts Joomla EShop category grids without on-page prices', () => {
    const html = `
      <html lang="en-gb"><body>
      <div id="products-list-container">
        <div id="product_list">
          <ul>
            <li><div class="uk-panel"><h2>Slam Deck Light Cargo</h2>
              <a href="/clothing/mens/shorts/slam-deck-light-cargo-short" title="Slam Deck Light Cargo">
              <img src="/media/com_eshop/products/resized/test-210x210.JPG" alt="Slam Deck Light Cargo"/></a></div></li>
            <li><div class="uk-panel"><h2>Gill UV Stretch</h2>
              <a href="/clothing/mens/shorts/gill-uv-stretch" title="Gill UV Stretch">
              <img src="/media/com_eshop/products/resized/uv-210x210.JPG" alt="Gill UV Stretch"/></a></div></li>
          </ul>
        </div>
      </div>
      <p>All prices are ex VAT</p>
      </body></html>
    `;
    const { records, method, needsPriceEnrichment } = extractProductsFromHtml(
      html,
      'https://www.thesuperyachtshop.com/clothing/mens/shorts',
    );
    expect(method).toBe('eshop-listing');
    expect(needsPriceEnrichment).toBe(true);
    expect(records).toHaveLength(2);
    expect(records[0].name).toBe('Slam Deck Light Cargo');
    expect(records[0].currency).toBe('GBP');
    expect(records[0].productUrl).toContain('slam-deck-light-cargo-short');
  });
});

describe('extractEshopListingProducts', () => {
  it('parses product cards from listing HTML', () => {
    const cards = extractEshopListingProducts(
      '<div id="product_list"><ul><li><h2>Deck Short</h2><a href="/p/deck"><img src="/img.jpg"/></a></li></ul></div>',
      'https://shop.example.com/cat',
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe('Deck Short');
    expect(cards[0].productUrl).toBe('https://shop.example.com/p/deck');
  });
});

describe('extractProductDetailPrice', () => {
  it('reads price spans with HTML entities', () => {
    const { price, currency } = extractProductDetailPrice('<span class="price">&pound;66.65</span>');
    expect(price).toBe(66.65);
    expect(currency).toBe('GBP');
  });
});

describe('enrichRecordsWithDetailPrices', () => {
  it('fetches detail pages and merges prices', async () => {
    const records = [{
      name: 'Deck Short',
      price: 0,
      currency: 'GBP',
      productUrl: 'https://shop.example.com/p/deck',
    }];
    const fetchHtml = async (url) => {
      expect(url).toBe('https://shop.example.com/p/deck');
      return '<span class="price">£42.00</span>';
    };
    const enriched = await enrichRecordsWithDetailPrices(records, fetchHtml);
    expect(enriched[0].price).toBe(42);
    expect(enriched[0].productUrl).toBe('https://shop.example.com/p/deck');
  });
});

describe('guessCategory', () => {
  it('maps keywords to categories', () => {
    expect(guessCategory('Non-marking deck shoe')).toBe('shoes');
    expect(guessCategory('Chief stew service dress')).toBe('dresses');
  });
});

describe('supplierNameFromUrl', () => {
  it('maps known supplier hosts', async () => {
    const { supplierNameFromUrl } = await import('./catalogExtract');
    expect(supplierNameFromUrl('https://www.marinayachtwear.com/')).toBe('Marina Yacht Wear');
  });
});

describe('brandFromHostname', () => {
  it('derives brand from URL', () => {
    expect(brandFromHostname('https://www.gillmarine.com/polos')).toBe('Gillmarine');
  });
});

describe('isSafeFetchUrl', () => {
  it('allows public https URLs', () => {
    expect(isSafeFetchUrl('https://supplier.example/catalog')).toBe(true);
  });
  it('blocks localhost', () => {
    expect(isSafeFetchUrl('http://localhost:3000')).toBe(false);
  });
});

describe('fetchAllShopifyProducts', () => {
  it('paginates until an empty page', async () => {
    const { fetchAllShopifyProducts } = await import('./catalogExtract');
    const calls = [];
    const fetchJson = async (url) => {
      calls.push(url);
      if (url.includes('page=1')) return { products: [{ title: 'A', variants: [{ price: '1' }], handle: 'a' }] };
      return { products: [] };
    };
    const products = await fetchAllShopifyProducts('https://shop.example.com', fetchJson, { pageSize: 50 });
    expect(products).toHaveLength(1);
    expect(calls[0]).toContain('limit=50');
  });
});

describe('shopifyProductToRecord', () => {
  it('maps Shopify product JSON to catalog rows', async () => {
    const { shopifyProductToRecord } = await import('./catalogExtract');
    const row = shopifyProductToRecord({
      title: 'B&C Ladies Cotton T-shirt',
      vendor: 'B&C',
      handle: 'b-c-ladies-cotton-t-shirt',
      body_html: '<p><strong>Material:</strong> 100% cotton jersey</p>',
      product_type: 'Resell',
      options: [
        { name: 'Couleur', values: ['White', 'Navy'] },
        { name: 'Taille', values: ['XS', 'S', 'M', 'L', 'XL'] },
      ],
      variants: [
        { id: 1, option1: 'White', option2: 'S', price: '8.50', title: 'White / S' },
        { id: 2, option1: 'Navy', option2: 'S', price: '8.50', title: 'Navy / S' },
      ],
      images: [
        { src: 'https://cdn.example.com/lifestyle.png', variant_ids: [] },
        { src: 'https://cdn.example.com/white-shirt.png', variant_ids: [1] },
        { src: 'https://cdn.example.com/navy-shirt.png', variant_ids: [2] },
      ],
    }, 'Marina Yacht Wear', 'https://www.marinayachtwear.com');
    expect(row.name).toBe('B&C Ladies Cotton T-shirt');
    expect(row.brand).toBe('B&C');
    expect(row.supplierName).toBe('Marina Yacht Wear');
    expect(row.productUrl).toBe('https://www.marinayachtwear.com/products/b-c-ladies-cotton-t-shirt');
    expect(row.price).toBe(8.5);
    expect(row.currency).toBe('EUR');
    expect(row.colours).toBe('White|Navy');
    expect(row.sizeRange).toBe('XS–XL');
    expect(row.fabric).toBe('100% cotton jersey');
    expect(row.imageUrl).toContain('white-shirt.png');
    expect(row.colourImages).toContain('white-shirt.png');
    expect(row.colourImages).toContain('navy-shirt.png');
    expect(row.fit).toBe('woman');
  });
});
