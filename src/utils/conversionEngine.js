/**
 * ERP DIMSUM ADITYA V2
 * Core Engine: conversionEngine.js
 *
 * Purpose:
 * - Single Source of Truth untuk seluruh konversi ERP.
 * - Membaca master_conversion_rules.
 * - Mendukung global rule, branch rule, dan future franchise.
 * - Menyediakan normalisasi satuan, validasi satuan, konversi antar satuan,
 *   serta conversion snapshot untuk menjaga historical integrity.
 *
 * Important Principle:
 * - File ini TIDAK membawa angka konversi bisnis hardcode.
 * - Semua nilai konversi wajib berasal dari master_conversion_rules.
 */

/* =========================================================================
   INTERNAL BASIC HELPERS
   ========================================================================= */

const DEFAULT_BRANCH_SCOPE = 'GLOBAL';
const DEFAULT_MAX_DEPTH = 6;

const FIELD_MAP = Object.freeze({
  id: ['id', 'rule_id', 'conversion_id'],
  code: ['kode_rule', 'rule_code', 'code', 'conversion_code'],
  name: ['nama_rule', 'rule_name', 'name', 'conversion_name'],
  category: ['kategori', 'category', 'group', 'conversion_group'],

  branch: [
    'branch_id',
    'scope_branch_id',
    'scope_branch',
    'branch',
    'location_branch',
    'franchise_id',
  ],

  sourceValue: [
    'nilai_sumber',
    'source_value',
    'from_value',
    'input_value',
    'nilai_input',
    'qty_sumber',
    'qty_from',
    'qty_input',
  ],

  sourceUnit: [
    'satuan_sumber',
    'source_unit',
    'from_unit',
    'input_unit',
    'unit_sumber',
    'unit_from',
    'unit_input',
  ],

  targetValue: [
    'nilai_hasil',
    'target_value',
    'to_value',
    'output_value',
    'nilai_output',
    'qty_hasil',
    'qty_to',
    'qty_output',
  ],

  targetUnit: [
    'satuan_hasil',
    'target_unit',
    'to_unit',
    'output_unit',
    'unit_hasil',
    'unit_to',
    'unit_output',
  ],

  allowReverse: [
    'allow_reverse',
    'is_bidirectional',
    'bidirectional',
    'reverse_enabled',
  ],

  priority: ['priority', 'sort_order', 'urutan'],
  status: ['status', 'status_active', 'is_active'],
  updatedAt: ['updated_at', 'modified_at', 'last_updated_at'],
});

const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toUpperCase();
  if (['TRUE', 'YES', 'YA', 'Y', '1', 'ACTIVE', 'AKTIF'].includes(normalized)) return true;
  if (['FALSE', 'NO', 'TIDAK', 'N', '0', 'INACTIVE', 'NONAKTIF'].includes(normalized)) return false;

  return fallback;
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

const cleanText = (value) => {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const isDeletedRow = (row) => {
  if (!isObject(row)) return true;
  return toBoolean(row.isDeleted, false) || toBoolean(row.deleted, false);
};

const isInactiveRow = (row) => {
  const statusValue = firstDefined(row, FIELD_MAP.status);

  if (statusValue === undefined || statusValue === null || statusValue === '') {
    return false;
  }

  const normalized = String(statusValue).trim().toUpperCase();

  if (['FALSE', 'NO', 'TIDAK', 'N', '0', 'INACTIVE', 'NONAKTIF', 'DISABLED'].includes(normalized)) {
    return true;
  }

  return false;
};

const makeWarning = (code, message, meta = {}) => ({
  code,
  message,
  meta,
});

/* =========================================================================
   PUBLIC NORMALIZATION HELPERS
   ========================================================================= */

/**
 * Normalisasi branch id tanpa mengubah makna bisnis.
 * Digunakan untuk membandingkan GLOBAL vs cabang tertentu.
 */
export const normalizeBranchId = (branchId) => {
  const normalized = cleanText(branchId || DEFAULT_BRANCH_SCOPE)
    .toUpperCase()
    .replace(/[^\w*|,;/.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || DEFAULT_BRANCH_SCOPE;
};

/**
 * Normalisasi satuan tanpa alias bisnis hardcode.
 * Contoh:
 * - " kg "       -> "KG"
 * - "Pcs"        -> "PCS"
 * - "mika frozen" -> "MIKA_FROZEN"
 */
export const normalizeUnit = (unit) => {
  const normalized = cleanText(unit)
    .toUpperCase()
    .replace(/[()[\]{}]/g, '')
    .replace(/[^\w/%]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized;
};

export const isGlobalBranchScope = (branchId) => {
  const normalized = normalizeBranchId(branchId);
  return normalized === 'GLOBAL' || normalized === 'ALL' || normalized === '*';
};

const splitBranchScope = (branchValue) => {
  const raw = cleanText(branchValue || DEFAULT_BRANCH_SCOPE);

  return raw
    .split(/[|,;/]+/)
    .map(normalizeBranchId)
    .filter(Boolean);
};

const isBranchRuleApplicable = (ruleBranchId, requestedBranchId) => {
  const requested = normalizeBranchId(requestedBranchId || DEFAULT_BRANCH_SCOPE);
  const scopes = splitBranchScope(ruleBranchId);

  if (scopes.length === 0) return true;
  if (scopes.some(isGlobalBranchScope)) return true;
  if (isGlobalBranchScope(requested)) return false;

  return scopes.includes(requested);
};

/* =========================================================================
   RULE EXTRACTION & NORMALIZATION
   ========================================================================= */

export const extractConversionRules = (source) => {
  if (Array.isArray(source)) return source;

  if (!isObject(source)) return [];

  if (Array.isArray(source.master_conversion_rules)) return source.master_conversion_rules;
  if (Array.isArray(source.masterConversionRules)) return source.masterConversionRules;

  if (isObject(source.data)) {
    if (Array.isArray(source.data.master_conversion_rules)) return source.data.master_conversion_rules;
    if (Array.isArray(source.data.masterConversionRules)) return source.data.masterConversionRules;
  }

  return [];
};

export const normalizeConversionRule = (rawRule, index = 0) => {
  const warnings = [];

  if (!isObject(rawRule)) {
    return {
      ok: false,
      rule: null,
      warnings: [
        makeWarning('INVALID_RULE_OBJECT', 'Rule konversi bukan object valid.', { index }),
      ],
    };
  }

  if (isDeletedRow(rawRule) || isInactiveRow(rawRule)) {
    return {
      ok: false,
      rule: null,
      warnings: [],
      skipped: true,
    };
  }

  const sourceValue = toNumber(firstDefined(rawRule, FIELD_MAP.sourceValue));
  const targetValue = toNumber(firstDefined(rawRule, FIELD_MAP.targetValue));
  const sourceUnit = normalizeUnit(firstDefined(rawRule, FIELD_MAP.sourceUnit));
  const targetUnit = normalizeUnit(firstDefined(rawRule, FIELD_MAP.targetUnit));

  const rawId = firstDefined(rawRule, FIELD_MAP.id);
  const rawCode = firstDefined(rawRule, FIELD_MAP.code);
  const rawName = firstDefined(rawRule, FIELD_MAP.name);
  const rawCategory = firstDefined(rawRule, FIELD_MAP.category);
  const rawBranch = firstDefined(rawRule, FIELD_MAP.branch);

  const id = String(rawId || rawCode || `CONVERSION_RULE_ROW_${index + 1}`);
  const code = rawCode ? String(rawCode).trim().toUpperCase() : '';
  const name = rawName ? String(rawName).trim() : '';
  const category = rawCategory ? String(rawCategory).trim().toUpperCase() : '';
  const branchId = normalizeBranchId(rawBranch || DEFAULT_BRANCH_SCOPE);

  const allowReverseValue = firstDefined(rawRule, FIELD_MAP.allowReverse);
  const allowReverse = toBoolean(allowReverseValue, true);

  const priorityValue = toNumber(firstDefined(rawRule, FIELD_MAP.priority));
  const explicitPriority = Number.isFinite(priorityValue) ? priorityValue : 0;
  const branchPriority = isGlobalBranchScope(branchId) ? 0 : 100000;
  const priority = branchPriority + explicitPriority;

  const updatedAtRaw = firstDefined(rawRule, FIELD_MAP.updatedAt);
  const updatedAtTime = updatedAtRaw ? new Date(updatedAtRaw).getTime() : 0;

  if (!sourceUnit) {
    warnings.push(makeWarning('MISSING_SOURCE_UNIT', 'Satuan sumber rule konversi kosong.', { id, index }));
  }

  if (!targetUnit) {
    warnings.push(makeWarning('MISSING_TARGET_UNIT', 'Satuan hasil rule konversi kosong.', { id, index }));
  }

  if (!Number.isFinite(sourceValue) || sourceValue <= 0) {
    warnings.push(makeWarning('INVALID_SOURCE_VALUE', 'Nilai sumber rule konversi harus lebih dari 0.', { id, index }));
  }

  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    warnings.push(makeWarning('INVALID_TARGET_VALUE', 'Nilai hasil rule konversi harus lebih dari 0.', { id, index }));
  }

  if (sourceUnit && targetUnit && sourceUnit === targetUnit) {
    warnings.push(makeWarning('SAME_SOURCE_TARGET_UNIT', 'Satuan sumber dan hasil sama; rule tidak diperlukan.', { id, sourceUnit }));
  }

  const ok = warnings.length === 0;

  if (!ok) {
    return {
      ok: false,
      rule: null,
      warnings,
    };
  }

  const factor = targetValue / sourceValue;
  const reverseFactor = sourceValue / targetValue;

  return {
    ok: true,
    warnings,
    rule: {
      id,
      code,
      name,
      category,
      branch_id: branchId,

      source_value: sourceValue,
      source_unit: sourceUnit,

      target_value: targetValue,
      target_unit: targetUnit,

      factor,
      reverse_factor: reverseFactor,
      allow_reverse: allowReverse,

      priority,
      updated_at: updatedAtRaw || '',
      updated_at_time: Number.isFinite(updatedAtTime) ? updatedAtTime : 0,

      raw: { ...rawRule },
    },
  };
};

export const resolveConversionRules = (source, options = {}) => {
  const branchId = normalizeBranchId(options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE);
  const rawRules = extractConversionRules(source);

  const warnings = [];
  const normalizedRules = [];

  rawRules.forEach((rawRule, index) => {
    const result = normalizeConversionRule(rawRule, index);

    if (result.warnings && result.warnings.length > 0) {
      warnings.push(...result.warnings);
    }

    if (result.ok && result.rule && isBranchRuleApplicable(result.rule.branch_id, branchId)) {
      normalizedRules.push(result.rule);
    }
  });

  normalizedRules.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.updated_at_time - a.updated_at_time;
  });

  return {
    branch_id: branchId,
    raw_count: rawRules.length,
    rules: normalizedRules,
    warnings,
  };
};

/* =========================================================================
   SNAPSHOT
   ========================================================================= */

export const createConversionSnapshot = (source, options = {}) => {
  const resolved = resolveConversionRules(source, options);
  const generatedAt = options.generatedAt || options.generated_at || new Date().toISOString();

  const unitsSet = new Set();
  resolved.rules.forEach((rule) => {
    unitsSet.add(rule.source_unit);
    unitsSet.add(rule.target_unit);
  });

  return {
    snapshot_type: 'CONVERSION_RULES',
    snapshot_version: 'ERP_DA_V2_CONVERSION_ENGINE_1',
    generated_at: generatedAt,
    branch_id: resolved.branch_id,
    source_table: 'master_conversion_rules',
    raw_rule_count: resolved.raw_count,
    active_rule_count: resolved.rules.length,
    units: Array.from(unitsSet).sort(),
    rules: resolved.rules.map((rule) => ({
      id: rule.id,
      code: rule.code,
      name: rule.name,
      category: rule.category,
      branch_id: rule.branch_id,
      source_value: rule.source_value,
      source_unit: rule.source_unit,
      target_value: rule.target_value,
      target_unit: rule.target_unit,
      factor: rule.factor,
      allow_reverse: rule.allow_reverse,
      priority: rule.priority,
      updated_at: rule.updated_at,
    })),
    warnings: resolved.warnings,
  };
};

export const createConversionContext = (source, options = {}) => {
  const resolved = resolveConversionRules(source, options);
  const snapshot = createConversionSnapshot(source, options);

  return {
    branch_id: resolved.branch_id,
    rules: resolved.rules,
    warnings: resolved.warnings,
    snapshot,

    convert: (value, fromUnit, toUnit, convertOptions = {}) => {
      return convertUnits({
        value,
        fromUnit,
        toUnit,
        rules: resolved.rules,
        branchId: resolved.branch_id,
        snapshot,
        ...convertOptions,
      });
    },

    validateUnit: (unit) => {
      return validateUnit(unit, {
        rules: resolved.rules,
        branchId: resolved.branch_id,
      });
    },
  };
};

/* =========================================================================
   GRAPH BUILDER
   ========================================================================= */

const buildRuleEdges = (rules) => {
  const edges = [];

  rules.forEach((rule) => {
    edges.push({
      from_unit: rule.source_unit,
      to_unit: rule.target_unit,
      factor: rule.factor,
      direction: 'FORWARD',
      rule,
    });

    if (rule.allow_reverse) {
      edges.push({
        from_unit: rule.target_unit,
        to_unit: rule.source_unit,
        factor: rule.reverse_factor,
        direction: 'REVERSE',
        rule,
      });
    }
  });

  edges.sort((a, b) => {
    if (b.rule.priority !== a.rule.priority) return b.rule.priority - a.rule.priority;
    return b.rule.updated_at_time - a.rule.updated_at_time;
  });

  return edges;
};

const filterRulesByOptions = (rules, options = {}) => {
  const ruleCode = options.ruleCode || options.rule_code || '';
  const category = options.category || '';
  const ruleId = options.ruleId || options.rule_id || '';

  return rules.filter((rule) => {
    if (ruleId && String(rule.id) !== String(ruleId)) return false;
    if (ruleCode && String(rule.code).toUpperCase() !== String(ruleCode).toUpperCase()) return false;
    if (category && String(rule.category).toUpperCase() !== String(category).toUpperCase()) return false;
    return true;
  });
};

const detectDirectAmbiguity = (edges, fromUnit, toUnit) => {
  const directEdges = edges.filter((edge) => {
    return edge.from_unit === fromUnit && edge.to_unit === toUnit;
  });

  if (directEdges.length <= 1) return null;

  const factors = Array.from(new Set(directEdges.map((edge) => String(edge.factor))));
  if (factors.length <= 1) return null;

  return {
    edges: directEdges,
    factors,
  };
};

const findConversionPath = (edges, fromUnit, toUnit, options = {}) => {
  const maxDepth = Number(options.maxDepth || options.max_depth || DEFAULT_MAX_DEPTH);
  const queue = [
    {
      unit: fromUnit,
      factor: 1,
      path: [],
      visited: new Set([fromUnit]),
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.unit === toUnit) {
      return current;
    }

    if (current.path.length >= maxDepth) continue;

    const nextEdges = edges.filter((edge) => edge.from_unit === current.unit);

    for (const edge of nextEdges) {
      if (current.visited.has(edge.to_unit)) continue;

      const nextVisited = new Set(current.visited);
      nextVisited.add(edge.to_unit);

      queue.push({
        unit: edge.to_unit,
        factor: current.factor * edge.factor,
        path: [...current.path, edge],
        visited: nextVisited,
      });
    }
  }

  return null;
};

/* =========================================================================
   VALIDATION
   ========================================================================= */

export const validateUnit = (unit, sourceOrOptions = {}, maybeOptions = {}) => {
  const options = Array.isArray(sourceOrOptions) || isObject(sourceOrOptions.rules)
    ? sourceOrOptions
    : maybeOptions;

  const normalizedUnit = normalizeUnit(unit);
  const branchId = normalizeBranchId(options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE);

  const rules = Array.isArray(options.rules)
    ? options.rules
    : resolveConversionRules(sourceOrOptions, { branchId }).rules;

  const units = new Set();

  rules.forEach((rule) => {
    if (rule.source_unit) units.add(rule.source_unit);
    if (rule.target_unit) units.add(rule.target_unit);
  });

  const ok = Boolean(normalizedUnit && units.has(normalizedUnit));

  return {
    ok,
    unit: normalizedUnit,
    branch_id: branchId,
    known_units: Array.from(units).sort(),
    warnings: ok
      ? []
      : [
          makeWarning('UNKNOWN_UNIT', 'Satuan tidak ditemukan dalam master_conversion_rules aktif.', {
            unit: normalizedUnit,
            branch_id: branchId,
          }),
        ],
  };
};

/* =========================================================================
   CONVERSION
   ========================================================================= */

export const convertUnits = (params = {}) => {
  const warnings = [];

  const value = toNumber(params.value);
  const fromUnit = normalizeUnit(params.fromUnit || params.from_unit);
  const toUnit = normalizeUnit(params.toUnit || params.to_unit);
  const branchId = normalizeBranchId(params.branchId || params.branch_id || DEFAULT_BRANCH_SCOPE);

  if (!Number.isFinite(value)) {
    return {
      ok: false,
      value: null,
      input_value: params.value,
      output_value: null,
      from_unit: fromUnit,
      to_unit: toUnit,
      branch_id: branchId,
      factor: null,
      path: [],
      snapshot: params.snapshot || null,
      warnings: [
        makeWarning('INVALID_CONVERSION_VALUE', 'Nilai yang akan dikonversi tidak valid.', {
          value: params.value,
        }),
      ],
    };
  }

  if (!fromUnit || !toUnit) {
    return {
      ok: false,
      value: null,
      input_value: value,
      output_value: null,
      from_unit: fromUnit,
      to_unit: toUnit,
      branch_id: branchId,
      factor: null,
      path: [],
      snapshot: params.snapshot || null,
      warnings: [
        makeWarning('MISSING_UNIT', 'Satuan asal atau satuan tujuan kosong.', {
          from_unit: fromUnit,
          to_unit: toUnit,
        }),
      ],
    };
  }

  if (fromUnit === toUnit) {
    return {
      ok: true,
      value,
      input_value: value,
      output_value: value,
      from_unit: fromUnit,
      to_unit: toUnit,
      branch_id: branchId,
      factor: 1,
      path: [],
      snapshot: params.snapshot || null,
      warnings: [],
    };
  }

  const resolved = Array.isArray(params.rules)
    ? {
        branch_id: branchId,
        raw_count: params.rules.length,
        rules: params.rules,
        warnings: [],
      }
    : resolveConversionRules(params.rulesSource || params.source || params.master_conversion_rules || params.dbData || [], {
        branchId,
      });

  warnings.push(...(resolved.warnings || []));

  const filteredRules = filterRulesByOptions(resolved.rules, params);
  const edges = buildRuleEdges(filteredRules);

  const directAmbiguity = detectDirectAmbiguity(edges, fromUnit, toUnit);
  if (directAmbiguity && !params.allowAmbiguous) {
    return {
      ok: false,
      value: null,
      input_value: value,
      output_value: null,
      from_unit: fromUnit,
      to_unit: toUnit,
      branch_id: branchId,
      factor: null,
      path: [],
      snapshot: params.snapshot || createConversionSnapshot(filteredRules, { branchId }),
      warnings: [
        ...warnings,
        makeWarning('AMBIGUOUS_CONVERSION_RULE', 'Ditemukan lebih dari satu rule konversi dengan faktor berbeda.', {
          from_unit: fromUnit,
          to_unit: toUnit,
          factors: directAmbiguity.factors,
          rule_ids: directAmbiguity.edges.map((edge) => edge.rule.id),
        }),
      ],
    };
  }

  const pathResult = findConversionPath(edges, fromUnit, toUnit, params);

  if (!pathResult) {
    return {
      ok: false,
      value: null,
      input_value: value,
      output_value: null,
      from_unit: fromUnit,
      to_unit: toUnit,
      branch_id: branchId,
      factor: null,
      path: [],
      snapshot: params.snapshot || createConversionSnapshot(filteredRules, { branchId }),
      warnings: [
        ...warnings,
        makeWarning('CONVERSION_RULE_NOT_FOUND', 'Rule konversi tidak ditemukan.', {
          from_unit: fromUnit,
          to_unit: toUnit,
          branch_id: branchId,
        }),
      ],
    };
  }

  const outputValue = value * pathResult.factor;

  return {
    ok: true,
    value: outputValue,
    input_value: value,
    output_value: outputValue,
    from_unit: fromUnit,
    to_unit: toUnit,
    branch_id: branchId,
    factor: pathResult.factor,
    path: pathResult.path.map((edge) => ({
      rule_id: edge.rule.id,
      rule_code: edge.rule.code,
      rule_name: edge.rule.name,
      category: edge.rule.category,
      branch_id: edge.rule.branch_id,
      direction: edge.direction,
      from_unit: edge.from_unit,
      to_unit: edge.to_unit,
      factor: edge.factor,
      source_value: edge.rule.source_value,
      source_unit: edge.rule.source_unit,
      target_value: edge.rule.target_value,
      target_unit: edge.rule.target_unit,
    })),
    snapshot: params.snapshot || createConversionSnapshot(filteredRules, { branchId }),
    warnings,
  };
};

export const convertValue = (params = {}) => {
  const result = convertUnits(params);

  if (!result.ok) {
    if (params.throwOnError || params.throw_on_error) {
      const message = result.warnings.map((warning) => warning.message).join(' | ');
      throw new Error(message || 'Konversi gagal.');
    }

    return params.fallbackValue ?? params.fallback_value ?? null;
  }

  return result.value;
};

/* =========================================================================
   SUMMARY HELPERS
   ========================================================================= */

export const listKnownUnits = (source, options = {}) => {
  const snapshot = createConversionSnapshot(source, options);
  return snapshot.units;
};

export const hasConversionRule = (params = {}) => {
  const result = convertUnits({
    ...params,
    value: 1,
  });

  return result.ok;
};

export default {
  normalizeBranchId,
  normalizeUnit,
  isGlobalBranchScope,

  extractConversionRules,
  normalizeConversionRule,
  resolveConversionRules,

  createConversionSnapshot,
  createConversionContext,

  validateUnit,
  convertUnits,
  convertValue,

  listKnownUnits,
  hasConversionRule,
};
