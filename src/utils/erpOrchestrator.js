  /**
   * ERP DIMSUM ADITYA V2
   * Service Layer: erpOrchestrator.js
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
  } from '../utils/masterDataEngine';
  
  import {
    normalizeBranchId,
    createConversionSnapshot,
  } from '../utils/conversionEngine';
  
  import {
    getActiveBom,
    createBomSnapshot,
  } from '../utils/bomEngine';
  
  import {
    getLayerBalance,
    listLayerItems,
    calculateConsumptionCost,
  } from '../utils/inventoryLayerEngine';
  
  import {
    calculateOrderHpp,
    calculateProductionHpp,
  } from '../utils/hppEngine';
  
  import {
    createProductionBatch,
    simulateProduction,
    reverseProduction,
  } from '../utils/productionEngine';
  
  import {
    receivePurchase,
    createPurchaseOrder,
    reversePurchase,
  } from '../utils/purchaseEngine';
  
  import {
    createSalesOrder,
    reverseSales,
  } from '../utils/salesEngine';
  
  import {
    createPurchaseJournal,
    createSalesJournal,
    createProductionJournal,
    createExpenseJournal,
    createPaymentJournal,
    createAdjustmentJournal,
    reverseJournal,
    createTrialBalance,
  } from '../utils/accountingEngine';
  
  import {
    calculateBranchProfit,
    calculateConsolidatedProfit,
    calculateProfitByChannel,
    calculateProfitByProduct,
    calculateProfitByCustomer,
    createProfitSnapshot,
  } from '../utils/profitEngine';
  
  import {
    createSnapshot,
    lockSnapshot,
    mergeSnapshots,
    createTransactionSnapshot,
    readSnapshot,
  } from '../utils/snapshotEngine';
  
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
  
  const safeArray = (value) => {
    return Array.isArray(value) ? value : [];
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
      'batch_header',
      'journal_header',
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
      journal_package: accountingResult.journal_package || null,
  
      orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
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
      journal_package: accountingResult.journal_package || null,
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
  
      production_simulation: productionSimulation.simulation || null,
      production_hpp_preview: productionHppPreview,
  
      orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
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
      journal_package: accountingResult.journal_package || null,
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
      dateFrom: input.order_date || input.orderDate || input.date || '',
      dateTo: input.order_date || input.orderDate || input.date || '',
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
      transaction_id: salesPackage?.order_header?.order_id || generateId('ORCH-SALES'),
      transaction_type: 'PROCESS_SALES',
      branch_id: input.branch_id || input.branchId || options.branchId,
      created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
      package_summary: {
        sales_ok: salesResult.ok,
        accounting_ok: accountingResult.ok,
        profit_ok: profitResult.ok,
        hpp_audit_ok: hppAudit.ok,
        order_id: salesPackage?.order_header?.order_id || '',
        total_revenue: salesPackage?.order_header?.total_revenue || 0,
        total_hpp: salesPackage?.order_header?.total_hpp || 0,
        gross_profit: salesPackage?.order_header?.gross_profit || 0,
        gross_margin_pct: salesPackage?.order_header?.gross_margin_pct || 0,
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
      transactionId: salesPackage?.order_header?.order_id || '',
      transactionType: 'SALES_ORCHESTRATED',
      createdBy: input.created_by || input.createdBy || input.operator || options.createdBy,
    });
  
    warnings.push(...compositeSnapshot.warnings);
  
    const transactionPackage = {
      package_type: 'ORCHESTRATED_SALES_PACKAGE',
      package_version: ORCHESTRATOR_VERSION,
      generated_at: new Date().toISOString(),
  
      sales_transaction_package: salesPackage,
      journal_package: accountingResult.journal_package || null,
      profit_package: profitResult.profit_package || null,
      hpp_audit: hppAudit,
  
      orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
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
      journal_package: accountingResult.journal_package || null,
      profit_package: profitResult.profit_package || null,
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
      expense_snapshot: expenseSnapshot.snapshot || null,
      orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
  
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
      warnings,
    };
  };
  
  /* =========================================================================
     PROCESS PAYMENT / KASBON / KEWAJIBAN
     ========================================================================= */
  
  const normalizePaymentInput = (input = {}, context = {}, forcedType = '') => {
    const options = buildEngineOptions(context, input);
  
    const paymentId = input.payment_id || input.paymentId || input.id || generateId('PAY');
    const amount = safeNumber(input.amount || input.nominal || input.nominal_dibayar, 0);
  
    return {
      id: paymentId,
      payment_id: paymentId,
  
      date: normalizeDateString(input.payment_date || input.paymentDate || input.tanggal_bayar || input.date || getTodayISO()),
      payment_date: normalizeDateString(input.payment_date || input.paymentDate || input.tanggal_bayar || input.date || getTodayISO()),
  
      branch_id: normalizeBranchId(input.branch_id || input.branchId || options.branchId),
  
      payment_type: normalizeCode(forcedType || input.payment_type || input.paymentType || input.type || input.category || ''),
      category: normalizeCode(input.category || forcedType || input.payment_type || input.type || ''),
  
      amount: roundMoney(amount),
      nominal: roundMoney(amount),
      nominal_dibayar: roundMoney(amount),
  
      payment_method: normalizeCode(input.payment_method || input.paymentMethod || input.method || ''),
  
      reference_table: input.reference_table || input.referenceTable || '',
      reference_id: input.reference_id || input.referenceId || input.order_id || input.purchase_id || input.kewajiban_id || '',
  
      customer_id: input.customer_id || input.customerId || '',
      customer_name: input.customer_name || input.customerName || '',
      supplier_id: input.supplier_id || input.supplierId || '',
      supplier_name: input.supplier_name || input.supplierName || '',
      employee_id: input.employee_id || input.employeeId || input.karyawan_id || '',
      employee_name: input.employee_name || input.employeeName || input.nama_karyawan || '',
  
      description: input.description || input.notes || input.keterangan || '',
  
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
      snapshot_type: 'PAYMENT',
      transaction_id: payment.payment_id,
      transaction_type: payment.payment_type || 'PAYMENT',
      branch_id: payment.branch_id,
      created_by: payment.created_by,
      transaction_header: payment,
      transaction_items: [],
      payment_snapshot: {
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
      payment_snapshot: paymentSnapshot.snapshot || null,
      orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
  
      status: warnings.some((warning) => warning.code === 'INVALID_BRANCH' || warning.code === 'INVALID_PAYMENT_AMOUNT') || !accountingResult.ok
        ? PROCESS_STATUS.BLOCKED
        : PROCESS_STATUS.SUCCESS,
  
      warnings,
    };
  
    return {
      ok: paymentPackage.status === PROCESS_STATUS.SUCCESS,
      transaction_package: paymentPackage,
      payment_package: paymentPackage,
      journal_package: accountingResult.journal_package || null,
      warnings,
    };
  };

export const processPayablePayment = (input = {}, context = {}) => {
  return processPayment(
    {
      ...(input || {}),
      payment_type: 'PAYABLE',
      category: 'HUTANG_SUPPLIER',
    },
    context,
  );
};

  export const processKasbon = (input = {}, context = {}) => {
    const result = processPayment({
      ...input,
      payment_type: 'KASBON',
      category: 'KASBON',
    }, context);
  
    return {
      ...result,
      transaction_package: {
        ...result.transaction_package,
        package_type: 'ORCHESTRATED_KASBON_PACKAGE',
      },
    };
  };
  
  export const processKewajiban = (input = {}, context = {}) => {
    const result = processPayment({
      ...input,
      payment_type: 'PAYABLE',
      category: 'KEWAJIBAN',
    }, context);
  
    return {
      ...result,
      transaction_package: {
        ...result.transaction_package,
        package_type: 'ORCHESTRATED_KEWAJIBAN_PACKAGE',
      },
    };
  };
  
  /* =========================================================================
     PROCESS ADJUSTMENT
     ========================================================================= */
  
  export const processAdjustment = (input = {}, context = {}) => {
    const warnings = [];
    const options = buildEngineOptions(context, input);
    const accountingOptions = buildAccountingOptions(context, input);
  
    const adjustmentId = input.adjustment_id || input.adjustmentId || input.id || generateId('ADJ');
  
    const adjustment = {
      id: adjustmentId,
      adjustment_id: adjustmentId,
  
      date: normalizeDateString(input.adjustment_date || input.adjustmentDate || input.date || getTodayISO()),
      adjustment_date: normalizeDateString(input.adjustment_date || input.adjustmentDate || input.date || getTodayISO()),
  
      branch_id: normalizeBranchId(input.branch_id || input.branchId || options.branchId),
  
      direction: normalizeCode(input.direction || input.adjustment_type || input.adjustmentType || input.type || ''),
      adjustment_type: normalizeCode(input.adjustment_type || input.adjustmentType || input.direction || input.type || ''),
  
      amount: roundMoney(input.amount || input.total_amount || input.totalAmount || 0),
  
      description: input.description || input.notes || input.keterangan || '',
      created_at: new Date().toISOString(),
      created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
      isDeleted: false,
    };
  
    if (!adjustment.branch_id || adjustment.branch_id === DEFAULT_BRANCH_SCOPE) {
      warnings.push(makeWarning('INVALID_BRANCH', 'branch_id adjustment tidak valid atau masih GLOBAL.', {
        branch_id: adjustment.branch_id,
      }));
    }
  
    if (adjustment.amount <= 0) {
      warnings.push(makeWarning('INVALID_ADJUSTMENT_AMOUNT', 'Nominal adjustment harus lebih dari 0.', {
        amount: adjustment.amount,
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
        direction: adjustment.direction,
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
  
      adjustment_header: {
        ...adjustment,
        adjustment_snapshot_json: adjustmentSnapshot.snapshot ? JSON.stringify(adjustmentSnapshot.snapshot) : '',
      },
  
      journal_package: accountingResult.journal_package || null,
      adjustment_snapshot: adjustmentSnapshot.snapshot || null,
      orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
  
      status: warnings.some((warning) => warning.code === 'INVALID_BRANCH' || warning.code === 'INVALID_ADJUSTMENT_AMOUNT') || !accountingResult.ok
        ? PROCESS_STATUS.BLOCKED
        : PROCESS_STATUS.SUCCESS,
  
      warnings,
    };
  
    return {
      ok: adjustmentPackage.status === PROCESS_STATUS.SUCCESS,
      transaction_package: adjustmentPackage,
      adjustment_package: adjustmentPackage,
      journal_package: accountingResult.journal_package || null,
      warnings,
    };
  };
  
  /* =========================================================================
     PROCESS VOID TRANSACTION
     ========================================================================= */
  
  const inferVoidTargetType = (input = {}) => {
    const explicitType = normalizeCode(input.target_type || input.targetType || input.transaction_type || input.transactionType || input.package_type || '');
  
    if (explicitType.includes('PURCHASE')) return 'PURCHASE';
    if (explicitType.includes('PRODUCTION')) return 'PRODUCTION';
    if (explicitType.includes('SALES') || explicitType.includes('ORDER') || explicitType.includes('INVOICE')) return 'SALES';
    if (explicitType.includes('JOURNAL') || explicitType.includes('ACCOUNTING')) return 'JOURNAL';
  
    if (input.purchase_transaction_package || input.purchaseTransactionPackage || input.purchase_header) return 'PURCHASE';
    if (input.production_batch_package || input.productionBatchPackage || input.batch_header) return 'PRODUCTION';
    if (input.sales_transaction_package || input.salesTransactionPackage || input.order_header) return 'SALES';
    if (input.journal_package || input.journalPackage || input.journal_header) return 'JOURNAL';
  
    return 'UNKNOWN';
  };
  
  export const processVoidTransaction = (input = {}, context = {}) => {
    const warnings = [];
    const options = buildEngineOptions(context, input);
    const accountingOptions = buildAccountingOptions(context, input);
  
    const targetType = inferVoidTargetType(input);
  
    let businessReversal = null;
  
    if (targetType === 'PURCHASE') {
      businessReversal = reversePurchase(input, options);
    } else if (targetType === 'PRODUCTION') {
      businessReversal = reverseProduction(input, options);
    } else if (targetType === 'SALES') {
      businessReversal = reverseSales(input, options);
    } else if (targetType === 'JOURNAL') {
      businessReversal = reverseJournal(input, accountingOptions);
    } else {
      businessReversal = {
        ok: false,
        warnings: [
          makeWarning('UNKNOWN_VOID_TARGET', 'Jenis transaksi void tidak dikenali oleh orchestrator.', {
            target_type: targetType,
          }),
        ],
      };
    }
  
    warnings.push(...businessReversal.warnings);
  
    const originalJournalPackage =
      input.journal_package ||
      input.journalPackage ||
      input.accounting_package ||
      input.accountingPackage ||
      null;
  
    const journalReversal = originalJournalPackage && targetType !== 'JOURNAL'
      ? reverseJournal(originalJournalPackage, accountingOptions)
      : null;
  
    if (journalReversal) {
      warnings.push(...journalReversal.warnings);
    }
  
    const reversalPackage =
      businessReversal.purchase_reversal_package ||
      businessReversal.production_reversal_package ||
      businessReversal.sales_reversal_package ||
      businessReversal.journal_package ||
      null;
  
    const orchestratorSnapshot = createOrchestratorSnapshot({
      process_type: PROCESS_TYPES.VOID,
      transaction_id: input.reversal_id || input.reversalId || generateId('ORCH-VOID'),
      transaction_type: 'PROCESS_VOID_TRANSACTION',
      branch_id: input.branch_id || input.branchId || options.branchId,
      created_by: input.created_by || input.createdBy || input.operator || options.createdBy,
      package_summary: {
        target_type: targetType,
        business_reversal_ok: businessReversal.ok,
        journal_reversal_ok: journalReversal ? journalReversal.ok : null,
      },
      package_payload: {
        business_reversal: reversalPackage,
        journal_reversal: journalReversal?.journal_package || null,
      },
      warnings,
    }, options);
  
    warnings.push(...orchestratorSnapshot.warnings);
  
    const voidPackage = {
      package_type: 'ORCHESTRATED_VOID_PACKAGE',
      package_version: ORCHESTRATOR_VERSION,
      generated_at: new Date().toISOString(),
  
      target_type: targetType,
  
      business_reversal: reversalPackage,
      journal_reversal: journalReversal?.journal_package || null,
  
      orchestrator_snapshot: orchestratorSnapshot.snapshot || null,
  
      status: businessReversal.ok && (!journalReversal || journalReversal.ok)
        ? PROCESS_STATUS.SUCCESS
        : PROCESS_STATUS.BLOCKED,
  
      warnings,
    };
  
    return {
      ok: voidPackage.status === PROCESS_STATUS.SUCCESS,
      transaction_package: voidPackage,
      void_package: voidPackage,
      warnings,
    };
  };
  
  /* =========================================================================
     INVENTORY DASHBOARD
     ========================================================================= */
  
  export const getInventoryDashboard = (source = {}, options = {}) => {
    const ctx = buildContext(options);
    const dataSource = source || ctx.dbData;
    const warnings = [];
  
    const itemList = listLayerItems(dataSource, {
      branchId: options.branchId || options.branch_id || ctx.branchId,
      warehouseId: options.warehouseId || options.warehouse_id || ctx.warehouseId,
    });
  
    const balances = itemList.map((item) => {
      const balance = getLayerBalance(dataSource, {
        itemId: item.item_id,
        itemName: item.item_name,
        branchId: options.branchId || options.branch_id || ctx.branchId,
        warehouseId: options.warehouseId || options.warehouse_id || ctx.warehouseId,
        franchiseId: options.franchiseId || options.franchise_id || '',
      });
  
      warnings.push(...balance.warnings);
  
      return {
        item_id: item.item_id,
        item_name: item.item_name,
        category: item.category || '',
        units: item.units || [],
        layer_count: item.layer_count || 0,
        total_value: roundMoney(balance.total_value || 0),
        by_unit: balance.by_unit || [],
        layers: balance.layers || [],
      };
    });
  
    const totalValue = roundMoney(
      balances.reduce((sum, row) => sum + safeNumber(row.total_value, 0), 0),
    );
  
    const dashboardSnapshot = createOrchestratorSnapshot({
      process_type: PROCESS_TYPES.DASHBOARD,
      transaction_id: generateId('INV-DASH'),
      transaction_type: 'INVENTORY_DASHBOARD',
      branch_id: options.branchId || options.branch_id || ctx.branchId,
      created_by: options.createdBy || options.created_by || ctx.createdBy,
      package_summary: {
        item_count: balances.length,
        total_inventory_value: totalValue,
      },
      package_payload: {
        balances,
      },
      warnings,
    }, {
      ...ctx,
      ...options,
    });
  
    warnings.push(...dashboardSnapshot.warnings);
  
    return {
      ok: true,
      inventory_dashboard: {
        generated_at: new Date().toISOString(),
        branch_id: normalizeBranchId(options.branchId || options.branch_id || ctx.branchId),
        warehouse_id: normalizeWarehouseId(options.warehouseId || options.warehouse_id || ctx.warehouseId),
        item_count: balances.length,
        total_inventory_value: totalValue,
        balances,
        dashboard_snapshot: dashboardSnapshot.snapshot || null,
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
  
    const branchProfit = branchId && branchId !== DEFAULT_BRANCH_SCOPE && branchId !== 'ALL' && branchId !== 'CONSOLIDATED'
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
    processPayablePayment,
    processKasbon,
    processKewajiban,
    processAdjustment,
    processVoidTransaction,
  
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
