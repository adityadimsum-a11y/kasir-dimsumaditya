import React, { useMemo, useState } from 'react';
import {
  Package,
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
  Truck,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Barcode,
  Scale,
  Ruler,
  ReceiptText,
  TrendingUp,
  History,
  Crown,
  CookingPot,
  Flame,
  Droplets,
  Fuel,
  Boxes,
  Layers,
  Activity,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';
import { listKnownUnits } from '../../utils/conversionEngine';

const RAW_MATERIAL_TABLE_NAME = 'master_raw_materials';

const RAW_MATERIAL_CATEGORIES = [
  'AYAM',
  'TEPUNG',
  'BUMBU',
  'TOPPING',
  'KEMASAN',
  'SAUS',
  'MINYAK',
  'GAS',
  'BAHAN_TAMBAHAN',
  'UMUM',
];

const DEFAULT_UNIT_OPTIONS = [
  'KG',
  'GRAM',
  'PCS',
  'PACK',
  'DUS',
  'LITER',
  'ML',
];

const MATERIAL_STATUS = [
  'ACTIVE',
  'NON_ACTIVE',
];

const DEFAULT_FORM = {
  id: '',
  raw_material_id: '',
  raw_material_code: '',
  raw_material_name: '',
  category: 'UMUM',
  branch_id: '',
  default_warehouse_id: '',
  base_unit: 'GRAM',
  purchase_unit: 'KG',
  production_unit: 'GRAM',
  conversion_rule_id: '',
  current_stock: '',
  minimum_stock: '',
  reorder_point: '',
  preferred_supplier_id: '',
  average_cost: '',
  latest_cost: '',
  status: 'ACTIVE',
  barcode: '',
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

const isSoftDeleted = (row) => {
  const value = row?.isDeleted ?? row?.is_deleted ?? row?.deleted;
  return value === true || String(value || '').toUpperCase() === 'TRUE';
};

const normalizeStatus = (row) => {
  if (isSoftDeleted(row)) return 'SOFT_DELETED';

  const value = row?.status ?? row?.raw_material_status ?? row?.status_active ?? row?.is_active;

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

const getRawMaterialRows = ({
  masterRawMaterials,
  master_raw_materials,
  masterRawMaterial,
  master_raw_material,
  rawMaterials,
  raw_materials,
  bahan_baku,
  dbData,
}) => {
  if (Array.isArray(master_raw_materials)) return master_raw_materials;
  if (Array.isArray(masterRawMaterials)) return masterRawMaterials;
  if (Array.isArray(masterRawMaterial)) return masterRawMaterial;
  if (Array.isArray(master_raw_material)) return master_raw_material;
  if (Array.isArray(rawMaterials)) return rawMaterials;
  if (Array.isArray(raw_materials)) return raw_materials;
  if (Array.isArray(bahan_baku)) return bahan_baku;

  if (Array.isArray(dbData?.master_raw_materials)) return dbData.master_raw_materials;
  if (Array.isArray(dbData?.masterRawMaterials)) return dbData.masterRawMaterials;
  if (Array.isArray(dbData?.master_raw_material)) return dbData.master_raw_material;
  if (Array.isArray(dbData?.rawMaterials)) return dbData.rawMaterials;
  if (Array.isArray(dbData?.raw_materials)) return dbData.raw_materials;
  if (Array.isArray(dbData?.bahan_baku)) return dbData.bahan_baku;

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

const getRawSupplierRows = ({
  masterSuppliers,
  master_suppliers,
  suppliers,
  vendors,
  dbData,
}) => {
  if (Array.isArray(master_suppliers)) return master_suppliers;
  if (Array.isArray(masterSuppliers)) return masterSuppliers;
  if (Array.isArray(suppliers)) return suppliers;
  if (Array.isArray(vendors)) return vendors;

  if (Array.isArray(dbData?.master_suppliers)) return dbData.master_suppliers;
  if (Array.isArray(dbData?.masterSuppliers)) return dbData.masterSuppliers;
  if (Array.isArray(dbData?.suppliers)) return dbData.suppliers;
  if (Array.isArray(dbData?.vendors)) return dbData.vendors;

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

const getRawPurchaseRows = ({ purchases, purchasePackages, purchase_packages, dbData }) => {
  const rows = [];

  if (Array.isArray(purchases)) rows.push(...purchases);
  if (Array.isArray(purchasePackages)) rows.push(...purchasePackages);
  if (Array.isArray(purchase_packages)) rows.push(...purchase_packages);

  if (Array.isArray(dbData?.purchases)) rows.push(...dbData.purchases);
  if (Array.isArray(dbData?.purchasePackages)) rows.push(...dbData.purchasePackages);
  if (Array.isArray(dbData?.purchase_packages)) rows.push(...dbData.purchase_packages);

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

const getRawUsageRows = ({ stockMovements, stock_movements, productionBatches, production_batches, dbData }) => {
  const rows = [];

  if (Array.isArray(stock_movements)) rows.push(...stock_movements);
  if (Array.isArray(stockMovements)) rows.push(...stockMovements);
  if (Array.isArray(production_batches)) rows.push(...production_batches);
  if (Array.isArray(productionBatches)) rows.push(...productionBatches);

  if (Array.isArray(dbData?.stock_movements)) rows.push(...dbData.stock_movements);
  if (Array.isArray(dbData?.stockMovements)) rows.push(...dbData.stockMovements);
  if (Array.isArray(dbData?.production_batches)) rows.push(...dbData.production_batches);
  if (Array.isArray(dbData?.productionBatches)) rows.push(...dbData.productionBatches);

  return rows;
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
    warehouse_type: normalizeCode(raw.warehouse_type || raw.warehouseType || raw.location_type || raw.type || 'RAW_MATERIAL'),
    branch_id: String(raw.branch_id || raw.branchId || raw.scope_branch_id || record?.branch_id || '').trim(),
    status: normalizeStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeSupplierDisplay = (record) => {
  const raw = record?.raw || record || {};

  const supplierId = String(
    raw.supplier_id ||
    raw.supplierId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  return {
    id: String(raw.id || supplierId).trim(),
    supplier_id: supplierId,
    supplier_code: String(raw.supplier_code || raw.supplierCode || raw.kode_supplier || raw.code || supplierId || '').trim(),
    supplier_name: String(raw.supplier_name || raw.supplierName || raw.nama_supplier || raw.vendor_name || raw.name || record?.name || '').trim(),
    supplier_type: normalizeCode(raw.supplier_type || raw.supplierType || raw.type || 'UMUM'),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
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

const normalizeMaterialDisplay = (record) => {
  const raw = record?.raw || record || {};

  const materialId = String(
    raw.raw_material_id ||
    raw.rawMaterialId ||
    raw.material_id ||
    raw.materialId ||
    raw.item_id ||
    raw.itemId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  const materialCode = String(
    raw.raw_material_code ||
    raw.rawMaterialCode ||
    raw.material_code ||
    raw.materialCode ||
    raw.item_code ||
    raw.sku ||
    raw.code ||
    record?.code ||
    materialId ||
    '',
  ).trim();

  const materialName = String(
    raw.raw_material_name ||
    raw.rawMaterialName ||
    raw.material_name ||
    raw.materialName ||
    raw.item_name ||
    raw.itemName ||
    raw.nama_bahan ||
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
    id: String(raw.id || materialId).trim(),

    raw_material_id: materialId,
    raw_material_code: materialCode,
    raw_material_name: materialName,

    item_id: String(raw.item_id || materialId).trim(),
    item_name: String(raw.item_name || materialName).trim(),

    category: normalizeCode(raw.category || raw.kategori || 'UMUM'),

    branch_id: branchId,
    default_warehouse_id: defaultWarehouseId,
    warehouse_id: defaultWarehouseId,

    base_unit: normalizeCode(raw.base_unit || raw.baseUnit || raw.unit || raw.satuan || ''),
    purchase_unit: normalizeCode(raw.purchase_unit || raw.purchaseUnit || raw.unit_beli || ''),
    production_unit: normalizeCode(raw.production_unit || raw.productionUnit || raw.unit_produksi || ''),

    conversion_rule_id: String(raw.conversion_rule_id || raw.conversionRuleId || raw.rule_id || '').trim(),

    current_stock: roundQty(raw.current_stock || raw.stock || raw.qty || 0),
    minimum_stock: roundQty(raw.minimum_stock || raw.minimumStock || raw.min_stock || 0),
    reorder_point: roundQty(raw.reorder_point || raw.reorderPoint || raw.reorder_stock || 0),

    preferred_supplier_id: String(raw.preferred_supplier_id || raw.preferredSupplierId || raw.supplier_id || '').trim(),

    average_cost: roundMoney(raw.average_cost || raw.avg_cost || raw.hpp_avg || 0),
    latest_cost: roundMoney(raw.latest_cost || raw.last_cost || raw.harga_terakhir || 0),

    status,

    barcode: String(raw.barcode || raw.bar_code || raw.sku_barcode || '').trim(),
    notes: String(raw.notes || raw.keterangan || raw.description || '').trim(),

    created_at: raw.created_at || '',
    updated_at: raw.updated_at || '',
    date: raw.date || raw.created_at || raw.updated_at || '',

    isDeleted: isSoftDeleted(raw),

    search_text: normalizeText([
      materialId,
      materialCode,
      materialName,
      raw.nama_bahan,
      raw.item_name,
      raw.material_name,
      raw.category,
      raw.kategori,
      branchId,
      defaultWarehouseId,
      raw.barcode,
      raw.preferred_supplier_id,
      raw.supplier_id,
    ].filter(Boolean).join(' ')),

    raw,
  };
};

const materialKeyCandidates = (material) => {
  return [
    normalizeCode(material.raw_material_id),
    normalizeCode(material.item_id),
    normalizeText(material.raw_material_name),
    normalizeText(material.item_name),
    normalizeCode(material.raw_material_code),
    normalizeCode(material.barcode),
  ].filter(Boolean);
};

const itemMatchesMaterial = (item, material) => {
  const keys = new Set(materialKeyCandidates(material));

  const itemId = normalizeCode(item.item_id || item.raw_material_id || item.material_id || '');
  const itemName = normalizeText(item.item_name || item.raw_material_name || item.material_name || item.name || '');
  const itemCode = normalizeCode(item.item_code || item.raw_material_code || item.material_code || item.sku || '');

  if (itemId && keys.has(itemId)) return true;
  if (itemCode && keys.has(itemCode)) return true;
  if (itemName && keys.has(itemName)) return true;

  return false;
};

const normalizePurchaseRecord = (row) => {
  const packageInput = row?.purchase_transaction_package || row?.purchaseTransactionPackage || row || {};
  const header = packageInput.purchase_header || row?.purchase_header || row || {};
  const snapshot = packageInput.purchase_snapshot || parseJson(header.purchase_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.purchase_snapshot || snapshot?.payload || null;
  const snapshotHeader = snapshotPayload?.purchase_header || snapshotPayload?.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const items = packageInput.purchase_items ||
    snapshotPayload?.purchase_items ||
    snapshotPayload?.transaction_items ||
    row?.purchase_items ||
    parseJson(header.items_json, []) ||
    parseJson(header.itemsJson, []) ||
    [];

  return {
    purchase_id: String(finalHeader.purchase_id || finalHeader.id || row?.id || '').trim(),
    purchase_date: normalizeDate(finalHeader.purchase_date || finalHeader.date || finalHeader.created_at || row?.date || ''),
    supplier_id: String(finalHeader.supplier_id || finalHeader.supplierId || row?.supplier_id || '').trim(),
    supplier_name: String(finalHeader.supplier_name || finalHeader.supplierName || row?.supplier_name || '').trim(),
    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),
    items: Array.isArray(items)
      ? items.map((item) => ({
          item_id: String(item.item_id || item.raw_material_id || item.material_id || item.product_id || '').trim(),
          item_name: String(item.item_name || item.raw_material_name || item.material_name || item.product_name || item.name || '').trim(),
          qty: toNumber(item.qty || item.quantity || item.qty_in || 0),
          unit: normalizeCode(item.unit || item.satuan || item.uom || ''),
          unit_price: roundMoney(item.unit_price || item.unitPrice || item.price || item.harga_satuan || 0),
          subtotal: roundMoney(item.subtotal || item.total || item.amount || toNumber(item.qty || 0) * toNumber(item.unit_price || item.price || 0)),
        }))
      : [],
    raw: row,
  };
};

const normalizeInventoryLayer = (row) => {
  const raw = row || {};

  return {
    layer_id: String(raw.layer_id || raw.id || '').trim(),
    item_id: String(raw.item_id || raw.raw_material_id || raw.material_id || '').trim(),
    item_name: String(raw.item_name || raw.raw_material_name || raw.material_name || raw.name || '').trim(),
    branch_id: String(raw.branch_id || raw.branchId || '').trim(),
    warehouse_id: String(raw.warehouse_id || raw.warehouseId || '').trim(),
    qty_remaining: roundQty(raw.qty_remaining ?? raw.remaining_qty ?? raw.qty ?? 0),
    qty_original: roundQty(raw.qty_original ?? raw.original_qty ?? raw.qty ?? 0),
    unit: normalizeCode(raw.unit || raw.satuan || ''),
    unit_cost: roundMoney(raw.unit_cost || raw.cost || raw.hpp || 0),
    received_date: normalizeDate(raw.received_date || raw.date || raw.created_at || ''),
    status: normalizeStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeUsageRecord = (row) => {
  const raw = row || {};
  const packageInput = raw.production_batch_package || raw.productionBatchPackage || raw || {};
  const header = packageInput.batch_header || raw.batch_header || raw || {};
  const materialConsumption = packageInput.material_consumption || raw.material_consumption || raw.consumed_layers || [];

  if (Array.isArray(materialConsumption) && materialConsumption.length > 0) {
    return materialConsumption.map((item) => ({
      item_id: String(item.item_id || item.raw_material_id || item.material_id || '').trim(),
      item_name: String(item.item_name || item.raw_material_name || item.material_name || item.name || '').trim(),
      qty: roundQty(item.requested_qty || item.consumed_qty || item.qty || item.qty_out || 0),
      unit: normalizeCode(item.requested_unit || item.consumed_unit || item.unit || ''),
      date: normalizeDate(header.production_date || header.date || raw.date || ''),
      branch_id: String(header.branch_id || raw.branch_id || '').trim(),
      source_type: 'PRODUCTION',
      raw: item,
    }));
  }

  return [{
    item_id: String(raw.item_id || raw.raw_material_id || raw.material_id || '').trim(),
    item_name: String(raw.item_name || raw.raw_material_name || raw.material_name || raw.name || '').trim(),
    qty: roundQty(raw.qty_out || raw.consumed_qty || raw.qty || 0),
    unit: normalizeCode(raw.unit || raw.satuan || ''),
    date: normalizeDate(raw.movement_date || raw.date || raw.created_at || ''),
    branch_id: String(raw.branch_id || raw.branchId || '').trim(),
    source_type: normalizeCode(raw.movement_type || raw.type || ''),
    raw,
  }];
};

const calculateMaterialMetrics = (material, purchaseRecords, inventoryLayers, usageRecords) => {
  const materialPurchases = purchaseRecords.flatMap((purchase) => {
    return (purchase.items || [])
      .filter((item) => itemMatchesMaterial(item, material))
      .map((item) => ({
        ...item,
        purchase_id: purchase.purchase_id,
        purchase_date: purchase.purchase_date,
        supplier_id: purchase.supplier_id,
        supplier_name: purchase.supplier_name,
        branch_id: purchase.branch_id,
      }));
  });

  const materialLayers = inventoryLayers.filter((layer) => itemMatchesMaterial(layer, material));
  const materialUsage = usageRecords.filter((usage) => itemMatchesMaterial(usage, material));

  const currentStockFromLayer = materialLayers.reduce((sum, layer) => {
    if (layer.isDeleted || layer.status === 'SOFT_DELETED') return sum;
    return sum + toNumber(layer.qty_remaining);
  }, 0);

  const currentStock = currentStockFromLayer > 0
    ? roundQty(currentStockFromLayer)
    : roundQty(material.current_stock);

  const totalPembelian = roundMoney(materialPurchases.reduce((sum, item) => sum + toNumber(item.subtotal), 0));
  const totalQtyPurchase = materialPurchases.reduce((sum, item) => sum + toNumber(item.qty), 0);
  const totalPemakaian = roundQty(materialUsage.reduce((sum, usage) => sum + toNumber(usage.qty), 0));

  const sortedPurchases = [...materialPurchases]
    .filter((item) => item.purchase_date || item.unit_price > 0)
    .sort((a, b) => String(a.purchase_date || '').localeCompare(String(b.purchase_date || '')));

  const latestPurchase = sortedPurchases[sortedPurchases.length - 1] || null;

  const weightedAverageCost = totalQtyPurchase > 0
    ? totalPembelian / totalQtyPurchase
    : 0;

  const averageCost = material.average_cost > 0
    ? material.average_cost
    : weightedAverageCost;

  const latestCost = material.latest_cost > 0
    ? material.latest_cost
    : latestPurchase?.unit_price || 0;

  return {
    current_stock: currentStock,
    minimum_stock: roundQty(material.minimum_stock),
    reorder_point: roundQty(material.reorder_point),
    low_stock: currentStock <= roundQty(material.reorder_point),
    preferred_supplier_id: material.preferred_supplier_id,
    latest_cost: roundMoney(latestCost),
    average_cost: roundMoney(averageCost),
    total_pembelian: totalPembelian,
    total_pemakaian: totalPemakaian,
    purchase_count: materialPurchases.length,
    usage_count: materialUsage.length,
    latest_purchase_date: latestPurchase?.purchase_date || '',
    latest_supplier_id: latestPurchase?.supplier_id || '',
    latest_supplier_name: latestPurchase?.supplier_name || '',
  };
};

const getCategoryIcon = (category) => {
  const normalized = normalizeCode(category);

  if (normalized === 'AYAM') return <CookingPot size={18} />;
  if (normalized === 'TEPUNG') return <Scale size={18} />;
  if (normalized === 'BUMBU') return <Flame size={18} />;
  if (normalized === 'TOPPING') return <Layers size={18} />;
  if (normalized === 'KEMASAN') return <Boxes size={18} />;
  if (normalized === 'SAUS') return <Droplets size={18} />;
  if (normalized === 'MINYAK') return <Droplets size={18} />;
  if (normalized === 'GAS') return <Fuel size={18} />;

  return <Package size={18} />;
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

export default function TabMasterBahanBaku({
  masterRawMaterials = [],
  master_raw_materials,
  masterRawMaterial,
  master_raw_material,
  rawMaterials,
  raw_materials,
  bahan_baku,

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

  masterSuppliers = [],
  master_suppliers,
  suppliers,
  vendors,

  masterConversionRules = [],
  master_conversion_rules,
  conversionRules,
  conversion_rules,

  purchases = [],
  purchasePackages,
  purchase_packages,

  inventoryCostLayers,
  inventory_cost_layers,
  costLayers,
  cost_layers,

  stockMovements,
  stock_movements,
  productionBatches,
  production_batches,

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
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const rawMaterialRows = useMemo(() => {
    return getRawMaterialRows({
      masterRawMaterials,
      master_raw_materials,
      masterRawMaterial,
      master_raw_material,
      rawMaterials,
      raw_materials,
      bahan_baku,
      dbData,
    });
  }, [
    masterRawMaterials,
    master_raw_materials,
    masterRawMaterial,
    master_raw_material,
    rawMaterials,
    raw_materials,
    bahan_baku,
    dbData,
  ]);

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

  const rawSupplierRows = useMemo(() => {
    return getRawSupplierRows({
      masterSuppliers,
      master_suppliers,
      suppliers,
      vendors,
      dbData,
    });
  }, [masterSuppliers, master_suppliers, suppliers, vendors, dbData]);

  const rawRuleRows = useMemo(() => {
    return getRawConversionRules({
      masterConversionRules,
      master_conversion_rules,
      conversionRules,
      conversion_rules,
      dbData,
    });
  }, [masterConversionRules, master_conversion_rules, conversionRules, conversion_rules, dbData]);

  const rawPurchases = useMemo(() => {
    return getRawPurchaseRows({
      purchases,
      purchasePackages,
      purchase_packages,
      dbData,
    }).map(normalizePurchaseRecord);
  }, [purchases, purchasePackages, purchase_packages, dbData]);

  const rawLayers = useMemo(() => {
    return getRawInventoryLayers({
      inventoryCostLayers,
      inventory_cost_layers,
      costLayers,
      cost_layers,
      dbData,
    }).map(normalizeInventoryLayer);
  }, [inventoryCostLayers, inventory_cost_layers, costLayers, cost_layers, dbData]);

  const rawUsage = useMemo(() => {
    return getRawUsageRows({
      stockMovements,
      stock_movements,
      productionBatches,
      production_batches,
      dbData,
    }).flatMap(normalizeUsageRecord);
  }, [stockMovements, stock_movements, productionBatches, production_batches, dbData]);

  const masterSource = useMemo(() => ({
    ...(dbData || {}),
    master_raw_materials: rawMaterialRows,
    masterRawMaterials: rawMaterialRows,
    raw_materials: rawMaterialRows,
    rawMaterials: rawMaterialRows,

    master_branches: rawBranchRows,
    masterBranches: rawBranchRows,
    master_branch: rawBranchRows,

    master_warehouses: rawWarehouseRows,
    masterWarehouses: rawWarehouseRows,
    master_locations: rawWarehouseRows,
    masterLocations: rawWarehouseRows,
    warehouses: rawWarehouseRows,
    locations: rawWarehouseRows,

    master_suppliers: rawSupplierRows,
    masterSuppliers: rawSupplierRows,
    suppliers: rawSupplierRows,

    master_conversion_rules: rawRuleRows,
    masterConversionRules: rawRuleRows,
    conversion_rules: rawRuleRows,
    conversionRules: rawRuleRows,
  }), [dbData, rawMaterialRows, rawBranchRows, rawWarehouseRows, rawSupplierRows, rawRuleRows]);

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

  const supplierRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getSuppliers(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeSupplierDisplay)
      .filter((supplier) => !supplier.isDeleted)
      .sort((a, b) => String(a.supplier_name).localeCompare(String(b.supplier_name)));
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

  const materialRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getRawMaterials(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeMaterialDisplay)
      .map((material) => ({
        ...material,
        metrics: calculateMaterialMetrics(material, rawPurchases, rawLayers, rawUsage),
      }))
      .sort((a, b) => {
        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
        if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
        if (a.metrics.low_stock && !b.metrics.low_stock) return -1;
        if (!a.metrics.low_stock && b.metrics.low_stock) return 1;
        return String(a.raw_material_name).localeCompare(String(b.raw_material_name));
      });
  }, [masterSource, rawPurchases, rawLayers, rawUsage]);

  const searchResultIds = useMemo(() => {
    const keyword = searchQuery.trim();

    if (!keyword) return new Set();

    const result = erpOrchestrator.masterData.searchMaster(masterSource, {
      masterType: 'RAW_MATERIAL',
      keyword,
      includeInactive: true,
      includeDeleted: true,
    }, {
      validate: false,
    });

    return new Set((result.records || []).flatMap((record) => {
      const material = normalizeMaterialDisplay(record);
      return [
        material.id,
        material.raw_material_id,
        material.raw_material_code,
        material.barcode,
      ].filter(Boolean);
    }));
  }, [masterSource, searchQuery]);

  const effectiveBranchFilter = !isOwnerMode && userBranchId ? userBranchId : branchFilter;

  const filteredMaterials = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return materialRecords.filter((material) => {
      const statusOk = statusFilter === 'ALL'
        ? !material.isDeleted
        : statusFilter === 'SOFT_DELETED'
          ? material.isDeleted || material.status === 'SOFT_DELETED'
          : material.status === statusFilter && !material.isDeleted;

      const categoryOk = categoryFilter === 'ALL' || material.category === categoryFilter;
      const branchOk = effectiveBranchFilter === 'ALL' || material.branch_id === effectiveBranchFilter;

      const searchOk = !keyword ||
        material.search_text.includes(keyword) ||
        searchResultIds.has(material.id) ||
        searchResultIds.has(material.raw_material_id) ||
        searchResultIds.has(material.raw_material_code) ||
        searchResultIds.has(material.barcode);

      return statusOk && categoryOk && branchOk && searchOk;
    });
  }, [materialRecords, searchQuery, searchResultIds, statusFilter, categoryFilter, effectiveBranchFilter]);

  const activeWarehousesByBranch = useMemo(() => {
    return warehouseRecords.filter((warehouse) => {
      if (warehouse.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return warehouse.branch_id === form.branch_id;
    });
  }, [warehouseRecords, form.branch_id]);

  const activeSuppliersByBranch = useMemo(() => {
    return supplierRecords.filter((supplier) => {
      if (supplier.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return supplier.branch_id === form.branch_id;
    });
  }, [supplierRecords, form.branch_id]);

  const warehouseNameById = useMemo(() => {
    const map = new Map();

    warehouseRecords.forEach((warehouse) => {
      map.set(warehouse.warehouse_id, warehouse.warehouse_name || warehouse.warehouse_id);
      map.set(warehouse.warehouse_code, warehouse.warehouse_name || warehouse.warehouse_id);
    });

    return map;
  }, [warehouseRecords]);

  const supplierNameById = useMemo(() => {
    const map = new Map();

    supplierRecords.forEach((supplier) => {
      map.set(supplier.supplier_id, supplier.supplier_name || supplier.supplier_id);
      map.set(supplier.supplier_code, supplier.supplier_name || supplier.supplier_id);
    });

    return map;
  }, [supplierRecords]);

  const analytics = useMemo(() => {
    const visible = materialRecords.filter((material) => !material.isDeleted);
    const scoped = visible.filter((material) => {
      if (effectiveBranchFilter === 'ALL') return true;
      return material.branch_id === effectiveBranchFilter;
    });

    const lowStock = scoped.filter((material) => material.metrics.low_stock);
    const active = scoped.filter((material) => material.status === 'ACTIVE').length;

    const totalStockValue = scoped.reduce((sum, material) => {
      return sum + toNumber(material.metrics.current_stock) * toNumber(material.metrics.average_cost || material.metrics.latest_cost);
    }, 0);

    const totalPembelian = scoped.reduce((sum, material) => sum + material.metrics.total_pembelian, 0);
    const totalPemakaian = scoped.reduce((sum, material) => sum + material.metrics.total_pemakaian, 0);

    const mostPurchased = [...scoped].sort((a, b) => b.metrics.total_pembelian - a.metrics.total_pembelian)[0] || null;
    const lowestStock = [...lowStock].sort((a, b) => a.metrics.current_stock - b.metrics.current_stock)[0] || null;

    return {
      total: scoped.length,
      active,
      low_stock_count: lowStock.length,
      deleted: materialRecords.filter((material) => material.isDeleted || material.status === 'SOFT_DELETED').length,
      total_stock_value: roundMoney(totalStockValue),
      total_pembelian: roundMoney(totalPembelian),
      total_pemakaian: roundQty(totalPemakaian),
      most_purchased: mostPurchased,
      lowest_stock: lowestStock,
    };
  }, [materialRecords, effectiveBranchFilter]);

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
    setSelectedMaterial(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('RM', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      raw_material_id: prev.raw_material_id || newId,
      raw_material_code: prev.raw_material_code || newId,
      barcode: prev.barcode || newId,
    }));
  };

  const handleEdit = (material) => {
    setSelectedMaterial(material);
    setIsEditing(true);

    setForm({
      id: material.id || material.raw_material_id,
      raw_material_id: material.raw_material_id,
      raw_material_code: material.raw_material_code,
      raw_material_name: material.raw_material_name,
      category: material.category || 'UMUM',
      branch_id: material.branch_id,
      default_warehouse_id: material.default_warehouse_id,
      base_unit: material.base_unit || 'GRAM',
      purchase_unit: material.purchase_unit || material.base_unit || 'KG',
      production_unit: material.production_unit || material.base_unit || 'GRAM',
      conversion_rule_id: material.conversion_rule_id,
      current_stock: String(material.metrics.current_stock || material.current_stock || ''),
      minimum_stock: String(material.minimum_stock || ''),
      reorder_point: String(material.reorder_point || ''),
      preferred_supplier_id: material.preferred_supplier_id,
      average_cost: String(material.metrics.average_cost || material.average_cost || ''),
      latest_cost: String(material.metrics.latest_cost || material.latest_cost || ''),
      status: material.status === 'SOFT_DELETED' ? 'NON_ACTIVE' : material.status || 'ACTIVE',
      barcode: material.barcode,
      notes: material.notes,
    });
  };

  const validateForm = () => {
    const warnings = [];

    if (!form.raw_material_id.trim()) warnings.push('Raw Material ID wajib diisi.');
    if (!form.raw_material_code.trim()) warnings.push('Raw Material Code wajib diisi.');
    if (!form.raw_material_name.trim()) warnings.push('Nama bahan baku wajib diisi.');
    if (!form.category.trim()) warnings.push('Kategori wajib dipilih.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih. Bahan baku tidak boleh orphan.');
    if (!form.default_warehouse_id.trim()) warnings.push('Default Warehouse wajib dipilih. Stok tidak boleh tanpa gudang.');
    if (!form.base_unit.trim()) warnings.push('Base Unit wajib diisi.');
    if (!form.purchase_unit.trim()) warnings.push('Purchase Unit wajib diisi.');
    if (!form.production_unit.trim()) warnings.push('Production Unit wajib diisi.');
    if (!form.status.trim()) warnings.push('Status wajib dipilih.');

    const branchExists = branchRecords.some((branch) => {
      return branch.branch_id === form.branch_id && !branch.isDeleted;
    });

    if (form.branch_id && !branchExists) {
      warnings.push('Branch ID tidak ditemukan di Master Cabang. Bahan baku wajib terhubung ke cabang resmi.');
    }

    const warehouseExists = warehouseRecords.some((warehouse) => {
      return warehouse.warehouse_id === form.default_warehouse_id &&
        warehouse.branch_id === form.branch_id &&
        !warehouse.isDeleted;
    });

    if (form.default_warehouse_id && !warehouseExists) {
      warnings.push('Default Warehouse tidak ditemukan di cabang yang dipilih. Bahan baku wajib punya gudang resmi.');
    }

    if (!isOwnerMode && userBranchId && form.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh membuat/mengedit bahan baku di branch miliknya.');
    }

    if (toNumber(form.current_stock) < 0) warnings.push('Current stock tidak boleh negatif.');
    if (toNumber(form.minimum_stock) < 0) warnings.push('Minimum stock tidak boleh negatif.');
    if (toNumber(form.reorder_point) < 0) warnings.push('Reorder point tidak boleh negatif.');
    if (toNumber(form.average_cost) < 0) warnings.push('Average cost tidak boleh negatif.');
    if (toNumber(form.latest_cost) < 0) warnings.push('Latest cost tidak boleh negatif.');

    if (form.preferred_supplier_id) {
      const supplierExists = supplierRecords.some((supplier) => {
        return supplier.supplier_id === form.preferred_supplier_id &&
          supplier.branch_id === form.branch_id &&
          !supplier.isDeleted;
      });

      if (!supplierExists) {
        warnings.push('Preferred supplier tidak ditemukan di cabang yang dipilih.');
      }
    }

    if (form.conversion_rule_id) {
      const ruleExists = conversionRuleRecords.some((rule) => {
        return rule.rule_id === form.conversion_rule_id;
      });

      if (!ruleExists) {
        warnings.push('Conversion rule tidak ditemukan atau tidak aktif.');
      }
    }

    const targetId = normalizeCode(form.raw_material_id);
    const targetCode = normalizeCode(form.raw_material_code);
    const targetBranch = form.branch_id;

    const duplicateId = materialRecords.find((material) => {
      if (isEditing && material.raw_material_id === selectedMaterial?.raw_material_id) return false;
      if (material.isDeleted) return false;
      return normalizeCode(material.raw_material_id) === targetId && material.branch_id === targetBranch;
    });

    const duplicateCode = materialRecords.find((material) => {
      if (isEditing && material.raw_material_id === selectedMaterial?.raw_material_id) return false;
      if (material.isDeleted) return false;
      return normalizeCode(material.raw_material_code) === targetCode && material.branch_id === targetBranch;
    });

    if (duplicateId) warnings.push(`Raw Material ID sudah dipakai oleh ${duplicateId.raw_material_name} di cabang yang sama.`);
    if (duplicateCode) warnings.push(`Raw Material Code sudah dipakai oleh ${duplicateCode.raw_material_name} di cabang yang sama.`);

    return warnings;
  };

  const createPayload = (override = {}) => {
    const materialId = String(form.raw_material_id || selectedMaterial?.raw_material_id || generateId('RM', todayStr)).trim();
    const materialName = normalizeText(form.raw_material_name);
    const now = new Date().toISOString();
    const status = normalizeCode(form.status);

    return {
      ...(selectedMaterial?.raw || {}),

      id: selectedMaterial?.id || materialId,
      date: selectedMaterial?.date || todayStr,

      raw_material_id: materialId,
      raw_material_code: normalizeCode(form.raw_material_code || materialId),
      raw_material_name: materialName,

      material_id: materialId,
      material_code: normalizeCode(form.raw_material_code || materialId),
      material_name: materialName,

      item_id: materialId,
      item_code: normalizeCode(form.raw_material_code || materialId),
      item_name: materialName,

      category: normalizeCode(form.category),
      kategori: normalizeCode(form.category),

      branch_id: normalizeCode(form.branch_id),

      default_warehouse_id: normalizeCode(form.default_warehouse_id),
      warehouse_id: normalizeCode(form.default_warehouse_id),

      base_unit: normalizeCode(form.base_unit),
      purchase_unit: normalizeCode(form.purchase_unit),
      production_unit: normalizeCode(form.production_unit),
      unit: normalizeCode(form.base_unit),
      satuan: normalizeCode(form.base_unit),

      conversion_rule_id: form.conversion_rule_id.trim(),

      current_stock: roundQty(form.current_stock),
      stock: roundQty(form.current_stock),
      minimum_stock: roundQty(form.minimum_stock),
      min_stock: roundQty(form.minimum_stock),
      reorder_point: roundQty(form.reorder_point),

      preferred_supplier_id: form.preferred_supplier_id.trim(),
      supplier_id: form.preferred_supplier_id.trim(),

      average_cost: roundMoney(form.average_cost),
      avg_cost: roundMoney(form.average_cost),
      latest_cost: roundMoney(form.latest_cost),
      last_cost: roundMoney(form.latest_cost),

      status,
      raw_material_status: status,
      status_active: status === 'ACTIVE',
      is_active: status === 'ACTIVE',
      isDeleted: false,

      barcode: form.barcode.trim(),

      notes: form.notes.trim(),
      keterangan: form.notes.trim(),

      created_at: selectedMaterial?.raw?.created_at || now,
      created_by: selectedMaterial?.raw?.created_by || user?.name || user?.email || 'SYSTEM',
      updated_at: now,
      updated_by: user?.name || user?.email || 'SYSTEM',

      ...override,
    };
  };

  const persistMaterial = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data bahan baku belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, RAW_MATERIAL_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, RAW_MATERIAL_TABLE_NAME);
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

    const isSuccess = await persistMaterial(action, payload);

    if (isSuccess) {
      notify(isEditing ? 'Master bahan baku berhasil diperbarui.' : 'Bahan baku baru berhasil ditambahkan.', 'success');
      resetForm();
    }
  };

  const handleToggleStatus = async (material) => {
    const nextStatus = material.status === 'ACTIVE' ? 'NON_ACTIVE' : 'ACTIVE';

    const confirmed = window.confirm(
      `${nextStatus === 'NON_ACTIVE' ? 'Nonaktifkan' : 'Aktifkan ulang'} bahan baku ${material.raw_material_name}?`,
    );

    if (!confirmed) return;

    const payload = {
      ...(material.raw || {}),
      id: material.id || material.raw_material_id,
      raw_material_id: material.raw_material_id,
      raw_material_status: nextStatus,
      status: nextStatus,
      status_active: nextStatus === 'ACTIVE',
      is_active: nextStatus === 'ACTIVE',
      isDeleted: false,
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistMaterial('update', payload);

    if (isSuccess) {
      notify(nextStatus === 'ACTIVE' ? 'Bahan baku berhasil diaktifkan ulang.' : 'Bahan baku berhasil dinonaktifkan.', 'success');
    }
  };

  const handleSoftDelete = async (material) => {
    const confirmed = window.confirm(
      `Soft delete bahan baku ${material.raw_material_name}? Data tidak dihapus permanen, hanya disembunyikan dari transaksi aktif.`,
    );

    if (!confirmed) return;

    const payload = {
      ...(material.raw || {}),
      id: material.id || material.raw_material_id,
      raw_material_id: material.raw_material_id,
      raw_material_status: 'NON_ACTIVE',
      status: 'NON_ACTIVE',
      status_active: false,
      is_active: false,
      isDeleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.name || user?.email || 'SYSTEM',
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistMaterial('update', payload);

    if (isSuccess) {
      notify('Bahan baku berhasil di-soft delete.', 'success');
      if (selectedMaterial?.raw_material_id === material.raw_material_id) resetForm();
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
                <Package size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Master Bahan Baku ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Pusat Data Bahan Baku Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Semua stok, purchase, produksi, HPP, dan FIFO wajib berasal dari bahan baku resmi yang terhubung ke cabang dan gudang.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{isOwnerMode ? 'Owner Mode Lintas Cabang' : 'Branch Mode'}</Badge>
            <Badge tone="amber">Conversion Rules Ready</Badge>
            <Badge tone="green">FIFO & HPP Ready</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Bahan" value={analytics.total} icon={<Package size={18} />} tone="white" />
        <StatCard title="Aktif" value={analytics.active} icon={<CheckCircle size={18} />} tone="red" />
        <StatCard title="Low Stock" value={analytics.low_stock_count} icon={<AlertTriangle size={18} />} tone="gold" />
        <StatCard title="Nilai Stok" value={formatMoney(analytics.total_stock_value)} icon={<Activity size={18} />} tone="white" />
        <StatCard title="Total Pembelian" value={formatMoney(analytics.total_pembelian)} icon={<ReceiptText size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bahan Paling Banyak Dibeli</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.most_purchased?.raw_material_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatMoney(analytics.most_purchased?.metrics?.total_pembelian || 0)}
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
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Low Stock Priority</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.lowest_stock?.raw_material_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Stok {formatQty(analytics.lowest_stock?.metrics?.current_stock || 0, analytics.lowest_stock?.base_unit || '')}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total Pemakaian</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.total_pemakaian.toLocaleString('id-ID')}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Dari produksi / stock movement
              </div>
            </div>
          </div>
        </div>
      </div>

      {analytics.low_stock_count > 0 && (
        <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-amber-900">LOW STOCK WARNING</h2>
                <p className="mt-1 text-xs font-bold text-amber-700">
                  Ada {analytics.low_stock_count} bahan baku dengan current_stock kurang dari atau sama dengan reorder_point.
                </p>
              </div>
            </div>
            <Badge tone="amber">Segera cek purchase plan</Badge>
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
                  {isEditing ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Bahan resmi untuk purchase, produksi, FIFO, dan HPP.
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
                <Field label="Raw Material ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditing}
                      value={form.raw_material_id}
                      onChange={(event) => setForm({ ...form, raw_material_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="RM-001"
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

                <Field label="Raw Material Code" required>
                  <input
                    value={form.raw_material_code}
                    onChange={(event) => setForm({ ...form, raw_material_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="AYAM-FILLET"
                  />
                </Field>
              </div>

              <Field label="Nama Bahan Baku" required>
                <input
                  value={form.raw_material_name}
                  onChange={(event) => setForm({ ...form, raw_material_name: event.target.value })}
                  className={inputClass}
                  placeholder="Ayam Fillet"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Kategori" required>
                  <select
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    className={inputClass}
                  >
                    {RAW_MATERIAL_CATEGORIES.map((category) => (
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
                    {MATERIAL_STATUS.map((status) => (
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
                    preferred_supplier_id: '',
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Base Unit" required>
                  <select
                    value={form.base_unit}
                    onChange={(event) => setForm({ ...form, base_unit: event.target.value })}
                    className={inputClass}
                  >
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Purchase Unit" required>
                  <select
                    value={form.purchase_unit}
                    onChange={(event) => setForm({ ...form, purchase_unit: event.target.value })}
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Current Stock">
                  <input
                    value={form.current_stock}
                    onChange={(event) => setForm({ ...form, current_stock: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>

                <Field label="Minimum Stock">
                  <input
                    value={form.minimum_stock}
                    onChange={(event) => setForm({ ...form, minimum_stock: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>

                <Field label="Reorder Point">
                  <input
                    value={form.reorder_point}
                    onChange={(event) => setForm({ ...form, reorder_point: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label="Preferred Supplier">
                <select
                  value={form.preferred_supplier_id}
                  onChange={(event) => setForm({ ...form, preferred_supplier_id: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Pilih supplier utama</option>
                  {activeSuppliersByBranch.map((supplier) => (
                    <option key={supplier.supplier_id} value={supplier.supplier_id}>
                      {supplier.supplier_name} — {supplier.supplier_id}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Average Cost">
                  <input
                    value={form.average_cost}
                    onChange={(event) => setForm({ ...form, average_cost: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>

                <Field label="Latest Cost">
                  <input
                    value={form.latest_cost}
                    onChange={(event) => setForm({ ...form, latest_cost: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label="Barcode">
                <input
                  value={form.barcode}
                  onChange={(event) => setForm({ ...form, barcode: event.target.value })}
                  className={inputClass}
                  placeholder="Barcode / QR Code"
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan bahan baku..."
                />
              </Field>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
              >
                <Save size={16} />
                {isEditing ? 'Simpan Perubahan' : 'Tambah Bahan Baku'}
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
                    Daftar Bahan Baku Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Master resmi untuk Purchase, FIFO, Produksi, BOM, dan HPP.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari bahan, kode, barcode..."
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
                      {RAW_MATERIAL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bahan Baku</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang / Gudang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Satuan</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Stok</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Supplier</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Harga</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Analytics</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMaterials.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <Package size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Bahan baku tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau tambahkan bahan baku baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredMaterials.map((material) => {
                    const isDeleted = material.isDeleted || material.status === 'SOFT_DELETED';
                    const isActive = material.status === 'ACTIVE' && !isDeleted;
                    const branchName = branchNameById.get(material.branch_id) || 'Branch tidak ditemukan';
                    const warehouseName = warehouseNameById.get(material.default_warehouse_id) || 'Gudang tidak ditemukan';
                    const supplierName = supplierNameById.get(material.preferred_supplier_id) || material.metrics.latest_supplier_name || '-';

                    const isOrphanBranch = !branchNameById.has(material.branch_id);
                    const isOrphanWarehouse = !warehouseNameById.has(material.default_warehouse_id);
                    const isLowStock = material.metrics.low_stock;

                    return (
                      <tr key={`${material.raw_material_id}-${material.raw_material_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isLowStock ? 'bg-amber-500 text-white' : isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {getCategoryIcon(material.category)}
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{material.raw_material_name || '-'}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{material.raw_material_id || '-'}</Badge>
                                <Badge tone="amber">{material.raw_material_code || '-'}</Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Badge tone={material.category === 'AYAM' ? 'red' : material.category === 'KEMASAN' ? 'purple' : 'slate'}>
                                  {material.category || '-'}
                                </Badge>
                                {material.barcode && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-500">
                                    <Barcode size={11} />
                                    {material.barcode}
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
                                <div className="text-slate-400">{material.branch_id || '-'}</div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <Warehouse size={14} className={isOrphanWarehouse ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-slate-400'} />
                              <div>
                                <div className={isOrphanWarehouse ? 'text-red-600' : 'text-slate-800'}>{warehouseName}</div>
                                <div className="text-slate-400">{material.default_warehouse_id || '-'}</div>
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
                                Base
                              </span>
                              <span className="text-slate-900">{material.base_unit || '-'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-400">
                                <ReceiptText size={12} />
                                Purchase
                              </span>
                              <span className="text-slate-900">{material.purchase_unit || '-'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-400">
                                <Ruler size={12} />
                                Production
                              </span>
                              <span className="text-slate-900">{material.production_unit || '-'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className={`text-sm font-black ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                            {formatQty(material.metrics.current_stock, material.base_unit)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Min {formatQty(material.minimum_stock, material.base_unit)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Reorder {formatQty(material.reorder_point, material.base_unit)}
                          </div>
                          {isLowStock && (
                            <div className="mt-2">
                              <Badge tone="amber">LOW STOCK</Badge>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <Truck size={14} className="mt-0.5 shrink-0 text-slate-400" />
                            <div>
                              <div className="text-xs font-black text-slate-900">{supplierName}</div>
                              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                {material.preferred_supplier_id || material.metrics.latest_supplier_id || '-'}
                              </div>
                              <div className="mt-2 text-[11px] font-bold text-slate-400">
                                Last purchase {material.metrics.latest_purchase_date ? formatDate(material.metrics.latest_purchase_date) : '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-bold">
                            <div className="text-slate-400">Latest</div>
                            <div className="text-right text-slate-900">{formatMoney(material.metrics.latest_cost)}</div>

                            <div className="text-slate-400">Average</div>
                            <div className="text-right text-slate-900">{formatMoney(material.metrics.average_cost)}</div>

                            <div className="text-slate-400">Value</div>
                            <div className="text-right text-emerald-700">
                              {formatMoney(material.metrics.current_stock * (material.metrics.average_cost || material.metrics.latest_cost))}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-bold">
                            <div className="text-slate-400">Pembelian</div>
                            <div className="text-right text-slate-900">{formatMoney(material.metrics.total_pembelian)}</div>

                            <div className="text-slate-400">Pemakaian</div>
                            <div className="text-right text-slate-900">{formatQty(material.metrics.total_pemakaian, material.base_unit)}</div>

                            <div className="text-slate-400">Purchase Row</div>
                            <div className="text-right text-slate-900">{material.metrics.purchase_count}</div>

                            <div className="text-slate-400">Usage Row</div>
                            <div className="text-right text-slate-900">{material.metrics.usage_count}</div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isDeleted ? 'dark' : isActive ? 'green' : 'amber'}>
                            {isDeleted ? 'SOFT_DELETED' : material.status}
                          </Badge>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                            <History size={12} />
                            {material.updated_at ? formatDate(material.updated_at) : material.date ? formatDate(material.date) : '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {!isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(material)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit bahan baku"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(material)}
                                  className={`rounded-xl border p-2 transition-all ${
                                    isActive
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                  title={isActive ? 'Nonaktifkan bahan baku' : 'Aktifkan bahan baku'}
                                >
                                  {isActive ? <Power size={15} /> : <RotateCcw size={15} />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSoftDelete(material)}
                                  className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                  title="Soft delete bahan baku"
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
                Menampilkan <span className="text-slate-800">{filteredMaterials.length}</span> dari <span className="text-slate-800">{materialRecords.length}</span> data bahan baku.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Aktif / Bahan Kunci</Badge>
                <Badge tone="amber">Gold = Low Stock</Badge>
                <Badge tone="purple">Kategori Khusus</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
