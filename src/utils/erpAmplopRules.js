const DEFAULT_EFFECTIVE_DATE = '1970-01-01';

export const AMPL0P_MODES = Object.freeze({
  SURVIVAL: 'SURVIVAL',
  NORMAL: 'NORMAL',
  EXPANSION: 'EXPANSION',
  CUSTOM: 'CUSTOM',
});

export const DEFAULT_SURVIVAL_RULE = Object.freeze({
  id: 'AMPL0P-SURVIVAL-DEFAULT',
  mode: AMPL0P_MODES.SURVIVAL,
  branch_id: 'GLOBAL',
  effective_from: DEFAULT_EFFECTIVE_DATE,
  effective_to: '',
  name: 'Survival Mode Dimsum Aditya',
  description: 'Default 4 amplop masa kritis: bahan baku/hutang Nana 55%, operasional 25%, cicilan/buffer 15%, owner 5%.',
  bahanBakuPercent: 55,
  operasionalPercent: 25,
  cicilanBufferPercent: 15,
  ownerPercent: 5,
  isDefault: true,
  isDeleted: false,
});

export const DEFAULT_NORMAL_RULE = Object.freeze({
  id: 'AMPL0P-NORMAL-DEFAULT',
  mode: AMPL0P_MODES.NORMAL,
  branch_id: 'GLOBAL',
  effective_from: DEFAULT_EFFECTIVE_DATE,
  effective_to: '',
  name: 'Normal Mode Dimsum Aditya',
  description: 'Mode normal setelah hutang/cicilan lebih ringan.',
  bahanBakuPercent: 45,
  operasionalPercent: 25,
  cicilanBufferPercent: 10,
  ownerPercent: 20,
  isDefault: true,
  isDeleted: false,
});

export const DEFAULT_EXPANSION_RULE = Object.freeze({
  id: 'AMPL0P-EXPANSION-DEFAULT',
  mode: AMPL0P_MODES.EXPANSION,
  branch_id: 'GLOBAL',
  effective_from: DEFAULT_EFFECTIVE_DATE,
  effective_to: '',
  name: 'Expansion Mode Dimsum Aditya',
  description: 'Mode ekspansi jika owner sedang mengejar buka cabang/aset.',
  bahanBakuPercent: 45,
  operasionalPercent: 25,
  cicilanBufferPercent: 20,
  ownerPercent: 10,
  isDefault: true,
  isDeleted: false,
});

export const DEFAULT_AMPL0P_RULES = Object.freeze([
  DEFAULT_SURVIVAL_RULE,
  DEFAULT_NORMAL_RULE,
  DEFAULT_EXPANSION_RULE,
]);

const ROUNDING_TARGET_KEYS = Object.freeze([
  'bahanBakuHutangNana',
  'operasionalLogistikGaji',
  'cicilanKomitmenBuffer',
  'ownerSurvival',
]);

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const safeArray = (value) => {
  return Array.isArray(value) ? value : [];
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
      .replace(',', '.'),
  );

  return Number.isFinite(parsed) ? parsed : fallback;
};

const toLocalYmd = (value) => {
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

const isDeletedRow = (row = {}) => {
  return (
    row.isDeleted === true ||
    row.is_deleted === true ||
    String(row.isDeleted).toUpperCase() === 'TRUE' ||
    String(row.is_deleted).toUpperCase() === 'TRUE' ||
    String(row.status || '').toUpperCase() === 'DELETED'
  );
};

const normalizePercentValue = (value, fallback = 0) => {
  const parsed = safeNumber(value, fallback);

  if (parsed > 0 && parsed <= 1) {
    return parsed * 100;
  }

  return parsed;
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

const getRuleBranchId = (rule = {}) => {
  return normalizeCode(
    rule.branch_id ||
    rule.branchId ||
    rule.scope_branch ||
    rule.scopeBranch ||
    rule.branch ||
    'GLOBAL',
  ) || 'GLOBAL';
};

const getRuleMode = (rule = {}) => {
  return normalizeCode(
    rule.mode ||
    rule.amplop_mode ||
    rule.amplopMode ||
    rule.rule_mode ||
    rule.ruleMode ||
    AMPL0P_MODES.SURVIVAL,
  ) || AMPL0P_MODES.SURVIVAL;
};

const normalizeAmplopRule = (rule = {}, fallbackRule = DEFAULT_SURVIVAL_RULE) => {
  const source = safeObject(rule);
  const fallback = safeObject(fallbackRule);

  const bahanBakuPercent = normalizePercentValue(
    getFirstValue(source, [
      'bahanBakuPercent',
      'bahan_baku_percent',
      'ayamPercent',
      'ayam_percent',
      'hutangNanaPercent',
      'hutang_nana_percent',
      'amplop1Percent',
      'amplop_1_percent',
      'percent_bahan_baku',
      'pct_bahan_baku',
    ], fallback.bahanBakuPercent),
    fallback.bahanBakuPercent,
  );

  const operasionalPercent = normalizePercentValue(
    getFirstValue(source, [
      'operasionalPercent',
      'operasional_percent',
      'opsPercent',
      'ops_percent',
      'logistikPercent',
      'logistik_percent',
      'gajiPercent',
      'gaji_percent',
      'amplop2Percent',
      'amplop_2_percent',
      'percent_operasional',
      'pct_operasional',
    ], fallback.operasionalPercent),
    fallback.operasionalPercent,
  );

  const cicilanBufferPercent = normalizePercentValue(
    getFirstValue(source, [
      'cicilanBufferPercent',
      'cicilan_buffer_percent',
      'cicilanPercent',
      'cicilan_percent',
      'bufferPercent',
      'buffer_percent',
      'cadanganPercent',
      'cadangan_percent',
      'komitmenPercent',
      'komitmen_percent',
      'amplop3Percent',
      'amplop_3_percent',
      'percent_cicilan_buffer',
      'pct_cicilan_buffer',
    ], fallback.cicilanBufferPercent),
    fallback.cicilanBufferPercent,
  );

  const ownerPercent = normalizePercentValue(
    getFirstValue(source, [
      'ownerPercent',
      'owner_percent',
      'profitOwnerPercent',
      'profit_owner_percent',
      'ownerSurvivalPercent',
      'owner_survival_percent',
      'privePercent',
      'prive_percent',
      'amplop4Percent',
      'amplop_4_percent',
      'percent_owner',
      'pct_owner',
    ], fallback.ownerPercent),
    fallback.ownerPercent,
  );

  const normalized = {
    ...fallback,
    ...source,
    id: source.id || source.rule_id || source.ruleId || fallback.id,
    mode: getRuleMode(source),
    branch_id: getRuleBranchId(source),
    effective_from: toLocalYmd(source.effective_from || source.effectiveFrom || source.start_date || source.startDate || fallback.effective_from),
    effective_to: source.effective_to || source.effectiveTo || source.end_date || source.endDate || '',
    name: source.name || source.rule_name || source.ruleName || source.nama_rule || fallback.name,
    description: source.description || source.notes || source.keterangan || fallback.description,
    bahanBakuPercent,
    operasionalPercent,
    cicilanBufferPercent,
    ownerPercent,
    isDeleted: isDeletedRow(source),
    raw: source,
  };

  return rebalanceRulePercent(normalized, fallback);
};

const rebalanceRulePercent = (rule = {}, fallbackRule = DEFAULT_SURVIVAL_RULE) => {
  const fallback = safeObject(fallbackRule);

  const values = {
    bahanBakuPercent: Math.max(0, safeNumber(rule.bahanBakuPercent, fallback.bahanBakuPercent)),
    operasionalPercent: Math.max(0, safeNumber(rule.operasionalPercent, fallback.operasionalPercent)),
    cicilanBufferPercent: Math.max(0, safeNumber(rule.cicilanBufferPercent, fallback.cicilanBufferPercent)),
    ownerPercent: Math.max(0, safeNumber(rule.ownerPercent, fallback.ownerPercent)),
  };

  const total = Object.values(values).reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return {
      ...rule,
      bahanBakuPercent: fallback.bahanBakuPercent,
      operasionalPercent: fallback.operasionalPercent,
      cicilanBufferPercent: fallback.cicilanBufferPercent,
      ownerPercent: fallback.ownerPercent,
      percentTotal: 100,
      isPercentBalanced: true,
      percentSource: 'FALLBACK',
    };
  }

  if (Math.abs(total - 100) <= 0.01) {
    return {
      ...rule,
      ...values,
      percentTotal: total,
      isPercentBalanced: true,
      percentSource: 'ORIGINAL',
    };
  }

  return {
    ...rule,
    bahanBakuPercent: (values.bahanBakuPercent / total) * 100,
    operasionalPercent: (values.operasionalPercent / total) * 100,
    cicilanBufferPercent: (values.cicilanBufferPercent / total) * 100,
    ownerPercent: (values.ownerPercent / total) * 100,
    percentTotal: 100,
    isPercentBalanced: true,
    percentSource: 'AUTO_REBALANCED',
    originalPercentTotal: total,
  };
};

const getDefaultRuleByMode = (mode = AMPL0P_MODES.SURVIVAL) => {
  const normalizedMode = normalizeCode(mode);
  return DEFAULT_AMPL0P_RULES.find((rule) => rule.mode === normalizedMode) || DEFAULT_SURVIVAL_RULE;
};

const isRuleEffective = (rule = {}, dateYmd = toLocalYmd()) => {
  const from = toLocalYmd(rule.effective_from || DEFAULT_EFFECTIVE_DATE);
  const to = rule.effective_to ? toLocalYmd(rule.effective_to) : '';

  if (from && from > dateYmd) return false;
  if (to && to < dateYmd) return false;

  return true;
};

const getRulePriority = (rule = {}, branchId = 'GLOBAL') => {
  const ruleBranch = getRuleBranchId(rule);
  const targetBranch = normalizeCode(branchId || 'GLOBAL');

  if (ruleBranch === targetBranch) return 3;
  if (ruleBranch === 'GLOBAL') return 2;
  return 1;
};

const isAmplopConversionRow = (row = {}) => {
  const kode = normalizeCode(row.kode_rule || row.code || row.rule_code || row.id);
  const kategori = normalizeCode(row.kategori || row.category || row.type);

  return (
    kode.includes('AMPL0P') ||
    kode.includes('AMPLOP') ||
    kategori.includes('AMPL0P') ||
    kategori.includes('AMPLOP') ||
    kategori.includes('FINANSIAL_AMPLOP') ||
    kategori.includes('FINANCIAL_AMPLOP')
  );
};

const getSlotFromConversionCode = (row = {}) => {
  const kode = normalizeCode(row.kode_rule || row.code || row.rule_code || row.nama_rule || row.name || row.id);

  if (
    kode.includes('BAHAN') ||
    kode.includes('AYAM') ||
    kode.includes('NANA') ||
    kode.includes('MODAL') ||
    kode.includes('AMPLOP_1') ||
    kode.includes('AMPL0P_1')
  ) {
    return 'bahanBakuPercent';
  }

  if (
    kode.includes('OPS') ||
    kode.includes('OPERASIONAL') ||
    kode.includes('LOGISTIK') ||
    kode.includes('GAJI') ||
    kode.includes('AMPLOP_2') ||
    kode.includes('AMPL0P_2')
  ) {
    return 'operasionalPercent';
  }

  if (
    kode.includes('CICILAN') ||
    kode.includes('BUFFER') ||
    kode.includes('CADANGAN') ||
    kode.includes('KOMITMEN') ||
    kode.includes('ASET') ||
    kode.includes('AMPLOP_3') ||
    kode.includes('AMPL0P_3')
  ) {
    return 'cicilanBufferPercent';
  }

  if (
    kode.includes('OWNER') ||
    kode.includes('PROFIT') ||
    kode.includes('PRIVE') ||
    kode.includes('CUAN') ||
    kode.includes('SURVIVAL') ||
    kode.includes('AMPLOP_4') ||
    kode.includes('AMPL0P_4')
  ) {
    return 'ownerPercent';
  }

  return '';
};

const getPercentFromConversionRow = (row = {}) => {
  const directValue = getFirstValue(row, [
    'percent',
    'percentage',
    'nilai_percent',
    'nilai_persen',
    'persen',
    'value',
    'nilai',
  ], undefined);

  if (directValue !== undefined) {
    return normalizePercentValue(directValue, 0);
  }

  const nilaiSumber = safeNumber(row.nilai_sumber, 0);
  const nilaiHasil = safeNumber(row.nilai_hasil, 0);

  if (normalizeCode(row.satuan_hasil).includes('PERCENT') || normalizeCode(row.satuan_hasil).includes('PERSEN')) {
    return normalizePercentValue(nilai_hasil, 0);
  }

  if (normalizeCode(row.satuan_sumber).includes('PERCENT') || normalizeCode(row.satuan_sumber).includes('PERSEN')) {
    return normalizePercentValue(nilaiSumber, 0);
  }

  return normalizePercentValue(nilaiHasil || nilaiSumber, 0);
};

const buildRulesFromConversionRows = (rows = []) => {
  const grouped = {};

  safeArray(rows)
    .filter((row) => !isDeletedRow(row))
    .filter(isAmplopConversionRow)
    .forEach((row) => {
      const slot = getSlotFromConversionCode(row);
      if (!slot) return;

      const mode = normalizeCode(row.mode || row.amplop_mode || row.rule_mode || AMPL0P_MODES.SURVIVAL);
      const branchId = getRuleBranchId(row);
      const effectiveFrom = toLocalYmd(row.effective_from || row.effectiveFrom || row.start_date || row.date || DEFAULT_EFFECTIVE_DATE);
      const effectiveTo = row.effective_to || row.effectiveTo || row.end_date || '';
      const groupKey = `${mode}__${branchId}__${effectiveFrom}__${effectiveTo}`;

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          id: `AMPL0P-RULE-${groupKey}`,
          mode,
          branch_id: branchId,
          effective_from: effectiveFrom,
          effective_to: effectiveTo,
          name: row.nama_rule || row.name || `Amplop ${mode}`,
          description: row.keterangan || row.description || '',
          isDeleted: false,
          source: 'master_conversion_rules',
          rawRows: [],
        };
      }

      grouped[groupKey][slot] = getPercentFromConversionRow(row);
      grouped[groupKey].rawRows.push(row);
    });

  return Object.values(grouped);
};

const resolveRuleList = (input = {}) => {
  if (Array.isArray(input)) return input;

  const source = safeObject(input);
  const dbData = safeObject(source.dbData || source.source || source.data || source);

  const directRules = [
    ...safeArray(source.rules),
    ...safeArray(source.amplopRules),
    ...safeArray(source.masterAmplopRules),
    ...safeArray(source.master_amplop_rules),
    ...safeArray(dbData.amplopRules),
    ...safeArray(dbData.masterAmplopRules),
    ...safeArray(dbData.master_amplop_rules),
  ];

  const conversionRows = [
    ...safeArray(source.masterConversionRules),
    ...safeArray(source.master_conversion_rules),
    ...safeArray(dbData.masterConversionRules),
    ...safeArray(dbData.master_conversion_rules),
  ];

  return [
    ...directRules,
    ...buildRulesFromConversionRows(conversionRows),
  ];
};

export const resolveActiveAmplopRule = ({
  rules = [],
  dbData = {},
  source = {},
  date = new Date(),
  branchId = 'GLOBAL',
  mode = AMPL0P_MODES.SURVIVAL,
} = {}) => {
  const targetDate = toLocalYmd(date);
  const targetBranch = normalizeCode(branchId || 'GLOBAL') || 'GLOBAL';
  const targetMode = normalizeCode(mode || AMPL0P_MODES.SURVIVAL) || AMPL0P_MODES.SURVIVAL;
  const fallbackRule = getDefaultRuleByMode(targetMode);

  const ruleList = [
    ...resolveRuleList({ rules, dbData, source }),
    ...DEFAULT_AMPL0P_RULES,
  ]
    .map((rule) => normalizeAmplopRule(rule, fallbackRule))
    .filter((rule) => !rule.isDeleted)
    .filter((rule) => getRuleMode(rule) === targetMode)
    .filter((rule) => isRuleEffective(rule, targetDate))
    .filter((rule) => {
      const ruleBranch = getRuleBranchId(rule);
      return ruleBranch === 'GLOBAL' || ruleBranch === targetBranch;
    })
    .sort((a, b) => {
      const priorityDiff = getRulePriority(b, targetBranch) - getRulePriority(a, targetBranch);
      if (priorityDiff !== 0) return priorityDiff;

      const dateA = toLocalYmd(a.effective_from || DEFAULT_EFFECTIVE_DATE);
      const dateB = toLocalYmd(b.effective_from || DEFAULT_EFFECTIVE_DATE);

      if (dateA < dateB) return 1;
      if (dateA > dateB) return -1;

      if (a.isDefault && !b.isDefault) return 1;
      if (!a.isDefault && b.isDefault) return -1;

      return 0;
    });

  return ruleList[0] || normalizeAmplopRule(fallbackRule, fallbackRule);
};

const allocateAmount = (cashIn = 0, percent = 0) => {
  return Math.round((safeNumber(cashIn, 0) * safeNumber(percent, 0)) / 100);
};

const balanceAllocationRounding = (allocations = {}, cashIn = 0) => {
  const targetTotal = Math.round(safeNumber(cashIn, 0));
  const currentTotal = ROUNDING_TARGET_KEYS.reduce((sum, key) => sum + safeNumber(allocations[key], 0), 0);
  const diff = targetTotal - currentTotal;

  if (diff === 0) {
    return {
      allocations,
      roundingDifference: 0,
      sumAllocated: currentTotal,
    };
  }

  const balanced = {
    ...allocations,
    ownerSurvival: safeNumber(allocations.ownerSurvival, 0) + diff,
  };

  const balancedTotal = ROUNDING_TARGET_KEYS.reduce((sum, key) => sum + safeNumber(balanced[key], 0), 0);

  return {
    allocations: balanced,
    roundingDifference: diff,
    sumAllocated: balancedTotal,
  };
};

export const calculateAmplopAllocation = ({
  cashIn,
  cashMasuk,
  uangMasukRiil,
  totalUangMasukRiil,
  amount,
  date = new Date(),
  branchId = 'GLOBAL',
  mode = AMPL0P_MODES.SURVIVAL,
  rules = [],
  dbData = {},
  source = {},
} = {}) => {
  const totalCashIn = safeNumber(
    cashIn ?? cashMasuk ?? uangMasukRiil ?? totalUangMasukRiil ?? amount,
    0,
  );

  const activeRule = resolveActiveAmplopRule({
    rules,
    dbData,
    source,
    date,
    branchId,
    mode,
  });

  const rawAllocations = {
    bahanBakuHutangNana: allocateAmount(totalCashIn, activeRule.bahanBakuPercent),
    operasionalLogistikGaji: allocateAmount(totalCashIn, activeRule.operasionalPercent),
    cicilanKomitmenBuffer: allocateAmount(totalCashIn, activeRule.cicilanBufferPercent),
    ownerSurvival: allocateAmount(totalCashIn, activeRule.ownerPercent),
  };

  const balancedResult = balanceAllocationRounding(rawAllocations, totalCashIn);
  const allocations = balancedResult.allocations;

  return {
    date: toLocalYmd(date),
    branch_id: normalizeCode(branchId || 'GLOBAL') || 'GLOBAL',
    mode: getRuleMode(activeRule),
    totalCashIn,
    rule: createAmplopSnapshot(activeRule),

    bahanBakuPercent: activeRule.bahanBakuPercent,
    operasionalPercent: activeRule.operasionalPercent,
    cicilanBufferPercent: activeRule.cicilanBufferPercent,
    ownerPercent: activeRule.ownerPercent,

    bahanBakuHutangNana: allocations.bahanBakuHutangNana,
    operasionalLogistikGaji: allocations.operasionalLogistikGaji,
    cicilanKomitmenBuffer: allocations.cicilanKomitmenBuffer,
    ownerSurvival: allocations.ownerSurvival,

    amplop1: allocations.bahanBakuHutangNana,
    amplop2: allocations.operasionalLogistikGaji,
    amplop3: allocations.cicilanKomitmenBuffer,
    amplop4: allocations.ownerSurvival,

    bahanBaku: allocations.bahanBakuHutangNana,
    hutangNana: allocations.bahanBakuHutangNana,
    operasional: allocations.operasionalLogistikGaji,
    cicilanBuffer: allocations.cicilanKomitmenBuffer,
    owner: allocations.ownerSurvival,
    profitOwner: allocations.ownerSurvival,

    sumAllocated: balancedResult.sumAllocated,
    roundingDifference: balancedResult.roundingDifference,
    isBalanced: balancedResult.sumAllocated === Math.round(totalCashIn),
    percentTotal: 100,
  };
};

export const createAmplopSnapshot = (rule = {}) => {
  const normalizedRule = normalizeAmplopRule(rule);

  return {
    id: normalizedRule.id,
    mode: normalizedRule.mode,
    branch_id: normalizedRule.branch_id,
    effective_from: normalizedRule.effective_from,
    effective_to: normalizedRule.effective_to || '',
    name: normalizedRule.name,
    bahanBakuPercent: normalizedRule.bahanBakuPercent,
    operasionalPercent: normalizedRule.operasionalPercent,
    cicilanBufferPercent: normalizedRule.cicilanBufferPercent,
    ownerPercent: normalizedRule.ownerPercent,
    percentTotal: normalizedRule.percentTotal,
    percentSource: normalizedRule.percentSource,
    snapshot_at: new Date().toISOString(),
  };
};

export const isAmplopBalanced = (allocation = {}) => {
  const totalCashIn = Math.round(safeNumber(allocation.totalCashIn, 0));
  const sumAllocated = safeNumber(allocation.sumAllocated, 0);

  return totalCashIn === sumAllocated;
};

export default {
  AMPL0P_MODES,
  DEFAULT_SURVIVAL_RULE,
  DEFAULT_NORMAL_RULE,
  DEFAULT_EXPANSION_RULE,
  DEFAULT_AMPL0P_RULES,
  resolveActiveAmplopRule,
  calculateAmplopAllocation,
  createAmplopSnapshot,
  isAmplopBalanced,
};
