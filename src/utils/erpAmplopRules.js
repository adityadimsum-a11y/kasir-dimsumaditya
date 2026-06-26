export const AMPLOP_MODES = Object.freeze({
  SURVIVAL: 'SURVIVAL',
  NORMAL: 'NORMAL',
  EXPANSION: 'EXPANSION',
  CUSTOM: 'CUSTOM',
});

export const DEFAULT_SURVIVAL_RULE = Object.freeze({
  id: 'AMPLOP-SURVIVAL-DEFAULT',
  mode: AMPLOP_MODES.SURVIVAL,
  branch_id: 'GLOBAL',
  effective_from: '1970-01-01',
  effective_to: '',
  name: 'Survival Mode Dimsum Aditya',
  description: 'Bahan baku/hutang Nana 55%, operasional 25%, cicilan/buffer 15%, owner 5%.',
  bahanBakuPercent: 55,
  operasionalPercent: 25,
  cicilanBufferPercent: 15,
  ownerPercent: 5,
  isDefault: true,
  isDeleted: false,
});

export const DEFAULT_NORMAL_RULE = Object.freeze({
  id: 'AMPLOP-NORMAL-DEFAULT',
  mode: AMPLOP_MODES.NORMAL,
  branch_id: 'GLOBAL',
  effective_from: '1970-01-01',
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
  id: 'AMPLOP-EXPANSION-DEFAULT',
  mode: AMPLOP_MODES.EXPANSION,
  branch_id: 'GLOBAL',
  effective_from: '1970-01-01',
  effective_to: '',
  name: 'Expansion Mode Dimsum Aditya',
  description: 'Mode ekspansi untuk aset/cabang baru.',
  bahanBakuPercent: 45,
  operasionalPercent: 25,
  cicilanBufferPercent: 20,
  ownerPercent: 10,
  isDefault: true,
  isDeleted: false,
});

const DEFAULT_RULES = Object.freeze([
  DEFAULT_SURVIVAL_RULE,
  DEFAULT_NORMAL_RULE,
  DEFAULT_EXPANSION_RULE,
]);

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
      .replace(',', '.')
  );

  return Number.isFinite(parsed) ? parsed : fallback;
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

const isDeletedRow = (row = {}) => {
  return (
    row.isDeleted === true ||
    row.is_deleted === true ||
    String(row.isDeleted).toUpperCase() === 'TRUE' ||
    String(row.is_deleted).toUpperCase() === 'TRUE' ||
    String(row.status || '').toUpperCase() === 'DELETED'
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

const normalizePercent = (value, fallback = 0) => {
  const parsed = safeNumber(value, fallback);

  if (parsed > 0 && parsed <= 1) {
    return parsed * 100;
  }

  return parsed;
};

const getFallbackRuleByMode = (mode = AMPLOP_MODES.SURVIVAL) => {
  const normalizedMode = normalizeCode(mode || AMPLOP_MODES.SURVIVAL);
  return DEFAULT_RULES.find((rule) => rule.mode === normalizedMode) || DEFAULT_SURVIVAL_RULE;
};

const getRuleBranchId = (rule = {}) => {
  return normalizeCode(
    rule.branch_id ||
    rule.branchId ||
    rule.scope_branch ||
    rule.scopeBranch ||
    rule.branch ||
    'GLOBAL'
  ) || 'GLOBAL';
};

const getRuleMode = (rule = {}) => {
  return normalizeCode(
    rule.mode ||
    rule.amplop_mode ||
    rule.amplopMode ||
    rule.rule_mode ||
    rule.ruleMode ||
    AMPLOP_MODES.SURVIVAL
  ) || AMPLOP_MODES.SURVIVAL;
};

const rebalancePercent = (rule = {}, fallbackRule = DEFAULT_SURVIVAL_RULE) => {
  const bahanBakuPercent = Math.max(0, safeNumber(rule.bahanBakuPercent, fallbackRule.bahanBakuPercent));
  const operasionalPercent = Math.max(0, safeNumber(rule.operasionalPercent, fallbackRule.operasionalPercent));
  const cicilanBufferPercent = Math.max(0, safeNumber(rule.cicilanBufferPercent, fallbackRule.cicilanBufferPercent));
  const ownerPercent = Math.max(0, safeNumber(rule.ownerPercent, fallbackRule.ownerPercent));

  const total = bahanBakuPercent + operasionalPercent + cicilanBufferPercent + ownerPercent;

  if (total <= 0) {
    return {
      ...rule,
      bahanBakuPercent: fallbackRule.bahanBakuPercent,
      operasionalPercent: fallbackRule.operasionalPercent,
      cicilanBufferPercent: fallbackRule.cicilanBufferPercent,
      ownerPercent: fallbackRule.ownerPercent,
      percentTotal: 100,
      percentSource: 'FALLBACK',
    };
  }

  if (Math.abs(total - 100) <= 0.01) {
    return {
      ...rule,
      bahanBakuPercent,
      operasionalPercent,
      cicilanBufferPercent,
      ownerPercent,
      percentTotal: total,
      percentSource: rule.percentSource || 'ORIGINAL',
    };
  }

  return {
    ...rule,
    bahanBakuPercent: (bahanBakuPercent / total) * 100,
    operasionalPercent: (operasionalPercent / total) * 100,
    cicilanBufferPercent: (cicilanBufferPercent / total) * 100,
    ownerPercent: (ownerPercent / total) * 100,
    percentTotal: 100,
    percentSource: 'AUTO_REBALANCED',
    originalPercentTotal: total,
  };
};

const normalizeRule = (rule = {}, fallbackRule = DEFAULT_SURVIVAL_RULE) => {
  const source = safeObject(rule);

  const normalized = {
    ...fallbackRule,
    ...source,
    id: source.id || source.rule_id || source.ruleId || fallbackRule.id,
    mode: getRuleMode(source),
    branch_id: getRuleBranchId(source),
    effective_from: toYmd(
      source.effective_from ||
      source.effectiveFrom ||
      source.start_date ||
      source.startDate ||
      fallbackRule.effective_from
    ),
    effective_to: source.effective_to || source.effectiveTo || source.end_date || source.endDate || '',
    name: source.name || source.rule_name || source.ruleName || source.nama_rule || fallbackRule.name,
    description: source.description || source.notes || source.keterangan || fallbackRule.description,
    bahanBakuPercent: normalizePercent(
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
      ], fallbackRule.bahanBakuPercent),
      fallbackRule.bahanBakuPercent
    ),
    operasionalPercent: normalizePercent(
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
      ], fallbackRule.operasionalPercent),
      fallbackRule.operasionalPercent
    ),
    cicilanBufferPercent: normalizePercent(
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
      ], fallbackRule.cicilanBufferPercent),
      fallbackRule.cicilanBufferPercent
    ),
    ownerPercent: normalizePercent(
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
      ], fallbackRule.ownerPercent),
      fallbackRule.ownerPercent
    ),
    isDeleted: isDeletedRow(source),
    raw: source,
  };

  return rebalancePercent(normalized, fallbackRule);
};

const isRuleEffective = (rule = {}, dateYmd = toYmd()) => {
  const effectiveFrom = toYmd(rule.effective_from || '1970-01-01');
  const effectiveTo = rule.effective_to ? toYmd(rule.effective_to) : '';

  if (effectiveFrom && effectiveFrom > dateYmd) return false;
  if (effectiveTo && effectiveTo < dateYmd) return false;

  return true;
};

const getBranchPriority = (rule = {}, branchId = 'GLOBAL') => {
  const ruleBranchId = getRuleBranchId(rule);
  const targetBranchId = normalizeCode(branchId || 'GLOBAL');

  if (ruleBranchId === targetBranchId) return 3;
  if (ruleBranchId === 'GLOBAL') return 2;
  return 1;
};

const isAmplopConversionRow = (row = {}) => {
  const kode = normalizeCode(row.kode_rule || row.code || row.rule_code || row.id);
  const kategori = normalizeCode(row.kategori || row.category || row.type);

  return (
    kode.includes('AMPLOP') ||
    kategori.includes('AMPLOP') ||
    kategori.includes('FINANSIAL_AMPLOP') ||
    kategori.includes('FINANCIAL_AMPLOP')
  );
};

const getSlotFromConversionRow = (row = {}) => {
  const code = normalizeCode(row.kode_rule || row.code || row.rule_code || row.nama_rule || row.name || row.id);

  if (
    code.includes('BAHAN') ||
    code.includes('AYAM') ||
    code.includes('NANA') ||
    code.includes('MODAL') ||
    code.includes('AMPLOP_1')
  ) {
    return 'bahanBakuPercent';
  }

  if (
    code.includes('OPS') ||
    code.includes('OPERASIONAL') ||
    code.includes('LOGISTIK') ||
    code.includes('GAJI') ||
    code.includes('AMPLOP_2')
  ) {
    return 'operasionalPercent';
  }

  if (
    code.includes('CICILAN') ||
    code.includes('BUFFER') ||
    code.includes('CADANGAN') ||
    code.includes('KOMITMEN') ||
    code.includes('ASET') ||
    code.includes('AMPLOP_3')
  ) {
    return 'cicilanBufferPercent';
  }

  if (
    code.includes('OWNER') ||
    code.includes('PROFIT') ||
    code.includes('PRIVE') ||
    code.includes('CUAN') ||
    code.includes('AMPLOP_4')
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
    return normalizePercent(directValue, 0);
  }

  const nilaiSumber = safeNumber(row.nilai_sumber, 0);
  const nilaiHasil = safeNumber(row.nilai_hasil, 0);
  const satuanSumberRaw = String(row.satuan_sumber || '').toUpperCase();
  const satuanHasilRaw = String(row.satuan_hasil || '').toUpperCase();

  if (
    satuanHasilRaw.includes('PERCENT') ||
    satuanHasilRaw.includes('PERSEN') ||
    satuanHasilRaw.includes('%')
  ) {
    return normalizePercent(nilaiHasil, 0);
  }

  if (
    satuanSumberRaw.includes('PERCENT') ||
    satuanSumberRaw.includes('PERSEN') ||
    satuanSumberRaw.includes('%')
  ) {
    return normalizePercent(nilaiSumber, 0);
  }

  return normalizePercent(nilaiHasil || nilaiSumber, 0);
};

const buildAmplopRulesFromConversionRows = (rows = []) => {
  const groupedRules = {};

  safeArray(rows)
    .filter((row) => !isDeletedRow(row))
    .filter(isAmplopConversionRow)
    .forEach((row) => {
      const slot = getSlotFromConversionRow(row);
      if (!slot) return;

      const mode = normalizeCode(row.mode || row.amplop_mode || row.rule_mode || AMPLOP_MODES.SURVIVAL);
      const branchId = getRuleBranchId(row);
      const effectiveFrom = toYmd(
        row.effective_from ||
        row.effectiveFrom ||
        row.start_date ||
        row.startDate ||
        row.date ||
        '1970-01-01'
      );
      const effectiveTo = row.effective_to || row.effectiveTo || row.end_date || row.endDate || '';
      const groupKey = `${mode}__${branchId}__${effectiveFrom}__${effectiveTo}`;

      if (!groupedRules[groupKey]) {
        groupedRules[groupKey] = {
          id: `AMPLOP-RULE-${groupKey}`,
          mode,
          branch_id: branchId,
          effective_from: effectiveFrom,
          effective_to: effectiveTo,
          name: row.nama_rule || row.name || `Rule Amplop ${mode}`,
          description: row.keterangan || row.description || '',
          source: 'master_conversion_rules',
          rawRows: [],
        };
      }

      groupedRules[groupKey][slot] = getPercentFromConversionRow(row);
      groupedRules[groupKey].rawRows.push(row);
    });

  return Object.values(groupedRules);
};

const resolveRuleList = ({ rules = [], dbData = {} } = {}) => {
  const data = safeObject(dbData);

  const directRules = [
    ...safeArray(rules),
    ...safeArray(data.master_amplop_rules),
    ...safeArray(data.masterAmplopRules),
    ...safeArray(data.amplopRules),
  ];

  const conversionRules = [
    ...safeArray(data.master_conversion_rules),
    ...safeArray(data.masterConversionRules),
  ];

  return [
    ...directRules,
    ...buildAmplopRulesFromConversionRows(conversionRules),
  ];
};

export const createAmplopSnapshot = (rule = {}) => {
  const normalizedRule = normalizeRule(rule);

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

export const resolveActiveAmplopRule = ({
  rules = [],
  dbData = {},
  date = new Date(),
  branchId = 'GLOBAL',
  mode = AMPLOP_MODES.SURVIVAL,
} = {}) => {
  const dateYmd = toYmd(date);
  const targetBranchId = normalizeCode(branchId || 'GLOBAL') || 'GLOBAL';
  const targetMode = normalizeCode(mode || AMPLOP_MODES.SURVIVAL) || AMPLOP_MODES.SURVIVAL;
  const fallbackRule = getFallbackRuleByMode(targetMode);

  const finalRules = [
    ...resolveRuleList({ rules, dbData }),
    ...DEFAULT_RULES,
  ]
    .map((rule) => normalizeRule(rule, fallbackRule))
    .filter((rule) => !rule.isDeleted)
    .filter((rule) => getRuleMode(rule) === targetMode)
    .filter((rule) => isRuleEffective(rule, dateYmd))
    .filter((rule) => {
      const ruleBranchId = getRuleBranchId(rule);
      return ruleBranchId === 'GLOBAL' || ruleBranchId === targetBranchId;
    })
    .sort((a, b) => {
      const branchDiff = getBranchPriority(b, targetBranchId) - getBranchPriority(a, targetBranchId);
      if (branchDiff !== 0) return branchDiff;

      const dateA = toYmd(a.effective_from || '1970-01-01');
      const dateB = toYmd(b.effective_from || '1970-01-01');

      if (dateA > dateB) return -1;
      if (dateA < dateB) return 1;

      if (a.isDefault && !b.isDefault) return 1;
      if (!a.isDefault && b.isDefault) return -1;

      return 0;
    });

  return finalRules[0] || normalizeRule(fallbackRule, fallbackRule);
};

const allocateAmount = (cashIn, percent) => {
  return Math.round((safeNumber(cashIn, 0) * safeNumber(percent, 0)) / 100);
};

export const calculateAmplopAllocation = ({
  cashIn,
  cashMasuk,
  uangMasukRiil,
  totalUangMasukRiil,
  amount,
  date = new Date(),
  branchId = 'GLOBAL',
  mode = AMPLOP_MODES.SURVIVAL,
  rules = [],
  dbData = {},
} = {}) => {
  const totalCashIn = safeNumber(
    cashIn ?? cashMasuk ?? uangMasukRiil ?? totalUangMasukRiil ?? amount,
    0
  );

  const activeRule = resolveActiveAmplopRule({
    rules,
    dbData,
    date,
    branchId,
    mode,
  });

  const bahanBakuHutangNana = allocateAmount(totalCashIn, activeRule.bahanBakuPercent);
  const operasionalLogistikGaji = allocateAmount(totalCashIn, activeRule.operasionalPercent);
  const cicilanKomitmenBuffer = allocateAmount(totalCashIn, activeRule.cicilanBufferPercent);
  const ownerSurvivalRaw = allocateAmount(totalCashIn, activeRule.ownerPercent);

  const allocatedBeforeBalance =
    bahanBakuHutangNana +
    operasionalLogistikGaji +
    cicilanKomitmenBuffer +
    ownerSurvivalRaw;

  const roundingDifference = Math.round(totalCashIn) - allocatedBeforeBalance;
  const ownerSurvival = ownerSurvivalRaw + roundingDifference;

  const sumAllocated =
    bahanBakuHutangNana +
    operasionalLogistikGaji +
    cicilanKomitmenBuffer +
    ownerSurvival;

  return {
    date: toYmd(date),
    branch_id: normalizeCode(branchId || 'GLOBAL') || 'GLOBAL',
    mode: activeRule.mode,
    totalCashIn,
    rule: createAmplopSnapshot(activeRule),

    bahanBakuPercent: activeRule.bahanBakuPercent,
    operasionalPercent: activeRule.operasionalPercent,
    cicilanBufferPercent: activeRule.cicilanBufferPercent,
    ownerPercent: activeRule.ownerPercent,

    bahanBakuHutangNana,
    operasionalLogistikGaji,
    cicilanKomitmenBuffer,
    ownerSurvival,

    amplop1: bahanBakuHutangNana,
    amplop2: operasionalLogistikGaji,
    amplop3: cicilanKomitmenBuffer,
    amplop4: ownerSurvival,

    bahanBaku: bahanBakuHutangNana,
    hutangNana: bahanBakuHutangNana,
    operasional: operasionalLogistikGaji,
    cicilanBuffer: cicilanKomitmenBuffer,
    owner: ownerSurvival,
    profitOwner: ownerSurvival,

    sumAllocated,
    roundingDifference,
    isBalanced: sumAllocated === Math.round(totalCashIn),
  };
};

export default {
  AMPLOP_MODES,
  DEFAULT_SURVIVAL_RULE,
  DEFAULT_NORMAL_RULE,
  DEFAULT_EXPANSION_RULE,
  resolveActiveAmplopRule,
  calculateAmplopAllocation,
  createAmplopSnapshot,
};
