import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Database,
  Edit2,
  Factory,
  Filter,
  Package,
  Plus,
  Save,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';

const PRODUCT_TABLE_NAME = 'master_products';

const DEFAULT_FORM = {
  product_id: '',
  product_code: '',
  product_name: '',
  product_type: 'MENU_JUAL',
  category: 'DIMSUM',
  default_unit: 'pcs',
  selling_unit: 'pcs',
  production_unit: 'pcs',
  price_pcs: '',
  price_porsi: '',
  price_mika: '',
  price_basis: 'PORSI',
  price_auto_calculate: true,
  price_retail: '',
  price_reseller: '',
  price_mitra: '',
  current_hpp: '',
  fallback_hpp: '',
  minimum_selling_price: '',
  target_margin_percent: '',
  is_sellable: true,
  is_stock_tracked: true,
  is_production_output: false,
  is_production_item: false,
  uses_adukan: false,
  adukan_conversion_active: false,
  is_resto_menu: false,
  is_purchasable: false,
  production_process: '',
  default_yield_pcs: '1000',
  chicken_kg_per_adukan: '30',
  pcs_per_porsi: '4',
  pcs_per_mika: '50',
  status: 'Active',
  notes: '',
};

const PRODUCT_TYPES = [
  {
    id: 'HASIL_ADUKAN',
    label: 'Hasil Adukan',
    short: 'Lahir dari proses adukan',
    description: 'Contoh: Dimsum Original Mix / Dimsum Ayam Mix. Produk ini muncul di Produksi / Adukan dan bisa menjadi stok jadi freezer.',
  },
  {
    id: 'MENU_JUAL',
    label: 'Menu Jual',
    short: 'Dijual langsung di Kasir',
    description: 'Contoh: Dimsum Ayam Mix isi 4, Udang Keju, Lumpia Goreng. Produk ini boleh muncul di Kasir / Order.',
  },
  {
    id: 'MENU_TURUNAN',
    label: 'Menu Turunan',
    short: 'Dari produk dasar + finishing',
    description: 'Contoh: Dimsum Mentai atau produk goreng. Biasanya berasal dari stok dasar lalu ditambah topping/proses finishing.',
  },
  {
    id: 'BAHAN_PENDUKUNG',
    label: 'Bahan / Saos',
    short: 'Bahan pendukung, bukan menu utama',
    description: 'Contoh: saos, mentai, chili oil, mika, tepung, bumbu. Dipantau sebagai bahan/stok, bukan wajib muncul di Kasir.',
  },
  {
    id: 'PAKET',
    label: 'Paket',
    short: 'Bundling beberapa produk',
    description: 'Contoh: paket reseller, paket promo, paket mix. Isi paket bisa diturunkan dari beberapa produk lain.',
  },
];


const CATEGORIES = [
  'DIMSUM',
  'DIMSUM_GORENG',
  'PANGSIT',
  'SAOS',
  'TOPPING',
  'PAKET',
  'MINUMAN',
  'LAINNYA',
];

const safeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const normalizeCode = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9_./-]+/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '');

const normalizeSearch = (value) => String(value || '').trim().toUpperCase();

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null || value === '') return 0;

  const parsed = Number(
    String(value)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.'),
  );

  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value) => `Rp ${Math.round(toNumber(value)).toLocaleString('id-ID')}`;
const formatQty = (value, unit = 'pcs') => `${Math.round(toNumber(value)).toLocaleString('id-ID')} ${unit}`;

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = normalizeCode(value);
  if (['TRUE', 'YES', 'YA', 'Y', '1', 'ACTIVE', 'AKTIF'].includes(normalized)) return true;
  if (['FALSE', 'NO', 'TIDAK', 'N', '0', 'NON_ACTIVE', 'INACTIVE'].includes(normalized)) return false;
  return fallback;
};

const firstValue = (row, keys, fallback = '') => {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return fallback;
};

const slugCode = (value) => normalizeCode(value)
  .replace(/[./-]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 24);

const PRODUCT_TYPE_META = PRODUCT_TYPES.reduce((map, item) => ({ ...map, [item.id]: item }), {});

const getProductTypeMeta = (productType) => PRODUCT_TYPE_META[normalizeCode(productType || 'MENU_JUAL')] || PRODUCT_TYPE_META.MENU_JUAL;

const roundPrice = (value) => {
  const number = toNumber(value);
  if (!number) return 0;
  return Math.round(number);
};

const getConversionForPrice = (draft = {}) => {
  const pcsPerPorsi = Math.max(toNumber(draft.pcs_per_porsi || 4), 1);
  const pcsPerMika = Math.max(toNumber(draft.pcs_per_mika || 50), 1);
  return { pcsPerPorsi, pcsPerMika };
};

const normalizePriceTriplet = (draft = {}, changedKey = '') => {
  const next = { ...draft };
  const auto = next.price_auto_calculate !== false;
  const { pcsPerPorsi, pcsPerMika } = getConversionForPrice(next);

  let basis = normalizeCode(next.price_basis || 'PORSI');
  if (!['PORSI', 'PCS', 'MIKA'].includes(basis)) basis = 'PORSI';

  if (['price_porsi', 'price_pcs', 'price_mika'].includes(changedKey)) {
    if (changedKey === 'price_porsi') basis = 'PORSI';
    if (changedKey === 'price_pcs') basis = 'PCS';
    if (changedKey === 'price_mika') basis = 'MIKA';
    next.price_basis = basis;
  }

  if (!auto) return next;

  const pricePorsi = toNumber(next.price_porsi);
  const pricePcs = toNumber(next.price_pcs);
  const priceMika = toNumber(next.price_mika);

  if (basis === 'PORSI' && pricePorsi > 0) {
    const derivedPcs = roundPrice(pricePorsi / pcsPerPorsi);
    next.price_pcs = String(derivedPcs || '');
    next.price_mika = String(roundPrice(derivedPcs * pcsPerMika) || '');
    next.price_retail = String(pricePorsi || '');
  }

  if (basis === 'PCS' && pricePcs > 0) {
    next.price_porsi = String(roundPrice(pricePcs * pcsPerPorsi) || '');
    next.price_mika = String(roundPrice(pricePcs * pcsPerMika) || '');
    next.price_retail = String(roundPrice(pricePcs * pcsPerPorsi) || '');
  }

  if (basis === 'MIKA' && priceMika > 0) {
    const derivedPcs = roundPrice(priceMika / pcsPerMika);
    next.price_pcs = String(derivedPcs || '');
    next.price_porsi = String(roundPrice(derivedPcs * pcsPerPorsi) || '');
    next.price_retail = String(roundPrice(derivedPcs * pcsPerPorsi) || '');
  }

  if (!toNumber(next.price_mitra) && toNumber(next.price_reseller)) next.price_mitra = next.price_reseller;
  if (!toNumber(next.price_reseller) && toNumber(next.price_mitra)) next.price_reseller = next.price_mitra;

  return next;
};

const deriveDisplayPrices = (row = {}) => {
  const pcsPerPorsi = Math.max(toNumber(firstValue(row, ['pcs_per_porsi'], 4)), 1);
  const pcsPerMika = Math.max(toNumber(firstValue(row, ['pcs_per_mika'], 50)), 1);
  const rawPorsi = toNumber(firstValue(row, ['price_porsi', 'harga_porsi', 'selling_price_porsi'], 0));
  const rawPcs = toNumber(firstValue(row, ['price_pcs', 'harga_pcs', 'selling_price_pcs', 'selling_price', 'price', 'harga_jual'], 0));
  const rawMika = toNumber(firstValue(row, ['price_mika', 'harga_mika'], 0));

  let pricePcs = rawPcs;
  if (!pricePcs && rawPorsi) pricePcs = roundPrice(rawPorsi / pcsPerPorsi);
  if (!pricePcs && rawMika) pricePcs = roundPrice(rawMika / pcsPerMika);

  const pricePorsi = rawPorsi || (pricePcs ? roundPrice(pricePcs * pcsPerPorsi) : 0);
  const priceMika = rawMika || (pricePcs ? roundPrice(pricePcs * pcsPerMika) : 0);

  return { price_pcs: pricePcs, price_porsi: pricePorsi, price_mika: priceMika };
};

const applyProductTypeTemplate = (draft, productType) => {
  const next = { ...draft, product_type: productType };
  const normalized = normalizeCode(productType);

  if (normalized === 'HASIL_ADUKAN') {
    next.is_sellable = true;
    next.is_stock_tracked = true;
    next.uses_adukan = true;
    next.is_production_output = true;
    next.is_production_item = true;
    next.adukan_conversion_active = true;
    next.production_process = 'ADUKAN';
    next.default_unit = next.default_unit || 'pcs';
    next.selling_unit = next.selling_unit || 'pcs';
    next.production_unit = next.production_unit || 'pcs';
    next.default_yield_pcs = next.default_yield_pcs || '1000';
    next.chicken_kg_per_adukan = next.chicken_kg_per_adukan || '30';
    next.pcs_per_porsi = next.pcs_per_porsi || '4';
    next.pcs_per_mika = next.pcs_per_mika || '50';
  }

  if (normalized === 'MENU_JUAL') {
    next.is_sellable = true;
    next.is_resto_menu = true;
    next.is_stock_tracked = true;
    next.is_purchasable = false;
  }

  if (normalized === 'MENU_TURUNAN') {
    next.is_sellable = true;
    next.is_resto_menu = true;
    next.is_stock_tracked = true;
    next.is_purchasable = false;
    if (!next.production_process || normalizeCode(next.production_process) === 'ADUKAN') {
      next.production_process = 'FINISHING';
    }
  }

  if (normalized === 'BAHAN_PENDUKUNG') {
    next.is_sellable = false;
    next.is_resto_menu = false;
    next.is_stock_tracked = true;
    next.is_purchasable = true;
    next.uses_adukan = false;
    next.is_production_output = false;
    next.is_production_item = false;
    next.adukan_conversion_active = false;
    next.production_process = '';
  }

  if (normalized === 'PAKET') {
    next.is_sellable = true;
    next.is_resto_menu = true;
    next.is_stock_tracked = false;
    next.is_purchasable = false;
    next.uses_adukan = false;
    next.is_production_output = false;
    next.is_production_item = false;
    next.adukan_conversion_active = false;
    next.production_process = 'BUNDLE';
  }

  return next;
};


const getRawProducts = (props) => [
  ...safeArray(props.masterProducts),
  ...safeArray(props.master_products),
  ...safeArray(props.products),
  ...safeArray(props.dbData?.masterProducts),
  ...safeArray(props.dbData?.master_products),
  ...safeArray(props.dbData?.products),
];

const normalizeProduct = (row = {}) => {
  const raw = row.raw || row;
  const productId = String(firstValue(raw, ['product_id', 'id', 'sku'], '')).trim();
  const productCode = String(firstValue(raw, ['product_code', 'code', 'kode_produk', 'sku'], productId)).trim();
  const productName = String(firstValue(raw, ['product_name', 'name', 'nama_produk', 'item_name'], '')).trim();
  const typeRaw = firstValue(raw, ['product_type', 'type', 'jenis_produk'], 'MENU_JUAL');
  const categoryRaw = firstValue(raw, ['category', 'product_category', 'kategori'], 'DIMSUM');
  const statusRaw = String(firstValue(raw, ['status', 'product_status', 'status_active'], 'Active')).trim();
  const isDeleted = toBool(firstValue(raw, ['isDeleted', 'is_deleted', 'deleted'], false), false);
  const usesAdukan = toBool(firstValue(raw, ['uses_adukan', 'use_adukan', 'is_adukan_output', 'is_production_output', 'adukan_conversion_active', 'produced_by_adukan'], false), false) || normalizeCode(firstValue(raw, ['production_process'], '')) === 'ADUKAN';
  const isProductionOutput = toBool(firstValue(raw, ['is_production_output', 'production_output', 'is_production_item'], usesAdukan), usesAdukan);
  const isSellable = toBool(firstValue(raw, ['is_sellable', 'sellable', 'is_resto_menu'], true), true);

  const derivedPrices = deriveDisplayPrices(raw);
  const pricePorsi = derivedPrices.price_porsi;
  const pricePcs = derivedPrices.price_pcs;
  const priceMika = derivedPrices.price_mika;
  const currentHpp = toNumber(firstValue(raw, ['current_hpp', 'hpp', 'unit_cost', 'fallback_hpp'], 0));

  const normalized = {
    ...raw,
    id: productId || productCode || productName,
    product_id: productId,
    product_code: productCode,
    product_name: productName,
    product_type: normalizeCode(typeRaw || 'MENU_JUAL'),
    category: normalizeCode(categoryRaw || 'DIMSUM'),
    default_unit: String(firstValue(raw, ['default_unit', 'selling_unit', 'unit'], 'pcs')).trim() || 'pcs',
    selling_unit: String(firstValue(raw, ['selling_unit', 'default_unit', 'unit'], 'pcs')).trim() || 'pcs',
    production_unit: String(firstValue(raw, ['production_unit'], 'pcs')).trim() || 'pcs',
    price_pcs: pricePcs,
    price_porsi: pricePorsi,
    price_mika: priceMika,
    price_retail: toNumber(firstValue(raw, ['price_retail', 'harga_retail'], pricePorsi || pricePcs)),
    price_reseller: toNumber(firstValue(raw, ['price_reseller', 'harga_reseller'], 0)),
    price_mitra: toNumber(firstValue(raw, ['price_mitra', 'harga_mitra'], 0)),
    current_hpp: currentHpp,
    fallback_hpp: toNumber(firstValue(raw, ['fallback_hpp', 'hpp_default'], currentHpp)),
    minimum_selling_price: toNumber(firstValue(raw, ['minimum_selling_price', 'min_price'], 0)),
    target_margin_percent: toNumber(firstValue(raw, ['target_margin_percent', 'target_margin'], 0)),
    is_sellable: isSellable,
    is_stock_tracked: toBool(firstValue(raw, ['is_stock_tracked', 'stock_tracked'], true), true),
    is_production_output: isProductionOutput,
    is_production_item: toBool(firstValue(raw, ['is_production_item'], isProductionOutput), isProductionOutput),
    uses_adukan: usesAdukan,
    adukan_conversion_active: toBool(firstValue(raw, ['adukan_conversion_active'], usesAdukan), usesAdukan),
    is_resto_menu: toBool(firstValue(raw, ['is_resto_menu'], isSellable), isSellable),
    is_purchasable: toBool(firstValue(raw, ['is_purchasable'], false), false),
    production_process: String(firstValue(raw, ['production_process'], usesAdukan ? 'ADUKAN' : '')).trim(),
    default_yield_pcs: toNumber(firstValue(raw, ['default_yield_pcs', 'target_pcs_per_adukan'], usesAdukan ? 1000 : 0)),
    chicken_kg_per_adukan: toNumber(firstValue(raw, ['chicken_kg_per_adukan', 'ayam_kg_per_adukan'], usesAdukan ? 30 : 0)),
    pcs_per_porsi: toNumber(firstValue(raw, ['pcs_per_porsi'], 4)),
    pcs_per_mika: toNumber(firstValue(raw, ['pcs_per_mika'], 50)),
    status: isDeleted ? 'Deleted' : (statusRaw || 'Active'),
    isDeleted,
    notes: String(firstValue(raw, ['notes', 'catatan'], '')).trim(),
    search_text: normalizeSearch([productId, productCode, productName, typeRaw, categoryRaw, statusRaw].join(' ')),
    raw,
  };

  return normalized;
};

const statusTone = (status) => {
  const normalized = normalizeCode(status);
  if (['ACTIVE', 'AKTIF'].includes(normalized)) return 'green';
  if (['DELETED', 'VOID', 'NON_ACTIVE', 'INACTIVE'].includes(normalized)) return 'red';
  return 'amber';
};

const badgeClass = (tone = 'slate') => {
  const map = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    slate: 'border-slate-100 bg-slate-50 text-slate-600',
    dark: 'border-slate-800 bg-slate-950 text-white',
  };
  return map[tone] || map.slate;
};

const Badge = ({ children, tone = 'slate' }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${badgeClass(tone)}`}>
    {children}
  </span>
);

const StatCard = ({ title, value, subtitle, icon, tone = 'white' }) => {
  const toneMap = {
    red: 'bg-red-600 text-white',
    dark: 'bg-slate-950 text-white',
    gold: 'border border-amber-100 bg-amber-50 text-amber-900',
    white: 'border border-slate-100 bg-white text-slate-900',
  };

  return (
    <div className={`rounded-[1.75rem] p-5 shadow-sm ${toneMap[tone] || toneMap.white}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">{title}</div>
          <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
          {subtitle && <div className="mt-1 text-[11px] font-bold opacity-60">{subtitle}</div>}
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/80 p-3 text-red-600 shadow-sm">{icon}</div>
      </div>
    </div>
  );
};

const Field = ({ label, children, help }) => (
  <div>
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</label>
    {children}
    {help && <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">{help}</p>}
  </div>
);

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 disabled:bg-slate-50 disabled:text-slate-400';

const normalizeFormFromProduct = (product) => ({
  ...DEFAULT_FORM,
  ...product,
  product_type: product?.product_type || 'MENU_JUAL',
  category: product?.category || 'DIMSUM',
  default_unit: product?.default_unit || 'pcs',
  selling_unit: product?.selling_unit || 'pcs',
  production_unit: product?.production_unit || 'pcs',
  price_pcs: product?.price_pcs ? String(product.price_pcs) : '',
  price_porsi: product?.price_porsi ? String(product.price_porsi) : '',
  price_mika: product?.price_mika ? String(product.price_mika) : '',
  price_basis: product?.price_basis || 'PORSI',
  price_auto_calculate: product?.price_auto_calculate !== false,
  price_retail: product?.price_retail ? String(product.price_retail) : '',
  price_reseller: product?.price_reseller ? String(product.price_reseller) : '',
  price_mitra: product?.price_mitra ? String(product.price_mitra) : '',
  current_hpp: product?.current_hpp ? String(product.current_hpp) : '',
  fallback_hpp: product?.fallback_hpp ? String(product.fallback_hpp) : '',
  minimum_selling_price: product?.minimum_selling_price ? String(product.minimum_selling_price) : '',
  target_margin_percent: product?.target_margin_percent ? String(product.target_margin_percent) : '',
  default_yield_pcs: product?.default_yield_pcs ? String(product.default_yield_pcs) : '1000',
  chicken_kg_per_adukan: product?.chicken_kg_per_adukan ? String(product.chicken_kg_per_adukan) : '30',
  pcs_per_porsi: product?.pcs_per_porsi ? String(product.pcs_per_porsi) : '4',
  pcs_per_mika: product?.pcs_per_mika ? String(product.pcs_per_mika) : '50',
  status: product?.status || 'Active',
});

export default function TabMasterProduk(props) {
  const { sendToSheet, showToast } = props;
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [localProducts, setLocalProducts] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = JSON.parse(window.localStorage.getItem('dimsum_master_products_cache') || '[]');
      return Array.isArray(cached) ? cached.filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  });
  const activeProductTypeMeta = getProductTypeMeta(form.product_type);

  const rememberLocalProduct = (row, action = 'upsert') => {
    if (!row || typeof row !== 'object') return;

    setLocalProducts((prev) => {
      const map = new Map();
      [...safeArray(prev), row].forEach((item) => {
        const key = String(item.product_id || item.product_code || item.product_name || '').trim();
        if (!key) return;
        map.set(key, {
          ...(map.get(key) || {}),
          ...item,
          ...(action === 'delete' ? { status: 'Non Active', isDeleted: true, is_deleted: true } : {}),
        });
      });
      const next = Array.from(map.values());
      try {
        window.localStorage.setItem('dimsum_master_products_cache', JSON.stringify(next));
      } catch (error) {}
      return next;
    });
  };

  const productRecords = useMemo(() => {
    const uniqueMap = new Map();

    [...getRawProducts(props), ...safeArray(localProducts)]
      .map(normalizeProduct)
      .filter((product) => product.product_name || product.product_code || product.product_id)
      .forEach((product) => {
        const key = product.product_id || product.product_code || product.product_name;
        uniqueMap.set(key, product);
      });

    return Array.from(uniqueMap.values()).sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)));
  }, [props.masterProducts, props.master_products, props.products, props.dbData, localProducts]);

  const filteredProducts = useMemo(() => {
    const keyword = normalizeSearch(searchQuery);

    return productRecords.filter((product) => {
      const statusOk = statusFilter === 'ALL' || (statusFilter === 'ACTIVE'
        ? ['ACTIVE', 'AKTIF'].includes(normalizeCode(product.status)) && !product.isDeleted
        : statusFilter === 'NON_ACTIVE'
          ? !['ACTIVE', 'AKTIF'].includes(normalizeCode(product.status)) || product.isDeleted
          : true);
      const typeOk = typeFilter === 'ALL' || normalizeCode(product.product_type) === typeFilter;
      const categoryOk = categoryFilter === 'ALL' || normalizeCode(product.category) === categoryFilter;
      const searchOk = !keyword || product.search_text.includes(keyword);
      return statusOk && typeOk && categoryOk && searchOk;
    });
  }, [productRecords, searchQuery, statusFilter, typeFilter, categoryFilter]);

  const analytics = useMemo(() => {
    const active = productRecords.filter((item) => ['ACTIVE', 'AKTIF'].includes(normalizeCode(item.status)) && !item.isDeleted);
    const sellable = active.filter((item) => item.is_sellable);
    const adukan = active.filter((item) => item.uses_adukan || item.is_production_output || normalizeCode(item.production_process) === 'ADUKAN');
    const zeroPrice = sellable.filter((item) => toNumber(item.price_porsi || item.price_pcs || item.price_retail) <= 0);
    const noModal = active.filter((item) => (item.uses_adukan || item.is_stock_tracked) && toNumber(item.current_hpp || item.fallback_hpp) <= 0);

    return {
      total: productRecords.length,
      active: active.length,
      sellable: sellable.length,
      adukan: adukan.length,
      zeroPrice: zeroPrice.length,
      noModal: noModal.length,
    };
  }, [productRecords]);

  const selectedProduct = useMemo(() => {
    return productRecords.find((product) => (product.product_id || product.product_code || product.product_name) === selectedId) || filteredProducts[0] || null;
  }, [productRecords, filteredProducts, selectedId]);

  const openCreate = () => {
    setEditingId('');
    setForm(DEFAULT_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (product) => {
    setEditingId(product.product_id || product.product_code || product.product_name);
    setForm(normalizeFormFromProduct(product));
    setIsFormOpen(true);
  };

  const updateForm = (key, value) => {
    setForm((prev) => {
      let next = { ...prev, [key]: value };

      if (key === 'product_name' && !prev.product_code) {
        next.product_code = slugCode(value);
      }

      if (key === 'product_type') {
        next = applyProductTypeTemplate(next, value);
      }

      if (key === 'uses_adukan' || key === 'is_production_output') {
        const active = key === 'uses_adukan' ? value : (next.uses_adukan || value);
        if (active) {
          next.production_process = 'ADUKAN';
          next.is_stock_tracked = true;
          next.is_production_output = true;
          next.is_production_item = true;
          next.adukan_conversion_active = true;
          if (!next.default_yield_pcs) next.default_yield_pcs = '1000';
          if (!next.chicken_kg_per_adukan) next.chicken_kg_per_adukan = '30';
        }
      }

      if (['price_porsi', 'price_pcs', 'price_mika', 'price_basis', 'price_auto_calculate', 'pcs_per_porsi', 'pcs_per_mika'].includes(key)) {
        next = normalizePriceTriplet(next, key);
      }

      return next;
    });
  };

  const buildPayload = () => {
    const normalizedForm = normalizePriceTriplet(form, 'build');
    const productCode = slugCode(normalizedForm.product_code || normalizedForm.product_name);
    const productId = normalizedForm.product_id || `PROD-${productCode}`;
    const usesAdukan = Boolean(normalizedForm.uses_adukan || normalizedForm.is_production_output || normalizeCode(normalizedForm.production_process) === 'ADUKAN');

    return {
      ...normalizedForm,
      product_id: productId,
      product_code: productCode,
      product_name: String(normalizedForm.product_name || '').trim(),
      product_type: normalizeCode(normalizedForm.product_type || 'MENU_JUAL'),
      category: normalizeCode(normalizedForm.category || 'DIMSUM'),
      default_unit: normalizedForm.default_unit || 'pcs',
      selling_unit: normalizedForm.selling_unit || normalizedForm.default_unit || 'pcs',
      production_unit: normalizedForm.production_unit || 'pcs',
      price_basis: normalizeCode(normalizedForm.price_basis || 'PORSI'),
      price_auto_calculate: normalizedForm.price_auto_calculate !== false,
      price_pcs: toNumber(normalizedForm.price_pcs),
      price_porsi: toNumber(normalizedForm.price_porsi),
      price_mika: toNumber(normalizedForm.price_mika),
      price_retail: toNumber(normalizedForm.price_retail || normalizedForm.price_porsi || normalizedForm.price_pcs),
      price_reseller: toNumber(normalizedForm.price_reseller),
      price_mitra: toNumber(normalizedForm.price_mitra),
      selling_price: toNumber(normalizedForm.price_pcs || normalizedForm.price_retail || normalizedForm.price_porsi),
      retail_price: toNumber(normalizedForm.price_porsi || normalizedForm.price_retail || normalizedForm.price_pcs),
      wholesale_price: toNumber(normalizedForm.price_mitra || normalizedForm.price_reseller || normalizedForm.price_pcs),
      current_hpp: toNumber(normalizedForm.current_hpp),
      fallback_hpp: toNumber(normalizedForm.fallback_hpp || normalizedForm.current_hpp),
      minimum_selling_price: toNumber(normalizedForm.minimum_selling_price),
      target_margin_percent: toNumber(normalizedForm.target_margin_percent),
      is_sellable: Boolean(normalizedForm.is_sellable),
      is_stock_tracked: Boolean(normalizedForm.is_stock_tracked),
      is_production_output: Boolean(normalizedForm.is_production_output || usesAdukan),
      is_production_item: Boolean(normalizedForm.is_production_item || usesAdukan),
      uses_adukan: usesAdukan,
      adukan_conversion_active: Boolean(normalizedForm.adukan_conversion_active || usesAdukan),
      is_resto_menu: Boolean(normalizedForm.is_resto_menu || normalizedForm.is_sellable),
      is_purchasable: Boolean(normalizedForm.is_purchasable),
      production_process: usesAdukan ? 'ADUKAN' : normalizeCode(normalizedForm.production_process || ''),
      default_yield_pcs: toNumber(normalizedForm.default_yield_pcs),
      chicken_kg_per_adukan: toNumber(normalizedForm.chicken_kg_per_adukan),
      pcs_per_porsi: toNumber(normalizedForm.pcs_per_porsi || 4),
      pcs_per_mika: toNumber(normalizedForm.pcs_per_mika || 50),
      status: normalizedForm.status || 'Active',
      notes: normalizedForm.notes || '',
      updated_at: new Date().toISOString(),
    };
  };

  const validatePayload = (payload) => {
    const warnings = [];
    if (!payload.product_name) warnings.push('Nama produk wajib diisi.');
    if (!payload.product_code) warnings.push('Kode produk wajib diisi.');
    if (payload.is_sellable && !payload.price_porsi && !payload.price_pcs && !payload.price_retail) warnings.push('Produk dijual perlu harga jual agar Kasir tidak Rp0.');
    if (payload.uses_adukan && (!payload.default_yield_pcs || !payload.chicken_kg_per_adukan)) warnings.push('Produk adukan perlu target pcs dan ayam per adukan.');
    return warnings;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = buildPayload();
    const warnings = validatePayload(payload);

    if (warnings.length > 0) {
      if (typeof showToast === 'function') showToast(warnings.join('\n'), 'error');
      else window.alert(warnings.join('\n'));
      return;
    }

    if (typeof sendToSheet !== 'function') {
      window.alert('sendToSheet belum tersedia.');
      return;
    }

    const ok = await sendToSheet(editingId ? 'update' : 'insert', payload, PRODUCT_TABLE_NAME);
    if (ok) {
      rememberLocalProduct(payload, editingId ? 'update' : 'insert');
      setIsFormOpen(false);
      setEditingId('');
      setSelectedId(payload.product_id || payload.product_code || payload.product_name || '');
    }
  };

  const handleSoftDelete = async (product) => {
    if (!product) return;
    const confirmed = window.confirm(`Nonaktifkan produk ${product.product_name}? Produk tidak dihapus permanen.`);
    if (!confirmed) return;

    const ok = await sendToSheet('update', {
      ...product.raw,
      product_id: product.product_id,
      product_code: product.product_code,
      status: 'Non Active',
      isDeleted: true,
      is_deleted: true,
      updated_at: new Date().toISOString(),
    }, PRODUCT_TABLE_NAME);

    if (ok) {
      rememberLocalProduct({
        ...product.raw,
        ...product,
        status: 'Non Active',
        isDeleted: true,
        is_deleted: true,
        updated_at: new Date().toISOString(),
      }, 'delete');
      setSelectedId('');
      if (typeof showToast === 'function') showToast('Produk dinonaktifkan dari daftar aktif.', 'success');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-red-600/30 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-amber-400/20 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2 shadow-sm"><Package size={20} /></div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">Master Produk & Aturan Produksi</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">Master Produk</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Pusat pengaturan produk yang dijual, produk hasil adukan, harga, satuan, stok, dan patokan produksi. Bahasa UI dibuat operasional; jejak modal tetap disimpan untuk mesin keuangan.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white shadow-sm transition-all hover:bg-red-700"
          >
            <Plus size={16} /> Tambah Produk
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Total Produk" value={analytics.total} icon={<Package size={18} />} />
        <StatCard title="Aktif" value={analytics.active} icon={<CheckCircle size={18} />} tone="red" />
        <StatCard title="Bisa Dijual" value={analytics.sellable} icon={<ShoppingBag size={18} />} tone="gold" />
        <StatCard title="Pakai Adukan" value={analytics.adukan} icon={<Factory size={18} />} />
        <StatCard title="Harga Belum Beres" value={analytics.zeroPrice} icon={<AlertTriangle size={18} />} tone={analytics.zeroPrice > 0 ? 'gold' : 'white'} />
        <StatCard title="Modal Belum Beres" value={analytics.noModal} icon={<Wallet size={18} />} tone={analytics.noModal > 0 ? 'dark' : 'white'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Database size={17} className="text-red-600" /> Daftar Produk</h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">Klik produk untuk melihat detail. Produk adukan otomatis masuk pilihan Produksi/Adukan.</p>
                </div>
                <div className="flex flex-col gap-2 lg:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 lg:w-64" placeholder="Cari produk..." />
                  </div>
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={inputClass}>
                    <option value="ALL">Semua Jenis</option>
                    {PRODUCT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                  </select>
                  <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass}>
                    <option value="ALL">Semua Kategori</option>
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
                    <option value="ACTIVE">Aktif</option>
                    <option value="NON_ACTIVE">Nonaktif</option>
                    <option value="ALL">Semua</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    <th className="px-3 py-3 min-w-[260px]">Produk</th>
                    <th className="px-3 py-3">Jenis</th>
                    <th className="px-3 py-3">Harga</th>
                    <th className="px-3 py-3">Modal Patokan</th>
                    <th className="px-3 py-3">Produksi</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-xs font-bold text-slate-400">Belum ada produk yang cocok.</td></tr>
                  )}
                  {filteredProducts.map((product) => {
                    const key = product.product_id || product.product_code || product.product_name;
                    const isSelected = selectedProduct && (selectedProduct.product_id || selectedProduct.product_code || selectedProduct.product_name) === key;

                    return (
                      <tr key={key} onClick={() => setSelectedId(key)} className={`cursor-pointer border-b border-slate-50 text-xs font-bold transition-all hover:bg-red-50/40 ${isSelected ? 'bg-red-50/70' : ''}`}>
                        <td className="px-3 py-4">
                          <div className="max-w-[260px] whitespace-normal break-words font-black leading-snug text-slate-900">{product.product_name || '-'}</div>
                          <div className="mt-1 text-[10px] font-bold text-slate-400">{product.product_code || product.product_id || '-'}</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-col gap-1">
                            <Badge tone={product.is_sellable ? 'blue' : 'slate'}>{product.product_type || 'MENU'}</Badge>
                            <span className="text-[10px] text-slate-400">{product.category}</span>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-black text-emerald-700">Porsi {formatMoney(product.price_porsi)}</div>
                          <div className="text-[10px] text-slate-400">pcs {formatMoney(product.price_pcs)} · mika {formatMoney(product.price_mika)}</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-black text-slate-900">{formatMoney(product.current_hpp || product.fallback_hpp)}</div>
                          <div className="text-[10px] text-slate-400">patokan awal / modal terakhir</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-wrap gap-1">
                            {product.uses_adukan && <Badge tone="red">Adukan</Badge>}
                            {product.is_stock_tracked && <Badge tone="green">Stok</Badge>}
                            {product.is_sellable && <Badge tone="blue">Jual</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-4"><Badge tone={statusTone(product.status)}>{product.status || 'Active'}</Badge></td>
                        <td className="px-3 py-4">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={(event) => { event.stopPropagation(); openEdit(product); }} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600" title="Edit produk"><Edit2 size={14} /></button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); handleSoftDelete(product); }} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-red-100 hover:bg-red-50 hover:text-red-600" title="Nonaktifkan"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="sticky top-4 rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-black text-slate-900">Detail Produk</h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">Ringkasan operasional dan aturan produksi.</p>
              </div>
              {selectedProduct && <button type="button" onClick={() => openEdit(selectedProduct)} className="rounded-xl bg-red-50 p-2 text-red-600 hover:bg-red-100"><Edit2 size={15} /></button>}
            </div>

            {!selectedProduct ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs font-bold text-amber-800">Pilih produk untuk lihat detail.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xl font-black text-slate-900">{selectedProduct.product_name}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400">{selectedProduct.product_id || selectedProduct.product_code}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(selectedProduct.status)}>{selectedProduct.status}</Badge>
                  {selectedProduct.uses_adukan && <Badge tone="red">Pakai Adukan</Badge>}
                  {selectedProduct.is_sellable && <Badge tone="blue">Bisa Dijual</Badge>}
                  {selectedProduct.is_stock_tracked && <Badge tone="green">Pantau Stok</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase text-slate-400">Harga Porsi</div><div className="mt-1 text-sm font-black text-slate-900">{formatMoney(selectedProduct.price_porsi || selectedProduct.price_retail)}</div></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase text-slate-400">Harga PCS</div><div className="mt-1 text-sm font-black text-slate-900">{formatMoney(selectedProduct.price_pcs)}</div></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase text-slate-400">Modal Patokan</div><div className="mt-1 text-sm font-black text-slate-900">{formatMoney(selectedProduct.current_hpp || selectedProduct.fallback_hpp)}</div></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase text-slate-400">Satuan</div><div className="mt-1 text-sm font-black text-slate-900">{selectedProduct.selling_unit}</div></div>
                </div>

                {selectedProduct.uses_adukan && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-900">
                    <div className="mb-2 font-black uppercase tracking-[0.14em] text-red-600">Aturan Adukan</div>
                    <div className="grid grid-cols-2 gap-2">
                      <span>Ayam/adukan</span><strong className="text-right">{selectedProduct.chicken_kg_per_adukan || 30} kg</strong>
                      <span>Target hasil</span><strong className="text-right">{formatQty(selectedProduct.default_yield_pcs || 1000, 'pcs')}</strong>
                      <span>1 porsi</span><strong className="text-right">{selectedProduct.pcs_per_porsi || 4} pcs</strong>
                      <span>1 mika</span><strong className="text-right">{selectedProduct.pcs_per_mika || 50} pcs</strong>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold leading-relaxed text-emerald-900">
                  Alur: Master Produk → Produksi/Adukan atau Kasir/Order → Stok/Modal otomatis ikut aturan produk ini.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 p-5 backdrop-blur">
              <div>
                <h2 className="text-lg font-black text-slate-900">{editingId ? 'Edit Produk' : 'Tambah Produk'}</h2>
                <p className="mt-1 text-xs font-bold text-slate-400">Isi produk dengan bahasa operasional. Jenis produk menentukan produk muncul di Kasir, Produksi/Adukan, atau stok bahan.</p>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-2">
              <div className="space-y-4 rounded-[1.75rem] border border-slate-100 bg-slate-50/50 p-5">
                <h3 className="text-sm font-black text-slate-900">1. Identitas Produk</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Nama Produk"><input value={form.product_name} onChange={(e) => updateForm('product_name', e.target.value)} className={inputClass} placeholder="Contoh: Dimsum Ayam Mix" /></Field>
                  <Field label="Kode Produk"><input value={form.product_code} onChange={(e) => updateForm('product_code', slugCode(e.target.value))} className={inputClass} placeholder="DIMSUM_AYAM_MIX" /></Field>
                  <Field label="Jenis Produk" help="Pilih posisi produk di alur kerja. Sistem akan bantu set aturan default, tetap bisa kamu ubah manual.">
                    <select value={form.product_type} onChange={(e) => updateForm('product_type', e.target.value)} className={inputClass}>
                      {PRODUCT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                    </select>
                    <div className="mt-2 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-[11px] font-bold leading-relaxed text-blue-800">
                      <div className="font-black uppercase tracking-[0.12em]">{activeProductTypeMeta.label} · {activeProductTypeMeta.short}</div>
                      <div className="mt-1">{activeProductTypeMeta.description}</div>
                    </div>
                  </Field>
                  <Field label="Kategori"><select value={form.category} onChange={(e) => updateForm('category', e.target.value)} className={inputClass}>{CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}</select></Field>
                  <Field label="Status"><select value={form.status} onChange={(e) => updateForm('status', e.target.value)} className={inputClass}><option value="Active">Aktif</option><option value="Non Active">Nonaktif</option></select></Field>
                  <Field label="Satuan Utama"><input value={form.default_unit} onChange={(e) => updateForm('default_unit', e.target.value)} className={inputClass} placeholder="pcs" /></Field>
                </div>
              </div>

              <div className="space-y-4 rounded-[1.75rem] border border-slate-100 bg-slate-50/50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">2. Harga & Modal Patokan</h3>
                    <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-400">Isi satu harga utama, sistem otomatis hitung harga porsi/pcs/mika dari konversi.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateForm('price_auto_calculate', !form.price_auto_calculate)}
                    className={`rounded-2xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] ${form.price_auto_calculate ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}
                  >
                    {form.price_auto_calculate ? 'Auto Harga Aktif' : 'Override Manual'}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Harga utama dihitung dari">
                    <select value={form.price_basis || 'PORSI'} onChange={(e) => updateForm('price_basis', e.target.value)} className={inputClass}>
                      <option value="PORSI">Harga / Porsi</option>
                      <option value="PCS">Harga / PCS</option>
                      <option value="MIKA">Harga / Mika</option>
                    </select>
                  </Field>
                  <Field label="Harga Mitra / Reseller" help="Harga khusus boleh manual, tidak wajib ikut harga normal.">
                    <input value={form.price_mitra || form.price_reseller} onChange={(e) => { updateForm('price_mitra', e.target.value); updateForm('price_reseller', e.target.value); }} className={inputClass} placeholder="2000" />
                  </Field>
                  <Field label="Harga / Porsi"><input value={form.price_porsi} onChange={(e) => updateForm('price_porsi', e.target.value)} className={inputClass} placeholder="8500" /></Field>
                  <Field label="Harga / PCS"><input value={form.price_pcs} onChange={(e) => updateForm('price_pcs', e.target.value)} className={inputClass} placeholder="2125" /></Field>
                  <Field label="Harga / Mika"><input value={form.price_mika} onChange={(e) => updateForm('price_mika', e.target.value)} className={inputClass} placeholder="106250" /></Field>
                  <Field label="Modal Patokan / PCS" help="Fallback saja. Modal final dari produksi tetap pakai lot/adukan."><input value={form.current_hpp || form.fallback_hpp} onChange={(e) => { updateForm('current_hpp', e.target.value); updateForm('fallback_hpp', e.target.value); }} className={inputClass} placeholder="1080" /></Field>
                  <Field label="Target Margin %"><input value={form.target_margin_percent} onChange={(e) => updateForm('target_margin_percent', e.target.value)} className={inputClass} placeholder="30" /></Field>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-[11px] font-bold leading-relaxed text-amber-900">
                  Contoh: isi Harga / Porsi Rp8.500 → Harga / PCS Rp2.125 → Harga / Mika Rp106.250. Harga Mitra/Reseller tetap boleh disesuaikan manual.
                </div>
              </div>

              <div className="space-y-4 rounded-[1.75rem] border border-slate-100 bg-slate-50/50 p-5">
                <h3 className="text-sm font-black text-slate-900">3. Aturan Stok & Produksi</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    ['is_sellable', 'Bisa dijual di Kasir'],
                    ['is_stock_tracked', 'Stok dipantau'],
                    ['uses_adukan', 'Pakai proses Adukan'],
                    ['is_production_output', 'Hasil produksi/adukan'],
                    ['is_resto_menu', 'Menu outlet/resto'],
                    ['is_purchasable', 'Dibeli dari supplier'],
                  ].map(([key, label]) => (
                    <button key={key} type="button" onClick={() => updateForm(key, !form[key])} className={`flex items-center justify-between rounded-2xl border p-4 text-left text-xs font-black transition-all ${form[key] ? 'border-red-100 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                      <span>{label}</span>
                      <span>{form[key] ? 'YA' : 'TIDAK'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-[1.75rem] border border-slate-100 bg-slate-50/50 p-5">
                <h3 className="text-sm font-black text-slate-900">4. Konversi Adukan</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Ayam / Adukan"><input value={form.chicken_kg_per_adukan} onChange={(e) => updateForm('chicken_kg_per_adukan', e.target.value)} className={inputClass} placeholder="30" /></Field>
                  <Field label="Target Hasil / Adukan"><input value={form.default_yield_pcs} onChange={(e) => updateForm('default_yield_pcs', e.target.value)} className={inputClass} placeholder="1000" /></Field>
                  <Field label="PCS / Porsi"><input value={form.pcs_per_porsi} onChange={(e) => updateForm('pcs_per_porsi', e.target.value)} className={inputClass} placeholder="4" /></Field>
                  <Field label="PCS / Mika"><input value={form.pcs_per_mika} onChange={(e) => updateForm('pcs_per_mika', e.target.value)} className={inputClass} placeholder="50" /></Field>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold text-emerald-900">
                  Produk yang dicentang “Pakai proses Adukan” akan muncul otomatis di menu Produksi/Adukan.
                </div>
              </div>

              <div className="xl:col-span-2">
                <Field label="Catatan"><textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Catatan internal produk..." /></Field>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-white/95 p-5 backdrop-blur">
              <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black text-slate-500 hover:bg-slate-50">Batal</button>
              <button type="submit" className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white shadow-sm hover:bg-red-700"><Save size={16} /> Simpan Produk</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
