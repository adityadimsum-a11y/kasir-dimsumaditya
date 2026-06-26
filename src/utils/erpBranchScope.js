export const BRANCH_IDS = Object.freeze({
  HQ_TANGERANG: 'TANGERANG_PUSAT',
  PUSAT: 'TANGERANG_PUSAT',
  TANGERANG_PUSAT: 'TANGERANG_PUSAT',

  PRODUKSI_PEMALANG: 'PRODUKSI_PEMALANG',
  PEMALANG: 'PRODUKSI_PEMALANG',

  RESTO_CIBINONG: 'RESTO_CIBINONG',
  CIBINONG: 'RESTO_CIBINONG',

  GLOBAL: 'GLOBAL',
  ALL: 'ALL',
});

export const BRANCH_TYPES = Object.freeze({
  HQ_FACTORY: 'HQ_FACTORY',
  PRODUCTION_BRANCH: 'PRODUCTION_BRANCH',
  OUTLET_RESTO: 'OUTLET_RESTO',
  WAREHOUSE: 'WAREHOUSE',
  UNKNOWN: 'UNKNOWN',
});

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

const safeObject = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

export const normalizeBranchId = (value, fallback = BRANCH_IDS.HQ_TANGERANG) => {
  const raw = normalizeCode(value);

  if (!raw) return fallback;

  if (
    raw === 'PUSAT' ||
    raw === 'HQ' ||
    raw === 'HO' ||
    raw === 'TANGERANG' ||
    raw === 'TANGERANG_PUSAT' ||
    raw === 'PABRIK_TANGERANG' ||
    raw === 'HQ_TANGERANG' ||
    raw === 'OWNER_TANGERANG'
  ) {
    return BRANCH_IDS.HQ_TANGERANG;
  }

  if (
    raw === 'PEMALANG' ||
    raw === 'PRODUKSI_PEMALANG' ||
    raw === 'PABRIK_PEMALANG' ||
    raw === 'CABANG_PEMALANG' ||
    raw === 'PEMALANG_PRODUCTION'
  ) {
    return BRANCH_IDS.PRODUKSI_PEMALANG;
  }

  if (
    raw === 'CIBINONG' ||
    raw === 'RESTO_CIBINONG' ||
    raw === 'OUTLET_CIBINONG' ||
    raw === 'CABANG_CIBINONG' ||
    raw === 'CIBINONG_RESTO'
  ) {
    return BRANCH_IDS.RESTO_CIBINONG;
  }

  if (raw === 'GLOBAL') return BRANCH_IDS.GLOBAL;
  if (raw === 'ALL') return BRANCH_IDS.ALL;

  return raw;
};

export const resolveRowBranchId = (row = {}, fallback = BRANCH_IDS.HQ_TANGERANG) => {
  const source = safeObject(row);

  return normalizeBranchId(
    source.branch_id ||
    source.branchId ||
    source.outlet_id ||
    source.outletId ||
    source.location_id ||
    source.locationId ||
    source.warehouse_id ||
    source.warehouseId ||
    source.store_id ||
    source.storeId ||
    fallback,
    fallback,
  );
};

export const resolveUserBranchId = (user = {}, fallback = BRANCH_IDS.HQ_TANGERANG) => {
  const source = safeObject(user);

  return normalizeBranchId(
    source.branch_id ||
    source.branchId ||
    source.location_id ||
    source.locationId ||
    fallback,
    fallback,
  );
};

export const resolveBranchType = (input = {}) => {
  const source = typeof input === 'string'
    ? { branch_id: input }
    : safeObject(input);

  const branchType = normalizeCode(source.branch_type || source.branchType || source.type);
  const branchId = normalizeBranchId(source.branch_id || source.branchId || source.name || source.branch_name || source.branchName);

  if (branchType === BRANCH_TYPES.HQ_FACTORY || branchId === BRANCH_IDS.HQ_TANGERANG) {
    return BRANCH_TYPES.HQ_FACTORY;
  }

  if (branchType === BRANCH_TYPES.PRODUCTION_BRANCH || branchId === BRANCH_IDS.PRODUKSI_PEMALANG) {
    return BRANCH_TYPES.PRODUCTION_BRANCH;
  }

  if (
    branchType === BRANCH_TYPES.OUTLET_RESTO ||
    branchType === 'OUTLET' ||
    branchType === 'RESTO' ||
    branchId === BRANCH_IDS.RESTO_CIBINONG
  ) {
    return BRANCH_TYPES.OUTLET_RESTO;
  }

  if (branchType === BRANCH_TYPES.WAREHOUSE) {
    return BRANCH_TYPES.WAREHOUSE;
  }

  return BRANCH_TYPES.UNKNOWN;
};

export const isHQBranch = (input = {}) => {
  return resolveBranchType(input) === BRANCH_TYPES.HQ_FACTORY;
};

export const isProductionBranch = (input = {}) => {
  return resolveBranchType(input) === BRANCH_TYPES.PRODUCTION_BRANCH;
};

export const isOutletBranch = (input = {}) => {
  return resolveBranchType(input) === BRANCH_TYPES.OUTLET_RESTO;
};

export const isOwnerOrHQUser = (user = {}) => {
  const source = safeObject(user);
  const role = normalizeCode(source.role || source.user_role || source.userRole);
  const userBranchType = resolveBranchType(source);

  return (
    userBranchType === BRANCH_TYPES.HQ_FACTORY ||
    role === 'OWNER' ||
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN_PUSAT' ||
    role === 'HQ_ADMIN'
  );
};

export const canAccessBranchData = ({
  user = {},
  row = {},
  targetBranchId = '',
  allowGlobal = true,
} = {}) => {
  if (isOwnerOrHQUser(user)) return true;

  const userBranchId = resolveUserBranchId(user);
  const rowBranchId = targetBranchId
    ? normalizeBranchId(targetBranchId)
    : resolveRowBranchId(row);

  if (allowGlobal && (rowBranchId === BRANCH_IDS.GLOBAL || rowBranchId === BRANCH_IDS.ALL)) {
    return true;
  }

  return rowBranchId === userBranchId;
};

export const filterRowsByBranchScope = ({
  rows = [],
  user = {},
  branchId = '',
  includeGlobal = true,
  includeDeleted = false,
} = {}) => {
  const targetBranchId = branchId ? normalizeBranchId(branchId) : '';

  return safeArray(rows).filter((row) => {
    const isDeleted = (
      row?.isDeleted === true ||
      row?.is_deleted === true ||
      String(row?.isDeleted).toUpperCase() === 'TRUE' ||
      String(row?.is_deleted).toUpperCase() === 'TRUE' ||
      String(row?.status || '').toUpperCase() === 'DELETED'
    );

    if (!includeDeleted && isDeleted) return false;

    if (targetBranchId && targetBranchId !== BRANCH_IDS.ALL && targetBranchId !== BRANCH_IDS.GLOBAL) {
      const rowBranchId = resolveRowBranchId(row);
      if (includeGlobal && (rowBranchId === BRANCH_IDS.GLOBAL || rowBranchId === BRANCH_IDS.ALL)) return true;
      return rowBranchId === targetBranchId;
    }

    return canAccessBranchData({
      user,
      row,
      allowGlobal: includeGlobal,
    });
  });
};

export const groupRowsByBranch = (rows = []) => {
  return safeArray(rows).reduce((result, row) => {
    const branchId = resolveRowBranchId(row);

    if (!result[branchId]) {
      result[branchId] = [];
    }

    result[branchId].push(row);

    return result;
  }, {});
};

export const getBranchDisplayName = (branchId = '') => {
  const normalized = normalizeBranchId(branchId);

  if (normalized === BRANCH_IDS.HQ_TANGERANG) return 'Tangerang Pusat';
  if (normalized === BRANCH_IDS.PRODUKSI_PEMALANG) return 'Pemalang Produksi';
  if (normalized === BRANCH_IDS.RESTO_CIBINONG) return 'Resto Cibinong';
  if (normalized === BRANCH_IDS.GLOBAL) return 'Global';
  if (normalized === BRANCH_IDS.ALL) return 'Semua Cabang';

  return normalized.replace(/_/g, ' ');
};

export const getBranchFlowRole = (branchId = '') => {
  const normalized = normalizeBranchId(branchId);

  if (normalized === BRANCH_IDS.HQ_TANGERANG) {
    return {
      branch_id: BRANCH_IDS.HQ_TANGERANG,
      role: 'HO_OWNER_CENTER',
      label: 'Tangerang sebagai pusat owner, kas, approval, supplier, dan laporan konsolidasi.',
      reportsTo: '',
      canApproveRequest: true,
      canConsolidateReport: true,
      canHoldCentralCash: true,
    };
  }

  if (normalized === BRANCH_IDS.PRODUKSI_PEMALANG) {
    return {
      branch_id: BRANCH_IDS.PRODUKSI_PEMALANG,
      role: 'PRODUCTION_BRANCH',
      label: 'Pemalang sebagai cabang produksi. Wajib lapor, setor, dan request bahan ke Tangerang.',
      reportsTo: BRANCH_IDS.HQ_TANGERANG,
      canApproveRequest: false,
      canConsolidateReport: false,
      canHoldCentralCash: false,
    };
  }

  if (normalized === BRANCH_IDS.RESTO_CIBINONG) {
    return {
      branch_id: BRANCH_IDS.RESTO_CIBINONG,
      role: 'OUTLET_RESTO',
      label: 'Cibinong sebagai outlet/resto. Akun dan laporan tidak boleh campur dengan cabang lain.',
      reportsTo: BRANCH_IDS.HQ_TANGERANG,
      canApproveRequest: false,
      canConsolidateReport: false,
      canHoldCentralCash: false,
    };
  }

  return {
    branch_id: normalized,
    role: 'UNKNOWN_BRANCH',
    label: 'Cabang belum terklasifikasi.',
    reportsTo: BRANCH_IDS.HQ_TANGERANG,
    canApproveRequest: false,
    canConsolidateReport: false,
    canHoldCentralCash: false,
  };
};

export const buildBranchScopePackage = ({
  user = {},
  rows = [],
  branchId = '',
} = {}) => {
  const userBranchId = resolveUserBranchId(user);
  const activeBranchId = branchId ? normalizeBranchId(branchId) : userBranchId;
  const visibleRows = filterRowsByBranchScope({
    rows,
    user,
    branchId: activeBranchId,
    includeGlobal: true,
  });

  return {
    userBranchId,
    activeBranchId,
    activeBranchName: getBranchDisplayName(activeBranchId),
    userIsHQ: isOwnerOrHQUser(user),
    branchRole: getBranchFlowRole(activeBranchId),
    visibleRows,
    groupedRows: groupRowsByBranch(visibleRows),
  };
};

export default {
  BRANCH_IDS,
  BRANCH_TYPES,
  normalizeBranchId,
  resolveRowBranchId,
  resolveUserBranchId,
  resolveBranchType,
  isHQBranch,
  isProductionBranch,
  isOutletBranch,
  isOwnerOrHQUser,
  canAccessBranchData,
  filterRowsByBranchScope,
  groupRowsByBranch,
  getBranchDisplayName,
  getBranchFlowRole,
  buildBranchScopePackage,
};
