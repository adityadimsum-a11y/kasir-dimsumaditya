import { apiRequest, phpApiRequest, getConfiguredApiUrl } from "./client";

const normalizeLoginPayload = (result) => {
  const payload = result.data || {};
  const user = payload.user || {};
  const sessionToken = payload.session_token || payload.sessionToken || "";
  const legacySessionToken = payload.legacySessionToken || "";

  return {
    sessionToken,
    legacySessionToken,
    user: {
      ...user,
      id: user.user_id || user.id || user.username,
      username: user.username || "",
      name:
        user.display_name ||
        user.full_name ||
        user.name ||
        user.username ||
        "User",
      role_id: user.role_id || "",
      role_name: user.role_name || "",
      location_id: user.location_id || "",
      location_code: user.location_code || "",
      location_name: user.location_name || "",
    },
    allowedMenus: payload.allowed_menus || payload.allowedMenus || user.allowed_menus || user.allowedMenus || [],
    raw: payload,
  };
};

const withFastBootstrapPayload = (payload = {}, defaults = {}) => {
  const limit = payload.limit ?? payload.recent_limit ?? defaults.limit ?? 30;
  return {
    view: defaults.view || "fast",
    mode: defaults.mode || "fast",
    skip_health: defaults.skip_health ?? true,
    cache_seconds: defaults.cache_seconds ?? 30,
    ...defaults,
    ...payload,
    limit,
    recent_limit: payload.recent_limit ?? payload.recentLimit ?? defaults.recent_limit ?? limit,
  };
};

const withArchiveDetailPayload = (payload = {}) => ({
  source: payload.source || "frontend_part_8d_archive_lazy_detail",
  detail_mode: payload.detail_mode || "fast",
  timeline_limit: payload.timeline_limit ?? payload.timelineLimit ?? 35,
  relation_limit: payload.relation_limit ?? payload.relationLimit ?? 80,
  audit_limit: payload.audit_limit ?? payload.auditLimit ?? 20,
  raw_preview_limit: payload.raw_preview_limit ?? payload.rawPreviewLimit ?? 80,
  cache_seconds: payload.cache_seconds ?? payload.cacheSeconds ?? 60,
  skip_audit: payload.skip_audit ?? payload.skipAudit ?? false,
  ...payload,
});

/**
 * AUTH
 */

export async function loginUser({ username, password }) {
  const php = await phpApiRequest("login", { username, password }, "");
  if (!php.success) return php;

  const normalized = normalizeLoginPayload(php);

  return {
    success: true,
    message: php.message || "Login PHP/MySQL berhasil.",
    data: {
      ...normalized,
      legacySessionToken: "",
      legacyFallbackReady: false,
    },
    raw: { php },
  };
}

export async function logoutUser(sessionToken) {
  return phpApiRequest("logout", {}, sessionToken);
}

export async function getCurrentUser(sessionToken) {
  return phpApiRequest("getCurrentUser", {}, sessionToken);
}

/**
 * FOUNDATION / BRIDGE
 */

export async function pingBackend() {
  return phpApiRequest("health", {}, "");
}

export async function getLegacyBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyBootstrap", payload, sessionToken);
}

/**
 * DROP AYAM / BELI AYAM
 *
 * Part 2A:
 * - getDropAyamBootstrap = read-only
 *
 * Part 2B nanti:
 * - createDropAyam = create transaksi hidup
 */

export async function getDropAyamBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getLegacyChickenPurchaseBootstrap", withFastBootstrapPayload(payload, { limit: 30 }), sessionToken);
}

export async function createDropAyam(sessionToken, payload = {}) {
  return phpApiRequest("legacyCreateChickenDropFromOldPurchase", payload, sessionToken);
}

/**
 * PRODUKSI / ADUKAN
 * Belum dipakai di Part 2A, tapi disiapkan supaya action tetap 1 pintu.
 */

export async function getProductionBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getLegacyProductionBootstrap", withFastBootstrapPayload(payload, { limit: 30 }), sessionToken);
}

export async function createProductionBatch(sessionToken, payload = {}) {
  return phpApiRequest("legacyCreateProductionBatchFromOldFactory", payload, sessionToken);
}

export async function getProductionFlowBootstrap(sessionToken, payload = {}) {
  return phpApiRequest(
    "getProductionFlowBootstrap",
    withFastBootstrapPayload(payload, { limit: 20 }),
    sessionToken
  );
}

export async function getProductionFlowTrace(sessionToken, payload = {}) {
  return phpApiRequest("getProductionFlowTrace", payload, sessionToken);
}

export async function voidProductionBatch(sessionToken, payload = {}) {
  return {
    success: false,
    message: "Aksi void lama diblokir saat cutover. Gunakan reversal/void PHP+MySQL setelah route final tersedia.",
    error: { code: "CUTOVER_LEGACY_CORE_WRITE_BLOCKED" },
  };
}

/**
 * PO / STOK PLANNING
 */

export async function getStockPlanningBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyStockPlanningBootstrap", payload, sessionToken);
}

export async function createPOStockPlan(sessionToken, payload = {}) {
  return apiRequest("legacyCreatePOStockPlanFromOldQueue", payload, sessionToken);
}

/**
 * STOK JADI / BARANG MASUK FREEZER
 */

export async function getFinishedStockBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getFrontendCutoverFinishedStockBootstrap", withFastBootstrapPayload(payload, { limit: 100 }), sessionToken);
}

/**
 * KASIR / ORDER
 */

export async function getOrderBootstrap(sessionToken, payload = {}) {
  const result = await phpApiRequest(
    "getLegacyOrderBootstrap",
    withFastBootstrapPayload(
      { ...(payload || {}), order_mode: "DIRECT" },
      { limit: 30 }
    ),
    sessionToken
  );

  if (!result.success) return result;

  const data = result.data || {};
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const stockRows =
    data?.stock?.finished_goods_stock ||
    data?.stock?.stock ||
    [];

  const summary = {
    order_count: Number(data?.pagination?.total || orders.length || 0),
    today_order_count: orders.filter((row) =>
      String(row.order_date || "").slice(0, 10) === new Date().toISOString().slice(0, 10)
    ).length,
    uang_masuk_actual: orders.reduce(
      (sum, row) => sum + Number(row.amount_paid || row.paid_amount || 0),
      0
    ),
    piutang_open: orders.reduce(
      (sum, row) => sum + Number(row.remaining_amount || 0),
      0
    ),
    stock_ready_pcs: stockRows.reduce(
      (sum, row) => sum + Number(row.free_qty || 0),
      0
    ),
    product_ready_count: stockRows.filter(
      (row) => Number(row.free_qty || 0) > 0
    ).length,
  };

  return {
    ...result,
    data: {
      ...data,
      products: Array.isArray(data.products) ? data.products : [],
      customers: Array.isArray(data.customers) ? data.customers : [],
      wallets: Array.isArray(data.wallets) ? data.wallets : [],
      summary,
    },
  };
}

export async function getSalesFlowControl(sessionToken, payload = {}) {
  return phpApiRequest(
    "getSalesFlowControl",
    withFastBootstrapPayload(payload, { limit: 50 }),
    sessionToken
  );
}

export async function getOrderDetail(sessionToken, payload = {}) {
  return phpApiRequest("getOrderDetail", payload, sessionToken);
}

export async function fulfillOrder(sessionToken, payload = {}) {
  return phpApiRequest("fulfillOrder", payload, sessionToken);
}

export async function getOrderPricingLockHealth(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "orderPricingLockHealth",
    payload,
    sessionToken
  );
}

export async function resolveOrderItemPrice(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "resolveOrderItemPrice",
    payload,
    sessionToken
  );
}

export async function createOrder(sessionToken, payload = {}) {
  const input = { ...(payload || {}) };
  const order = { ...(input.order || {}) };
  const paid = Number(order.paid_amount ?? input.paid_amount ?? order.amount_paid ?? 0);
  const walletId = String(order.wallet_id || input.wallet_id || "").trim();

  order.order_mode = "DIRECT";
  input.order_mode = "DIRECT";

  if (walletId) {
    order.wallet_id = walletId;
    input.wallet_id = walletId;
  }

  input.order = order;

  if (paid > 0 && !walletId) {
    return {
      success: false,
      message: "Pilih dompet cabang yang benar-benar menerima pembayaran.",
      error: { code: "BRANCH_ORDER_WALLET_REQUIRED" },
    };
  }

  return phpApiRequest("legacyCreateOrder", input, sessionToken);
}

export async function voidOrder(sessionToken, payload = {}) {
  return {
    success: false,
    message: "Aksi void lama diblokir saat cutover. Gunakan reversal/void PHP+MySQL setelah route final tersedia.",
    error: { code: "CUTOVER_LEGACY_CORE_WRITE_BLOCKED" },
  };
}

/**
 * MASTER DATA
 */

export async function getProducts(sessionToken, payload = {}) {
  return phpApiRequest(
    "getMasterDataCoreBootstrap",
    { ...payload, module_type: "produk" },
    sessionToken
  );
}

export async function createProduct(sessionToken, payload = {}) {
  return apiRequest("createProduct", payload, sessionToken);
}

export async function getCustomers(sessionToken, payload = {}) {
  return apiRequest("getCustomers", payload, sessionToken);
}

export async function createCustomer(sessionToken, payload = {}) {
  return apiRequest("createCustomer", payload, sessionToken);
}

export async function getSuppliers(sessionToken, payload = {}) {
  return apiRequest("getSuppliers", payload, sessionToken);
}

export async function createSupplier(sessionToken, payload = {}) {
  return apiRequest("createSupplier", payload, sessionToken);
}

export async function getWallets(sessionToken, payload = {}) {
  return apiRequest("getWallets", payload, sessionToken);
}


/**
 * UANG MASUK / PIUTANG CUSTOMER
 */

export async function getMoneyInBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getFrontendCutoverMoneyInBootstrap", withFastBootstrapPayload(payload, { limit: 100 }), sessionToken);
}

export async function getKasDompetBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getFrontendCutoverWalletBootstrap", withFastBootstrapPayload(payload, { limit: 200 }), sessionToken);
}

export async function getKasDompetMutationDetail(sessionToken, payload = {}) {
  return phpApiRequest("getFrontendCutoverWalletMutationDetail", payload, sessionToken);
}

export async function getFinanceLockBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getFinanceLockBootstrap", withFastBootstrapPayload(payload, { limit: 120 }), sessionToken);
}

export async function createFinanceOtherIncome(sessionToken, payload = {}) {
  return phpApiRequest("createFinanceOtherIncome", payload, sessionToken);
}

export async function transferFinanceWallet(sessionToken, payload = {}) {
  return phpApiRequest("transferFinanceWallet", payload, sessionToken);
}

export async function getFinanceTraceDetail(sessionToken, payload = {}) {
  return phpApiRequest("getFinanceTraceDetail", payload, sessionToken);
}

export async function getKasKeluarBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getCashExpenseBootstrap", withFastBootstrapPayload(payload, { limit: 100 }), sessionToken);
}

export async function createKasKeluar(sessionToken, payload = {}) {
  return phpApiRequest("createCashExpenseLive", payload, sessionToken);
}


/**
 * UANG MASUK / BAYAR PIUTANG LIVE
 */

export async function recordCustomerReceivablePayment(sessionToken, payload = {}) {
  return phpApiRequest("createReceivablePayment", payload, sessionToken);
}

/**
 * 4 AMPLOP
 */


export async function getAmplopBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getFrontendCutoverEnvelopeBootstrap", payload, sessionToken);
}

export async function createAmplopAllocation(sessionToken, payload = {}) {
  return phpApiRequest("createEnvelopeAllocationLive", payload, sessionToken);
}

/**
 * FINANCE / UANG
 */

export async function getCashExpenses(sessionToken, payload = {}) {
  return apiRequest("getCashExpenses", payload, sessionToken);
}

export async function createCashExpense(sessionToken, payload = {}) {
  return apiRequest("createCashExpense", payload, sessionToken);
}

export async function getWalletMutations(sessionToken, payload = {}) {
  return apiRequest("getWalletMutations", payload, sessionToken);
}

export async function recordInvoicePayment(sessionToken, payload = {}) {
  return apiRequest("recordInvoicePayment", payload, sessionToken);
}

export async function getPayables(sessionToken, payload = {}) {
  return apiRequest("getPayables", payload, sessionToken);
}

export async function recordPayablePayment(sessionToken, payload = {}) {
  return apiRequest("recordPayablePayment", payload, sessionToken);
}

/**
 * SETORAN CABANG
 */

export async function getBranchDeposits(sessionToken, payload = {}) {
  return apiRequest("getBranchDeposits", payload, sessionToken);
}

export async function createBranchDeposit(sessionToken, payload = {}) {
  return apiRequest("createBranchDeposit", payload, sessionToken);
}

export async function approveBranchDeposit(sessionToken, payload = {}) {
  return apiRequest("approveBranchDeposit", payload, sessionToken);
}

export async function rejectBranchDeposit(sessionToken, payload = {}) {
  return apiRequest("rejectBranchDeposit", payload, sessionToken);
}


/**
 * LAPORAN HARIAN / SETORAN CABANG
 */

export async function getDailyReportBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getBranchDailyReportBootstrap", payload, sessionToken);
}

export async function submitBranchDailyReport(sessionToken, payload = {}) {
  return phpApiRequest("submitBranchDailyReport", payload, sessionToken);
}

export async function approveBranchDailyReport(sessionToken, payload = {}) {
  return phpApiRequest("approveBranchDailyReport", payload, sessionToken);
}

export async function rejectBranchDailyReport(sessionToken, payload = {}) {
  return phpApiRequest("rejectBranchDailyReport", payload, sessionToken);
}



/**
 * SETORAN CABANG AUTO PULL
 */

export async function getSetoranCabangBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getBranchDepositSettlementBootstrap", payload, sessionToken);
}

export async function createSetoranCabang(sessionToken, payload = {}) {
  return phpApiRequest("createBranchDepositFromReport", payload, sessionToken);
}

export async function approveSetoranCabang(sessionToken, payload = {}) {
  return phpApiRequest("approveBranchDepositSettlement", payload, sessionToken);
}

export async function rejectSetoranCabang(sessionToken, payload = {}) {
  return phpApiRequest("rejectBranchDepositSettlement", payload, sessionToken);
}

/**
 * GLOBAL SMART SEARCH
 */

export async function globalSmartSearch(sessionToken, payload = {}) {
  return phpApiRequest("globalSmartSearch", payload, sessionToken);
}

/**
 * ARSIP DIGITAL
 */

export async function searchArchive(sessionToken, payload = {}) {
  return apiRequest("searchArchive", payload, sessionToken);
}

export async function getArchiveDetail(sessionToken, payload = {}) {
  return apiRequest("getArchiveDetail", payload, sessionToken);
}

export async function getArchiveStats(sessionToken, payload = {}) {
  return apiRequest("getArchiveStats", payload, sessionToken);
}

export async function rebuildArchiveIndex(sessionToken, payload = {}) {
  return apiRequest("rebuildArchiveIndex", payload, sessionToken);
}

/**
 * ARSIP DIGITAL UNIVERSAL / DETAIL ID CLICKABLE
 */

export async function getArchiveUniversalBootstrap(sessionToken, payload = {}) {
  const result = await phpApiRequest("searchArchive", {
    q: payload.query || payload.keyword || payload.search || "",
    module: payload.source_module || payload.module || "",
    status: payload.status || "",
    date_from: payload.date_from || "",
    date_to: payload.date_to || "",
    limit: payload.limit || 50,
    offset: Number(payload.offset || 0),
  }, sessionToken);

  if (!result.success) return result;
  const items = result.data?.items || result.data?.results || [];
  const localModuleCounts = new Map();

  const rows = items.map((row) => {
    const module = row.module || row.source_module || "TRANSAKSI";
    localModuleCounts.set(module, (localModuleCounts.get(module) || 0) + 1);
    return {
      ...row,
      source_id: row.transaction_id || row.source_id || row.archive_id,
      source_module: module,
      source_label: row.source_label || module,
      date: row.transaction_date || row.created_at,
      description: row.summary || row.description || "",
      reference_number: row.transaction_id || row.archive_id,
    };
  });

  const backendModuleStats = Array.isArray(result.data?.module_stats)
    ? result.data.module_stats.map((row) => ({
        ...row,
        source_module: row.source_module || row.module || "TRANSAKSI",
        source_label: row.source_label || row.source_module || row.module || "TRANSAKSI",
        count: Number(row.count || 0),
      }))
    : [];

  const moduleStats = backendModuleStats.length
    ? backendModuleStats
    : Array.from(localModuleCounts.entries()).map(([module, count]) => ({
        source_module: module,
        source_label: module,
        count,
      }));

  const backendSummary = result.data?.summary || {};
  const pagination = result.data?.pagination || {};

  return {
    ...result,
    data: {
      ...result.data,
      results: rows,
      recent_records: rows,
      summary: {
        ...backendSummary,
        total_records: Number(backendSummary.total_records ?? pagination.total ?? rows.length),
        filtered_records: Number(backendSummary.filtered_records ?? rows.length),
        modules_count: Number(backendSummary.modules_count ?? moduleStats.length),
        rows_without_transaction_id: Number(backendSummary.rows_without_transaction_id || 0),
      },
      module_stats: moduleStats,
      status_stats: Array.isArray(result.data?.status_stats) ? result.data.status_stats : [],
      pagination: {
        total: Number(pagination.total || 0),
        limit: Number(pagination.limit || payload.limit || 50),
        offset: Number(pagination.offset || payload.offset || 0),
      },
    },
  };
}

export async function getArchiveUniversalDetail(sessionToken, payload = {}) {
  const transactionId =
    payload.source_id ||
    payload.transaction_id ||
    payload.id ||
    payload.archive_id ||
    "";

  const result = await phpApiRequest("getArchiveDetail", {
    transaction_id: transactionId,
    archive_id: payload.archive_id || "",
  }, sessionToken);

  if (!result.success) return result;
  const data = result.data || {};
  const archive = data.archive || data.main || {};
  const outgoing = Array.isArray(data.links?.outgoing)
    ? data.links.outgoing
    : Array.isArray(data.outgoing_links)
      ? data.outgoing_links
      : [];
  const incoming = Array.isArray(data.links?.incoming)
    ? data.links.incoming
    : Array.isArray(data.incoming_links)
      ? data.incoming_links
      : [];

  const normalizeLink = (row, direction) => {
    const sourceId = direction === "out"
      ? row.to_transaction_id
      : row.from_transaction_id;
    return {
      ...row,
      source_id: sourceId || row.transaction_id || row.source_id || "",
      source_module: row.linked_module || row.source_module || row.module || "TRANSAKSI",
      source_label: row.linked_module || row.source_label || row.source_module || row.module || "TRANSAKSI",
      date: row.linked_transaction_date || row.created_at,
      title: row.linked_title || row.title || row.relationship_type || "Transaksi terkait",
      description: row.notes || row.description || "",
      status: row.linked_status || row.status || "TERCATAT",
      amount: Number(row.linked_amount ?? row.amount ?? 0),
      currency: row.linked_currency || row.currency || "IDR",
      relationship_direction: direction,
      relationship_type: row.relationship_type || "RELATED_TO",
    };
  };

  const relatedRecords = [
    ...outgoing.map((row) => normalizeLink(row, "out")),
    ...incoming.map((row) => normalizeLink(row, "in")),
  ].filter((row) => row.source_id);

  const relationIds = Array.from(new Set(relatedRecords.map((row) => row.source_id).filter(Boolean)));
  const audits = Array.isArray(data.timeline)
    ? data.timeline
    : Array.isArray(data.audit_trail)
      ? data.audit_trail
      : [];

  return {
    ...result,
    data: {
      ...data,
      main: {
        ...archive,
        source_id: archive.transaction_id || transactionId,
        source_module: archive.module || archive.source_module,
        source_label: archive.module || archive.source_label || archive.source_module,
        date: archive.transaction_date || archive.created_at,
        description: archive.summary || archive.description || "",
        reference_number: archive.transaction_id || archive.archive_id,
        raw: archive.snapshot || archive.raw || archive.record || {},
      },
      relation_ids: relationIds,
      related_records: relatedRecords,
      timeline: relatedRecords,
      audit_trail: audits,
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
    },
  };
}


/**
 * OWNER CONTROL / BENANG MERAH
 */

export async function getOwnerControlBootstrap(sessionToken, payload = {}) {
  const php = await phpApiRequest("getOwnerControlBootstrap", payload, sessionToken);
  if (!php.success) return php;

  const core = php.data || {};
  const supplier = core.supplier_position || {};
  const stock = core.stock_position || {};
  const sales = core.sales_cash_position || {};
  const receivable = core.receivable_position || {};
  const cash = core.cash_position || {};
  const envelopes = core.envelope_position || {};
  const serverSummary = core.summary || {};
  const envelopeRows = Array.isArray(envelopes.buckets) ? envelopes.buckets : [];
  const allocatedTotal = envelopeRows.reduce((sum, row) => sum + Number(row.current_balance || 0), 0);

  const alertTitles = {
    NEGATIVE_ENVELOPE: "Alokasi 4 Amplop perlu diperiksa",
    AYAM_ENVELOPE_SHORTFALL: "Dana supplier belum mencukupi",
    PHYSICAL_CASH_BELOW_CURRENT_SUPPLIER_DUE: "Kas tersedia di bawah hutang berjalan",
    RECEIVABLE_OUTSTANDING: "Piutang pelanggan masih terbuka",
    NO_ACTIVE_ENVELOPE_PRESET: "Preset 4 Amplop belum aktif",
    LEGACY_PAYABLE_STATUS_MISMATCH: "Status hutang historis perlu dirapikan",
    CASH_RECOVERY_GAP: "Modal DROP belum kembali penuh",
  };

  const alertDescriptions = {
    NEGATIVE_ENVELOPE: "Pemakaian salah satu alokasi melebihi saldo yang tersedia.",
    AYAM_ENVELOPE_SHORTFALL: "Dana yang dialokasikan untuk pembayaran supplier belum menutup nota berjalan.",
    PHYSICAL_CASH_BELOW_CURRENT_SUPPLIER_DUE: "Saldo kas dan bank lebih kecil daripada hutang supplier berjalan.",
    RECEIVABLE_OUTSTANDING: "Masih ada penjualan yang belum diterima sebagai kas atau bank.",
    NO_ACTIVE_ENVELOPE_PRESET: "Pengaturan pembagian 4 Amplop belum aktif untuk periode berjalan.",
    LEGACY_PAYABLE_STATUS_MISMATCH: "Ada catatan hutang historis yang perlu dirapikan statusnya.",
    CASH_RECOVERY_GAP: "Ada pembelian ayam yang modalnya belum kembali penuh dari penjualan atau pembayaran.",
  };

  const alertStatus = {
    CRITICAL: "Mendesak",
    WARNING: "Perlu Ditinjau",
    INFO: "Pantau",
  };

  const normalizedAlerts = (Array.isArray(core.action_queue) ? core.action_queue : (core.alerts || [])).map((row) => {
    const code = String(row.code || "").toUpperCase();
    return {
      ...row,
      title: row.title || alertTitles[code] || "Perlu ditinjau",
      description: row.description || alertDescriptions[code] || row.message || "Buka rincian untuk melihat sumber transaksi.",
    status: row.status || alertStatus[String(row.severity || "").toUpperCase()] || "Pantau",
    amount_label: row.amount_label || (Number(row.amount || 0) > 0
      ? `Rp ${Number(row.amount || 0).toLocaleString("id-ID")}`
      : (row.count ? `${Number(row.count).toLocaleString("id-ID")} item` : "")),
      support_rows: Array.isArray(row.support_rows) ? row.support_rows : [],
    };
  });

  const summary = {
    wallet: {
      wallet_balance_total: Number(
        serverSummary?.wallet?.wallet_balance_total
        ?? serverSummary?.wallet?.total_balance
        ?? cash.total_live_wallet_balance
        ?? 0
      ),
      total_balance: Number(
        serverSummary?.wallet?.total_balance
        ?? serverSummary?.wallet?.wallet_balance_total
        ?? cash.total_live_wallet_balance
        ?? 0
      ),
      money_in: Number(serverSummary?.wallet?.money_in ?? 0),
      money_out: Number(serverSummary?.wallet?.money_out ?? 0),
      mutation_count: Number(serverSummary?.wallet?.mutation_count ?? 0),
    },
    obligations: {
      hutang_remaining: Number(
        serverSummary?.obligations?.hutang_remaining
        ?? supplier.total_outstanding
        ?? 0
      ),
    },
    stock: {
      ready_pcs: Number(
        serverSummary?.stock?.ready_pcs
        ?? stock.finished_qty_remaining
        ?? 0
      ),
      stock_value: Number(
        serverSummary?.stock?.stock_value
        ?? stock.finished_stock_value
        ?? 0
      ),
    },
    sales: {
      invoice_total: Number(serverSummary?.sales?.invoice_total ?? sales.invoice_total ?? 0),
      sales_total: Number(serverSummary?.sales?.sales_total ?? sales.sales_total ?? 0),
      orders_count: Number(serverSummary?.sales?.orders_count ?? 0),
      receivable_open: Number(
        serverSummary?.sales?.receivable_open
        ?? serverSummary?.receivable?.remaining
        ?? receivable.outstanding
        ?? 0
      ),
    },
    receivable: {
      remaining: Number(serverSummary?.receivable?.remaining ?? receivable.outstanding ?? 0),
      open_count: Number(serverSummary?.receivable?.open_count ?? receivable.open_count ?? 0),
    },
    chicken: {
      total_drop_kg: Number(serverSummary?.chicken?.total_drop_kg ?? 0),
      remaining_kg: Number(serverSummary?.chicken?.remaining_kg ?? 0),
    },
    production: {
      batch_count: Number(serverSummary?.production?.batch_count ?? 0),
      output_pcs: Number(serverSummary?.production?.output_pcs ?? 0),
    },
    po: {
      po_count: Number(serverSummary?.po?.po_count ?? 0),
      po_qty: Number(serverSummary?.po?.po_qty ?? 0),
      reserved_qty: Number(serverSummary?.po?.reserved_qty ?? 0),
      shortage_qty: Number(serverSummary?.po?.shortage_qty ?? 0),
    },
    branch: {
      deposit_pending: Number(serverSummary?.branch?.deposit_pending ?? 0),
      request_pending_count: Number(serverSummary?.branch?.request_pending_count ?? 0),
    },
    owner_obligations: {
      due_this_month: Number(serverSummary?.owner_obligations?.due_this_month ?? 0),
    },
    payroll: {
      unpaid_total: Number(serverSummary?.payroll?.unpaid_total ?? 0),
    },
    amplop: {
      allocated_total: Number(serverSummary?.amplop?.allocated_total ?? allocatedTotal),
      unallocated: Number(serverSummary?.amplop?.unallocated ?? 0),
    },
  };

  return {
    ...php,
    data: {
      ...core,
      summary,
      alerts: core.alerts || [],
      recommendations: core.recommendations || [],
      action_queue: normalizedAlerts,
      recent_transactions: Array.isArray(core.recent_transactions) ? core.recent_transactions : [],
    },
  };
}


/**
 * REQUEST BARANG CABANG / DO ANTAR LOKASI — PHP/MYSQL SINGLE SOURCE
 */

export async function branchTransferHealth(sessionToken, payload = {}) {
  return phpApiRequest("branchTransferHealth", payload, sessionToken);
}

export async function getRequestDOStockBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getRequestDOStockBootstrap", payload, sessionToken);
}

export async function createBranchGoodsRequest(sessionToken, payload = {}) {
  return phpApiRequest("createBranchGoodsRequest", payload, sessionToken);
}

export async function approveBranchGoodsRequest(sessionToken, payload = {}) {
  return phpApiRequest("approveBranchGoodsRequest", payload, sessionToken);
}

export async function rejectBranchGoodsRequest(sessionToken, payload = {}) {
  return phpApiRequest("rejectBranchGoodsRequest", payload, sessionToken);
}

export async function cancelBranchGoodsRequest(sessionToken, payload = {}) {
  return phpApiRequest("cancelBranchGoodsRequest", payload, sessionToken);
}

export async function createDeliveryOrderFromRequest(sessionToken, payload = {}) {
  return phpApiRequest("createDeliveryOrderFromRequest", payload, sessionToken);
}

export async function receiveDeliveryOrder(sessionToken, payload = {}) {
  return phpApiRequest("receiveDeliveryOrder", payload, sessionToken);
}


/**
 * HRD / PAYROLL — PHP/MYSQL SINGLE SOURCE (PART 5A)
 */

export async function hrdPayrollHealth(sessionToken, payload = {}) {
  return phpApiRequest("hrdPayrollHealth", payload, sessionToken);
}

export async function getHRDPayrollBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getHRDPayrollBootstrap", payload, sessionToken);
}

export async function previewHRDPayrollV32Import(sessionToken, payload = {}) {
  return phpApiRequest("previewHRDPayrollV32Import", payload, sessionToken);
}

export async function importHRDPayrollV32Backup(sessionToken, payload = {}) {
  return phpApiRequest("importHRDPayrollV32Backup", payload, sessionToken);
}

export async function createHRDEmployee(sessionToken, payload = {}) {
  return phpApiRequest("createHRDEmployee", payload, sessionToken);
}

export async function createHRDAttendance(sessionToken, payload = {}) {
  return phpApiRequest("createHRDAttendance", payload, sessionToken);
}

export async function createHRDKasbonNote(sessionToken, payload = {}) {
  return phpApiRequest("createHRDKasbonNote", payload, sessionToken);
}

export async function createHRDLoanNote(sessionToken, payload = {}) {
  return phpApiRequest("createHRDLoanNote", payload, sessionToken);
}

export async function getHRDEmployeeProfile(sessionToken, payload = {}) {
  return phpApiRequest("getHRDEmployeeProfile", payload, sessionToken);
}

export async function updateHRDEmployee(sessionToken, payload = {}) {
  return phpApiRequest("updateHRDEmployee", payload, sessionToken);
}

export async function voidHRDEmployee(sessionToken, payload = {}) {
  return phpApiRequest("voidHRDEmployee", payload, sessionToken);
}

export async function updateHRDAttendance(sessionToken, payload = {}) {
  return phpApiRequest("updateHRDAttendance", payload, sessionToken);
}

export async function voidHRDAttendance(sessionToken, payload = {}) {
  return phpApiRequest("voidHRDAttendance", payload, sessionToken);
}

export async function updateHRDKasbonNote(sessionToken, payload = {}) {
  return phpApiRequest("updateHRDKasbonNote", payload, sessionToken);
}

export async function voidHRDKasbonNote(sessionToken, payload = {}) {
  return phpApiRequest("voidHRDKasbonNote", payload, sessionToken);
}

export async function updateHRDLoanNote(sessionToken, payload = {}) {
  return phpApiRequest("updateHRDLoanNote", payload, sessionToken);
}

export async function voidHRDLoanNote(sessionToken, payload = {}) {
  return phpApiRequest("voidHRDLoanNote", payload, sessionToken);
}

// Part 5B akan memindahkan draft, closing, reopen, payment, dan print final.
export async function hrdPayrollFinalHealth(sessionToken, payload = {}) {
  return phpApiRequest("hrdPayrollFinalHealth", payload, sessionToken);
}

export async function getHRDPayrollFinalBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getHRDPayrollFinalBootstrap", payload, sessionToken);
}

export async function previewHRDPayrollFinal(sessionToken, payload = {}) {
  return phpApiRequest("previewHRDPayrollFinal", payload, sessionToken);
}

export async function createHRDPayrollDraft(sessionToken, payload = {}) {
  return phpApiRequest("saveHRDPayrollDraft", payload, sessionToken);
}

export async function createHRDPayrollClosing(sessionToken, payload = {}) {
  return phpApiRequest("closeHRDPayroll", payload, sessionToken);
}

export async function voidHRDPayrollDraft(sessionToken, payload = {}) {
  return phpApiRequest("voidHRDPayrollDraft", payload, sessionToken);
}

export async function reopenHRDPayroll(sessionToken, payload = {}) {
  return phpApiRequest("reopenHRDPayroll", payload, sessionToken);
}

export async function createHRDPayrollPayment(sessionToken, payload = {}) {
  return phpApiRequest("payHRDPayroll", payload, sessionToken);
}

export async function recordHRDPayrollPrint(sessionToken, payload = {}) {
  return phpApiRequest("recordHRDPayrollPrint", payload, sessionToken);
}


/**
 * KEWAJIBAN OWNER / CICILAN USAHA
 */

export async function getOwnerObligationBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getOwnerObligationBootstrap", payload, sessionToken);
}

export async function createOwnerObligation(sessionToken, payload = {}) {
  return phpApiRequest("createOwnerObligation", payload, sessionToken);
}

export async function payOwnerObligation(sessionToken, payload = {}) {
  return phpApiRequest("payOwnerObligation", payload, sessionToken);
}

export async function seedOwnerObligations() {
  return { success: false, message: "Seed kewajiban dinonaktifkan. Masukkan data nyata secara manual.", error: { code: "OWNER_OBLIGATION_SEED_DISABLED" } };
}

export async function getOwnerObligationDetail(sessionToken, payload = {}) {
  return phpApiRequest("getOwnerObligationDetail", payload, sessionToken);
}


/**
 * LAPORAN OWNER / CLOSING PERIODE READ-ONLY
 */

export async function getOwnerPeriodReportBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getOwnerPeriodReportBootstrap", payload, sessionToken);
}

export async function createOwnerPeriodClosingSnapshot(sessionToken, payload = {}) {
  return phpApiRequest("createOwnerPeriodClosingSnapshot", payload, sessionToken);
}

export async function createOwnerPeriodClosingRevision(sessionToken, payload = {}) {
  return phpApiRequest("createOwnerPeriodClosingRevision", payload, sessionToken);
}



/**
 * PRINT OPERASIONAL UNIVERSAL / ARSIP DIGITAL
 */

export async function getOperationalPrintDocument(sessionToken, payload = {}) {
  return phpApiRequest("getOperationalPrintDocument", payload, sessionToken);
}

export async function recordOperationalPrint(sessionToken, payload = {}) {
  return phpApiRequest("recordOperationalPrint", payload, sessionToken);
}

export { getConfiguredApiUrl };

/**
 * HUTANG NANA / SUPPLIER AYAM
 */

export async function getHutangNanaBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getSupplierDebtBootstrap", withFastBootstrapPayload(payload, { limit: 100 }), sessionToken);
}

export async function recordHutangNanaPayment(sessionToken, payload = {}) {
  return phpApiRequest("paySupplierDebt", payload, sessionToken);
}

/**
 * ANTRIAN PO / STOK RESERVED / PO KARANTINA
 */

export async function getPOQueueBootstrap(sessionToken, payload = {}) {
  return phpApiRequest(
    "getPOQueueBootstrap",
    withFastBootstrapPayload(payload, { limit: 50 }),
    sessionToken
  );
}

export async function createPOQueue(sessionToken, payload = {}) {
  return phpApiRequest("createPOQueue", payload, sessionToken);
}

export async function confirmPOQueue(sessionToken, payload = {}) {
  return phpApiRequest("confirmPOQueue", payload, sessionToken);
}

export async function cancelPOQueue(sessionToken, payload = {}) {
  return phpApiRequest("cancelPOQueue", payload, sessionToken);
}

/**
 * MASTER DATA CORE / PHP MYSQL LIVE WRITE
 */

export async function getMasterDataCoreBootstrap(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "getMasterDataCoreBootstrap",
    payload,
    sessionToken
  );
}

export async function createMasterDataCoreRecord(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "createMasterDataCoreRecord",
    payload,
    sessionToken
  );
}

export async function updateMasterDataCoreRecord(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "updateMasterDataCoreRecord",
    payload,
    sessionToken
  );
}

export async function setMasterDataCoreStatus(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "setMasterDataCoreStatus",
    payload,
    sessionToken
  );
}

/**
 * Tetap disediakan supaya import lama tidak crash.
 * Backend PHP/MySQL memblokir auto-seed.
 */
export async function seedMasterDataCoreDefaults(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "legacySeedMasterDataCoreDefaults",
    payload,
    sessionToken
  );
}

/**
 * PRODUCT PRICING ENGINE / PHP MYSQL LIVE WRITE
 *
 * Tidak ada seed harga dan tidak ada fallback nominal dari frontend.
 * Seluruh harga harus berasal dari rule PHP/MySQL yang dibuat secara sadar.
 */

export async function productPricingHealth(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "productPricingHealth",
    payload,
    sessionToken
  );
}

export async function getProductPricingBootstrap(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "getProductPricingBootstrap",
    payload,
    sessionToken
  );
}

export async function resolveProductSellingPrice(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "resolveProductSellingPrice",
    payload,
    sessionToken
  );
}

export async function createProductPriceRule(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "createProductPriceRule",
    payload,
    sessionToken
  );
}

export async function updateProductPriceRule(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "updateProductPriceRule",
    payload,
    sessionToken
  );
}

export async function setProductPriceRuleStatus(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "setProductPriceRuleStatus",
    payload,
    sessionToken
  );
}

export async function productPricingRollbackProbe(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "productPricingRollbackProbe",
    payload,
    sessionToken
  );
}

/**
 * STOK AYAM / LOT AYAM
 */

export async function getChickenStockBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getLegacyChickenStockBootstrap", withFastBootstrapPayload(payload, { limit: 100 }), sessionToken);
}

/**
 * Owner-only acceptance probe. Semua customer/rule/stok/order sementara
 * dibuat di dalam database transaction dan selalu rollback.
 */
export async function orderPricingLockRollbackProbe(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "orderPricingLockRollbackProbe",
    payload,
    sessionToken
  );
}

/**
 * PRICING CUTOVER READINESS / READ ONLY
 *
 * Tidak membuat rule harga, tidak mengaktifkan nominal, dan tidak menulis
 * transaksi. Hanya membaca kesiapan Pricing Engine, Server Price Lock,
 * coverage produk/lokasi, dan stok bebas.
 */
export async function getPricingCutoverReadiness(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "getPricingCutoverReadiness",
    payload,
    sessionToken
  );
}

/**
 * TANGERANG REAL GO-LIVE CUTOVER / PART 2F
 *
 * Bootstrap hanya membaca kesiapan. Aktivasi adalah real write Owner-only
 * yang menghubungkan harga resmi, opening stok jadi, HPP terkunci, jurnal,
 * arsip, dan audit dalam satu database transaction.
 */
export async function getTangerangGoLiveBootstrap(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "getTangerangGoLiveBootstrap",
    payload,
    sessionToken
  );
}

export async function activateTangerangGoLiveCutover(
  sessionToken,
  payload = {}
) {
  return phpApiRequest(
    "activateTangerangGoLiveCutover",
    payload,
    sessionToken
  );
}

/**
 * PART 3A — BRANCH ACCOUNT & PERMISSION LIVE
 *
 * Owner membuat akun nyata secara manual. Tidak ada username/password seed.
 * Password hanya dikirim saat create/reset lalu disimpan backend sebagai hash.
 */
export async function branchAccessHealth(sessionToken, payload = {}) {
  return phpApiRequest("branchAccessHealth", payload, sessionToken);
}

export async function getBranchAccessBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getBranchAccessBootstrap", payload, sessionToken);
}

export async function createBranchUser(sessionToken, payload = {}) {
  return phpApiRequest("createBranchUser", payload, sessionToken);
}

export async function updateBranchUser(sessionToken, payload = {}) {
  return phpApiRequest("updateBranchUser", payload, sessionToken);
}

export async function setBranchUserStatus(sessionToken, payload = {}) {
  return phpApiRequest("setBranchUserStatus", payload, sessionToken);
}

export async function resetBranchUserPassword(sessionToken, payload = {}) {
  return phpApiRequest("resetBranchUserPassword", payload, sessionToken);
}

/**
 * PART 3C — KASIR, HARGA, STOK, DAN UANG CABANG
 */

export async function getBranchCommerceHealth(sessionToken, payload = {}) {
  return phpApiRequest("branchCommerceHealth", payload, sessionToken);
}

export async function getBranchCommerceBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getBranchCommerceBootstrap", payload, sessionToken);
}

export async function createBranchWallet(sessionToken, payload = {}) {
  return phpApiRequest("createBranchWallet", payload, sessionToken);
}

export async function activateBranchCommerce(sessionToken, payload = {}) {
  return phpApiRequest("activateBranchCommerce", payload, sessionToken);
}

export async function setBranchCommerceStatus(sessionToken, payload = {}) {
  return phpApiRequest("setBranchCommerceStatus", payload, sessionToken);
}

/**
 * PART 4A — GO-LIVE CONTROL & OPENING DATA
 * Read-only control center. Tidak membuat harga, saldo, stok, akun, atau transaksi.
 */
export async function goLiveControlHealth(sessionToken, payload = {}) {
  return phpApiRequest("goLiveControlHealth", payload, sessionToken);
}

export async function getGoLiveControlBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getGoLiveControlBootstrap", payload, sessionToken);
}


/**
 * PART 6A — DATA HEALTH, BACKUP & RECOVERY PHP/MYSQL
 * Pemeriksaan read-only. Snapshot dan manifest backup tidak mengubah transaksi bisnis.
 */
export async function systemSafetyHealth(sessionToken, payload = {}) {
  return phpApiRequest("systemSafetyHealth", payload, sessionToken);
}

export async function getSystemSafetyBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getSystemSafetyBootstrap", payload, sessionToken);
}

export async function createSystemHealthSnapshot(sessionToken, payload = {}) {
  return phpApiRequest("createSystemHealthSnapshot", payload, sessionToken);
}

export async function createSystemBackupManifest(sessionToken, payload = {}) {
  return phpApiRequest("createSystemBackupManifest", payload, sessionToken);
}

/**
 * PART 6B — DATA REPAIR & INTEGRITY CLEANUP
 * Scan mencatat kasus saja. Apply membutuhkan konfirmasi Owner dan tidak menghapus histori.
 */
export async function systemIntegrityRepairHealth(sessionToken, payload = {}) {
  return phpApiRequest("systemIntegrityRepairHealth", payload, sessionToken);
}

export async function getSystemIntegrityRepairBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getSystemIntegrityRepairBootstrap", payload, sessionToken);
}

export async function scanSystemIntegrityCases(sessionToken, payload = {}) {
  return phpApiRequest("scanSystemIntegrityCases", payload, sessionToken);
}

export async function applySystemIntegritySafeBatch(sessionToken, payload = {}) {
  return phpApiRequest("applySystemIntegritySafeBatch", payload, sessionToken);
}

/**
 * PART 6C — GO-LIVE GATE & FIRST LIVE CYCLE
 * Tidak membuat data bisnis. Start/complete hanya menyimpan snapshot gate dan
 * bukti transaksi nyata yang terbentuk setelah siklus dimulai.
 */
export async function goLiveCycleHealth(sessionToken, payload = {}) {
  return phpApiRequest("goLiveCycleHealth", payload, sessionToken);
}

export async function getGoLiveCycleBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getGoLiveCycleBootstrap", payload, sessionToken);
}

export async function startGoLiveFirstCycle(sessionToken, payload = {}) {
  return phpApiRequest("startGoLiveFirstCycle", payload, sessionToken);
}

export async function completeGoLiveFirstCycle(sessionToken, payload = {}) {
  return phpApiRequest("completeGoLiveFirstCycle", payload, sessionToken);
}
