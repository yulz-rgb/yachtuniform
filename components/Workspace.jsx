'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor, ChevronDown, Download, FileDown, FileText, Filter, Menu, Plus,
  Search, Settings, Ship, SlidersHorizontal, Trash2, Upload,
  Wand2, X, CheckCircle2, PanelRight,
  Users, Lock,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  categories, defaultCrew, defaultLooks, defaultProducts, marinaDefaultProducts, bodyTypes, roles, productMatchesBodyType,
  navCategories, NAV_SECTION_LABELS, vessels, isDemoCatalog, productMatchesNav, productMatchesSubFilter, catalogNavForProduct,
  importedSupplierCatalog,
} from '../lib/catalog';
import { ALL_SUPPLIERS_NAV_ID, ALL_BRANDS_NAV_ID } from '../lib/uniformTaxonomy';
import { normalizeCrewMember } from '../lib/crew';
import { capabilitiesFor, canAdvance, STAGE_ACTOR } from '../lib/permissions';
import { ModelPreview } from './ModelPreview';
import { Mannequin } from './Mannequin';
import { LookVisual } from './LookVisual';
import { ProductCard } from './ProductCard';
import { ProductListRow } from './ProductListRow';
import { ProductEditor } from './ProductEditor';
import { CatalogImport } from './CatalogImport';
import { CrewImport } from './CrewImport';
import { TeamPanel } from './TeamPanel';
import { ProductAttribution } from './ProductAttribution';
import { mergeCatalogWithDefaults, ensureFullBundledCatalog } from '../lib/catalogAttribution';
import { productMatchesSearch, searchPlatform } from '../lib/catalogSearch';
import { defaultProductColour, parseColourImages, withProductColour } from '../lib/productColour';
import {
  countEligibleCrew,
  itemBaseQty,
  itemOrderQty,
  mergeRoleOptions,
  normalizeLookItems,
} from '../lib/lookAllocation';
import {
  money, buildLookTotals, computeBudget, buildOrderSummary, buildSizeAwareOrderSummary,
  indexById, compareLooks,
} from '../lib/calc';
import { buildSupplierOrderCsv } from '../lib/csv';
import {
  saveWorkspaceAction, setActiveYachtAction, createOrderAction, advanceOrderAction,
  recordArtifactAction,
} from '../app/actions';

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const NAV_ICONS = {
  bridge: '🧭',
  deck: '⚓',
  engineering: '⚙️',
  interior: '🌙',
  galley: '🔪',
  spa: '💆',
  epaulettes: '🎖️',
  footwear: '👟',
  outerwear: '🌧️',
  accessories: '🧢',
  'all-suppliers': '📦',
  'all-brands': '🏷️',
};

function brandKey(brand) {
  return String(brand || '').trim().toLowerCase();
}

function catalogBrandKeys(productList) {
  const keys = new Set();
  for (const p of productList) {
    if (!p.supplierCatalogId || p.active === false) continue;
    const key = brandKey(p.brand);
    if (key) keys.add(key);
  }
  return keys;
}

function NavCheckboxFilter({
  items, selectedIds, onToggle, onSelectAll, onClearAll, ariaLabel,
}) {
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const noneSelected = items.every((item) => !selectedIds.has(item.id));
  return (
    <div className="nav-filter-list" role="group" aria-label={ariaLabel}>
      <div className="nav-filter-actions">
        <button type="button" className="nav-filter-action" onClick={onSelectAll} disabled={allSelected}>
          Select all
        </button>
        <button type="button" className="nav-filter-action" onClick={onClearAll} disabled={noneSelected}>
          Clear all
        </button>
      </div>
      {items.map((item) => {
        const checked = selectedIds.has(item.id);
        return (
          <label key={item.id} className={`nav-filter-item ${checked ? 'checked' : ''}`}>
            <input
              type="checkbox"
              className="nav-filter-checkbox"
              checked={checked}
              onChange={() => onToggle(item.id)}
            />
            <span className="nav-filter-name">{item.name}</span>
            <span className="nav-filter-count">{item.count.toLocaleString()}</span>
          </label>
        );
      })}
    </div>
  );
}
const LOCAL_KEY = 'yachtUniform.workspace.v5';
const CATALOG_VERSION_KEY = 'yachtUniform.catalogVersion';
const CATALOG_VERSION = 'all-suppliers-v7';
const ORDER_HISTORY_KEY = 'yachtUniform.orders.v1';
const CATALOG_PAGE_SIZE = 96;

const DEFAULT_SETTINGS = {
  vessel: vessels[0],
  priceNote: 'Catalog prices ex VAT — confirm quotes before ordering.',
  currency: 'EUR',
  logoCost: 15,
  sparePercent: 10,
  setsPerCrew: 2,
  shippingFlat: 0,
  embroiderySetup: 0,
  budgetCap: 0,
  neededByDate: '',
  sizeSystem: 'EU',
  customRoles: [],
};

const DEFAULT_ADVANCED_FILTERS = {
  role: '',
  supplier: '',
  maxPrice: '',
  maxLeadDays: '',
  moqFriendly: false,
};

function createEmptyProduct(currency = 'EUR') {
  return {
    id: uid('product'),
    category: 'tops',
    name: '',
    brand: '',
    price: 0,
    currency,
    vatRate: 0,
    colours: ['White'],
    swatch: '#ffffff',
    accent: '#0b1f3a',
    fabric: '',
    details: '',
    fit: ['woman', 'man'],
    roleTags: [],
    leadTime: '',
    minOrder: 1,
    sizeRange: '',
    imageHint: 'polo',
    imageUrl: '',
    active: true,
  };
}

function normalizeCrewList(crew = [], looks = []) {
  const lookNameToId = new Map(looks.map((l) => [l.name, l.id]));
  return crew.map((c) => normalizeCrewMember(c, lookNameToId));
}

function productMatchesRole(product, role) {
  if (!role) return true;
  const tags = product.roleTags || [];
  if (!tags.length) return false;
  const aliases = {
    'chief-stew': ['chief-stew', 'interior'],
    interior: ['interior', 'chief-stew'],
    captain: ['captain', 'boss'],
    deck: ['deck'],
    engineer: ['engineer'],
    chef: ['chef'],
    spa: ['spa'],
  };
  const allowed = new Set([role, ...(aliases[role] || [])]);
  return tags.some((t) => allowed.has(t));
}

function isLegacyBootstrapCatalog(storedProducts = []) {
  if (!storedProducts.length) return false;
  const legacyNames = new Set([
    'technical crew polo',
    'linen resort shirt',
    'service dress',
    'logo crew cap',
  ]);
  const hits = storedProducts.filter((p) => legacyNames.has(String(p.name || '').toLowerCase())).length;
  return hits >= 3 && !storedProducts.some((p) => p.id?.startsWith('marina-'));
}

function normalizeImportedProduct(product) {
  return {
    ...product,
    id: product.id || uid('product'),
    currency: product.currency === 'EUR' ? '€' : product.currency,
    fit: product.fit?.length ? product.fit : ['woman', 'man'],
    colours: product.colours || [],
    colourImages: parseColourImages(product.colourImages),
  };
}

function parseLeadDays(leadTime) {
  const m = String(leadTime || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export default function Workspace({ mode = 'local', initialData = null, authInfo = null, canUpload = false, isDemo = false }) {
  // Capabilities: server mode derives them from the membership role; local/demo
  // mode is a single operator who can do everything.
  const caps = useMemo(
    () => (mode === 'server' ? capabilitiesFor(authInfo?.role || 'MEMBER') : capabilitiesFor('OWNER')),
    [mode, authInfo?.role],
  );
  const canEdit = caps.canEdit;
  const seeded = useRef(false);
  const [products, setProducts] = useState(() => ensureFullBundledCatalog(
    initialData?.products?.length ? initialData.products : [],
    defaultProducts,
  ));
  const [looks, setLooks] = useState(initialData?.looks?.length ? initialData.looks : defaultLooks);
  const [crew, setCrew] = useState(() => normalizeCrewList(
    initialData?.crew?.length ? initialData.crew : defaultCrew,
    initialData?.looks?.length ? initialData.looks : defaultLooks,
  ));
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(initialData?.settings || {}) });

  const [activeLookId, setActiveLookId] = useState((initialData?.looks?.[0] || defaultLooks[0]).id);
  const [activeNavCat, setActiveNavCat] = useState(ALL_SUPPLIERS_NAV_ID);
  const [expandedNavCat, setExpandedNavCat] = useState(ALL_SUPPLIERS_NAV_ID);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState(
    () => new Set(importedSupplierCatalog.filter((s) => s.count > 0).map((s) => s.id)),
  );
  const [selectedBrandKeys, setSelectedBrandKeys] = useState(
    () => catalogBrandKeys(defaultProducts),
  );
  const [uniformNavOpen, setUniformNavOpen] = useState(true);
  const [subFilter, setSubFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [platformQuery, setPlatformQuery] = useState('');
  const [platformSearchOpen, setPlatformSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [catalogView, setCatalogView] = useState('grid');
  const [catalogLimit, setCatalogLimit] = useState(CATALOG_PAGE_SIZE);
  const [prevCatalogFilterSig, setPrevCatalogFilterSig] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(DEFAULT_ADVANCED_FILTERS);
  const [roleFilter, setRoleFilter] = useState('');
  const [compareIds, setCompareIds] = useState([]);
  const [editProduct, setEditProduct] = useState({ ...defaultProducts[0] });
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCrewImport, setShowCrewImport] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [colourChoices, setColourChoices] = useState({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [order, setOrder] = useState(
    authInfo?.activeOrder ? { id: authInfo.activeOrder.id, status: authInfo.activeOrder.status } : null,
  );
  const [artifacts, setArtifacts] = useState(authInfo?.artifacts || []);
  const [archiveState, setArchiveState] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalLog, setApprovalLog] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const pdfRef = useRef(null);
  const saveTimer = useRef(null);
  const sparseCatalogSynced = useRef(false);
  const platformSearchRef = useRef(null);
  const platformSearchWrapRef = useRef(null);

  function toggleUniformNav() {
    if (uniformNavOpen) setExpandedNavCat(null);
    setUniformNavOpen((open) => !open);
  }

  function toggleNavCategory(catId) {
    if (expandedNavCat === catId) {
      setExpandedNavCat(null);
      return;
    }
    setActiveNavCat(catId);
    setExpandedNavCat(catId);
    setSubFilter('All');
  }

  function toggleSupplierFilter(supplierId) {
    setSelectedSupplierIds((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  }

  function toggleBrandFilter(brandId) {
    setSelectedBrandKeys((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  }

  const bundledSuppliers = useMemo(
    () => importedSupplierCatalog.filter((s) => s.count > 0).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const bundledBrands = useMemo(() => {
    const counts = new Map();
    const labels = new Map();
    for (const p of products) {
      if (!p.supplierCatalogId || p.active === false) continue;
      const key = brandKey(p.brand);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!labels.has(key)) labels.set(key, String(p.brand || '').trim());
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: labels.get(id), count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const allSupplierIds = useMemo(
    () => bundledSuppliers.map((s) => s.id),
    [bundledSuppliers],
  );
  const allBrandIds = useMemo(
    () => bundledBrands.map((b) => b.id),
    [bundledBrands],
  );

  useEffect(() => {
    if (mode !== 'local') return;
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      const storedVersion = window.localStorage.getItem(CATALOG_VERSION_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        let nextProducts = isLegacyBootstrapCatalog(data.products)
          ? defaultProducts
          : ensureFullBundledCatalog(data.products || [], defaultProducts);
        if (storedVersion !== CATALOG_VERSION) {
          // Catalog version changed: replace the stored product list with the
          // clean bundled catalog so older browsers drop removed/non-uniform
          // items and pick up corrected categories. Crew/looks/settings below
          // are preserved separately.
          nextProducts = defaultProducts.map((p) => ({ ...p }));
        }
        /* eslint-disable react-hooks/set-state-in-effect */
        setProducts(nextProducts);
        if (data.looks) setLooks(data.looks);
        if (data.crew) setCrew(normalizeCrewList(data.crew, data.looks || looks));
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        if (data.orderHistory) setOrderHistory(data.orderHistory);
        if (data.approvalLog) setApprovalLog(data.approvalLog);
        /* eslint-enable react-hooks/set-state-in-effect */
      } else {
        setProducts(defaultProducts);
      }
      window.localStorage.setItem(CATALOG_VERSION_KEY, CATALOG_VERSION);
      const ordersRaw = window.localStorage.getItem(ORDER_HISTORY_KEY);
      if (ordersRaw) setOrderHistory(JSON.parse(ordersRaw));
    } catch {}
    seeded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'server' || !canEdit || sparseCatalogSynced.current) return;
    if (products.length >= defaultProducts.length) return;
    sparseCatalogSynced.current = true;
    const full = ensureFullBundledCatalog(products, defaultProducts);
    (async () => {
      setProducts(full);
      setSaveState('saving');
      const res = await saveWorkspaceAction({ products: full, looks, crew, settings });
      setSaveState(res?.ok ? 'saved' : 'error');
    })();
  }, [mode, canEdit, products, looks, crew, settings]);

  useEffect(() => {
    if (mode === 'local') {
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify({
          products, looks, crew, settings, orderHistory, approvalLog,
        }));
        window.localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(orderHistory));
      } catch {}
      return;
    }
    if (!seeded.current) {
      seeded.current = true;
      return;
    }
    if (!canEdit) return; // read-only roles never write back
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState('saving');
      const res = await saveWorkspaceAction({ products, looks, crew, settings });
      setSaveState(res?.ok ? 'saved' : 'error');
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [products, looks, crew, settings, orderHistory, approvalLog, mode, canEdit]);

  function patchSettings(patch) { setSettings((s) => ({ ...s, ...patch })); }

  function selectPlatformResult(result) {
    setPlatformSearchOpen(false);
    setPlatformQuery('');
    if (result.type === 'product') {
      setActiveNavCat(ALL_SUPPLIERS_NAV_ID);
      setExpandedNavCat(ALL_SUPPLIERS_NAV_ID);
      setSubFilter('All');
      setSearch(result.label);
      requestAnimationFrame(() => {
        document.querySelector('.catalog-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return;
    }
    if (result.type === 'look') {
      setActiveLookId(result.id);
      setMobileNavOpen(false);
      return;
    }
    if (result.type === 'crew') {
      setRightPanelOpen(true);
      return;
    }
    if (result.type === 'order') {
      setShowApprovals(true);
    }
  }

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        platformSearchRef.current?.focus();
        setPlatformSearchOpen(true);
      }
      if (e.key === 'Escape') setPlatformSearchOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function onPointerDown(e) {
      if (!platformSearchWrapRef.current?.contains(e.target)) {
        setPlatformSearchOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const activeLook = looks.find((l) => l.id === activeLookId) || looks[0];
  const activeNav = navCategories.find((n) => n.id === activeNavCat) || navCategories[0];
  const productsById = useMemo(() => indexById(products), [products]);

  function selectProductColour(product, colour) {
    setColourChoices((prev) => ({ ...prev, [product.id]: colour }));
  }

  const colourForProduct = useCallback(
    (product) => colourChoices[product?.id] || defaultProductColour(product),
    [colourChoices],
  );

  const selectedProducts = useMemo(() => {
    const normalized = normalizeLookItems(activeLook || {}, productsById);
    const itemByProduct = new Map((normalized.items || []).map((item) => [item.productId, item]));
    return (normalized.productIds || [])
      .map((id) => {
        const product = productsById[id];
        if (!product || !productMatchesBodyType(product, activeLook?.bodyType || 'woman')) return null;
        return {
          product: withProductColour(product, colourForProduct(product)),
          allocation: itemByProduct.get(id) || {
            productId: id,
            unitsPerPerson: 1,
            roleIds: [],
            spareQty: 0,
          },
        };
      })
      .filter(Boolean);
  }, [productsById, activeLook, colourForProduct]);

  const roleOptions = useMemo(
    () => mergeRoleOptions(roles, settings.customRoles || []),
    [settings.customRoles],
  );
  const customRoleIds = useMemo(
    () => new Set((settings.customRoles || []).map((role) => role.id)),
    [settings.customRoles],
  );
  const activeLookNormalized = useMemo(
    () => normalizeLookItems(activeLook || {}, productsById),
    [activeLook, productsById],
  );
  const allocationByProductId = useMemo(
    () => new Map((activeLookNormalized.items || []).map((item) => [item.productId, item])),
    [activeLookNormalized],
  );

  function productAllocationProps(productId) {
    const allocation = allocationByProductId.get(productId);
    if (!allocation) return null;
    const baseQty = itemBaseQty(crew, activeLookNormalized, allocation, settings);
    const orderQty = itemOrderQty(crew, activeLookNormalized, allocation, settings);
    return {
      allocation,
      eligibleCount: countEligibleCrew(crew, activeLookNormalized, allocation),
      baseQty,
      orderQty,
      onAllocationChange: (patch) => patchLookItem(productId, patch),
    };
  }

  const searchActive = search.trim().length > 0;

  const filteredProducts = useMemo(() => {
    const isAllSuppliers = activeNavCat === ALL_SUPPLIERS_NAV_ID;
    const isAllBrands = activeNavCat === ALL_BRANDS_NAV_ID;
    let base = products.filter((p) => {
      if (p.active === false) return false;
      if (searchActive) {
        if (!productMatchesSearch(p, search)) return false;
        if (!productMatchesRole(p, advancedFilters.role || roleFilter)) return false;
        return true;
      }
      if (isAllSuppliers) {
        if (!p.supplierCatalogId) return false;
        if (selectedSupplierIds.size > 0 && !selectedSupplierIds.has(p.supplierCatalogId)) return false;
        return true;
      }
      if (isAllBrands) {
        if (!p.supplierCatalogId) return false;
        const key = brandKey(p.brand);
        if (!key) return false;
        if (selectedBrandKeys.size > 0 && !selectedBrandKeys.has(key)) return false;
        return true;
      }
      if (!productMatchesNav(p, activeNav)) return false;
      if (!productMatchesBodyType(p, activeLook?.bodyType || 'woman')) return false;
      if (!productMatchesSubFilter(p, subFilter, activeNav.id)) return false;
      if (!productMatchesRole(p, advancedFilters.role || roleFilter)) return false;
      return true;
    });

    if (advancedFilters.supplier) {
      const q = advancedFilters.supplier.toLowerCase();
      base = base.filter((p) => `${p.brand} ${p.supplierName || ''}`.toLowerCase().includes(q));
    }
    if (advancedFilters.maxPrice) {
      base = base.filter((p) => Number(p.price) <= Number(advancedFilters.maxPrice));
    }
    if (advancedFilters.maxLeadDays) {
      base = base.filter((p) => {
        const days = parseLeadDays(p.leadTime);
        return days === null || days <= Number(advancedFilters.maxLeadDays);
      });
    }
    if (advancedFilters.moqFriendly) {
      base = base.filter((p) => num(p.minOrder) <= 2);
    }

    if (sortBy === 'price-asc') return [...base].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === 'price-desc') return [...base].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sortBy === 'lead') return [...base].sort((a, b) => (parseLeadDays(a.leadTime) || 999) - (parseLeadDays(b.leadTime) || 999));
    return base;
  }, [products, activeNavCat, activeNav, activeLook, subFilter, search, searchActive, sortBy, advancedFilters, roleFilter, selectedSupplierIds, selectedBrandKeys]);

  const platformResults = useMemo(
    () => searchPlatform({ products, looks, crew, orderHistory, query: platformQuery }),
    [products, looks, crew, orderHistory, platformQuery],
  );

  // Reset pagination back to the first page whenever the active filters change.
  // Done during render (not in an effect) so the limit is correct in the same pass.
  const catalogFilterSig = JSON.stringify([
    activeNavCat, subFilter, search, sortBy, advancedFilters, roleFilter, activeLook?.bodyType,
    [...selectedSupplierIds].sort(),
    [...selectedBrandKeys].sort(),
  ]);
  if (catalogFilterSig !== prevCatalogFilterSig) {
    setPrevCatalogFilterSig(catalogFilterSig);
    setCatalogLimit(CATALOG_PAGE_SIZE);
  }

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, catalogLimit),
    [filteredProducts, catalogLimit],
  );
  const hasMoreCatalog = filteredProducts.length > visibleProducts.length;

  const lookTotals = useMemo(() => buildLookTotals(looks, products), [looks, products]);
  const lookTotalsDisplay = useMemo(
    () => lookTotals.map((look) => ({
      ...look,
      products: look.products.map((p) => withProductColour(p, colourForProduct(p))),
    })),
    [lookTotals, colourForProduct],
  );
  const budget = useMemo(() => computeBudget(crew, lookTotals, settings), [crew, lookTotals, settings]);
  const orderSummary = useMemo(() => buildOrderSummary(crew, looks, products, settings), [crew, looks, products, settings]);
  const sizeAwareOrder = useMemo(() => buildSizeAwareOrderSummary(crew, looks, products, settings), [crew, looks, products, settings]);
  const compareData = useMemo(() => compareLooks(compareIds, looks, products), [compareIds, looks, products]);
  const fmt = (v) => money(v, settings.currency);

  function num(v) { return Number(v) || 0; }

  function patchActiveLook(patch) { setLooks(looks.map((l) => (l.id === activeLook.id ? { ...l, ...patch } : l))); }

  function patchLookItem(productId, patch) {
    setLooks(looks.map((look) => {
      if (look.id !== activeLook.id) return look;
      const normalized = normalizeLookItems(look, productsById);
      const items = (normalized.items || []).map((item) => (
        item.productId === productId ? { ...item, ...patch } : item
      ));
      return { ...look, productIds: normalized.productIds, items };
    }));
  }

  function addCustomRole(role) {
    if (!role?.id) return;
    const existing = [...roles, ...(settings.customRoles || [])].some((entry) => entry.id === role.id);
    if (existing) return;
    patchSettings({ customRoles: [...(settings.customRoles || []), role] });
  }

  function removeCustomRole(roleId) {
    patchSettings({ customRoles: (settings.customRoles || []).filter((role) => role.id !== roleId) });
    setLooks(looks.map((look) => ({
      ...look,
      items: (look.items || []).map((item) => ({
        ...item,
        roleIds: (item.roleIds || []).filter((id) => id !== roleId),
      })),
    })));
  }

  function toggleProduct(product) {
    const exclusive = ['tops', 'shirts', 'bottoms', 'dresses', 'outerwear', 'shoes', 'chef-wear', 'engineering', 'spa-wear', 'epaulettes'];
    let nextIds = activeLook.productIds || [];
    if (nextIds.includes(product.id)) nextIds = nextIds.filter((id) => id !== product.id);
    else {
      const onePiece = ['dresses', 'engineering'];
      const tops = ['tops', 'shirts', 'epaulettes', 'chef-wear', 'spa-wear'];
      const clearCategories = onePiece.includes(product.category) ? [...onePiece, ...tops, 'bottoms']
        : tops.includes(product.category) ? [...tops, 'dresses']
          : product.category === 'bottoms' ? ['bottoms', 'dresses', 'engineering'] : [product.category];
      nextIds = exclusive.includes(product.category)
        ? nextIds.filter((id) => !clearCategories.includes(productsById[id]?.category))
        : nextIds;
      nextIds = [...nextIds, product.id];
    }
    const updated = normalizeLookItems({ ...activeLook, productIds: nextIds }, productsById);
    patchActiveLook({ productIds: updated.productIds, items: updated.items });
  }

  function toggleCompareLook(id) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  function saveProduct() {
    const normalised = {
      ...editProduct,
      id: editProduct.id || uid('product'),
      name: String(editProduct.name || '').trim(),
      price: Number(editProduct.price || 0),
      fit: editProduct.fit?.length ? editProduct.fit : ['woman', 'man'],
    };
    const isNew = !products.some((p) => p.id === normalised.id);
    setProducts((prev) => (prev.some((p) => p.id === normalised.id)
      ? prev.map((p) => (p.id === normalised.id ? normalised : p))
      : [normalised, ...prev]));
    if (isNew) {
      setSubFilter('All');
      setSearch('');
      const navId = catalogNavForProduct(normalised);
      setActiveNavCat(navId);
      setExpandedNavCat(navId);
    }
    setShowAdmin(false);
  }

  function openAddProduct() {
    setEditProduct(createEmptyProduct(settings.currency));
    setShowAdmin(true);
  }

  function openEditProduct(prod) {
    setEditProduct(prod);
    setShowAdmin(true);
  }

  function deleteProduct() {
    if (!editProduct.id) return;
    setProducts(products.filter((p) => p.id !== editProduct.id));
    setLooks(looks.map((l) => ({
      ...l,
      productIds: (l.productIds || []).filter((id) => id !== editProduct.id),
      items: (l.items || []).filter((item) => item.productId !== editProduct.id),
    })));
    setShowAdmin(false);
  }

  function addLook() {
    const newLook = {
      id: uid('look'),
      name: 'New Look',
      description: 'Describe when this look is used.',
      bodyType: activeLook.bodyType,
      productIds: [],
      items: [],
    };
    setLooks([...looks, newLook]); setActiveLookId(newLook.id);
  }

  function mergeImportedProducts(imported, { replace = false } = {}) {
    const normalized = imported.map(normalizeImportedProduct);
    setProducts((prev) => {
      if (replace) return normalized;
      const byName = new Map(prev.map((p) => [p.name.toLowerCase(), p]));
      const next = [...prev];
      for (const p of normalized) {
        const existing = p.name ? byName.get(p.name.toLowerCase()) : null;
        if (existing) {
          const idx = next.findIndex((x) => x.id === existing.id);
          next[idx] = { ...existing, ...p, id: existing.id };
        } else {
          next.push(p);
        }
      }
      return next;
    });
    setShowImport(false);
  }

  function mergeImportedCrew(imported) {
    setCrew(normalizeCrewList([...crew, ...imported], looks));
    setShowCrewImport(false);
    setShowCrewMgmt(true);
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const slug = (settings.vessel || 'yacht').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  function strToBase64(str) {
    try { return btoa(unescape(encodeURIComponent(str))); } catch { return ''; }
  }

  // Persist a generated export to Blob and link it to the active order, so
  // procurement handoffs are traceable. Only roles that can create orders archive.
  async function archiveArtifact(type, filename, base64, contentType) {
    if (mode !== 'server' || !caps.canCreateOrder || !base64) return;
    setArchiveState('archiving');
    const res = await recordArtifactAction({
      type, filename, contentBase64: base64, contentType, orderId: order?.id || null,
    });
    if (res?.ok) {
      setArtifacts((a) => [{ id: res.id, type, blobUrl: res.url, createdAt: new Date().toISOString() }, ...a]);
      setArchiveState('archived');
    } else {
      setArchiveState('');
    }
  }

  function exportCsv() {
    const csv = buildSupplierOrderCsv({ crew, looks, products, settings, vessel: settings.vessel });
    downloadBlob(csv, `${slug}-supplier-order.csv`, 'text/csv;charset=utf-8;');
    archiveArtifact('CSV', `${slug}-supplier-order.csv`, strToBase64(csv), 'text/csv');
  }

  function exportJson() {
    const json = JSON.stringify({ products, looks, crew, settings }, null, 2);
    downloadBlob(json, 'yacht-uniform-data.json', 'application/json');
    archiveArtifact('JSON', `${slug}-backup.json`, strToBase64(json), 'application/json');
  }

  function importJson(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.products) setProducts(data.products);
        if (data.looks) setLooks(data.looks);
        if (data.crew) setCrew(normalizeCrewList(data.crew, data.looks || looks));
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  }

  async function downloadPdf() {
    const element = pdfRef.current;
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight; let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight); heightLeft -= pageHeight;
    while (heightLeft > 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight); heightLeft -= pageHeight; }
    pdf.save(`${slug}.pdf`);
    try {
      const b64 = pdf.output('datauristring').split(',')[1];
      await archiveArtifact('PDF', `${slug}.pdf`, b64, 'application/pdf');
    } catch {}
  }

  async function submitForApproval() {
    const snapshot = { products, looks, crew, settings, orderSummary, sizeAwareOrder, generatedAt: new Date().toISOString() };
    const entry = {
      id: uid('order'),
      name: `${settings.vessel || 'Yacht'} order ${new Date().toLocaleDateString('en-GB')}`,
      status: 'DRAFT',
      totals: budget,
      createdAt: new Date().toISOString(),
    };
    setOrderHistory((h) => [entry, ...h]);
    setApprovalLog((log) => [...log, { at: new Date().toISOString(), action: 'Created draft', notes: approvalNotes }]);
    if (mode === 'server') {
      const res = await createOrderAction({ name: entry.name, totals: budget, snapshot });
      if (res?.ok) setOrder({ id: res.orderId, status: res.status });
    } else {
      setOrder({ id: entry.id, status: 'DRAFT' });
    }
    setApprovalNotes('');
  }

  async function advance() {
    if (!order) return;
    const stages = ['DRAFT', 'CAPTAIN_REVIEW', 'OWNER_APPROVAL', 'APPROVED'];
    const idx = stages.indexOf(order.status);
    const next = stages[idx + 1];
    if (!next) return;
    const logEntry = { at: new Date().toISOString(), action: `Advanced to ${next.replace(/_/g, ' ')}`, notes: approvalNotes };
    setApprovalLog((log) => [...log, logEntry]);
    setOrderHistory((h) => h.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    if (mode === 'server') {
      const res = await advanceOrderAction({ orderId: order.id, notes: approvalNotes });
      if (res?.ok) setOrder({ ...order, status: res.status });
    } else {
      setOrder({ ...order, status: next });
    }
    setApprovalNotes('');
  }

  async function switchYacht(yachtId) {
    await setActiveYachtAction(yachtId);
    window.location.reload();
  }

  const resetDemo = () => {
    setProducts([...defaultProducts]);
    setLooks(defaultLooks);
    setCrew(normalizeCrewList(defaultCrew, defaultLooks));
    setSettings(DEFAULT_SETTINGS);
    setActiveLookId(defaultLooks[0].id);
    setActiveNavCat(ALL_SUPPLIERS_NAV_ID);
    setExpandedNavCat(ALL_SUPPLIERS_NAV_ID);
    setSubFilter('All');
    setSelectedSupplierIds(new Set(importedSupplierCatalog.filter((s) => s.count > 0).map((s) => s.id)));
    setSelectedBrandKeys(catalogBrandKeys(defaultProducts));
    setOrder(null);
    setApprovalLog([]);
    try {
      window.localStorage.setItem(CATALOG_VERSION_KEY, CATALOG_VERSION);
      window.localStorage.removeItem(LOCAL_KEY);
    } catch {}
  };

  const bundledSupplierCount = importedSupplierCatalog.filter((s) => s.count > 0).length;

  return (
    <main className="dashboard">
      {isDemo && (
        <div className="demo-banner no-print">
          <span className="demo-banner-tag">Demo</span>
          <span className="demo-banner-text">
            {products.length.toLocaleString()} items from {bundledSupplierCount} suppliers loaded. Data saves to this browser only.
          </span>
          <div className="demo-banner-actions">
            <button type="button" className="demo-banner-btn" onClick={resetDemo}>Reload catalog</button>
            <button type="button" className="demo-banner-btn primary" onClick={() => setShowImport(true)}>Import supplier catalog</button>
            <Link href="/sign-in" className="demo-banner-link">Sign in</Link>
            <span className="demo-banner-note">for multi-yacht persistence</span>
          </div>
        </div>
      )}

      <header className="topbar no-print">
        <div className="topbar-brand">
          <button type="button" className="topbar-btn mobile-nav-toggle icon-only" onClick={() => setMobileNavOpen((o) => !o)} aria-label="Open navigation">
            <Menu size={16} />
          </button>
          <div className="brand-mark"><Anchor size={16} /></div>
          <div className="topbar-brand-text">
            <span className="topbar-title">Yacht Uniform Lookbook</span>
            <span className="topbar-tagline">Crew uniform planning</span>
          </div>
        </div>
        <div className="topbar-search" ref={platformSearchWrapRef}>
          <Search size={14} className="topbar-search-icon" aria-hidden="true" />
          <input
            ref={platformSearchRef}
            className="topbar-search-input"
            type="search"
            placeholder="Search products, looks, crew…"
            value={platformQuery}
            onChange={(e) => {
              setPlatformQuery(e.target.value);
              setPlatformSearchOpen(true);
            }}
            onFocus={() => setPlatformSearchOpen(true)}
            aria-label="Search platform"
            aria-expanded={platformSearchOpen && platformResults.total > 0}
            aria-controls="platform-search-results"
          />
          <kbd className="topbar-search-kbd" aria-hidden="true">⌘K</kbd>
          {platformSearchOpen && platformQuery.trim() && (
            <div className="platform-search-dropdown" id="platform-search-results" role="listbox">
              {platformResults.total === 0 ? (
                <p className="platform-search-empty">No matches for &ldquo;{platformQuery.trim()}&rdquo;</p>
              ) : (
                <>
                  {[
                    { key: 'products', label: 'Products', items: platformResults.products },
                    { key: 'looks', label: 'Looks', items: platformResults.looks },
                    { key: 'crew', label: 'Crew', items: platformResults.crew },
                    { key: 'orders', label: 'Orders', items: platformResults.orders },
                  ].map(({ key, label, items }) => items.length > 0 && (
                    <div key={key} className="platform-search-group">
                      <div className="platform-search-group-label">{label}</div>
                      {items.map((item) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          className="platform-search-item"
                          role="option"
                          onClick={() => selectPlatformResult(item)}
                        >
                          <span className="platform-search-item-label">{item.label}</span>
                          {item.meta && <span className="platform-search-item-meta">{item.meta}</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <div className="topbar-actions">
          {mode === 'server' && authInfo?.yachts?.length > 0 && (
            <select className="topbar-select" value={authInfo.activeYachtId} onChange={(e) => switchYacht(e.target.value)} aria-label="Active yacht">
              {authInfo.yachts.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          )}
          {mode === 'local' && (
            <select className="topbar-select" value={settings.vessel} onChange={(e) => patchSettings({ vessel: e.target.value })} aria-label="Vessel">
              {vessels.map((v) => <option key={v} value={v}>Lookbook: {v}</option>)}
            </select>
          )}
          {mode === 'server' && (
            <span className={`role-badge role-${(authInfo?.role || 'MEMBER').toLowerCase()}`} title="Your role on this yacht">{caps.label}</span>
          )}
          {mode === 'server' && (
            canEdit ? (
              <span className={`save-pill ${saveState}`} title="Server save status">
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Synced'}
              </span>
            ) : (
              <span className="save-pill" title="Read-only role"><Lock size={11} style={{ verticalAlign: -1 }} /> View only</span>
            )
          )}
          <button type="button" className="topbar-btn mobile-panel-toggle icon-only" onClick={() => setRightPanelOpen((o) => !o)} aria-label="Open budget panel">
            <PanelRight size={16} />
          </button>
          <button type="button" className="topbar-btn primary-topbar" onClick={() => setShowImport(true)}><Upload size={14} /> Import catalog</button>
          <button type="button" className="topbar-btn gold" onClick={downloadPdf}><Download size={14} /> Export PDF</button>
          <button type="button" className="topbar-btn" onClick={exportCsv}><FileDown size={14} /> Export CSV</button>
          {mode === 'server' && caps.canManageMembers && (
            <button type="button" className="topbar-btn" onClick={() => setShowTeam(true)}><Users size={16} /> Team</button>
          )}
          {canEdit && (
            <button type="button" className="topbar-btn icon-only" onClick={() => setShowSettings((s) => !s)} title="Settings" aria-label="Settings"><Settings size={16} /></button>
          )}
        </div>
      </header>

      {showSettings && (
        <div className="admin-overlay no-print" onClick={() => setShowSettings(false)}>
          <div className="admin-panel" style={{ position: 'relative', maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close-admin" onClick={() => setShowSettings(false)} aria-label="Close"><X size={16} /></button>
            <h2>Project Settings</h2>
            <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="control-group"><label>Currency</label>
                <select className="select" value={settings.currency} onChange={(e) => patchSettings({ currency: e.target.value })}>
                  {['EUR', 'USD', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="control-group"><label>Size system</label>
                <select className="select" value={settings.sizeSystem} onChange={(e) => patchSettings({ sizeSystem: e.target.value })}>
                  {['EU', 'US', 'UK'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="control-group"><label>Vessel</label>
                <input className="text-input" value={settings.vessel} onChange={(e) => patchSettings({ vessel: e.target.value })} />
              </div>
              <div className="control-group"><label>Budget cap (0 = none)</label>
                <input className="text-input" type="number" value={settings.budgetCap} onChange={(e) => patchSettings({ budgetCap: Number(e.target.value) })} />
              </div>
              <div className="control-group"><label>Needed by date</label>
                <input className="text-input" type="date" value={settings.neededByDate} onChange={(e) => patchSettings({ neededByDate: e.target.value })} />
              </div>
              <div className="control-group"><label>Shipping (flat)</label>
                <input className="text-input" type="number" value={settings.shippingFlat} onChange={(e) => patchSettings({ shippingFlat: Number(e.target.value) })} />
              </div>
              <div className="control-group"><label>Embroidery setup (one-off)</label>
                <input className="text-input" type="number" value={settings.embroiderySetup} onChange={(e) => patchSettings({ embroiderySetup: Number(e.target.value) })} />
              </div>
            </div>
            <div className="control-group" style={{ margin: '12px 0' }}>
              <label>Price note (shown on PDF)</label>
              <textarea className="text-area" value={settings.priceNote} onChange={(e) => patchSettings({ priceNote: e.target.value })} />
            </div>
            <div className="control-group" style={{ marginBottom: 12 }}>
              <label>Look description</label>
              <textarea className="text-area" value={activeLook.description} onChange={(e) => patchActiveLook({ description: e.target.value })} />
            </div>
            <div className="admin-actions">
              <button type="button" className="btn ghost" onClick={resetDemo}><Wand2 size={14} /> Reset demo data</button>
            </div>
          </div>
        </div>
      )}

      {showApprovals && (
        <div className="admin-overlay no-print" onClick={() => setShowApprovals(false)}>
          <div className="admin-panel" style={{ position: 'relative', maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close-admin" onClick={() => setShowApprovals(false)} aria-label="Close"><X size={16} /></button>
            <h2>Order Approval</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Capture an immutable snapshot and move it through the approval chain with notes.</p>
            <div className="approval-flow">
              {['DRAFT', 'CAPTAIN_REVIEW', 'OWNER_APPROVAL', 'APPROVED'].map((s) => (
                <span key={s} className={`approval-step ${order?.status === s ? 'active' : ''}`}>{s.replace(/_/g, ' ')}</span>
              ))}
            </div>
            <div className="grand-total-box" style={{ margin: '12px 0' }}>
              <span>Locked grand total</span><strong>{fmt(budget.grandTotal)}</strong>
            </div>
            <div className="control-group">
              <label>Review notes</label>
              <textarea className="text-area" value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} placeholder="Captain/owner comments, change requests…" />
            </div>
            <div className="admin-actions">
              {!order && <button type="button" className="btn primary" onClick={submitForApproval}>Create snapshot (Draft)</button>}
              {order && order.status !== 'APPROVED' && <button type="button" className="btn primary" onClick={advance}>Advance to next stage</button>}
              {order?.status === 'APPROVED' && <span className="import-result ok"><CheckCircle2 size={16} /> Approved for order</span>}
            </div>
            {approvalLog.length > 0 && (
              <div className="approval-log">
                <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>Approval trail</strong>
                {approvalLog.map((entry, i) => (
                  <div key={i} className="approval-log-item">
                    <strong>{new Date(entry.at).toLocaleString('en-GB')}</strong> — {entry.action}
                    {entry.notes && <div>{entry.notes}</div>}
                  </div>
                ))}
              </div>
            )}
            {orderHistory.length > 0 && (
              <div className="order-history">
                <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>Order history</strong>
                {orderHistory.slice(0, 6).map((o) => (
                  <div key={o.id} className="order-history-item">
                    <span>{o.name}</span>
                    <span>{o.status?.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="dashboard-body">
        <aside className={`left-nav no-print ${mobileNavOpen ? 'open' : ''}`}>
          <div className="nav-section">
            <div className="nav-section-title"><span className="num">1</span> Person</div>
            <div className="gender-toggle">
              {bodyTypes.map((b) => (
                <button key={b.id} type="button" className={`gender-btn ${activeLook.bodyType === b.id ? 'active' : ''}`}
                  onClick={() => patchActiveLook({ bodyType: b.id, productIds: activeLook.productIds.filter((id) => productMatchesBodyType(productsById[id], b.id)) })}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-section-title"><span className="num">2</span> Looks</div>
            <button type="button" className="nav-add-btn" onClick={addLook}><Plus size={12} /> Add Look</button>
            {looks.map((l) => (
              <button key={l.id} type="button" className={`nav-look-btn ${l.id === activeLook.id ? 'active' : ''}`}
                onClick={(e) => {
                  if (e.shiftKey) { toggleCompareLook(l.id); return; }
                  setActiveLookId(l.id);
                }}>
                <span className="nav-look-name">{l.name}</span>
                <span className="nav-look-price">{fmt(lookTotals.find((lt) => lt.id === l.id)?.subtotal || 0)}</span>
                {compareIds.includes(l.id) && <span className="dot" />}
              </button>
            ))}
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', padding: '6px 12px 0', margin: 0, lineHeight: 1.4 }}>Shift+click look to compare (up to 4)</p>
          </div>

          <div className="nav-section nav-section--uniform">
            <button
              type="button"
              className="nav-section-title nav-section-toggle"
              onClick={toggleUniformNav}
              aria-expanded={uniformNavOpen}
            >
              <span className="num">3</span> Uniform
              {!uniformNavOpen && <span className="nav-section-count">{navCategories.length}</span>}
              <ChevronDown size={13} className={`nav-section-chevron ${uniformNavOpen ? 'open' : ''}`} aria-hidden />
            </button>
            {uniformNavOpen && navCategories.map((nc, i) => {
              const prev = navCategories[i - 1];
              const showLabel = nc.section && nc.section !== prev?.section;
              const isExpanded = expandedNavCat === nc.id;
              const isSupplierNav = nc.id === ALL_SUPPLIERS_NAV_ID;
              const isBrandNav = nc.id === ALL_BRANDS_NAV_ID;
              const hasSubcats = nc.subFilters.length > 1 || isSupplierNav || isBrandNav;
              return (
                <div key={nc.id}>
                  {showLabel && (
                    <div className="nav-subsection-label">{NAV_SECTION_LABELS[nc.section]}</div>
                  )}
                  <button type="button" className={`nav-cat-btn ${activeNavCat === nc.id ? 'active' : ''}`}
                    onClick={() => toggleNavCategory(nc.id)}
                    aria-expanded={hasSubcats ? isExpanded : undefined}>
                    <span className="nav-cat-icon">{NAV_ICONS[nc.id]}</span>
                    <span className="nav-cat-label">{nc.label}</span>
                    {hasSubcats && (
                      <ChevronDown size={12} className={`nav-cat-chevron ${isExpanded ? 'open' : ''}`} aria-hidden />
                    )}
                  </button>
                  {isExpanded && isSupplierNav && (
                    <NavCheckboxFilter
                      items={bundledSuppliers}
                      selectedIds={selectedSupplierIds}
                      onToggle={toggleSupplierFilter}
                      onSelectAll={() => setSelectedSupplierIds(new Set(allSupplierIds))}
                      onClearAll={() => setSelectedSupplierIds(new Set())}
                      ariaLabel="Filter by supplier"
                    />
                  )}
                  {isExpanded && isBrandNav && (
                    <NavCheckboxFilter
                      items={bundledBrands}
                      selectedIds={selectedBrandKeys}
                      onToggle={toggleBrandFilter}
                      onSelectAll={() => setSelectedBrandKeys(new Set(allBrandIds))}
                      onClearAll={() => setSelectedBrandKeys(new Set())}
                      ariaLabel="Filter by brand"
                    />
                  )}
                  {isExpanded && !isSupplierNav && nc.subFilters.length > 1 && (
                    <div className="nav-subcat-list" role="group" aria-label={`${nc.label} categories`}>
                      {nc.subFilters.map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          className={`nav-subcat-btn ${subFilter === sub ? 'active' : ''}`}
                          onClick={() => setSubFilter(sub)}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="main-zone">
          {compareIds.length >= 2 && (
            <div className="compare-panel no-print">
              <strong>Look comparison ({compareIds.length})</strong>
              <div className="compare-grid">
                {compareData.map((look) => (
                  <div key={look.id} className="compare-card">
                    <h4>{look.name} — {fmt(look.subtotal)}</h4>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 6px' }}>{look.itemCount} items · {look.bodyType}</p>
                    <ul>{look.products.map((p) => <li key={p.id}>{p.name} ({fmt(p.price)})</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="workspace-grid">
            <section className="preview-panel no-print">
              <div className="preview-look-name">Current look · {activeLook.name}</div>
              <ModelPreview
                key={activeLook.bodyType}
                bodyType={activeLook.bodyType}
                selectedProducts={selectedProducts.map(({ product }) => product)}
              />
              <div className="preview-stats">
                <div className="preview-stats-item">
                  <span className="psi-label">Items</span>
                  <span className="psi-value">{selectedProducts.length}</span>
                </div>
                <div className="preview-stats-divider" />
                <div className="preview-stats-item">
                  <span className="psi-label">Look Total</span>
                  <span className="psi-value">{fmt(selectedProducts.reduce((s, p) => s + Number(p.price || 0), 0))}</span>
                </div>
              </div>
              <div className="preview-actions">
                <button type="button" className="preview-action-btn" onClick={() => patchActiveLook({ productIds: [] })}>Reset Look</button>
              </div>
            </section>

            <section className="catalog-panel no-print">
              <div className="catalog-header">
                <div className="catalog-title-row">
                  <h2>
                    {activeNav.label}
                    {subFilter !== 'All' && (
                      <span className="catalog-breadcrumb"> › {subFilter}</span>
                    )}
                    <span className="result-count">{filteredProducts.length}</span>
                  </h2>
                  <div className="catalog-controls">
                    <button type="button" className="btn primary add-product-btn" onClick={() => setShowImport(true)}>
                      <Upload size={14} /> Import catalog
                    </button>
                    <button type="button" className="btn ghost add-product-btn" onClick={openAddProduct}>
                      <Plus size={14} /> Add one
                    </button>
                    <label className="sort-label" htmlFor="sort-select">Sort:</label>
                    <select id="sort-select" className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="newest">Newest</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                      <option value="lead">Lead time</option>
                    </select>
                    <button type="button" className={`view-btn ${catalogView === 'grid' ? 'active' : ''}`} title="Grid view" onClick={() => setCatalogView('grid')}>▦</button>
                    <button type="button" className={`view-btn ${catalogView === 'list' ? 'active' : ''}`} title="List view" onClick={() => setCatalogView('list')}>☰</button>
                  </div>
                </div>
                <div className="catalog-filters">
                  {activeNav.subFilters.map((sub) => (
                    <button key={sub} type="button" className={`filter-chip ${subFilter === sub ? 'active' : ''}`}
                      onClick={() => setSubFilter(sub)}>
                      {sub}
                    </button>
                  ))}
                </div>
                <div className="catalog-filters">
                  <select className="sort-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
                    <option value="">All roles</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div className="catalog-search-row">
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      className="search-input"
                      style={{ paddingLeft: 32 }}
                      placeholder={searchActive ? 'Searching all suppliers…' : 'Search products…'}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search products"
                    />
                  </div>
                  <button type="button" className={`filter-btn ${showAdvancedFilters ? 'active' : ''}`} onClick={() => setShowAdvancedFilters((s) => !s)}>
                    <SlidersHorizontal size={14} /> Filter
                  </button>
                </div>
                {showAdvancedFilters && (
                  <div className="filter-panel">
                    <div className="control-group"><label>Supplier / brand</label>
                      <input className="text-input" value={advancedFilters.supplier} onChange={(e) => setAdvancedFilters({ ...advancedFilters, supplier: e.target.value })} />
                    </div>
                    <div className="control-group"><label>Max price</label>
                      <input className="text-input" type="number" value={advancedFilters.maxPrice} onChange={(e) => setAdvancedFilters({ ...advancedFilters, maxPrice: e.target.value })} />
                    </div>
                    <div className="control-group"><label>Max lead (days)</label>
                      <input className="text-input" type="number" value={advancedFilters.maxLeadDays} onChange={(e) => setAdvancedFilters({ ...advancedFilters, maxLeadDays: e.target.value })} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                      <input type="checkbox" checked={advancedFilters.moqFriendly} onChange={(e) => setAdvancedFilters({ ...advancedFilters, moqFriendly: e.target.checked })} />
                      MOQ ≤ 2 only
                    </label>
                  </div>
                )}
              </div>
              <div className="catalog-grid-wrap">
                {catalogView === 'grid' ? (
                  <div className="catalog-grid">
                    {visibleProducts.map((p) => {
                      const alloc = productAllocationProps(p.id);
                      const inLook = activeLook.productIds.includes(p.id);
                      return (
                        <ProductCard
                          key={p.id}
                          product={p}
                          isSelected={inLook}
                          selectedColour={colourForProduct(p)}
                          onColourSelect={selectProductColour}
                          onToggle={toggleProduct}
                          onEdit={openEditProduct}
                          roleOptions={roleOptions}
                          customRoleIds={customRoleIds}
                          disabled={!canEdit}
                          onAddRole={addCustomRole}
                          onRemoveRole={removeCustomRole}
                          {...(inLook && alloc ? alloc : {})}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="product-list">
                    {visibleProducts.map((p) => {
                      const alloc = productAllocationProps(p.id);
                      const inLook = activeLook.productIds.includes(p.id);
                      return (
                        <ProductListRow
                          key={p.id}
                          product={withProductColour(p, colourForProduct(p))}
                          isSelected={inLook}
                          roleMatch={productMatchesRole(p, roleFilter)}
                          onToggle={toggleProduct}
                          onEdit={openEditProduct}
                          roleOptions={roleOptions}
                          customRoleIds={customRoleIds}
                          disabled={!canEdit}
                          onAddRole={addCustomRole}
                          onRemoveRole={removeCustomRole}
                          {...(inLook && alloc ? alloc : {})}
                        />
                      );
                    })}
                  </div>
                )}
                {hasMoreCatalog && (
                  <div className="catalog-load-more">
                    <p className="catalog-load-more-meta">
                      Showing {visibleProducts.length.toLocaleString()} of {filteredProducts.length.toLocaleString()} items
                    </p>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setCatalogLimit((limit) => limit + CATALOG_PAGE_SIZE)}
                    >
                      Load more
                    </button>
                  </div>
                )}
                {filteredProducts.length === 0 && (
                  <div className="catalog-empty">
                    <div className="catalog-empty-icon">👕</div>
                    {products.length > 0 ? (
                      <>
                        <p>No products match this department and active look ({activeLook?.bodyType === 'man' ? 'Male' : 'Female'}).</p>
                        <p className="import-hint">Open <strong>All Suppliers</strong> in the sidebar, or search by supplier name. Catalog has {products.length.toLocaleString()} items from {bundledSupplierCount} suppliers.</p>
                      </>
                    ) : (
                      <>
                        <p>No products here yet.</p>
                        <button type="button" className="btn primary" onClick={() => setShowImport(true)}><Upload size={14} /> Import supplier catalog</button>
                        <button type="button" className="btn ghost" onClick={resetDemo} style={{ marginTop: 8 }}>Load Marina Yacht Wear catalog</button>
                        <button type="button" className="btn ghost" onClick={openAddProduct} style={{ marginTop: 8 }}><Plus size={14} /> Or add one manually</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>

            <aside className={`right-panel no-print ${rightPanelOpen ? 'open' : ''}`}>
              <div className="panel-block">
                <h3>Budget Calculator</h3>
                <div className="budget-row"><label>Crew Members</label><span style={{ fontWeight: 800 }}>{crew.length}</span></div>
                <div className="budget-row"><label>Default sets per crew</label><input className="budget-input" type="number" min="1" value={settings.setsPerCrew} onChange={(e) => patchSettings({ setsPerCrew: Number(e.target.value) })} /></div>
                <div className="budget-row"><label>Logo / Embroidery per item</label><input className="budget-input" type="number" value={settings.logoCost} onChange={(e) => patchSettings({ logoCost: Number(e.target.value) })} /></div>
                {!budget.usesItemAllocations && (
                  <div className="budget-row"><label>Spare Stock Allowance %</label><input className="budget-input" type="number" value={settings.sparePercent} onChange={(e) => patchSettings({ sparePercent: Number(e.target.value) })} /></div>
                )}
                {budget.usesItemAllocations && (
                  <p className="budget-hint">Add items to the look, then set units and roles on each card — totals update here.</p>
                )}
                {settings.budgetCap > 0 && budget.overBudget && (
                  <div className="warning-item error" style={{ marginBottom: 8 }}>Over budget cap by {fmt(budget.budgetDelta)}</div>
                )}
                <div className="budget-divider" />
                {budget.usesItemAllocations && selectedProducts.length > 0 && (
                  <div className="budget-quote-lines">
                    <h4 className="budget-quote-title">Quote lines</h4>
                    {selectedProducts.map(({ product, allocation }) => {
                      const orderQty = itemOrderQty(crew, activeLookNormalized, allocation, settings);
                      const lineTotal = orderQty * num(product.price);
                      return (
                        <div key={product.id} className="budget-row budget-quote-line">
                          <label>{product.name.split(' ').slice(0, 3).join(' ')}</label>
                          <strong>{orderQty} · {fmt(lineTotal)}</strong>
                        </div>
                      );
                    })}
                  </div>
                )}
                {budget.usesItemAllocations && selectedProducts.length > 0 && <div className="budget-divider" />}
                <div className="budget-results">
                  <div className="budget-row"><label>Items Total</label><strong>{fmt(budget.itemsTotal)}</strong></div>
                  <div className="budget-row"><label>Logo / Embroidery Total</label><strong>{fmt(budget.logoTotal)}</strong></div>
                  <div className="budget-row">
                    <label>
                      {budget.usesItemAllocations
                        ? `Spare Stock (${budget.spareUnitCount || 0} units)`
                        : `Spare Stock (${settings.sparePercent}%)`}
                    </label>
                    <strong>{fmt(budget.spareTotal)}</strong>
                  </div>
                  <div className="budget-row"><label>VAT</label><strong>{fmt(budget.vatTotal)}</strong></div>
                  <div className="budget-row"><label>Shipping</label><strong>{fmt(budget.shippingTotal)}</strong></div>
                  <div className="budget-row"><label>Setup</label><strong>{fmt(budget.setupTotal)}</strong></div>
                </div>
                <div className="grand-total-box"><span>Grand Total</span><strong>{fmt(budget.grandTotal)}</strong></div>
              </div>

            </aside>
          </div>

          <div className="bottom-zone no-print">
            <div className="bottom-panel current-look-panel">
              <h4>Current Look: {activeLook.name}</h4>
              <div className="current-look-scroll">
                {selectedProducts.map(({ product, allocation }) => {
                  const orderQty = itemOrderQty(crew, activeLookNormalized, allocation, settings);
                  const lineTotal = orderQty * num(product.price);
                  return (
                    <div key={product.id} className="current-item">
                      <div className="current-item-img">
                        <LookVisual bodyType={activeLook.bodyType} products={[product]} variant="item" />
                      </div>
                      <div className="current-item-info">
                        <div className="name">{product.name.split(' ').slice(0, 2).join(' ')}</div>
                        <ProductAttribution product={product} compact />
                        <div className="price">{orderQty} · {fmt(lineTotal)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bottom-panel">
              <h4>Looks Overview</h4>
              <div className="looks-overview-scroll">
                {lookTotalsDisplay.map((look) => (
                  <div key={look.id} className={`look-thumb ${look.id === activeLook.id ? 'active' : ''}`}
                    onClick={() => setActiveLookId(look.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setActiveLookId(look.id)}
                    role="button"
                    tabIndex={0}>
                    <div className="look-thumb-card">
                      <LookVisual bodyType={look.bodyType} products={look.products} variant="thumb" />
                    </div>
                    <div className="look-thumb-label">{look.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bottom-panel catalog-mgmt-panel">
              <h4>Catalogue Management</h4>
              <div className="catalogue-mgmt-btns">
                <button type="button" className="mgmt-btn primary-mgmt" onClick={() => setShowImport(true)}><Upload size={15} /> Import catalog</button>
                <button type="button" className="mgmt-btn" onClick={openAddProduct}><Plus size={15} /> Add one product</button>
                <button type="button" className="mgmt-btn" onClick={() => setShowCrewImport(true)}><Upload size={15} /> Import Crew CSV</button>
                <button type="button" className="mgmt-btn" onClick={exportJson}><FileText size={15} /> Export JSON Backup</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAdmin && (
        <ProductEditor
          draft={editProduct}
          setDraft={setEditProduct}
          onSave={saveProduct}
          canUpload={canUpload}
          isEditing={products.some((p) => p.id === editProduct.id)}
          onDelete={deleteProduct}
          onClose={() => setShowAdmin(false)}
          onOpenImport={() => { setShowAdmin(false); setShowImport(true); }}
        />
      )}

      {showImport && (
        <CatalogImport mode={mode} onClose={() => setShowImport(false)} onLocalImport={mergeImportedProducts} />
      )}

      {showCrewImport && (
        <CrewImport looks={looks} onClose={() => setShowCrewImport(false)} onImport={mergeImportedCrew} />
      )}

      <section className="lookbook" ref={pdfRef}>
        <div className="pdf-title">
          <div>
            <div className="badge"><Ship size={14} /> Uniform proposal</div>
            <h2>{settings.vessel} — Uniform Lookbook</h2>
            <p>{settings.priceNote}</p>
          </div>
          <div className="pdf-total"><span>Estimated project total</span><strong>{fmt(budget.grandTotal)}</strong></div>
        </div>
        <h3>Look options</h3>
        <div className="print-grid">
          {lookTotalsDisplay.map((look) => (
            <article className="print-card" key={look.id}>
              <div className="avatar-card print"><Mannequin bodyType={look.bodyType} selectedProducts={look.products} /></div>
              <h4>{look.name}</h4><p>{look.description}</p>
              <table className="summary-table"><tbody>
                {look.products.map((p) => <tr key={p.id}><td>{p.name}<br /><small>{p.brand} · {p.fabric}</small></td><td>{fmt(p.price)}</td></tr>)}
                <tr><th>Garment subtotal</th><th>{fmt(look.subtotal)}</th></tr>
              </tbody></table>
            </article>
          ))}
        </div>
        <h3>Crew order matrix</h3>
        <table className="summary-table">
          <thead><tr><th>Name</th><th>Role</th><th>Sizes</th><th>Looks</th><th>Sets</th><th>Total</th></tr></thead>
          <tbody>{budget.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{roles.find((x) => x.id === r.role)?.label || r.role}</td>
              <td>Top {r.topSize || '—'} / Bottom {r.bottomSize || '—'} / Shoe {r.shoeSize || '—'}</td>
              <td>{r.lookName}</td><td>{r.sets}</td><td>{fmt(r.total)}</td>
            </tr>
          ))}</tbody>
        </table>
        <h3>Size-aware supplier purchase order</h3>
        <table className="summary-table">
          <thead><tr><th>Supplier</th><th>Product</th><th>Size</th><th>Colour</th><th>Qty</th><th>Unit</th><th>Line total</th></tr></thead>
          <tbody>{sizeAwareOrder.map((l) => (
            <tr key={`${l.productId}-${l.size}-${l.colour}`}>
              <td>{l.supplier}</td><td>{l.name}</td><td>{l.size}</td><td>{l.colour}</td>
              <td>{l.orderQty}</td><td>{fmt(l.unitPrice)}</td><td>{fmt(l.lineTotal)}</td>
            </tr>
          ))}</tbody>
        </table>
        <h3>Budget summary</h3>
        <table className="summary-table"><tbody>
          <tr><td>Base uniform total</td><td>{fmt(budget.baseTotal)}</td></tr>
          <tr><td>Spare stock{budget.usesItemAllocations ? ` (${budget.spareUnitCount || 0} units)` : ` allowance (${settings.sparePercent}%)`}</td><td>{fmt(budget.spareTotal)}</td></tr>
          <tr><td>VAT</td><td>{fmt(budget.vatTotal)}</td></tr>
          <tr><td>Shipping + setup</td><td>{fmt(budget.shippingTotal + budget.setupTotal)}</td></tr>
          <tr><th>Estimated grand total</th><th>{fmt(budget.grandTotal)}</th></tr>
        </tbody></table>
      </section>
    </main>
  );
}
