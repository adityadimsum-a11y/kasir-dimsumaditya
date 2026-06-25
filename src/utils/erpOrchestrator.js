/**
 * ERP DIMSUM ADITYA V2
 * Utility Layer: erpOrchestrator.js
 *
 * Purpose:
 * - Orchestrator resmi seluruh ERP Dimsum Aditya.
 * - Semua UI React hanya boleh memanggil file ini.
 *
 * Flow:
 * UI
 * ↓
 * erpOrchestrator
 * ↓
 * Business Engine
 * ↓
 * Financial Engine
 * ↓
 * Snapshot
 *
 * Important Principles:
 * - Orchestrator ini TIDAK update UI.
 * - Orchestrator ini TIDAK update database.
 * - Orchestrator ini TIDAK update sheet.
 * - Orchestrator ini hanya menghubungkan engine dan mengembalikan package.
 * - Owner Analytics bersifat READ ONLY.
 */

import {
  getBranches,
  getBranchById,
  getWarehouses,
  getWarehouseById,
  getCustomers,
  getCustomerById,
  getSuppliers,
  getSupplierById,
  getProducts,
  getProductById,
  getRawMaterials,
  getRawMaterialById,
  getEmployees,
  getEmployeeById,
  getChartOfAccounts,
  getAccountByCode,
  getKewajiban,
  getKewajibanById,
  searchMaster,
  createMasterSnapshot,
} from './masterDataEngine';

import {
  normalizeBranchId,
  createConversionSnapshot,
} from './conversionEngine';

import {
  getActiveBom,
} from './bomEngine';

import {
  getLayerBalance,
  listLayerItems,
} from './inventoryLayerEngine';

import {
  calculateOrderHpp,
  calculateProductionHpp,
} from './hppEngine';

import {
  createProductionBatch,
  simulateProduction,
  reverseProduction,
} from './productionEngine';

import {
  receivePurchase,
  createPurchaseOrder,
  reversePurchase,
} from './purchaseEngine';

import {
  createSalesOrder,
  reverseSales,
} from './salesEngine';

import {
  createPurchaseJournal,
  createSalesJournal,
  createProductionJournal,
  createExpenseJournal,
  createPaymentJournal,
  createAdjustmentJournal,
  reverseJournal,
  createTrialBalance,
} from './accountingEngine';

import profitEngine, {
  calculateBranchProfit,
  calculateConsolidatedProfit,
  calculateProfitByChannel,
  calculateProfitByProduct,
  calculateProfitByCustomer,
  createProfitSnapshot,
} from './profitEngine';

import {
  createSnapshot,
  lockSnapshot,
  mergeSnapshots,
  createTransactionSnapshot,
  readSnapshot,
} from './snapshotEngine';

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const ORCHESTRATOR_VERSION = 'ERP_DA_V2_ORCHESTRATOR_1';

const DEFAULT_BRANCH_SCOPE = 'GLOBAL';
const DEFAULT_WAREHOUSE = 'MAIN';

const PROCESS_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  BLOCKED: 'BLOCKED',
  PARTIAL: 'PARTIAL',
  SIMULATED: 'SIMULATED',
});

const PROCESS_TYPES = Object.freeze({
  PURCHASE: 'PURCHASE',
  PRODUCTION: 'PRODUCTION',
  SALES: 'SALES',
  EXPENSE: 'EXPENSE',
  PAYMENT: 'PAYMENT',
  KASBON: 'KASBON',
  KEWAJIBAN: 'KEWAJIBAN',
  ADJUSTMENT: 'ADJUSTMENT',
  VOID: 'VOID',
  DASHBOARD: 'DASHBOARD',
  OWNER_ANALYTICS: 'OWNER_ANALYTICS',
});

/* =========================================================================
   BASIC HELPERS
   ========================================================================= */

const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const cleanText = (value) => {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const normalizeCode = (value) => {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const normalizeText = (value) => {
  return cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, ' ');
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value === undefined || value === null || value === '') return NaN;

  const cleaned = String(value)
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const safeNumber = (value, fallback = 0) => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => {
  const number = safeNumber(value, 0);
  return Math.round(number * 100) / 100;
};

const roundQty = (value) => {
  const number = safeNumber(value, 0);
  return Math.round(number * 1000) / 1000;
};

const roundPercent = (value) => {
  const number = safeNumber(value, 0);
  return Math.round(number * 100) / 100;
};

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const makeWarning = (code, message, meta = {}) => ({
  code,
  message,
  meta,
});

const normalizeDateString = (value) => {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

  return parsed.toISOString().substring(0, 10);
};

const getTodayISO = () => {
  return new Date().toISOString().substring(0, 10);
};

const normalizeWarehouseId = (warehouseId) => {
  const normalized = normalizeCode(warehouseId || DEFAULT_WAREHOUSE);
  return normalized || DEFAULT_WAREHOUSE;
};

const generateId = (prefix = 'ORCH') => {
  const safePrefix = normalizeCode(prefix || 'ORCH') || 'ORCH';
  return `${safePrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
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

const collectWarnings = (...sources) => {
  return sources.flatMap((source) => {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (Array.isArray(source.warnings)) return source.warnings;
    return [];
  });
};

const firstValue = (...values) => {
  return values.find((value) => value !== undefined && value !== null && value !== '');
};

const isDeletedRow = (row = {}) => {
  const value = row.isDeleted ?? row.is_deleted ?? row.deleted;
  return value === true || normalizeCode(value) === 'TRUE';
};

const daysBetween = (fromDate, toDate) => {
  if (!fromDate || !toDate) return 0;

  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;

  return Math.floor((to.getTime() - from.getTime()) / 86400000);
};

const getAgingBucketKey = (agingDays) => {
  const days = Math.max(safeNumber(agingDays, 0), 0);

  if (days <= 30) return '0_30';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';

  return 'gt_90';
};

const buildEmptyAgingSummary = () => ({
  '0_30': 0,
  '31_60': 0,
  '61_90': 0,
  gt_90: 0,
});

/* =========================================================================
   CONTEXT HELPERS
   ========================================================================= */

const buildContext = (context = {}) => {
  const dbData = context.dbData || context.db_data || context.source || context.data || {};

  return {
    ...context,
    dbData,
    source: context.source || dbData,
    branchId: normalizeBranchId(context.branchId || context.branch_id || dbData.branch_id || DEFAULT_BRANCH_SCOPE),
    warehouseId: normalizeWarehouseId(context.warehouseId || context.warehouse_id || DEFAULT_WAREHOUSE),
    createdBy: context.createdBy || context.created_by || context.executor_name || context.executor || 'SYSTEM',
  };
};

const buildAccountingOptions = (context = {}, input = {}) => {
  const ctx = buildContext(context);

  return {
    ...ctx,
    ...input,

    dbData: ctx.dbData,
    source: ctx.source,

    branchId: normalizeBranchId(input.branch_id || input.branchId || ctx.branchId),
    branch_id: normalizeBranchId(input.branch_id || input.branchId || ctx.branchId),

    master_chart_of_accounts: input.master_chart_of_accounts || ctx.master_chart_of_accounts || ctx.dbData.master_chart_of_accounts,
    masterChartOfAccounts: input.masterChartOfAccounts || ctx.masterChartOfAccounts || ctx.dbData.masterChartOfAccounts,
    chart_of_accounts: input.chart_of_accounts || ctx.chart_of_accounts || ctx.dbData.chart_of_accounts,
    chartOfAccounts: input.chartOfAccounts || ctx.chartOfAccounts || ctx.dbData.chartOfAccounts,

    accountRoleMap: input.accountRoleMap || input.account_role_map || ctx.accountRoleMap || ctx.account_role_map || {},
    account_role_map: input.account_role_map || input.accountRoleMap || ctx.account_role_map || ctx.accountRoleMap || {},
  };
};

const buildEngineOptions = (context = {}, input = {}) => {
  const ctx = buildContext(context);

  return {
    ...ctx,
    ...input,

    dbData: ctx.dbData,
    source: ctx.source,

    branchId: normalizeBranchId(input.branch_id || input.branchId || ctx.branchId),
    branch_id: normalizeBranchId(input.branch_id || input.branchId || ctx.branchId),

    warehouseId: normalizeWarehouseId(input.warehouse_id || input.warehouseId || ctx.warehouseId),
    warehouse_id: normalizeWarehouseId(input.warehouse_id || input.warehouseId || ctx.warehouseId),

    createdBy: input.created_by || input.createdBy || input.operator || ctx.createdBy,
    created_by: input.created_by || input.createdBy || input.operator || ctx.createdBy,

    rulesSource: input.rulesSource || input.rules_source || ctx.rulesSource || ctx.rules_source || ctx.dbData,
    rules_source: input.rules_source || input.rulesSource || ctx.rules_source || ctx.rulesSource || ctx.dbData,

    inventorySource: input.inventorySource || input.inventory_source || ctx.inventorySource || ctx.inventory_source || ctx.dbData,
    inventory_source: input.inventory_source || input.inventorySource || ctx.inventory_source || ctx.inventorySource || ctx.dbData,

    bomSource: input.bomSource || input.bom_source || ctx.bomSource || ctx.bom_source || ctx.dbData,
    bom_source: input.bom_source || input.bomSource || ctx.bom_source || ctx.bomSource || ctx.dbData,
  };
};

const extractSnapshotFromPackage = (packageInput = {}, candidateKeys = []) => {
  if (!isObject(packageInput)) return null;

  for (const key of candidateKeys) {
    if (packageInput[key]) return packageInput[key];
  }

  const nestedKeys = [
    'purchase_header',
    'order_header',
    'sales_header',
    'batch_header',
    'journal_header',
    'payment_header',
    'reversal_header',
  ];

  for (const nestedKey of nestedKeys) {
    const nested = packageInput[nestedKey];

    if (!isObject(nested)) continue;

    for (const key of candidateKeys) {
      if (nested[key]) {
        const parsed = parseJson(nested[key], nested[key]);
        return parsed;
      }
    }
  }

  return null;
};

/* =========================================================================
   ORCHESTRATOR SNAPSHOT
   ========================================================================= */

const createOrchestratorSnapshot = (params = {}, options = {}) => {
  const warnings = safeArray(params.warnings);
  const branchId = normalizeBranchId(params.branch_id || params.branchId || options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE);

  const conversionSnapshot = options.includeConversionSnapshot === false
    ? null
    : createConversionSnapshot(options.rulesSource || options.rules_source || options.dbData || options.source || [], {
        branchId,
      });

  const snapshotResult = createSnapshot({
    snapshot_type: 'TRANSACTION',
    snapshot_version: ORCHESTRATOR_VERSION,

    transaction_id: params.transaction_id || params.transactionId || generateId('ORCH-SNP'),
    transaction_type: params.transaction_type || params.transactionType || 'ERP_ORCHESTRATOR',

    branch_id: branchId,
    created_by: params.created_by || params.createdBy || options.createdBy || options.created_by || 'SYSTEM',

    engine_versions: {
      erpOrchestrator: ORCHESTRATOR_VERSION,
      masterDataEngine: 'ERP_DA_V2_MASTER_DATA_ENGINE_1',
      conversionEngine: 'ERP_DA_V2_CONVERSION_ENGINE_1',
      bomEngine: 'ERP_DA_V2_BOM_ENGINE_1',
      inventoryLayerEngine: 'ERP_DA_V2_INVENTORY_LAYER_ENGINE_1',
      hppEngine: 'ERP_DA_V2_HPP_ENGINE_1',
      productionEngine: 'ERP_DA_V2_PRODUCTION_ENGINE_1',
      purchaseEngine: 'ERP_DA_V2_PURCHASE_ENGINE_1',
      salesEngine: 'ERP_DA_V2_SALES_ENGINE_1',
      accountingEngine: 'ERP_DA_V2_ACCOUNTING_ENGINE_1',
      profitEngine: 'ERP_DA_V2_PROFIT_ENGINE_1',
      snapshotEngine: 'ERP_DA_V2_SNAPSHOT_ENGINE_1',
    },

    payload: {
      process_type: params.process_type || params.processType || '',
      branch_id: branchId,
      package_summary: params.package_summary || params.packageSummary || {},
      package_payload: params.package_payload || params.packagePayload || {},
      conversion_snapshot: conversionSnapshot,
      historical_integrity: true,
    },

    warnings,

    meta: {
      source_module: 'erpOrchestrator',
      orchestrator_version: ORCHESTRATOR_VERSION,
      historical_integrity: true,
    },
  }, {
    freeze: false,
    allowInvalid: true,
  });

  if (options.lock === false) {
    return snapshotResult;
  }

  const locked = lockSnapshot(snapshotResult.snapshot, {
    allowInvalid: true,
    lockedBy: params.created_by || params.createdBy || options.createdBy || options.created_by || 'SYSTEM',
  });

  return {
    ok: locked.ok,
    snapshot: locked.snapshot || snapshotResult.snapshot,
    warnings: [
      ...snapshotResult.warnings,
      ...locked.warnings,
    ],
  };
};

const mergeProcessSnapshots = (snapshots = [], options = {}) => {
  const validSnapshots = safeArray(snapshots).filter(Boolean);

  if (validSnapshots.length === 0) {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        makeWarning('NO_SNAPSHOT_TO_MERGE', 'Tidak ada snapshot untuk digabung di orchestrator.'),
      ],
    };
  }

  return mergeSnapshots(validSnapshots, {
    ...options,
    mergeType: 'ERP_ORCHESTRATOR_COMPOSITE',
    transactionType: options.transactionType || options.transaction_type || 'ERP_ORCHESTRATOR_COMPOSITE',
    createdBy: options.createdBy || options.created_by || 'SYSTEM',
    allowInvalid: true,
  });
};

/* =========================================================================
   MASTER SUMMARY
   ========================================================================= */

const getMasterSummary = (source = {}, options = {}) => {
  const warnings = [];

  const branches = getBranches(source, options);
  const warehouses = getWarehouses(source, options);
  const customers = getCustomers(source, options);
  const suppliers = getSuppliers(source, options);
  const products = getProducts(source, options);
  const rawMaterials = getRawMaterials(source, options);
  const employees = getEmployees(source, options);
  const coa = getChartOfAccounts(source, options);
  const kewajiban = getKewajiban(source, options);

  warnings.push(
    ...branches.warnings,
    ...warehouses.warnings,
    ...customers.warnings,
    ...suppliers.warnings,
    ...products.warnings,
    ...rawMaterials.warnings,
    ...employees.warnings,
    ...coa.warnings,
    ...kewajiban.warnings,
  );

  const masterSnapshot = createMasterSnapshot({
    masterType: 'BRANCH',
    records: branches.records,
    branch_id: options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE,
    created_by: options.createdBy || options.created_by || 'SYSTEM',
    warnings,
  }, {
    lock: true,
  });

  warnings.push(...masterSnapshot.warnings);

  return {
    ok: true,
    summary: {
      branches: branches.records.length,
      warehouses: warehouses.records.length,
      customers: customers.records.length,
      suppliers: suppliers.records.length,
      products: products.records.length,
      raw_materials: rawMaterials.records.length,
      employees: employees.records.length,
      chart_of_accounts: coa.records.length,
      kewajiban: kewajiban.records.length,
    },
    records: {
      branches: branches.records,
      warehouses: warehouses.records,
      customers: customers.records,
      suppliers: suppliers.records,
      products: products.records,
      raw_materials: rawMaterials.records,
      employees: employees.records,
      chart_of_accounts: coa.records,
      kewajiban: kewajiban.records,
    },
    master_snapshot: masterSnapshot.snapshot || null,
    warnings,
  };
};

/* =========================================================================
   PROCESS PURCHASE
   ========================================================================= */

export const processPurchase = (input = {}, context = {}) => {
  const warnings = [];
  const options = buildEngineOptions(context, input);
  const accountingOptions = buildAccountingOptions(context, input);

  const purchaseResult = input.draftOnly || input.draft_only
    ? createPurchaseOrder(input, options)
    : receivePurchase(input, options);

  warnings.push(...purchaseResult.warnings);

  const purchasePackage = purchaseResult.purchase_transaction_package || null;

  const accountingResult = purchasePackage
    ? createPurchaseJournal({
        purchase_transaction_package: purchasePackage,
      }, accountingOptions)
    : {
        ok: false,
        journal_package: null,
        warnings: [
          makeWarning('PURCHASE_PACKAGE_NOT_CREATED', 'Purchase package tidak tersedia untuk dibuat jurnal.'),
        ],
      };

  warnings.push(...accountingResult.warnings);

  const purchaseSnapshot = extractSnapshotFromPackage(purchasePackage || {}, [
    'purchase_snapshot',
    'purchase_snapshot_json',
  ]);

  const accountingSnapshot = accountingResult.journal_package?.accounting_snapshot || null;

  const orchestratorSnapshot = createOrchestratorSnapshot({
    process_type: PROCESS_TYPES.PURCHASE,
    transaction_id: purchasePackage?.purchase_header?.purchase_id || generateId('ORCH-PUR'),
    transaction_type: 'PROCESS_PURCHASE',
    branch_id: input.branch_id || input.branchId || options.branchId,
    created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
    package_summary: {
      purchase_ok: purchaseResult.ok,
      accounting_ok: accountingResult.ok,
      purchase_id: purchasePackage?.purchase_header?.purchase_id || '',
      total_amount: purchasePackage?.purchase_header?.total_amount || 0,
      inventory_layer_count: safeArray(purchasePackage?.inventory_layers).length,
    },
    package_payload: {
      purchase_transaction_package: purchasePackage,
      journal_package: accountingResult.journal_package || null,
    },
    warnings,
  }, options);

  warnings.push(...orchestratorSnapshot.warnings);

  const compositeSnapshot = mergeProcessSnapshots([
    purchaseSnapshot,
    accountingSnapshot,
    orchestratorSnapshot.snapshot,
  ], {
    branchId: input.branch_id || input.branchId || options.branchId,
    transactionId: purchasePackage?.purchase_header?.purchase_id || '',
    transactionType: 'PURCHASE_ORCHESTRATED',
    createdBy: input.created_by || input.createdBy || input.operator || options.createdBy,
  });

  warnings.push(...compositeSnapshot.warnings);

  const transactionPackage = {
    package_type: 'ORCHESTRATED_PURCHASE_PACKAGE',
    package_version: ORCHESTRATOR_VERSION,
    generated_at: new Date().toISOString(),

    purchase_transaction_package: purchasePackage,
    inventory_layer_package: purchasePackage?.inventory_layers || null,
    accounting_package: accountingResult.journal_package || null,
    journal_package: accountingResult.journal_package || null,

    orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
    snapshot_package: compositeSnapshot.snapshot || orchestratorSnapshot.snapshot || null,
    composite_snapshot: compositeSnapshot.snapshot || null,

    status: purchaseResult.ok && accountingResult.ok
      ? PROCESS_STATUS.SUCCESS
      : PROCESS_STATUS.BLOCKED,

    warnings,
  };

  return {
    ok: transactionPackage.status === PROCESS_STATUS.SUCCESS,
    transaction_package: transactionPackage,
    purchase_transaction_package: purchasePackage,
    inventory_layer_package: purchasePackage?.inventory_layers || null,
    accounting_package: accountingResult.journal_package || null,
    journal_package: accountingResult.journal_package || null,
    snapshot_package: compositeSnapshot.snapshot || orchestratorSnapshot.snapshot || null,
    warnings,
  };
};

/* =========================================================================
   PROCESS PRODUCTION
   ========================================================================= */

export const processProduction = (input = {}, context = {}) => {
  const warnings = [];
  const options = buildEngineOptions(context, input);
  const accountingOptions = buildAccountingOptions(context, input);

  const activeBom = getActiveBom(options.bomSource || options.dbData, {
    productId: input.product_id || input.productId,
    productName: input.product_name || input.productName,
    recipeId: input.recipe_id || input.recipeId,
    recipeVersion: input.recipe_version || input.recipeVersion,
    branchId: input.branch_id || input.branchId || options.branchId,
    franchiseId: input.franchise_id || input.franchiseId,
    asOfDate: input.production_date || input.productionDate || input.date || getTodayISO(),
  });

  warnings.push(...activeBom.warnings);

  const productionSimulation = simulateProduction(input, options);
  warnings.push(...productionSimulation.warnings);

  const productionHppPreview = calculateProductionHpp({
    ...options,
    ...input,
    targetYieldQty: input.target_qty || input.targetQty,
    targetYieldUnit: input.target_unit || input.targetUnit,
    branchId: input.branch_id || input.branchId || options.branchId,
    warehouseId: input.warehouse_id || input.warehouseId || options.warehouseId,
    productionDate: input.production_date || input.productionDate || input.date || getTodayISO(),
  });

  warnings.push(...productionHppPreview.warnings);

  const productionResult = createProductionBatch(input, options);
  warnings.push(...productionResult.warnings);

  const productionPackage = productionResult.production_batch_package || null;

  const accountingResult = productionPackage
    ? createProductionJournal({
        production_batch_package: productionPackage,
      }, accountingOptions)
    : {
        ok: false,
        journal_package: null,
        warnings: [
          makeWarning('PRODUCTION_PACKAGE_NOT_CREATED', 'Production package tidak tersedia untuk dibuat jurnal.'),
        ],
      };

  warnings.push(...accountingResult.warnings);

  const productionSnapshot = extractSnapshotFromPackage(productionPackage || {}, [
    'production_snapshot',
    'production_snapshot_json',
  ]);

  const accountingSnapshot = accountingResult.journal_package?.accounting_snapshot || null;

  const orchestratorSnapshot = createOrchestratorSnapshot({
    process_type: PROCESS_TYPES.PRODUCTION,
    transaction_id: productionPackage?.batch_header?.batch_id || generateId('ORCH-PROD'),
    transaction_type: 'PROCESS_PRODUCTION',
    branch_id: input.branch_id || input.branchId || options.branchId,
    created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
    package_summary: {
      production_ok: productionResult.ok,
      accounting_ok: accountingResult.ok,
      simulation_ok: productionSimulation.ok,
      batch_id: productionPackage?.batch_header?.batch_id || '',
      total_hpp: productionPackage?.batch_header?.total_hpp || 0,
      finished_goods_layer_id: productionPackage?.finished_goods?.layer_id || '',
      active_bom_id: activeBom.bom?.recipe_id || '',
    },
    package_payload: {
      production_simulation: productionSimulation.simulation || null,
      production_hpp_preview: productionHppPreview,
      production_batch_package: productionPackage,
      journal_package: accountingResult.journal_package || null,
    },
    warnings,
  }, options);

  warnings.push(...orchestratorSnapshot.warnings);

  const compositeSnapshot = mergeProcessSnapshots([
    productionSnapshot,
    accountingSnapshot,
    orchestratorSnapshot.snapshot,
  ], {
    branchId: input.branch_id || input.branchId || options.branchId,
    transactionId: productionPackage?.batch_header?.batch_id || '',
    transactionType: 'PRODUCTION_ORCHESTRATED',
    createdBy: input.created_by || input.createdBy || input.operator || options.createdBy,
  });

  warnings.push(...compositeSnapshot.warnings);

  const transactionPackage = {
    package_type: 'ORCHESTRATED_PRODUCTION_PACKAGE',
    package_version: ORCHESTRATOR_VERSION,
    generated_at: new Date().toISOString(),

    production_batch_package: productionPackage,
    journal_package: accountingResult.journal_package || null,
    accounting_package: accountingResult.journal_package || null,

    production_simulation: productionSimulation.simulation || null,
    production_hpp_preview: productionHppPreview,
    hpp_package: productionHppPreview || null,

    inventory_consumption_package: productionPackage?.material_consumptions || productionPackage?.consumed_layers || null,
    finished_goods_layer_package: productionPackage?.finished_goods || null,

    orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
    snapshot_package: compositeSnapshot.snapshot || orchestratorSnapshot.snapshot || null,
    composite_snapshot: compositeSnapshot.snapshot || null,

    status: productionResult.ok && accountingResult.ok
      ? PROCESS_STATUS.SUCCESS
      : PROCESS_STATUS.BLOCKED,

    warnings,
  };

  return {
    ok: transactionPackage.status === PROCESS_STATUS.SUCCESS,
    transaction_package: transactionPackage,
    production_batch_package: productionPackage,
    inventory_consumption_package: transactionPackage.inventory_consumption_package,
    finished_goods_layer_package: transactionPackage.finished_goods_layer_package,
    hpp_package: transactionPackage.hpp_package,
    accounting_package: accountingResult.journal_package || null,
    journal_package: accountingResult.journal_package || null,
    snapshot_package: transactionPackage.snapshot_package,
    warnings,
  };
};

/* =========================================================================
   PROCESS SALES
   ========================================================================= */

export const processSales = (input = {}, context = {}) => {
  const warnings = [];
  const options = buildEngineOptions(context, input);
  const accountingOptions = buildAccountingOptions(context, input);

  const salesResult = createSalesOrder(input, options);
  warnings.push(...salesResult.warnings);

  const salesPackage = salesResult.sales_transaction_package || null;

  const hppAudit = salesPackage
    ? calculateOrderHpp({
        ...options,
        ...input,
        hppSnapshot: salesPackage.hpp_snapshot,
        preferExistingSnapshot: true,
        totalRevenue: salesPackage.order_header?.total_revenue || salesPackage.order_header?.total_amount || 0,
      })
    : {
        ok: false,
        warnings: [
          makeWarning('SALES_PACKAGE_NOT_CREATED', 'Sales package tidak tersedia untuk audit HPP.'),
        ],
      };

  warnings.push(...hppAudit.warnings);

  const accountingResult = salesPackage
    ? createSalesJournal({
        sales_transaction_package: salesPackage,
      }, accountingOptions)
    : {
        ok: false,
        journal_package: null,
        warnings: [
          makeWarning('SALES_PACKAGE_NOT_CREATED', 'Sales package tidak tersedia untuk dibuat jurnal.'),
        ],
      };

  warnings.push(...accountingResult.warnings);

  const profitSource = {
    ...(options.dbData || {}),
    sales_packages: [
      salesPackage,
      ...safeArray(options.dbData?.sales_packages),
      ...safeArray(options.dbData?.salesPackages),
    ].filter(Boolean),
    expenses: options.dbData?.expenses || [],
    payroll: options.dbData?.payroll || [],
    gaji: options.dbData?.gaji || [],
    master_kewajiban: options.dbData?.master_kewajiban || [],
    trx_pembayaran_kewajiban: options.dbData?.trx_pembayaran_kewajiban || [],
  };

  const profitResult = calculateBranchProfit(profitSource, {
    ...options,
    branchId: input.branch_id || input.branchId || options.branchId,
    dateFrom: input.order_date || input.orderDate || input.sales_date || input.salesDate || input.date || '',
    dateTo: input.order_date || input.orderDate || input.sales_date || input.salesDate || input.date || '',
  });

  warnings.push(...profitResult.warnings);

  const salesSnapshot = extractSnapshotFromPackage(salesPackage || {}, [
    'sales_snapshot',
    'sales_snapshot_json',
  ]);

  const accountingSnapshot = accountingResult.journal_package?.accounting_snapshot || null;
  const profitSnapshot = profitResult.profit_package?.profit_snapshot || null;

  const orchestratorSnapshot = createOrchestratorSnapshot({
    process_type: PROCESS_TYPES.SALES,
    transaction_id: salesPackage?.order_header?.order_id || salesPackage?.sales_header?.sales_id || generateId('ORCH-SALES'),
    transaction_type: 'PROCESS_SALES',
    branch_id: input.branch_id || input.branchId || options.branchId,
    created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
    package_summary: {
      sales_ok: salesResult.ok,
      accounting_ok: accountingResult.ok,
      profit_ok: profitResult.ok,
      hpp_audit_ok: hppAudit.ok,
      order_id: salesPackage?.order_header?.order_id || salesPackage?.sales_header?.sales_id || '',
      total_revenue: salesPackage?.order_header?.total_revenue || salesPackage?.order_header?.total_amount || salesPackage?.sales_header?.total_amount || 0,
      total_hpp: salesPackage?.order_header?.total_hpp || salesPackage?.sales_header?.total_hpp || 0,
      gross_profit: salesPackage?.order_header?.gross_profit || salesPackage?.sales_header?.gross_profit || 0,
      gross_margin_pct: salesPackage?.order_header?.gross_margin_pct || salesPackage?.sales_header?.gross_margin_pct || 0,
    },
    package_payload: {
      sales_transaction_package: salesPackage,
      journal_package: accountingResult.journal_package || null,
      profit_package: profitResult.profit_package || null,
      hpp_audit: hppAudit,
    },
    warnings,
  }, options);

  warnings.push(...orchestratorSnapshot.warnings);

  const compositeSnapshot = mergeProcessSnapshots([
    salesSnapshot,
    accountingSnapshot,
    profitSnapshot,
    orchestratorSnapshot.snapshot,
  ], {
    branchId: input.branch_id || input.branchId || options.branchId,
    transactionId: salesPackage?.order_header?.order_id || salesPackage?.sales_header?.sales_id || '',
    transactionType: 'SALES_ORCHESTRATED',
    createdBy: input.created_by || input.createdBy || input.operator || options.createdBy,
  });

  warnings.push(...compositeSnapshot.warnings);

  const transactionPackage = {
    package_type: 'ORCHESTRATED_SALES_PACKAGE',
    package_version: ORCHESTRATOR_VERSION,
    generated_at: new Date().toISOString(),

    sales_transaction_package: salesPackage,
    inventory_consumption_package: salesPackage?.inventory_consumptions || salesPackage?.consumed_layers || salesPackage?.finished_goods_consumptions || null,
    hpp_package: hppAudit || null,
    profit_package: profitResult.profit_package || null,
    accounting_package: accountingResult.journal_package || null,
    journal_package: accountingResult.journal_package || null,

    orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
    snapshot_package: compositeSnapshot.snapshot || orchestratorSnapshot.snapshot || null,
    composite_snapshot: compositeSnapshot.snapshot || null,

    status: salesResult.ok && accountingResult.ok && profitResult.ok
      ? PROCESS_STATUS.SUCCESS
      : PROCESS_STATUS.BLOCKED,

    warnings,
  };

  return {
    ok: transactionPackage.status === PROCESS_STATUS.SUCCESS,
    transaction_package: transactionPackage,
    sales_transaction_package: salesPackage,
    inventory_consumption_package: transactionPackage.inventory_consumption_package,
    hpp_package: hppAudit || null,
    profit_package: profitResult.profit_package || null,
    accounting_package: accountingResult.journal_package || null,
    journal_package: accountingResult.journal_package || null,
    snapshot_package: transactionPackage.snapshot_package,
    warnings,
  };
};

/* =========================================================================
   PROCESS EXPENSE
   ========================================================================= */

const normalizeExpenseInput = (input = {}, context = {}) => {
  const options = buildEngineOptions(context, input);

  const amount = safeNumber(input.amount || input.total_amount || input.nominal, 0);
  const amountPaid = input.amount_paid !== undefined || input.amountPaid !== undefined
    ? safeNumber(input.amount_paid ?? input.amountPaid, 0)
    : amount;

  const expenseId = input.expense_id || input.expenseId || input.id || generateId('EXP');

  return {
    id: expenseId,
    expense_id: expenseId,

    date: normalizeDateString(input.expense_date || input.expenseDate || input.date || getTodayISO()),
    expense_date: normalizeDateString(input.expense_date || input.expenseDate || input.date || getTodayISO()),

    branch_id: normalizeBranchId(input.branch_id || input.branchId || options.branchId),
    warehouse_id: normalizeWarehouseId(input.warehouse_id || input.warehouseId || options.warehouseId),

    category: normalizeCode(input.category || input.kategori || 'OPERATING_EXPENSE'),
    description: input.description || input.notes || input.keterangan || '',

    account_code: input.account_code || input.accountCode || '',

    amount: roundMoney(amount),
    amount_paid: roundMoney(amountPaid),
    remaining_amount: roundMoney(Math.max(amount - amountPaid, 0)),

    payment_method: normalizeCode(input.payment_method || input.paymentMethod || ''),

    created_at: new Date().toISOString(),
    created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
    isDeleted: false,
  };
};

export const processExpense = (input = {}, context = {}) => {
  const warnings = [];
  const expense = normalizeExpenseInput(input, context);
  const accountingOptions = buildAccountingOptions(context, expense);

  if (!expense.branch_id || expense.branch_id === DEFAULT_BRANCH_SCOPE) {
    warnings.push(makeWarning('INVALID_BRANCH', 'branch_id expense tidak valid atau masih GLOBAL.', {
      branch_id: expense.branch_id,
    }));
  }

  if (expense.amount <= 0) {
    warnings.push(makeWarning('INVALID_EXPENSE_AMOUNT', 'Nominal expense harus lebih dari 0.', {
      amount: expense.amount,
    }));
  }

  const accountingResult = createExpenseJournal(expense, accountingOptions);
  warnings.push(...accountingResult.warnings);

  const expenseSnapshot = createTransactionSnapshot({
    snapshot_type: 'TRANSACTION',
    transaction_id: expense.expense_id,
    transaction_type: 'EXPENSE',
    branch_id: expense.branch_id,
    created_by: expense.created_by,
    transaction_header: expense,
    transaction_items: [],
    additional_payload: {
      expense,
      journal_package: accountingResult.journal_package || null,
    },
    warnings,
    engine_versions: {
      erpOrchestrator: ORCHESTRATOR_VERSION,
    },
    meta: {
      source_module: 'erpOrchestrator',
      source_table: 'expenses',
      source_id: expense.expense_id,
    },
  }, {
    lock: true,
    allowInvalid: true,
  });

  warnings.push(...expenseSnapshot.warnings);

  const orchestratorSnapshot = createOrchestratorSnapshot({
    process_type: PROCESS_TYPES.EXPENSE,
    transaction_id: expense.expense_id,
    transaction_type: 'PROCESS_EXPENSE',
    branch_id: expense.branch_id,
    created_by: expense.created_by,
    package_summary: {
      expense_id: expense.expense_id,
      amount: expense.amount,
      accounting_ok: accountingResult.ok,
    },
    package_payload: {
      expense,
      journal_package: accountingResult.journal_package || null,
      expense_snapshot: expenseSnapshot.snapshot || null,
    },
    warnings,
  }, buildEngineOptions(context, input));

  warnings.push(...orchestratorSnapshot.warnings);

  const expensePackage = {
    package_type: 'ORCHESTRATED_EXPENSE_PACKAGE',
    package_version: ORCHESTRATOR_VERSION,
    generated_at: new Date().toISOString(),

    expense_header: {
      ...expense,
      expense_snapshot_json: expenseSnapshot.snapshot ? JSON.stringify(expenseSnapshot.snapshot) : '',
    },

    journal_package: accountingResult.journal_package || null,
    accounting_package: accountingResult.journal_package || null,
    expense_snapshot: expenseSnapshot.snapshot || null,
    orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
    snapshot_package: orchestratorSnapshot.snapshot || expenseSnapshot.snapshot || null,

    status: warnings.some((warning) => warning.code === 'INVALID_BRANCH' || warning.code === 'INVALID_EXPENSE_AMOUNT') || !accountingResult.ok
      ? PROCESS_STATUS.BLOCKED
      : PROCESS_STATUS.SUCCESS,

    warnings,
  };

  return {
    ok: expensePackage.status === PROCESS_STATUS.SUCCESS,
    transaction_package: expensePackage,
    expense_package: expensePackage,
    journal_package: accountingResult.journal_package || null,
    accounting_package: accountingResult.journal_package || null,
    snapshot_package: expensePackage.snapshot_package,
    warnings,
  };
};

/* =========================================================================
   PROCESS PAYMENT / KASBON / KEWAJIBAN
   ========================================================================= */

const normalizePaymentInput = (input = {}, context = {}, forcedType = '') => {
  const options = buildEngineOptions(context, input);

  const paymentId = input.payment_id || input.paymentId || input.transaction_id || input.transactionId || input.id || generateId('PAY');
  const amount = safeNumber(input.amount || input.nominal || input.nominal_dibayar || input.payment_amount, 0);

  return {
    id: paymentId,
    payment_id: paymentId,
    transaction_id: input.transaction_id || input.transactionId || paymentId,

    code: input.payment_code || input.paymentCode || input.transaction_code || input.transactionCode || paymentId,
    payment_code: input.payment_code || input.paymentCode || input.transaction_code || input.transactionCode || paymentId,
    transaction_code: input.transaction_code || input.transactionCode || input.payment_code || input.paymentCode || paymentId,

    date: normalizeDateString(input.payment_date || input.paymentDate || input.transaction_date || input.transactionDate || input.tanggal_bayar || input.date || getTodayISO()),
    payment_date: normalizeDateString(input.payment_date || input.paymentDate || input.transaction_date || input.transactionDate || input.tanggal_bayar || input.date || getTodayISO()),
    transaction_date: normalizeDateString(input.transaction_date || input.transactionDate || input.payment_date || input.paymentDate || input.date || getTodayISO()),

    branch_id: normalizeBranchId(input.branch_id || input.branchId || options.branchId),
    warehouse_id: normalizeWarehouseId(input.warehouse_id || input.warehouseId || options.warehouseId),

    payment_type: normalizeCode(forcedType || input.payment_type || input.paymentType || input.type || input.category || ''),
    category: normalizeCode(input.category || forcedType || input.payment_type || input.type || ''),
    transaction_type: normalizeCode(input.transaction_type || input.transactionType || input.type || forcedType || 'PAYMENT'),
    source_module: normalizeCode(input.source_module || input.sourceModule || input.module || input.category || forcedType || 'MANUAL'),

    account_id: input.account_id || input.accountId || input.cash_account_id || input.cashAccountId || '',
    account_name: input.account_name || input.accountName || input.cash_account_name || input.cashAccountName || '',

    target_account_id: input.target_account_id || input.targetAccountId || input.to_account_id || input.toAccountId || '',
    target_account_name: input.target_account_name || input.targetAccountName || input.to_account_name || input.toAccountName || '',

    amount: roundMoney(amount),
    nominal: roundMoney(amount),
    nominal_dibayar: roundMoney(amount),
    payment_amount: roundMoney(amount),

    payment_method: normalizeCode(input.payment_method || input.paymentMethod || input.method || ''),

    reference_table: input.reference_table || input.referenceTable || '',
    reference_id: input.reference_id || input.referenceId || input.order_id || input.sales_id || input.purchase_id || input.kewajiban_id || input.receivable_id || input.payable_id || '',

    receivable_id: input.receivable_id || input.receivableId || '',
    receivable_code: input.receivable_code || input.receivableCode || '',
    payable_id: input.payable_id || input.payableId || '',
    payable_code: input.payable_code || input.payableCode || '',

    sales_id: input.sales_id || input.salesId || '',
    purchase_id: input.purchase_id || input.purchaseId || '',

    customer_id: input.customer_id || input.customerId || '',
    customer_name: input.customer_name || input.customerName || '',
    supplier_id: input.supplier_id || input.supplierId || '',
    supplier_name: input.supplier_name || input.supplierName || '',
    employee_id: input.employee_id || input.employeeId || input.karyawan_id || '',
    employee_name: input.employee_name || input.employeeName || input.nama_karyawan || '',

    reference_number: input.reference_number || input.referenceNumber || input.ref_number || input.refNumber || '',
    description: input.description || input.notes || input.keterangan || '',
    notes: input.notes || input.description || input.keterangan || '',

    created_at: new Date().toISOString(),
    created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
    isDeleted: false,
  };
};

export const processPayment = (input = {}, context = {}) => {
  const warnings = [];
  const payment = normalizePaymentInput(input, context);
  const accountingOptions = buildAccountingOptions(context, payment);

  if (!payment.branch_id || payment.branch_id === DEFAULT_BRANCH_SCOPE) {
    warnings.push(makeWarning('INVALID_BRANCH', 'branch_id payment tidak valid atau masih GLOBAL.', {
      branch_id: payment.branch_id,
    }));
  }

  if (payment.amount <= 0) {
    warnings.push(makeWarning('INVALID_PAYMENT_AMOUNT', 'Nominal payment harus lebih dari 0.', {
      amount: payment.amount,
    }));
  }

  const accountingResult = createPaymentJournal(payment, accountingOptions);
  warnings.push(...accountingResult.warnings);

  const paymentSnapshot = createTransactionSnapshot({
    snapshot_type: 'TRANSACTION',
    transaction_id: payment.payment_id,
    transaction_type: 'PAYMENT',
    branch_id: payment.branch_id,
    created_by: payment.created_by,
    transaction_header: payment,
    transaction_items: [],
    additional_payload: {
      payment,
      journal_package: accountingResult.journal_package || null,
    },
    warnings,
    engine_versions: {
      erpOrchestrator: ORCHESTRATOR_VERSION,
    },
    meta: {
      source_module: 'erpOrchestrator',
      source_table: 'payments',
      source_id: payment.payment_id,
    },
  }, {
    lock: true,
    allowInvalid: true,
  });

  warnings.push(...paymentSnapshot.warnings);

  const orchestratorSnapshot = createOrchestratorSnapshot({
    process_type: PROCESS_TYPES.PAYMENT,
    transaction_id: payment.payment_id,
    transaction_type: 'PROCESS_PAYMENT',
    branch_id: payment.branch_id,
    created_by: payment.created_by,
    package_summary: {
      payment_id: payment.payment_id,
      payment_type: payment.payment_type,
      category: payment.category,
      amount: payment.amount,
      accounting_ok: accountingResult.ok,
    },
    package_payload: {
      payment,
      journal_package: accountingResult.journal_package || null,
      payment_snapshot: paymentSnapshot.snapshot || null,
    },
    warnings,
  }, buildEngineOptions(context, input));

  warnings.push(...orchestratorSnapshot.warnings);

  const paymentPackage = {
    package_type: 'ORCHESTRATED_PAYMENT_PACKAGE',
    package_version: ORCHESTRATOR_VERSION,
    generated_at: new Date().toISOString(),

    payment_header: {
      ...payment,
      payment_snapshot_json: paymentSnapshot.snapshot ? JSON.stringify(paymentSnapshot.snapshot) : '',
    },

    journal_package: accountingResult.journal_package || null,
    accounting_package: accountingResult.journal_package || null,
    payment_snapshot: paymentSnapshot.snapshot || null,
    orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
    snapshot_package: orchestratorSnapshot.snapshot || paymentSnapshot.snapshot || null,

    status: warnings.some((warning) => warning.code === 'INVALID_BRANCH' || warning.code === 'INVALID_PAYMENT_AMOUNT') || !accountingResult.ok
      ? PROCESS_STATUS.BLOCKED
      : PROCESS_STATUS.SUCCESS,

    warnings,
  };

  const transactionPackage = {
    ...paymentPackage,
    payment_package: paymentPackage,
    cash_transaction_package: paymentPackage,
  };

  return {
    ok: paymentPackage.status === PROCESS_STATUS.SUCCESS,
    transaction_package: transactionPackage,
    payment_package: paymentPackage,
    cash_transaction_package: paymentPackage,
    journal_package: accountingResult.journal_package || null,
    accounting_package: accountingResult.journal_package || null,
    snapshot_package: paymentPackage.snapshot_package,
    warnings,
  };
};

export const processReceivablePayment = (input = {}, context = {}) => {
  const paymentResult = processPayment(
    {
      ...(input || {}),
      payment_type: 'RECEIVABLE',
      category: 'PIUTANG_CUSTOMER',
    },
    context,
  );

  const receivablePaymentPackage = {
    ...(paymentResult.payment_package || {}),
    package_type: 'ORCHESTRATED_RECEIVABLE_PAYMENT_PACKAGE',
  };

  return {
    ...paymentResult,
    transaction_package: {
      ...(paymentResult.transaction_package || {}),
      receivable_payment_package: receivablePaymentPackage,
      cash_transaction_package: paymentResult.cash_transaction_package || paymentResult.payment_package || null,
      accounting_package: paymentResult.accounting_package || paymentResult.journal_package || null,
      snapshot_package: paymentResult.snapshot_package || null,
    },
    receivable_payment_package: receivablePaymentPackage,
    cash_transaction_package: paymentResult.cash_transaction_package || paymentResult.payment_package || null,
    accounting_package: paymentResult.accounting_package || paymentResult.journal_package || null,
    snapshot_package: paymentResult.snapshot_package || null,
  };
};

export const processPayablePayment = (input = {}, context = {}) => {
  const paymentResult = processPayment(
    {
      ...(input || {}),
      payment_type: 'PAYABLE',
      category: 'HUTANG_SUPPLIER',
    },
    context,
  );

  const payablePaymentPackage = {
    ...(paymentResult.payment_package || {}),
    package_type: 'ORCHESTRATED_PAYABLE_PAYMENT_PACKAGE',
  };

  return {
    ...paymentResult,
    transaction_package: {
      ...(paymentResult.transaction_package || {}),
      payable_payment_package: payablePaymentPackage,
      cash_transaction_package: paymentResult.cash_transaction_package || paymentResult.payment_package || null,
      accounting_package: paymentResult.accounting_package || paymentResult.journal_package || null,
      snapshot_package: paymentResult.snapshot_package || null,
    },
    payable_payment_package: payablePaymentPackage,
    cash_transaction_package: paymentResult.cash_transaction_package || paymentResult.payment_package || null,
    accounting_package: paymentResult.accounting_package || paymentResult.journal_package || null,
    snapshot_package: paymentResult.snapshot_package || null,
  };
};

export const processCashTransaction = (input = {}, context = {}) => {
  const paymentResult = processPayment(
    {
      ...(input || {}),
      payment_type: 'CASH_BANK',
      category: input.category || input.source_module || 'KAS_BANK',
    },
    context,
  );

  const cashTransactionPackage = {
    ...(paymentResult.payment_package || {}),
    package_type: 'ORCHESTRATED_CASH_BANK_PACKAGE',
  };

  return {
    ...paymentResult,
    transaction_package: {
      ...(paymentResult.transaction_package || {}),
      cash_transaction_package: cashTransactionPackage,
      accounting_package: paymentResult.accounting_package || paymentResult.journal_package || null,
      snapshot_package: paymentResult.snapshot_package || null,
    },
    cash_transaction_package: cashTransactionPackage,
    accounting_package: paymentResult.accounting_package || paymentResult.journal_package || null,
    snapshot_package: paymentResult.snapshot_package || null,
  };
};

export const processTransferTransaction = (input = {}, context = {}) => {
  const paymentResult = processPayment(
    {
      ...(input || {}),
      payment_type: 'TRANSFER',
      category: 'TRANSFER',
      transaction_type: 'TRANSFER',
      source_module: 'TRANSFER',
    },
    context,
  );

  const transferTransactionPackage = {
    ...(paymentResult.payment_package || {}),
    package_type: 'ORCHESTRATED_TRANSFER_PACKAGE',
  };

  return {
    ...paymentResult,
    transaction_package: {
      ...(paymentResult.transaction_package || {}),
      transfer_transaction_package: transferTransactionPackage,
      accounting_package: paymentResult.accounting_package || paymentResult.journal_package || null,
      snapshot_package: paymentResult.snapshot_package || null,
    },
    transfer_transaction_package: transferTransactionPackage,
    accounting_package: paymentResult.accounting_package || paymentResult.journal_package || null,
    snapshot_package: paymentResult.snapshot_package || null,
  };
};

export const processKasbon = (input = {}, context = {}) => {
  return processPayment(
    {
      ...(input || {}),
      payment_type: 'KASBON',
      category: 'KASBON',
    },
    context,
  );
};

export const processKewajiban = (input = {}, context = {}) => {
  return processPayment(
    {
      ...(input || {}),
      payment_type: 'KEWAJIBAN',
      category: 'KEWAJIBAN',
    },
    context,
  );
};

/* =========================================================================
   PROCESS ADJUSTMENT
   ========================================================================= */

export const processAdjustment = (input = {}, context = {}) => {
  const warnings = [];
  const options = buildEngineOptions(context, input);
  const accountingOptions = buildAccountingOptions(context, input);

  const adjustmentId = input.adjustment_id || input.adjustmentId || input.id || generateId('ADJ');
  const branchId = normalizeBranchId(input.branch_id || input.branchId || options.branchId);

  const adjustment = {
    id: adjustmentId,
    adjustment_id: adjustmentId,
    date: normalizeDateString(input.adjustment_date || input.adjustmentDate || input.date || getTodayISO()),
    adjustment_date: normalizeDateString(input.adjustment_date || input.adjustmentDate || input.date || getTodayISO()),
    branch_id: branchId,
    warehouse_id: normalizeWarehouseId(input.warehouse_id || input.warehouseId || options.warehouseId),
    adjustment_type: normalizeCode(input.adjustment_type || input.adjustmentType || input.type || 'GENERAL'),
    description: input.description || input.notes || input.keterangan || '',
    amount: roundMoney(input.amount || input.nominal || 0),
    created_at: new Date().toISOString(),
    created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
    isDeleted: false,
  };

  if (!adjustment.branch_id || adjustment.branch_id === DEFAULT_BRANCH_SCOPE) {
    warnings.push(makeWarning('INVALID_BRANCH', 'branch_id adjustment tidak valid atau masih GLOBAL.', {
      branch_id: adjustment.branch_id,
    }));
  }

  const accountingResult = createAdjustmentJournal(adjustment, accountingOptions);
  warnings.push(...accountingResult.warnings);

  const adjustmentSnapshot = createTransactionSnapshot({
    snapshot_type: 'TRANSACTION',
    transaction_id: adjustment.adjustment_id,
    transaction_type: 'ADJUSTMENT',
    branch_id: adjustment.branch_id,
    created_by: adjustment.created_by,
    transaction_header: adjustment,
    transaction_items: [],
    additional_payload: {
      adjustment,
      journal_package: accountingResult.journal_package || null,
    },
    warnings,
    engine_versions: {
      erpOrchestrator: ORCHESTRATOR_VERSION,
    },
    meta: {
      source_module: 'erpOrchestrator',
      source_table: 'adjustments',
      source_id: adjustment.adjustment_id,
    },
  }, {
    lock: true,
    allowInvalid: true,
  });

  warnings.push(...adjustmentSnapshot.warnings);

  const orchestratorSnapshot = createOrchestratorSnapshot({
    process_type: PROCESS_TYPES.ADJUSTMENT,
    transaction_id: adjustment.adjustment_id,
    transaction_type: 'PROCESS_ADJUSTMENT',
    branch_id: adjustment.branch_id,
    created_by: adjustment.created_by,
    package_summary: {
      adjustment_id: adjustment.adjustment_id,
      amount: adjustment.amount,
      accounting_ok: accountingResult.ok,
    },
    package_payload: {
      adjustment,
      journal_package: accountingResult.journal_package || null,
      adjustment_snapshot: adjustmentSnapshot.snapshot || null,
    },
    warnings,
  }, options);

  warnings.push(...orchestratorSnapshot.warnings);

  const adjustmentPackage = {
    package_type: 'ORCHESTRATED_ADJUSTMENT_PACKAGE',
    package_version: ORCHESTRATOR_VERSION,
    generated_at: new Date().toISOString(),
    adjustment_header: adjustment,
    journal_package: accountingResult.journal_package || null,
    accounting_package: accountingResult.journal_package || null,
    adjustment_snapshot: adjustmentSnapshot.snapshot || null,
    orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
    snapshot_package: orchestratorSnapshot.snapshot || adjustmentSnapshot.snapshot || null,
    status: warnings.some((warning) => warning.code === 'INVALID_BRANCH') || !accountingResult.ok
      ? PROCESS_STATUS.BLOCKED
      : PROCESS_STATUS.SUCCESS,
    warnings,
  };

  return {
    ok: adjustmentPackage.status === PROCESS_STATUS.SUCCESS,
    transaction_package: adjustmentPackage,
    adjustment_package: adjustmentPackage,
    journal_package: accountingResult.journal_package || null,
    accounting_package: accountingResult.journal_package || null,
    snapshot_package: adjustmentPackage.snapshot_package,
    warnings,
  };
};

/* =========================================================================
   PROCESS VOID
   ========================================================================= */

export const processVoidTransaction = (input = {}, context = {}) => {
  const warnings = [];
  const options = buildEngineOptions(context, input);
  const accountingOptions = buildAccountingOptions(context, input);

  const transactionType = normalizeCode(input.transaction_type || input.transactionType || input.type || '');
  const transactionId = input.transaction_id || input.transactionId || input.id || generateId('VOID');
  const branchId = normalizeBranchId(input.branch_id || input.branchId || options.branchId);

  let businessReverse = {
    ok: true,
    reversal_package: null,
    warnings: [],
  };

  if (transactionType === PROCESS_TYPES.PURCHASE || transactionType === 'PURCHASE') {
    businessReverse = reversePurchase(input.original_transaction || input, options);
  } else if (transactionType === PROCESS_TYPES.PRODUCTION || transactionType === 'PRODUCTION') {
    businessReverse = reverseProduction(input.original_transaction || input, options);
  } else if (transactionType === PROCESS_TYPES.SALES || transactionType === 'SALES') {
    businessReverse = reverseSales(input.original_transaction || input, options);
  }

  warnings.push(...collectWarnings(businessReverse));

  const accountingReverse = reverseJournal({
    transaction_id: transactionId,
    transaction_type: transactionType || 'VOID',
    original_transaction: input.original_transaction || input,
    branch_id: branchId,
    reason: input.reason || input.notes || 'VOID_FROM_ORCHESTRATOR',
    created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
  }, accountingOptions);

  warnings.push(...collectWarnings(accountingReverse));

  const voidSnapshot = createTransactionSnapshot({
    snapshot_type: 'TRANSACTION',
    transaction_id: transactionId,
    transaction_type: `VOID_${transactionType || 'TRANSACTION'}`,
    branch_id: branchId,
    created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
    transaction_header: {
      transaction_id: transactionId,
      transaction_type: transactionType,
      branch_id: branchId,
      reason: input.reason || input.notes || 'VOID_FROM_ORCHESTRATOR',
      voided_at: new Date().toISOString(),
    },
    transaction_items: [],
    additional_payload: {
      original_transaction: input.original_transaction || input,
      business_reversal: businessReverse.reversal_package || businessReverse,
      journal_reversal: accountingReverse.journal_package || accountingReverse.reversal_package || null,
    },
    warnings,
    engine_versions: {
      erpOrchestrator: ORCHESTRATOR_VERSION,
    },
    meta: {
      source_module: 'erpOrchestrator',
      source_table: input.source_table || input.sourceTable || '',
      source_id: transactionId,
    },
  }, {
    lock: true,
    allowInvalid: true,
  });

  warnings.push(...voidSnapshot.warnings);

  const orchestratorSnapshot = createOrchestratorSnapshot({
    process_type: PROCESS_TYPES.VOID,
    transaction_id: transactionId,
    transaction_type: 'PROCESS_VOID_TRANSACTION',
    branch_id: branchId,
    created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
    package_summary: {
      original_transaction_type: transactionType,
      transaction_id: transactionId,
      business_reverse_ok: businessReverse.ok !== false,
      accounting_reverse_ok: accountingReverse.ok !== false,
    },
    package_payload: {
      business_reversal: businessReverse.reversal_package || businessReverse,
      accounting_reversal: accountingReverse.journal_package || accountingReverse.reversal_package || null,
      void_snapshot: voidSnapshot.snapshot || null,
    },
    warnings,
  }, options);

  warnings.push(...orchestratorSnapshot.warnings);

  const reversalPackage = {
    package_type: 'ORCHESTRATED_REVERSAL_PACKAGE',
    package_version: ORCHESTRATOR_VERSION,
    generated_at: new Date().toISOString(),
    transaction_id: transactionId,
    transaction_type: transactionType,
    branch_id: branchId,
    business_reversal: businessReverse.reversal_package || businessReverse,
    accounting_reversal: accountingReverse.journal_package || accountingReverse.reversal_package || null,
    void_snapshot: voidSnapshot.snapshot || null,
    orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
    snapshot_package: orchestratorSnapshot.snapshot || voidSnapshot.snapshot || null,
    status: businessReverse.ok === false || accountingReverse.ok === false
      ? PROCESS_STATUS.BLOCKED
      : PROCESS_STATUS.SUCCESS,
    warnings,
  };

  return {
    ok: reversalPackage.status === PROCESS_STATUS.SUCCESS,
    transaction_package: {
      reversal_package: reversalPackage,
      snapshot_package: reversalPackage.snapshot_package,
      warnings,
    },
    reversal_package: reversalPackage,
    snapshot_package: reversalPackage.snapshot_package,
    warnings,
  };
};

/* =========================================================================
   DASHBOARD HELPERS
   ========================================================================= */

const getSourceRows = (source = {}, keys = []) => {
  return keys.flatMap((key) => safeArray(source[key]));
};

const normalizePackageHeader = (row = {}, headerKeys = []) => {
  for (const key of headerKeys) {
    if (isObject(row[key])) return row[key];
  }

  const packageKeys = [
    'transaction_package',
    'package',
    'data',
    'sales_transaction_package',
    'purchase_transaction_package',
    'production_batch_package',
    'cash_transaction_package',
    'payment_package',
    'receivable_package',
    'payable_package',
  ];

  for (const packageKey of packageKeys) {
    const pkg = row[packageKey];
    if (!isObject(pkg)) continue;

    for (const headerKey of headerKeys) {
      if (isObject(pkg[headerKey])) return pkg[headerKey];
    }
  }

  return row;
};

const getRowDate = (row = {}, candidateKeys = []) => {
  for (const key of candidateKeys) {
    const value = normalizeDateString(row[key]);
    if (value) return value;
  }

  return '';
};

const inDateRange = (dateValue, dateFrom = '', dateTo = '') => {
  const date = normalizeDateString(dateValue);
  if (!date) return false;
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
};

const calculatePercent = (value, base) => {
  const valueNumber = safeNumber(value, 0);
  const baseNumber = safeNumber(base, 0);
  if (baseNumber === 0) return 0;
  return roundPercent((valueNumber / baseNumber) * 100);
};

const sortDesc = (rows = [], key = 'value') => {
  return [...safeArray(rows)].sort((a, b) => safeNumber(b[key], 0) - safeNumber(a[key], 0));
};

const limitRows = (rows = [], limit = 10) => {
  return safeArray(rows).slice(0, limit);
};

const normalizeStatus = (value, fallback = '') => {
  return normalizeCode(value || fallback);
};

/* =========================================================================
   INVENTORY DASHBOARD
   ========================================================================= */

export const getInventoryDashboard = (source = {}, options = {}) => {
  const ctx = buildContext(options);
  const branchId = normalizeBranchId(options.branchId || options.branch_id || ctx.branchId);
  const warnings = [];

  const inventoryItems = listLayerItems(source, {
    ...options,
    branchId,
  });

  const inventoryRows = safeArray(inventoryItems).map((item) => {
    const balance = getLayerBalance(source, {
      ...options,
      branchId,
      itemId: item.item_id || item.itemId || item.id,
      itemName: item.item_name || item.itemName || item.name,
      unit: item.unit,
    });

    warnings.push(...balance.warnings);

    return {
      item_id: item.item_id || item.itemId || item.id || '',
      item_name: item.item_name || item.itemName || item.name || '',
      unit: item.unit || '',
      branch_id: item.branch_id || branchId,
      qty_balance: roundQty(balance.balance?.qty || balance.qty || balance.qty_balance || 0),
      inventory_value: roundMoney(balance.balance?.value || balance.value || balance.inventory_value || 0),
      layer_count: balance.balance?.layer_count || safeArray(balance.layers).length || 0,
      raw: item,
    };
  });

  const totalInventoryValue = inventoryRows.reduce((sum, item) => sum + safeNumber(item.inventory_value, 0), 0);
  const totalQty = inventoryRows.reduce((sum, item) => sum + safeNumber(item.qty_balance, 0), 0);

  return {
    ok: true,
    inventory_dashboard: {
      generated_at: new Date().toISOString(),
      branch_id: branchId,
      total_inventory_value: roundMoney(totalInventoryValue),
      total_qty: roundQty(totalQty),
      item_count: inventoryRows.length,
      items: inventoryRows,
    },
    warnings,
  };
};

/* =========================================================================
   PROFIT DASHBOARD
   ========================================================================= */

export const getProfitDashboard = (source = {}, options = {}) => {
  const ctx = buildContext(options);
  const branchId = normalizeBranchId(options.branchId || options.branch_id || ctx.branchId);
  const warnings = [];

  const branchProfit = branchId && branchId !== 'CONSOLIDATED' && branchId !== 'ALL'
    ? calculateBranchProfit(source, {
        ...options,
        branchId,
      })
    : null;

  const consolidatedProfit = !branchProfit
    ? calculateConsolidatedProfit(source, {
        ...options,
        branchId: 'CONSOLIDATED',
      })
    : null;

  const byChannel = calculateProfitByChannel(source, options);
  const byProduct = calculateProfitByProduct(source, options);
  const byCustomer = calculateProfitByCustomer(source, options);

  warnings.push(
    ...collectWarnings(branchProfit, consolidatedProfit, byChannel, byProduct, byCustomer),
  );

  const profitPayload = {
    branch_profit: branchProfit?.profit_package || null,
    consolidated_profit: consolidatedProfit?.profit_package || null,
    by_channel: byChannel.by_channel || [],
    by_product: byProduct.by_product || [],
    by_customer: byCustomer.by_customer || [],
  };

  const profitSnapshot = createProfitSnapshot({
    branch_id: branchId,
    report_type: branchProfit ? 'BRANCH_PROFIT_DASHBOARD' : 'CONSOLIDATED_PROFIT_DASHBOARD',
    date_from: options.dateFrom || options.date_from || '',
    date_to: options.dateTo || options.date_to || '',
    profit_payload: profitPayload,
    created_by: options.createdBy || options.created_by || ctx.createdBy,
    warnings,
  }, {
    lock: true,
  });

  warnings.push(...profitSnapshot.warnings);

  return {
    ok: true,
    profit_dashboard: {
      generated_at: new Date().toISOString(),
      branch_id: branchId,
      report_type: branchProfit ? 'BRANCH' : 'CONSOLIDATED',
      ...profitPayload,
      profit_snapshot: profitSnapshot.snapshot || null,
    },
    warnings,
  };
};

/* =========================================================================
   BRANCH DASHBOARD
   ========================================================================= */

export const getBranchDashboard = (source = {}, options = {}) => {
  const ctx = buildContext(options);
  const branchId = normalizeBranchId(options.branchId || options.branch_id || ctx.branchId);
  const warnings = [];

  const branch = getBranchById(source, branchId, {
    includeInactive: true,
  });

  warnings.push(...branch.warnings);

  const masterSummary = getMasterSummary(source, {
    ...options,
    branchId,
  });

  const inventoryDashboard = getInventoryDashboard(source, {
    ...options,
    branchId,
  });

  const profitDashboard = getProfitDashboard(source, {
    ...options,
    branchId,
  });

  const trialBalance = createTrialBalance(source.general_ledger || source.generalLedger || [], {
    ...options,
    branchId,
  });

  warnings.push(
    ...masterSummary.warnings,
    ...inventoryDashboard.warnings,
    ...profitDashboard.warnings,
    ...trialBalance.warnings,
  );

  const dashboardSnapshot = createOrchestratorSnapshot({
    process_type: PROCESS_TYPES.DASHBOARD,
    transaction_id: generateId('BR-DASH'),
    transaction_type: 'BRANCH_DASHBOARD',
    branch_id: branchId,
    created_by: options.createdBy || options.created_by || ctx.createdBy,
    package_summary: {
      branch_id: branchId,
      inventory_value: inventoryDashboard.inventory_dashboard?.total_inventory_value || 0,
      net_profit: profitDashboard.profit_dashboard?.branch_profit?.net_profit || 0,
    },
    package_payload: {
      branch: branch.record,
      master_summary: masterSummary.summary,
      inventory_dashboard: inventoryDashboard.inventory_dashboard,
      profit_dashboard: profitDashboard.profit_dashboard,
      trial_balance: trialBalance.trial_balance,
    },
    warnings,
  }, {
    ...ctx,
    ...options,
  });

  warnings.push(...dashboardSnapshot.warnings);

  return {
    ok: true,
    branch_dashboard: {
      generated_at: new Date().toISOString(),
      branch_id: branchId,
      branch: branch.record,
      master_summary: masterSummary.summary,
      inventory_dashboard: inventoryDashboard.inventory_dashboard,
      profit_dashboard: profitDashboard.profit_dashboard,
      trial_balance: trialBalance.trial_balance,
      dashboard_snapshot: dashboardSnapshot.snapshot || null,
    },
    warnings,
  };
};

/* =========================================================================
   CONSOLIDATED DASHBOARD
   ========================================================================= */

export const getConsolidatedDashboard = (source = {}, options = {}) => {
  const ctx = buildContext(options);
  const warnings = [];

  const masterSummary = getMasterSummary(source, {
    ...options,
    branchId: 'ALL',
  });

  const inventoryDashboard = getInventoryDashboard(source, {
    ...options,
    branchId: 'ALL',
  });

  const profitDashboard = getProfitDashboard(source, {
    ...options,
    branchId: 'CONSOLIDATED',
  });

  const consolidatedProfit = calculateConsolidatedProfit(source, {
    ...options,
    branchId: 'CONSOLIDATED',
  });

  const trialBalance = createTrialBalance(source.general_ledger || source.generalLedger || [], {
    ...options,
    branchId: 'ALL',
  });

  warnings.push(
    ...masterSummary.warnings,
    ...inventoryDashboard.warnings,
    ...profitDashboard.warnings,
    ...consolidatedProfit.warnings,
    ...trialBalance.warnings,
  );

  const dashboardSnapshot = createOrchestratorSnapshot({
    process_type: PROCESS_TYPES.DASHBOARD,
    transaction_id: generateId('CON-DASH'),
    transaction_type: 'CONSOLIDATED_DASHBOARD',
    branch_id: 'CONSOLIDATED',
    created_by: options.createdBy || options.created_by || ctx.createdBy,
    package_summary: {
      owner_god_mode_scope: 'TANGERANG_CONTROL_CENTER',
      inventory_value: inventoryDashboard.inventory_dashboard?.total_inventory_value || 0,
      net_profit: consolidatedProfit.profit_package?.net_profit || 0,
      branch_count: masterSummary.summary?.branches || 0,
    },
    package_payload: {
      master_summary: masterSummary.summary,
      inventory_dashboard: inventoryDashboard.inventory_dashboard,
      profit_dashboard: profitDashboard.profit_dashboard,
      consolidated_profit: consolidatedProfit.profit_package,
      trial_balance: trialBalance.trial_balance,
    },
    warnings,
  }, {
    ...ctx,
    ...options,
  });

  warnings.push(...dashboardSnapshot.warnings);

  return {
    ok: true,
    consolidated_dashboard: {
      generated_at: new Date().toISOString(),
      scope: 'TANGERANG_CONTROL_CENTER',
      master_summary: masterSummary.summary,
      inventory_dashboard: inventoryDashboard.inventory_dashboard,
      profit_dashboard: profitDashboard.profit_dashboard,
      consolidated_profit: consolidatedProfit.profit_package,
      trial_balance: trialBalance.trial_balance,
      dashboard_snapshot: dashboardSnapshot.snapshot || null,
    },
    warnings,
  };
};

/* =========================================================================
   DASHBOARD SUMMARY
   ========================================================================= */

export const getDashboardSummary = (source = {}, options = {}) => {
  const ctx = buildContext(options);
  const branchId = normalizeBranchId(options.branchId || options.branch_id || ctx.branchId);
  const isConsolidated =
    options.consolidated === true ||
    branchId === 'CONSOLIDATED' ||
    branchId === 'ALL' ||
    branchId === DEFAULT_BRANCH_SCOPE;

  if (isConsolidated) {
    const consolidatedDashboard = getConsolidatedDashboard(source, {
      ...options,
      branchId: 'CONSOLIDATED',
    });

    return {
      ok: consolidatedDashboard.ok,
      dashboard_summary: {
        generated_at: new Date().toISOString(),
        mode: 'CONSOLIDATED',
        consolidated_dashboard: consolidatedDashboard.consolidated_dashboard,
      },
      warnings: consolidatedDashboard.warnings,
    };
  }

  const branchDashboard = getBranchDashboard(source, {
    ...options,
    branchId,
  });

  return {
    ok: branchDashboard.ok,
    dashboard_summary: {
      generated_at: new Date().toISOString(),
      mode: 'BRANCH',
      branch_id: branchId,
      branch_dashboard: branchDashboard.branch_dashboard,
    },
    warnings: branchDashboard.warnings,
  };
};

/* =========================================================================
   OWNER ANALYTICS READ ONLY HELPERS
   ========================================================================= */

const resolveOwnerAnalyticsPeriod = (input = {}) => {
  const today = normalizeDateString(input.today || input.todayStr || getTodayISO()) || getTodayISO();
  const period = normalizeCode(input.period || 'TODAY');

  const todayDate = new Date(`${today}T00:00:00`);
  const year = todayDate.getFullYear();
  const month = todayDate.getMonth();

  if (period === 'CUSTOM') {
    const startDate = normalizeDateString(input.start_date || input.startDate || input.date_from || input.dateFrom || today);
    const endDate = normalizeDateString(input.end_date || input.endDate || input.date_to || input.dateTo || today);

    return {
      period: 'CUSTOM',
      startDate,
      endDate,
      previousStartDate: '',
      previousEndDate: '',
    };
  }

  if (period === 'THIS_WEEK') {
    const day = todayDate.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;

    const start = new Date(todayDate);
    start.setDate(todayDate.getDate() + mondayOffset);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - 7);

    const prevEnd = new Date(end);
    prevEnd.setDate(end.getDate() - 7);

    return {
      period: 'THIS_WEEK',
      startDate: normalizeDateString(start),
      endDate: normalizeDateString(end),
      previousStartDate: normalizeDateString(prevStart),
      previousEndDate: normalizeDateString(prevEnd),
    };
  }

  if (period === 'THIS_MONTH') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const prevStart = new Date(year, month - 1, 1);
    const prevEnd = new Date(year, month, 0);

    return {
      period: 'THIS_MONTH',
      startDate: normalizeDateString(start),
      endDate: normalizeDateString(end),
      previousStartDate: normalizeDateString(prevStart),
      previousEndDate: normalizeDateString(prevEnd),
    };
  }

  if (period === 'THIS_YEAR') {
    return {
      period: 'THIS_YEAR',
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      previousStartDate: `${year - 1}-01-01`,
      previousEndDate: `${year - 1}-12-31`,
    };
  }

  const prevDate = new Date(todayDate);
  prevDate.setDate(todayDate.getDate() - 1);

  return {
    period: 'TODAY',
    startDate: today,
    endDate: today,
    previousStartDate: normalizeDateString(prevDate),
    previousEndDate: normalizeDateString(prevDate),
  };
};

const getMasterNameMaps = (source = {}) => {
  const branches = safeArray(getBranches(source, { includeInactive: true, includeDeleted: true }).records);
  const customers = safeArray(getCustomers(source, { includeInactive: true, includeDeleted: true }).records);
  const suppliers = safeArray(getSuppliers(source, { includeInactive: true, includeDeleted: true }).records);
  const products = safeArray(getProducts(source, { includeInactive: true, includeDeleted: true }).records);

  const branchNames = new Map();
  const customerNames = new Map();
  const customerTypes = new Map();
  const supplierNames = new Map();
  const productNames = new Map();

  branches.forEach((record = {}) => {
    const raw = record.raw || record;
    const id = String(raw.branch_id || raw.branchId || record.id || raw.id || '').trim();
    const code = String(raw.branch_code || raw.branchCode || raw.code || id).trim();
    const name = String(raw.branch_name || raw.branchName || raw.name || record.name || id).trim();

    if (id) branchNames.set(id, name);
    if (code) branchNames.set(code, name);
  });

  customers.forEach((record = {}) => {
    const raw = record.raw || record;
    const id = String(raw.customer_id || raw.customerId || record.id || raw.id || '').trim();
    const code = String(raw.customer_code || raw.customerCode || raw.code || id).trim();
    const name = String(raw.customer_name || raw.customerName || raw.name || record.name || id).trim();
    const type = normalizeCode(raw.customer_type || raw.customerType || raw.type || raw.category || '');

    if (id) {
      customerNames.set(id, name);
      customerTypes.set(id, type);
    }

    if (code) {
      customerNames.set(code, name);
      customerTypes.set(code, type);
    }
  });

  suppliers.forEach((record = {}) => {
    const raw = record.raw || record;
    const id = String(raw.supplier_id || raw.supplierId || record.id || raw.id || '').trim();
    const code = String(raw.supplier_code || raw.supplierCode || raw.code || id).trim();
    const name = String(raw.supplier_name || raw.supplierName || raw.name || record.name || id).trim();

    if (id) supplierNames.set(id, name);
    if (code) supplierNames.set(code, name);
  });

  products.forEach((record = {}) => {
    const raw = record.raw || record;
    const id = String(raw.product_id || raw.productId || record.id || raw.id || '').trim();
    const code = String(raw.product_code || raw.productCode || raw.sku || raw.code || id).trim();
    const name = String(raw.product_name || raw.productName || raw.name || record.name || id).trim();

    if (id) productNames.set(id, name);
    if (code) productNames.set(code, name);
  });

  return {
    branchNames,
    customerNames,
    customerTypes,
    supplierNames,
    productNames,
  };
};

const normalizeSalesRowForAnalytics = (row = {}, nameMaps = {}) => {
  const pkg = row.sales_transaction_package || row.salesTransactionPackage || row.sales_order_package || row.transaction_package || row.package || row;
  const header = normalizePackageHeader(pkg, ['sales_header', 'order_header', 'header']);
  const snapshot = pkg.sales_snapshot || pkg.snapshot_package || parseJson(header.sales_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.sales_snapshot || snapshot?.payload?.order_snapshot || snapshot?.payload || {};
  const snapshotHeader = snapshotPayload.sales_header || snapshotPayload.order_header || snapshotPayload.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const salesId = String(finalHeader.sales_id || finalHeader.order_id || finalHeader.id || row.sales_id || row.order_id || row.id || '').trim();
  const branchId = String(finalHeader.branch_id || finalHeader.branchId || '').trim();
  const customerId = String(finalHeader.customer_id || finalHeader.customerId || '').trim();
  const date = getRowDate(finalHeader, ['sales_date', 'order_date', 'date', 'created_at']);

  const salesItems = safeArray(
    pkg.sales_items ||
    pkg.order_items ||
    pkg.items ||
    snapshotPayload.sales_items ||
    snapshotPayload.order_items ||
    parseJson(finalHeader.sales_items_json, null) ||
    parseJson(finalHeader.order_items_json, null) ||
    parseJson(finalHeader.items_json, []),
  );

  const revenue = roundMoney(firstValue(
    finalHeader.total_revenue,
    finalHeader.total_amount,
    finalHeader.grand_total,
    finalHeader.omzet,
    salesItems.reduce((sum, item) => sum + safeNumber(item.subtotal || item.total || item.amount, 0), 0),
  ));

  const hppPackage = pkg.hpp_package || pkg.hppPackage || pkg.cogs_package || parseJson(finalHeader.hpp_package_json, null) || {};
  const profitPackage = pkg.profit_package || pkg.profitPackage || parseJson(finalHeader.profit_package_json, null) || {};

  const cogs = roundMoney(firstValue(
    finalHeader.total_hpp,
    finalHeader.total_cogs,
    finalHeader.cogs,
    hppPackage.total_hpp,
    hppPackage.total_cogs,
    hppPackage.cogs,
    0,
  ));

  const grossProfit = roundMoney(firstValue(
    finalHeader.gross_profit,
    profitPackage.gross_profit,
    revenue - cogs,
  ));

  const netProfit = roundMoney(firstValue(
    finalHeader.net_profit,
    finalHeader.actual_profit,
    profitPackage.net_profit,
    profitPackage.actual_profit,
    grossProfit,
  ));

  const channel = normalizeCode(finalHeader.sales_channel || finalHeader.channel || 'OFFLINE_RESTO');
  const status = normalizeStatus(finalHeader.order_status || finalHeader.sales_status || finalHeader.status || 'DRAFT');
  const paymentStatus = normalizeStatus(finalHeader.payment_status || finalHeader.paymentStatus || '');

  return {
    sales_id: salesId,
    sales_code: String(finalHeader.sales_code || finalHeader.order_code || salesId).trim(),
    date,
    branch_id: branchId,
    branch_name: nameMaps.branchNames?.get(branchId) || branchId,
    customer_id: customerId,
    customer_name: String(finalHeader.customer_name || nameMaps.customerNames?.get(customerId) || '').trim(),
    customer_type: normalizeCode(finalHeader.customer_type || nameMaps.customerTypes?.get(customerId) || ''),
    sales_channel: channel,
    status,
    payment_status: paymentStatus,
    revenue,
    cogs,
    gross_profit: grossProfit,
    net_profit: netProfit,
    profit_margin: calculatePercent(netProfit, revenue),
    amount_paid: roundMoney(finalHeader.amount_paid || finalHeader.paid_amount || 0),
    outstanding_balance: roundMoney(finalHeader.outstanding_balance || finalHeader.remaining_amount || finalHeader.piutang || 0),
    due_date: normalizeDateString(finalHeader.due_date || finalHeader.dueDate || ''),
    items: salesItems.map((item, index) => {
      const productId = String(item.product_id || item.productId || item.item_id || '').trim();
      const qty = roundQty(item.qty || item.quantity || 0);
      const subtotal = roundMoney(item.subtotal || item.total || item.amount || safeNumber(item.selling_price || item.price, 0) * qty);
      const itemCogs = roundMoney(item.total_hpp || item.cogs || item.hpp || item.unit_hpp * qty || 0);
      const itemProfit = roundMoney(firstValue(item.gross_profit, item.profit, subtotal - itemCogs));

      return {
        line_id: String(item.line_id || item.lineId || index).trim(),
        product_id: productId,
        product_name: String(item.product_name || item.productName || item.name || nameMaps.productNames?.get(productId) || productId).trim(),
        qty,
        revenue: subtotal,
        cogs: itemCogs,
        gross_profit: itemProfit,
        profit_margin: calculatePercent(itemProfit, subtotal),
      };
    }),
    raw: row,
  };
};

const normalizePurchaseRowForAnalytics = (row = {}, nameMaps = {}) => {
  const pkg = row.purchase_transaction_package || row.purchaseTransactionPackage || row.purchase_package || row.transaction_package || row.package || row;
  const header = normalizePackageHeader(pkg, ['purchase_header', 'header']);
  const snapshot = pkg.purchase_snapshot || pkg.snapshot_package || parseJson(header.purchase_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.purchase_snapshot || snapshot?.payload || {};
  const snapshotHeader = snapshotPayload.purchase_header || snapshotPayload.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const purchaseId = String(finalHeader.purchase_id || finalHeader.order_id || finalHeader.id || row.purchase_id || row.id || '').trim();
  const supplierId = String(finalHeader.supplier_id || finalHeader.supplierId || '').trim();
  const branchId = String(finalHeader.branch_id || finalHeader.branchId || '').trim();
  const date = getRowDate(finalHeader, ['purchase_date', 'order_date', 'date', 'created_at']);
  const total = roundMoney(finalHeader.total_invoice || finalHeader.total_amount || finalHeader.grand_total || 0);
  const amountPaid = roundMoney(finalHeader.amount_paid || finalHeader.paid_amount || 0);
  const outstanding = roundMoney(finalHeader.outstanding_balance || finalHeader.remaining_amount || finalHeader.amount_payable || finalHeader.hutang || Math.max(total - amountPaid, 0));

  return {
    purchase_id: purchaseId,
    purchase_code: String(finalHeader.purchase_code || finalHeader.invoice_number || purchaseId).trim(),
    date,
    branch_id: branchId,
    supplier_id: supplierId,
    supplier_name: String(finalHeader.supplier_name || nameMaps.supplierNames?.get(supplierId) || supplierId).trim(),
    status: normalizeStatus(finalHeader.status || finalHeader.purchase_status || ''),
    payment_status: normalizeStatus(finalHeader.payment_status || finalHeader.paymentStatus || ''),
    total_invoice: total,
    amount_paid: amountPaid,
    outstanding_balance: outstanding,
    due_date: normalizeDateString(finalHeader.due_date || finalHeader.dueDate || ''),
    raw: row,
  };
};

const normalizeCashRowForAnalytics = (row = {}) => {
  const pkg = row.cash_transaction_package || row.cashTransactionPackage || row.transfer_transaction_package || row.transaction_package || row.package || row;
  const header = normalizePackageHeader(pkg, ['cash_header', 'transfer_header', 'payment_header', 'transaction_header', 'header']);

  const transactionId = String(header.transaction_id || header.payment_id || header.transfer_id || header.id || row.id || '').trim();
  const branchId = String(header.branch_id || header.branchId || '').trim();
  const type = normalizeCode(header.transaction_type || header.type || header.payment_type || header.category || '');
  const sourceModule = normalizeCode(header.source_module || header.sourceModule || header.category || header.payment_type || '');
  const status = normalizeStatus(header.status || header.transaction_status || header.payment_status || 'POSTED');

  return {
    transaction_id: transactionId,
    date: getRowDate(header, ['transaction_date', 'payment_date', 'transfer_date', 'date', 'created_at']),
    branch_id: branchId,
    account_id: String(header.account_id || header.cash_account_id || header.from_account_id || '').trim(),
    target_account_id: String(header.target_account_id || header.to_account_id || '').trim(),
    transaction_type: type,
    source_module: sourceModule,
    amount: roundMoney(header.amount || header.nominal || header.payment_amount || 0),
    status,
    raw: row,
  };
};

const normalizeReceivableRowForAnalytics = (row = {}, nameMaps = {}, today = getTodayISO()) => {
  const pkg = row.receivable_package || row.account_receivable_package || row.piutang_package || row;
  const header = normalizePackageHeader(pkg, ['receivable_header', 'piutang_header', 'header']);

  const salesId = String(header.sales_id || header.order_id || '').trim();
  const receivableId = String(header.receivable_id || header.piutang_id || header.id || (salesId ? `AR-${salesId}` : '') || row.id || '').trim();
  const customerId = String(header.customer_id || header.customerId || '').trim();
  const branchId = String(header.branch_id || header.branchId || '').trim();

  const totalInvoice = roundMoney(header.total_invoice || header.total_amount || header.invoice_amount || 0);
  const amountPaid = roundMoney(header.amount_paid || header.paid_amount || 0);
  const outstanding = roundMoney(header.outstanding_balance || header.remaining_amount || header.amount_receivable || header.piutang || Math.max(totalInvoice - amountPaid, 0));
  const dueDate = normalizeDateString(header.due_date || header.dueDate || '');
  const agingDays = safeNumber(header.aging_days || header.agingDays || (dueDate ? Math.max(daysBetween(dueDate, today), 0) : 0), 0);

  let status = normalizeStatus(header.status || header.receivable_status || header.piutang_status || '');
  if (outstanding <= 0) status = 'PAID';
  else if (dueDate && dueDate < today) status = 'OVERDUE';
  else if (amountPaid > 0) status = 'PARTIAL';
  else status = status || 'OPEN';

  return {
    receivable_id: receivableId,
    sales_id: salesId,
    customer_id: customerId,
    customer_name: String(header.customer_name || nameMaps.customerNames?.get(customerId) || customerId).trim(),
    customer_type: normalizeCode(header.customer_type || nameMaps.customerTypes?.get(customerId) || ''),
    branch_id: branchId,
    transaction_date: getRowDate(header, ['transaction_date', 'sales_date', 'invoice_date', 'date', 'created_at']),
    due_date: dueDate,
    total_invoice: totalInvoice,
    amount_paid: amountPaid,
    outstanding_balance: outstanding,
    aging_days: agingDays,
    status,
    raw: row,
  };
};

const normalizePayableRowForAnalytics = (row = {}, nameMaps = {}, today = getTodayISO()) => {
  const pkg = row.payable_package || row.account_payable_package || row.hutang_package || row;
  const header = normalizePackageHeader(pkg, ['payable_header', 'hutang_header', 'header']);

  const purchaseId = String(header.purchase_id || header.order_id || '').trim();
  const payableId = String(header.payable_id || header.hutang_id || header.id || (purchaseId ? `AP-${purchaseId}` : '') || row.id || '').trim();
  const supplierId = String(header.supplier_id || header.supplierId || '').trim();
  const branchId = String(header.branch_id || header.branchId || '').trim();

  const totalInvoice = roundMoney(header.total_invoice || header.total_amount || header.invoice_amount || 0);
  const amountPaid = roundMoney(header.amount_paid || header.paid_amount || 0);
  const outstanding = roundMoney(header.outstanding_balance || header.remaining_amount || header.amount_payable || header.hutang || Math.max(totalInvoice - amountPaid, 0));
  const dueDate = normalizeDateString(header.due_date || header.dueDate || '');
  const agingDays = safeNumber(header.aging_days || header.agingDays || (dueDate ? Math.max(daysBetween(dueDate, today), 0) : 0), 0);

  let status = normalizeStatus(header.status || header.payable_status || header.hutang_status || '');
  if (outstanding <= 0) status = 'PAID';
  else if (dueDate && dueDate < today) status = 'OVERDUE';
  else if (amountPaid > 0) status = 'PARTIAL';
  else status = status || 'OPEN';

  return {
    payable_id: payableId,
    purchase_id: purchaseId,
    supplier_id: supplierId,
    supplier_name: String(header.supplier_name || nameMaps.supplierNames?.get(supplierId) || supplierId).trim(),
    branch_id: branchId,
    transaction_date: getRowDate(header, ['transaction_date', 'purchase_date', 'invoice_date', 'date', 'created_at']),
    due_date: dueDate,
    total_invoice: totalInvoice,
    amount_paid: amountPaid,
    outstanding_balance: outstanding,
    aging_days: agingDays,
    status,
    raw: row,
  };
};

const normalizeAccountRowForAnalytics = (row = {}) => {
  const accountId = String(row.account_id || row.accountId || row.cash_account_id || row.bank_account_id || row.id || '').trim();

  return {
    account_id: accountId,
    account_code: String(row.account_code || row.accountCode || row.code || accountId).trim(),
    account_name: String(row.account_name || row.accountName || row.name || accountId).trim(),
    account_type: normalizeCode(row.account_type || row.accountType || row.type || 'CASH'),
    branch_id: String(row.branch_id || row.branchId || '').trim(),
    current_balance: roundMoney(row.current_balance || row.balance || row.saldo || row.saldo_sekarang || 0),
    status: normalizeStatus(row.status || row.is_active || 'ACTIVE'),
    raw: row,
  };
};

const normalizeInventoryRowForOwnerAnalytics = (row = {}, nameMaps = {}) => {
  const itemId = String(row.item_id || row.itemId || row.product_id || row.raw_material_id || row.id || '').trim();
  const itemName = String(
    row.item_name ||
    row.itemName ||
    row.product_name ||
    row.raw_material_name ||
    row.name ||
    nameMaps.productNames?.get(itemId) ||
    itemId,
  ).trim();

  const currentQty = roundQty(
    row.current_qty ||
    row.currentQty ||
    row.qty_balance ||
    row.qty_remaining ||
    row.remaining_qty ||
    row.balance_qty ||
    row.qty ||
    0,
  );

  const minimumQty = roundQty(
    row.minimum_qty ||
    row.minimumQty ||
    row.min_stock ||
    row.safety_stock ||
    row.reorder_point ||
    0,
  );

  const lastMovementDate = normalizeDateString(
    row.last_movement_date ||
    row.lastMovementDate ||
    row.updated_at ||
    row.created_at ||
    row.date ||
    '',
  );

  return {
    item_id: itemId,
    item_name: itemName,
    item_type: normalizeCode(row.item_type || row.itemType || row.category || row.type || ''),
    branch_id: String(row.branch_id || row.branchId || '').trim(),
    warehouse_id: String(row.warehouse_id || row.warehouseId || '').trim(),
    current_qty: currentQty,
    minimum_qty: minimumQty,
    last_movement_date: lastMovementDate,
    status: normalizeStatus(row.status || row.inventory_status || ''),
    raw: row,
  };
};

const extractOwnerAnalyticsSourceRows = (source = {}) => {
  return {
    salesRows: getSourceRows(source, [
      'sales_transactions',
      'salesTransactions',
      'sales_orders',
      'salesOrders',
      'orders',
      'sales_packages',
      'salesPackages',
    ]),
    purchaseRows: getSourceRows(source, [
      'purchases',
      'purchase_transactions',
      'purchaseTransactions',
      'purchase_packages',
      'purchasePackages',
    ]),
    cashRows: getSourceRows(source, [
      'cash_bank_transactions',
      'cashBankTransactions',
      'kas_bank_transactions',
      'kasBankTransactions',
      'cashflow_transactions',
      'cashflowTransactions',
      'money_transactions',
      'moneyTransactions',
      'payments',
    ]),
    receivableRows: getSourceRows(source, [
      'receivables',
      'account_receivables',
      'accountReceivables',
      'piutang',
      'piutang_customers',
      'receivable_records',
      'receivableRecords',
    ]),
    payableRows: getSourceRows(source, [
      'payables',
      'account_payables',
      'accountPayables',
      'hutang_supplier',
      'hutangSupplier',
      'payable_records',
      'payableRecords',
    ]),
    accountRows: getSourceRows(source, [
      'master_cash_bank_accounts',
      'masterCashBankAccounts',
      'cash_bank_accounts',
      'cashBankAccounts',
      'master_accounts',
      'masterAccounts',
      'bank_accounts',
      'bankAccounts',
      'cash_accounts',
      'cashAccounts',
    ]),
    inventoryRows: getSourceRows(source, [
      'inventory_cost_layers',
      'inventoryCostLayers',
      'cost_layers',
      'costLayers',
      'stock_movements',
      'stockMovements',
      'inventory',
      'inventory_items',
      'inventoryItems',
    ]),
  };
};

const buildSalesDerivedReceivables = (salesRows = [], today = getTodayISO()) => {
  return safeArray(salesRows)
    .filter((sale) => ['UNPAID', 'PARTIAL'].includes(sale.payment_status))
    .filter((sale) => safeNumber(sale.outstanding_balance, 0) > 0)
    .map((sale) => {
      const agingDays = sale.due_date ? Math.max(daysBetween(sale.due_date, today), 0) : 0;
      let status = sale.outstanding_balance <= 0 ? 'PAID' : sale.payment_status === 'PARTIAL' ? 'PARTIAL' : 'OPEN';
      if (sale.due_date && sale.due_date < today && sale.outstanding_balance > 0) status = 'OVERDUE';

      return {
        receivable_id: `AR-${sale.sales_id}`,
        sales_id: sale.sales_id,
        customer_id: sale.customer_id,
        customer_name: sale.customer_name,
        customer_type: sale.customer_type,
        branch_id: sale.branch_id,
        transaction_date: sale.date,
        due_date: sale.due_date,
        total_invoice: sale.revenue,
        amount_paid: sale.amount_paid,
        outstanding_balance: sale.outstanding_balance,
        aging_days: agingDays,
        status,
        raw: sale.raw,
      };
    });
};

const buildPurchaseDerivedPayables = (purchaseRows = [], today = getTodayISO()) => {
  return safeArray(purchaseRows)
    .filter((purchase) => ['UNPAID', 'PARTIAL'].includes(purchase.payment_status))
    .filter((purchase) => safeNumber(purchase.outstanding_balance, 0) > 0)
    .map((purchase) => {
      const agingDays = purchase.due_date ? Math.max(daysBetween(purchase.due_date, today), 0) : 0;
      let status = purchase.outstanding_balance <= 0 ? 'PAID' : purchase.payment_status === 'PARTIAL' ? 'PARTIAL' : 'OPEN';
      if (purchase.due_date && purchase.due_date < today && purchase.outstanding_balance > 0) status = 'OVERDUE';

      return {
        payable_id: `AP-${purchase.purchase_id}`,
        purchase_id: purchase.purchase_id,
        supplier_id: purchase.supplier_id,
        supplier_name: purchase.supplier_name,
        branch_id: purchase.branch_id,
        transaction_date: purchase.date,
        due_date: purchase.due_date,
        total_invoice: purchase.total_invoice,
        amount_paid: purchase.amount_paid,
        outstanding_balance: purchase.outstanding_balance,
        aging_days: agingDays,
        status,
        raw: purchase.raw,
      };
    });
};

const upsertMetricMap = (map, key, seed = {}) => {
  if (!map.has(key)) {
    map.set(key, {
      ...seed,
      totalRevenue: 0,
      totalCOGS: 0,
      grossProfit: 0,
      netProfit: 0,
      transactionCount: 0,
      qtySold: 0,
    });
  }

  return map.get(key);
};

const createTrend = (metric, currentValue, previousValue) => {
  const current = roundMoney(currentValue);
  const previous = roundMoney(previousValue);
  const changeValue = roundMoney(current - previous);
  const changePercent = previous === 0 ? 0 : roundPercent((changeValue / Math.abs(previous)) * 100);

  return {
    metric,
    currentValue: current,
    previousValue: previous,
    changeValue,
    changePercent,
    direction: changeValue > 0 ? 'UP' : changeValue < 0 ? 'DOWN' : 'FLAT',
  };
};

const buildWarningCards = ({
  summary,
  cashflowAnalytics,
  receivableAnalytics,
  payableAnalytics,
  inventoryAnalytics,
}) => {
  const warningCards = [];

  if (safeNumber(cashflowAnalytics.cashPosition, 0) < 0) {
    warningCards.push({
      id: 'negativeCash',
      type: 'negativeCash',
      title: 'Cash negatif',
      message: 'Cash position berada di bawah nol.',
      severity: 'CRITICAL',
      amount: roundMoney(cashflowAnalytics.cashPosition),
      count: 1,
      action_hint: 'Cek Kas Bank, piutang tertagih, dan pengeluaran besar.',
    });
  }

  if (safeNumber(receivableAnalytics.overdueReceivable, 0) > 0) {
    warningCards.push({
      id: 'overdueReceivable',
      type: 'overdueReceivable',
      title: 'Piutang overdue tinggi',
      message: 'Ada piutang customer yang sudah melewati jatuh tempo.',
      severity: 'WARNING',
      amount: roundMoney(receivableAnalytics.overdueReceivable),
      count: safeNumber(receivableAnalytics.overdueCustomerCount, 0),
      action_hint: 'Prioritaskan penagihan top debtor dan invoice aging tertua.',
    });
  }

  if (safeNumber(payableAnalytics.overduePayable, 0) > 0) {
    warningCards.push({
      id: 'overduePayable',
      type: 'overduePayable',
      title: 'Hutang jatuh tempo',
      message: 'Ada hutang supplier yang melewati jatuh tempo.',
      severity: 'WARNING',
      amount: roundMoney(payableAnalytics.overduePayable),
      count: safeNumber(payableAnalytics.overdueSupplierCount, 0),
      action_hint: 'Prioritaskan pembayaran supplier penting dan negosiasi tempo.',
    });
  }

  if (safeArray(inventoryAnalytics.criticalStock).length > 0) {
    warningCards.push({
      id: 'criticalStock',
      type: 'criticalStock',
      title: 'Stok kritis',
      message: 'Ada item stok yang berada di bawah minimum.',
      severity: 'WARNING',
      amount: 0,
      count: inventoryAnalytics.criticalStock.length,
      action_hint: 'Cek purchasing, produksi, dan transfer stok.',
    });
  }

  if (safeNumber(summary.netProfit, 0) < 0) {
    warningCards.push({
      id: 'negativeProfit',
      type: 'negativeProfit',
      title: 'Profit negatif',
      message: 'Net profit periode ini negatif.',
      severity: 'CRITICAL',
      amount: roundMoney(summary.netProfit),
      count: 1,
      action_hint: 'Evaluasi HPP, diskon, biaya operasional, dan channel rugi.',
    });
  }

  if (warningCards.length === 0) {
    warningCards.push({
      id: 'businessHealthOk',
      type: 'businessHealthOk',
      title: 'Kondisi bisnis aman',
      message: 'Tidak ada warning kritis pada periode ini.',
      severity: 'INFO',
      amount: 0,
      count: 0,
      action_hint: 'Lanjutkan monitoring rutin.',
    });
  }

  return warningCards;
};

/* =========================================================================
   OWNER ANALYTICS API - READ ONLY
   ========================================================================= */

export const getOwnerAnalytics = (input = {}, context = {}) => {
  const ctx = buildContext(context);
  const source = input.source || input.dbData || input.db_data || ctx.source || ctx.dbData || {};
  const period = resolveOwnerAnalyticsPeriod(input);
  const today = normalizeDateString(input.today || input.todayStr || getTodayISO()) || getTodayISO();

  const nameMaps = getMasterNameMaps(source);
  const sourceRows = extractOwnerAnalyticsSourceRows(source);

  const salesAll = sourceRows.salesRows
    .filter((row) => !isDeletedRow(row))
    .map((row) => normalizeSalesRowForAnalytics(row, nameMaps));

  const purchasesAll = sourceRows.purchaseRows
    .filter((row) => !isDeletedRow(row))
    .map((row) => normalizePurchaseRowForAnalytics(row, nameMaps));

  const cashAll = sourceRows.cashRows
    .filter((row) => !isDeletedRow(row))
    .map(normalizeCashRowForAnalytics);

  const directReceivables = sourceRows.receivableRows
    .filter((row) => !isDeletedRow(row))
    .map((row) => normalizeReceivableRowForAnalytics(row, nameMaps, today));

  const directPayables = sourceRows.payableRows
    .filter((row) => !isDeletedRow(row))
    .map((row) => normalizePayableRowForAnalytics(row, nameMaps, today));

  const receivablesAll = [
    ...buildSalesDerivedReceivables(salesAll, today),
    ...directReceivables,
  ];

  const payablesAll = [
    ...buildPurchaseDerivedPayables(purchasesAll, today),
    ...directPayables,
  ];

  const accountRows = sourceRows.accountRows
    .filter((row) => !isDeletedRow(row))
    .map(normalizeAccountRowForAnalytics);

  const inventoryRows = sourceRows.inventoryRows
    .filter((row) => !isDeletedRow(row))
    .map((row) => normalizeInventoryRowForOwnerAnalytics(row, nameMaps));

  const isCompletedSales = (sale) => {
    return ['COMPLETED', 'POSTED', 'DONE', 'PAID'].includes(sale.status);
  };

  const salesInPeriod = salesAll.filter((sale) => {
    return isCompletedSales(sale) && inDateRange(sale.date, period.startDate, period.endDate);
  });

  const previousSalesInPeriod = salesAll.filter((sale) => {
    return isCompletedSales(sale) && period.previousStartDate && period.previousEndDate && inDateRange(sale.date, period.previousStartDate, period.previousEndDate);
  });

  const cashInPeriod = cashAll.filter((cash) => {
    return ['POSTED', 'PAID', 'FINAL', 'LOCKED'].includes(cash.status) && inDateRange(cash.date, period.startDate, period.endDate);
  });

  const previousCashInPeriod = cashAll.filter((cash) => {
    return ['POSTED', 'PAID', 'FINAL', 'LOCKED'].includes(cash.status) && period.previousStartDate && period.previousEndDate && inDateRange(cash.date, period.previousStartDate, period.previousEndDate);
  });

  const summary = salesInPeriod.reduce((acc, sale) => {
    acc.totalRevenue += safeNumber(sale.revenue, 0);
    acc.totalCOGS += safeNumber(sale.cogs, 0);
    acc.grossProfit += safeNumber(sale.gross_profit, 0);
    acc.netProfit += safeNumber(sale.net_profit, 0);
    return acc;
  }, {
    totalRevenue: 0,
    totalCOGS: 0,
    grossProfit: 0,
    netProfit: 0,
    profitMargin: 0,
    cashIn: 0,
    cashOut: 0,
    netCashflow: 0,
  });

  cashInPeriod.forEach((cash) => {
    const type = normalizeCode(cash.transaction_type);
    const sourceModule = normalizeCode(cash.source_module);
    const amount = safeNumber(cash.amount, 0);

    if (['TRANSFER'].includes(type) || sourceModule === 'TRANSFER') return;

    if (['MONEY_IN', 'IN', 'INFLOW', 'CASH_IN', 'RECEIVABLE', 'OWNER_DEPOSIT'].includes(type) || ['SALES', 'OWNER_DEPOSIT', 'PIUTANG_CUSTOMER', 'RECEIVABLE'].includes(sourceModule)) {
      summary.cashIn += amount;
    } else if (['MONEY_OUT', 'OUT', 'OUTFLOW', 'CASH_OUT', 'PAYABLE', 'OWNER_WITHDRAW'].includes(type) || ['PURCHASE', 'EXPENSE', 'OWNER_WITHDRAW', 'HUTANG_SUPPLIER', 'PAYABLE'].includes(sourceModule)) {
      summary.cashOut += amount;
    }
  });

  summary.totalRevenue = roundMoney(summary.totalRevenue);
  summary.totalCOGS = roundMoney(summary.totalCOGS);
  summary.grossProfit = roundMoney(summary.grossProfit);
  summary.netProfit = roundMoney(summary.netProfit);
  summary.profitMargin = calculatePercent(summary.netProfit, summary.totalRevenue);
  summary.cashIn = roundMoney(summary.cashIn);
  summary.cashOut = roundMoney(summary.cashOut);
  summary.netCashflow = roundMoney(summary.cashIn - summary.cashOut);

  const previousSummary = previousSalesInPeriod.reduce((acc, sale) => {
    acc.totalRevenue += safeNumber(sale.revenue, 0);
    acc.netProfit += safeNumber(sale.net_profit, 0);
    return acc;
  }, {
    totalRevenue: 0,
    netProfit: 0,
    netCashflow: 0,
    transactionCount: previousSalesInPeriod.length,
  });

  previousCashInPeriod.forEach((cash) => {
    const type = normalizeCode(cash.transaction_type);
    const sourceModule = normalizeCode(cash.source_module);
    const amount = safeNumber(cash.amount, 0);

    if (['TRANSFER'].includes(type) || sourceModule === 'TRANSFER') return;

    if (['MONEY_IN', 'IN', 'INFLOW', 'CASH_IN', 'RECEIVABLE', 'OWNER_DEPOSIT'].includes(type) || ['SALES', 'OWNER_DEPOSIT', 'PIUTANG_CUSTOMER', 'RECEIVABLE'].includes(sourceModule)) {
      previousSummary.netCashflow += amount;
    } else if (['MONEY_OUT', 'OUT', 'OUTFLOW', 'CASH_OUT', 'PAYABLE', 'OWNER_WITHDRAW'].includes(type) || ['PURCHASE', 'EXPENSE', 'OWNER_WITHDRAW', 'HUTANG_SUPPLIER', 'PAYABLE'].includes(sourceModule)) {
      previousSummary.netCashflow -= amount;
    }
  });

  const branchMap = new Map();
  const productMap = new Map();
  const customerMap = new Map();
  const channelMap = new Map();

  salesInPeriod.forEach((sale) => {
    const branchKey = sale.branch_id || 'UNKNOWN_BRANCH';
    const branchMetric = upsertMetricMap(branchMap, branchKey, {
      branch_id: branchKey,
      branch_name: sale.branch_name || nameMaps.branchNames.get(branchKey) || branchKey,
    });

    branchMetric.totalRevenue += sale.revenue;
    branchMetric.totalCOGS += sale.cogs;
    branchMetric.grossProfit += sale.gross_profit;
    branchMetric.netProfit += sale.net_profit;
    branchMetric.transactionCount += 1;

    const customerKey = sale.customer_id || sale.customer_name || 'UNKNOWN_CUSTOMER';
    const customerMetric = upsertMetricMap(customerMap, customerKey, {
      customer_id: sale.customer_id,
      customer_name: sale.customer_name || customerKey,
      customer_type: sale.customer_type,
      outstandingReceivable: 0,
    });

    customerMetric.totalRevenue += sale.revenue;
    customerMetric.totalCOGS += sale.cogs;
    customerMetric.grossProfit += sale.gross_profit;
    customerMetric.netProfit += sale.net_profit;
    customerMetric.transactionCount += 1;

    const channelKey = normalizeCode(sale.sales_channel || 'OFFLINE_RESTO');
    const channelMetric = upsertMetricMap(channelMap, channelKey, {
      channel: channelKey,
    });

    channelMetric.totalRevenue += sale.revenue;
    channelMetric.totalCOGS += sale.cogs;
    channelMetric.grossProfit += sale.gross_profit;
    channelMetric.netProfit += sale.net_profit;
    channelMetric.transactionCount += 1;

    safeArray(sale.items).forEach((item) => {
      const productKey = item.product_id || item.product_name || 'UNKNOWN_PRODUCT';
      const productMetric = upsertMetricMap(productMap, productKey, {
        product_id: item.product_id,
        product_name: item.product_name || productKey,
      });

      productMetric.qtySold += safeNumber(item.qty, 0);
      productMetric.totalRevenue += safeNumber(item.revenue, 0);
      productMetric.totalCOGS += safeNumber(item.cogs, 0);
      productMetric.grossProfit += safeNumber(item.gross_profit, 0);
      productMetric.netProfit += safeNumber(item.gross_profit, 0);
      productMetric.transactionCount += 1;
    });
  });

  receivablesAll.forEach((receivable) => {
    const customerKey = receivable.customer_id || receivable.customer_name || 'UNKNOWN_CUSTOMER';
    const customerMetric = upsertMetricMap(customerMap, customerKey, {
      customer_id: receivable.customer_id,
      customer_name: receivable.customer_name || customerKey,
      customer_type: receivable.customer_type,
      outstandingReceivable: 0,
    });

    customerMetric.outstandingReceivable += safeNumber(receivable.outstanding_balance, 0);
  });

  const branchRows = Array.from(branchMap.values()).map((row) => ({
    ...row,
    totalRevenue: roundMoney(row.totalRevenue),
    totalCOGS: roundMoney(row.totalCOGS),
    grossProfit: roundMoney(row.grossProfit),
    netProfit: roundMoney(row.netProfit),
    profitMargin: calculatePercent(row.netProfit, row.totalRevenue),
  }));

  const productRows = Array.from(productMap.values()).map((row) => ({
    ...row,
    qtySold: roundQty(row.qtySold),
    totalRevenue: roundMoney(row.totalRevenue),
    totalCOGS: roundMoney(row.totalCOGS),
    grossProfit: roundMoney(row.grossProfit),
    netProfit: roundMoney(row.netProfit),
    profitMargin: calculatePercent(row.grossProfit, row.totalRevenue),
  }));

  const customerRows = Array.from(customerMap.values()).map((row) => ({
    ...row,
    totalRevenue: roundMoney(row.totalRevenue),
    totalCOGS: roundMoney(row.totalCOGS),
    grossProfit: roundMoney(row.grossProfit),
    totalProfit: roundMoney(row.netProfit),
    netProfit: roundMoney(row.netProfit),
    profitMargin: calculatePercent(row.netProfit, row.totalRevenue),
    outstandingReceivable: roundMoney(row.outstandingReceivable),
  }));

  const channelRows = Array.from(channelMap.values()).map((row) => ({
    ...row,
    totalRevenue: roundMoney(row.totalRevenue),
    totalCOGS: roundMoney(row.totalCOGS),
    grossProfit: roundMoney(row.grossProfit),
    netProfit: roundMoney(row.netProfit),
    profitMargin: calculatePercent(row.netProfit, row.totalRevenue),
  }));

  const requiredChannels = [
    'OFFLINE_RESTO',
    'GOFOOD',
    'GRABFOOD',
    'SHOPEEFOOD',
    'TIKTOK',
    'FRANCHISE',
  ];

  const channelAnalytics = requiredChannels.reduce((acc, channel) => {
    const row = channelRows.find((item) => normalizeCode(item.channel) === channel) || {
      channel,
      totalRevenue: 0,
      totalCOGS: 0,
      grossProfit: 0,
      netProfit: 0,
      profitMargin: 0,
      transactionCount: 0,
    };

    const key = channel === 'OFFLINE_RESTO'
      ? 'Offline'
      : channel === 'GOFOOD'
        ? 'GoFood'
        : channel === 'GRABFOOD'
          ? 'GrabFood'
          : channel === 'SHOPEEFOOD'
            ? 'ShopeeFood'
            : channel === 'TIKTOK'
              ? 'TikTok'
              : 'Franchise';

    acc[key] = row;
    return acc;
  }, {});

  const activeReceivables = receivablesAll.filter((row) => row.status !== 'VOID');
  const activePayables = payablesAll.filter((row) => row.status !== 'VOID');

  const receivableAging = buildEmptyAgingSummary();
  const payableAging = buildEmptyAgingSummary();

  activeReceivables.forEach((row) => {
    if (row.status !== 'PAID') {
      receivableAging[getAgingBucketKey(row.aging_days)] += safeNumber(row.outstanding_balance, 0);
    }
  });

  activePayables.forEach((row) => {
    if (row.status !== 'PAID') {
      payableAging[getAgingBucketKey(row.aging_days)] += safeNumber(row.outstanding_balance, 0);
    }
  });

  const receivableAnalytics = {
    totalReceivable: roundMoney(activeReceivables.filter((row) => row.status !== 'PAID').reduce((sum, row) => sum + safeNumber(row.outstanding_balance, 0), 0)),
    overdueReceivable: roundMoney(activeReceivables.filter((row) => row.status === 'OVERDUE').reduce((sum, row) => sum + safeNumber(row.outstanding_balance, 0), 0)),
    overdueCustomerCount: new Set(activeReceivables.filter((row) => row.status === 'OVERDUE').map((row) => row.customer_id || row.customer_name)).size,
    collectionRate: calculatePercent(
      activeReceivables.reduce((sum, row) => sum + safeNumber(row.amount_paid, 0), 0),
      activeReceivables.reduce((sum, row) => sum + safeNumber(row.total_invoice, 0), 0),
    ),
    agingSummary: Object.fromEntries(Object.entries(receivableAging).map(([key, value]) => [key, roundMoney(value)])),
    topDebtors: limitRows(sortDesc(activeReceivables.filter((row) => row.status !== 'PAID'), 'outstanding_balance'), 10),
  };

  const payableAnalytics = {
    totalPayable: roundMoney(activePayables.filter((row) => row.status !== 'PAID').reduce((sum, row) => sum + safeNumber(row.outstanding_balance, 0), 0)),
    overduePayable: roundMoney(activePayables.filter((row) => row.status === 'OVERDUE').reduce((sum, row) => sum + safeNumber(row.outstanding_balance, 0), 0)),
    overdueSupplierCount: new Set(activePayables.filter((row) => row.status === 'OVERDUE').map((row) => row.supplier_id || row.supplier_name)).size,
    paymentRate: calculatePercent(
      activePayables.reduce((sum, row) => sum + safeNumber(row.amount_paid, 0), 0),
      activePayables.reduce((sum, row) => sum + safeNumber(row.total_invoice, 0), 0),
    ),
    agingSummary: Object.fromEntries(Object.entries(payableAging).map(([key, value]) => [key, roundMoney(value)])),
    topCreditors: limitRows(sortDesc(activePayables.filter((row) => row.status !== 'PAID'), 'outstanding_balance'), 10),
  };

  const cashBalance = accountRows
    .filter((account) => ['CASH', 'EWALLET'].includes(account.account_type))
    .filter((account) => account.status !== 'NON_ACTIVE' && account.status !== 'INACTIVE')
    .reduce((sum, account) => sum + safeNumber(account.current_balance, 0), 0);

  const bankBalance = accountRows
    .filter((account) => account.account_type === 'BANK')
    .filter((account) => account.status !== 'NON_ACTIVE' && account.status !== 'INACTIVE')
    .reduce((sum, account) => sum + safeNumber(account.current_balance, 0), 0);

  const cashflowAnalytics = {
    cashBalance: roundMoney(cashBalance),
    bankBalance: roundMoney(bankBalance),
    receivableBalance: receivableAnalytics.totalReceivable,
    payableBalance: payableAnalytics.totalPayable,
    cashPosition: roundMoney(cashBalance + bankBalance + receivableAnalytics.totalReceivable - payableAnalytics.totalPayable),
  };

  const criticalStock = [];
  const lowStock = [];
  const deadStock = [];

  inventoryRows.forEach((item) => {
    const currentQty = safeNumber(item.current_qty, 0);
    const minimumQty = safeNumber(item.minimum_qty, 0);
    const daysNoMovement = item.last_movement_date ? daysBetween(item.last_movement_date, today) : 0;

    if (minimumQty > 0 && currentQty <= minimumQty) {
      criticalStock.push({
        ...item,
        status: 'CRITICAL',
      });
    } else if (minimumQty > 0 && currentQty <= minimumQty * 1.5) {
      lowStock.push({
        ...item,
        status: 'LOW',
      });
    }

    if (currentQty > 0 && daysNoMovement >= 90) {
      deadStock.push({
        ...item,
        status: 'DEAD_STOCK',
        days_no_movement: daysNoMovement,
      });
    }
  });

  const inventoryAnalytics = {
    criticalStock,
    lowStock,
    deadStock,
  };

  const branchAnalytics = {
    topBranchRevenue: limitRows(sortDesc(branchRows, 'totalRevenue'), 10),
    topBranchProfit: limitRows(sortDesc(branchRows, 'netProfit'), 10),
    worstBranch: limitRows([...branchRows].sort((a, b) => safeNumber(a.netProfit, 0) - safeNumber(b.netProfit, 0)), 10),
  };

  const productAnalytics = {
    topProducts: limitRows(sortDesc(productRows, 'qtySold'), 10),
    topProfitProducts: limitRows(sortDesc(productRows, 'grossProfit'), 10),
    lowMarginProducts: limitRows([...productRows].filter((row) => row.totalRevenue > 0).sort((a, b) => safeNumber(a.profitMargin, 0) - safeNumber(b.profitMargin, 0)), 10),
  };

  const customerAnalytics = {
    topCustomers: limitRows(sortDesc(customerRows, 'totalRevenue'), 10),
    topResellers: limitRows(sortDesc(customerRows.filter((row) => ['RESELLER', 'AGEN', 'AGENT'].includes(normalizeCode(row.customer_type))), 'totalRevenue'), 10),
    topDistributors: limitRows(sortDesc(customerRows.filter((row) => ['DISTRIBUTOR'].includes(normalizeCode(row.customer_type))), 'totalRevenue'), 10),
  };

  const trendAnalytics = {
    revenueTrend: createTrend('totalRevenue', summary.totalRevenue, previousSummary.totalRevenue),
    profitTrend: createTrend('netProfit', summary.netProfit, previousSummary.netProfit),
    cashflowTrend: createTrend('netCashflow', summary.netCashflow, previousSummary.netCashflow),
    transactionTrend: createTrend('transactionCount', salesInPeriod.length, previousSummary.transactionCount),
  };

  const warningCards = buildWarningCards({
    summary,
    cashflowAnalytics,
    receivableAnalytics,
    payableAnalytics,
    inventoryAnalytics,
  });

  return {
    ok: true,
    readonly: true,
    generated_at: new Date().toISOString(),
    orchestrator_version: ORCHESTRATOR_VERSION,
    profit_engine_available: Boolean(profitEngine),

    period: {
      type: period.period,
      startDate: period.startDate,
      endDate: period.endDate,
      previousStartDate: period.previousStartDate,
      previousEndDate: period.previousEndDate,
    },

    summary,
    branchAnalytics,
    productAnalytics,
    customerAnalytics,
    channelAnalytics,
    cashflowAnalytics,
    receivableAnalytics,
    payableAnalytics,
    inventoryAnalytics,
    warningCards,
    trendAnalytics,

    warnings: [],
  };
};


/* =========================================================================
   AUDIT TRAIL READ ONLY HELPERS
   ========================================================================= */

const AUDIT_ACTION_TYPES = Object.freeze([
  'CREATE',
  'UPDATE',
  'DELETE',
  'VOID',
  'APPROVE',
  'REJECT',
  'LOGIN',
  'LOGOUT',
  'POST',
]);

const AUDIT_SOURCE_KEYS = Object.freeze([
  'audit_logs',
  'auditLogs',
  'audit_trails',
  'auditTrails',
  'erp_audit_trail',
  'erpAuditTrail',
  'activity_logs',
  'activityLogs',
  'system_logs',
  'systemLogs',
  'transaction_logs',
  'transactionLogs',
  'snapshot_logs',
  'snapshotLogs',
]);

const AUDIT_SNAPSHOT_SOURCE_KEYS = Object.freeze([
  'purchase_transactions',
  'purchaseTransactions',
  'purchases',
  'production_batches',
  'productionBatches',
  'sales_transactions',
  'salesTransactions',
  'sales_orders',
  'salesOrders',
  'cash_bank_transactions',
  'cashBankTransactions',
  'payments',
  'receivable_payments',
  'receivablePayments',
  'payable_payments',
  'payablePayments',
  'expenses',
  'adjustments',
  'journals',
  'journal_entries',
  'journalEntries',
]);

const normalizeAuditAction = (value) => {
  const action = normalizeCode(value || '');

  if (['CREATE', 'CREATED', 'ADD', 'ADDED', 'INSERT', 'NEW'].includes(action)) return 'CREATE';
  if (['UPDATE', 'UPDATED', 'EDIT', 'EDITED', 'MODIFY', 'MODIFIED', 'CHANGE', 'CHANGED'].includes(action)) return 'UPDATE';
  if (['DELETE', 'DELETED', 'REMOVE', 'REMOVED', 'SOFT_DELETE', 'HARD_DELETE'].includes(action)) return 'DELETE';
  if (['VOID', 'VOIDED', 'CANCEL', 'CANCELLED', 'CANCELED', 'REVERSAL', 'REVERSE', 'REVERSED'].includes(action)) return 'VOID';
  if (['APPROVE', 'APPROVED', 'ACCEPT', 'ACCEPTED'].includes(action)) return 'APPROVE';
  if (['REJECT', 'REJECTED', 'DECLINE', 'DECLINED'].includes(action)) return 'REJECT';
  if (['LOGIN', 'LOG_IN', 'SIGNIN', 'SIGN_IN'].includes(action)) return 'LOGIN';
  if (['LOGOUT', 'LOG_OUT', 'SIGNOUT', 'SIGN_OUT'].includes(action)) return 'LOGOUT';
  if (['POST', 'POSTED', 'FINAL', 'FINALIZE', 'FINALIZED', 'LOCK', 'LOCKED'].includes(action)) return 'POST';

  return action || 'UNKNOWN';
};

const normalizeAuditDate = (value) => {
  const normalized = normalizeDateString(value);
  return normalized;
};

const normalizeAuditTimestamp = (value) => {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toISOString();
};

const readAuditSnapshotValue = (value) => {
  if (!value) return null;

  const parsed = parseJson(value, value);

  if (!parsed) return null;

  try {
    const readResult = readSnapshot(parsed, {
      allowInvalid: true,
      readonly: true,
    });

    if (readResult?.payload) return readResult.payload;
    if (readResult?.snapshot) return readResult.snapshot;
    if (readResult?.data) return readResult.data;

    return parsed;
  } catch (error) {
    return parsed;
  }
};

const pickAuditValue = (row = {}, keys = []) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') {
      return row[key];
    }
  }

  return '';
};

const buildAuditRecordId = (sourceKey, row = {}, index = 0) => {
  const existingId = pickAuditValue(row, [
    'id',
    'audit_id',
    'auditId',
    'log_id',
    'logId',
    'event_id',
    'eventId',
  ]);

  if (existingId) return String(existingId);

  const ref = pickAuditValue(row, [
    'reference_number',
    'referenceNumber',
    'reference_no',
    'referenceNo',
    'ref_number',
    'refNumber',
    'transaction_code',
    'transactionCode',
    'transaction_id',
    'transactionId',
  ]);

  const action = normalizeAuditAction(pickAuditValue(row, ['action', 'action_type', 'actionType', 'event', 'event_type', 'eventType', 'status']));
  const timestamp = normalizeAuditTimestamp(pickAuditValue(row, ['timestamp', 'action_at', 'actionAt', 'created_at', 'createdAt', 'updated_at', 'updatedAt', 'date'])) || 'NO_TIME';

  return `${normalizeCode(sourceKey || 'AUDIT')}-${index + 1}-${normalizeCode(action)}-${normalizeCode(ref || timestamp)}`;
};

const normalizeAuditRecord = (row = {}, options = {}) => {
  const sourceKey = options.sourceKey || options.source_key || 'audit_logs';
  const index = safeNumber(options.index, 0);
  const metadataSource = parseJson(row.metadata || row.meta || row.additional_metadata || row.additionalMetadata, {}) || {};

  const timestamp = normalizeAuditTimestamp(pickAuditValue(row, [
    'timestamp',
    'action_at',
    'actionAt',
    'event_at',
    'eventAt',
    'created_at',
    'createdAt',
    'updated_at',
    'updatedAt',
    'date',
    'transaction_date',
    'transactionDate',
  ]));

  const action = normalizeAuditAction(pickAuditValue(row, [
    'action',
    'action_type',
    'actionType',
    'event',
    'event_type',
    'eventType',
    'activity',
    'status',
  ]));

  const beforeSnapshot = readAuditSnapshotValue(pickAuditValue(row, [
    'before_snapshot',
    'beforeSnapshot',
    'before_snapshot_json',
    'beforeSnapshotJson',
    'before',
    'previous_snapshot',
    'previousSnapshot',
    'old_value',
    'oldValue',
  ]));

  const afterSnapshot = readAuditSnapshotValue(pickAuditValue(row, [
    'after_snapshot',
    'afterSnapshot',
    'after_snapshot_json',
    'afterSnapshotJson',
    'after',
    'current_snapshot',
    'currentSnapshot',
    'new_value',
    'newValue',
    'snapshot_package',
    'snapshotPackage',
    'orchestrator_snapshot',
    'orchestratorSnapshot',
  ]));

  const user = String(pickAuditValue(row, [
    'user',
    'user_name',
    'userName',
    'username',
    'created_by',
    'createdBy',
    'updated_by',
    'updatedBy',
    'operator',
    'executor',
    'executor_name',
    'executorName',
  ]) || metadataSource.user || metadataSource.user_name || metadataSource.created_by || '').trim();

  const role = String(pickAuditValue(row, [
    'role',
    'user_role',
    'userRole',
    'access_role',
    'accessRole',
    'position',
  ]) || metadataSource.role || metadataSource.user_role || '').trim();

  const branch = String(pickAuditValue(row, [
    'branch',
    'branch_name',
    'branchName',
    'branch_id',
    'branchId',
    'cabang',
  ]) || metadataSource.branch || metadataSource.branch_id || '').trim();

  const moduleName = normalizeCode(pickAuditValue(row, [
    'module',
    'module_name',
    'moduleName',
    'source_module',
    'sourceModule',
    'transaction_type',
    'transactionType',
    'entity_type',
    'entityType',
    'table_name',
    'tableName',
    'source_table',
    'sourceTable',
  ]) || metadataSource.module || metadataSource.source_module || sourceKey);

  const referenceNumber = String(pickAuditValue(row, [
    'reference_number',
    'referenceNumber',
    'reference_no',
    'referenceNo',
    'ref_number',
    'refNumber',
    'invoice_number',
    'invoiceNumber',
    'transaction_code',
    'transactionCode',
    'code',
    'payment_code',
    'paymentCode',
    'purchase_code',
    'purchaseCode',
    'sales_code',
    'salesCode',
    'order_code',
    'orderCode',
  ]) || '').trim();

  const entityType = normalizeCode(pickAuditValue(row, [
    'entity_type',
    'entityType',
    'table_name',
    'tableName',
    'source_table',
    'sourceTable',
    'module',
    'source_module',
    'transaction_type',
  ]) || sourceKey);

  const entityId = String(pickAuditValue(row, [
    'entity_id',
    'entityId',
    'source_id',
    'sourceId',
    'transaction_id',
    'transactionId',
    'id',
    'purchase_id',
    'purchaseId',
    'sales_id',
    'salesId',
    'order_id',
    'orderId',
    'batch_id',
    'batchId',
    'payment_id',
    'paymentId',
    'journal_id',
    'journalId',
  ]) || '').trim();

  const notes = String(pickAuditValue(row, [
    'notes',
    'note',
    'description',
    'reason',
    'message',
    'keterangan',
  ]) || '').trim();

  return {
    id: buildAuditRecordId(sourceKey, row, index),
    timestamp,
    user,
    role,
    branch,
    module: moduleName,
    action,
    reference_number: referenceNumber,
    entity_type: entityType,
    entity_id: entityId,
    before_snapshot: beforeSnapshot,
    after_snapshot: afterSnapshot,
    notes,
    metadata: {
      ...metadataSource,
      source_key: sourceKey,
      raw_action: pickAuditValue(row, ['action', 'action_type', 'actionType', 'event', 'event_type', 'eventType', 'status']),
      normalized_action: action,
      readonly: true,
    },
  };
};

const getNestedSnapshotValue = (row = {}) => {
  const direct = pickAuditValue(row, [
    'snapshot_package',
    'snapshotPackage',
    'composite_snapshot',
    'compositeSnapshot',
    'orchestrator_snapshot',
    'orchestratorSnapshot',
    'transaction_snapshot',
    'transactionSnapshot',
    'purchase_snapshot',
    'purchaseSnapshot',
    'production_snapshot',
    'productionSnapshot',
    'sales_snapshot',
    'salesSnapshot',
    'payment_snapshot',
    'paymentSnapshot',
    'void_snapshot',
    'voidSnapshot',
    'accounting_snapshot',
    'accountingSnapshot',
  ]);

  if (direct) return direct;

  const packageKeys = [
    'transaction_package',
    'purchase_transaction_package',
    'production_batch_package',
    'sales_transaction_package',
    'payment_package',
    'cash_transaction_package',
    'receivable_payment_package',
    'payable_payment_package',
    'transfer_transaction_package',
    'journal_package',
    'accounting_package',
    'reversal_package',
  ];

  for (const key of packageKeys) {
    const pkg = row[key];
    if (!isObject(pkg)) continue;

    const nested = getNestedSnapshotValue(pkg);
    if (nested) return nested;
  }

  const headerKeys = [
    'purchase_header',
    'batch_header',
    'order_header',
    'sales_header',
    'payment_header',
    'cash_header',
    'transfer_header',
    'journal_header',
    'reversal_header',
    'transaction_header',
    'header',
  ];

  for (const key of headerKeys) {
    const header = row[key];
    if (!isObject(header)) continue;

    const snapshotJson = pickAuditValue(header, [
      'snapshot_json',
      'snapshotJson',
      'transaction_snapshot_json',
      'transactionSnapshotJson',
      'purchase_snapshot_json',
      'purchaseSnapshotJson',
      'production_snapshot_json',
      'productionSnapshotJson',
      'sales_snapshot_json',
      'salesSnapshotJson',
      'payment_snapshot_json',
      'paymentSnapshotJson',
    ]);

    if (snapshotJson) return snapshotJson;
  }

  return null;
};

const inferAuditActionFromSnapshotRow = (row = {}) => {
  const explicitAction = pickAuditValue(row, ['action', 'action_type', 'actionType', 'event', 'event_type', 'eventType']);
  if (explicitAction) return normalizeAuditAction(explicitAction);

  const status = normalizeCode(pickAuditValue(row, ['status', 'transaction_status', 'transactionStatus', 'payment_status', 'paymentStatus', 'order_status', 'orderStatus']));

  if (['VOID', 'VOIDED', 'CANCELLED', 'CANCELED', 'REVERSED'].includes(status)) return 'VOID';
  if (['POSTED', 'FINAL', 'LOCKED', 'PAID', 'COMPLETED', 'DONE'].includes(status)) return 'POST';
  if (['APPROVED'].includes(status)) return 'APPROVE';
  if (['REJECTED'].includes(status)) return 'REJECT';
  if (isDeletedRow(row)) return 'DELETE';

  return 'CREATE';
};

const normalizeSnapshotAuditRecord = (row = {}, options = {}) => {
  const sourceKey = options.sourceKey || options.source_key || 'snapshot_source';
  const index = safeNumber(options.index, 0);
  const normalized = normalizeAuditRecord({
    ...row,
    action: inferAuditActionFromSnapshotRow(row),
    module: pickAuditValue(row, ['module', 'source_module', 'sourceModule', 'transaction_type', 'transactionType']) || sourceKey,
    entity_type: pickAuditValue(row, ['entity_type', 'entityType', 'source_table', 'sourceTable', 'table_name', 'tableName']) || sourceKey,
    after_snapshot: getNestedSnapshotValue(row),
  }, {
    sourceKey,
    index,
  });

  return {
    ...normalized,
    metadata: {
      ...normalized.metadata,
      derived_from_snapshot_source: true,
      source_key: sourceKey,
    },
  };
};

const extractAuditSourceRows = (source = {}) => {
  return AUDIT_SOURCE_KEYS.flatMap((key) => {
    return safeArray(source[key]).map((row, index) => ({
      row,
      sourceKey: key,
      index,
      sourceType: 'AUDIT_LOG',
    }));
  });
};

const extractSnapshotAuditSourceRows = (source = {}) => {
  return AUDIT_SNAPSHOT_SOURCE_KEYS.flatMap((key) => {
    return safeArray(source[key]).map((row, index) => ({
      row,
      sourceKey: key,
      index,
      sourceType: 'SNAPSHOT_SOURCE',
    }));
  });
};

const auditRecordMatchesFilters = (record = {}, filters = {}) => {
  const recordDate = normalizeAuditDate(record.timestamp);
  const startDate = normalizeAuditDate(filters.startDate || filters.start_date || '');
  const endDate = normalizeAuditDate(filters.endDate || filters.end_date || '');

  if (startDate && recordDate && recordDate < startDate) return false;
  if (endDate && recordDate && recordDate > endDate) return false;

  const filterUser = normalizeText(filters.user || '');
  const filterBranch = normalizeCode(filters.branch || '');
  const filterModule = normalizeCode(filters.module || '');
  const filterAction = normalizeAuditAction(filters.action || '');
  const search = normalizeText(filters.search || '');

  if (filterUser && !normalizeText(record.user).includes(filterUser)) return false;
  if (filterBranch && normalizeCode(record.branch) !== filterBranch) return false;
  if (filterModule && normalizeCode(record.module) !== filterModule) return false;
  if (filters.action && filterAction !== 'UNKNOWN' && normalizeCode(record.action) !== filterAction) return false;

  if (search) {
    const searchableText = normalizeText([
      record.reference_number,
      record.user,
      record.entity_id,
      record.entity_type,
      record.module,
      record.notes,
    ].filter(Boolean).join(' '));

    if (!searchableText.includes(search)) return false;
  }

  return true;
};

const buildAuditSummary = (records = []) => {
  const summary = {
    totalRecords: safeArray(records).length,
    totalCreate: 0,
    totalUpdate: 0,
    totalDelete: 0,
    totalVoid: 0,
    totalApprove: 0,
    totalReject: 0,
    totalLogin: 0,
    totalLogout: 0,
    totalPost: 0,
  };

  safeArray(records).forEach((record) => {
    const action = normalizeAuditAction(record.action);

    if (action === 'CREATE') summary.totalCreate += 1;
    if (action === 'UPDATE') summary.totalUpdate += 1;
    if (action === 'DELETE') summary.totalDelete += 1;
    if (action === 'VOID') summary.totalVoid += 1;
    if (action === 'APPROVE') summary.totalApprove += 1;
    if (action === 'REJECT') summary.totalReject += 1;
    if (action === 'LOGIN') summary.totalLogin += 1;
    if (action === 'LOGOUT') summary.totalLogout += 1;
    if (action === 'POST') summary.totalPost += 1;
  });

  return summary;
};

const uniqueSortedValues = (records = [], key = '') => {
  return Array.from(new Set(
    safeArray(records)
      .map((record) => record?.[key])
      .filter((value) => value !== undefined && value !== null && value !== '')
      .map(String),
  )).sort((a, b) => a.localeCompare(b));
};

/* =========================================================================
   AUDIT TRAIL API - READ ONLY
   ========================================================================= */

export const getAuditTrail = (input = {}, context = {}) => {
  const ctx = buildContext(context);
  const source = input.source || input.dbData || input.db_data || ctx.source || ctx.dbData || {};
  const warnings = [];

  const activeFilters = {
    startDate: input.startDate || input.start_date || input.dateFrom || input.date_from || '',
    endDate: input.endDate || input.end_date || input.dateTo || input.date_to || '',
    user: input.user || input.username || input.created_by || input.createdBy || '',
    branch: input.branch || input.branch_id || input.branchId || '',
    module: input.module || input.source_module || input.sourceModule || '',
    action: input.action || input.action_type || input.actionType || '',
    search: input.search || input.keyword || input.q || '',
  };

  const auditRows = extractAuditSourceRows(source);
  const snapshotRows = extractSnapshotAuditSourceRows(source);

  const explicitAuditRecords = auditRows.map((item) => normalizeAuditRecord(item.row, {
    sourceKey: item.sourceKey,
    index: item.index,
  }));

  const snapshotAuditRecords = snapshotRows
    .filter((item) => getNestedSnapshotValue(item.row) || pickAuditValue(item.row, ['status', 'action', 'action_type', 'actionType', 'created_at', 'createdAt', 'updated_at', 'updatedAt']))
    .map((item) => normalizeSnapshotAuditRecord(item.row, {
      sourceKey: item.sourceKey,
      index: item.index,
    }));

  const dedupeMap = new Map();

  [...explicitAuditRecords, ...snapshotAuditRecords]
    .filter((record) => record && !isDeletedRow(record))
    .forEach((record) => {
      const dedupeKey = [
        normalizeAuditTimestamp(record.timestamp),
        normalizeCode(record.action),
        normalizeCode(record.reference_number),
        normalizeCode(record.entity_type),
        normalizeCode(record.entity_id),
      ].join('|');

      if (!dedupeMap.has(dedupeKey)) {
        dedupeMap.set(dedupeKey, record);
      }
    });

  const allRecords = Array.from(dedupeMap.values()).sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return String(b.timestamp).localeCompare(String(a.timestamp));
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;

    return bTime - aTime;
  });

  const filteredRecords = allRecords.filter((record) => auditRecordMatchesFilters(record, activeFilters));

  const limit = safeNumber(input.limit || input.max_results || input.maxResults, 0);
  const records = limit > 0 ? filteredRecords.slice(0, limit) : filteredRecords;

  if (allRecords.length === 0) {
    warnings.push(makeWarning('AUDIT_TRAIL_EMPTY', 'Audit trail belum memiliki record pada source yang diberikan.'));
  }

  const filters = {
    active: activeFilters,
    options: {
      users: uniqueSortedValues(allRecords, 'user'),
      branches: uniqueSortedValues(allRecords, 'branch'),
      modules: uniqueSortedValues(allRecords, 'module'),
      actions: AUDIT_ACTION_TYPES,
    },
  };

  return {
    summary: buildAuditSummary(records),
    records,
    filters,
    metadata: {
      generated_at: new Date().toISOString(),
      readonly: true,
      orchestrator_version: ORCHESTRATOR_VERSION,
      source: 'erpOrchestrator.getAuditTrail',
      total_before_filter: allRecords.length,
      total_after_filter: filteredRecords.length,
      total_returned: records.length,
      explicit_audit_source_count: auditRows.length,
      snapshot_source_count: snapshotRows.length,
      action_types: AUDIT_ACTION_TYPES,
    },
    warnings,
  };
};

/* =========================================================================
   INTELLIGENCE API HELPERS - READ ONLY
   ========================================================================= */

const INTELLIGENCE_NOTIFICATION_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const INTELLIGENCE_NOTIFICATION_STATUSES = ['OPEN', 'READ', 'RESOLVED'];

const INTELLIGENCE_DEFAULT_OWNER_ANALYTICS = Object.freeze({
  summary: {},
  branchAnalytics: {
    topBranchRevenue: [],
    topBranchProfit: [],
    worstBranch: [],
  },
  productAnalytics: {
    topProducts: [],
    topProfitProducts: [],
    lowMarginProducts: [],
  },
  customerAnalytics: {
    topCustomers: [],
    topResellers: [],
    topDistributors: [],
  },
  channelAnalytics: {},
  cashflowAnalytics: {},
  receivableAnalytics: {},
  payableAnalytics: {},
  inventoryAnalytics: {
    criticalStock: [],
    lowStock: [],
    deadStock: [],
  },
  warningCards: [],
  trendAnalytics: {},
});

const mergeOwnerAnalyticsDefaults = (analytics = {}) => {
  const source = isObject(analytics) ? analytics : {};
  const branchAnalytics = isObject(source.branchAnalytics) ? source.branchAnalytics : {};
  const productAnalytics = isObject(source.productAnalytics) ? source.productAnalytics : {};
  const customerAnalytics = isObject(source.customerAnalytics) ? source.customerAnalytics : {};
  const inventoryAnalytics = isObject(source.inventoryAnalytics) ? source.inventoryAnalytics : {};

  return {
    ...INTELLIGENCE_DEFAULT_OWNER_ANALYTICS,
    ...source,
    summary: isObject(source.summary) ? source.summary : {},
    branchAnalytics: {
      ...INTELLIGENCE_DEFAULT_OWNER_ANALYTICS.branchAnalytics,
      ...branchAnalytics,
      topBranchRevenue: safeArray(branchAnalytics.topBranchRevenue),
      topBranchProfit: safeArray(branchAnalytics.topBranchProfit),
      worstBranch: safeArray(branchAnalytics.worstBranch),
    },
    productAnalytics: {
      ...INTELLIGENCE_DEFAULT_OWNER_ANALYTICS.productAnalytics,
      ...productAnalytics,
      topProducts: safeArray(productAnalytics.topProducts),
      topProfitProducts: safeArray(productAnalytics.topProfitProducts),
      lowMarginProducts: safeArray(productAnalytics.lowMarginProducts),
    },
    customerAnalytics: {
      ...INTELLIGENCE_DEFAULT_OWNER_ANALYTICS.customerAnalytics,
      ...customerAnalytics,
      topCustomers: safeArray(customerAnalytics.topCustomers),
      topResellers: safeArray(customerAnalytics.topResellers),
      topDistributors: safeArray(customerAnalytics.topDistributors),
    },
    channelAnalytics: isObject(source.channelAnalytics) ? source.channelAnalytics : {},
    cashflowAnalytics: isObject(source.cashflowAnalytics) ? source.cashflowAnalytics : {},
    receivableAnalytics: isObject(source.receivableAnalytics) ? source.receivableAnalytics : {},
    payableAnalytics: isObject(source.payableAnalytics) ? source.payableAnalytics : {},
    inventoryAnalytics: {
      ...INTELLIGENCE_DEFAULT_OWNER_ANALYTICS.inventoryAnalytics,
      ...inventoryAnalytics,
      criticalStock: safeArray(inventoryAnalytics.criticalStock),
      lowStock: safeArray(inventoryAnalytics.lowStock),
      deadStock: safeArray(inventoryAnalytics.deadStock),
    },
    warningCards: safeArray(source.warningCards),
    trendAnalytics: isObject(source.trendAnalytics) ? source.trendAnalytics : {},
  };
};

const resolveReadOnlySource = (input = {}, context = {}) => {
  const ctx = buildContext(context);
  return input.source || input.dbData || input.db_data || ctx.source || ctx.dbData || {};
};

const normalizeFilterValue = (value = '') => {
  const normalized = normalizeCode(value);
  return normalized === 'ALL' ? '' : normalized;
};

const getIntelligenceDateFilters = (input = {}) => ({
  startDate: normalizeDateString(input.startDate || input.start_date || input.dateFrom || input.date_from || ''),
  endDate: normalizeDateString(input.endDate || input.end_date || input.dateTo || input.date_to || ''),
});

const matchesDateFilter = (dateValue, startDate = '', endDate = '') => {
  const date = normalizeDateString(dateValue);
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
};

const matchesTextFilter = (value, filterValue) => {
  const normalizedFilter = normalizeText(filterValue || '');
  if (!normalizedFilter) return true;
  return normalizeText(value || '').includes(normalizedFilter);
};

const normalizePriority = (value = 'LOW') => {
  const normalized = normalizeCode(value || 'LOW');
  if (INTELLIGENCE_NOTIFICATION_PRIORITIES.includes(normalized)) return normalized;
  if (['URGENT', 'DANGER', 'DANGEROUS', 'KRITIS'].includes(normalized)) return 'CRITICAL';
  if (['WARNING', 'WARN', 'BAHAYA'].includes(normalized)) return 'HIGH';
  if (['WASPADA', 'MED'].includes(normalized)) return 'MEDIUM';
  return 'LOW';
};

const normalizeNotificationStatus = (value = 'OPEN') => {
  const normalized = normalizeCode(value || 'OPEN');
  if (INTELLIGENCE_NOTIFICATION_STATUSES.includes(normalized)) return normalized;
  if (['DONE', 'CLOSED', 'CLOSE', 'SOLVED'].includes(normalized)) return 'RESOLVED';
  if (['SEEN', 'VIEWED'].includes(normalized)) return 'READ';
  return 'OPEN';
};

const getHealthCategoryFromScore = (score) => {
  const value = Math.max(0, Math.min(100, Math.round(safeNumber(score, 0))));

  if (value >= 85) return 'Sangat Sehat';
  if (value >= 70) return 'Sehat';
  if (value >= 55) return 'Waspada';
  if (value >= 35) return 'Bahaya';

  return 'Kritis';
};

const resolveCashflowDirection = (record = {}) => {
  const type = normalizeCode(record.transaction_type || record.type || record.payment_type || '');
  const sourceModule = normalizeCode(record.source_module || record.module || record.category || '');

  if (type === 'TRANSFER' || sourceModule === 'TRANSFER') return 'TRANSFER';

  if (
    ['MONEY_IN', 'IN', 'INFLOW', 'CASH_IN', 'RECEIVABLE', 'OWNER_DEPOSIT'].includes(type) ||
    ['SALES', 'OWNER_DEPOSIT', 'PIUTANG_CUSTOMER', 'RECEIVABLE'].includes(sourceModule)
  ) {
    return 'IN';
  }

  if (
    ['MONEY_OUT', 'OUT', 'OUTFLOW', 'CASH_OUT', 'PAYABLE', 'OWNER_WITHDRAW'].includes(type) ||
    ['PURCHASE', 'EXPENSE', 'OWNER_WITHDRAW', 'HUTANG_SUPPLIER', 'PAYABLE'].includes(sourceModule)
  ) {
    return 'OUT';
  }

  return safeNumber(record.amount, 0) < 0 ? 'OUT' : 'IN';
};

const getTrendPeriodKey = (dateValue, granularity = 'DAILY') => {
  const date = normalizeDateString(dateValue);
  if (!date) return '';

  const normalizedGranularity = normalizeCode(granularity || 'DAILY');
  if (normalizedGranularity === 'MONTHLY') return date.substring(0, 7);

  if (normalizedGranularity === 'WEEKLY') {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    const start = new Date(parsed);
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    return normalizeDateString(start);
  }

  return date;
};

const makeIntelligenceRecord = ({
  id,
  timestamp,
  category = 'INTELLIGENCE',
  module = 'SYSTEM',
  severity = 'INFO',
  status = 'PASSED',
  title = '',
  message = '',
  action_hint = '',
  reference_key = '',
  metadata = {},
}) => ({
  id: id || generateId('INTEL'),
  timestamp: timestamp || new Date().toISOString(),
  category: normalizeCode(category || 'INTELLIGENCE'),
  module: normalizeCode(module || 'SYSTEM'),
  severity: normalizeCode(severity || 'INFO'),
  status: normalizeCode(status || 'PASSED'),
  title,
  message,
  action_hint,
  reference_key,
  metadata: isObject(metadata) ? metadata : {},
});

const makeNotificationRecord = ({
  id,
  timestamp,
  priority = 'LOW',
  status = 'OPEN',
  module = 'SYSTEM',
  branch = '',
  type = 'SYSTEM',
  title = '',
  message = '',
  reference_number = '',
  entity_type = '',
  entity_id = '',
  action_hint = '',
  amount = 0,
  due_date = '',
  metadata = {},
}) => ({
  id: id || generateId('NTF'),
  timestamp: timestamp || new Date().toISOString(),
  priority: normalizePriority(priority),
  status: normalizeNotificationStatus(status),
  module: normalizeCode(module || 'SYSTEM'),
  branch: branch || '',
  type: normalizeCode(type || 'SYSTEM'),
  title,
  message,
  reference_number,
  entity_type,
  entity_id,
  action_hint,
  amount: roundMoney(amount),
  due_date: normalizeDateString(due_date || ''),
  metadata: isObject(metadata) ? metadata : {},
});

const getSourceNotificationRows = (source = {}) => {
  return getSourceRows(source, [
    'notifications',
    'notification_center',
    'notificationCenter',
    'erp_notifications',
    'erpNotifications',
    'system_notifications',
    'systemNotifications',
  ]);
};

const normalizeExistingNotificationRow = (row = {}, index = 0) => {
  return makeNotificationRecord({
    id: row.id || row.notification_id || row.notificationId || `NTF-SRC-${index + 1}`,
    timestamp: row.timestamp || row.created_at || row.createdAt || row.date || getTodayISO(),
    priority: row.priority || row.severity || 'LOW',
    status: row.status || 'OPEN',
    module: row.module || row.source_module || row.sourceModule || 'SYSTEM',
    branch: row.branch || row.branch_id || row.branchId || row.branch_name || '',
    type: row.type || row.notification_type || row.notificationType || row.category || 'SYSTEM',
    title: row.title || row.subject || row.type || 'ERP Notification',
    message: row.message || row.description || row.notes || '',
    reference_number: row.reference_number || row.referenceNumber || row.ref_number || row.refNumber || '',
    entity_type: row.entity_type || row.entityType || row.source_table || row.sourceTable || '',
    entity_id: row.entity_id || row.entityId || row.source_id || row.sourceId || row.transaction_id || '',
    action_hint: row.action_hint || row.actionHint || row.recommendation || '',
    amount: row.amount || row.nominal || 0,
    due_date: row.due_date || row.dueDate || '',
    metadata: row.metadata || row.meta || row,
  });
};

const notificationMatchesFilters = (record = {}, filters = {}) => {
  const filterPriority = normalizeFilterValue(filters.priority || '');
  const filterModule = normalizeFilterValue(filters.module || '');
  const filterBranch = normalizeText(filters.branch || '');
  const filterStatus = normalizeFilterValue(filters.status || '');
  const filterType = normalizeFilterValue(filters.type || '');
  const search = normalizeText(filters.search || '');

  if (filterPriority && normalizePriority(record.priority) !== filterPriority) return false;
  if (filterModule && normalizeCode(record.module) !== filterModule) return false;
  if (filterStatus && normalizeNotificationStatus(record.status) !== filterStatus) return false;
  if (filterType && normalizeCode(record.type) !== filterType) return false;
  if (filterBranch && !normalizeText(record.branch).includes(filterBranch)) return false;
  if (filters.startDate || filters.endDate) {
    const dateValue = record.timestamp || record.due_date || '';
    if (!matchesDateFilter(dateValue, filters.startDate, filters.endDate)) return false;
  }

  if (search) {
    const searchable = normalizeText([
      record.title,
      record.message,
      record.reference_number,
      record.entity_type,
      record.entity_id,
      record.branch,
      record.module,
      record.action_hint,
    ].filter(Boolean).join(' '));

    if (!searchable.includes(search)) return false;
  }

  return true;
};

const buildNotificationSummary = (records = []) => {
  const summary = {
    totalNotifications: safeArray(records).length,
    totalCritical: 0,
    totalHigh: 0,
    totalMedium: 0,
    totalLow: 0,
    totalOpen: 0,
    totalRead: 0,
    totalResolved: 0,
  };

  safeArray(records).forEach((record) => {
    const priority = normalizePriority(record.priority);
    const status = normalizeNotificationStatus(record.status);

    if (priority === 'CRITICAL') summary.totalCritical += 1;
    if (priority === 'HIGH') summary.totalHigh += 1;
    if (priority === 'MEDIUM') summary.totalMedium += 1;
    if (priority === 'LOW') summary.totalLow += 1;
    if (status === 'OPEN') summary.totalOpen += 1;
    if (status === 'READ') summary.totalRead += 1;
    if (status === 'RESOLVED') summary.totalResolved += 1;
  });

  return summary;
};

const getIntelligenceOwnerAnalytics = (input = {}, context = {}) => {
  try {
    return mergeOwnerAnalyticsDefaults(getOwnerAnalytics({
      ...(input || {}),
      period: input.period || 'CUSTOM',
      start_date: input.startDate || input.start_date || input.dateFrom || input.date_from || input.start_date,
      end_date: input.endDate || input.end_date || input.dateTo || input.date_to || input.end_date,
      readonly: true,
    }, {
      ...(context || {}),
      readonly: true,
    }) || {});
  } catch (error) {
    return mergeOwnerAnalyticsDefaults({
      warnings: [
        makeWarning('OWNER_ANALYTICS_READ_FAILED', error?.message || 'Gagal membaca owner analytics untuk intelligence API.'),
      ],
    });
  }
};

/* =========================================================================
   CASHFLOW DASHBOARD API - READ ONLY
   ========================================================================= */

export const getCashflowDashboard = (input = {}, context = {}) => {
  const source = resolveReadOnlySource(input, context);
  const dateFilters = getIntelligenceDateFilters(input);
  const filters = {
    ...dateFilters,
    branch: input.branch || input.branch_id || input.branchId || '',
    account: input.account || input.account_id || input.accountId || '',
    module: input.module || input.source_module || input.sourceModule || '',
    transactionType: input.transactionType || input.transaction_type || input.type || '',
    status: input.status || '',
    granularity: normalizeCode(input.granularity || 'DAILY') || 'DAILY',
    search: input.search || input.keyword || input.q || '',
  };

  const warnings = [];
  const ownerAnalytics = getIntelligenceOwnerAnalytics({
    ...input,
    startDate: filters.startDate,
    endDate: filters.endDate,
  }, context);
  warnings.push(...safeArray(ownerAnalytics.warnings));

  const sourceRows = extractOwnerAnalyticsSourceRows(source);
  const cashRows = sourceRows.cashRows
    .filter((row) => !isDeletedRow(row))
    .map(normalizeCashRowForAnalytics)
    .map((row) => ({
      ...row,
      direction: resolveCashflowDirection(row),
    }));

  const accountRows = sourceRows.accountRows
    .filter((row) => !isDeletedRow(row))
    .map(normalizeAccountRowForAnalytics);

  const filterBranch = normalizeText(filters.branch || '');
  const filterAccount = normalizeText(filters.account || '');
  const filterModule = normalizeFilterValue(filters.module || '');
  const filterType = normalizeFilterValue(filters.transactionType || '');
  const filterStatus = normalizeFilterValue(filters.status || '');
  const search = normalizeText(filters.search || '');

  const filteredCashRows = cashRows.filter((row) => {
    if ((filters.startDate || filters.endDate) && !matchesDateFilter(row.date, filters.startDate, filters.endDate)) return false;
    if (filterBranch && !normalizeText(row.branch_id).includes(filterBranch)) return false;
    if (filterAccount && !normalizeText(`${row.account_id} ${row.target_account_id}`).includes(filterAccount)) return false;
    if (filterModule && normalizeCode(row.source_module) !== filterModule) return false;
    if (filterType && normalizeCode(row.transaction_type) !== filterType) return false;
    if (filterStatus && normalizeCode(row.status) !== filterStatus) return false;

    if (search) {
      const searchable = normalizeText([
        row.transaction_id,
        row.branch_id,
        row.account_id,
        row.target_account_id,
        row.transaction_type,
        row.source_module,
      ].filter(Boolean).join(' '));

      if (!searchable.includes(search)) return false;
    }

    return true;
  });

  const records = filteredCashRows.map((row, index) => ({
    id: row.transaction_id || `CASHFLOW-${index + 1}`,
    timestamp: row.date || getTodayISO(),
    date: row.date || '',
    branch: row.branch_id || '',
    account_id: row.account_id || '',
    account_name: row.account_name || row.account_id || '',
    module: row.source_module || '',
    transaction_type: row.transaction_type || '',
    direction: row.direction,
    amount: roundMoney(row.amount),
    reference_number: row.transaction_id || '',
    entity_type: 'CASHFLOW_TRANSACTION',
    entity_id: row.transaction_id || '',
    notes: row.notes || row.description || '',
    metadata: {
      raw: row.raw || null,
      target_account_id: row.target_account_id || '',
      status: row.status || '',
    },
  }));

  const summaryFromRecords = records.reduce((acc, record) => {
    const amount = safeNumber(record.amount, 0);
    if (record.direction === 'IN') acc.cashIn += amount;
    if (record.direction === 'OUT') acc.cashOut += amount;
    return acc;
  }, {
    cashIn: 0,
    cashOut: 0,
  });

  const cashflowAnalytics = ownerAnalytics.cashflowAnalytics || {};
  const summary = {
    cashIn: roundMoney(summaryFromRecords.cashIn || ownerAnalytics.summary?.cashIn || 0),
    cashOut: roundMoney(summaryFromRecords.cashOut || ownerAnalytics.summary?.cashOut || 0),
    netCashflow: roundMoney(summaryFromRecords.cashIn - summaryFromRecords.cashOut || ownerAnalytics.summary?.netCashflow || 0),
    cashBalance: roundMoney(cashflowAnalytics.cashBalance || 0),
    bankBalance: roundMoney(cashflowAnalytics.bankBalance || 0),
    receivableBalance: roundMoney(cashflowAnalytics.receivableBalance || ownerAnalytics.receivableAnalytics?.totalReceivable || 0),
    payableBalance: roundMoney(cashflowAnalytics.payableBalance || ownerAnalytics.payableAnalytics?.totalPayable || 0),
    cashPosition: roundMoney(cashflowAnalytics.cashPosition || 0),
    totalTransactions: records.length,
  };

  const accountMovementMap = new Map();
  accountRows.forEach((account) => {
    const key = account.account_id || account.account_code || 'UNKNOWN_ACCOUNT';
    accountMovementMap.set(key, {
      account_id: key,
      account_name: account.account_name || key,
      account_type: account.account_type || 'CASH',
      branch: account.branch_id || '',
      current_balance: roundMoney(account.current_balance || 0),
      cash_in: 0,
      cash_out: 0,
      net_movement: 0,
    });
  });

  records.forEach((record) => {
    const key = record.account_id || 'UNKNOWN_ACCOUNT';
    if (!accountMovementMap.has(key)) {
      accountMovementMap.set(key, {
        account_id: key,
        account_name: key,
        account_type: 'UNKNOWN',
        branch: record.branch || '',
        current_balance: 0,
        cash_in: 0,
        cash_out: 0,
        net_movement: 0,
      });
    }

    const account = accountMovementMap.get(key);
    const amount = safeNumber(record.amount, 0);
    if (record.direction === 'IN') account.cash_in += amount;
    if (record.direction === 'OUT') account.cash_out += amount;
    account.net_movement = account.cash_in - account.cash_out;
  });

  const accountBalances = Array.from(accountMovementMap.values()).map((row) => ({
    ...row,
    cash_in: roundMoney(row.cash_in),
    cash_out: roundMoney(row.cash_out),
    net_movement: roundMoney(row.net_movement),
  }));

  const trendMap = new Map();
  records.forEach((record) => {
    const key = getTrendPeriodKey(record.date || record.timestamp, filters.granularity);
    if (!key) return;
    if (!trendMap.has(key)) {
      trendMap.set(key, {
        period: key,
        cashIn: 0,
        cashOut: 0,
        netCashflow: 0,
      });
    }

    const trend = trendMap.get(key);
    const amount = safeNumber(record.amount, 0);
    if (record.direction === 'IN') trend.cashIn += amount;
    if (record.direction === 'OUT') trend.cashOut += amount;
    trend.netCashflow = trend.cashIn - trend.cashOut;
  });

  const trends = Array.from(trendMap.values())
    .map((trend) => ({
      ...trend,
      cashIn: roundMoney(trend.cashIn),
      cashOut: roundMoney(trend.cashOut),
      netCashflow: roundMoney(trend.netCashflow),
    }))
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));

  const riskCards = [];
  if (summary.cashPosition < 0) {
    riskCards.push({
      id: 'CASH_DEFICIT_RISK',
      severity: 'CRITICAL',
      title: 'Cash Deficit Risk',
      message: 'Cash position berada di bawah nol.',
      amount: summary.cashPosition,
      action_hint: 'Prioritaskan cash in, penagihan piutang, dan tahan pengeluaran non-esensial.',
      metadata: { source: 'cashflowAnalytics' },
    });
  }

  if (summary.netCashflow < 0) {
    riskCards.push({
      id: 'NEGATIVE_NET_CASHFLOW',
      severity: 'HIGH',
      title: 'Net Cashflow Negatif',
      message: 'Cash out lebih besar daripada cash in pada periode ini.',
      amount: summary.netCashflow,
      action_hint: 'Review pengeluaran dan percepat collection.',
      metadata: { source: 'records' },
    });
  }

  if (riskCards.length === 0) {
    riskCards.push({
      id: 'CASHFLOW_SAFE',
      severity: 'LOW',
      title: 'Cashflow Aman',
      message: 'Tidak ada risiko cashflow kritis pada periode ini.',
      amount: summary.netCashflow,
      action_hint: 'Lanjutkan monitoring rutin.',
      metadata: { source: 'cashflowDashboard' },
    });
  }

  if (records.length === 0) {
    warnings.push(makeWarning('CASHFLOW_EMPTY', 'Tidak ada record cashflow untuk filter aktif.'));
  }

  return {
    summary,
    records,
    accountBalances,
    trends,
    riskCards,
    filters,
    metadata: {
      generated_at: new Date().toISOString(),
      readonly: true,
      source_api: 'getCashflowDashboard',
      orchestrator_version: ORCHESTRATOR_VERSION,
      total_before_filter: cashRows.length,
      total_after_filter: filteredCashRows.length,
      account_count: accountBalances.length,
      granularity: filters.granularity,
    },
    warnings,
  };
};

/* =========================================================================
   BUSINESS RADAR API - READ ONLY
   ========================================================================= */

export const getBusinessRadar = (input = {}, context = {}) => {
  const dateFilters = getIntelligenceDateFilters(input);
  const filters = {
    ...dateFilters,
    period: input.period || 'CUSTOM',
    branch: input.branch || input.branch_id || input.branchId || '',
    module: input.module || '',
    severity: input.severity || '',
    search: input.search || input.keyword || input.q || '',
  };

  const warnings = [];
  const ownerAnalytics = getIntelligenceOwnerAnalytics({
    ...input,
    startDate: filters.startDate,
    endDate: filters.endDate,
    period: filters.period,
  }, context);
  warnings.push(...safeArray(ownerAnalytics.warnings));

  const cashflowDashboard = getCashflowDashboard({
    ...input,
    startDate: filters.startDate,
    endDate: filters.endDate,
    branch: filters.branch,
  }, context);
  warnings.push(...safeArray(cashflowDashboard.warnings));

  const summaryData = ownerAnalytics.summary || {};
  const branchAnalytics = ownerAnalytics.branchAnalytics || {};
  const productAnalytics = ownerAnalytics.productAnalytics || {};
  const cashflowAnalytics = ownerAnalytics.cashflowAnalytics || {};
  const receivableAnalytics = ownerAnalytics.receivableAnalytics || {};
  const payableAnalytics = ownerAnalytics.payableAnalytics || {};
  const inventoryAnalytics = ownerAnalytics.inventoryAnalytics || {};
  const trendAnalytics = ownerAnalytics.trendAnalytics || {};
  const warningCards = safeArray(ownerAnalytics.warningCards);

  const criticalWarnings = warningCards.filter((warning) => normalizeCode(warning?.severity) === 'CRITICAL');
  const mediumWarnings = warningCards.filter((warning) => normalizeCode(warning?.severity) === 'WARNING');
  const criticalStock = safeArray(inventoryAnalytics.criticalStock);
  const lowStock = safeArray(inventoryAnalytics.lowStock);
  const deadStock = safeArray(inventoryAnalytics.deadStock);
  const lowMarginProducts = safeArray(productAnalytics.lowMarginProducts);
  const worstBranches = safeArray(branchAnalytics.worstBranch);
  const lossBranches = worstBranches.filter((branch) => safeNumber(branch.netProfit || branch.grossProfit || branch.totalProfit, 0) < 0);

  const revenueTrend = trendAnalytics.revenueTrend || {};
  const profitTrend = trendAnalytics.profitTrend || {};
  const cashflowTrend = trendAnalytics.cashflowTrend || {};
  const salesDropPercent = Math.abs(safeNumber(revenueTrend.changePercent, 0));
  const salesDrop = normalizeCode(revenueTrend.direction) === 'DOWN' && salesDropPercent >= 20;
  const marginTooSmall = lowMarginProducts.some((product) => safeNumber(product.profitMargin, 0) < 10);

  let businessHealthScore = 100;
  businessHealthScore -= criticalWarnings.length * 12;
  businessHealthScore -= mediumWarnings.length * 6;
  if (safeNumber(cashflowAnalytics.cashPosition, 0) < 0) businessHealthScore -= 18;
  if (safeNumber(summaryData.netProfit, 0) < 0) businessHealthScore -= 18;
  if (safeNumber(receivableAnalytics.overdueReceivable, 0) > 0) businessHealthScore -= 8;
  if (safeNumber(payableAnalytics.overduePayable, 0) > 0) businessHealthScore -= 8;
  if (criticalStock.length > 0) businessHealthScore -= 8;
  if (marginTooSmall) businessHealthScore -= 6;
  if (salesDrop) businessHealthScore -= 10;
  if (lossBranches.length > 0) businessHealthScore -= 8;
  businessHealthScore = Math.max(0, Math.min(100, Math.round(businessHealthScore)));

  let cashDisciplineScore = 100;
  if (safeNumber(cashflowAnalytics.cashPosition, 0) < 0) cashDisciplineScore -= 30;
  if (safeNumber(cashflowAnalytics.cashBalance, 0) < 0) cashDisciplineScore -= 20;
  if (safeNumber(receivableAnalytics.overdueReceivable, 0) > 0) cashDisciplineScore -= 15;
  if (safeNumber(payableAnalytics.overduePayable, 0) > 0) cashDisciplineScore -= 15;
  if (normalizeCode(cashflowTrend.direction) === 'DOWN' && safeNumber(cashflowTrend.changePercent, 0) < 0) cashDisciplineScore -= 10;
  cashDisciplineScore = Math.max(0, Math.min(100, Math.round(cashDisciplineScore)));

  const records = [];

  if (safeNumber(cashflowAnalytics.cashPosition, 0) < 0) {
    records.push({
      id: 'RADAR-CASH-DEFICIT',
      timestamp: new Date().toISOString(),
      radar_type: 'FINANCIAL',
      severity: 'CRITICAL',
      module: 'CASHFLOW',
      branch: filters.branch || 'ALL',
      title: 'Cash Deficit Risk',
      message: 'Cash position negatif dan perlu tindakan owner.',
      metric_name: 'cashPosition',
      metric_value: roundMoney(cashflowAnalytics.cashPosition),
      threshold: 0,
      reference_number: '',
      entity_type: 'CASHFLOW',
      entity_id: 'CASH_POSITION',
      action_hint: 'Prioritaskan penagihan piutang dan tahan pengeluaran non-esensial.',
      metadata: { cashflowAnalytics },
    });
  }

  if (safeNumber(summaryData.netProfit, 0) < 0) {
    records.push({
      id: 'RADAR-NEGATIVE-PROFIT',
      timestamp: new Date().toISOString(),
      radar_type: 'PROFIT',
      severity: 'CRITICAL',
      module: 'SALES',
      branch: filters.branch || 'ALL',
      title: 'Profit Negatif',
      message: 'Net profit periode ini negatif.',
      metric_name: 'netProfit',
      metric_value: roundMoney(summaryData.netProfit),
      threshold: 0,
      reference_number: '',
      entity_type: 'PROFIT',
      entity_id: 'NET_PROFIT',
      action_hint: 'Evaluasi HPP, diskon, biaya operasional, dan channel rugi.',
      metadata: { summary: summaryData },
    });
  }

  if (safeNumber(receivableAnalytics.overdueReceivable, 0) > 0) {
    records.push({
      id: 'RADAR-RECEIVABLE-RISK',
      timestamp: new Date().toISOString(),
      radar_type: 'FINANCIAL',
      severity: 'HIGH',
      module: 'RECEIVABLE',
      branch: filters.branch || 'ALL',
      title: 'Receivable Risk',
      message: 'Ada piutang overdue yang menekan cashflow.',
      metric_name: 'overdueReceivable',
      metric_value: roundMoney(receivableAnalytics.overdueReceivable),
      threshold: 0,
      reference_number: '',
      entity_type: 'RECEIVABLE',
      entity_id: 'OVERDUE_RECEIVABLE',
      action_hint: 'Prioritaskan penagihan customer dengan aging tertua.',
      metadata: { receivableAnalytics },
    });
  }

  if (safeNumber(payableAnalytics.overduePayable, 0) > 0) {
    records.push({
      id: 'RADAR-PAYABLE-RISK',
      timestamp: new Date().toISOString(),
      radar_type: 'FINANCIAL',
      severity: 'HIGH',
      module: 'PAYABLE',
      branch: filters.branch || 'ALL',
      title: 'Debt Risk',
      message: 'Ada hutang overdue yang perlu diprioritaskan.',
      metric_name: 'overduePayable',
      metric_value: roundMoney(payableAnalytics.overduePayable),
      threshold: 0,
      reference_number: '',
      entity_type: 'PAYABLE',
      entity_id: 'OVERDUE_PAYABLE',
      action_hint: 'Atur pembayaran supplier berdasarkan prioritas jatuh tempo.',
      metadata: { payableAnalytics },
    });
  }

  if (criticalStock.length > 0) {
    records.push({
      id: 'RADAR-STOCK-OUT-RISK',
      timestamp: new Date().toISOString(),
      radar_type: 'INVENTORY',
      severity: 'HIGH',
      module: 'INVENTORY',
      branch: filters.branch || 'ALL',
      title: 'Stock Out Risk',
      message: `${criticalStock.length} item berada pada stok kritis.`,
      metric_name: 'criticalStockCount',
      metric_value: criticalStock.length,
      threshold: 0,
      reference_number: '',
      entity_type: 'INVENTORY',
      entity_id: 'CRITICAL_STOCK',
      action_hint: 'Cek purchasing, produksi, dan transfer stok.',
      metadata: { criticalStock },
    });
  }

  if (marginTooSmall) {
    records.push({
      id: 'RADAR-LOW-MARGIN',
      timestamp: new Date().toISOString(),
      radar_type: 'SALES',
      severity: 'HIGH',
      module: 'SALES',
      branch: filters.branch || 'ALL',
      title: 'Margin Terlalu Kecil',
      message: 'Ada produk dengan margin di bawah batas aman.',
      metric_name: 'lowMarginProducts',
      metric_value: lowMarginProducts.length,
      threshold: 10,
      reference_number: '',
      entity_type: 'PRODUCT',
      entity_id: 'LOW_MARGIN',
      action_hint: 'Evaluasi harga jual, HPP, dan promo produk margin rendah.',
      metadata: { lowMarginProducts },
    });
  }

  if (salesDrop) {
    records.push({
      id: 'RADAR-SALES-DROP',
      timestamp: new Date().toISOString(),
      radar_type: 'SALES',
      severity: 'HIGH',
      module: 'SALES',
      branch: filters.branch || 'ALL',
      title: 'Penjualan Turun Drastis',
      message: `Revenue turun ${roundPercent(salesDropPercent)}% dibanding periode sebelumnya.`,
      metric_name: 'revenueTrend.changePercent',
      metric_value: roundPercent(salesDropPercent),
      threshold: 20,
      reference_number: '',
      entity_type: 'SALES_TREND',
      entity_id: 'REVENUE_DROP',
      action_hint: 'Cek channel, cabang, dan produk yang mengalami penurunan.',
      metadata: { revenueTrend },
    });
  }

  if (lossBranches.length > 0) {
    records.push({
      id: 'RADAR-BRANCH-LOSS',
      timestamp: new Date().toISOString(),
      radar_type: 'BRANCH',
      severity: 'HIGH',
      module: 'BRANCH',
      branch: filters.branch || 'ALL',
      title: 'Cabang Merugi',
      message: `${lossBranches.length} cabang memiliki profit negatif.`,
      metric_name: 'lossBranches',
      metric_value: lossBranches.length,
      threshold: 0,
      reference_number: '',
      entity_type: 'BRANCH',
      entity_id: 'LOSS_BRANCHES',
      action_hint: 'Audit biaya, omzet, dan HPP cabang yang merugi.',
      metadata: { lossBranches },
    });
  }

  const financialRiskCards = [
    {
      id: 'cashDeficitRisk',
      severity: safeNumber(cashflowAnalytics.cashPosition, 0) < 0 ? 'CRITICAL' : 'LOW',
      title: 'Cash Deficit Risk',
      message: safeNumber(cashflowAnalytics.cashPosition, 0) < 0
        ? 'Cash position negatif. Perlu kontrol kas dan prioritas penagihan.'
        : 'Cash position masih aman berdasarkan analytics orchestrator.',
      amount: roundMoney(cashflowAnalytics.cashPosition || 0),
      action_hint: safeNumber(cashflowAnalytics.cashPosition, 0) < 0
        ? 'Prioritaskan cash in dan tahan pengeluaran non-esensial.'
        : 'Pertahankan disiplin cashflow.',
      metadata: { source: 'cashflowAnalytics' },
    },
    {
      id: 'debtRisk',
      severity: safeNumber(payableAnalytics.overduePayable, 0) > 0 ? 'HIGH' : 'LOW',
      title: 'Debt Risk',
      message: safeNumber(payableAnalytics.overduePayable, 0) > 0
        ? 'Ada hutang overdue yang perlu diprioritaskan.'
        : 'Tidak ada hutang overdue signifikan.',
      amount: roundMoney(payableAnalytics.overduePayable || payableAnalytics.totalPayable || 0),
      action_hint: safeNumber(payableAnalytics.overduePayable, 0) > 0
        ? 'Atur pembayaran supplier berdasarkan prioritas jatuh tempo.'
        : 'Pantau hutang supplier secara rutin.',
      metadata: { payableAnalytics },
    },
    {
      id: 'receivableRisk',
      severity: safeNumber(receivableAnalytics.overdueReceivable, 0) > 0 ? 'HIGH' : 'LOW',
      title: 'Receivable Risk',
      message: safeNumber(receivableAnalytics.overdueReceivable, 0) > 0
        ? 'Ada piutang overdue yang menekan cashflow.'
        : 'Piutang overdue masih aman.',
      amount: roundMoney(receivableAnalytics.overdueReceivable || receivableAnalytics.totalReceivable || 0),
      action_hint: safeNumber(receivableAnalytics.overdueReceivable, 0) > 0
        ? 'Prioritaskan penagihan customer dengan aging tertua.'
        : 'Pertahankan ritme penagihan.',
      metadata: { receivableAnalytics },
    },
  ];

  const requiredChannels = ['Offline', 'GoFood', 'GrabFood', 'ShopeeFood', 'TikTok', 'Franchise'];
  const problematicChannels = requiredChannels
    .map((key) => ({ key, ...(ownerAnalytics.channelAnalytics?.[key] || {}) }))
    .filter((channel) => safeNumber(channel.totalRevenue, 0) <= 0 || safeNumber(channel.netProfit, 0) < 0);

  const salesRiskCards = [
    {
      id: 'salesDropRisk',
      severity: salesDrop ? 'HIGH' : 'LOW',
      title: 'Penjualan Turun',
      message: salesDrop
        ? `Revenue turun ${roundPercent(salesDropPercent)}% dibanding periode sebelumnya.`
        : 'Tidak ada penurunan penjualan drastis dari trend analytics.',
      amount: roundMoney(revenueTrend.changeValue || 0),
      action_hint: salesDrop
        ? 'Cek channel, cabang, dan produk dengan performa menurun.'
        : 'Lanjutkan monitoring trend revenue.',
      metadata: { revenueTrend },
    },
    {
      id: 'channelRisk',
      severity: problematicChannels.length > 0 ? 'HIGH' : 'LOW',
      title: 'Channel Bermasalah',
      message: problematicChannels.length > 0
        ? `${problematicChannels.length} channel butuh perhatian.`
        : 'Tidak ada channel bermasalah signifikan.',
      count: problematicChannels.length,
      action_hint: problematicChannels.length > 0
        ? 'Evaluasi promo, komisi, dan performa channel bermasalah.'
        : 'Pertahankan performa channel aktif.',
      metadata: { problematicChannels },
    },
    {
      id: 'unsoldProductRisk',
      severity: safeArray(productAnalytics.topProducts).length === 0 ? 'HIGH' : 'LOW',
      title: 'Produk Tidak Laku',
      message: safeArray(productAnalytics.topProducts).length === 0
        ? 'Belum ada produk terlaris pada periode ini.'
        : 'Produk terlaris tersedia dari analytics orchestrator.',
      action_hint: safeArray(productAnalytics.topProducts).length === 0
        ? 'Cek traffic penjualan dan promosi produk.'
        : 'Pantau produk dengan margin rendah.',
      metadata: { topProducts: productAnalytics.topProducts },
    },
  ];

  const ownerActionCenter = records
    .filter((record) => ['CRITICAL', 'HIGH'].includes(normalizePriority(record.severity)))
    .map((record, index) => ({
      id: `ACTION-${index + 1}-${record.id}`,
      severity: record.severity,
      title: record.title,
      description: record.message,
      source: record.radar_type,
      action_hint: record.action_hint,
      metadata: record.metadata,
    }));

  if (ownerActionCenter.length === 0) {
    ownerActionCenter.push({
      id: 'NO_ACTION_REQUIRED',
      severity: 'LOW',
      title: 'Tidak ada aksi kritis',
      description: 'Tidak ada rekomendasi kritis dari Business Radar pada periode ini.',
      source: 'BUSINESS_RADAR',
      action_hint: 'Lanjutkan monitoring rutin.',
      metadata: {},
    });
  }

  const filteredRecords = records.filter((record) => {
    const filterModule = normalizeFilterValue(filters.module || '');
    const filterSeverity = normalizeFilterValue(filters.severity || '');
    const filterBranch = normalizeText(filters.branch || '');
    const search = normalizeText(filters.search || '');

    if (filterModule && normalizeCode(record.module) !== filterModule) return false;
    if (filterSeverity && normalizePriority(record.severity) !== filterSeverity) return false;
    if (filterBranch && !normalizeText(record.branch).includes(filterBranch)) return false;
    if (search) {
      const searchable = normalizeText([
        record.title,
        record.message,
        record.entity_id,
        record.entity_type,
        record.action_hint,
      ].filter(Boolean).join(' '));
      if (!searchable.includes(search)) return false;
    }
    return true;
  });

  const totalCriticalRisk = filteredRecords.filter((record) => normalizePriority(record.severity) === 'CRITICAL').length;
  const totalWarningRisk = filteredRecords.filter((record) => normalizePriority(record.severity) === 'HIGH').length;

  return {
    summary: {
      businessHealthScore,
      businessHealthCategory: getHealthCategoryFromScore(businessHealthScore),
      cashDisciplineScore,
      cashDisciplineCategory: getHealthCategoryFromScore(cashDisciplineScore),
      totalRisk: filteredRecords.length,
      totalCriticalRisk,
      totalWarningRisk,
      totalActionRequired: ownerActionCenter.filter((action) => ['CRITICAL', 'HIGH'].includes(normalizePriority(action.severity))).length,
    },
    records: filteredRecords,
    branchRadar: {
      topBranches: safeArray(branchAnalytics.topBranchRevenue),
      problemBranches: worstBranches,
      lossBranches,
    },
    inventoryRadar: {
      stockOutRisk: criticalStock,
      deadStockRisk: deadStock,
      slowMovingProduct: lowStock,
    },
    financialRadar: {
      cashDeficitRisk: financialRiskCards[0],
      debtRisk: financialRiskCards[1],
      receivableRisk: financialRiskCards[2],
      riskCards: financialRiskCards,
    },
    salesRadar: {
      salesDropRisk: salesRiskCards[0],
      channelRisk: salesRiskCards[1],
      unsoldProductRisk: salesRiskCards[2],
      riskCards: salesRiskCards,
      problematicChannels,
    },
    ownerActionCenter,
    filters,
    metadata: {
      generated_at: new Date().toISOString(),
      readonly: true,
      source_api: 'getBusinessRadar',
      orchestrator_version: ORCHESTRATOR_VERSION,
      owner_analytics_source: 'getOwnerAnalytics',
      cashflow_source: 'getCashflowDashboard',
      total_before_filter: records.length,
      total_after_filter: filteredRecords.length,
    },
    warnings,
  };
};

/* =========================================================================
   SYSTEM HEALTH API - READ ONLY
   ========================================================================= */

export const getSystemHealth = (input = {}, context = {}) => {
  const source = resolveReadOnlySource(input, context);
  const filters = {
    branch: input.branch || input.branch_id || input.branchId || '',
    module: input.module || '',
    severity: input.severity || '',
    search: input.search || input.keyword || input.q || '',
    includeApiHealth: input.includeApiHealth !== false,
    includeDataQuality: input.includeDataQuality !== false,
    includeMasterHealth: input.includeMasterHealth !== false,
    includeAuditHealth: input.includeAuditHealth !== false,
  };

  const warnings = [];
  const records = [];

  const engineStatus = {
    getOwnerAnalytics: typeof getOwnerAnalytics === 'function',
    getAuditTrail: typeof getAuditTrail === 'function',
    getNotifications: typeof getNotifications === 'function',
    getSystemHealth: typeof getSystemHealth === 'function',
    getCashflowDashboard: typeof getCashflowDashboard === 'function',
    getBusinessRadar: typeof getBusinessRadar === 'function',
  };

  if (filters.includeApiHealth) {
    Object.entries(engineStatus).forEach(([apiName, available]) => {
      records.push(makeIntelligenceRecord({
        id: `API-${normalizeCode(apiName)}`,
        category: 'API_HEALTH',
        module: 'SYSTEM',
        severity: available ? 'INFO' : 'CRITICAL',
        status: available ? 'PASSED' : 'FAILED',
        title: available ? `${apiName} tersedia` : `${apiName} belum tersedia`,
        message: available
          ? `Public API ${apiName} sudah dapat dipanggil dari orchestrator.`
          : `Public API ${apiName} belum tersedia di orchestrator.`,
        action_hint: available ? 'Tidak ada aksi.' : 'Tambahkan API ke orchestrator dan default export.',
        reference_key: apiName,
        metadata: { apiName, available },
      }));
    });
  }

  const branchesResult = getBranches(source, { includeInactive: true, includeDeleted: false });
  const productsResult = getProducts(source, { includeInactive: true, includeDeleted: false });
  const customersResult = getCustomers(source, { includeInactive: true, includeDeleted: false });
  const suppliersResult = getSuppliers(source, { includeInactive: true, includeDeleted: false });
  const warehousesResult = getWarehouses(source, { includeInactive: true, includeDeleted: false });
  const accountsResult = getChartOfAccounts(source, { includeInactive: true, includeDeleted: false });

  warnings.push(
    ...safeArray(branchesResult.warnings),
    ...safeArray(productsResult.warnings),
    ...safeArray(customersResult.warnings),
    ...safeArray(suppliersResult.warnings),
    ...safeArray(warehousesResult.warnings),
    ...safeArray(accountsResult.warnings),
  );

  const sourceRows = extractOwnerAnalyticsSourceRows(source);
  const dataQuality = {
    branches: safeArray(branchesResult.records).length,
    products: safeArray(productsResult.records).length,
    customers: safeArray(customersResult.records).length,
    suppliers: safeArray(suppliersResult.records).length,
    warehouses: safeArray(warehousesResult.records).length,
    chartOfAccounts: safeArray(accountsResult.records).length,
    inventory: safeArray(sourceRows.inventoryRows).length,
    sales: safeArray(sourceRows.salesRows).length,
    purchases: safeArray(sourceRows.purchaseRows).length,
    cashflow: safeArray(sourceRows.cashRows).length,
    auditTrail: 0,
  };

  if (filters.includeMasterHealth || filters.includeDataQuality) {
    [
      ['branches', dataQuality.branches, 'MASTER_BRANCH', 'Master cabang kosong.'],
      ['products', dataQuality.products, 'MASTER_PRODUCT', 'Master produk kosong.'],
      ['customers', dataQuality.customers, 'MASTER_CUSTOMER', 'Master customer kosong.'],
      ['suppliers', dataQuality.suppliers, 'MASTER_SUPPLIER', 'Master supplier kosong.'],
      ['warehouses', dataQuality.warehouses, 'MASTER_WAREHOUSE', 'Master gudang kosong.'],
      ['chartOfAccounts', dataQuality.chartOfAccounts, 'ACCOUNTING', 'Chart of accounts kosong.'],
    ].forEach(([key, count, moduleName, emptyMessage]) => {
      const isEmpty = safeNumber(count, 0) === 0;
      records.push(makeIntelligenceRecord({
        id: `DATA-${normalizeCode(key)}`,
        category: 'DATA_QUALITY',
        module: moduleName,
        severity: isEmpty ? 'WARNING' : 'INFO',
        status: isEmpty ? 'WARNING' : 'PASSED',
        title: `${key} count: ${count}`,
        message: isEmpty ? emptyMessage : `${key} tersedia dan terbaca.`,
        action_hint: isEmpty ? 'Lengkapi master data terkait.' : 'Tidak ada aksi.',
        reference_key: key,
        metadata: { count },
      }));
    });
  }

  let auditTrail = null;
  if (filters.includeAuditHealth && typeof getAuditTrail === 'function') {
    try {
      auditTrail = getAuditTrail({}, {
        ...context,
        source,
        dbData: source,
        readonly: true,
      });
      dataQuality.auditTrail = safeArray(auditTrail.records).length;
      warnings.push(...safeArray(auditTrail.warnings));

      records.push(makeIntelligenceRecord({
        id: 'AUDIT-TRAIL-READINESS',
        category: 'AUDIT_HEALTH',
        module: 'AUDIT',
        severity: dataQuality.auditTrail === 0 ? 'WARNING' : 'INFO',
        status: dataQuality.auditTrail === 0 ? 'WARNING' : 'PASSED',
        title: 'Audit Trail Readiness',
        message: dataQuality.auditTrail === 0
          ? 'Audit trail belum memiliki record.'
          : `Audit trail terbaca dengan ${dataQuality.auditTrail} record.`,
        action_hint: dataQuality.auditTrail === 0
          ? 'Pastikan setiap modul transaksi menyimpan audit log/snapshot.'
          : 'Lanjutkan governance monitoring.',
        reference_key: 'getAuditTrail',
        metadata: {
          audit_summary: auditTrail.summary || {},
        },
      }));
    } catch (error) {
      records.push(makeIntelligenceRecord({
        id: 'AUDIT-TRAIL-ERROR',
        category: 'AUDIT_HEALTH',
        module: 'AUDIT',
        severity: 'CRITICAL',
        status: 'FAILED',
        title: 'Audit Trail Error',
        message: error?.message || 'getAuditTrail gagal dibaca.',
        action_hint: 'Audit implementasi getAuditTrail di orchestrator.',
        reference_key: 'getAuditTrail',
        metadata: {},
      }));
    }
  }

  const filterModule = normalizeFilterValue(filters.module || '');
  const filterSeverity = normalizeFilterValue(filters.severity || '');
  const search = normalizeText(filters.search || '');

  const filteredRecords = records.filter((record) => {
    if (filterModule && normalizeCode(record.module) !== filterModule) return false;
    if (filterSeverity && normalizeCode(record.severity) !== filterSeverity) return false;
    if (search) {
      const searchable = normalizeText([
        record.title,
        record.message,
        record.action_hint,
        record.reference_key,
        record.module,
        record.category,
      ].filter(Boolean).join(' '));
      if (!searchable.includes(search)) return false;
    }
    return true;
  });

  const totalChecks = filteredRecords.length;
  const totalPassed = filteredRecords.filter((record) => normalizeCode(record.status) === 'PASSED').length;
  const totalWarning = filteredRecords.filter((record) => ['WARNING', 'HIGH'].includes(normalizeCode(record.severity))).length;
  const totalCritical = filteredRecords.filter((record) => normalizeCode(record.severity) === 'CRITICAL').length;
  const totalMissingApi = Object.values(engineStatus).filter((available) => !available).length;
  const totalDataIssue = filteredRecords.filter((record) => normalizeCode(record.category) === 'DATA_QUALITY' && normalizeCode(record.status) !== 'PASSED').length;

  let healthScore = 100;
  healthScore -= totalCritical * 20;
  healthScore -= totalWarning * 8;
  healthScore -= totalMissingApi * 15;
  healthScore -= totalDataIssue * 5;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  const healthStatus = totalCritical > 0
    ? 'CRITICAL'
    : totalWarning > 0 || totalMissingApi > 0 || totalDataIssue > 0
      ? 'WARNING'
      : 'HEALTHY';

  return {
    summary: {
      healthScore,
      healthStatus,
      totalChecks,
      totalPassed,
      totalWarning,
      totalCritical,
      totalMissingApi,
      totalDataIssue,
    },
    records: filteredRecords,
    engineStatus,
    dataQuality,
    filters,
    metadata: {
      generated_at: new Date().toISOString(),
      readonly: true,
      source_api: 'getSystemHealth',
      orchestrator_version: ORCHESTRATOR_VERSION,
      total_before_filter: records.length,
      total_after_filter: filteredRecords.length,
    },
    warnings,
  };
};

/* =========================================================================
   NOTIFICATION CENTER API - READ ONLY
   ========================================================================= */

export const getNotifications = (input = {}, context = {}) => {
  const source = resolveReadOnlySource(input, context);
  const dateFilters = getIntelligenceDateFilters(input);
  const filters = {
    ...dateFilters,
    priority: input.priority || '',
    module: input.module || '',
    branch: input.branch || input.branch_id || input.branchId || '',
    status: input.status || '',
    type: input.type || input.notification_type || input.notificationType || '',
    search: input.search || input.keyword || input.q || '',
    includeResolved: input.includeResolved === true,
  };

  const warnings = [];
  const records = [];

  const ownerAnalytics = getIntelligenceOwnerAnalytics(input, context);
  warnings.push(...safeArray(ownerAnalytics.warnings));

  const businessRadar = getBusinessRadar(input, context);
  warnings.push(...safeArray(businessRadar.warnings));

  const systemHealth = getSystemHealth({
    ...input,
    includeAuditHealth: false,
  }, context);
  warnings.push(...safeArray(systemHealth.warnings));

  getSourceNotificationRows(source)
    .filter((row) => !isDeletedRow(row))
    .forEach((row, index) => {
      records.push(normalizeExistingNotificationRow(row, index));
    });

  safeArray(ownerAnalytics.inventoryAnalytics?.criticalStock).forEach((item, index) => {
    records.push(makeNotificationRecord({
      id: `NTF-STOCK-KRITIS-${item.item_id || index}`,
      priority: 'HIGH',
      module: 'INVENTORY',
      branch: item.branch_id || '',
      type: 'STOK_KRITIS',
      title: 'Stok Kritis',
      message: `${item.item_name || item.item_id || 'Item'} berada pada stok kritis.`,
      entity_type: 'INVENTORY_ITEM',
      entity_id: item.item_id || item.item_name || '',
      action_hint: 'Cek purchasing, produksi, atau transfer stok.',
      metadata: item,
    }));
  });

  if (safeNumber(ownerAnalytics.payableAnalytics?.overduePayable, 0) > 0) {
    records.push(makeNotificationRecord({
      id: 'NTF-HUTANG-JATUH-TEMPO',
      priority: 'HIGH',
      module: 'PAYABLE',
      type: 'HUTANG_JATUH_TEMPO',
      title: 'Hutang Jatuh Tempo',
      message: 'Ada hutang supplier yang sudah melewati jatuh tempo.',
      amount: ownerAnalytics.payableAnalytics.overduePayable,
      entity_type: 'PAYABLE',
      entity_id: 'OVERDUE_PAYABLE',
      action_hint: 'Prioritaskan pembayaran supplier penting dan negosiasi tempo.',
      metadata: ownerAnalytics.payableAnalytics,
    }));
  }

  if (safeNumber(ownerAnalytics.receivableAnalytics?.overdueReceivable, 0) > 0) {
    records.push(makeNotificationRecord({
      id: 'NTF-PIUTANG-OVERDUE',
      priority: 'HIGH',
      module: 'RECEIVABLE',
      type: 'PIUTANG_OVERDUE',
      title: 'Piutang Overdue',
      message: 'Ada piutang customer yang melewati jatuh tempo.',
      amount: ownerAnalytics.receivableAnalytics.overdueReceivable,
      entity_type: 'RECEIVABLE',
      entity_id: 'OVERDUE_RECEIVABLE',
      action_hint: 'Segera tagih top debtor dan invoice aging tertua.',
      metadata: ownerAnalytics.receivableAnalytics,
    }));
  }

  if (safeNumber(ownerAnalytics.cashflowAnalytics?.cashPosition, 0) < 0) {
    records.push(makeNotificationRecord({
      id: 'NTF-KAS-RENDAH',
      priority: 'CRITICAL',
      module: 'CASHFLOW',
      type: 'KAS_RENDAH',
      title: 'Kas Rendah',
      message: 'Cash position negatif atau di bawah batas aman.',
      amount: ownerAnalytics.cashflowAnalytics.cashPosition,
      entity_type: 'CASHFLOW',
      entity_id: 'CASH_POSITION',
      action_hint: 'Tahan pengeluaran non-esensial dan percepat collection.',
      metadata: ownerAnalytics.cashflowAnalytics,
    }));
  }

  if (safeNumber(ownerAnalytics.summary?.netProfit, 0) < 0) {
    records.push(makeNotificationRecord({
      id: 'NTF-MARGIN-NEGATIF',
      priority: 'CRITICAL',
      module: 'PROFIT',
      type: 'MARGIN_NEGATIF',
      title: 'Margin Negatif',
      message: 'Net profit periode ini negatif.',
      amount: ownerAnalytics.summary.netProfit,
      entity_type: 'PROFIT',
      entity_id: 'NET_PROFIT',
      action_hint: 'Evaluasi HPP, diskon, biaya operasional, dan channel rugi.',
      metadata: ownerAnalytics.summary,
    }));
  }

  const lowMarginProducts = safeArray(ownerAnalytics.productAnalytics?.lowMarginProducts);
  if (lowMarginProducts.some((product) => safeNumber(product.profitMargin, 0) < 10)) {
    records.push(makeNotificationRecord({
      id: 'NTF-HPP-NAIK-DRASTIS',
      priority: 'MEDIUM',
      module: 'HPP',
      type: 'HPP_NAIK_DRASTIS',
      title: 'HPP / Margin Perlu Dicek',
      message: 'Ada produk dengan margin terlalu kecil. Bisa disebabkan HPP naik atau harga jual terlalu rendah.',
      entity_type: 'PRODUCT',
      entity_id: 'LOW_MARGIN_PRODUCTS',
      action_hint: 'Cek BOM, FIFO layer, harga bahan baku, dan harga jual.',
      metadata: { lowMarginProducts },
    }));
  }

  if (safeArray(ownerAnalytics.productAnalytics?.topProducts).length === 0) {
    records.push(makeNotificationRecord({
      id: 'NTF-PRODUK-TIDAK-LAKU',
      priority: 'MEDIUM',
      module: 'SALES',
      type: 'PRODUK_TIDAK_LAKU',
      title: 'Produk Tidak Laku',
      message: 'Belum ada produk terjual pada periode aktif.',
      entity_type: 'PRODUCT',
      entity_id: 'NO_TOP_PRODUCT',
      action_hint: 'Cek traffic penjualan, promo, dan visibility produk.',
      metadata: { productAnalytics: ownerAnalytics.productAnalytics },
    }));
  }

  safeArray(businessRadar.records).forEach((radarRecord) => {
    records.push(makeNotificationRecord({
      id: `NTF-RADAR-${radarRecord.id}`,
      priority: radarRecord.severity || 'MEDIUM',
      module: radarRecord.module || 'BUSINESS_RADAR',
      branch: radarRecord.branch || '',
      type: radarRecord.radar_type || 'BUSINESS_RADAR',
      title: radarRecord.title,
      message: radarRecord.message,
      amount: radarRecord.metric_value || 0,
      reference_number: radarRecord.reference_number || '',
      entity_type: radarRecord.entity_type || '',
      entity_id: radarRecord.entity_id || '',
      action_hint: radarRecord.action_hint || '',
      metadata: radarRecord.metadata || {},
    }));
  });

  safeArray(systemHealth.records)
    .filter((record) => ['CRITICAL', 'WARNING'].includes(normalizeCode(record.severity)))
    .forEach((healthRecord) => {
      records.push(makeNotificationRecord({
        id: `NTF-SYSTEM-${healthRecord.id}`,
        priority: normalizeCode(healthRecord.severity) === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM',
        module: healthRecord.module || 'SYSTEM',
        type: 'SYSTEM_HEALTH',
        title: healthRecord.title,
        message: healthRecord.message,
        reference_number: healthRecord.reference_key || '',
        entity_type: healthRecord.category || 'SYSTEM_HEALTH',
        entity_id: healthRecord.reference_key || healthRecord.id,
        action_hint: healthRecord.action_hint || '',
        metadata: healthRecord.metadata || {},
      }));
    });

  const dedupeMap = new Map();
  records.forEach((record) => {
    const key = [record.id, record.type, record.entity_type, record.entity_id, record.title].map(normalizeCode).join('|');
    if (!dedupeMap.has(key)) dedupeMap.set(key, record);
  });

  const allRecords = Array.from(dedupeMap.values()).sort((a, b) => {
    const priorityScore = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const aPriority = priorityScore[normalizePriority(a.priority)] || 0;
    const bPriority = priorityScore[normalizePriority(b.priority)] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    return String(b.timestamp).localeCompare(String(a.timestamp));
  });

  const filteredRecords = allRecords.filter((record) => {
    if (!filters.includeResolved && normalizeNotificationStatus(record.status) === 'RESOLVED') return false;
    return notificationMatchesFilters(record, filters);
  });

  const limit = safeNumber(input.limit || input.max_results || input.maxResults, 0);
  const finalRecords = limit > 0 ? filteredRecords.slice(0, limit) : filteredRecords;

  if (finalRecords.length === 0) {
    warnings.push(makeWarning('NOTIFICATIONS_EMPTY', 'Tidak ada notifikasi untuk filter aktif.'));
  }

  return {
    summary: buildNotificationSummary(finalRecords),
    records: finalRecords,
    filters: {
      active: filters,
      options: {
        priorities: INTELLIGENCE_NOTIFICATION_PRIORITIES,
        statuses: INTELLIGENCE_NOTIFICATION_STATUSES,
        modules: uniqueSortedValues(allRecords, 'module'),
        types: uniqueSortedValues(allRecords, 'type'),
        branches: uniqueSortedValues(allRecords, 'branch'),
      },
    },
    metadata: {
      generated_at: new Date().toISOString(),
      readonly: true,
      source_api: 'getNotifications',
      orchestrator_version: ORCHESTRATOR_VERSION,
      total_before_filter: allRecords.length,
      total_after_filter: filteredRecords.length,
      total_returned: finalRecords.length,
      source_rows_count: getSourceNotificationRows(source).length,
      owner_analytics_source: 'getOwnerAnalytics',
      business_radar_source: 'getBusinessRadar',
      system_health_source: 'getSystemHealth',
    },
    warnings,
  };
};

/* =========================================================================
   MASTER DATA ORCHESTRATION API
   ========================================================================= */

export const masterData = Object.freeze({
  getBranches,
  getBranchById,

  getWarehouses,
  getWarehouseById,

  getCustomers,
  getCustomerById,

  getSuppliers,
  getSupplierById,

  getProducts,
  getProductById,

  getRawMaterials,
  getRawMaterialById,

  getEmployees,
  getEmployeeById,

  getChartOfAccounts,
  getAccountByCode,

  getKewajiban,
  getKewajibanById,

  searchMaster,
  createMasterSnapshot,
});

/* =========================================================================
   ENGINE HEALTH CHECK
   ========================================================================= */

export const getEngineHealth = (source = {}, options = {}) => {
  const warnings = [];

  const masterSummary = getMasterSummary(source, options);
  warnings.push(...masterSummary.warnings);

  const conversionSnapshot = createConversionSnapshot(source, {
    branchId: options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE,
  });

  const bomProbe = getActiveBom(source, {
    branchId: options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE,
    asOfDate: getTodayISO(),
  });

  warnings.push(...bomProbe.warnings);

  const inventoryItems = listLayerItems(source, options);

  const healthSnapshot = createOrchestratorSnapshot({
    process_type: 'ENGINE_HEALTH',
    transaction_id: generateId('ENG-HEALTH'),
    transaction_type: 'ENGINE_HEALTH_CHECK',
    branch_id: options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE,
    created_by: options.createdBy || options.created_by || 'SYSTEM',
    package_summary: {
      master_summary_ok: masterSummary.ok,
      conversion_rules_count: conversionSnapshot.rules_count || conversionSnapshot.payload?.rules_count || 0,
      bom_available: Boolean(bomProbe.bom),
      inventory_item_count: inventoryItems.length,
    },
    package_payload: {
      master_summary: masterSummary.summary,
      conversion_snapshot: conversionSnapshot,
      bom_probe: bomProbe.bom,
      inventory_items: inventoryItems,
    },
    warnings,
  }, options);

  warnings.push(...healthSnapshot.warnings);

  return {
    ok: true,
    engine_health: {
      generated_at: new Date().toISOString(),
      orchestrator_version: ORCHESTRATOR_VERSION,
      master_summary: masterSummary.summary,
      conversion_snapshot: conversionSnapshot,
      bom_probe: bomProbe.bom,
      inventory_item_count: inventoryItems.length,
      health_snapshot: healthSnapshot.snapshot || null,
    },
    warnings,
  };
};

/* =========================================================================
   DEFAULT EXPORT
   ========================================================================= */

export default {
  processPurchase,
  processProduction,
  processSales,
  processExpense,

  processPayment,
  processReceivablePayment,
  processPayablePayment,
  processCashTransaction,
  processTransferTransaction,
  processKasbon,
  processKewajiban,

  processAdjustment,
  processVoidTransaction,

  getAuditTrail,
  getCashflowDashboard,
  getBusinessRadar,
  getSystemHealth,
  getNotifications,
  getOwnerAnalytics,
  getDashboardSummary,
  getBranchDashboard,
  getConsolidatedDashboard,
  getProfitDashboard,
  getInventoryDashboard,

  masterData,
  getEngineHealth,

  PROCESS_STATUS,
  PROCESS_TYPES,
};
