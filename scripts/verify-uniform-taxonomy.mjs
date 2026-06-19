#!/usr/bin/env node
/** Human-logic audit: categories, department tags, and nav filters for all uniform products. */
import { marinaProducts } from '../lib/marinaCatalog.js';
import { superyachtProducts } from '../lib/superyachtCatalog.js';
import { smallwoodsProducts } from '../lib/smallwoodsCatalog.js';
import { filterUniformCatalogRecords } from '../lib/catalogExtract.js';
import {
  categories,
  navCategories,
  validateUniformCatalog,
  productMatchesNav,
  productMatchesSubFilter,
} from '../lib/uniformTaxonomy.js';

let failed = 0;

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function fail(msg) {
  failed += 1;
  console.error(`✗ ${msg}`);
}

const allProducts = filterUniformCatalogRecords([...marinaProducts, ...superyachtProducts, ...smallwoodsProducts]);

const issues = validateUniformCatalog(allProducts);
if (issues.length) {
  fail(`${issues.length} product/nav taxonomy issue(s)`);
  issues.slice(0, 20).forEach((i) => console.error(`  ${i}`));
  if (issues.length > 20) console.error(`  … and ${issues.length - 20} more`);
} else {
  ok(`All ${allProducts.length} products pass taxonomy validation`);
}

const byCat = Object.fromEntries(categories.map((c) => [c.id, 0]));
for (const p of allProducts) byCat[p.category] = (byCat[p.category] || 0) + 1;

console.log('\nCategory inventory:');
for (const c of categories) {
  console.log(`  ${c.label.padEnd(28)} ${byCat[c.id] || 0}`);
}

console.log('\nDepartment nav (with roleTags):');
for (const nav of navCategories.filter((n) => n.departments)) {
  const count = allProducts.filter(
    (p) => productMatchesNav(p, nav) && productMatchesSubFilter(p, 'All', nav.id),
  ).length;
  console.log(`  ${nav.label.padEnd(14)} ${count} items`);
  for (const sub of nav.subFilters.slice(1)) {
    const n = allProducts.filter(
      (p) => productMatchesNav(p, nav) && productMatchesSubFilter(p, sub, nav.id),
    ).length;
    if (n) console.log(`    ${sub.padEnd(18)} ${n}`);
  }
}

console.log('\nShared catalog nav:');
for (const nav of navCategories.filter((n) => n.categories)) {
  const count = allProducts.filter((p) => productMatchesNav(p, nav)).length;
  console.log(`  ${nav.label.padEnd(28)} ${count}`);
}

const tagged = allProducts.filter((p) => p.roleTags?.length || p.category === 'epaulettes').length;
if (tagged === allProducts.length) ok('Every product has department tags (or is rank epaulettes)');
else fail(`Only ${tagged}/${allProducts.length} products have department organization`);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll taxonomy checks passed');
process.exit(failed ? 1 : 0);
