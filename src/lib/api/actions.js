import { apiRequest, phpApiRequest, legacyApiRequest, getLegacySessionToken, getConfiguredApiUrl } from "./client";

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
  // PHP/MySQL login is mandatory after cutover approval.
  const php = await phpApiRequest("login", { username, password }, "");
  if (!php.success) return php;

  // Legacy session is best-effort and only serves not-yet-migrated modules.
  const legacy = await legacyApiRequest("login", { username, password }, "");
  const normalized = normalizeLoginPayload(php);

  return {
    success: true,
    message: legacy.success
      ? "Login PHP/MySQL berhasil. Legacy fallback siap."
      : "Login PHP/MySQL berhasil. Beberapa modul legacy mungkin meminta login ulang.",
    data: {
      ...normalized,
      legacySessionToken:
        legacy?.data?.session_token ||
        legacy?.data?.sessionToken ||
        legacy?.data?.token ||
        "",
      legacyFallbackReady: Boolean(legacy.success),
    },
    raw: { php, legacy },
  };
}

export async function logoutUser(sessionToken) {
  const legacyToken = getLegacySessionToken();
  const [php] = await Promise.all([
    phpApiRequest("logout", {}, sessionToken),
    legacyToken
      ? legacyApiRequest("logout", {}, legacyToken)
      : Promise.resolve({ success: true }),
  ]);
  return php;
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
    withFastBootstrapPayload(payload, { limit: 30 }),
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
  const method = String(order.payment_method || input.payment_method || "").toUpperCase();

  order.order_mode = "DIRECT";
  input.order_mode = "DIRECT";
  input.order = order;

  if (paid > 0 && !input.wallet_id && !order.wallet_id) {
    const bootstrap = await phpApiRequest("getWalletBootstrap", {}, sessionToken);
    if (!bootstrap.success) return bootstrap;

    const wallets = bootstrap.data?.wallets || [];
    const wallet = wallets.find((row) => {
      const haystack = [
        row.wallet_id,
        row.wallet_code,
        row.wallet_name,
      ].map((v) => String(v || "").toUpperCase()).join(" ");

      if (method.includes("BCA")) return haystack.includes("BCA");
      if (method.includes("BRI")) return haystack.includes("BRI");
      if (method.includes("CASH") || method.includes("TUNAI")) {
        return haystack.includes("CASH") || haystack.includes("TUNAI") || haystack.includes("KAS");
      }
      return haystack.includes(method);
    });

    if (!wallet) {
      return {
        success: false,
        message: `Dompet PHP/MySQL untuk metode ${method || "pembayaran"} tidak ditemukan.`,
        error: { code: "CUTOVER_ORDER_WALLET_NOT_FOUND" },
      };
    }

    input.wallet_id = wallet.wallet_id;
    order.wallet_id = wallet.wallet_id;
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
  return apiRequest("getProducts", payload, sessionToken);
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

export async function getKasKeluarBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyCashExpenseBootstrap", withFastBootstrapPayload(payload, { limit: 30 }), sessionToken);
}

export async function createKasKeluar(sessionToken, payload = {}) {
  return apiRequest("legacyCreateCashExpenseFromOldExpense", payload, sessionToken);
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
  return phpApiRequest("legacyCreateAmplopAllocation", payload, sessionToken);
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
  return apiRequest("getLegacyDailyReportBootstrap", payload, sessionToken);
}



/**
 * SETORAN CABANG AUTO PULL
 */

export async function getSetoranCabangBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyBranchDepositBootstrap", payload, sessionToken);
}

export async function createSetoranCabang(sessionToken, payload = {}) {
  return apiRequest("legacyCreateBranchDepositFromDailyReport", payload, sessionToken);
}

export async function approveSetoranCabang(sessionToken, payload = {}) {
  return apiRequest("legacyApproveBranchDeposit", payload, sessionToken);
}

export async function rejectSetoranCabang(sessionToken, payload = {}) {
  return apiRequest("legacyRejectBranchDeposit", payload, sessionToken);
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
    limit: payload.limit || 50,
    offset: 0,
  }, sessionToken);

  if (!result.success) return result;
  const items = result.data?.items || result.data?.results || [];
  const moduleCounts = new Map();

  const rows = items.map((row) => {
    const module = row.module || row.source_module || "TRANSAKSI";
    moduleCounts.set(module, (moduleCounts.get(module) || 0) + 1);
    return {
      ...row,
      source_id: row.transaction_id || row.source_id || row.archive_id,
      source_module: module,
      date: row.transaction_date || row.created_at,
      reference_number: row.transaction_id || row.archive_id,
    };
  });

  return {
    ...result,
    data: {
      results: rows,
      recent_records: rows,
      summary: {
        total_records: Number(result.data?.pagination?.total || rows.length),
        filtered_records: rows.length,
        modules_count: moduleCounts.size,
      },
      module_stats: Array.from(moduleCounts.entries()).map(([module, count]) => ({ module, count })),
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
  const links = [...(data.outgoing_links || []), ...(data.incoming_links || [])];
  const audits = data.timeline || data.audit_trail || [];

  return {
    ...result,
    data: {
      ...data,
      main: {
        ...archive,
        source_id: archive.transaction_id || transactionId,
        source_module: archive.module || archive.source_module,
        date: archive.transaction_date || archive.created_at,
        reference_number: archive.transaction_id || archive.archive_id,
      },
      relation_ids: links,
      related_records: links,
      timeline: [...links, ...audits],
      audit_trail: audits,
    },
  };
}


/**
 * OWNER CONTROL / BENANG MERAH
 */

export async function getOwnerControlBootstrap(sessionToken, payload = {}) {
  const [php, legacy] = await Promise.all([
    phpApiRequest("getOwnerControlBootstrap", payload, sessionToken),
    legacyApiRequest("getLegacyOwnerControlBootstrap", payload, getLegacySessionToken()),
  ]);

  if (!php.success) return php;

  const core = php.data || {};
  const legacyData = legacy.success ? (legacy.data || {}) : {};
  const legacySummary = legacyData.summary || {};

  const supplier = core.supplier_position || {};
  const stock = core.stock_position || {};
  const sales = core.sales_cash_position || {};
  const receivable = core.receivable_position || {};
  const cash = core.cash_position || {};
  const envelopes = core.envelope_position || {};

  const envelopeRows = envelopes.buckets || envelopes || [];
  const allocatedTotal = Array.isArray(envelopeRows)
    ? envelopeRows.reduce((sum, row) => sum + Number(row.current_balance || 0), 0)
    : 0;

  return {
    ...php,
    data: {
      ...legacyData,
      ...core,
      summary: {
        ...legacySummary,
        wallet: {
          ...(legacySummary.wallet || {}),
          money_in: Number(sales.total_cash_in || sales.cash_in_total || cash.total_balance || 0),
          mutation_count: Number(cash.mutation_count || 0),
          total_balance: Number(cash.total_balance || 0),
        },
        obligations: {
          ...(legacySummary.obligations || {}),
          hutang_remaining: Number(supplier.total_outstanding || supplier.grand_outstanding || supplier.outstanding || 0),
        },
        stock: {
          ...(legacySummary.stock || {}),
          ready_pcs: Number(stock.free_qty || stock.ready_pcs || 0),
          stock_value: Number(stock.physical_value || stock.stock_value || 0),
        },
        sales: {
          ...(legacySummary.sales || {}),
          invoice_total: Number(sales.invoice_total || sales.total_sales || 0),
          orders_count: Number(sales.order_count || 0),
        },
        amplop: {
          ...(legacySummary.amplop || {}),
          allocated_total: allocatedTotal,
          unallocated: Number(envelopes.unallocated || 0),
        },
        receivable: {
          ...(legacySummary.receivable || {}),
          remaining: Number(receivable.total_outstanding || receivable.outstanding || 0),
        },
      },
      alerts: core.alerts || legacyData.alerts || [],
      recommendations: core.recommendations || [],
      action_queue: legacyData.action_queue || core.alerts || [],
    },
  };
}


/**
 * REQUEST BARANG CABANG / DO ANTAR LOKASI
 */

export async function getRequestDOStockBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyRequestDOStockBootstrap", payload, sessionToken);
}

export async function createBranchGoodsRequest(sessionToken, payload = {}) {
  return apiRequest("legacyCreateBranchGoodsRequest", payload, sessionToken);
}

export async function approveBranchGoodsRequest(sessionToken, payload = {}) {
  return apiRequest("legacyApproveBranchGoodsRequest", payload, sessionToken);
}

export async function createDeliveryOrderFromRequest(sessionToken, payload = {}) {
  return apiRequest("legacyCreateDeliveryOrderFromRequest", payload, sessionToken);
}

export async function receiveDeliveryOrder(sessionToken, payload = {}) {
  return apiRequest("legacyReceiveDeliveryOrder", payload, sessionToken);
}



/**
 * HRD / PAYROLL FOUNDATION
 */

export async function getHRDPayrollBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyHRDPayrollBootstrap", payload, sessionToken);
}

export async function createHRDEmployee(sessionToken, payload = {}) {
  return apiRequest("legacyCreateHRDEmployee", payload, sessionToken);
}

export async function createHRDKasbonNote(sessionToken, payload = {}) {
  return apiRequest("legacyCreateHRDKasbonNote", payload, sessionToken);
}

export async function createHRDLoanNote(sessionToken, payload = {}) {
  return apiRequest("legacyCreateHRDLoanNote", payload, sessionToken);
}

export async function createHRDPayrollDraft(sessionToken, payload = {}) {
  return apiRequest("legacyCreateHRDPayrollDraft", payload, sessionToken);
}

export async function createHRDPayrollClosing(sessionToken, payload = {}) {
  return apiRequest("legacyCloseHRDPayrollDraft", payload, sessionToken);
}

export async function createHRDPayrollPayment(sessionToken, payload = {}) {
  return apiRequest("legacyPayClosedHRDPayroll", payload, sessionToken);
}



/**
 * KEWAJIBAN OWNER / CICILAN USAHA
 */

export async function getOwnerObligationBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyOwnerObligationBootstrap", payload, sessionToken);
}

export async function createOwnerObligation(sessionToken, payload = {}) {
  return apiRequest("legacyCreateOwnerObligation", payload, sessionToken);
}

export async function payOwnerObligation(sessionToken, payload = {}) {
  return apiRequest("legacyPayOwnerObligation", payload, sessionToken);
}

export async function seedOwnerObligations(sessionToken, payload = {}) {
  return apiRequest("legacySeedOwnerObligations", payload, sessionToken);
}

export async function getOwnerObligationDetail(sessionToken, payload = {}) {
  return apiRequest("getLegacyOwnerObligationDetail", payload, sessionToken);
}


/**
 * LAPORAN OWNER / CLOSING PERIODE READ-ONLY
 */

export async function getOwnerPeriodReportBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyOwnerPeriodReportBootstrap", payload, sessionToken);
}

export async function createOwnerPeriodClosingSnapshot(sessionToken, payload = {}) {
  return apiRequest("legacyCreateOwnerPeriodClosingSnapshot", payload, sessionToken);
}

export async function createOwnerPeriodClosingRevision(sessionToken, payload = {}) {
  return apiRequest("legacyCreateOwnerPeriodClosingRevision", payload, sessionToken);
}

export { getConfiguredApiUrl };

/**
 * HUTANG NANA / SUPPLIER AYAM
 */

export async function getHutangNanaBootstrap(sessionToken, payload = {}) {
  return phpApiRequest("getLegacyHutangNanaBootstrap", withFastBootstrapPayload(payload, { limit: 100 }), sessionToken);
}

export async function recordHutangNanaPayment(sessionToken, payload = {}) {
  return phpApiRequest("legacyRecordHutangNanaPayment", payload, sessionToken);
}

/**
 * ANTRIAN PO / STOK RESERVED / PO KARANTINA
 */

export async function getPOQueueBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyPOQueueBootstrap", payload, sessionToken);
}

export async function createPOQueue(sessionToken, payload = {}) {
  return apiRequest("legacyCreatePOQueueFromOrder", payload, sessionToken);
}

export async function cancelPOQueue(sessionToken, payload = {}) {
  return apiRequest("legacyCancelPOQueue", payload, sessionToken);
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
  return apiRequest("getLegacyChickenStockBootstrap", payload, sessionToken);
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
