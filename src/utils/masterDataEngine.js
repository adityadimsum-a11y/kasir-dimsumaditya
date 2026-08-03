/**
 * ERP DIMSUM ADITYA V2
 * Foundation Engine: masterDataEngine.js
 *
 * Purpose:
 * - Single Source of Truth seluruh Master Data ERP Dimsum Aditya.
 * - Seluruh modul ERP harus membaca Master Data melalui engine ini.
 *
 * Supported Master:
 * - master_branch / master_branches
 * - master_warehouse / master_warehouses / master_locations
 * - master_customer / master_customers
 * - master_supplier / master_suppliers
 * - master_product / master_products
 * - master_raw_materials / masterRawMaterials
 * - master_recipe_bom / masterRecipeBom
 * - master_conversion_rules / masterConversionRules
 * - master_employee / master_employees / karyawan
 * - master_chart_of_accounts / chart_of_accounts
 * - master_kewajiban
 *
 * Important Principles:
 * - Engine ini TIDAK menyimpan data.
 * - Engine ini TIDAK update sheet.
 * - Engine ini TIDAK update database.
 * - Engine ini hanya membaca, menormalisasi, memvalidasi, mencari,
 *   dan membuat snapshot master.
 */

import {
  createSnapshot,
  lockSnapshot,
} from './snapshotEngine';

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const ENGINE_VERSION = 'ERP_DA_V2_MASTER_DATA_ENGINE_1';

const DEFAULT_BRANCH_SCOPE = 'GLOBAL';

export const MASTER_TYPES = Object.freeze({
  BRANCH: 'BRANCH',
  WAREHOUSE: 'WAREHOUSE',
  CUSTOMER: 'CUSTOMER',
  SUPPLIER: 'SUPPLIER',
  PRODUCT: 'PRODUCT',
  RAW_MATERIAL: 'RAW_MATERIAL',
  RECIPE_BOM: 'RECIPE_BOM',
  CONVERSION_RULE: 'CONVERSION_RULE',
  EMPLOYEE: 'EMPLOYEE',
  CHART_OF_ACCOUNTS: 'CHART_OF_ACCOUNTS',
  KEWAJIBAN: 'KEWAJIBAN',
  UNKNOWN: 'UNKNOWN',
});

const ACTIVE_STATUSES = new Set([
  'ACTIVE',
  'AKTIF',
  'ENABLE',
  'ENABLED',
  'OPEN',
  'READY',
  'PUBLISHED',
  'TRUE',
  'YES',
  'YA',
  'Y',
  '1',
]);

const INACTIVE_STATUSES = new Set([
  'NON_ACTIVE',
  'NONAKTIF',
  'INACTIVE',
  'DISABLED',
  'DISABLE',
  'CLOSED',
  'ARCHIVED',
  'FALSE',
  'NO',
  'TIDAK',
  'N',
  '0',
]);

const MASTER_CONFIG = Object.freeze({
  [MASTER_TYPES.BRANCH]: {
    aliases: ['BRANCH', 'MASTER_BRANCH', 'MASTER_BRANCHES', 'CABANG'],
    sourceKeys: [
      'master_branch',
      'master_branches',
      'masterBranch',
      'masterBranches',
      'branches',
      'branch_master',
    ],
    idFields: ['branch_id', 'branchId', 'id', 'kode_cabang', 'code'],
    codeFields: ['branch_code', 'branchCode', 'kode_cabang', 'code', 'kode'],
    nameFields: ['branch_name', 'branchName', 'nama_cabang', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'id'],
  },

  [MASTER_TYPES.WAREHOUSE]: {
    aliases: ['WAREHOUSE', 'MASTER_WAREHOUSE', 'MASTER_WAREHOUSES', 'LOCATION', 'MASTER_LOCATION', 'GUDANG'],
    sourceKeys: [
      'master_warehouse',
      'master_warehouses',
      'masterWarehouse',
      'masterWarehouses',
      'master_locations',
      'masterLocations',
      'warehouses',
      'locations',
      'gudang',
    ],
    idFields: ['warehouse_id', 'warehouseId', 'location_id', 'locationId', 'id', 'kode_gudang', 'code'],
    codeFields: ['warehouse_code', 'warehouseCode', 'location_code', 'locationCode', 'kode_gudang', 'code', 'kode'],
    nameFields: ['warehouse_name', 'warehouseName', 'location_name', 'locationName', 'nama_gudang', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },

  [MASTER_TYPES.CUSTOMER]: {
    aliases: ['CUSTOMER', 'MASTER_CUSTOMER', 'MASTER_CUSTOMERS', 'PELANGGAN'],
    sourceKeys: [
      'master_customer',
      'master_customers',
      'masterCustomer',
      'masterCustomers',
      'customers',
      'pelanggan',
    ],
    idFields: ['customer_id', 'customerId', 'id', 'kode_customer', 'code'],
    codeFields: ['customer_code', 'customerCode', 'kode_customer', 'code', 'kode'],
    nameFields: ['customer_name', 'customerName', 'nama_customer', 'nama_pelanggan', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },

  [MASTER_TYPES.SUPPLIER]: {
    aliases: ['SUPPLIER', 'MASTER_SUPPLIER', 'MASTER_SUPPLIERS', 'VENDOR'],
    sourceKeys: [
      'master_supplier',
      'master_suppliers',
      'masterSupplier',
      'masterSuppliers',
      'suppliers',
      'vendors',
    ],
    idFields: ['supplier_id', 'supplierId', 'id', 'kode_supplier', 'code'],
    codeFields: ['supplier_code', 'supplierCode', 'kode_supplier', 'code', 'kode'],
    nameFields: ['supplier_name', 'supplierName', 'nama_supplier', 'vendor_name', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },

  [MASTER_TYPES.PRODUCT]: {
    aliases: ['PRODUCT', 'MASTER_PRODUCT', 'MASTER_PRODUCTS', 'PRODUK', 'FINISHED_GOODS'],
    sourceKeys: [
      'master_product',
      'master_products',
      'masterProduct',
      'masterProducts',
      'products',
      'produk',
    ],
    idFields: ['product_id', 'productId', 'item_id', 'itemId', 'id', 'sku', 'code'],
    codeFields: ['product_code', 'productCode', 'item_code', 'itemCode', 'sku', 'code', 'kode'],
    nameFields: ['product_name', 'productName', 'item_name', 'itemName', 'nama_produk', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },

  [MASTER_TYPES.RAW_MATERIAL]: {
    aliases: ['RAW_MATERIAL', 'RAW_MATERIALS', 'MASTER_RAW_MATERIAL', 'MASTER_RAW_MATERIALS', 'BAHAN_BAKU'],
    sourceKeys: [
      'master_raw_material',
      'master_raw_materials',
      'masterRawMaterial',
      'masterRawMaterials',
      'raw_materials',
      'rawMaterials',
      'bahan_baku',
    ],
    idFields: ['raw_material_id', 'rawMaterialId', 'material_id', 'materialId', 'item_id', 'itemId', 'id', 'sku', 'code'],
    codeFields: ['raw_material_code', 'rawMaterialCode', 'material_code', 'materialCode', 'item_code', 'sku', 'code', 'kode'],
    nameFields: ['raw_material_name', 'rawMaterialName', 'material_name', 'materialName', 'item_name', 'itemName', 'nama_bahan', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },

  [MASTER_TYPES.RECIPE_BOM]: {
    aliases: ['RECIPE_BOM', 'MASTER_RECIPE_BOM', 'BOM', 'RECIPE'],
    sourceKeys: [
      'master_recipe_bom',
      'masterRecipeBom',
      'recipe_bom',
      'recipeBom',
      'bom',
      'recipes',
    ],
    idFields: ['recipe_id', 'recipeId', 'bom_id', 'bomId', 'id', 'recipe_code', 'code'],
    codeFields: ['recipe_code', 'recipeCode', 'bom_code', 'bomCode', 'code', 'kode'],
    nameFields: ['recipe_name', 'recipeName', 'bom_name', 'bomName', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },

  [MASTER_TYPES.CONVERSION_RULE]: {
    aliases: ['CONVERSION_RULE', 'CONVERSION_RULES', 'MASTER_CONVERSION_RULES', 'KONVERSI'],
    sourceKeys: [
      'master_conversion_rule',
      'master_conversion_rules',
      'masterConversionRule',
      'masterConversionRules',
      'conversion_rules',
      'conversionRules',
      'konversi',
    ],
    idFields: ['rule_id', 'ruleId', 'conversion_id', 'conversionId', 'id', 'kode_rule', 'code'],
    codeFields: ['kode_rule', 'rule_code', 'ruleCode', 'conversion_code', 'conversionCode', 'code', 'kode'],
    nameFields: ['nama_rule', 'rule_name', 'ruleName', 'conversion_name', 'conversionName', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },

  [MASTER_TYPES.EMPLOYEE]: {
    aliases: ['EMPLOYEE', 'MASTER_EMPLOYEE', 'MASTER_EMPLOYEES', 'KARYAWAN', 'SDM'],
    sourceKeys: [
      'master_employee',
      'master_employees',
      'masterEmployee',
      'masterEmployees',
      'employees',
      'karyawan',
      'sdm',
    ],
    idFields: ['employee_id', 'employeeId', 'karyawan_id', 'karyawanId', 'id', 'nik', 'code'],
    codeFields: ['employee_code', 'employeeCode', 'kode_karyawan', 'nik', 'code', 'kode'],
    nameFields: ['employee_name', 'employeeName', 'nama_karyawan', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },

  [MASTER_TYPES.CHART_OF_ACCOUNTS]: {
    aliases: ['CHART_OF_ACCOUNTS', 'COA', 'MASTER_CHART_OF_ACCOUNTS', 'ACCOUNT'],
    sourceKeys: [
      'master_chart_of_accounts',
      'masterChartOfAccounts',
      'chart_of_accounts',
      'chartOfAccounts',
      'coa',
      'accounts',
    ],
    idFields: ['account_code', 'accountCode', 'coa_code', 'code', 'kode_akun', 'id'],
    codeFields: ['account_code', 'accountCode', 'coa_code', 'code', 'kode_akun', 'kode'],
    nameFields: ['account_name', 'accountName', 'coa_name', 'name', 'nama_akun', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },

  [MASTER_TYPES.KEWAJIBAN]: {
    aliases: ['KEWAJIBAN', 'MASTER_KEWAJIBAN', 'OBLIGATION', 'LIABILITY'],
    sourceKeys: [
      'master_kewajiban',
      'masterKewajiban',
      'kewajiban',
      'obligations',
      'liabilities',
    ],
    idFields: ['kewajiban_id', 'kewajibanId', 'id_kewajiban', 'id', 'code'],
    codeFields: ['kode_kewajiban', 'kewajiban_code', 'kewajibanCode', 'code', 'kode'],
    nameFields: ['nama_kewajiban', 'kewajiban_name', 'kewajibanName', 'name', 'nama'],
    branchFields: ['branch_id', 'branchId', 'scope_branch_id', 'cabang_id'],
  },
});

const COMMON_FIELDS = Object.freeze({
  barcode: ['barcode', 'bar_code', 'qr_code', 'sku_barcode'],
  phone: ['phone', 'phone_number', 'nomor_hp', 'no_hp', 'telp', 'telepon', 'whatsapp', 'wa'],
  email: ['email', 'email_address', 'alamat_email'],
  address: ['address', 'alamat', 'lokasi'],
  category: ['category', 'kategori', 'type', 'tipe', 'jenis'],
  unit: ['unit', 'satuan', 'uom'],
  status: ['status', 'status_active', 'is_active', 'active'],
  deleted: ['isDeleted', 'deleted', 'is_deleted', 'soft_delete'],
  franchise: ['franchise_id', 'franchiseId', 'mitra_id', 'scope_franchise_id'],
  scopeType: ['scope_type', 'scope', 'master_scope'],
  createdAt: ['created_at', 'createdAt', 'date_created', 'timestamp'],
  updatedAt: ['updated_at', 'updatedAt', 'modified_at', 'last_updated_at'],
  notes: ['notes', 'description', 'keterangan', 'remark'],
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

const normalizeLooseText = (value) => {
  return cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeBranchId = (branchId) => {
  const normalized = normalizeCode(branchId || DEFAULT_BRANCH_SCOPE);
  return normalized || DEFAULT_BRANCH_SCOPE;
};

const normalizeFranchiseId = (franchiseId) => {
  const normalized = normalizeBranchId(franchiseId || '');
  return normalized === DEFAULT_BRANCH_SCOPE ? '' : normalized;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = normalizeCode(value);

  if (ACTIVE_STATUSES.has(normalized)) return true;
  if (INACTIVE_STATUSES.has(normalized)) return false;

  return fallback;
};

const makeWarning = (code, message, meta = {}) => ({
  code,
  message,
  meta,
});

const getTodayISO = () => {
  return new Date().toISOString().substring(0, 10);
};

const normalizeDateString = (value) => {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

  return parsed.toISOString().substring(0, 10);
};

const generateId = (prefix = 'MST') => {
  const safePrefix = normalizeCode(prefix || 'MST') || 'MST';
  return `${safePrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
};

const safeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const firstDefined = (source, keys) => {
  if (!isObject(source)) return undefined;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }

  return undefined;
};

const isDeletedRow = (row) => {
  if (!isObject(row)) return true;

  const value = firstDefined(row, COMMON_FIELDS.deleted);
  if (value === undefined || value === null || value === '') return false;

  return toBoolean(value, false);
};

const normalizeStatus = (record = {}) => {
  if (isDeletedRow(record)) return 'SOFT_DELETED';

  const rawStatus = firstDefined(record, COMMON_FIELDS.status);

  if (rawStatus === undefined || rawStatus === null || rawStatus === '') {
    return 'ACTIVE';
  }

  if (typeof rawStatus === 'boolean') {
    return rawStatus ? 'ACTIVE' : 'NON_ACTIVE';
  }

  const normalized = normalizeCode(rawStatus);

  if (ACTIVE_STATUSES.has(normalized)) return 'ACTIVE';
  if (INACTIVE_STATUSES.has(normalized)) return 'NON_ACTIVE';

  return normalized || 'ACTIVE';
};

const isActiveStatus = (status) => {
  return normalizeCode(status) === 'ACTIVE';
};

const normalizeScopeType = (value, branchId, franchiseId) => {
  const normalized = normalizeCode(value);

  if (['GLOBAL', 'ALL', '*'].includes(normalized)) return 'GLOBAL';
  if (['BRANCH', 'CABANG'].includes(normalized)) return 'BRANCH';
  if (['FRANCHISE', 'MITRA'].includes(normalized)) return 'FRANCHISE';

  if (franchiseId) return 'FRANCHISE';

  const branch = normalizeBranchId(branchId || '');
  if (branch && branch !== DEFAULT_BRANCH_SCOPE) return 'BRANCH';

  return 'GLOBAL';
};

const normalizeMasterType = (masterType) => {
  const normalized = normalizeCode(masterType || '');

  if (!normalized) return MASTER_TYPES.UNKNOWN;

  const directMatch = Object.values(MASTER_TYPES).find((type) => type === normalized);
  if (directMatch) return directMatch;

  const configEntry = Object.entries(MASTER_CONFIG).find(([, config]) => {
    return config.aliases.map(normalizeCode).includes(normalized);
  });

  return configEntry ? configEntry[0] : MASTER_TYPES.UNKNOWN;
};

const getConfig = (masterType) => {
  return MASTER_CONFIG[normalizeMasterType(masterType)] || null;
};

const sourceHasKey = (source, key) => {
  return isObject(source) && Object.prototype.hasOwnProperty.call(source, key) && Array.isArray(source[key]);
};

const extractFromSourceKeys = (source, keys = []) => {
  if (Array.isArray(source)) return source;
  if (!isObject(source)) return [];

  for (const key of keys) {
    if (sourceHasKey(source, key)) return source[key];
  }

  if (isObject(source.dbData)) {
    for (const key of keys) {
      if (sourceHasKey(source.dbData, key)) return source.dbData[key];
    }
  }

  if (isObject(source.data)) {
    for (const key of keys) {
      if (sourceHasKey(source.data, key)) return source.data[key];
    }
  }

  if (isObject(source.source)) {
    return extractFromSourceKeys(source.source, keys);
  }

  return [];
};

const branchScopeMatches = (recordBranchId, options = {}) => {
  const requestedBranch = normalizeBranchId(options.branchId || options.branch_id || '');
  const branchId = normalizeBranchId(recordBranchId || DEFAULT_BRANCH_SCOPE);

  if (!requestedBranch || requestedBranch === DEFAULT_BRANCH_SCOPE || requestedBranch === 'ALL') return true;
  if (branchId === DEFAULT_BRANCH_SCOPE || branchId === 'ALL') return true;

  return branchId === requestedBranch;
};

const franchiseScopeMatches = (recordFranchiseId, options = {}) => {
  const requestedFranchise = normalizeFranchiseId(options.franchiseId || options.franchise_id || '');

  if (!requestedFranchise) return true;

  const franchiseId = normalizeFranchiseId(recordFranchiseId || '');
  if (!franchiseId) return true;

  return franchiseId === requestedFranchise;
};

const filterStatus = (record, options = {}) => {
  const includeInactive = Boolean(options.includeInactive || options.include_inactive);
  const includeDeleted = Boolean(options.includeDeleted || options.include_deleted || options.includeSoftDeleted || options.include_soft_deleted);

  if (record.is_deleted && !includeDeleted) return false;
  if (!record.is_active && !includeInactive) return false;

  return true;
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

/* =========================================================================
   EXTRACT & NORMALIZE MASTER
   ========================================================================= */

export const extractMasterRows = (source = {}, masterType = MASTER_TYPES.UNKNOWN) => {
  const type = normalizeMasterType(masterType);
  const config = getConfig(type);

  if (!config) {
    if (Array.isArray(source)) return source;
    return [];
  }

  return extractFromSourceKeys(source, config.sourceKeys);
};

export const normalizeMasterRecord = (record = {}, masterType = MASTER_TYPES.UNKNOWN, options = {}) => {
  const type = normalizeMasterType(masterType);
  const config = getConfig(type);

  if (!isObject(record)) {
    return {
      ok: false,
      record: null,
      warnings: [
        makeWarning('INVALID_MASTER_RECORD', 'Master record bukan object valid.', {
          master_type: type,
        }),
      ],
    };
  }

  if (!config) {
    return {
      ok: false,
      record: null,
      warnings: [
        makeWarning('UNKNOWN_MASTER_TYPE', 'masterType tidak dikenali.', {
          master_type: masterType,
        }),
      ],
    };
  }

  const id = String(firstDefined(record, config.idFields) || '').trim();
  const code = String(firstDefined(record, config.codeFields) || id || '').trim();
  const name = String(firstDefined(record, config.nameFields) || '').trim();

  const branchRaw = firstDefined(record, config.branchFields);
  const branchId = normalizeBranchId(branchRaw || DEFAULT_BRANCH_SCOPE);

  const franchiseId = normalizeFranchiseId(firstDefined(record, COMMON_FIELDS.franchise) || '');
  const scopeType = normalizeScopeType(firstDefined(record, COMMON_FIELDS.scopeType), branchId, franchiseId);

  const status = normalizeStatus(record);

  const normalized = {
    master_type: type,

    id,
    code,
    name,

    branch_id: branchId,
    franchise_id: franchiseId,
    scope_type: scopeType,

    status,
    is_active: isActiveStatus(status),
    is_deleted: isDeletedRow(record),

    barcode: String(firstDefined(record, COMMON_FIELDS.barcode) || '').trim(),
    phone: String(firstDefined(record, COMMON_FIELDS.phone) || '').trim(),
    email: String(firstDefined(record, COMMON_FIELDS.email) || '').trim(),
    address: String(firstDefined(record, COMMON_FIELDS.address) || '').trim(),
    category: String(firstDefined(record, COMMON_FIELDS.category) || '').trim(),
    unit: String(firstDefined(record, COMMON_FIELDS.unit) || '').trim(),

    created_at: String(firstDefined(record, COMMON_FIELDS.createdAt) || '').trim(),
    updated_at: String(firstDefined(record, COMMON_FIELDS.updatedAt) || '').trim(),
    notes: String(firstDefined(record, COMMON_FIELDS.notes) || '').trim(),

    search_text: normalizeLooseText([
      id,
      code,
      name,
      firstDefined(record, COMMON_FIELDS.barcode),
      firstDefined(record, COMMON_FIELDS.phone),
      firstDefined(record, COMMON_FIELDS.email),
      firstDefined(record, COMMON_FIELDS.address),
      firstDefined(record, COMMON_FIELDS.category),
      record.nama,
      record.name,
    ].filter(Boolean).join(' ')),

    raw: { ...record },
  };

  if (options.includeSourceIndex || options.include_source_index) {
    normalized.source_index = options.index ?? options.sourceIndex ?? options.source_index ?? '';
  }

  return {
    ok: true,
    record: normalized,
    warnings: [],
  };
};

export const normalizeMasterRecords = (source = {}, masterType = MASTER_TYPES.UNKNOWN, options = {}) => {
  const type = normalizeMasterType(masterType);
  const rawRows = extractMasterRows(source, type);
  const warnings = [];

  const records = rawRows
    .map((row, index) => {
      const normalized = normalizeMasterRecord(row, type, {
        ...options,
        includeSourceIndex: true,
        index,
      });

      warnings.push(...normalized.warnings);

      if (!normalized.ok || !normalized.record) return null;

      return normalized.record;
    })
    .filter(Boolean)
    .filter((record) => branchScopeMatches(record.branch_id, options))
    .filter((record) => franchiseScopeMatches(record.franchise_id, options))
    .filter((record) => filterStatus(record, options));

  return {
    ok: warnings.length === 0,
    master_type: type,
    raw_count: rawRows.length,
    records,
    warnings,
  };
};

/* =========================================================================
   VALIDATION
   ========================================================================= */

export const validateMasterRecord = (record = {}, masterType = MASTER_TYPES.UNKNOWN, options = {}) => {
  const warnings = [];

  const type = normalizeMasterType(masterType);
  const normalizedResult = record.master_type
    ? { ok: true, record, warnings: [] }
    : normalizeMasterRecord(record, type, options);

  warnings.push(...normalizedResult.warnings);

  if (!normalizedResult.ok || !normalizedResult.record) {
    return {
      ok: false,
      record: null,
      warnings,
    };
  }

  const normalized = normalizedResult.record;

  if (!normalized.id) {
    warnings.push(makeWarning('MASTER_ID_EMPTY', 'Master record wajib memiliki id.', {
      master_type: type,
      name: normalized.name,
    }));
  }

  if (!normalized.code) {
    warnings.push(makeWarning('MASTER_CODE_EMPTY', 'Master record wajib memiliki code.', {
      master_type: type,
      id: normalized.id,
      name: normalized.name,
    }));
  }

  if (!normalized.name) {
    warnings.push(makeWarning('MASTER_NAME_EMPTY', 'Master record wajib memiliki nama/name.', {
      master_type: type,
      id: normalized.id,
      code: normalized.code,
    }));
  }

  if (!['GLOBAL', 'BRANCH', 'FRANCHISE'].includes(normalized.scope_type)) {
    warnings.push(makeWarning('INVALID_BRANCH_SCOPE', 'branch scope master tidak valid.', {
      master_type: type,
      id: normalized.id,
      scope_type: normalized.scope_type,
      branch_id: normalized.branch_id,
      franchise_id: normalized.franchise_id,
    }));
  }

  if (normalized.scope_type === 'BRANCH' && (!normalized.branch_id || normalized.branch_id === DEFAULT_BRANCH_SCOPE)) {
    warnings.push(makeWarning('INVALID_BRANCH_SCOPE', 'Master branch-scope wajib memiliki branch_id spesifik.', {
      master_type: type,
      id: normalized.id,
      branch_id: normalized.branch_id,
    }));
  }

  if (normalized.scope_type === 'FRANCHISE' && !normalized.franchise_id) {
    warnings.push(makeWarning('INVALID_FRANCHISE_SCOPE', 'Master franchise-scope wajib memiliki franchise_id.', {
      master_type: type,
      id: normalized.id,
      franchise_id: normalized.franchise_id,
    }));
  }

  const allRecordsRaw = safeArray(options.allRecords || options.all_records);
  const allRecords = allRecordsRaw.map((row, index) => {
    if (row.master_type) return row;

    const result = normalizeMasterRecord(row, type, {
      ...options,
      index,
    });

    return result.record;
  }).filter(Boolean);

  if (allRecords.length > 0) {
    const sameId = allRecords.filter((candidate) => {
      return candidate.id &&
        normalized.id &&
        candidate.id === normalized.id &&
        candidate.branch_id === normalized.branch_id &&
        candidate.franchise_id === normalized.franchise_id;
    });

    if (sameId.length > 1) {
      warnings.push(makeWarning('DUPLICATE_MASTER_ID', 'ID master tidak unik dalam scope yang sama.', {
        master_type: type,
        id: normalized.id,
        branch_id: normalized.branch_id,
        franchise_id: normalized.franchise_id,
        duplicate_count: sameId.length,
      }));
    }

    const sameCode = allRecords.filter((candidate) => {
      return candidate.code &&
        normalized.code &&
        candidate.code === normalized.code &&
        candidate.branch_id === normalized.branch_id &&
        candidate.franchise_id === normalized.franchise_id;
    });

    if (sameCode.length > 1) {
      warnings.push(makeWarning('DUPLICATE_MASTER_CODE', 'Code master tidak unik dalam scope yang sama.', {
        master_type: type,
        code: normalized.code,
        branch_id: normalized.branch_id,
        franchise_id: normalized.franchise_id,
        duplicate_count: sameCode.length,
      }));
    }
  }

  const blockingCodes = new Set([
    'INVALID_MASTER_RECORD',
    'UNKNOWN_MASTER_TYPE',
    'MASTER_ID_EMPTY',
    'MASTER_CODE_EMPTY',
    'INVALID_BRANCH_SCOPE',
    'INVALID_FRANCHISE_SCOPE',
    'DUPLICATE_MASTER_ID',
    'DUPLICATE_MASTER_CODE',
  ]);

  return {
    ok: !warnings.some((warning) => blockingCodes.has(warning.code)),
    record: normalized,
    warnings,
  };
};

export const validateMasterRecords = (source = {}, masterType = MASTER_TYPES.UNKNOWN, options = {}) => {
  const normalized = normalizeMasterRecords(source, masterType, {
    ...options,
    includeInactive: true,
    includeDeleted: true,
  });

  const warnings = [...normalized.warnings];

  normalized.records.forEach((record) => {
    const validation = validateMasterRecord(record, normalized.master_type, {
      ...options,
      allRecords: normalized.records,
    });

    warnings.push(...validation.warnings);
  });

  const blockingCodes = new Set([
    'MASTER_ID_EMPTY',
    'MASTER_CODE_EMPTY',
    'INVALID_BRANCH_SCOPE',
    'INVALID_FRANCHISE_SCOPE',
    'DUPLICATE_MASTER_ID',
    'DUPLICATE_MASTER_CODE',
  ]);

  return {
    ok: !warnings.some((warning) => blockingCodes.has(warning.code)),
    master_type: normalized.master_type,
    records: normalized.records,
    warnings,
  };
};

/* =========================================================================
   GENERIC GETTERS
   ========================================================================= */

const getMasterRecords = (source = {}, masterType = MASTER_TYPES.UNKNOWN, options = {}) => {
  const normalized = normalizeMasterRecords(source, masterType, options);
  const validation = options.validate === false
    ? { ok: true, warnings: [] }
    : validateMasterRecords(source, masterType, options);

  const warnings = [
    ...normalized.warnings,
    ...validation.warnings,
  ];

  return {
    ok: normalized.ok && validation.ok,
    master_type: normalized.master_type,
    records: normalized.records,
    raw_count: normalized.raw_count,
    warnings,
  };
};

const getMasterById = (source = {}, masterType = MASTER_TYPES.UNKNOWN, id = '', options = {}) => {
  const result = getMasterRecords(source, masterType, options);
  const targetId = String(id || '').trim();

  const record = result.records.find((item) => item.id === targetId || item.code === targetId) || null;

  const warnings = [...result.warnings];

  if (!record) {
    warnings.push(makeWarning('MASTER_RECORD_NOT_FOUND', 'Master record tidak ditemukan berdasarkan id/code.', {
      master_type: result.master_type,
      id: targetId,
    }));
  }

  return {
    ok: Boolean(record),
    record,
    warnings,
  };
};

/* =========================================================================
   SPECIFIC GETTERS
   ========================================================================= */

export const getBranches = (source = {}, options = {}) => getMasterRecords(source, MASTER_TYPES.BRANCH, options);
export const getBranchById = (source = {}, id = '', options = {}) => getMasterById(source, MASTER_TYPES.BRANCH, id, options);

export const getWarehouses = (source = {}, options = {}) => getMasterRecords(source, MASTER_TYPES.WAREHOUSE, options);
export const getWarehouseById = (source = {}, id = '', options = {}) => getMasterById(source, MASTER_TYPES.WAREHOUSE, id, options);

export const getCustomers = (source = {}, options = {}) => getMasterRecords(source, MASTER_TYPES.CUSTOMER, options);
export const getCustomerById = (source = {}, id = '', options = {}) => getMasterById(source, MASTER_TYPES.CUSTOMER, id, options);

export const getSuppliers = (source = {}, options = {}) => getMasterRecords(source, MASTER_TYPES.SUPPLIER, options);
export const getSupplierById = (source = {}, id = '', options = {}) => getMasterById(source, MASTER_TYPES.SUPPLIER, id, options);

export const getProducts = (source = {}, options = {}) => getMasterRecords(source, MASTER_TYPES.PRODUCT, options);
export const getProductById = (source = {}, id = '', options = {}) => getMasterById(source, MASTER_TYPES.PRODUCT, id, options);

export const getRawMaterials = (source = {}, options = {}) => getMasterRecords(source, MASTER_TYPES.RAW_MATERIAL, options);
export const getRawMaterialById = (source = {}, id = '', options = {}) => getMasterById(source, MASTER_TYPES.RAW_MATERIAL, id, options);

export const getEmployees = (source = {}, options = {}) => getMasterRecords(source, MASTER_TYPES.EMPLOYEE, options);
export const getEmployeeById = (source = {}, id = '', options = {}) => getMasterById(source, MASTER_TYPES.EMPLOYEE, id, options);

export const getChartOfAccounts = (source = {}, options = {}) => getMasterRecords(source, MASTER_TYPES.CHART_OF_ACCOUNTS, options);
export const getAccountByCode = (source = {}, code = '', options = {}) => getMasterById(source, MASTER_TYPES.CHART_OF_ACCOUNTS, code, options);

export const getKewajiban = (source = {}, options = {}) => getMasterRecords(source, MASTER_TYPES.KEWAJIBAN, options);
export const getKewajibanById = (source = {}, id = '', options = {}) => getMasterById(source, MASTER_TYPES.KEWAJIBAN, id, options);

/* =========================================================================
   SEARCH MASTER
   ========================================================================= */

const matchesSearchCriteria = (record = {}, query = {}) => {
  const keyword = normalizeLooseText(query.keyword || query.q || query.search || '');
  const code = normalizeCode(query.code || '');
  const barcode = normalizeCode(query.barcode || '');
  const phone = normalizeCode(query.phone || query.whatsapp || query.wa || '');
  const email = normalizeLooseText(query.email || '');
  const nama = normalizeLooseText(query.nama || query.name || query.keywordName || query.keyword_name || '');

  if (keyword && !record.search_text.includes(keyword)) return false;

  if (code && normalizeCode(record.code) !== code) return false;
  if (barcode && normalizeCode(record.barcode) !== barcode) return false;
  if (phone && !normalizeCode(record.phone).includes(phone)) return false;
  if (email && !normalizeLooseText(record.email).includes(email)) return false;
  if (nama && !normalizeLooseText(record.name).includes(nama)) return false;

  return true;
};

export const searchMaster = (source = {}, params = {}, options = {}) => {
  const masterType = normalizeMasterType(params.masterType || params.master_type || params.type || MASTER_TYPES.UNKNOWN);
  const warnings = [];

  const searchOptions = {
    ...options,
    branchId: params.branchId || params.branch_id || options.branchId || options.branch_id,
    franchiseId: params.franchiseId || params.franchise_id || options.franchiseId || options.franchise_id,
    includeInactive: params.includeInactive ?? params.include_inactive ?? options.includeInactive ?? options.include_inactive,
    includeDeleted: params.includeDeleted ?? params.include_deleted ?? options.includeDeleted ?? options.include_deleted,
  };

  let records = [];

  if (masterType === MASTER_TYPES.UNKNOWN) {
    Object.values(MASTER_TYPES)
      .filter((type) => type !== MASTER_TYPES.UNKNOWN)
      .forEach((type) => {
        const result = getMasterRecords(source, type, {
          ...searchOptions,
          validate: false,
        });

        warnings.push(...result.warnings);
        records.push(...result.records);
      });
  } else {
    const result = getMasterRecords(source, masterType, {
      ...searchOptions,
      validate: false,
    });

    warnings.push(...result.warnings);
    records = result.records;
  }

  const filtered = records.filter((record) => matchesSearchCriteria(record, params));

  const limit = Number(params.limit || options.limit || 0);
  const resultRecords = limit > 0 ? filtered.slice(0, limit) : filtered;

  return {
    ok: true,
    master_type: masterType,
    records: resultRecords,
    total_found: filtered.length,
    returned: resultRecords.length,
    warnings,
  };
};

/* =========================================================================
   MASTER SNAPSHOT
   ========================================================================= */

export const createMasterSnapshot = (input = {}, options = {}) => {
  const masterType = normalizeMasterType(input.masterType || input.master_type || input.type || MASTER_TYPES.UNKNOWN);

  const records = Array.isArray(input.records)
    ? input.records
    : input.record
      ? [input.record]
      : input.source
        ? getMasterRecords(input.source, masterType, {
            ...options,
            includeInactive: true,
            includeDeleted: true,
            validate: false,
          }).records
        : [];

  const validation = input.skipValidation
    ? { ok: true, warnings: [] }
    : {
        ok: true,
        warnings: records.flatMap((record) => {
          const result = validateMasterRecord(record.master_type ? record : record.raw || record, masterType, {
            ...options,
            allRecords: records,
          });

          return result.warnings;
        }),
      };

  const branchId = normalizeBranchId(input.branch_id || input.branchId || options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE);

  const snapshotResult = createSnapshot({
    snapshot_type: 'MASTER_DATA',
    snapshot_version: ENGINE_VERSION,

    transaction_id: input.transaction_id || input.transactionId || input.snapshot_reference_id || generateId('MASTER-SNP'),
    transaction_type: input.transaction_type || input.transactionType || `MASTER_${masterType}`,

    branch_id: branchId,
    created_by: input.created_by || input.createdBy || options.createdBy || options.created_by || 'SYSTEM',

    engine_versions: {
      masterDataEngine: ENGINE_VERSION,
    },

    payload: {
      master_type: masterType,
      branch_id: branchId,
      generated_date: normalizeDateString(input.generated_date || input.generatedDate || getTodayISO()),
      record_count: records.length,
      records,
      historical_integrity: true,
    },

    warnings: [
      ...(input.warnings || []),
      ...validation.warnings,
    ],

    meta: {
      source_module: 'masterDataEngine',
      historical_integrity: true,
      ...(
        isObject(input.meta)
          ? input.meta
          : {}
      ),
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
    lockedBy: input.created_by || input.createdBy || options.createdBy || options.created_by || 'SYSTEM',
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

/* =========================================================================
   DEFAULT EXPORT
   ========================================================================= */

export default {
  MASTER_TYPES,

  extractMasterRows,
  normalizeMasterRecord,
  normalizeMasterRecords,
  validateMasterRecord,
  validateMasterRecords,

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
};
