'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor, Download, FileDown, FileText, Filter, Plus, RotateCw, Save,
  Search, Settings, Ship, SlidersHorizontal, Sun, Trash2, Upload, Wand2, X, ZoomIn,
  AlertTriangle, CheckCircle2, ClipboardList,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  categories, defaultCrew, defaultLooks, defaultProducts, bodyTypes, roles,
  navCategories, vessels,
} from '../lib/catalog';
import { Mannequin } from './Mannequin';
import { ProductCard } from './ProductCard';
import { ProductEditor } from './ProductEditor';
import { CatalogImport } from './CatalogImport';
import {
  money, buildLookTotals, computeBudget, buildOrderSummary, validateOrder, indexById,
} from '../lib/calc';
import { buildSupplierOrderCsv } from '../lib/csv';
import {
  saveWorkspaceAction, setActiveYachtAction, createOrderAction, advanceOrderAction,
} from '../app/actions';

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const NAV_ICONS = { 'tops-shirts': '👕', dresses: '👗', bottoms: '🩳', outerwear: '🧥', shoes: '👞', accessories: '🎩' };
const LOCAL_KEY = 'yachtUniform.workspace.v3';

const DEFAULT_SETTINGS = {
  vessel: vessels[0],
  priceNote: 'Demo prices only — replace with current supplier quotes before ordering.',
  currency: 'EUR',
  logoCost: 15,
  sparePercent: 10,
  setsPerCrew: 2,
  shippingFlat: 0,
  embroiderySetup: 0,
};

function matchesSubFilter(product, subFilter) {
  if (!subFilter || subFilter === 'All') return true;
  const hay = `${product.name} ${product.fabric} ${product.imageHint}`.toLowerCase();
  const map = {
    Polo: 'polo', Shirt: 'shirt', Linen: 'linen', Technical: 'technical', Resort: 'resort',
    Service: 'service', Shorts: 'shorts', Skort: 'skort', Trousers: 'trouser',
    Softshell: 'softshell', Jacket: 'jacket', Deck: 'deck', Cap: 'cap', Belt: 'belt',
  };
  return hay.includes((map[subFilter] || subFilter).toLowerCase());
}

export default function Workspace({ mode = 'local', initialData = null, authInfo = null, canUpload = false }) {
  const seeded = useRef(false);
  const [products, setProducts] = useState(initialData?.products?.length ? initialData.products : defaultProducts);
  const [looks, setLooks] = useState(initialData?.looks?.length ? initialData.looks : defaultLooks);
  const [crew, setCrew] = useState(initialData?.crew?.length ? initialData.crew : defaultCrew);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(initialData?.settings || {}) });

  const [activeLookId, setActiveLookId] = useState((initialData?.looks?.[0] || defaultLooks[0]).id);
  const [activeNavCat, setActiveNavCat] = useState('tops-shirts');
  const [subFilter, setSubFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [editProduct, setEditProduct] = useState({ ...defaultProducts[0] });
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [hideBg, setHideBg] = useState(false);
  const [showCrewMgmt, setShowCrewMgmt] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [order, setOrder] = useState(null);
  const pdfRef = useRef(null);
  const saveTimer = useRef(null);

  // ── Persistence ──────────────────────────────────────────────────────────
  // Local mode: hydrate from localStorage once on mount.
  useEffect(() => {
    if (mode !== 'local') return;
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        /* eslint-disable react-hooks/set-state-in-effect */
        // Hydrate from localStorage after mount to avoid SSR hydration mismatch.
        if (data.products) setProducts(data.products);
        if (data.looks) setLooks(data.looks);
        if (data.crew) setCrew(data.crew);
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {}
    seeded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist (debounced) on any data change.
  useEffect(() => {
    if (mode === 'local') {
      try {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ products, looks, crew, settings }));
      } catch {}
      return;
    }
    if (!seeded.current) {
      seeded.current = true;
      return;
    }
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const res = await saveWorkspaceAction({ products, looks, crew, settings });
      setSaveState(res?.ok ? 'saved' : 'error');
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [products, looks, crew, settings, mode]);

  function patchSettings(patch) { setSettings((s) => ({ ...s, ...patch })); }

  // ── Derived data ─────────────────────────────────────────────────────────
  const activeLook = looks.find((l) => l.id === activeLookId) || looks[0];
  const activeNav = navCategories.find((n) => n.id === activeNavCat) || navCategories[0];
  const productsById = useMemo(() => indexById(products), [products]);
  const selectedProducts = useMemo(
    () => (activeLook?.productIds || []).map((id) => productsById[id]).filter(Boolean),
    [productsById, activeLook],
  );
  const filteredProducts = useMemo(() => {
    const base = products.filter((p) =>
      p.active !== false &&
      activeNav.categories.includes(p.category) &&
      (p.fit || []).includes(activeLook?.bodyType || 'woman') &&
      matchesSubFilter(p, subFilter) &&
      (!search || `${p.name} ${p.brand} ${p.sku}`.toLowerCase().includes(search.toLowerCase())));
    if (sortBy === 'price-asc') return [...base].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === 'price-desc') return [...base].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    return base;
  }, [products, activeNav, activeLook, subFilter, search, sortBy]);

  const lookTotals = useMemo(() => buildLookTotals(looks, products), [looks, products]);
  const budget = useMemo(() => computeBudget(crew, lookTotals, settings), [crew, lookTotals, settings]);
  const orderSummary = useMemo(() => buildOrderSummary(crew, looks, products, settings), [crew, looks, products, settings]);
  const warnings = useMemo(() => validateOrder(crew, looks, products, settings), [crew, looks, products, settings]);
  const fmt = (v) => money(v, settings.currency);

  // ── Mutations ────────────────────────────────────────────────────────────
  function patchActiveLook(patch) { setLooks(looks.map((l) => (l.id === activeLook.id ? { ...l, ...patch } : l))); }
  function toggleProduct(product) {
    const exclusive = ['tops', 'shirts', 'bottoms', 'dresses', 'outerwear', 'shoes'];
    let nextIds = activeLook.productIds || [];
    if (nextIds.includes(product.id)) nextIds = nextIds.filter((id) => id !== product.id);
    else {
      const clearCategories = product.category === 'dresses' ? ['tops', 'shirts', 'bottoms', 'dresses']
        : product.category === 'tops' || product.category === 'shirts' ? ['tops', 'shirts', 'dresses']
          : product.category === 'bottoms' ? ['bottoms', 'dresses'] : [product.category];
      nextIds = exclusive.includes(product.category)
        ? nextIds.filter((id) => !clearCategories.includes(productsById[id]?.category))
        : nextIds;
      nextIds = [...nextIds, product.id];
    }
    patchActiveLook({ productIds: nextIds });
  }
  function saveProduct() {
    const normalised = {
      ...editProduct,
      id: editProduct.id || uid('product'),
      price: Number(editProduct.price || 0),
      fit: editProduct.fit?.length ? editProduct.fit : ['woman', 'man'],
    };
    setProducts(products.some((p) => p.id === normalised.id)
      ? products.map((p) => (p.id === normalised.id ? normalised : p))
      : [...products, normalised]);
    setEditProduct(normalised);
  }
  function deleteProduct() {
    if (!editProduct.id) return;
    setProducts(products.filter((p) => p.id !== editProduct.id));
    setLooks(looks.map((l) => ({ ...l, productIds: l.productIds.filter((id) => id !== editProduct.id) })));
    setEditProduct({ ...defaultProducts[0], id: uid('product'), name: 'New product' });
  }
  function addLook() {
    const newLook = { id: uid('look'), name: 'New Look', description: 'Describe when this look is used.', bodyType: activeLook.bodyType, productIds: [] };
    setLooks([...looks, newLook]); setActiveLookId(newLook.id);
  }
  function addCrewRow() { setCrew([...crew, { id: uid('crew'), name: 'New Crew', role: 'interior', bodyType: 'woman', topSize: '', bottomSize: '', shoeSize: '', assignedLook: activeLook.id }]); }
  function updateCrew(id, patch) { setCrew(crew.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function deleteCrew(id) { setCrew(crew.filter((c) => c.id !== id)); }

  function mergeImportedProducts(imported) {
    setProducts((prev) => {
      const bySku = new Map(prev.filter((p) => p.sku).map((p) => [p.sku, p]));
      const next = [...prev];
      for (const p of imported) {
        const existing = p.sku ? bySku.get(p.sku) : null;
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

  // ── Exports ──────────────────────────────────────────────────────────────
  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function exportCsv() {
    const csv = buildSupplierOrderCsv({ crew, looks, products, settings, vessel: settings.vessel });
    downloadBlob(csv, `${(settings.vessel || 'yacht').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-supplier-order.csv`, 'text/csv;charset=utf-8;');
  }
  function exportJson() {
    downloadBlob(JSON.stringify({ products, looks, crew, settings }, null, 2), 'yacht-uniform-data.json', 'application/json');
  }
  function importJson(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.products) setProducts(data.products);
        if (data.looks) setLooks(data.looks);
        if (data.crew) setCrew(data.crew);
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
    pdf.save(`${(settings.vessel || 'yacht').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
  }

  // ── Approval workflow (server mode) ──────────────────────────────────────
  async function submitForApproval() {
    const snapshot = { products, looks, crew, settings, orderSummary, generatedAt: new Date().toISOString() };
    const res = await createOrderAction({ name: `${settings.vessel || 'Yacht'} order ${new Date().toLocaleDateString('en-GB')}`, totals: budget, snapshot });
    if (res?.ok) setOrder({ id: res.orderId, status: res.status });
  }
  async function advance() {
    if (!order) return;
    const res = await advanceOrderAction({ orderId: order.id });
    if (res?.ok) setOrder({ ...order, status: res.status });
  }

  async function switchYacht(yachtId) {
    await setActiveYachtAction(yachtId);
    window.location.reload();
  }

  const resetDemo = () => { setProducts(defaultProducts); setLooks(defaultLooks); setCrew(defaultCrew); setSettings(DEFAULT_SETTINGS); setActiveLookId(defaultLooks[0].id); };
  const errorCount = warnings.filter((w) => w.level === 'error').length;

  return (
    <main className="dashboard">
      <header className="topbar no-print">
        <div className="topbar-brand">
          <div className="brand-mark"><Anchor size={16} /></div>
          <span className="brand-name">YACHT CO.</span>
        </div>
        <div className="topbar-title">Yacht Uniform Lookbook</div>
        <div className="topbar-actions">
          {mode === 'server' && authInfo?.yachts?.length > 0 && (
            <select className="topbar-select" value={authInfo.activeYachtId} onChange={(e) => switchYacht(e.target.value)}>
              {authInfo.yachts.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          )}
          {mode === 'local' && (
            <select className="topbar-select" value={settings.vessel} onChange={(e) => patchSettings({ vessel: e.target.value })}>
              {vessels.map((v) => <option key={v} value={v}>Lookbook: {v}</option>)}
            </select>
          )}
          {mode === 'server' && (
            <span className={`save-pill ${saveState}`} title="Server save status">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : 'Synced'}
            </span>
          )}
          <button className="topbar-btn gold" onClick={downloadPdf}><Download size={14} /> Export PDF</button>
          <button className="topbar-btn" onClick={exportCsv}><FileDown size={14} /> Export CSV</button>
          {mode === 'server' && (
            <button className="topbar-btn" onClick={() => setShowApprovals(true)}><ClipboardList size={16} /> Approvals</button>
          )}
          <button className="topbar-btn icon-only" onClick={() => setShowSettings((s) => !s)} title="Settings"><Settings size={16} /></button>
        </div>
      </header>

      {showSettings && (
        <div className="admin-overlay no-print" onClick={() => setShowSettings(false)}>
          <div className="admin-panel" style={{ position: 'relative', maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <button className="close-admin" onClick={() => setShowSettings(false)}><X size={16} /></button>
            <h2>Project Settings</h2>
            <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="control-group"><label>Currency</label>
                <select className="select" value={settings.currency} onChange={(e) => patchSettings({ currency: e.target.value })}>
                  {['EUR', 'USD', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="control-group"><label>Vessel</label>
                <input className="text-input" value={settings.vessel} onChange={(e) => patchSettings({ vessel: e.target.value })} />
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
              <button className="btn ghost" onClick={resetDemo}><Wand2 size={14} /> Reset demo data</button>
            </div>
          </div>
        </div>
      )}

      {showApprovals && (
        <div className="admin-overlay no-print" onClick={() => setShowApprovals(false)}>
          <div className="admin-panel" style={{ position: 'relative', maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <button className="close-admin" onClick={() => setShowApprovals(false)}><X size={16} /></button>
            <h2>Order Approval</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Capture an immutable snapshot of the current lookbook and move it through the approval chain.</p>
            <div className="approval-flow">
              {['DRAFT', 'CAPTAIN_REVIEW', 'OWNER_APPROVAL', 'APPROVED'].map((s) => (
                <span key={s} className={`approval-step ${order?.status === s ? 'active' : ''}`}>{s.replace('_', ' ')}</span>
              ))}
            </div>
            <div className="grand-total-box" style={{ margin: '12px 0' }}>
              <span>Locked grand total</span><strong>{fmt(budget.grandTotal)}</strong>
            </div>
            <div className="admin-actions">
              {!order && <button className="btn primary" onClick={submitForApproval}>Create snapshot (Draft)</button>}
              {order && order.status !== 'APPROVED' && <button className="btn primary" onClick={advance}>Advance to next stage</button>}
              {order?.status === 'APPROVED' && <span className="import-result ok"><CheckCircle2 size={16} /> Approved for order</span>}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-body">
        <aside className="left-nav no-print">
          <div className="nav-section">
            <div className="nav-section-title"><span className="num">1</span> Person</div>
            <div className="gender-toggle">
              {bodyTypes.map((b) => (
                <button key={b.id} className={`gender-btn ${activeLook.bodyType === b.id ? 'active' : ''}`}
                  onClick={() => patchActiveLook({ bodyType: b.id, productIds: activeLook.productIds.filter((id) => productsById[id]?.fit?.includes(b.id)) })}>
                  {b.label}
                </button>
              ))}
            </div>
            <div className="body-icons">
              {bodyTypes.map((b) => (
                <button key={b.id} className={`body-icon ${activeLook.bodyType === b.id ? 'active' : ''}`}
                  onClick={() => patchActiveLook({ bodyType: b.id, productIds: activeLook.productIds.filter((id) => productsById[id]?.fit?.includes(b.id)) })}>
                  {b.emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-section-title"><span className="num">2</span> Looks</div>
            <button className="nav-add-btn" onClick={addLook}><Plus size={12} /> Add Look</button>
            {looks.map((l) => (
              <button key={l.id} className={`nav-look-btn ${l.id === activeLook.id ? 'active' : ''}`} onClick={() => setActiveLookId(l.id)}>
                <span className="nav-look-name">{l.name}</span>
                <span className="nav-look-price">{fmt(lookTotals.find((lt) => lt.id === l.id)?.subtotal || 0)}</span>
                {l.id === activeLook.id && <span className="dot" />}
              </button>
            ))}
          </div>

          <div className="nav-section">
            <div className="nav-section-title"><span className="num">3</span> Categories</div>
            {navCategories.map((nc) => (
              <button key={nc.id} className={`nav-cat-btn ${activeNavCat === nc.id ? 'active' : ''}`}
                onClick={() => { setActiveNavCat(nc.id); setSubFilter('All'); }}>
                <span className="nav-cat-icon">{NAV_ICONS[nc.id]}</span>
                <span className="nav-cat-label">{nc.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="main-zone">
          <div className="workspace-grid">
            <section className="preview-panel no-print">
              <div className="preview-look-name">Current Look: {activeLook.name}</div>
              <div className={`preview-frame ${hideBg ? 'no-bg' : ''}`}>
                <div className="preview-toolbar">
                  <span className="preview-tool"><ZoomIn size={14} /></span>
                  <span className="preview-tool"><RotateCw size={14} /></span>
                  <span className="preview-tool"><Sun size={14} /></span>
                </div>
                <Mannequin bodyType={activeLook.bodyType} selectedProducts={selectedProducts} />
              </div>
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
                <button className="preview-action-btn" onClick={() => setHideBg((b) => !b)}>{hideBg ? 'Show Bg' : 'Hide Bg'}</button>
                <button className="preview-action-btn" onClick={() => patchActiveLook({ productIds: [] })}>Reset Look</button>
              </div>
            </section>

            <section className="catalog-panel no-print">
              <div className="catalog-header">
                <div className="catalog-title-row">
                  <h2>{activeNav.label} <span className="result-count">{filteredProducts.length}</span></h2>
                  <div className="catalog-controls">
                    <label className="sort-label">Sort by:</label>
                    <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="newest">Newest</option>
                      <option value="price-asc">Price: Low to High</option>
                      <option value="price-desc">Price: High to Low</option>
                    </select>
                    <button className="view-btn active" title="Grid view">▦</button>
                    <button className="view-btn" title="List view">☰</button>
                  </div>
                </div>
                <div className="catalog-filters">
                  {activeNav.subFilters.map((f) => (
                    <button key={f} className={`filter-chip ${subFilter === f ? 'active' : ''}`} onClick={() => setSubFilter(f)}>{f}</button>
                  ))}
                </div>
                <div className="catalog-search-row">
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input className="search-input" style={{ paddingLeft: 32 }} placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <button className="filter-btn"><SlidersHorizontal size={14} /> Filter</button>
                </div>
              </div>
              <div className="catalog-grid-wrap">
                <div className="catalog-grid">
                  {filteredProducts.map((p) => (
                    <ProductCard key={p.id} product={p} isSelected={activeLook.productIds.includes(p.id)}
                      onToggle={toggleProduct} onEdit={(prod) => { setEditProduct(prod); setShowAdmin(true); }} />
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="catalog-empty">
                      <div className="catalog-empty-icon">🔍</div>
                      <p>No products match your filters.</p>
                      <small>Try adjusting your search or category filters.</small>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="right-panel no-print">
              <div className="panel-block">
                <h3>Budget Calculator</h3>
                <div className="budget-row"><label>Crew Members</label><span style={{ fontWeight: 800 }}>{crew.length}</span></div>
                <div className="budget-row"><label>Sets per Crew Member</label><input className="budget-input" type="number" min="1" value={settings.setsPerCrew} onChange={(e) => patchSettings({ setsPerCrew: Number(e.target.value) })} /></div>
                <div className="budget-row"><label>Logo / Embroidery per item</label><input className="budget-input" type="number" value={settings.logoCost} onChange={(e) => patchSettings({ logoCost: Number(e.target.value) })} /></div>
                <div className="budget-row"><label>Spare Stock Allowance %</label><input className="budget-input" type="number" value={settings.sparePercent} onChange={(e) => patchSettings({ sparePercent: Number(e.target.value) })} /></div>
                <div className="budget-divider" />
                <div className="budget-results">
                  <div className="budget-row"><label>Items Total</label><strong>{fmt(budget.itemsTotal)}</strong></div>
                  <div className="budget-row"><label>Logo / Embroidery Total</label><strong>{fmt(budget.logoTotal)}</strong></div>
                  <div className="budget-row"><label>Spare Stock ({settings.sparePercent}%)</label><strong>{fmt(budget.spareTotal)}</strong></div>
                  <div className="budget-row"><label>VAT</label><strong>{fmt(budget.vatTotal)}</strong></div>
                  <div className="budget-row"><label>Shipping</label><strong>{fmt(budget.shippingTotal)}</strong></div>
                  <div className="budget-row"><label>Setup</label><strong>{fmt(budget.setupTotal)}</strong></div>
                </div>
                <div className="grand-total-box"><span>Grand Total</span><strong>{fmt(budget.grandTotal)}</strong></div>
              </div>

              {warnings.length > 0 && (
                <div className="panel-block">
                  <h3>Procurement Checks <span className={`result-count ${errorCount ? 'danger' : ''}`}>{warnings.length}</span></h3>
                  <div className="warning-list">
                    {warnings.slice(0, 8).map((w, i) => (
                      <div key={i} className={`warning-item ${w.level}`}>
                        <AlertTriangle size={12} /> {w.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="panel-block" style={{ flex: 1 }}>
                <h3>Crew Order Matrix <span style={{ float: 'right', textTransform: 'none', letterSpacing: 0 }}>{crew.length} items</span></h3>
                <div className="crew-table-wrap">
                  <table className="crew-table">
                    <thead><tr><th>Name</th><th>Role</th><th>Sizes</th><th>Look</th><th>Sets</th><th>Total</th></tr></thead>
                    <tbody>
                      {crew.slice(0, showCrewMgmt ? crew.length : 5).map((c) => {
                        const row = budget.rows.find((r) => r.id === c.id);
                        return (
                          <tr key={c.id}>
                            <td><input value={c.name} onChange={(e) => updateCrew(c.id, { name: e.target.value })} /></td>
                            <td>
                              <select value={c.role} onChange={(e) => updateCrew(c.id, { role: e.target.value })}>
                                {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                              </select>
                            </td>
                            <td style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{c.topSize}/{c.bottomSize}/{c.shoeSize}</td>
                            <td>
                              <select value={c.assignedLook} onChange={(e) => updateCrew(c.id, { assignedLook: e.target.value })}>
                                {looks.map((l) => <option key={l.id} value={l.id}>{l.name.split('/')[0].trim()}</option>)}
                              </select>
                            </td>
                            <td>{settings.setsPerCrew}</td>
                            <td className="total-cell">{fmt(row?.total || 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="panel-actions">
                  <button className="panel-btn" onClick={exportCsv}><FileDown size={13} /> Export CSV</button>
                  <button className="panel-btn primary" onClick={() => { setShowCrewMgmt((s) => !s); if (!showCrewMgmt) addCrewRow(); }}>
                    <Plus size={13} /> {showCrewMgmt ? 'Collapse' : 'Manage Crew'}
                  </button>
                </div>
                {showCrewMgmt && (
                  <div style={{ marginTop: 10 }}>
                    {crew.map((c) => (
                      <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
                        <input className="text-input" placeholder="Top" value={c.topSize} onChange={(e) => updateCrew(c.id, { topSize: e.target.value })} />
                        <input className="text-input" placeholder="Bottom" value={c.bottomSize} onChange={(e) => updateCrew(c.id, { bottomSize: e.target.value })} />
                        <input className="text-input" placeholder="Shoe" value={c.shoeSize} onChange={(e) => updateCrew(c.id, { shoeSize: e.target.value })} />
                        <button className="btn danger" style={{ padding: '6px 10px' }} onClick={() => deleteCrew(c.id)}><Trash2 size={13} /></button>
                      </div>
                    ))}
                    <button className="panel-btn" style={{ width: '100%', marginTop: 6 }} onClick={addCrewRow}><Plus size={13} /> Add crew member</button>
                  </div>
                )}
              </div>
            </aside>
          </div>

          <div className="bottom-zone no-print">
            <div className="bottom-panel">
              <h4>Current Look: {activeLook.name}</h4>
              <div className="current-look-scroll">
                {selectedProducts.map((p) => (
                  <div key={p.id} className="current-item">
                    <div className="current-item-img"><Mannequin bodyType={activeLook.bodyType} selectedProducts={[p]} compact /></div>
                    <div className="current-item-info">
                      <div className="name">{p.name.split(' ').slice(0, 2).join(' ')}</div>
                      <div className="price">{fmt(p.price)}</div>
                    </div>
                  </div>
                ))}
                <div className="add-item-slot" onClick={() => document.querySelector('.catalog-grid-wrap')?.scrollIntoView({ behavior: 'smooth' })}>+ Add Item</div>
              </div>
            </div>

            <div className="bottom-panel">
              <h4>Looks Overview</h4>
              <div className="looks-overview-scroll">
                {lookTotals.map((look) => (
                  <div key={look.id} className={`look-thumb ${look.id === activeLook.id ? 'active' : ''}`} onClick={() => setActiveLookId(look.id)}>
                    <div className="look-thumb-card"><Mannequin bodyType={look.bodyType} selectedProducts={look.products} compact /></div>
                    <div className="look-thumb-label">{look.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bottom-panel">
              <h4>Catalogue Management</h4>
              <div className="catalogue-mgmt-btns">
                <button className="mgmt-btn" onClick={() => setShowAdmin(true)}><Filter size={15} /> Manage Products</button>
                <button className="mgmt-btn" onClick={() => setShowImport(true)}><Upload size={15} /> Import Catalog CSV</button>
                <button className="mgmt-btn" onClick={exportJson}><FileText size={15} /> Export JSON Backup</button>
                <label className="mgmt-btn file-label"><Upload size={15} /> Import JSON<input type="file" accept="application/json" onChange={importJson} /></label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAdmin && (
        <ProductEditor draft={editProduct} setDraft={setEditProduct} onSave={saveProduct} canUpload={canUpload}
          onNew={() => setEditProduct({ id: uid('product'), category: 'tops', name: 'New product', brand: '', sku: '', price: 0, currency: settings.currency, vatRate: 0, colours: ['White'], swatch: '#ffffff', accent: '#0b1f3a', fabric: '', details: '', fit: ['woman', 'man'], roleTags: [], leadTime: '', minOrder: 1, sizeRange: '', imageHint: 'polo', imageUrl: '', active: true })}
          onDelete={deleteProduct} onClose={() => setShowAdmin(false)} />
      )}

      {showImport && (
        <CatalogImport mode={mode} onClose={() => setShowImport(false)} onLocalImport={mergeImportedProducts} />
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
          {lookTotals.map((look) => (
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
          <thead><tr><th>Name</th><th>Role</th><th>Sizes</th><th>Look</th><th>Sets</th><th>Total</th></tr></thead>
          <tbody>{budget.rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{roles.find((x) => x.id === r.role)?.label || r.role}</td>
              <td>Top {r.topSize || '—'} / Bottom {r.bottomSize || '—'} / Shoe {r.shoeSize || '—'}</td>
              <td>{r.lookName}</td><td>{settings.setsPerCrew}</td><td>{fmt(r.total)}</td>
            </tr>
          ))}</tbody>
        </table>
        <h3>Supplier purchase order</h3>
        <table className="summary-table">
          <thead><tr><th>Supplier</th><th>SKU</th><th>Product</th><th>Qty</th><th>Unit</th><th>Line total</th></tr></thead>
          <tbody>{orderSummary.map((l) => (
            <tr key={l.productId}>
              <td>{l.supplier}</td><td>{l.sku}</td><td>{l.name}</td><td>{l.orderQty}</td><td>{fmt(l.unitPrice)}</td><td>{fmt(l.lineTotal)}</td>
            </tr>
          ))}</tbody>
        </table>
        <h3>Budget summary</h3>
        <table className="summary-table"><tbody>
          <tr><td>Base uniform total</td><td>{fmt(budget.baseTotal)}</td></tr>
          <tr><td>Spare stock allowance ({settings.sparePercent}%)</td><td>{fmt(budget.spareTotal)}</td></tr>
          <tr><td>VAT</td><td>{fmt(budget.vatTotal)}</td></tr>
          <tr><td>Shipping + setup</td><td>{fmt(budget.shippingTotal + budget.setupTotal)}</td></tr>
          <tr><th>Estimated grand total</th><th>{fmt(budget.grandTotal)}</th></tr>
        </tbody></table>
      </section>
    </main>
  );
}
