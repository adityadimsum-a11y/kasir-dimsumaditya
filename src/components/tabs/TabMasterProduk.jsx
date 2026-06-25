import React, { useMemo, useState } from 'react';
import {
  PackageCheck,
  Plus,
  Save,
  X,
  Edit2,
  Trash2,
  Power,
  RotateCcw,
  Search,
  Filter,
  Building2,
  Warehouse,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Barcode,
  Scale,
  ReceiptText,
  TrendingUp,
  History,
  Crown,
  BadgeDollarSign,
  Image as ImageIcon,
  Utensils,
  Flame,
  Snowflake,
  Boxes,
  Coffee,
  Layers,
  ShoppingBag,
  Factory,
  Store,
  BadgeCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';
import { calculateGrossProfit } from '../../utils/hppEngine';
import { listKnownUnits } from '../../utils/conversionEngine';

const PRODUCT_TABLE_NAME = 'master_products';

const PRODUCT_CATEGORIES = [
  'DIMSUM',
  'DIMSUM_GORENG',
  'DIMSUM_BAKAR',
  'PANGSIT',
  'BAKPAO',
  'MINUMAN',
  'MAKANAN',
  'SAUS',
  'TOPPING',
  'FROZEN',
  'PAKET',
  'ADDON',
  'UMUM',
];

const HALAL_STATUS = [
  'HALAL',
  'PENDING',
  'NON_HALAL',
  'NOT_APPLICABLE',
];

const PRODUCT_STATUS = [
  'ACTIVE',
  'NON_ACTIVE',
];

const DEFAULT_UNIT_OPTIONS = [
  'PCS',
  'PACK',
  'DUS',
  'PORSI',
  'GRAM',
  'KG',
  'ML',
  'LITER',
];

const DEFAULT_FORM = {
  id: '',
  product_id: '',
  product_code: '',
  product_name: '',
  product_category: 'DIMSUM',
  branch_id: '',
  default_warehouse_id: '',
  selling_unit: 'PCS',
  production_unit: 'PCS',
  conversion_rule_id: '',
  selling_price: '',
  minimum_selling_price: '',
  target_margin_percent: '',
  current_hpp: '',
  current_stock: '',
  status: 'ACTIVE',
  barcode: '',
  halal_status: 'HALAL',
  is_production_item: true,
  is_sellable: true,
  is_purchasable: false,
  photo_url: '',
  notes: '',
};

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
};

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

const roundMoney = (value) => {
  return Math.round(toNumber(value) * 100) / 100;
};

const roundQty = (value) => {
  return Math.round(toNumber(value) * 1000) / 1000;
};

const formatMoney = (value) => {
  return `Rp${roundMoney(value).toLocaleString('id-ID')}`;
};

const formatQty = (value, unit = '') => {
  return `${roundQty(value).toLocaleString('id-ID')} ${unit || ''}`.trim();
};

const normalizeDate = (value) => {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

  return parsed.toISOString().substring(0, 10);
};

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;

  const normalized = normalizeCode(value);
  if (['TRUE', 'YES', 'YA', 'Y', '1', 'ACTIVE', 'AKTIF'].includes(normalized)) return true;
  if (['FALSE', 'NO', 'TIDAK', 'N', '0', 'NON_ACTIVE', 'INACTIVE'].includes(normalized)) return false;

  return fallback;
};

const isSoftDeleted = (row) => {
  const value = row?.isDeleted ?? row?.is_deleted ?? row?.deleted;
  return value === true || String(value || '').toUpperCase() === 'TRUE';
};

const normalizeStatus = (row) => {
  if (isSoftDeleted(row)) return 'SOFT_DELETED';

  const value = row?.status ?? row?.product_status ?? row?.status_active ?? row?.is_active;

  if (value === false) return 'NON_ACTIVE';
  if (value === true) return 'ACTIVE';

  const normalized = normalizeCode(value || 'ACTIVE');

  if (['NON_ACTIVE', 'NONAKTIF', 'INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N', '0'].includes(normalized)) {
    return 'NON_ACTIVE';
  }

  return 'ACTIVE';
};

const parseJson = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch (error) {
    return fallback;
  }
};

const getRawProductRows = ({
  masterProducts,
  master_products,
  masterProduct,
  master_product,
  products,
  produk,
  dbData,
}) => {
  if (Array.isArray(master_products)) return master_products;
  if (Array.isArray(masterProducts)) return masterProducts;
  if (Array.isArray(masterProduct)) return masterProduct;
  if (Array.isArray(master_product)) return master_product;
  if (Array.isArray(products)) return products;
  if (Array.isArray(produk)) return produk;

  if (Array.isArray(dbData?.master_products)) return dbData.master_products;
  if (Array.isArray(dbData?.masterProducts)) return dbData.masterProducts;
  if (Array.isArray(dbData?.master_product)) return dbData.master_product;
  if (Array.isArray(dbData?.products)) return dbData.products;
  if (Array.isArray(dbData?.produk)) return dbData.produk;

  return [];
};

const getRawBranchRows = ({
  masterBranches,
  master_branches,
  master_branch,
  branches,
  dbData,
}) => {
  if (Array.isArray(master_branches)) return master_branches;
  if (Array.isArray(masterBranches)) return masterBranches;
  if (Array.isArray(master_branch)) return master_branch;
  if (Array.isArray(branches)) return branches;

  if (Array.isArray(dbData?.master_branches)) return dbData.master_branches;
  if (Array.isArray(dbData?.masterBranches)) return dbData.masterBranches;
  if (Array.isArray(dbData?.master_branch)) return dbData.master_branch;
  if (Array.isArray(dbData?.branches)) return dbData.branches;

  return [];
};

const getRawWarehouseRows = ({
  masterWarehouses,
  master_warehouses,
  masterLocations,
  master_locations,
  warehouses,
  locations,
  dbData,
}) => {
  if (Array.isArray(master_warehouses)) return master_warehouses;
  if (Array.isArray(masterWarehouses)) return masterWarehouses;
  if (Array.isArray(master_locations)) return master_locations;
  if (Array.isArray(masterLocations)) return masterLocations;
  if (Array.isArray(warehouses)) return warehouses;
  if (Array.isArray(locations)) return locations;

  if (Array.isArray(dbData?.master_warehouses)) return dbData.master_warehouses;
  if (Array.isArray(dbData?.masterWarehouses)) return dbData.masterWarehouses;
  if (Array.isArray(dbData?.master_locations)) return dbData.master_locations;
  if (Array.isArray(dbData?.masterLocations)) return dbData.masterLocations;
  if (Array.isArray(dbData?.warehouses)) return dbData.warehouses;
  if (Array.isArray(dbData?.locations)) return dbData.locations;

  return [];
};

const getRawConversionRules = ({ masterConversionRules, master_conversion_rules, conversionRules, conversion_rules, dbData }) => {
  if (Array.isArray(master_conversion_rules)) return master_conversion_rules;
  if (Array.isArray(masterConversionRules)) return masterConversionRules;
  if (Array.isArray(conversion_rules)) return conversion_rules;
  if (Array.isArray(conversionRules)) return conversionRules;

  if (Array.isArray(dbData?.master_conversion_rules)) return dbData.master_conversion_rules;
  if (Array.isArray(dbData?.masterConversionRules)) return dbData.masterConversionRules;
  if (Array.isArray(dbData?.conversion_rules)) return dbData.conversion_rules;
  if (Array.isArray(dbData?.conversionRules)) return dbData.conversionRules;

  return [];
};

const getRawSalesRows = ({ orders, salesPackages, sales_packages, dbData }) => {
  const rows = [];

  if (Array.isArray(orders)) rows.push(...orders);
  if (Array.isArray(salesPackages)) rows.push(...salesPackages);
  if (Array.isArray(sales_packages)) rows.push(...sales_packages);

  if (Array.isArray(dbData?.orders)) rows.push(...dbData.orders);
  if (Array.isArray(dbData?.salesPackages)) rows.push(...dbData.salesPackages);
  if (Array.isArray(dbData?.sales_packages)) rows.push(...dbData.sales_packages);

  return rows;
};

const getRawInventoryLayers = ({ inventoryCostLayers, inventory_cost_layers, costLayers, cost_layers, dbData }) => {
  if (Array.isArray(inventory_cost_layers)) return inventory_cost_layers;
  if (Array.isArray(inventoryCostLayers)) return inventoryCostLayers;
  if (Array.isArray(cost_layers)) return cost_layers;
  if (Array.isArray(costLayers)) return costLayers;

  if (Array.isArray(dbData?.inventory_cost_layers)) return dbData.inventory_cost_layers;
  if (Array.isArray(dbData?.inventoryCostLayers)) return dbData.inventoryCostLayers;
  if (Array.isArray(dbData?.cost_layers)) return dbData.cost_layers;
  if (Array.isArray(dbData?.costLayers)) return dbData.costLayers;

  return [];
};

const normalizeBranchDisplay = (record) => {
  const raw = record?.raw || record || {};

  const branchId = String(
    raw.branch_id ||
    raw.branchId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  return {
    id: String(raw.id || branchId).trim(),
    branch_id: branchId,
    branch_code: String(raw.branch_code || raw.branchCode || raw.code || branchId || '').trim(),
    branch_name: String(raw.branch_name || raw.branchName || raw.nama_cabang || raw.name || record?.name || branchId || '').trim(),
    branch_type: normalizeCode(raw.branch_type || raw.branchType || raw.type || ''),
    status: normalizeStatus({
      status: raw.branch_status || raw.status,
      is_active: raw.is_active,
      isDeleted: raw.isDeleted,
    }),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeWarehouseDisplay = (record) => {
  const raw = record?.raw || record || {};

  const warehouseId = String(
    raw.warehouse_id ||
    raw.warehouseId ||
    raw.location_id ||
    raw.locationId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  return {
    id: String(raw.id || warehouseId).trim(),
    warehouse_id: warehouseId,
    warehouse_code: String(raw.warehouse_code || raw.warehouseCode || raw.location_code || raw.locationCode || raw.code || warehouseId || '').trim(),
    warehouse_name: String(raw.warehouse_name || raw.warehouseName || raw.location_name || raw.locationName || raw.nama_gudang || raw.name || record?.name || '').trim(),
    warehouse_type: normalizeCode(raw.warehouse_type || raw.warehouseType || raw.location_type || raw.type || 'FINISHED_GOODS'),
    branch_id: String(raw.branch_id || raw.branchId || raw.scope_branch_id || record?.branch_id || '').trim(),
    status: normalizeStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeConversionRuleDisplay = (record) => {
  const raw = record?.raw || record || {};

  const ruleId = String(
    raw.rule_id ||
    raw.ruleId ||
    raw.conversion_rule_id ||
    raw.conversionRuleId ||
    raw.conversion_id ||
    raw.id ||
    '',
  ).trim();

  const fromUnit = normalizeCode(raw.from_unit || raw.fromUnit || raw.unit_from || raw.dari_satuan || '');
  const toUnit = normalizeCode(raw.to_unit || raw.toUnit || raw.unit_to || raw.ke_satuan || '');
  const factor = toNumber(raw.factor || raw.conversion_factor || raw.ratio || raw.nilai || 0);

  return {
    id: ruleId,
    rule_id: ruleId,
    code: String(raw.rule_code || raw.code || ruleId || '').trim(),
    name: String(raw.rule_name || raw.name || `${fromUnit || '-'} → ${toUnit || '-'}`).trim(),
    from_unit: fromUnit,
    to_unit: toUnit,
    factor,
    branch_id: String(raw.branch_id || raw.branchId || '').trim(),
    status: normalizeStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeProductDisplay = (record) => {
  const raw = record?.raw || record || {};

  const productId = String(
    raw.product_id ||
    raw.productId ||
    raw.item_id ||
    raw.itemId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  const productCode = String(
    raw.product_code ||
    raw.productCode ||
    raw.item_code ||
    raw.itemCode ||
    raw.sku ||
    raw.code ||
    record?.code ||
    productId ||
    '',
  ).trim();

  const productName = String(
    raw.product_name ||
    raw.productName ||
    raw.item_name ||
    raw.itemName ||
    raw.nama_produk ||
    raw.name ||
    record?.name ||
    '',
  ).trim();

  const branchId = String(raw.branch_id || raw.branchId || raw.scope_branch_id || record?.branch_id || '').trim();

  const defaultWarehouseId = String(
    raw.default_warehouse_id ||
    raw.defaultWarehouseId ||
    raw.warehouse_default ||
    raw.warehouse_id ||
    raw.warehouseId ||
    '',
  ).trim();

  const status = normalizeStatus(raw);

  return {
    id: String(raw.id || productId).trim(),

    product_id: productId,
    product_code: productCode,
    product_name: productName,

    item_id: String(raw.item_id || productId).trim(),
    item_name: String(raw.item_name || productName).trim(),

    product_category: normalizeCode(raw.product_category || raw.productCategory || raw.category || raw.kategori || 'UMUM'),

    branch_id: branchId,
    default_warehouse_id: defaultWarehouseId,
    warehouse_id: defaultWarehouseId,

    selling_unit: normalizeCode(raw.selling_unit || raw.sellingUnit || raw.unit_jual || raw.unit || raw.satuan || ''),
    production_unit: normalizeCode(raw.production_unit || raw.productionUnit || raw.unit_produksi || raw.unit || raw.satuan || ''),

    conversion_rule_id: String(raw.conversion_rule_id || raw.conversionRuleId || raw.rule_id || '').trim(),

    selling_price: roundMoney(raw.selling_price || raw.price || raw.harga_jual || 0),
    minimum_selling_price: roundMoney(raw.minimum_selling_price || raw.min_selling_price || raw.harga_minimum || 0),
    target_margin_percent: toNumber(raw.target_margin_percent || raw.target_margin || raw.margin_target || 0),

    current_hpp: roundMoney(raw.current_hpp || raw.hpp || raw.hpp_current || raw.current_cost || 0),
    current_stock: roundQty(raw.current_stock || raw.stock || raw.qty || 0),

    status,

    barcode: String(raw.barcode || raw.bar_code || raw.sku_barcode || '').trim(),
    halal_status: normalizeCode(raw.halal_status || raw.halalStatus || 'HALAL'),

    is_production_item: toBool(raw.is_production_item ?? raw.isProductionItem ?? raw.production_item, true),
    is_sellable: toBool(raw.is_sellable ?? raw.isSellable ?? raw.sellable, true),
    is_purchasable: toBool(raw.is_purchasable ?? raw.isPurchasable ?? raw.purchasable, false),

    photo_url: String(raw.photo_url || raw.photoUrl || raw.image_url || raw.imageUrl || '').trim(),
    notes: String(raw.notes || raw.keterangan || raw.description || '').trim(),

    created_at: raw.created_at || '',
    updated_at: raw.updated_at || '',
    date: raw.date || raw.created_at || raw.updated_at || '',

    isDeleted: isSoftDeleted(raw),

    search_text: normalizeText([
      productId,
      productCode,
      productName,
      raw.nama_produk,
      raw.item_name,
      raw.product_category,
      raw.category,
      branchId,
      defaultWarehouseId,
      raw.barcode,
      raw.halal_status,
    ].filter(Boolean).join(' ')),

    raw,
  };
};

const productKeyCandidates = (product) => {
  return [
    normalizeCode(product.product_id),
    normalizeCode(product.item_id),
    normalizeText(product.product_name),
    normalizeText(product.item_name),
    normalizeCode(product.product_code),
    normalizeCode(product.barcode),
  ].filter(Boolean);
};

const itemMatchesProduct = (item, product) => {
  const keys = new Set(productKeyCandidates(product));

  const itemId = normalizeCode(item.item_id || item.product_id || item.id || '');
  const itemName = normalizeText(item.item_name || item.product_name || item.name || '');
  const itemCode = normalizeCode(item.item_code || item.product_code || item.sku || '');

  if (itemId && keys.has(itemId)) return true;
  if (itemCode && keys.has(itemCode)) return true;
  if (itemName && keys.has(itemName)) return true;

  return false;
};

const normalizeSalesRecord = (row) => {
  const packageInput = row?.sales_transaction_package || row?.salesTransactionPackage || row || {};
  const header = packageInput.order_header || row?.order_header || row || {};
  const snapshot = packageInput.sales_snapshot || parseJson(header.sales_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.order_snapshot || snapshot?.payload || null;
  const snapshotHeader = snapshotPayload?.order_header || snapshotPayload?.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const items = packageInput.order_items ||
    snapshotPayload?.order_items ||
    snapshotPayload?.transaction_items ||
    row?.order_items ||
    parseJson(header.items_json, []) ||
    parseJson(header.itemsJson, []) ||
    [];

  return {
    order_id: String(finalHeader.order_id || finalHeader.id || row?.id || '').trim(),
    invoice_number: String(finalHeader.invoice_number || finalHeader.no_invoice || '').trim(),
    customer_id: String(finalHeader.customer_id || finalHeader.customerId || '').trim(),
    customer_name: String(finalHeader.customer_name || finalHeader.customerName || '').trim(),
    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),
    order_date: normalizeDate(finalHeader.order_date || finalHeader.date || finalHeader.created_at || row?.date || ''),
    sales_channel: normalizeCode(finalHeader.sales_channel || finalHeader.salesChannel || ''),
    items: Array.isArray(items)
      ? items.map((item) => {
          const qty = toNumber(item.qty || item.quantity || 0);
          const subtotal = roundMoney(item.subtotal || item.total || item.total_amount || qty * toNumber(item.selling_price || item.price || item.unit_price || 0));
          const totalHpp = roundMoney(item.total_hpp || item.hpp_total || item.hpp || item.cogs || 0);

          return {
            item_id: String(item.item_id || item.product_id || item.id || '').trim(),
            item_code: String(item.item_code || item.product_code || item.sku || '').trim(),
            item_name: String(item.item_name || item.product_name || item.name || '').trim(),
            qty,
            unit: normalizeCode(item.unit || item.satuan || ''),
            selling_price: roundMoney(item.selling_price || item.price || item.unit_price || 0),
            subtotal,
            total_hpp: totalHpp,
            gross_profit: roundMoney(item.gross_profit !== undefined ? item.gross_profit : subtotal - totalHpp),
          };
        })
      : [],
    raw: row,
  };
};

const normalizeInventoryLayer = (row) => {
  const raw = row || {};

  return {
    layer_id: String(raw.layer_id || raw.id || '').trim(),
    item_id: String(raw.item_id || raw.product_id || '').trim(),
    item_name: String(raw.item_name || raw.product_name || raw.name || '').trim(),
    branch_id: String(raw.branch_id || raw.branchId || '').trim(),
    warehouse_id: String(raw.warehouse_id || raw.warehouseId || '').trim(),
    category: normalizeCode(raw.category || raw.item_category || ''),
    qty_remaining: roundQty(raw.qty_remaining ?? raw.remaining_qty ?? raw.qty ?? 0),
    qty_original: roundQty(raw.qty_original ?? raw.original_qty ?? raw.qty ?? 0),
    unit: normalizeCode(raw.unit || raw.satuan || ''),
    unit_cost: roundMoney(raw.unit_cost || raw.cost || raw.hpp || 0),
    received_date: normalizeDate(raw.received_date || raw.production_date || raw.date || raw.created_at || ''),
    status: normalizeStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const calculateProductMetrics = (product, salesRecords, inventoryLayers) => {
  const productSalesItems = salesRecords.flatMap((sale) => {
    return (sale.items || [])
      .filter((item) => itemMatchesProduct(item, product))
      .map((item) => ({
        ...item,
        order_id: sale.order_id,
        order_date: sale.order_date,
        branch_id: sale.branch_id,
        sales_channel: sale.sales_channel,
      }));
  });

  const productLayers = inventoryLayers.filter((layer) => itemMatchesProduct(layer, product));

  const stockFromLayers = productLayers.reduce((sum, layer) => {
    if (layer.isDeleted || layer.status === 'SOFT_DELETED') return sum;
    return sum + toNumber(layer.qty_remaining);
  }, 0);

  const currentStock = stockFromLayers > 0
    ? roundQty(stockFromLayers)
    : roundQty(product.current_stock);

  const totalPenjualan = roundMoney(productSalesItems.reduce((sum, item) => sum + toNumber(item.subtotal), 0));
  const totalHpp = roundMoney(productSalesItems.reduce((sum, item) => sum + toNumber(item.total_hpp), 0));
  const totalProfit = roundMoney(productSalesItems.reduce((sum, item) => sum + toNumber(item.gross_profit), 0));
  const totalQtySold = roundQty(productSalesItems.reduce((sum, item) => sum + toNumber(item.qty), 0));

  const lastSalesDate = productSalesItems
    .map((item) => item.order_date)
    .filter(Boolean)
    .sort()
    .pop() || '';

  const latestLayer = [...productLayers]
    .filter((layer) => layer.unit_cost > 0)
    .sort((a, b) => String(a.received_date).localeCompare(String(b.received_date)))
    .pop() || null;

  const inferredHpp = totalQtySold > 0 && totalHpp > 0
    ? totalHpp / totalQtySold
    : latestLayer?.unit_cost || 0;

  const currentHpp = product.current_hpp > 0
    ? product.current_hpp
    : inferredHpp;

  const gross = calculateGrossProfit({
    totalRevenue: product.selling_price,
    totalHpp: currentHpp,
  });

  const actualMarginPercent = gross.gross_margin_pct || 0;

  return {
    current_stock: currentStock,
    current_hpp: roundMoney(currentHpp),
    selling_price: roundMoney(product.selling_price),
    target_margin_percent: toNumber(product.target_margin_percent),
    actual_margin_percent: actualMarginPercent,
    total_penjualan: totalPenjualan,
    total_hpp: totalHpp,
    total_profit: totalProfit,
    total_qty_sold: totalQtySold,
    sales_count: productSalesItems.length,
    last_sales_date: lastSalesDate,
    below_minimum_price: product.minimum_selling_price > 0 && product.selling_price < product.minimum_selling_price,
    margin_warning: product.target_margin_percent > 0 && actualMarginPercent < product.target_margin_percent,
  };
};

const getCategoryIcon = (category) => {
  const normalized = normalizeCode(category);

  if (normalized === 'DIMSUM') return <Utensils size={18} />;
  if (normalized === 'DIMSUM_GORENG') return <Flame size={18} />;
  if (normalized === 'DIMSUM_BAKAR') return <Flame size={18} />;
  if (normalized === 'PANGSIT') return <Utensils size={18} />;
  if (normalized === 'BAKPAO') return <PackageCheck size={18} />;
  if (normalized === 'MINUMAN') return <Coffee size={18} />;
  if (normalized === 'SAUS') return <Layers size={18} />;
  if (normalized === 'TOPPING') return <Layers size={18} />;
  if (normalized === 'FROZEN') return <Snowflake size={18} />;
  if (normalized === 'PAKET') return <Boxes size={18} />;

  return <PackageCheck size={18} />;
};

const Badge = ({ children, tone = 'slate' }) => {
  const toneMap = {
    red: 'bg-red-50 text-red-700 border-red-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    dark: 'bg-slate-900 text-white border-slate-900',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${toneMap[tone] || toneMap.slate}`}>
      {children}
    </span>
  );
};

const StatCard = ({ title, value, icon, tone = 'white', subtitle = '' }) => {
  const toneMap = {
    red: 'bg-red-600 text-white',
    white: 'bg-white text-slate-800 border border-slate-100',
    gold: 'bg-amber-50 text-amber-800 border border-amber-100',
    dark: 'bg-slate-950 text-white',
  };

  return (
    <div className={`rounded-3xl p-5 shadow-sm ${toneMap[tone] || toneMap.white}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{title}</div>
          <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
          {subtitle && (
            <div className="mt-1 text-[11px] font-bold opacity-70">{subtitle}</div>
          )}
        </div>
        <div className="p-3 rounded-2xl bg-white/80 text-red-600 shadow-sm border border-white/50">
          {icon}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children, required = false }) => (
  <div>
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
      {label} {required && <span className="text-red-600">*</span>}
    </label>
    {children}
  </div>
);

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 disabled:bg-slate-50 disabled:text-slate-400';

export default function TabMasterProduk({
  masterProducts = [],
  master_products,
  masterProduct,
  master_product,
  products,
  produk,

  masterBranches = [],
  master_branches,
  master_branch,
  branches,

  masterWarehouses = [],
  master_warehouses,
  masterLocations,
  master_locations,
  warehouses,
  locations,

  masterConversionRules = [],
  master_conversion_rules,
  conversionRules,
  conversion_rules,

  orders = [],
  salesPackages,
  sales_packages,

  inventoryCostLayers,
  inventory_cost_layers,
  costLayers,
  cost_layers,

  dbData = {},
  sendToSheet,
  showToast,
  user,
}) {
  const todayStr = getTodayStr();

  const isOwnerMode = useMemo(() => {
    const role = normalizeCode(user?.role || user?.user_role || '');
    const branchType = normalizeCode(user?.branch_type || user?.branchType || '');
    const branchId = normalizeCode(user?.branch_id || user?.branchId || '');

    return [
      'OWNER',
      'SUPER_ADMIN',
      'ADMIN_PUSAT',
      'HEAD_OFFICE',
      'HQ',
      'DEWA',
      'AKUN_DEWA',
    ].includes(role) ||
      ['HEAD_OFFICE', 'HQ_FACTORY', 'HQ'].includes(branchType) ||
      ['TANGERANG', 'TANGERANG_HO', 'HO_TANGERANG'].includes(branchId);
  }, [user]);

  const userBranchId = String(user?.branch_id || user?.branchId || '').trim();

  const [form, setForm] = useState({
    ...DEFAULT_FORM,
    branch_id: isOwnerMode ? '' : userBranchId,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const rawProductRows = useMemo(() => {
    return getRawProductRows({
      masterProducts,
      master_products,
      masterProduct,
      master_product,
      products,
      produk,
      dbData,
    });
  }, [masterProducts, master_products, masterProduct, master_product, products, produk, dbData]);

  const rawBranchRows = useMemo(() => {
    return getRawBranchRows({
      masterBranches,
      master_branches,
      master_branch,
      branches,
      dbData,
    });
  }, [masterBranches, master_branches, master_branch, branches, dbData]);

  const rawWarehouseRows = useMemo(() => {
    return getRawWarehouseRows({
      masterWarehouses,
      master_warehouses,
      masterLocations,
      master_locations,
      warehouses,
      locations,
      dbData,
    });
  }, [masterWarehouses, master_warehouses, masterLocations, master_locations, warehouses, locations, dbData]);

  const rawRuleRows = useMemo(() => {
    return getRawConversionRules({
      masterConversionRules,
      master_conversion_rules,
      conversionRules,
      conversion_rules,
      dbData,
    });
  }, [masterConversionRules, master_conversion_rules, conversionRules, conversion_rules, dbData]);

  const rawSales = useMemo(() => {
    return getRawSalesRows({
      orders,
      salesPackages,
      sales_packages,
      dbData,
    }).map(normalizeSalesRecord);
  }, [orders, salesPackages, sales_packages, dbData]);

  const rawLayers = useMemo(() => {
    return getRawInventoryLayers({
      inventoryCostLayers,
      inventory_cost_layers,
      costLayers,
      cost_layers,
      dbData,
    }).map(normalizeInventoryLayer);
  }, [inventoryCostLayers, inventory_cost_layers, costLayers, cost_layers, dbData]);

  const masterSource = useMemo(() => ({
    ...(dbData || {}),
    master_products: rawProductRows,
    masterProducts: rawProductRows,
    products: rawProductRows,

    master_branches: rawBranchRows,
    masterBranches: rawBranchRows,
    master_branch: rawBranchRows,

    master_warehouses: rawWarehouseRows,
    masterWarehouses: rawWarehouseRows,
    master_locations: rawWarehouseRows,
    masterLocations: rawWarehouseRows,
    warehouses: rawWarehouseRows,
    locations: rawWarehouseRows,

    master_conversion_rules: rawRuleRows,
    masterConversionRules: rawRuleRows,
    conversion_rules: rawRuleRows,
    conversionRules: rawRuleRows,
  }), [dbData, rawProductRows, rawBranchRows, rawWarehouseRows, rawRuleRows]);

  const branchRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getBranches(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeBranchDisplay)
      .filter((branch) => !branch.isDeleted)
      .sort((a, b) => String(a.branch_name).localeCompare(String(b.branch_name)));
  }, [masterSource]);

  const activeBranchRecords = useMemo(() => {
    return branchRecords.filter((branch) => branch.status === 'ACTIVE');
  }, [branchRecords]);

  const branchNameById = useMemo(() => {
    const map = new Map();

    branchRecords.forEach((branch) => {
      map.set(branch.branch_id, branch.branch_name || branch.branch_id);
      map.set(branch.branch_code, branch.branch_name || branch.branch_id);
    });

    return map;
  }, [branchRecords]);

  const warehouseRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getWarehouses(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeWarehouseDisplay)
      .filter((warehouse) => !warehouse.isDeleted)
      .sort((a, b) => String(a.warehouse_name).localeCompare(String(b.warehouse_name)));
  }, [masterSource]);

  const conversionRuleRecords = useMemo(() => {
    return rawRuleRows
      .map(normalizeConversionRuleDisplay)
      .filter((rule) => !rule.isDeleted && rule.status === 'ACTIVE')
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [rawRuleRows]);

  const unitOptions = useMemo(() => {
    try {
      const units = listKnownUnits(masterSource, {
        includeDefaultUnits: true,
      });

      const result = Array.isArray(units)
        ? units
        : Array.isArray(units?.units)
          ? units.units
          : [];

      return Array.from(new Set([
        ...DEFAULT_UNIT_OPTIONS,
        ...result.map((unit) => normalizeCode(unit.unit || unit.code || unit)).filter(Boolean),
        ...conversionRuleRecords.flatMap((rule) => [rule.from_unit, rule.to_unit]).filter(Boolean),
      ])).sort();
    } catch (error) {
      return Array.from(new Set([
        ...DEFAULT_UNIT_OPTIONS,
        ...conversionRuleRecords.flatMap((rule) => [rule.from_unit, rule.to_unit]).filter(Boolean),
      ])).sort();
    }
  }, [masterSource, conversionRuleRecords]);

  const productRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getProducts(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeProductDisplay)
      .map((product) => ({
        ...product,
        metrics: calculateProductMetrics(product, rawSales, rawLayers),
      }))
      .sort((a, b) => {
        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
        if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
        if ((a.metrics.margin_warning || a.metrics.below_minimum_price) && !(b.metrics.margin_warning || b.metrics.below_minimum_price)) return -1;
        if (!(a.metrics.margin_warning || a.metrics.below_minimum_price) && (b.metrics.margin_warning || b.metrics.below_minimum_price)) return 1;
        return String(a.product_name).localeCompare(String(b.product_name));
      });
  }, [masterSource, rawSales, rawLayers]);

  const searchResultIds = useMemo(() => {
    const keyword = searchQuery.trim();

    if (!keyword) return new Set();

    const result = erpOrchestrator.masterData.searchMaster(masterSource, {
      masterType: 'PRODUCT',
      keyword,
      includeInactive: true,
      includeDeleted: true,
    }, {
      validate: false,
    });

    return new Set((result.records || []).flatMap((record) => {
      const product = normalizeProductDisplay(record);
      return [
        product.id,
        product.product_id,
        product.product_code,
        product.barcode,
      ].filter(Boolean);
    }));
  }, [masterSource, searchQuery]);

  const effectiveBranchFilter = !isOwnerMode && userBranchId ? userBranchId : branchFilter;

  const filteredProducts = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return productRecords.filter((product) => {
      const statusOk = statusFilter === 'ALL'
        ? !product.isDeleted
        : statusFilter === 'SOFT_DELETED'
          ? product.isDeleted || product.status === 'SOFT_DELETED'
          : product.status === statusFilter && !product.isDeleted;

      const categoryOk = categoryFilter === 'ALL' || product.product_category === categoryFilter;
      const branchOk = effectiveBranchFilter === 'ALL' || product.branch_id === effectiveBranchFilter;

      const searchOk = !keyword ||
        product.search_text.includes(keyword) ||
        searchResultIds.has(product.id) ||
        searchResultIds.has(product.product_id) ||
        searchResultIds.has(product.product_code) ||
        searchResultIds.has(product.barcode);

      return statusOk && categoryOk && branchOk && searchOk;
    });
  }, [productRecords, searchQuery, searchResultIds, statusFilter, categoryFilter, effectiveBranchFilter]);

  const activeWarehousesByBranch = useMemo(() => {
    return warehouseRecords.filter((warehouse) => {
      if (warehouse.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return warehouse.branch_id === form.branch_id;
    });
  }, [warehouseRecords, form.branch_id]);

  const warehouseNameById = useMemo(() => {
    const map = new Map();

    warehouseRecords.forEach((warehouse) => {
      map.set(warehouse.warehouse_id, warehouse.warehouse_name || warehouse.warehouse_id);
      map.set(warehouse.warehouse_code, warehouse.warehouse_name || warehouse.warehouse_id);
    });

    return map;
  }, [warehouseRecords]);

  const analytics = useMemo(() => {
    const visible = productRecords.filter((product) => !product.isDeleted);
    const scoped = visible.filter((product) => {
      if (effectiveBranchFilter === 'ALL') return true;
      return product.branch_id === effectiveBranchFilter;
    });

    const active = scoped.filter((product) => product.status === 'ACTIVE').length;
    const sellable = scoped.filter((product) => product.is_sellable).length;
    const productionItems = scoped.filter((product) => product.is_production_item).length;
    const warningCount = scoped.filter((product) => product.metrics.margin_warning || product.metrics.below_minimum_price).length;

    const totalPenjualan = scoped.reduce((sum, product) => sum + product.metrics.total_penjualan, 0);
    const totalProfit = scoped.reduce((sum, product) => sum + product.metrics.total_profit, 0);
    const totalStockValue = scoped.reduce((sum, product) => {
      return sum + toNumber(product.metrics.current_stock) * toNumber(product.metrics.current_hpp);
    }, 0);

    const topProduct = [...scoped].sort((a, b) => b.metrics.total_penjualan - a.metrics.total_penjualan)[0] || null;
    const mostProfitable = [...scoped].sort((a, b) => b.metrics.total_profit - a.metrics.total_profit)[0] || null;

    return {
      total: scoped.length,
      active,
      sellable,
      production_items: productionItems,
      warning_count: warningCount,
      deleted: productRecords.filter((product) => product.isDeleted || product.status === 'SOFT_DELETED').length,
      total_penjualan: roundMoney(totalPenjualan),
      total_profit: roundMoney(totalProfit),
      total_stock_value: roundMoney(totalStockValue),
      top_product: topProduct,
      most_profitable: mostProfitable,
    };
  }, [productRecords, effectiveBranchFilter]);

  const notify = (message, type = 'success') => {
    if (typeof showToast === 'function') {
      showToast(message, type);
      return;
    }

    if (type === 'error') {
      window.alert(message);
    }
  };

  const resetForm = () => {
    setForm({
      ...DEFAULT_FORM,
      branch_id: isOwnerMode ? '' : userBranchId,
    });
    setIsEditing(false);
    setSelectedProduct(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('PRD', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      product_id: prev.product_id || newId,
      product_code: prev.product_code || newId,
      barcode: prev.barcode || newId,
    }));
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setIsEditing(true);

    setForm({
      id: product.id || product.product_id,
      product_id: product.product_id,
      product_code: product.product_code,
      product_name: product.product_name,
      product_category: product.product_category || 'UMUM',
      branch_id: product.branch_id,
      default_warehouse_id: product.default_warehouse_id,
      selling_unit: product.selling_unit || 'PCS',
      production_unit: product.production_unit || product.selling_unit || 'PCS',
      conversion_rule_id: product.conversion_rule_id,
      selling_price: String(product.selling_price || ''),
      minimum_selling_price: String(product.minimum_selling_price || ''),
      target_margin_percent: String(product.target_margin_percent || ''),
      current_hpp: String(product.metrics.current_hpp || product.current_hpp || ''),
      current_stock: String(product.metrics.current_stock || product.current_stock || ''),
      status: product.status === 'SOFT_DELETED' ? 'NON_ACTIVE' : product.status || 'ACTIVE',
      barcode: product.barcode,
      halal_status: product.halal_status || 'HALAL',
      is_production_item: Boolean(product.is_production_item),
      is_sellable: Boolean(product.is_sellable),
      is_purchasable: Boolean(product.is_purchasable),
      photo_url: product.photo_url,
      notes: product.notes,
    });
  };

  const validateForm = () => {
    const warnings = [];

    if (!form.product_id.trim()) warnings.push('Product ID wajib diisi.');
    if (!form.product_code.trim()) warnings.push('Product Code wajib diisi.');
    if (!form.product_name.trim()) warnings.push('Nama produk wajib diisi.');
    if (!form.product_category.trim()) warnings.push('Kategori produk wajib dipilih.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih. Produk tidak boleh orphan.');
    if (!form.default_warehouse_id.trim()) warnings.push('Default Warehouse wajib dipilih. Produk tidak boleh tanpa gudang.');
    if (!form.selling_unit.trim()) warnings.push('Selling Unit wajib diisi.');
    if (!form.production_unit.trim()) warnings.push('Production Unit wajib diisi.');
    if (!form.status.trim()) warnings.push('Status produk wajib dipilih.');
    if (!form.halal_status.trim()) warnings.push('Halal Status wajib dipilih.');

    const branchExists = branchRecords.some((branch) => {
      return branch.branch_id === form.branch_id && !branch.isDeleted;
    });

    if (form.branch_id && !branchExists) {
      warnings.push('Branch ID tidak ditemukan di Master Cabang. Produk wajib terhubung ke cabang resmi.');
    }

    const warehouseExists = warehouseRecords.some((warehouse) => {
      return warehouse.warehouse_id === form.default_warehouse_id &&
        warehouse.branch_id === form.branch_id &&
        !warehouse.isDeleted;
    });

    if (form.default_warehouse_id && !warehouseExists) {
      warnings.push('Default Warehouse tidak ditemukan di cabang yang dipilih. Produk wajib punya gudang resmi.');
    }

    if (!isOwnerMode && userBranchId && form.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh membuat/mengedit produk di branch miliknya.');
    }

    if (toNumber(form.selling_price) < 0) warnings.push('Selling price tidak boleh negatif.');
    if (toNumber(form.minimum_selling_price) < 0) warnings.push('Minimum selling price tidak boleh negatif.');
    if (toNumber(form.target_margin_percent) < 0) warnings.push('Target margin tidak boleh negatif.');
    if (toNumber(form.current_hpp) < 0) warnings.push('Current HPP tidak boleh negatif.');
    if (toNumber(form.current_stock) < 0) warnings.push('Current stock tidak boleh negatif.');

    if (form.is_sellable && toNumber(form.selling_price) <= 0) {
      warnings.push('Produk sellable wajib memiliki selling price lebih dari 0.');
    }

    if (toNumber(form.minimum_selling_price) > 0 && toNumber(form.selling_price) < toNumber(form.minimum_selling_price)) {
      warnings.push('Selling price tidak boleh lebih rendah dari minimum selling price.');
    }

    if (!form.is_production_item && !form.is_purchasable) {
      warnings.push('Produk harus minimal production item atau purchasable item.');
    }

    if (form.conversion_rule_id) {
      const ruleExists = conversionRuleRecords.some((rule) => {
        return rule.rule_id === form.conversion_rule_id;
      });

      if (!ruleExists) {
        warnings.push('Conversion rule tidak ditemukan atau tidak aktif.');
      }
    }

    const targetId = normalizeCode(form.product_id);
    const targetCode = normalizeCode(form.product_code);
    const targetBranch = form.branch_id;

    const duplicateId = productRecords.find((product) => {
      if (isEditing && product.product_id === selectedProduct?.product_id) return false;
      if (product.isDeleted) return false;
      return normalizeCode(product.product_id) === targetId && product.branch_id === targetBranch;
    });

    const duplicateCode = productRecords.find((product) => {
      if (isEditing && product.product_id === selectedProduct?.product_id) return false;
      if (product.isDeleted) return false;
      return normalizeCode(product.product_code) === targetCode && product.branch_id === targetBranch;
    });

    if (duplicateId) warnings.push(`Product ID sudah dipakai oleh ${duplicateId.product_name} di cabang yang sama.`);
    if (duplicateCode) warnings.push(`Product Code sudah dipakai oleh ${duplicateCode.product_name} di cabang yang sama.`);

    return warnings;
  };

  const createPayload = (override = {}) => {
    const productId = String(form.product_id || selectedProduct?.product_id || generateId('PRD', todayStr)).trim();
    const productName = normalizeText(form.product_name);
    const now = new Date().toISOString();
    const status = normalizeCode(form.status);

    return {
      ...(selectedProduct?.raw || {}),

      id: selectedProduct?.id || productId,
      date: selectedProduct?.date || todayStr,

      product_id: productId,
      product_code: normalizeCode(form.product_code || productId),
      product_name: productName,

      item_id: productId,
      item_code: normalizeCode(form.product_code || productId),
      item_name: productName,

      product_category: normalizeCode(form.product_category),
      category: normalizeCode(form.product_category),
      kategori: normalizeCode(form.product_category),

      branch_id: normalizeCode(form.branch_id),

      default_warehouse_id: normalizeCode(form.default_warehouse_id),
      warehouse_id: normalizeCode(form.default_warehouse_id),

      selling_unit: normalizeCode(form.selling_unit),
      production_unit: normalizeCode(form.production_unit),
      unit: normalizeCode(form.selling_unit),
      satuan: normalizeCode(form.selling_unit),

      conversion_rule_id: form.conversion_rule_id.trim(),

      selling_price: roundMoney(form.selling_price),
      price: roundMoney(form.selling_price),
      harga_jual: roundMoney(form.selling_price),

      minimum_selling_price: roundMoney(form.minimum_selling_price),
      min_selling_price: roundMoney(form.minimum_selling_price),

      target_margin_percent: toNumber(form.target_margin_percent),
      target_margin: toNumber(form.target_margin_percent),

      current_hpp: roundMoney(form.current_hpp),
      hpp: roundMoney(form.current_hpp),
      current_stock: roundQty(form.current_stock),
      stock: roundQty(form.current_stock),

      status,
      product_status: status,
      status_active: status === 'ACTIVE',
      is_active: status === 'ACTIVE',
      isDeleted: false,

      barcode: form.barcode.trim(),

      halal_status: normalizeCode(form.halal_status),

      is_production_item: Boolean(form.is_production_item),
      isProductionItem: Boolean(form.is_production_item),
      is_sellable: Boolean(form.is_sellable),
      isSellable: Boolean(form.is_sellable),
      is_purchasable: Boolean(form.is_purchasable),
      isPurchasable: Boolean(form.is_purchasable),

      photo_url: form.photo_url.trim(),
      image_url: form.photo_url.trim(),

      notes: form.notes.trim(),
      keterangan: form.notes.trim(),

      created_at: selectedProduct?.raw?.created_at || now,
      created_by: selectedProduct?.raw?.created_by || user?.name || user?.email || 'SYSTEM',
      updated_at: now,
      updated_by: user?.name || user?.email || 'SYSTEM',

      ...override,
    };
  };

  const persistProduct = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data produk belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, PRODUCT_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, PRODUCT_TABLE_NAME);
      } catch (error) {
        isSuccess = false;
      }
    }

    return Boolean(isSuccess);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const warnings = validateForm();

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const payload = createPayload();
    const action = isEditing ? 'update' : 'insert';

    const isSuccess = await persistProduct(action, payload);

    if (isSuccess) {
      notify(isEditing ? 'Master produk berhasil diperbarui.' : 'Produk baru berhasil ditambahkan.', 'success');
      resetForm();
    }
  };

  const handleToggleStatus = async (product) => {
    const nextStatus = product.status === 'ACTIVE' ? 'NON_ACTIVE' : 'ACTIVE';

    const confirmed = window.confirm(
      `${nextStatus === 'NON_ACTIVE' ? 'Nonaktifkan' : 'Aktifkan ulang'} produk ${product.product_name}?`,
    );

    if (!confirmed) return;

    const payload = {
      ...(product.raw || {}),
      id: product.id || product.product_id,
      product_id: product.product_id,
      product_status: nextStatus,
      status: nextStatus,
      status_active: nextStatus === 'ACTIVE',
      is_active: nextStatus === 'ACTIVE',
      isDeleted: false,
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistProduct('update', payload);

    if (isSuccess) {
      notify(nextStatus === 'ACTIVE' ? 'Produk berhasil diaktifkan ulang.' : 'Produk berhasil dinonaktifkan.', 'success');
    }
  };

  const handleSoftDelete = async (product) => {
    const confirmed = window.confirm(
      `Soft delete produk ${product.product_name}? Data tidak dihapus permanen, hanya disembunyikan dari transaksi aktif.`,
    );

    if (!confirmed) return;

    const payload = {
      ...(product.raw || {}),
      id: product.id || product.product_id,
      product_id: product.product_id,
      product_status: 'NON_ACTIVE',
      status: 'NON_ACTIVE',
      status_active: false,
      is_active: false,
      isDeleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.name || user?.email || 'SYSTEM',
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistProduct('update', payload);

    if (isSuccess) {
      notify('Produk berhasil di-soft delete.', 'success');
      if (selectedProduct?.product_id === product.product_id) resetForm();
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/30 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-amber-400/20 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2 shadow-sm">
                <PackageCheck size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Master Produk ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Pusat Data Produk Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Semua sales, produksi, BOM, HPP, dan profit wajib memakai produk resmi yang terhubung ke cabang dan gudang.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{isOwnerMode ? 'Owner Mode Lintas Cabang' : 'Branch Mode'}</Badge>
            <Badge tone="amber">HPP & Margin Ready</Badge>
            <Badge tone="green">Sellable Control</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Produk" value={analytics.total} icon={<PackageCheck size={18} />} tone="white" />
        <StatCard title="Aktif" value={analytics.active} icon={<CheckCircle size={18} />} tone="red" />
        <StatCard title="Sellable" value={analytics.sellable} icon={<ShoppingBag size={18} />} tone="gold" />
        <StatCard title="Total Penjualan" value={formatMoney(analytics.total_penjualan)} icon={<ReceiptText size={18} />} tone="white" />
        <StatCard title="Total Profit" value={formatMoney(analytics.total_profit)} icon={<TrendingUp size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Top Product</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.top_product?.product_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatMoney(analytics.top_product?.metrics?.total_penjualan || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <BadgeDollarSign size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Most Profitable</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.most_profitable?.product_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Profit {formatMoney(analytics.most_profitable?.metrics?.total_profit || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Price / Margin Warning</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.warning_count}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Produk di bawah target margin/minimum price
              </div>
            </div>
          </div>
        </div>
      </div>

      {analytics.warning_count > 0 && (
        <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-amber-900">MARGIN WARNING</h2>
                <p className="mt-1 text-xs font-bold text-amber-700">
                  Ada {analytics.warning_count} produk dengan actual margin di bawah target margin atau selling price di bawah minimum selling price.
                </p>
              </div>
            </div>
            <Badge tone="amber">Cek pricing produk</Badge>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  {isEditing ? <Edit2 size={16} className="text-red-600" /> : <Plus size={16} className="text-red-600" />}
                  {isEditing ? 'Edit Produk' : 'Tambah Produk'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Produk resmi untuk sales, produksi, BOM, HPP, dan profit.
                </p>
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Product ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditing}
                      value={form.product_id}
                      onChange={(event) => setForm({ ...form, product_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="PRD-001"
                    />
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={handleGenerateId}
                        className="shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-3 text-[10px] font-black text-amber-700 transition-all hover:bg-amber-100"
                      >
                        ID
                      </button>
                    )}
                  </div>
                </Field>

                <Field label="Product Code" required>
                  <input
                    value={form.product_code}
                    onChange={(event) => setForm({ ...form, product_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="DIMSUM-AYAM-4"
                  />
                </Field>
              </div>

              <Field label="Nama Produk" required>
                <input
                  value={form.product_name}
                  onChange={(event) => setForm({ ...form, product_name: event.target.value })}
                  className={inputClass}
                  placeholder="Dimsum Ayam Mix isi 4"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Kategori" required>
                  <select
                    value={form.product_category}
                    onChange={(event) => setForm({ ...form, product_category: event.target.value })}
                    className={inputClass}
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Status" required>
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                    className={inputClass}
                  >
                    {PRODUCT_STATUS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Cabang Terhubung" required>
                <select
                  disabled={!isOwnerMode && Boolean(userBranchId)}
                  value={form.branch_id}
                  onChange={(event) => setForm({
                    ...form,
                    branch_id: event.target.value,
                    default_warehouse_id: '',
                  })}
                  className={inputClass}
                >
                  <option value="">Pilih cabang resmi</option>
                  {activeBranchRecords.map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name} — {branch.branch_id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Default Warehouse" required>
                <select
                  value={form.default_warehouse_id}
                  onChange={(event) => setForm({ ...form, default_warehouse_id: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Pilih gudang resmi</option>
                  {activeWarehousesByBranch.map((warehouse) => (
                    <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                      {warehouse.warehouse_name} — {warehouse.warehouse_id}
                    </option>
                  ))}
                </select>
                {form.branch_id && activeWarehousesByBranch.length === 0 && (
                  <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
                    Belum ada gudang aktif untuk cabang ini. Tambahkan Master Gudang dulu.
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Selling Unit" required>
                  <select
                    value={form.selling_unit}
                    onChange={(event) => setForm({ ...form, selling_unit: event.target.value })}
                    className={inputClass}
                  >
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Production Unit" required>
                  <select
                    value={form.production_unit}
                    onChange={(event) => setForm({ ...form, production_unit: event.target.value })}
                    className={inputClass}
                  >
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Conversion Rule">
                <select
                  value={form.conversion_rule_id}
                  onChange={(event) => setForm({ ...form, conversion_rule_id: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Tanpa rule khusus</option>
                  {conversionRuleRecords.map((rule) => (
                    <option key={rule.rule_id} value={rule.rule_id}>
                      {rule.name} — {rule.from_unit || '-'} → {rule.to_unit || '-'}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Selling Price" required>
                  <input
                    value={form.selling_price}
                    onChange={(event) => setForm({ ...form, selling_price: event.target.value })}
                    className={inputClass}
                    placeholder="15000"
                  />
                </Field>

                <Field label="Minimum Selling Price">
                  <input
                    value={form.minimum_selling_price}
                    onChange={(event) => setForm({ ...form, minimum_selling_price: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Target Margin %">
                  <input
                    value={form.target_margin_percent}
                    onChange={(event) => setForm({ ...form, target_margin_percent: event.target.value })}
                    className={inputClass}
                    placeholder="30"
                  />
                </Field>

                <Field label="Current HPP">
                  <input
                    value={form.current_hpp}
                    onChange={(event) => setForm({ ...form, current_hpp: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>

                <Field label="Current Stock">
                  <input
                    value={form.current_stock}
                    onChange={(event) => setForm({ ...form, current_stock: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label="Halal Status" required>
                <select
                  value={form.halal_status}
                  onChange={(event) => setForm({ ...form, halal_status: event.target.value })}
                  className={inputClass}
                >
                  {HALAL_STATUS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_production_item: !form.is_production_item })}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                    form.is_production_item
                      ? 'border-red-100 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Factory size={16} />
                    {form.is_production_item ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </div>
                  <div className="mt-2 text-[10px] font-black uppercase tracking-[0.14em]">Production</div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_sellable: !form.is_sellable })}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                    form.is_sellable
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Store size={16} />
                    {form.is_sellable ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </div>
                  <div className="mt-2 text-[10px] font-black uppercase tracking-[0.14em]">Sellable</div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_purchasable: !form.is_purchasable })}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                    form.is_purchasable
                      ? 'border-amber-100 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <ShoppingBag size={16} />
                    {form.is_purchasable ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </div>
                  <div className="mt-2 text-[10px] font-black uppercase tracking-[0.14em]">Purchasable</div>
                </button>
              </div>

              <Field label="Barcode">
                <input
                  value={form.barcode}
                  onChange={(event) => setForm({ ...form, barcode: event.target.value })}
                  className={inputClass}
                  placeholder="Barcode / QR Code"
                />
              </Field>

              <Field label="Photo URL">
                <input
                  value={form.photo_url}
                  onChange={(event) => setForm({ ...form, photo_url: event.target.value })}
                  className={inputClass}
                  placeholder="https://..."
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan produk..."
                />
              </Field>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
              >
                <Save size={16} />
                {isEditing ? 'Simpan Perubahan' : 'Tambah Produk'}
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-8">
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <ShieldCheck size={17} className="text-red-600" />
                    Daftar Produk Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Master resmi untuk Sales, Production, BOM, HPP, dan Profit.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari produk, kode, barcode..."
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                      >
                        <option value="ALL">SEMUA AKTIF/NONAKTIF</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="NON_ACTIVE">NON_ACTIVE</option>
                        <option value="SOFT_DELETED">SOFT_DELETED</option>
                      </select>
                    </div>

                    <select
                      disabled={!isOwnerMode && Boolean(userBranchId)}
                      value={effectiveBranchFilter}
                      onChange={(event) => {
                        if (isOwnerMode) setBranchFilter(event.target.value);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500 disabled:bg-slate-50"
                    >
                      <option value="ALL">SEMUA CABANG</option>
                      {branchRecords.map((branch) => (
                        <option key={branch.branch_id} value={branch.branch_id}>
                          {branch.branch_name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA KATEGORI</option>
                      {PRODUCT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1580px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Produk</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang / Gudang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Satuan</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Harga & HPP</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Margin</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Flags</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Analytics</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <PackageCheck size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Produk tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau tambahkan produk baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredProducts.map((product) => {
                    const isDeleted = product.isDeleted || product.status === 'SOFT_DELETED';
                    const isActive = product.status === 'ACTIVE' && !isDeleted;
                    const branchName = branchNameById.get(product.branch_id) || 'Branch tidak ditemukan';
                    const warehouseName = warehouseNameById.get(product.default_warehouse_id) || 'Gudang tidak ditemukan';

                    const isOrphanBranch = !branchNameById.has(product.branch_id);
                    const isOrphanWarehouse = !warehouseNameById.has(product.default_warehouse_id);
                    const hasWarning = product.metrics.margin_warning || product.metrics.below_minimum_price;

                    return (
                      <tr key={`${product.product_id}-${product.product_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl ${hasWarning ? 'bg-amber-500 text-white' : isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {product.photo_url ? (
                                <img src={product.photo_url} alt={product.product_name} className="h-full w-full object-cover" />
                              ) : (
                                getCategoryIcon(product.product_category)
                              )}
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{product.product_name || '-'}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{product.product_id || '-'}</Badge>
                                <Badge tone="amber">{product.product_code || '-'}</Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Badge tone={product.product_category === 'DIMSUM' ? 'red' : product.product_category === 'FROZEN' ? 'purple' : 'slate'}>
                                  {product.product_category || '-'}
                                </Badge>
                                {product.barcode && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-500">
                                    <Barcode size={11} />
                                    {product.barcode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2 text-[11px] font-bold">
                            <div className="flex items-start gap-2">
                              <Building2 size={14} className={isOrphanBranch ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-slate-400'} />
                              <div>
                                <div className={isOrphanBranch ? 'text-red-600' : 'text-slate-800'}>{branchName}</div>
                                <div className="text-slate-400">{product.branch_id || '-'}</div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <Warehouse size={14} className={isOrphanWarehouse ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-slate-400'} />
                              <div>
                                <div className={isOrphanWarehouse ? 'text-red-600' : 'text-slate-800'}>{warehouseName}</div>
                                <div className="text-slate-400">{product.default_warehouse_id || '-'}</div>
                              </div>
                            </div>

                            {(isOrphanBranch || isOrphanWarehouse) && (
                              <Badge tone="red">ORPHAN</Badge>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1.5 text-[11px] font-bold">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-400">
                                <Scale size={12} />
                                Selling
                              </span>
                              <span className="text-slate-900">{product.selling_unit || '-'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-400">
                                <Factory size={12} />
                                Production
                              </span>
                              <span className="text-slate-900">{product.production_unit || '-'}</span>
                            </div>
                            <div className="mt-2 text-xs font-black text-slate-900">
                              Stock {formatQty(product.metrics.current_stock, product.selling_unit)}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-bold">
                            <div className="text-slate-400">Selling</div>
                            <div className="text-right text-slate-900">{formatMoney(product.selling_price)}</div>

                            <div className="text-slate-400">Min</div>
                            <div className={`text-right ${product.metrics.below_minimum_price ? 'text-red-600' : 'text-slate-900'}`}>
                              {formatMoney(product.minimum_selling_price)}
                            </div>

                            <div className="text-slate-400">HPP</div>
                            <div className="text-right text-slate-900">{formatMoney(product.metrics.current_hpp)}</div>

                            <div className="text-slate-400">Value</div>
                            <div className="text-right text-emerald-700">
                              {formatMoney(product.metrics.current_stock * product.metrics.current_hpp)}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">
                            {product.metrics.actual_margin_percent.toFixed(1)}%
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Target {product.target_margin_percent || 0}%
                          </div>
                          {product.metrics.margin_warning && (
                            <div className="mt-2">
                              <Badge tone="amber">MARGIN WARNING</Badge>
                            </div>
                          )}
                          {product.metrics.below_minimum_price && (
                            <div className="mt-2">
                              <Badge tone="red">BELOW MIN PRICE</Badge>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1.5">
                            <Badge tone={product.is_production_item ? 'red' : 'slate'}>
                              {product.is_production_item ? 'PRODUCTION' : 'NON PRODUCTION'}
                            </Badge>
                            <Badge tone={product.is_sellable ? 'green' : 'slate'}>
                              {product.is_sellable ? 'SELLABLE' : 'NOT SELLABLE'}
                            </Badge>
                            <Badge tone={product.is_purchasable ? 'amber' : 'slate'}>
                              {product.is_purchasable ? 'PURCHASABLE' : 'NOT PURCHASABLE'}
                            </Badge>
                            <Badge tone={product.halal_status === 'HALAL' ? 'green' : product.halal_status === 'PENDING' ? 'amber' : 'slate'}>
                              <span className="inline-flex items-center gap-1">
                                <BadgeCheck size={10} />
                                {product.halal_status || '-'}
                              </span>
                            </Badge>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-bold">
                            <div className="text-slate-400">Penjualan</div>
                            <div className="text-right text-slate-900">{formatMoney(product.metrics.total_penjualan)}</div>

                            <div className="text-slate-400">Profit</div>
                            <div className="text-right text-emerald-700">{formatMoney(product.metrics.total_profit)}</div>

                            <div className="text-slate-400">Qty Sold</div>
                            <div className="text-right text-slate-900">{formatQty(product.metrics.total_qty_sold, product.selling_unit)}</div>

                            <div className="text-slate-400">Last Sales</div>
                            <div className="text-right text-slate-900">
                              {product.metrics.last_sales_date ? formatDate(product.metrics.last_sales_date) : '-'}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isDeleted ? 'dark' : isActive ? 'green' : 'amber'}>
                            {isDeleted ? 'SOFT_DELETED' : product.status}
                          </Badge>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                            <History size={12} />
                            {product.updated_at ? formatDate(product.updated_at) : product.date ? formatDate(product.date) : '-'}
                          </div>
                          {product.photo_url && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                              <ImageIcon size={12} />
                              Photo
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {!isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(product)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit produk"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(product)}
                                  className={`rounded-xl border p-2 transition-all ${
                                    isActive
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                  title={isActive ? 'Nonaktifkan produk' : 'Aktifkan produk'}
                                >
                                  {isActive ? <Power size={15} /> : <RotateCcw size={15} />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSoftDelete(product)}
                                  className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                  title="Soft delete produk"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}

                            {isDeleted && (
                              <Badge tone="dark">Locked</Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
              <div className="text-[11px] font-bold text-slate-400">
                Menampilkan <span className="text-slate-800">{filteredProducts.length}</span> dari <span className="text-slate-800">{productRecords.length}</span> data produk.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Aktif / Produk Kunci</Badge>
                <Badge tone="amber">Gold = Margin Warning</Badge>
                <Badge tone="purple">Frozen / Kategori Khusus</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
