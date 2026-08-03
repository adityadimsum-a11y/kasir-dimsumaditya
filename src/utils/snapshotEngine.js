/**
 * ERP DIMSUM ADITYA V2
 * Core Engine: snapshotEngine.js
 *
 * Purpose:
 * - Pusat pengelolaan seluruh snapshot ERP.
 * - Penjaga historical integrity seluruh transaksi.
 *
 * Supported Snapshot:
 * - HPP Snapshot
 * - BOM Snapshot
 * - Conversion Snapshot
 * - Cost Layer Snapshot
 * - Order Snapshot
 * - Production Snapshot
 * - Purchase Snapshot
 * - Payment Snapshot
 *
 * Important Principles:
 * - Snapshot bersifat immutable.
 * - Engine ini tidak menyimpan data.
 * - Engine ini tidak mengubah transaksi.
 * - Engine ini tidak mengubah histori.
 * - Engine ini hanya membuat, membaca, memvalidasi, menggabungkan, dan mengunci snapshot.
 */

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const SNAPSHOT_ENGINE_VERSION = 'ERP_DA_V2_SNAPSHOT_ENGINE_1';

const DEFAULT_BRANCH_SCOPE = 'GLOBAL';
const DEFAULT_CREATED_BY = 'SYSTEM';

export const SNAPSHOT_TYPES = Object.freeze({
  HPP: 'HPP',
  BOM: 'BOM',
  CONVERSION: 'CONVERSION',
  COST_LAYER: 'COST_LAYER',
  ORDER: 'ORDER',
  PRODUCTION: 'PRODUCTION',
  PURCHASE: 'PURCHASE',
  PAYMENT: 'PAYMENT',
  TRANSACTION: 'TRANSACTION',
  COMPOSITE: 'COMPOSITE',
  UNKNOWN: 'UNKNOWN',
});

const SNAPSHOT_TYPE_ALIASES = Object.freeze({
  HPP: SNAPSHOT_TYPES.HPP,
  HPP_SNAPSHOT: SNAPSHOT_TYPES.HPP,

  BOM: SNAPSHOT_TYPES.BOM,
  RECIPE: SNAPSHOT_TYPES.BOM,
  BOM_SNAPSHOT: SNAPSHOT_TYPES.BOM,

  CONVERSION: SNAPSHOT_TYPES.CONVERSION,
  CONVERSION_RULES: SNAPSHOT_TYPES.CONVERSION,
  CONVERSION_SNAPSHOT: SNAPSHOT_TYPES.CONVERSION,

  COST_LAYER: SNAPSHOT_TYPES.COST_LAYER,
  INVENTORY_COST_LAYER: SNAPSHOT_TYPES.COST_LAYER,
  INVENTORY_COST_LAYER_CONSUMPTION: SNAPSHOT_TYPES.COST_LAYER,
  COST_LAYER_SNAPSHOT: SNAPSHOT_TYPES.COST_LAYER,

  ORDER: SNAPSHOT_TYPES.ORDER,
  SALES: SNAPSHOT_TYPES.ORDER,
  INVOICE: SNAPSHOT_TYPES.ORDER,
  ORDER_SNAPSHOT: SNAPSHOT_TYPES.ORDER,

  PRODUCTION: SNAPSHOT_TYPES.PRODUCTION,
  PRODUCTION_BATCH: SNAPSHOT_TYPES.PRODUCTION,
  PRODUCTION_SNAPSHOT: SNAPSHOT_TYPES.PRODUCTION,

  PURCHASE: SNAPSHOT_TYPES.PURCHASE,
  PO: SNAPSHOT_TYPES.PURCHASE,
  PURCHASE_SNAPSHOT: SNAPSHOT_TYPES.PURCHASE,

  PAYMENT: SNAPSHOT_TYPES.PAYMENT,
  RECEIVABLE_PAYMENT: SNAPSHOT_TYPES.PAYMENT,
  SUPPLIER_PAYMENT: SNAPSHOT_TYPES.PAYMENT,
  PAYMENT_SNAPSHOT: SNAPSHOT_TYPES.PAYMENT,

  TRANSACTION: SNAPSHOT_TYPES.TRANSACTION,
  TRANSACTION_SNAPSHOT: SNAPSHOT_TYPES.TRANSACTION,

  COMPOSITE: SNAPSHOT_TYPES.COMPOSITE,
  MERGED: SNAPSHOT_TYPES.COMPOSITE,
});

const REQUIRED_SNAPSHOT_FIELDS = Object.freeze([
  'snapshot_id',
  'snapshot_type',
  'snapshot_version',
  'generated_at',
  'transaction_id',
  'transaction_type',
  'branch_id',
  'created_by',
  'engine_versions',
  'payload',
  'warnings',
]);

/* =========================================================================
   BASIC HELPERS
   ========================================================================= */

const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const isPlainSerializable = (value) => {
  if (value === undefined) return false;
  if (typeof value === 'function') return false;
  if (typeof value === 'symbol') return false;
  return true;
};

const makeWarning = (code, message, meta = {}) => ({
  code,
  message,
  meta,
});

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

const normalizeSnapshotType = (snapshotType) => {
  const normalized = normalizeCode(snapshotType || SNAPSHOT_TYPES.UNKNOWN);
  return SNAPSHOT_TYPE_ALIASES[normalized] || normalized || SNAPSHOT_TYPES.UNKNOWN;
};

const normalizeDateTime = (value) => {
  if (!value) return new Date().toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toISOString();
};

const generateSnapshotId = (prefix = 'SNP') => {
  const safePrefix = normalizeCode(prefix || 'SNP') || 'SNP';
  return `${safePrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
};

const safeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const safeObject = (value) => {
  return isObject(value) ? value : {};
};

const deepClone = (value) => {
  if (!isPlainSerializable(value)) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return null;
  }
};

const deepFreeze = (value) => {
  if (!isObject(value) && !Array.isArray(value)) return value;

  Object.freeze(value);

  Object.keys(value).forEach((key) => {
    const nested = value[key];

    if ((isObject(nested) || Array.isArray(nested)) && !Object.isFrozen(nested)) {
      deepFreeze(nested);
    }
  });

  return value;
};

const stableStringify = (value) => {
  if (value === null) return 'null';

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (isObject(value)) {
    const keys = Object.keys(value).sort();

    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const createStableHash = (value) => {
  const source = stableStringify(value);
  let hash = 5381;

  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) + hash) + source.charCodeAt(i);
    hash &= 0xffffffff;
  }

  return `HASH-${Math.abs(hash).toString(16).toUpperCase()}`;
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

/* =========================================================================
   SNAPSHOT NORMALIZATION
   ========================================================================= */

const normalizeEngineVersions = (engineVersions = {}) => {
  const normalized = {
    snapshotEngine: SNAPSHOT_ENGINE_VERSION,
  };

  if (isObject(engineVersions)) {
    Object.keys(engineVersions).forEach((key) => {
      const safeKey = String(key || '').trim();
      if (!safeKey) return;
      normalized[safeKey] = String(engineVersions[key] || '').trim();
    });
  }

  return normalized;
};

const normalizeWarnings = (warnings = []) => {
  return safeArray(warnings).map((warning) => {
    if (isObject(warning)) {
      return {
        code: String(warning.code || 'SNAPSHOT_WARNING').trim(),
        message: String(warning.message || '').trim(),
        meta: isObject(warning.meta) ? warning.meta : {},
      };
    }

    return makeWarning('SNAPSHOT_WARNING', String(warning || '').trim());
  });
};

const normalizeSnapshotInput = (input = {}) => {
  const payload =
    input.payload !== undefined
      ? input.payload
      : input.data !== undefined
        ? input.data
        : input.snapshot_payload !== undefined
          ? input.snapshot_payload
          : {};

  const snapshotType = normalizeSnapshotType(
    input.snapshot_type ||
    input.snapshotType ||
    input.type,
  );

  const transactionType = normalizeCode(
    input.transaction_type ||
    input.transactionType ||
    input.reference_type ||
    snapshotType,
  );

  const snapshotId = String(
    input.snapshot_id ||
    input.snapshotId ||
    input.id ||
    generateSnapshotId(snapshotType),
  ).trim();

  return {
    snapshot_id: snapshotId,
    snapshot_type: snapshotType,
    snapshot_version: String(
      input.snapshot_version ||
      input.snapshotVersion ||
      SNAPSHOT_ENGINE_VERSION,
    ).trim(),

    generated_at: normalizeDateTime(
      input.generated_at ||
      input.generatedAt ||
      input.created_at ||
      input.createdAt,
    ),

    transaction_id: String(
      input.transaction_id ||
      input.transactionId ||
      input.reference_id ||
      input.referenceId ||
      '',
    ).trim(),

    transaction_type: transactionType,

    branch_id: normalizeBranchId(
      input.branch_id ||
      input.branchId ||
      input.scope_branch_id ||
      DEFAULT_BRANCH_SCOPE,
    ),

    created_by: String(
      input.created_by ||
      input.createdBy ||
      input.executor_name ||
      input.executor ||
      DEFAULT_CREATED_BY,
    ).trim(),

    engine_versions: normalizeEngineVersions(
      input.engine_versions ||
      input.engineVersions ||
      {},
    ),

    payload: deepClone(payload),
    warnings: normalizeWarnings(input.warnings),

    is_locked: Boolean(input.is_locked || input.isLocked || false),
    locked_at: input.locked_at || input.lockedAt || '',
    payload_hash: input.payload_hash || input.payloadHash || '',
    parent_snapshot_ids: safeArray(input.parent_snapshot_ids || input.parentSnapshotIds),
    meta: safeObject(input.meta),
  };
};

/* =========================================================================
   CREATE SNAPSHOT
   ========================================================================= */

export const createSnapshot = (input = {}, options = {}) => {
  const warnings = [];

  if (!isObject(input)) {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        makeWarning('INVALID_SNAPSHOT_INPUT', 'Input snapshot bukan object valid.'),
      ],
    };
  }

  const normalized = normalizeSnapshotInput(input);

  if (normalized.payload === null) {
    warnings.push(makeWarning('SNAPSHOT_PAYLOAD_NOT_SERIALIZABLE', 'Payload snapshot tidak bisa diserialisasi ke JSON.'));
  }

  if (!normalized.transaction_id && options.requireTransactionId) {
    warnings.push(makeWarning('MISSING_TRANSACTION_ID', 'Snapshot tidak memiliki transaction_id.'));
  }

  if (!normalized.transaction_type) {
    warnings.push(makeWarning('MISSING_TRANSACTION_TYPE', 'Snapshot tidak memiliki transaction_type.'));
  }

  const snapshotPayload = normalized.payload === null ? {} : normalized.payload;
  const payloadHash = createStableHash(snapshotPayload);

  const snapshot = {
    snapshot_id: normalized.snapshot_id,
    snapshot_type: normalized.snapshot_type,
    snapshot_version: normalized.snapshot_version,
    generated_at: normalized.generated_at,

    transaction_id: normalized.transaction_id,
    transaction_type: normalized.transaction_type,
    branch_id: normalized.branch_id,
    created_by: normalized.created_by,

    engine_versions: normalized.engine_versions,
    payload: snapshotPayload,

    warnings: [...normalized.warnings, ...warnings],

    is_locked: false,
    locked_at: '',
    payload_hash: payloadHash,

    parent_snapshot_ids: normalized.parent_snapshot_ids,
    meta: normalized.meta,
  };

  const validation = validateSnapshot(snapshot, {
    expectedVersion: options.expectedVersion,
    expectedVersions: options.expectedVersions,
    strict: options.strict,
  });

  const resultWarnings = [
    ...snapshot.warnings,
    ...validation.warnings,
  ];

  const finalSnapshot = {
    ...snapshot,
    warnings: resultWarnings,
  };

  return {
    ok: validation.ok && warnings.length === 0,
    snapshot: options.freeze === false ? finalSnapshot : deepFreeze(finalSnapshot),
    warnings: resultWarnings,
  };
};

/* =========================================================================
   VALIDATE SNAPSHOT
   ========================================================================= */

export const validateSnapshot = (snapshotInput, options = {}) => {
  const warnings = [];

  const parsed = readSnapshot(snapshotInput, {
    allowInvalid: true,
    freeze: false,
  });

  if (!parsed.ok) {
    return {
      ok: false,
      snapshot: parsed.snapshot,
      warnings: [
        ...parsed.warnings,
        makeWarning('SNAPSHOT_CORRUPT', 'Snapshot corrupt atau tidak bisa dibaca.'),
      ],
    };
  }

  const snapshot = parsed.snapshot;

  if (!isObject(snapshot)) {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        makeWarning('EMPTY_SNAPSHOT', 'Snapshot kosong atau bukan object valid.'),
      ],
    };
  }

  REQUIRED_SNAPSHOT_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(snapshot, field)) {
      warnings.push(makeWarning('MISSING_SNAPSHOT_FIELD', `Field wajib snapshot tidak ditemukan: ${field}.`, {
        field,
      }));
    }
  });

  if (!snapshot.snapshot_id) {
    warnings.push(makeWarning('INVALID_SNAPSHOT_ID', 'snapshot_id kosong.'));
  }

  if (!snapshot.snapshot_type || normalizeSnapshotType(snapshot.snapshot_type) === SNAPSHOT_TYPES.UNKNOWN) {
    warnings.push(makeWarning('INVALID_SNAPSHOT_TYPE', 'snapshot_type kosong atau tidak dikenali.', {
      snapshot_type: snapshot.snapshot_type,
    }));
  }

  if (!snapshot.snapshot_version) {
    warnings.push(makeWarning('INVALID_SNAPSHOT_VERSION', 'snapshot_version kosong.'));
  }

  if (!snapshot.generated_at) {
    warnings.push(makeWarning('INVALID_GENERATED_AT', 'generated_at kosong.'));
  } else {
    const parsedDate = new Date(snapshot.generated_at);
    if (Number.isNaN(parsedDate.getTime())) {
      warnings.push(makeWarning('INVALID_GENERATED_AT', 'generated_at bukan tanggal valid.', {
        generated_at: snapshot.generated_at,
      }));
    }
  }

  if (!snapshot.branch_id) {
    warnings.push(makeWarning('INVALID_BRANCH_ID', 'branch_id kosong.'));
  }

  if (!snapshot.created_by) {
    warnings.push(makeWarning('INVALID_CREATED_BY', 'created_by kosong.'));
  }

  if (!isObject(snapshot.engine_versions)) {
    warnings.push(makeWarning('INVALID_ENGINE_VERSIONS', 'engine_versions harus berupa object.'));
  }

  if (snapshot.payload === undefined || snapshot.payload === null) {
    warnings.push(makeWarning('EMPTY_SNAPSHOT_PAYLOAD', 'payload snapshot kosong.'));
  }

  if (!Array.isArray(snapshot.warnings)) {
    warnings.push(makeWarning('INVALID_WARNINGS_FIELD', 'warnings snapshot harus berupa array.'));
  }

  const expectedVersion = options.expectedVersion || options.expected_version;
  const expectedVersions = safeArray(options.expectedVersions || options.expected_versions);

  if (expectedVersion && String(snapshot.snapshot_version) !== String(expectedVersion)) {
    warnings.push(makeWarning('SNAPSHOT_VERSION_MISMATCH', 'snapshot_version tidak sesuai expectedVersion.', {
      expected_version: expectedVersion,
      actual_version: snapshot.snapshot_version,
    }));
  }

  if (expectedVersions.length > 0 && !expectedVersions.includes(snapshot.snapshot_version)) {
    warnings.push(makeWarning('SNAPSHOT_VERSION_MISMATCH', 'snapshot_version tidak masuk daftar expectedVersions.', {
      expected_versions: expectedVersions,
      actual_version: snapshot.snapshot_version,
    }));
  }

  if (snapshot.payload_hash) {
    const currentHash = createStableHash(snapshot.payload);
    if (currentHash !== snapshot.payload_hash) {
      warnings.push(makeWarning('SNAPSHOT_PAYLOAD_HASH_MISMATCH', 'payload_hash tidak cocok. Snapshot berpotensi berubah/corrupt.', {
        expected_hash: snapshot.payload_hash,
        actual_hash: currentHash,
      }));
    }
  }

  const blockingCodes = new Set([
    'SNAPSHOT_CORRUPT',
    'EMPTY_SNAPSHOT',
    'MISSING_SNAPSHOT_FIELD',
    'INVALID_SNAPSHOT_ID',
    'INVALID_SNAPSHOT_TYPE',
    'INVALID_SNAPSHOT_VERSION',
    'INVALID_GENERATED_AT',
    'INVALID_BRANCH_ID',
    'INVALID_CREATED_BY',
    'INVALID_ENGINE_VERSIONS',
    'EMPTY_SNAPSHOT_PAYLOAD',
    'INVALID_WARNINGS_FIELD',
    'SNAPSHOT_VERSION_MISMATCH',
    'SNAPSHOT_PAYLOAD_HASH_MISMATCH',
  ]);

  const strict = Boolean(options.strict);

  const ok = strict
    ? warnings.length === 0
    : !warnings.some((warning) => blockingCodes.has(warning.code));

  return {
    ok,
    snapshot,
    warnings,
  };
};

/* =========================================================================
   LOCK SNAPSHOT
   ========================================================================= */

export const lockSnapshot = (snapshotInput, options = {}) => {
  const parsed = readSnapshot(snapshotInput, {
    allowInvalid: options.allowInvalid,
    freeze: false,
  });

  if (!parsed.ok && !options.allowInvalid) {
    return {
      ok: false,
      snapshot: null,
      warnings: parsed.warnings,
    };
  }

  const snapshot = parsed.snapshot;

  if (!isObject(snapshot)) {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        makeWarning('EMPTY_SNAPSHOT', 'Snapshot kosong dan tidak bisa dikunci.'),
      ],
    };
  }

  if (snapshot.is_locked) {
    const lockedSnapshot = deepFreeze(deepClone(snapshot));

    return {
      ok: true,
      snapshot: lockedSnapshot,
      warnings: [
        makeWarning('SNAPSHOT_ALREADY_LOCKED', 'Snapshot sudah terkunci.', {
          snapshot_id: snapshot.snapshot_id,
          locked_at: snapshot.locked_at,
        }),
      ],
    };
  }

  const cloned = deepClone(snapshot);

  if (!cloned) {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        makeWarning('SNAPSHOT_CLONE_FAILED', 'Snapshot tidak bisa diclone untuk proses lock.'),
      ],
    };
  }

  const lockedPayloadHash = createStableHash(cloned.payload);

  const locked = {
    ...cloned,
    is_locked: true,
    locked_at: normalizeDateTime(options.lockedAt || options.locked_at || new Date().toISOString()),
    payload_hash: lockedPayloadHash,
    meta: {
      ...safeObject(cloned.meta),
      immutable: true,
      locked_by: options.lockedBy || options.locked_by || cloned.created_by || DEFAULT_CREATED_BY,
    },
  };

  const validation = validateSnapshot(locked, {
    expectedVersion: options.expectedVersion,
    expectedVersions: options.expectedVersions,
    strict: options.strict,
  });

  const finalSnapshot = {
    ...locked,
    warnings: [
      ...safeArray(locked.warnings),
      ...validation.warnings,
    ],
  };

  return {
    ok: validation.ok,
    snapshot: deepFreeze(finalSnapshot),
    warnings: finalSnapshot.warnings,
  };
};

/* =========================================================================
   STRINGIFY & PARSE
   ========================================================================= */

export const stringifySnapshot = (snapshotInput, options = {}) => {
  const parsed = readSnapshot(snapshotInput, {
    allowInvalid: options.allowInvalid !== false,
    freeze: false,
  });

  if (!parsed.ok && options.throwOnError) {
    const message = parsed.warnings.map((warning) => warning.message).join(' | ');
    throw new Error(message || 'Snapshot tidak valid.');
  }

  if (!parsed.ok && !options.allowInvalid) {
    return {
      ok: false,
      value: '',
      warnings: parsed.warnings,
    };
  }

  try {
    return {
      ok: true,
      value: options.pretty
        ? JSON.stringify(parsed.snapshot, null, 2)
        : JSON.stringify(parsed.snapshot),
      warnings: parsed.warnings,
    };
  } catch (error) {
    return {
      ok: false,
      value: '',
      warnings: [
        ...parsed.warnings,
        makeWarning('SNAPSHOT_STRINGIFY_FAILED', 'Snapshot gagal diubah menjadi JSON string.', {
          error: error.message,
        }),
      ],
    };
  }
};

export const parseSnapshot = (snapshotValue, options = {}) => {
  if (snapshotValue === undefined || snapshotValue === null || snapshotValue === '') {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        makeWarning('EMPTY_SNAPSHOT', 'Snapshot kosong.'),
      ],
    };
  }

  if (isObject(snapshotValue)) {
    const cloned = deepClone(snapshotValue);

    if (!cloned) {
      return {
        ok: false,
        snapshot: null,
        warnings: [
          makeWarning('SNAPSHOT_CORRUPT', 'Snapshot object tidak bisa diclone/serialisasi.'),
        ],
      };
    }

    return {
      ok: true,
      snapshot: options.freeze === false ? cloned : deepFreeze(cloned),
      warnings: [],
    };
  }

  if (typeof snapshotValue !== 'string') {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        makeWarning('INVALID_SNAPSHOT_FORMAT', 'Format snapshot tidak valid. Harus object atau JSON string.', {
          received_type: typeof snapshotValue,
        }),
      ],
    };
  }

  try {
    const parsed = JSON.parse(snapshotValue);

    if (!isObject(parsed)) {
      return {
        ok: false,
        snapshot: null,
        warnings: [
          makeWarning('SNAPSHOT_CORRUPT', 'JSON snapshot valid tetapi isinya bukan object.'),
        ],
      };
    }

    return {
      ok: true,
      snapshot: options.freeze === false ? parsed : deepFreeze(parsed),
      warnings: [],
    };
  } catch (error) {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        makeWarning('INVALID_JSON', 'Snapshot bukan JSON valid.', {
          error: error.message,
        }),
      ],
    };
  }
};

/* =========================================================================
   READ SNAPSHOT
   ========================================================================= */

export const readSnapshot = (snapshotInput, options = {}) => {
  const parsed = parseSnapshot(snapshotInput, {
    freeze: false,
  });

  if (!parsed.ok) {
    return {
      ok: false,
      snapshot: null,
      value: null,
      warnings: parsed.warnings,
    };
  }

  const snapshot = parsed.snapshot;

  if (!options.allowInvalid) {
    const basicValidationWarnings = [];

    if (!snapshot.snapshot_id) {
      basicValidationWarnings.push(makeWarning('INVALID_SNAPSHOT_ID', 'snapshot_id kosong.'));
    }

    if (!snapshot.snapshot_type) {
      basicValidationWarnings.push(makeWarning('INVALID_SNAPSHOT_TYPE', 'snapshot_type kosong.'));
    }

    if (!Object.prototype.hasOwnProperty.call(snapshot, 'payload')) {
      basicValidationWarnings.push(makeWarning('EMPTY_SNAPSHOT_PAYLOAD', 'payload snapshot tidak ditemukan.'));
    }

    if (basicValidationWarnings.length > 0) {
      return {
        ok: false,
        snapshot,
        value: null,
        warnings: basicValidationWarnings,
      };
    }
  }

  let value = snapshot;

  if (options.path) {
    const pathParts = String(options.path)
      .split('.')
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of pathParts) {
      if (value === undefined || value === null) break;
      value = value[part];
    }
  }

  return {
    ok: true,
    snapshot: options.freeze === false ? snapshot : deepFreeze(deepClone(snapshot)),
    value,
    warnings: [],
  };
};

/* =========================================================================
   MERGE SNAPSHOTS
   ========================================================================= */

export const mergeSnapshots = (snapshots = [], options = {}) => {
  const warnings = [];

  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        makeWarning('EMPTY_SNAPSHOT_LIST', 'Daftar snapshot kosong.'),
      ],
    };
  }

  const parsedSnapshots = [];
  const parentSnapshotIds = [];

  snapshots.forEach((snapshotInput, index) => {
    const parsed = readSnapshot(snapshotInput, {
      allowInvalid: options.allowInvalid,
      freeze: false,
    });

    if (!parsed.ok) {
      warnings.push(
        ...parsed.warnings,
        makeWarning('MERGE_SNAPSHOT_ITEM_INVALID', 'Salah satu snapshot tidak valid saat merge.', {
          index,
        }),
      );
      return;
    }

    parsedSnapshots.push(parsed.snapshot);

    if (parsed.snapshot?.snapshot_id) {
      parentSnapshotIds.push(parsed.snapshot.snapshot_id);
    }
  });

  if (parsedSnapshots.length === 0) {
    return {
      ok: false,
      snapshot: null,
      warnings: [
        ...warnings,
        makeWarning('NO_VALID_SNAPSHOT_TO_MERGE', 'Tidak ada snapshot valid untuk digabung.'),
      ],
    };
  }

  const mergedPayload = {
    snapshots: parsedSnapshots.map((snapshot) => ({
      snapshot_id: snapshot.snapshot_id,
      snapshot_type: snapshot.snapshot_type,
      snapshot_version: snapshot.snapshot_version,
      generated_at: snapshot.generated_at,
      transaction_id: snapshot.transaction_id,
      transaction_type: snapshot.transaction_type,
      branch_id: snapshot.branch_id,
      created_by: snapshot.created_by,
      payload: snapshot.payload,
      warnings: snapshot.warnings,
      payload_hash: snapshot.payload_hash,
      is_locked: Boolean(snapshot.is_locked),
    })),
  };

  const branchId = options.branchId || options.branch_id || firstDefined(parsedSnapshots[0], ['branch_id']) || DEFAULT_BRANCH_SCOPE;
  const transactionId = options.transactionId || options.transaction_id || firstDefined(parsedSnapshots[0], ['transaction_id']) || '';
  const transactionType = options.transactionType || options.transaction_type || 'COMPOSITE';

  const createResult = createSnapshot({
    snapshot_type: SNAPSHOT_TYPES.COMPOSITE,
    snapshot_version: options.snapshotVersion || options.snapshot_version || SNAPSHOT_ENGINE_VERSION,
    transaction_id: transactionId,
    transaction_type: transactionType,
    branch_id: branchId,
    created_by: options.createdBy || options.created_by || DEFAULT_CREATED_BY,
    engine_versions: {
      snapshotEngine: SNAPSHOT_ENGINE_VERSION,
      ...(options.engineVersions || options.engine_versions || {}),
    },
    payload: mergedPayload,
    warnings,
    parent_snapshot_ids: parentSnapshotIds,
    meta: {
      merge_count: parsedSnapshots.length,
      merge_type: options.mergeType || options.merge_type || 'COMPOSITE',
      ...safeObject(options.meta),
    },
  }, {
    freeze: false,
  });

  if (!createResult.ok && !options.allowInvalid) {
    return createResult;
  }

  const locked = options.lock === false
    ? createResult
    : lockSnapshot(createResult.snapshot, {
        allowInvalid: options.allowInvalid,
        lockedBy: options.createdBy || options.created_by || DEFAULT_CREATED_BY,
      });

  return {
    ok: locked.ok,
    snapshot: locked.snapshot,
    warnings: [
      ...warnings,
      ...locked.warnings,
    ],
  };
};

/* =========================================================================
   TRANSACTION SNAPSHOT
   ========================================================================= */

export const createTransactionSnapshot = (input = {}, options = {}) => {
  const payload = {
    transaction_header: safeObject(input.transaction_header || input.transactionHeader || input.header),
    transaction_items: safeArray(input.transaction_items || input.transactionItems || input.items),
    hpp_snapshot: input.hpp_snapshot || input.hppSnapshot || null,
    bom_snapshot: input.bom_snapshot || input.bomSnapshot || null,
    conversion_snapshot: input.conversion_snapshot || input.conversionSnapshot || null,
    cost_layer_snapshot: input.cost_layer_snapshot || input.costLayerSnapshot || null,
    payment_snapshot: input.payment_snapshot || input.paymentSnapshot || null,
    purchase_snapshot: input.purchase_snapshot || input.purchaseSnapshot || null,
    production_snapshot: input.production_snapshot || input.productionSnapshot || null,
    order_snapshot: input.order_snapshot || input.orderSnapshot || null,
    additional_payload: safeObject(input.additional_payload || input.additionalPayload),
  };

  const snapshotType = normalizeSnapshotType(
    input.snapshot_type ||
    input.snapshotType ||
    input.transaction_type ||
    input.transactionType ||
    SNAPSHOT_TYPES.TRANSACTION,
  );

  const createResult = createSnapshot({
    snapshot_type: snapshotType === SNAPSHOT_TYPES.UNKNOWN ? SNAPSHOT_TYPES.TRANSACTION : snapshotType,
    snapshot_version: input.snapshot_version || input.snapshotVersion || SNAPSHOT_ENGINE_VERSION,

    transaction_id: input.transaction_id || input.transactionId || input.id || '',
    transaction_type: input.transaction_type || input.transactionType || snapshotType,

    branch_id: input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE,
    created_by: input.created_by || input.createdBy || input.executor_name || DEFAULT_CREATED_BY,

    engine_versions: {
      snapshotEngine: SNAPSHOT_ENGINE_VERSION,
      ...(input.engine_versions || input.engineVersions || {}),
    },

    payload,
    warnings: input.warnings || [],
    meta: {
      source_module: input.source_module || input.sourceModule || '',
      source_table: input.source_table || input.sourceTable || '',
      source_id: input.source_id || input.sourceId || '',
      ...safeObject(input.meta),
    },
  }, {
    freeze: false,
    requireTransactionId: options.requireTransactionId,
    expectedVersion: options.expectedVersion,
    expectedVersions: options.expectedVersions,
    strict: options.strict,
  });

  if (!createResult.ok && !options.allowInvalid) {
    return createResult;
  }

  if (options.lock === false) {
    return createResult;
  }

  return lockSnapshot(createResult.snapshot, {
    allowInvalid: options.allowInvalid,
    strict: options.strict,
    lockedBy: input.created_by || input.createdBy || input.executor_name || DEFAULT_CREATED_BY,
  });
};

/* =========================================================================
   CONVENIENCE HELPERS
   ========================================================================= */

export const isSnapshotLocked = (snapshotInput) => {
  const parsed = readSnapshot(snapshotInput, {
    allowInvalid: true,
    freeze: false,
  });

  return Boolean(parsed.ok && parsed.snapshot && parsed.snapshot.is_locked);
};

export const getSnapshotPayload = (snapshotInput, fallback = null) => {
  const parsed = readSnapshot(snapshotInput, {
    allowInvalid: true,
    freeze: false,
  });

  if (!parsed.ok || !parsed.snapshot) return fallback;

  return parsed.snapshot.payload === undefined ? fallback : parsed.snapshot.payload;
};

export const getSnapshotWarnings = (snapshotInput) => {
  const parsed = readSnapshot(snapshotInput, {
    allowInvalid: true,
    freeze: false,
  });

  if (!parsed.ok || !parsed.snapshot) return parsed.warnings;

  return safeArray(parsed.snapshot.warnings);
};

export default {
  SNAPSHOT_TYPES,

  createSnapshot,
  validateSnapshot,
  lockSnapshot,

  stringifySnapshot,
  parseSnapshot,
  mergeSnapshots,
  readSnapshot,

  createTransactionSnapshot,

  isSnapshotLocked,
  getSnapshotPayload,
  getSnapshotWarnings,
};
