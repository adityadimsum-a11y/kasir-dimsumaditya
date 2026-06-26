export const NANA_SUPPLIER_CANONICAL_NAME = 'NANA AYAM';

export const NANA_SUPPLIER_KEYWORDS = Object.freeze([
  'NANA AYAM',
  'NANA CHICKEN',
  'NANA',
]);

export const NANA_LEDGER_TYPES = Object.freeze({
  OPENING_BALANCE: 'OPENING_BALANCE',
  PURCHASE: 'PURCHASE',
  PAYMENT: 'PAYMENT',
  ADJUSTMENT_ADD: 'ADJUSTMENT_ADD',
  ADJUSTMENT_MINUS: 'ADJUSTMENT_MINUS',
  VOID: 'VOID',
});

export const NANA_LEDGER_TABLE = 'supplier_ledger';
export const CASHFLOW_TABLE = 'cashflow_transactions';

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

const safeNumber = (value, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (value === undefined || value === null || value === '') return fallback;

  const parsed = Number(
    String(value)
      .trim()
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.')
  );

  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
};

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const toYmd = (value) => {
  if (!value) return new Date().toISOString().substring(0, 10);

  const raw = String(value);
  if (raw.length >= 10 && raw[4] === '-' && raw[7] === '-') {
    return raw.substring(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw.substring(0, 10);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const makeId = (prefix = 'NANA') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
};

const isDeletedRow = (row = {}) => {
  return (
    row.isDeleted === true ||
    row.is_deleted === true ||
    String(row.isDeleted).toUpperCase() === 'TRUE' ||
    String(row.is_deleted).toUpperCase() === 'TRUE' ||
    String(row.status || '').toUpperCase() === 'DELETED' ||
    String(row.status || '').toUpperCase() === 'VOID'
  );
};

const getFirstValue = (source = {}, keys = [], fallback = undefined) => {
  const obj = safeObject(source);

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }

  return fallback;
};

export const isNanaSupplierName = (name) => {
  const normalized = normalizeText(name);

  if (!normalized) return false;

  return NANA_SUPPLIER_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const getSupplierNameFromRow = (row = {}) => {
  return getFirstValue(row, [
    'supplier_name',
    'supplierName',
    'supplier',
    'vendor_name',
    'vendorName',
    'vendor',
    'partner_name',
    'partnerName',
  ], '');
};

const isAyamPurchaseRow = (row = {}) => {
  const category = normalizeText(row.category || row.item_category || row.itemCategory);
  const itemName = normalizeText(row.item_name || row.itemName || row.name || row.product_name);

  return (
    category.includes('BAHAN_BAKU') ||
    category.includes('BAHAN BAKU') ||
    itemName.includes('AYAM') ||
    itemName.includes('CHICKEN')
  );
};

export const isNanaRelatedRow = (row = {}, { allowAyamItemFallback = true } = {}) => {
  const supplierName = getSupplierNameFromRow(row);

  if (isNanaSupplierName(supplierName)) return true;

  if (allowAyamItemFallback && isAyamPurchaseRow(row)) return true;

  return false;
};

const resolveBranchId = (row = {}, fallbackBranchId = 'TANGERANG_PUSAT') => {
  return normalizeCode(
    row.branch_id ||
    row.branchId ||
    row.location_id ||
    row.locationId ||
    row.warehouse_id ||
    row.warehouseId ||
    fallbackBranchId
  ) || fallbackBranchId;
};

const isBranchVisible = (row = {}, branchId = 'ALL') => {
  const targetBranch = normalizeCode(branchId || 'ALL');

  if (targetBranch === 'ALL' || targetBranch === 'GLOBAL') return true;

  const rowBranch = resolveBranchId(row);

  return rowBranch === targetBranch;
};

const resolveLedgerType = (row = {}) => {
  const rawType = normalizeCode(
    row.transaction_type ||
    row.transactionType ||
    row.type ||
    row.mutation_type ||
    row.mutationType ||
    row.ledger_type ||
    row.ledgerType
  );

  if (
    rawType.includes('PAYMENT') ||
    rawType.includes('BAYAR') ||
    rawType.includes('PELUNASAN') ||
    rawType.includes('CICIL') ||
    rawType.includes('CICILAN')
  ) {
    return NANA_LEDGER_TYPES.PAYMENT;
  }

  if (
    rawType.includes('OPENING') ||
    rawType.includes('SALDO_AWAL') ||
    rawType.includes('INJECT') ||
    rawType.includes('AWAL')
  ) {
    return NANA_LEDGER_TYPES.OPENING_BALANCE;
  }

  if (
    rawType.includes('ADJUSTMENT_MINUS') ||
    rawType.includes('KOREKSI_MINUS') ||
    rawType.includes('PENGURANG')
  ) {
    return NANA_LEDGER_TYPES.ADJUSTMENT_MINUS;
  }

  if (
    rawType.includes('ADJUSTMENT') ||
    rawType.includes('KOREKSI') ||
    rawType.includes('TAMBAH')
  ) {
    return NANA_LEDGER_TYPES.ADJUSTMENT_ADD;
  }

  if (
    rawType.includes('VOID') ||
    rawType.includes('DELETE') ||
    rawType.includes('BATAL')
  ) {
    return NANA_LEDGER_TYPES.VOID;
  }

  return NANA_LEDGER_TYPES.PURCHASE;
};

const getAmountFromRow = (row = {}) => {
  return Math.abs(safeNumber(
    row.amount ||
    row.nominal ||
    row.total_amount ||
    row.totalAmount ||
    row.total ||
    row.subtotal ||
    row.value,
    0
  ));
};

const getQtyFromRow = (row = {}) => {
  return safeNumber(
    row.qty ||
    row.quantity ||
    row.qty_kg ||
    row.qtyKg ||
    row.weight ||
    row.berat,
    0
  );
};

const getUnitPriceFromRow = (row = {}) => {
  const direct = safeNumber(
    row.unit_price ||
    row.unitPrice ||
    row.price ||
    row.default_price ||
    row.unit_cost ||
    row.unitCost,
    0
  );

  if (direct > 0) return direct;

  const qty = getQtyFromRow(row);
  const amount = getAmountFromRow(row);

  return qty > 0 ? amount / qty : 0;
};

const getDebtSignByType = (type) => {
  switch (type) {
    case NANA_LEDGER_TYPES.PAYMENT:
    case NANA_LEDGER_TYPES.ADJUSTMENT_MINUS:
      return -1;

    case NANA_LEDGER_TYPES.VOID:
      return 0;

    case NANA_LEDGER_TYPES.OPENING_BALANCE:
    case NANA_LEDGER_TYPES.PURCHASE:
    case NANA_LEDGER_TYPES.ADJUSTMENT_ADD:
    default:
      return 1;
  }
};

const normalizeLedgerRecord = (row = {}, {
  sourceTable = NANA_LEDGER_TABLE,
  fallbackBranchId = 'TANGERANG_PUSAT',
  fallbackType = '',
} = {}) => {
  const type = fallbackType || resolveLedgerType(row);
  const amount = getAmountFromRow(row);
  const sign = getDebtSignByType(type);
  const debtChange = amount * sign;

  const supplierName = getSupplierNameFromRow(row) || NANA_SUPPLIER_CANONICAL_NAME;
  const date = toYmd(row.date || row.created_at || row.createdAt || row.timestamp || new Date());

  return {
    id: row.id || row.ledger_id || row.ledgerId || row.transaction_id || row.transactionId || makeId('NANA-LEDGER'),
    date,
    branch_id: resolveBranchId(row, fallbackBranchId),
    supplier_name: supplierName,
    supplier_key: NANA_SUPPLIER_CANONICAL_NAME,
    transaction_type: type,
    amount,
    debtChange,
    direction: sign > 0 ? 'INCREASE_DEBT' : sign < 0 ? 'DECREASE_DEBT' : 'NO_IMPACT',
    qty: getQtyFromRow(row),
    unit_price: getUnitPriceFromRow(row),
    method: row.method || row.payment_method || row.paymentMethod || row.account || '',
    notes: row.notes || row.note || row.description || row.keterangan || '',
    source_table: sourceTable,
    source_id: row.source_id || row.sourceId || row.purchase_id || row.purchaseId || row.ref_id || row.refId || row.id || '',
    created_by: row.created_by || row.createdBy || row.executor_name || row.executorName || row.admin_name || '',
    raw: row,
  };
};

const buildPurchaseFallbackRecord = (purchase = {}, fallbackBranchId = 'TANGERANG_PUSAT') => {
  return normalizeLedgerRecord({
    ...purchase,
    transaction_type: NANA_LEDGER_TYPES.PURCHASE,
    source_id: purchase.id || purchase.purchase_id || purchase.purchaseId,
    notes: purchase.notes || purchase.description || 'Pembelian ayam / bahan baku Nana',
  }, {
    sourceTable: 'purchases',
    fallbackBranchId,
    fallbackType: NANA_LEDGER_TYPES.PURCHASE,
  });
};

const buildCashflowPaymentFallbackRecord = (cashRow = {}, fallbackBranchId = 'TANGERANG_PUSAT') => {
  return normalizeLedgerRecord({
    ...cashRow,
    transaction_type: NANA_LEDGER_TYPES.PAYMENT,
    source_id: cashRow.id || cashRow.cashflow_id || cashRow.cashflowId,
    notes: cashRow.notes || cashRow.description || 'Pembayaran hutang Nana dari arus kas',
  }, {
    sourceTable: CASHFLOW_TABLE,
    fallbackBranchId,
    fallbackType: NANA_LEDGER_TYPES.PAYMENT,
  });
};

const isCashflowNanaPayment = (row = {}) => {
  const category = normalizeText(row.category || row.subcategory || row.type || row.transaction_type);
  const description = normalizeText(row.description || row.notes || row.note || row.keterangan);
  const method = normalizeText(row.method || row.payment_method || row.account || '');

  const looksLikePaymentOut = (
    category.includes('HUTANG') ||
    category.includes('NANA') ||
    category.includes('AYAM') ||
    description.includes('HUTANG') ||
    description.includes('NANA') ||
    description.includes('AYAM')
  );

  const isOut = (
    normalizeCode(row.type).includes('OUT') ||
    normalizeCode(row.transaction_type).includes('OUT') ||
    normalizeCode(row.direction).includes('OUT')
  );

  return looksLikePaymentOut && (isOut || method.includes('BCA') || method.includes('BRI') || method.includes('CASH'));
};

const makeSourceKey = (record = {}) => {
  return normalizeCode(`${record.source_table || ''}__${record.source_id || record.id || ''}`);
};

export const buildNanaPayableLedger = ({
  supplierLedger = [],
  supplier_ledger = [],
  purchases = [],
  purchases_data = [],
  cashflowTransactions = [],
  cashflow_transactions = [],
  branchId = 'ALL',
  fallbackBranchId = 'TANGERANG_PUSAT',
  includePurchaseFallback = true,
  includeCashflowPaymentFallback = false,
  allowAyamItemFallback = true,
} = {}) => {
  const rawLedgerRows = [
    ...safeArray(supplierLedger),
    ...safeArray(supplier_ledger),
  ];

  const rawPurchases = [
    ...safeArray(purchases),
    ...safeArray(purchases_data),
  ];

  const rawCashflow = [
    ...safeArray(cashflowTransactions),
    ...safeArray(cashflow_transactions),
  ];

  const directLedger = rawLedgerRows
    .filter((row) => !isDeletedRow(row))
    .filter((row) => isBranchVisible(row, branchId))
    .filter((row) => isNanaRelatedRow(row, { allowAyamItemFallback }))
    .map((row) => normalizeLedgerRecord(row, {
      sourceTable: NANA_LEDGER_TABLE,
      fallbackBranchId,
    }));

  const existingSourceKeys = new Set(directLedger.map(makeSourceKey));

  const purchaseFallbackLedger = includePurchaseFallback
    ? rawPurchases
      .filter((row) => !isDeletedRow(row))
      .filter((row) => isBranchVisible(row, branchId))
      .filter((row) => isNanaRelatedRow(row, { allowAyamItemFallback }))
      .map((row) => buildPurchaseFallbackRecord(row, fallbackBranchId))
      .filter((record) => {
        const purchaseKey = normalizeCode(`${NANA_LEDGER_TABLE}__${record.source_id}`);
        const fallbackKey = makeSourceKey(record);

        return !existingSourceKeys.has(purchaseKey) && !existingSourceKeys.has(fallbackKey);
      })
    : [];

  const cashflowPaymentFallbackLedger = includeCashflowPaymentFallback
    ? rawCashflow
      .filter((row) => !isDeletedRow(row))
      .filter((row) => isBranchVisible(row, branchId))
      .filter(isCashflowNanaPayment)
      .map((row) => buildCashflowPaymentFallbackRecord(row, fallbackBranchId))
      .filter((record) => {
        const ledgerKey = normalizeCode(`${NANA_LEDGER_TABLE}__${record.source_id}`);
        const fallbackKey = makeSourceKey(record);

        return !existingSourceKeys.has(ledgerKey) && !existingSourceKeys.has(fallbackKey);
      })
    : [];

  return [
    ...directLedger,
    ...purchaseFallbackLedger,
    ...cashflowPaymentFallbackLedger,
  ].sort((a, b) => {
    const dateDiff = String(b.date).localeCompare(String(a.date));
    if (dateDiff !== 0) return dateDiff;

    return String(b.id).localeCompare(String(a.id));
  });
};

export const calculateNanaPayableSummary = (input = {}) => {
  const ledger = buildNanaPayableLedger(input);

  let openingBalance = 0;
  let totalPurchase = 0;
  let totalPayment = 0;
  let totalAdjustmentAdd = 0;
  let totalAdjustmentMinus = 0;

  let lastPurchaseDate = '';
  let lastPaymentDate = '';
  let lastActivityDate = '';

  ledger.forEach((record) => {
    const amount = safeNumber(record.amount, 0);

    if (!lastActivityDate || record.date > lastActivityDate) {
      lastActivityDate = record.date;
    }

    if (record.transaction_type === NANA_LEDGER_TYPES.OPENING_BALANCE) {
      openingBalance += amount;
    } else if (record.transaction_type === NANA_LEDGER_TYPES.PURCHASE) {
      totalPurchase += amount;
      if (!lastPurchaseDate || record.date > lastPurchaseDate) lastPurchaseDate = record.date;
    } else if (record.transaction_type === NANA_LEDGER_TYPES.PAYMENT) {
      totalPayment += amount;
      if (!lastPaymentDate || record.date > lastPaymentDate) lastPaymentDate = record.date;
    } else if (record.transaction_type === NANA_LEDGER_TYPES.ADJUSTMENT_ADD) {
      totalAdjustmentAdd += amount;
    } else if (record.transaction_type === NANA_LEDGER_TYPES.ADJUSTMENT_MINUS) {
      totalAdjustmentMinus += amount;
    }
  });

  const currentDebt =
    openingBalance +
    totalPurchase +
    totalAdjustmentAdd -
    totalPayment -
    totalAdjustmentMinus;

  const totalIncrease = openingBalance + totalPurchase + totalAdjustmentAdd;
  const totalDecrease = totalPayment + totalAdjustmentMinus;
  const paymentProgressPercent = totalIncrease > 0 ? (totalDecrease / totalIncrease) * 100 : 0;

  return {
    ledger,
    openingBalance,
    totalPurchase,
    totalPayment,
    totalAdjustmentAdd,
    totalAdjustmentMinus,
    totalIncrease,
    totalDecrease,
    currentDebt,
    currentDebtPositive: Math.max(0, currentDebt),
    overpaidAmount: currentDebt < 0 ? Math.abs(currentDebt) : 0,
    paymentProgressPercent,
    lastPurchaseDate,
    lastPaymentDate,
    lastActivityDate,
    isClear: currentDebt <= 0,
  };
};

export const makeNanaPurchaseLedgerRecord = ({
  purchase = {},
  user = {},
  branchId = 'TANGERANG_PUSAT',
} = {}) => {
  const purchaseId = purchase.id || purchase.purchase_id || purchase.purchaseId || makeId('PURCHASE');

  return {
    id: makeId('NANA-PURCHASE'),
    date: toYmd(purchase.date || new Date()),
    branch_id: resolveBranchId(purchase, branchId),
    supplier_name: getSupplierNameFromRow(purchase) || NANA_SUPPLIER_CANONICAL_NAME,
    supplier_key: NANA_SUPPLIER_CANONICAL_NAME,
    transaction_type: NANA_LEDGER_TYPES.PURCHASE,
    amount: getAmountFromRow(purchase),
    qty: getQtyFromRow(purchase),
    unit_price: getUnitPriceFromRow(purchase),
    source_table: 'purchases',
    source_id: purchaseId,
    notes: purchase.notes || purchase.description || 'Pembelian ayam / bahan baku Nana',
    created_at: new Date().toISOString(),
    created_by: user?.name || 'SYSTEM',
    isDeleted: false,
  };
};

export const makeNanaPaymentLedgerRecord = ({
  amount,
  date = new Date(),
  method = 'TF_BCA_PUSAT',
  notes = '',
  user = {},
  branchId = 'TANGERANG_PUSAT',
  sourceId = '',
} = {}) => {
  return {
    id: makeId('NANA-PAYMENT'),
    date: toYmd(date),
    branch_id: normalizeCode(branchId || 'TANGERANG_PUSAT') || 'TANGERANG_PUSAT',
    supplier_name: NANA_SUPPLIER_CANONICAL_NAME,
    supplier_key: NANA_SUPPLIER_CANONICAL_NAME,
    transaction_type: NANA_LEDGER_TYPES.PAYMENT,
    amount: safeNumber(amount, 0),
    method,
    source_table: sourceId ? CASHFLOW_TABLE : 'manual_payment',
    source_id: sourceId,
    notes: notes || 'Pembayaran hutang Nana',
    created_at: new Date().toISOString(),
    created_by: user?.name || 'SYSTEM',
    isDeleted: false,
  };
};

export const makeNanaOpeningBalanceRecord = ({
  amount,
  date = new Date(),
  notes = 'Saldo hutang masa lalu',
  user = {},
  branchId = 'TANGERANG_PUSAT',
} = {}) => {
  return {
    id: makeId('NANA-OPENING'),
    date: toYmd(date),
    branch_id: normalizeCode(branchId || 'TANGERANG_PUSAT') || 'TANGERANG_PUSAT',
    supplier_name: NANA_SUPPLIER_CANONICAL_NAME,
    supplier_key: NANA_SUPPLIER_CANONICAL_NAME,
    transaction_type: NANA_LEDGER_TYPES.OPENING_BALANCE,
    amount: safeNumber(amount, 0),
    method: 'OPENING_BALANCE',
    source_table: 'manual_opening_balance',
    source_id: '',
    notes,
    created_at: new Date().toISOString(),
    created_by: user?.name || 'SYSTEM',
    isDeleted: false,
  };
};

export const makeNanaPaymentCashflowRecord = ({
  amount,
  date = new Date(),
  method = 'TF_BCA_PUSAT',
  notes = '',
  user = {},
  branchId = 'TANGERANG_PUSAT',
  ledgerId = '',
} = {}) => {
  return {
    id: makeId('CASH-NANA-PAYMENT'),
    date: toYmd(date),
    branch_id: normalizeCode(branchId || 'TANGERANG_PUSAT') || 'TANGERANG_PUSAT',
    type: 'OUT',
    transaction_type: 'OUTFLOW',
    category: 'HUTANG SUPPLIER AYAM',
    amount: safeNumber(amount, 0),
    method,
    description: notes || 'Pembayaran hutang Nana Ayam',
    source_table: NANA_LEDGER_TABLE,
    source_id: ledgerId,
    created_at: new Date().toISOString(),
    created_by: user?.name || 'SYSTEM',
    isDeleted: false,
  };
};

export default {
  NANA_SUPPLIER_CANONICAL_NAME,
  NANA_SUPPLIER_KEYWORDS,
  NANA_LEDGER_TYPES,
  NANA_LEDGER_TABLE,
  CASHFLOW_TABLE,
  isNanaSupplierName,
  isNanaRelatedRow,
  buildNanaPayableLedger,
  calculateNanaPayableSummary,
  makeNanaPurchaseLedgerRecord,
  makeNanaPaymentLedgerRecord,
  makeNanaOpeningBalanceRecord,
  makeNanaPaymentCashflowRecord,
};
