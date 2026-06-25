/**
 * ERP DIMSUM ADITYA V2
 * Business Engine: accountingEngine.js
 *
 * Purpose:
 * - Sumber tunggal seluruh jurnal akuntansi ERP Dimsum Aditya.
 * - Semua transaksi ERP harus bisa menghasilkan jurnal.
 *
 * Supported Transaction:
 * - Purchase
 * - Production
 * - Sales
 * - Expense
 * - Kasbon
 * - Hutang
 * - Piutang
 * - Payment
 * - Adjustment
 * - Reversal
 *
 * Important Principles:
 * - Engine ini TIDAK menyimpan data.
 * - Engine ini TIDAK update sheet.
 * - Engine ini TIDAK update database.
 * - Engine ini hanya membaca transaction package dan membuat accounting package.
 * - Jurnal lama tidak boleh berubah.
 * - Reversal wajib membuat jurnal pembalik.
 * - Account wajib dibaca dari master_chart_of_accounts / chart_of_accounts.
 */

import {
  createTransactionSnapshot,
  createSnapshot,
  lockSnapshot,
  readSnapshot,
} from './snapshotEngine';

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const ENGINE_VERSION = 'ERP_DA_V2_ACCOUNTING_ENGINE_1';

const DEFAULT_BRANCH_SCOPE = 'GLOBAL';

const JOURNAL_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  BLOCKED: 'BLOCKED',
  REVERSED: 'REVERSED',
});

const JOURNAL_TYPES = Object.freeze({
  PURCHASE: 'PURCHASE',
  PRODUCTION: 'PRODUCTION',
  SALES: 'SALES',
  EXPENSE: 'EXPENSE',
  PAYMENT: 'PAYMENT',
  KASBON: 'KASBON',
  PAYABLE: 'PAYABLE',
  RECEIVABLE: 'RECEIVABLE',
  ADJUSTMENT: 'ADJUSTMENT',
  REVERSAL: 'REVERSAL',
  MANUAL: 'MANUAL',
});

export const ACCOUNT_ROLES = Object.freeze({
  CASH: 'CASH',
  BANK: 'BANK',
  ACCOUNTS_RECEIVABLE: 'ACCOUNTS_RECEIVABLE',
  ACCOUNTS_PAYABLE: 'ACCOUNTS_PAYABLE',

  INVENTORY_RAW_MATERIAL: 'INVENTORY_RAW_MATERIAL',
  INVENTORY_FINISHED_GOODS: 'INVENTORY_FINISHED_GOODS',
  PRODUCTION_WIP: 'PRODUCTION_WIP',

  SALES_REVENUE: 'SALES_REVENUE',
  COST_OF_GOODS_SOLD: 'COST_OF_GOODS_SOLD',
  OPERATING_EXPENSE: 'OPERATING_EXPENSE',

  CASH_ADVANCE: 'CASH_ADVANCE',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',

  ADJUSTMENT_GAIN: 'ADJUSTMENT_GAIN',
  ADJUSTMENT_LOSS: 'ADJUSTMENT_LOSS',
});

const ROLE_ALIASES = Object.freeze({
  CASH: ['CASH', 'KAS', 'CASH_ON_HAND'],
  BANK: ['BANK', 'REKENING_BANK'],

  ACCOUNTS_RECEIVABLE: ['ACCOUNTS_RECEIVABLE', 'AR', 'PIUTANG', 'PIUTANG_USAHA'],
  ACCOUNTS_PAYABLE: ['ACCOUNTS_PAYABLE', 'AP', 'HUTANG', 'HUTANG_USAHA', 'HUTANG_SUPPLIER'],

  INVENTORY_RAW_MATERIAL: [
    'INVENTORY_RAW_MATERIAL',
    'RAW_MATERIAL_INVENTORY',
    'PERSEDIAAN_BAHAN_BAKU',
    'STOK_BAHAN_BAKU',
  ],

  INVENTORY_FINISHED_GOODS: [
    'INVENTORY_FINISHED_GOODS',
    'FINISHED_GOODS_INVENTORY',
    'PERSEDIAAN_BARANG_JADI',
    'STOK_BARANG_JADI',
  ],

  PRODUCTION_WIP: [
    'PRODUCTION_WIP',
    'WIP',
    'WORK_IN_PROCESS',
    'BARANG_DALAM_PROSES',
  ],

  SALES_REVENUE: ['SALES_REVENUE', 'REVENUE', 'PENDAPATAN_PENJUALAN', 'OMZET'],
  COST_OF_GOODS_SOLD: ['COST_OF_GOODS_SOLD', 'COGS', 'HPP', 'BEBAN_POKOK_PENJUALAN'],
  OPERATING_EXPENSE: ['OPERATING_EXPENSE', 'OPEX', 'BEBAN_OPERASIONAL', 'EXPENSE'],

  CASH_ADVANCE: ['CASH_ADVANCE', 'KASBON', 'KASBON_KARYAWAN'],
  LIABILITY: ['LIABILITY', 'KEWAJIBAN'],
  EQUITY: ['EQUITY', 'MODAL'],

  ADJUSTMENT_GAIN: ['ADJUSTMENT_GAIN', 'PENDAPATAN_ADJUSTMENT', 'GAIN'],
  ADJUSTMENT_LOSS: ['ADJUSTMENT_LOSS', 'BEBAN_ADJUSTMENT', 'LOSS'],
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

const normalizeBranchId = (branchId) => {
  const normalized = normalizeCode(branchId || DEFAULT_BRANCH_SCOPE);
  return normalized || DEFAULT_BRANCH_SCOPE;
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

const generateId = (prefix = 'ID') => {
  const safePrefix = normalizeCode(prefix || 'ID') || 'ID';
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

  const value = row.isDeleted ?? row.deleted;
  if (value === undefined || value === null || value === '') return false;

  const normalized = String(value).trim().toUpperCase();
  return ['TRUE', 'YES', 'YA', 'Y', '1'].includes(normalized);
};

const isInactiveRow = (row) => {
  if (!isObject(row)) return true;

  const status = row.status ?? row.status_active ?? row.is_active ?? row.active;

  if (status === undefined || status === null || status === '') return false;
  if (typeof status === 'boolean') return !status;

  const normalized = String(status).trim().toUpperCase();

  return ['FALSE', 'NO', 'TIDAK', 'N', '0', 'INACTIVE', 'NONAKTIF', 'DISABLED'].includes(normalized);
};

/* =========================================================================
   COA EXTRACTION & NORMALIZATION
   ========================================================================= */

export const extractChartOfAccounts = (source = {}) => {
  if (Array.isArray(source)) return source;

  if (!isObject(source)) return [];

  if (Array.isArray(source.master_chart_of_accounts)) return source.master_chart_of_accounts;
  if (Array.isArray(source.masterChartOfAccounts)) return source.masterChartOfAccounts;

  if (Array.isArray(source.chart_of_accounts)) return source.chart_of_accounts;
  if (Array.isArray(source.chartOfAccounts)) return source.chartOfAccounts;

  if (isObject(source.dbData)) {
    if (Array.isArray(source.dbData.master_chart_of_accounts)) return source.dbData.master_chart_of_accounts;
    if (Array.isArray(source.dbData.masterChartOfAccounts)) return source.dbData.masterChartOfAccounts;
    if (Array.isArray(source.dbData.chart_of_accounts)) return source.dbData.chart_of_accounts;
    if (Array.isArray(source.dbData.chartOfAccounts)) return source.dbData.chartOfAccounts;
  }

  if (isObject(source.source)) {
    return extractChartOfAccounts(source.source);
  }

  return [];
};

const normalizeAccountRoles = (account = {}) => {
  const rawRole = firstDefined(account, [
    'account_role',
    'role',
    'coa_role',
    'accountRole',
    'account_category',
    'category',
    'kategori',
    'type',
    'account_type',
  ]);

  const rawTags = firstDefined(account, [
    'tags',
    'account_tags',
    'role_tags',
  ]);

  const roles = new Set();

  if (rawRole !== undefined) {
    String(rawRole)
      .split(/[|,;/]+/)
      .map(normalizeCode)
      .filter(Boolean)
      .forEach((role) => roles.add(role));
  }

  if (rawTags !== undefined) {
    String(rawTags)
      .split(/[|,;/]+/)
      .map(normalizeCode)
      .filter(Boolean)
      .forEach((role) => roles.add(role));
  }

  return Array.from(roles);
};

export const normalizeAccount = (account = {}, index = 0) => {
  const accountCode = String(
    firstDefined(account, [
      'account_code',
      'accountCode',
      'coa_code',
      'code',
      'kode_akun',
      'id',
    ]) || '',
  ).trim();

  const accountName = String(
    firstDefined(account, [
      'account_name',
      'accountName',
      'coa_name',
      'name',
      'nama_akun',
    ]) || '',
  ).trim();

  const branchId = normalizeBranchId(
    firstDefined(account, [
      'branch_id',
      'branchId',
      'scope_branch_id',
    ]) || DEFAULT_BRANCH_SCOPE,
  );

  const normalBalance = normalizeCode(
    firstDefined(account, [
      'normal_balance',
      'normalBalance',
      'saldo_normal',
    ]) || '',
  );

  return {
    id: String(account.id || accountCode || `ACCOUNT_ROW_${index + 1}`).trim(),
    account_code: accountCode,
    account_name: accountName,
    account_type: normalizeCode(
      firstDefined(account, [
        'account_type',
        'accountType',
        'type',
        'kategori',
      ]) || '',
    ),
    roles: normalizeAccountRoles(account),
    normal_balance: normalBalance,
    branch_id: branchId,
    is_active: !isDeletedRow(account) && !isInactiveRow(account),
    raw: { ...account },
  };
};

export const normalizeChartOfAccounts = (source = {}) => {
  const rawAccounts = extractChartOfAccounts(source);
  const warnings = [];

  const accounts = rawAccounts
    .map((account, index) => {
      if (!isObject(account)) {
        warnings.push(makeWarning('INVALID_ACCOUNT_ROW', 'Row COA bukan object valid.', { index }));
        return null;
      }

      const normalized = normalizeAccount(account, index);

      if (!normalized.account_code) {
        warnings.push(makeWarning('INVALID_ACCOUNT_CODE', 'Account COA tidak memiliki account_code.', {
          index,
          account_name: normalized.account_name,
        }));
      }

      if (!normalized.account_name) {
        warnings.push(makeWarning('INVALID_ACCOUNT_NAME', 'Account COA tidak memiliki account_name.', {
          index,
          account_code: normalized.account_code,
        }));
      }

      if (!normalized.is_active) return null;

      return normalized;
    })
    .filter(Boolean);

  return {
    accounts,
    raw_count: rawAccounts.length,
    warnings,
  };
};

const normalizeAccountRoleMap = (roleMap = {}) => {
  if (!isObject(roleMap)) return {};

  const normalized = {};

  Object.keys(roleMap).forEach((roleKey) => {
    const normalizedRole = normalizeCode(roleKey);
    const value = roleMap[roleKey];

    if (!normalizedRole || !value) return;

    if (isObject(value)) {
      normalized[normalizedRole] = {
        account_code: String(value.account_code || value.accountCode || value.code || '').trim(),
        account_name: String(value.account_name || value.accountName || value.name || '').trim(),
        account_type: normalizeCode(value.account_type || value.type || ''),
        roles: [normalizedRole],
        normal_balance: normalizeCode(value.normal_balance || value.normalBalance || ''),
        branch_id: normalizeBranchId(value.branch_id || DEFAULT_BRANCH_SCOPE),
        is_active: true,
        raw: { ...value },
      };
      return;
    }

    normalized[normalizedRole] = {
      account_code: String(value).trim(),
      account_name: '',
      account_type: '',
      roles: [normalizedRole],
      normal_balance: '',
      branch_id: DEFAULT_BRANCH_SCOPE,
      is_active: true,
      raw: { account_code: String(value).trim() },
    };
  });

  return normalized;
};

const getRoleAliases = (role) => {
  const normalizedRole = normalizeCode(role);
  const aliases = ROLE_ALIASES[normalizedRole] || [normalizedRole];

  return Array.from(new Set([normalizedRole, ...aliases.map(normalizeCode)]));
};

const accountScopeMatches = (account, branchId) => {
  const requestedBranch = normalizeBranchId(branchId || DEFAULT_BRANCH_SCOPE);
  const accountBranch = normalizeBranchId(account.branch_id || DEFAULT_BRANCH_SCOPE);

  if (!requestedBranch || requestedBranch === DEFAULT_BRANCH_SCOPE || requestedBranch === 'ALL') return true;
  if (!accountBranch || accountBranch === DEFAULT_BRANCH_SCOPE || accountBranch === 'ALL') return true;

  return accountBranch === requestedBranch;
};

const buildAccountCatalog = (options = {}) => {
  const normalizedCoa = normalizeChartOfAccounts(options);
  const roleMap = normalizeAccountRoleMap(options.accountRoleMap || options.account_role_map || {});

  const accounts = [...normalizedCoa.accounts];

  Object.keys(roleMap).forEach((role) => {
    const override = roleMap[role];
    if (!override.account_code) return;

    const existing = accounts.find((account) => account.account_code === override.account_code);

    if (existing) {
      if (!existing.roles.includes(role)) {
        existing.roles.push(role);
      }
      return;
    }

    accounts.push(override);
  });

  return {
    accounts,
    warnings: normalizedCoa.warnings,
    raw_count: normalizedCoa.raw_count,
  };
};

const resolveAccountByCode = (accountCode, options = {}) => {
  const catalog = buildAccountCatalog(options);
  const code = String(accountCode || '').trim();
  const branchId = normalizeBranchId(options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE);

  const account = catalog.accounts.find((candidate) => {
    return candidate.account_code === code && accountScopeMatches(candidate, branchId);
  }) || null;

  if (!account) {
    return {
      ok: false,
      account: null,
      warnings: [
        ...catalog.warnings,
        makeWarning('ACCOUNT_NOT_FOUND', 'Account code tidak ditemukan di master_chart_of_accounts.', {
          account_code: code,
          branch_id: branchId,
        }),
      ],
    };
  }

  return {
    ok: true,
    account,
    warnings: catalog.warnings,
  };
};

const resolveAccountByRole = (role, options = {}) => {
  const catalog = buildAccountCatalog(options);
  const branchId = normalizeBranchId(options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE);

  const aliases = getRoleAliases(role);

  const account = catalog.accounts.find((candidate) => {
    if (!accountScopeMatches(candidate, branchId)) return false;

    const roles = Array.isArray(candidate.roles) ? candidate.roles.map(normalizeCode) : [];
    return aliases.some((alias) => roles.includes(alias));
  }) || null;

  if (!account) {
    return {
      ok: false,
      account: null,
      warnings: [
        ...catalog.warnings,
        makeWarning('ACCOUNT_ROLE_NOT_FOUND', 'Account role tidak ditemukan di master_chart_of_accounts.', {
          role: normalizeCode(role),
          aliases,
          branch_id: branchId,
        }),
      ],
    };
  }

  return {
    ok: true,
    account,
    warnings: catalog.warnings,
  };
};

const resolveRequiredAccount = (role, options = {}) => {
  const roleKey = normalizeCode(role);
  const roleMap = options.accountRoleMap || options.account_role_map || {};

  const directOverride = isObject(roleMap)
    ? roleMap[roleKey] || roleMap[role] || null
    : null;

  if (directOverride && !isObject(directOverride)) {
    return resolveAccountByCode(directOverride, options);
  }

  if (directOverride && isObject(directOverride) && (directOverride.account_code || directOverride.code)) {
    const account = normalizeAccount({
      ...directOverride,
      account_role: roleKey,
    });

    return {
      ok: true,
      account,
      warnings: [],
    };
  }

  return resolveAccountByRole(roleKey, options);
};

const assertCoaAvailable = (options = {}) => {
  const catalog = buildAccountCatalog(options);

  if (catalog.accounts.length === 0 && options.requireCoa !== false && options.require_coa !== false) {
    return {
      ok: false,
      warnings: [
        ...catalog.warnings,
        makeWarning('ACCOUNT_MASTER_NOT_PROVIDED', 'master_chart_of_accounts / chart_of_accounts belum tersedia. Jurnal tidak boleh diposting tanpa COA resmi.'),
      ],
    };
  }

  return {
    ok: true,
    warnings: catalog.warnings,
  };
};

/* =========================================================================
   JOURNAL LINE HELPERS
   ========================================================================= */

const createJournalLine = (account, debit = 0, credit = 0, description = '', meta = {}) => ({
  line_id: generateId('JRN-LINE'),
  account_code: account?.account_code || '',
  account_name: account?.account_name || '',
  account_type: account?.account_type || '',
  account_role: Array.isArray(account?.roles) ? account.roles[0] || '' : '',
  debit: roundMoney(debit),
  credit: roundMoney(credit),
  description: String(description || '').trim(),
  meta,
});

const addLine = (lines, accountResult, debit, credit, description, meta, warnings) => {
  if (!accountResult.ok || !accountResult.account) {
    warnings.push(...accountResult.warnings);
    return;
  }

  lines.push(createJournalLine(accountResult.account, debit, credit, description, meta));
};

const calculateLineTotals = (journalLines = []) => {
  const totalDebit = roundMoney(
    safeArray(journalLines).reduce((sum, line) => sum + safeNumber(line.debit, 0), 0),
  );

  const totalCredit = roundMoney(
    safeArray(journalLines).reduce((sum, line) => sum + safeNumber(line.credit, 0), 0),
  );

  return {
    total_debit: totalDebit,
    total_credit: totalCredit,
    difference: roundMoney(totalDebit - totalCredit),
  };
};

/* =========================================================================
   VALIDATE JOURNAL
   ========================================================================= */

export const validateJournal = (journal = {}, options = {}) => {
  const warnings = [];

  const header = journal.journal_header || journal.header || journal;
  const lines = safeArray(journal.journal_lines || journal.lines || journal.entries);

  const journalDate = normalizeDateString(header.journal_date || header.date || '');

  const coaCheck = assertCoaAvailable(options);
  warnings.push(...coaCheck.warnings);

  if (!coaCheck.ok) {
    warnings.push(makeWarning('COA_VALIDATION_FAILED', 'Validasi COA gagal.'));
  }

  if (!journalDate) {
    warnings.push(makeWarning('INVALID_JOURNAL_DATE', 'Tanggal jurnal tidak valid.', {
      journal_date: header.journal_date || header.date,
    }));
  }

  if (lines.length === 0) {
    warnings.push(makeWarning('EMPTY_JOURNAL_LINES', 'Journal lines kosong.'));
  }

  lines.forEach((line, index) => {
    const accountCode = String(line.account_code || '').trim();
    const accountName = String(line.account_name || '').trim();
    const debit = safeNumber(line.debit, 0);
    const credit = safeNumber(line.credit, 0);

    if (!accountCode) {
      warnings.push(makeWarning('MISSING_ACCOUNT_CODE', 'Journal line tidak memiliki account_code.', {
        index,
      }));
    }

    if (!accountName) {
      warnings.push(makeWarning('MISSING_ACCOUNT_NAME', 'Journal line tidak memiliki account_name.', {
        index,
        account_code: accountCode,
      }));
    }

    if (debit < 0 || credit < 0) {
      warnings.push(makeWarning('NEGATIVE_JOURNAL_AMOUNT', 'Debit/Credit tidak boleh negatif.', {
        index,
        account_code: accountCode,
        debit,
        credit,
      }));
    }

    if (debit > 0 && credit > 0) {
      warnings.push(makeWarning('DOUBLE_SIDED_JOURNAL_LINE', 'Satu journal line tidak boleh memiliki debit dan credit sekaligus.', {
        index,
        account_code: accountCode,
        debit,
        credit,
      }));
    }

    if (debit === 0 && credit === 0) {
      warnings.push(makeWarning('ZERO_JOURNAL_LINE', 'Journal line bernilai 0.', {
        index,
        account_code: accountCode,
      }));
    }

    if (accountCode) {
      const accountResult = resolveAccountByCode(accountCode, options);

      if (!accountResult.ok && options.allowUnknownAccounts !== true && options.allow_unknown_accounts !== true) {
        warnings.push(...accountResult.warnings);
      }
    }
  });

  const totals = calculateLineTotals(lines);

  if (Math.abs(totals.difference) > 0.009) {
    warnings.push(makeWarning('JOURNAL_NOT_BALANCED', 'Total debit dan credit tidak seimbang.', {
      total_debit: totals.total_debit,
      total_credit: totals.total_credit,
      difference: totals.difference,
    }));
  }

  const blockingCodes = new Set([
    'ACCOUNT_MASTER_NOT_PROVIDED',
    'COA_VALIDATION_FAILED',
    'INVALID_JOURNAL_DATE',
    'EMPTY_JOURNAL_LINES',
    'MISSING_ACCOUNT_CODE',
    'MISSING_ACCOUNT_NAME',
    'NEGATIVE_JOURNAL_AMOUNT',
    'DOUBLE_SIDED_JOURNAL_LINE',
    'ZERO_JOURNAL_LINE',
    'ACCOUNT_NOT_FOUND',
    'JOURNAL_NOT_BALANCED',
  ]);

  return {
    ok: !warnings.some((warning) => blockingCodes.has(warning.code)),
    totals,
    warnings,
  };
};

/* =========================================================================
   LEDGER POSTING
   ========================================================================= */

export const createLedgerPosting = (journalHeaderInput = {}, journalLinesInput = [], options = {}) => {
  const journalHeader = journalHeaderInput.journal_header || journalHeaderInput;
  const journalLines = safeArray(
    journalHeaderInput.journal_lines ||
    journalHeaderInput.lines ||
    journalLinesInput,
  );

  const warnings = [];

  const ledgerPostings = journalLines.map((line, index) => {
    const debit = roundMoney(line.debit || 0);
    const credit = roundMoney(line.credit || 0);

    return {
      posting_id: generateId('LEDGER'),

      journal_id: journalHeader.journal_id || journalHeader.id || '',
      journal_date: journalHeader.journal_date || journalHeader.date || '',
      branch_id: journalHeader.branch_id || DEFAULT_BRANCH_SCOPE,

      line_index: index,
      line_id: line.line_id || '',

      account_code: line.account_code || '',
      account_name: line.account_name || '',
      account_type: line.account_type || '',
      account_role: line.account_role || '',

      debit,
      credit,
      signed_amount: roundMoney(debit - credit),

      description: line.description || journalHeader.description || '',
      source_transaction_type: journalHeader.source_transaction_type || journalHeader.transaction_type || '',
      source_transaction_id: journalHeader.source_transaction_id || journalHeader.transaction_id || '',

      created_at: new Date().toISOString(),
      created_by: journalHeader.created_by || '',
      isDeleted: false,
    };
  });

  if (ledgerPostings.length === 0) {
    warnings.push(makeWarning('EMPTY_LEDGER_POSTINGS', 'Ledger postings kosong.'));
  }

  return {
    ok: ledgerPostings.length > 0,
    ledger_postings: ledgerPostings,
    warnings,
  };
};

/* =========================================================================
   ACCOUNTING SNAPSHOT & PACKAGE
   ========================================================================= */

const createAccountingSnapshot = (input = {}, options = {}) => {
  const journalHeader = input.journal_header || input.journalHeader || {};
  const journalId = journalHeader.journal_id || journalHeader.id || input.journal_id || input.journalId || '';

  const snapshotResult = createTransactionSnapshot({
    snapshot_type: 'TRANSACTION',
    transaction_id: journalId,
    transaction_type: 'ACCOUNTING_JOURNAL',

    branch_id: journalHeader.branch_id || input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE,
    created_by: journalHeader.created_by || input.created_by || input.createdBy || 'SYSTEM',

    transaction_header: journalHeader,
    transaction_items: safeArray(input.journal_lines || input.journalLines),

    additional_payload: {
      journal_header: journalHeader,
      journal_lines: safeArray(input.journal_lines || input.journalLines),
      ledger_postings: safeArray(input.ledger_postings || input.ledgerPostings),
      source_transaction: input.source_transaction || input.sourceTransaction || null,
      validation: input.validation || null,
    },

    warnings: input.warnings || [],

    engine_versions: {
      accountingEngine: ENGINE_VERSION,
    },

    meta: {
      source_module: 'accountingEngine',
      source_table: 'general_ledger',
      source_id: journalId,
      journal_type: journalHeader.journal_type || '',
    },
  }, {
    lock: options.lock !== false,
    allowInvalid: options.allowInvalid,
  });

  return {
    ok: snapshotResult.ok,
    snapshot: snapshotResult.snapshot,
    warnings: snapshotResult.warnings,
  };
};

const createJournalPackage = (params = {}, options = {}) => {
  const warnings = safeArray(params.warnings);

  const journalId = params.journal_id || params.journalId || generateId('JRN');
  const journalDate = normalizeDateString(params.journal_date || params.journalDate || params.date || getTodayISO());
  const branchId = normalizeBranchId(params.branch_id || params.branchId || DEFAULT_BRANCH_SCOPE);

  const journalLines = safeArray(params.journal_lines || params.journalLines || []);

  const totals = calculateLineTotals(journalLines);

  const journalHeader = {
    id: journalId,
    journal_id: journalId,

    date: journalDate,
    journal_date: journalDate,

    branch_id: branchId,

    journal_type: normalizeCode(params.journal_type || params.journalType || JOURNAL_TYPES.MANUAL),
    source_transaction_type: normalizeCode(params.source_transaction_type || params.sourceTransactionType || ''),
    source_transaction_id: String(params.source_transaction_id || params.sourceTransactionId || '').trim(),

    description: String(params.description || '').trim(),

    total_debit: totals.total_debit,
    total_credit: totals.total_credit,
    difference: totals.difference,

    status: JOURNAL_STATUS.DRAFT,

    created_at: new Date().toISOString(),
    created_by: String(params.created_by || params.createdBy || 'SYSTEM').trim(),
    isDeleted: false,
  };

  const validation = validateJournal({
    journal_header: journalHeader,
    journal_lines: journalLines,
  }, options);

  warnings.push(...validation.warnings);

  const ledgerResult = createLedgerPosting(journalHeader, journalLines, options);
  warnings.push(...ledgerResult.warnings);

  const accountingSnapshotResult = createAccountingSnapshot({
    journal_header: {
      ...journalHeader,
      status: validation.ok ? JOURNAL_STATUS.POSTED : JOURNAL_STATUS.BLOCKED,
    },
    journal_lines: journalLines,
    ledger_postings: ledgerResult.ledger_postings,
    source_transaction: params.source_transaction || null,
    validation,
    warnings,
  }, {
    lock: true,
  });

  warnings.push(...accountingSnapshotResult.warnings);

  const finalHeader = {
    ...journalHeader,
    status: validation.ok && ledgerResult.ok && accountingSnapshotResult.ok
      ? JOURNAL_STATUS.POSTED
      : JOURNAL_STATUS.BLOCKED,
    accounting_snapshot_json: accountingSnapshotResult.snapshot
      ? JSON.stringify(accountingSnapshotResult.snapshot)
      : '',
  };

  const journalPackage = {
    package_type: 'JOURNAL_PACKAGE',
    package_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),

    journal_header: finalHeader,
    journal_lines: journalLines,
    ledger_postings: ledgerResult.ledger_postings,

    accounting_snapshot: accountingSnapshotResult.snapshot || null,

    status: finalHeader.status,
    warnings,
  };

  return {
    ok: finalHeader.status === JOURNAL_STATUS.POSTED,
    journal_package: journalPackage,
    warnings,
  };
};

/* =========================================================================
   GENERIC JOURNAL ENTRY
   ========================================================================= */

export const createJournalEntry = (input = {}, options = {}) => {
  const linesInput = safeArray(input.journal_lines || input.journalLines || input.lines);
  const warnings = [];

  const journalLines = linesInput.map((line) => ({
    line_id: line.line_id || line.lineId || generateId('JRN-LINE'),
    account_code: String(line.account_code || line.accountCode || '').trim(),
    account_name: String(line.account_name || line.accountName || '').trim(),
    account_type: normalizeCode(line.account_type || line.accountType || ''),
    account_role: normalizeCode(line.account_role || line.accountRole || ''),
    debit: roundMoney(line.debit || 0),
    credit: roundMoney(line.credit || 0),
    description: String(line.description || input.description || '').trim(),
    meta: isObject(line.meta) ? line.meta : {},
  }));

  return createJournalPackage({
    journal_id: input.journal_id || input.journalId || input.id || generateId('JRN'),
    journal_date: input.journal_date || input.journalDate || input.date || getTodayISO(),
    branch_id: input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE,
    journal_type: input.journal_type || input.journalType || JOURNAL_TYPES.MANUAL,
    source_transaction_type: input.source_transaction_type || input.sourceTransactionType || '',
    source_transaction_id: input.source_transaction_id || input.sourceTransactionId || '',
    description: input.description || 'Manual Journal Entry',
    created_by: input.created_by || input.createdBy || input.operator || 'SYSTEM',
    journal_lines: journalLines,
    source_transaction: input.source_transaction || input.sourceTransaction || null,
    warnings,
  }, options);
};

/* =========================================================================
   PURCHASE JOURNAL
   ========================================================================= */

export const createPurchaseJournal = (purchaseInput = {}, options = {}) => {
  const warnings = [];

  const packageInput = purchaseInput.purchase_transaction_package ||
    purchaseInput.purchaseTransactionPackage ||
    purchaseInput;

  const purchaseHeader = packageInput.purchase_header || purchaseInput.purchase_header || {};
  const sourceId = purchaseHeader.purchase_id || purchaseHeader.id || '';
  const branchId = normalizeBranchId(purchaseHeader.branch_id || DEFAULT_BRANCH_SCOPE);

  const totalAmount = roundMoney(purchaseHeader.total_amount || 0);
  const amountPaid = roundMoney(purchaseHeader.amount_paid || 0);
  const remainingAmount = roundMoney(purchaseHeader.remaining_amount || Math.max(totalAmount - amountPaid, 0));

  const scopedOptions = {
    ...options,
    branchId,
    branch_id: branchId,
  };

  const inventoryAccount = resolveRequiredAccount(ACCOUNT_ROLES.INVENTORY_RAW_MATERIAL, scopedOptions);
  const cashAccount = resolveRequiredAccount(ACCOUNT_ROLES.CASH, scopedOptions);
  const payableAccount = resolveRequiredAccount(ACCOUNT_ROLES.ACCOUNTS_PAYABLE, scopedOptions);

  const lines = [];

  addLine(
    lines,
    inventoryAccount,
    totalAmount,
    0,
    `Pembelian bahan dari ${purchaseHeader.supplier_name || 'supplier'}`,
    { role: ACCOUNT_ROLES.INVENTORY_RAW_MATERIAL },
    warnings,
  );

  if (amountPaid > 0) {
    addLine(
      lines,
      cashAccount,
      0,
      amountPaid,
      `Pembayaran pembelian ${purchaseHeader.invoice_number || sourceId}`,
      { role: ACCOUNT_ROLES.CASH },
      warnings,
    );
  }

  if (remainingAmount > 0) {
    addLine(
      lines,
      payableAccount,
      0,
      remainingAmount,
      `Hutang supplier ${purchaseHeader.supplier_name || ''}`,
      { role: ACCOUNT_ROLES.ACCOUNTS_PAYABLE },
      warnings,
    );
  }

  return createJournalPackage({
    journal_id: generateId('JRN-PUR'),
    journal_date: purchaseHeader.purchase_date || purchaseHeader.date || getTodayISO(),
    branch_id: branchId,
    journal_type: JOURNAL_TYPES.PURCHASE,
    source_transaction_type: 'PURCHASE',
    source_transaction_id: sourceId,
    description: `Jurnal pembelian ${purchaseHeader.invoice_number || sourceId}`,
    created_by: purchaseHeader.created_by || purchaseHeader.operator || 'SYSTEM',
    journal_lines: lines,
    source_transaction: packageInput,
    warnings,
  }, scopedOptions);
};

/* =========================================================================
   SALES JOURNAL
   ========================================================================= */

export const createSalesJournal = (salesInput = {}, options = {}) => {
  const warnings = [];

  const packageInput = salesInput.sales_transaction_package ||
    salesInput.salesTransactionPackage ||
    salesInput;

  const orderHeader = packageInput.order_header || salesInput.order_header || {};
  const sourceId = orderHeader.order_id || orderHeader.id || '';
  const branchId = normalizeBranchId(orderHeader.branch_id || DEFAULT_BRANCH_SCOPE);

  const totalRevenue = roundMoney(orderHeader.total_revenue || orderHeader.total_amount || 0);
  const amountPaid = roundMoney(orderHeader.amount_paid || 0);
  const remainingAmount = roundMoney(orderHeader.remaining_amount || Math.max(totalRevenue - amountPaid, 0));
  const totalHpp = roundMoney(orderHeader.total_hpp || 0);

  const scopedOptions = {
    ...options,
    branchId,
    branch_id: branchId,
  };

  const cashAccount = resolveRequiredAccount(ACCOUNT_ROLES.CASH, scopedOptions);
  const receivableAccount = resolveRequiredAccount(ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE, scopedOptions);
  const revenueAccount = resolveRequiredAccount(ACCOUNT_ROLES.SALES_REVENUE, scopedOptions);
  const cogsAccount = resolveRequiredAccount(ACCOUNT_ROLES.COST_OF_GOODS_SOLD, scopedOptions);
  const finishedGoodsAccount = resolveRequiredAccount(ACCOUNT_ROLES.INVENTORY_FINISHED_GOODS, scopedOptions);

  const lines = [];

  if (amountPaid > 0) {
    addLine(
      lines,
      cashAccount,
      amountPaid,
      0,
      `Kas masuk invoice ${orderHeader.invoice_number || sourceId}`,
      { role: ACCOUNT_ROLES.CASH },
      warnings,
    );
  }

  if (remainingAmount > 0) {
    addLine(
      lines,
      receivableAccount,
      remainingAmount,
      0,
      `Piutang invoice ${orderHeader.invoice_number || sourceId}`,
      { role: ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE },
      warnings,
    );
  }

  addLine(
    lines,
    revenueAccount,
    0,
    totalRevenue,
    `Penjualan invoice ${orderHeader.invoice_number || sourceId}`,
    { role: ACCOUNT_ROLES.SALES_REVENUE },
    warnings,
  );

  if (totalHpp > 0) {
    addLine(
      lines,
      cogsAccount,
      totalHpp,
      0,
      `HPP invoice ${orderHeader.invoice_number || sourceId}`,
      { role: ACCOUNT_ROLES.COST_OF_GOODS_SOLD },
      warnings,
    );

    addLine(
      lines,
      finishedGoodsAccount,
      0,
      totalHpp,
      `Pengurangan persediaan barang jadi invoice ${orderHeader.invoice_number || sourceId}`,
      { role: ACCOUNT_ROLES.INVENTORY_FINISHED_GOODS },
      warnings,
    );
  }

  return createJournalPackage({
    journal_id: generateId('JRN-SALES'),
    journal_date: orderHeader.order_date || orderHeader.date || getTodayISO(),
    branch_id: branchId,
    journal_type: JOURNAL_TYPES.SALES,
    source_transaction_type: 'SALES_ORDER',
    source_transaction_id: sourceId,
    description: `Jurnal penjualan ${orderHeader.invoice_number || sourceId}`,
    created_by: orderHeader.created_by || orderHeader.operator || 'SYSTEM',
    journal_lines: lines,
    source_transaction: packageInput,
    warnings,
  }, scopedOptions);
};

/* =========================================================================
   PRODUCTION JOURNAL
   ========================================================================= */

export const createProductionJournal = (productionInput = {}, options = {}) => {
  const warnings = [];

  const packageInput = productionInput.production_batch_package ||
    productionInput.productionBatchPackage ||
    productionInput;

  const batchHeader = packageInput.batch_header || productionInput.batch_header || {};
  const sourceId = batchHeader.batch_id || batchHeader.id || '';
  const branchId = normalizeBranchId(batchHeader.branch_id || DEFAULT_BRANCH_SCOPE);

  const totalHpp = roundMoney(batchHeader.total_hpp || 0);

  const scopedOptions = {
    ...options,
    branchId,
    branch_id: branchId,
  };

  const finishedGoodsAccount = resolveRequiredAccount(ACCOUNT_ROLES.INVENTORY_FINISHED_GOODS, scopedOptions);
  const rawMaterialAccount = resolveRequiredAccount(ACCOUNT_ROLES.INVENTORY_RAW_MATERIAL, scopedOptions);

  const lines = [];

  addLine(
    lines,
    finishedGoodsAccount,
    totalHpp,
    0,
    `Produksi barang jadi batch ${sourceId}`,
    { role: ACCOUNT_ROLES.INVENTORY_FINISHED_GOODS },
    warnings,
  );

  addLine(
    lines,
    rawMaterialAccount,
    0,
    totalHpp,
    `Pemakaian bahan baku batch ${sourceId}`,
    { role: ACCOUNT_ROLES.INVENTORY_RAW_MATERIAL },
    warnings,
  );

  return createJournalPackage({
    journal_id: generateId('JRN-PROD'),
    journal_date: batchHeader.production_date || batchHeader.date || getTodayISO(),
    branch_id: branchId,
    journal_type: JOURNAL_TYPES.PRODUCTION,
    source_transaction_type: 'PRODUCTION_BATCH',
    source_transaction_id: sourceId,
    description: `Jurnal produksi batch ${sourceId}`,
    created_by: batchHeader.created_by || batchHeader.operator || 'SYSTEM',
    journal_lines: lines,
    source_transaction: packageInput,
    warnings,
  }, scopedOptions);
};

/* =========================================================================
   EXPENSE JOURNAL
   ========================================================================= */

export const createExpenseJournal = (expenseInput = {}, options = {}) => {
  const warnings = [];

  const expense = expenseInput.expense || expenseInput;
  const sourceId = expense.expense_id || expense.id || '';
  const branchId = normalizeBranchId(expense.branch_id || expense.branchId || DEFAULT_BRANCH_SCOPE);

  const amount = roundMoney(expense.amount || expense.total_amount || 0);
  const amountPaid = roundMoney(expense.amount_paid ?? expense.amountPaid ?? amount);
  const remainingAmount = roundMoney(Math.max(amount - amountPaid, 0));

  const scopedOptions = {
    ...options,
    branchId,
    branch_id: branchId,
  };

  const expenseAccount = expense.account_code
    ? resolveAccountByCode(expense.account_code, scopedOptions)
    : resolveRequiredAccount(ACCOUNT_ROLES.OPERATING_EXPENSE, scopedOptions);

  const cashAccount = resolveRequiredAccount(ACCOUNT_ROLES.CASH, scopedOptions);
  const payableAccount = resolveRequiredAccount(ACCOUNT_ROLES.ACCOUNTS_PAYABLE, scopedOptions);

  const lines = [];

  addLine(
    lines,
    expenseAccount,
    amount,
    0,
    expense.description || expense.category || 'Beban operasional',
    { role: ACCOUNT_ROLES.OPERATING_EXPENSE },
    warnings,
  );

  if (amountPaid > 0) {
    addLine(
      lines,
      cashAccount,
      0,
      amountPaid,
      `Pembayaran beban ${expense.description || sourceId}`,
      { role: ACCOUNT_ROLES.CASH },
      warnings,
    );
  }

  if (remainingAmount > 0) {
    addLine(
      lines,
      payableAccount,
      0,
      remainingAmount,
      `Hutang beban ${expense.description || sourceId}`,
      { role: ACCOUNT_ROLES.ACCOUNTS_PAYABLE },
      warnings,
    );
  }

  return createJournalPackage({
    journal_id: generateId('JRN-EXP'),
    journal_date: expense.expense_date || expense.date || getTodayISO(),
    branch_id: branchId,
    journal_type: JOURNAL_TYPES.EXPENSE,
    source_transaction_type: 'EXPENSE',
    source_transaction_id: sourceId,
    description: `Jurnal expense ${expense.description || sourceId}`,
    created_by: expense.created_by || expense.operator || 'SYSTEM',
    journal_lines: lines,
    source_transaction: expense,
    warnings,
  }, scopedOptions);
};

/* =========================================================================
   PAYMENT / KASBON / HUTANG / PIUTANG JOURNAL
   ========================================================================= */

export const createPaymentJournal = (paymentInput = {}, options = {}) => {
  const warnings = [];

  const payment = paymentInput.payment || paymentInput;
  const sourceId = payment.payment_id || payment.id || '';
  const branchId = normalizeBranchId(payment.branch_id || payment.branchId || DEFAULT_BRANCH_SCOPE);

  const amount = roundMoney(payment.amount || payment.nominal || payment.nominal_dibayar || 0);
  const paymentType = normalizeCode(payment.payment_type || payment.type || payment.category || '');

  const scopedOptions = {
    ...options,
    branchId,
    branch_id: branchId,
  };

  const cashAccount = resolveRequiredAccount(ACCOUNT_ROLES.CASH, scopedOptions);
  const receivableAccount = resolveRequiredAccount(ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE, scopedOptions);
  const payableAccount = resolveRequiredAccount(ACCOUNT_ROLES.ACCOUNTS_PAYABLE, scopedOptions);
  const kasbonAccount = resolveRequiredAccount(ACCOUNT_ROLES.CASH_ADVANCE, scopedOptions);

  const lines = [];

  if (['RECEIVABLE', 'PIUTANG', 'CUSTOMER_PAYMENT', 'PAY_RECEIVABLE', 'AR_PAYMENT'].includes(paymentType)) {
    addLine(lines, cashAccount, amount, 0, `Penerimaan piutang ${sourceId}`, { role: ACCOUNT_ROLES.CASH }, warnings);
    addLine(lines, receivableAccount, 0, amount, `Pelunasan piutang ${sourceId}`, { role: ACCOUNT_ROLES.ACCOUNTS_RECEIVABLE }, warnings);
  } else if (['SUPPLIER', 'PAYABLE', 'HUTANG', 'PAY_SUPPLIER', 'AP_PAYMENT'].includes(paymentType)) {
    addLine(lines, payableAccount, amount, 0, `Pembayaran hutang ${sourceId}`, { role: ACCOUNT_ROLES.ACCOUNTS_PAYABLE }, warnings);
    addLine(lines, cashAccount, 0, amount, `Kas keluar pembayaran hutang ${sourceId}`, { role: ACCOUNT_ROLES.CASH }, warnings);
  } else if (['KASBON', 'CASH_ADVANCE'].includes(paymentType)) {
    addLine(lines, kasbonAccount, amount, 0, `Kasbon ${sourceId}`, { role: ACCOUNT_ROLES.CASH_ADVANCE }, warnings);
    addLine(lines, cashAccount, 0, amount, `Kas keluar kasbon ${sourceId}`, { role: ACCOUNT_ROLES.CASH }, warnings);
  } else {
    warnings.push(makeWarning('UNSUPPORTED_PAYMENT_TYPE', 'Tipe payment tidak dikenali untuk jurnal otomatis.', {
      payment_type: paymentType,
    }));
  }

  return createJournalPackage({
    journal_id: generateId('JRN-PAY'),
    journal_date: payment.payment_date || payment.tanggal_bayar || payment.date || getTodayISO(),
    branch_id: branchId,
    journal_type: JOURNAL_TYPES.PAYMENT,
    source_transaction_type: paymentType || 'PAYMENT',
    source_transaction_id: sourceId,
    description: `Jurnal payment ${sourceId}`,
    created_by: payment.created_by || payment.operator || 'SYSTEM',
    journal_lines: lines,
    source_transaction: payment,
    warnings,
  }, scopedOptions);
};

/* =========================================================================
   ADJUSTMENT JOURNAL
   ========================================================================= */

export const createAdjustmentJournal = (adjustmentInput = {}, options = {}) => {
  const warnings = [];

  const adjustment = adjustmentInput.adjustment || adjustmentInput;
  const sourceId = adjustment.adjustment_id || adjustment.id || '';
  const branchId = normalizeBranchId(adjustment.branch_id || adjustment.branchId || DEFAULT_BRANCH_SCOPE);

  const amount = roundMoney(adjustment.amount || adjustment.total_amount || 0);
  const direction = normalizeCode(adjustment.direction || adjustment.adjustment_type || adjustment.type || '');

  const scopedOptions = {
    ...options,
    branchId,
    branch_id: branchId,
  };

  const inventoryAccount = resolveRequiredAccount(ACCOUNT_ROLES.INVENTORY_RAW_MATERIAL, scopedOptions);
  const gainAccount = resolveRequiredAccount(ACCOUNT_ROLES.ADJUSTMENT_GAIN, scopedOptions);
  const lossAccount = resolveRequiredAccount(ACCOUNT_ROLES.ADJUSTMENT_LOSS, scopedOptions);

  const lines = [];

  if (['IN', 'GAIN', 'PLUS', 'SURPLUS'].includes(direction)) {
    addLine(lines, inventoryAccount, amount, 0, `Adjustment persediaan masuk ${sourceId}`, { role: ACCOUNT_ROLES.INVENTORY_RAW_MATERIAL }, warnings);
    addLine(lines, gainAccount, 0, amount, `Gain adjustment ${sourceId}`, { role: ACCOUNT_ROLES.ADJUSTMENT_GAIN }, warnings);
  } else if (['OUT', 'LOSS', 'MINUS', 'SHORTAGE'].includes(direction)) {
    addLine(lines, lossAccount, amount, 0, `Loss adjustment ${sourceId}`, { role: ACCOUNT_ROLES.ADJUSTMENT_LOSS }, warnings);
    addLine(lines, inventoryAccount, 0, amount, `Adjustment persediaan keluar ${sourceId}`, { role: ACCOUNT_ROLES.INVENTORY_RAW_MATERIAL }, warnings);
  } else {
    warnings.push(makeWarning('UNSUPPORTED_ADJUSTMENT_DIRECTION', 'Arah adjustment tidak dikenali.', {
      direction,
    }));
  }

  return createJournalPackage({
    journal_id: generateId('JRN-ADJ'),
    journal_date: adjustment.adjustment_date || adjustment.date || getTodayISO(),
    branch_id: branchId,
    journal_type: JOURNAL_TYPES.ADJUSTMENT,
    source_transaction_type: 'ADJUSTMENT',
    source_transaction_id: sourceId,
    description: `Jurnal adjustment ${sourceId}`,
    created_by: adjustment.created_by || adjustment.operator || 'SYSTEM',
    journal_lines: lines,
    source_transaction: adjustment,
    warnings,
  }, scopedOptions);
};

/* =========================================================================
   REVERSE JOURNAL
   ========================================================================= */

const extractJournalPackageFromSnapshot = (input = {}) => {
  const snapshot =
    input.accounting_snapshot ||
    input.accountingSnapshot ||
    parseJson(input.accounting_snapshot_json, null) ||
    parseJson(input.accountingSnapshotJson, null);

  if (!snapshot) return null;

  const readResult = readSnapshot(snapshot, {
    allowInvalid: true,
    freeze: false,
  });

  if (!readResult.ok || !readResult.snapshot) return null;

  const payload = readResult.snapshot.payload || {};

  return {
    journal_header: payload.additional_payload?.journal_header || payload.transaction_header || {},
    journal_lines: payload.additional_payload?.journal_lines || payload.transaction_items || [],
    ledger_postings: payload.additional_payload?.ledger_postings || [],
    accounting_snapshot: readResult.snapshot,
  };
};

export const reverseJournal = (journalInput = {}, options = {}) => {
  const warnings = [];

  const packageInput =
    journalInput.journal_package ||
    journalInput.journalPackage ||
    extractJournalPackageFromSnapshot(journalInput) ||
    journalInput;

  const originalHeader = packageInput.journal_header || journalInput.journal_header || {};
  const originalLines = safeArray(packageInput.journal_lines || journalInput.journal_lines || []);

  const originalJournalId = originalHeader.journal_id || originalHeader.id || journalInput.journal_id || journalInput.id || '';

  if (!originalJournalId) {
    warnings.push(makeWarning('MISSING_ORIGINAL_JOURNAL_ID', 'journal_id original tidak ditemukan untuk reversal.'));
  }

  const reversalId = journalInput.reversal_id || journalInput.reversalId || generateId('JRN-REV');
  const reversalDate = normalizeDateString(journalInput.reversal_date || journalInput.reversalDate || journalInput.date || getTodayISO());

  const reversalLines = originalLines.map((line) => ({
    line_id: generateId('JRN-REV-LINE'),
    account_code: line.account_code || '',
    account_name: line.account_name || '',
    account_type: line.account_type || '',
    account_role: line.account_role || '',
    debit: roundMoney(line.credit || 0),
    credit: roundMoney(line.debit || 0),
    description: `Reversal: ${line.description || originalJournalId}`,
    meta: {
      original_line_id: line.line_id || '',
      original_journal_id: originalJournalId,
    },
  }));

  const reversed = createJournalPackage({
    journal_id: reversalId,
    journal_date: reversalDate,
    branch_id: originalHeader.branch_id || journalInput.branch_id || DEFAULT_BRANCH_SCOPE,
    journal_type: JOURNAL_TYPES.REVERSAL,
    source_transaction_type: 'JOURNAL_REVERSAL',
    source_transaction_id: originalJournalId,
    description: journalInput.reason || `Reversal jurnal ${originalJournalId}`,
    created_by: journalInput.created_by || journalInput.createdBy || journalInput.operator || 'SYSTEM',
    journal_lines: reversalLines,
    source_transaction: {
      original_journal_header: originalHeader,
      original_journal_lines: originalLines,
      original_accounting_snapshot: packageInput.accounting_snapshot || null,
    },
    warnings,
  }, options);

  if (!reversed.ok) {
    return reversed;
  }

  return {
    ok: true,
    journal_package: {
      ...reversed.journal_package,
      package_type: 'JOURNAL_REVERSAL_PACKAGE',
      original_journal_id: originalJournalId,
      reversal_id: reversalId,
    },
    warnings: reversed.warnings,
  };
};

/* =========================================================================
   TRIAL BALANCE
   ========================================================================= */

const extractLedgerPostings = (source = []) => {
  if (Array.isArray(source)) {
    return source.flatMap((item) => {
      if (isObject(item) && Array.isArray(item.ledger_postings)) return item.ledger_postings;
      if (isObject(item) && item.journal_package && Array.isArray(item.journal_package.ledger_postings)) {
        return item.journal_package.ledger_postings;
      }
      return [item];
    });
  }

  if (isObject(source) && Array.isArray(source.ledger_postings)) return source.ledger_postings;
  if (isObject(source) && source.journal_package && Array.isArray(source.journal_package.ledger_postings)) {
    return source.journal_package.ledger_postings;
  }

  return [];
};

export const createTrialBalance = (source = [], options = {}) => {
  const warnings = [];
  const postings = extractLedgerPostings(source);

  const branchId = normalizeBranchId(options.branchId || options.branch_id || '');
  const dateFrom = normalizeDateString(options.dateFrom || options.date_from || '');
  const dateTo = normalizeDateString(options.dateTo || options.date_to || '');

  const filtered = postings.filter((posting) => {
    if (!isObject(posting)) return false;

    const postingBranch = normalizeBranchId(posting.branch_id || DEFAULT_BRANCH_SCOPE);
    const postingDate = normalizeDateString(posting.journal_date || posting.date || '');

    if (branchId && branchId !== DEFAULT_BRANCH_SCOPE && postingBranch !== branchId) return false;
    if (dateFrom && postingDate && postingDate < dateFrom) return false;
    if (dateTo && postingDate && postingDate > dateTo) return false;

    return true;
  });

  const accountMap = new Map();

  filtered.forEach((posting) => {
    const accountCode = String(posting.account_code || '').trim();

    if (!accountCode) {
      warnings.push(makeWarning('LEDGER_POSTING_MISSING_ACCOUNT', 'Ledger posting tidak memiliki account_code.', {
        posting_id: posting.posting_id || '',
      }));
      return;
    }

    if (!accountMap.has(accountCode)) {
      accountMap.set(accountCode, {
        account_code: accountCode,
        account_name: posting.account_name || '',
        account_type: posting.account_type || '',
        account_role: posting.account_role || '',
        debit: 0,
        credit: 0,
        ending_balance: 0,
      });
    }

    const row = accountMap.get(accountCode);
    row.debit = roundMoney(row.debit + safeNumber(posting.debit, 0));
    row.credit = roundMoney(row.credit + safeNumber(posting.credit, 0));
    row.ending_balance = roundMoney(row.debit - row.credit);
  });

  const accounts = Array.from(accountMap.values()).sort((a, b) => {
    return String(a.account_code).localeCompare(String(b.account_code));
  });

  const totalDebit = roundMoney(accounts.reduce((sum, account) => sum + account.debit, 0));
  const totalCredit = roundMoney(accounts.reduce((sum, account) => sum + account.credit, 0));
  const difference = roundMoney(totalDebit - totalCredit);

  if (Math.abs(difference) > 0.009) {
    warnings.push(makeWarning('TRIAL_BALANCE_NOT_BALANCED', 'Trial balance tidak seimbang.', {
      total_debit: totalDebit,
      total_credit: totalCredit,
      difference,
    }));
  }

  return {
    ok: Math.abs(difference) <= 0.009,
    trial_balance: {
      generated_at: new Date().toISOString(),
      branch_id: branchId || 'ALL',
      date_from: dateFrom,
      date_to: dateTo,
      accounts,
      total_debit: totalDebit,
      total_credit: totalCredit,
      difference,
      posting_count: filtered.length,
    },
    warnings,
  };
};

/* =========================================================================
   DEFAULT EXPORT
   ========================================================================= */

export default {
  ACCOUNT_ROLES,

  extractChartOfAccounts,
  normalizeAccount,
  normalizeChartOfAccounts,

  createJournalEntry,
  createPurchaseJournal,
  createSalesJournal,
  createProductionJournal,
  createExpenseJournal,
  createPaymentJournal,
  createAdjustmentJournal,

  reverseJournal,
  createLedgerPosting,
  createTrialBalance,
  validateJournal,
};
