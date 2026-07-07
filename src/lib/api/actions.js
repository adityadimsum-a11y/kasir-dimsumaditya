import { apiRequest, getConfiguredApiUrl } from "./client";

const normalizeLoginPayload = (result) => {
  const payload = result.data || {};
  const user = payload.user || {};
  const sessionToken = payload.session_token || payload.sessionToken || "";

  return {
    sessionToken,
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
    allowedMenus: payload.allowed_menus || payload.allowedMenus || [],
    raw: payload,
  };
};

/**
 * AUTH
 */

export async function loginUser({ username, password }) {
  const result = await apiRequest("login", { username, password }, "");

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    message: result.message || "Login berhasil.",
    data: normalizeLoginPayload(result),
    raw: result,
  };
}

export async function logoutUser(sessionToken) {
  return apiRequest("logout", {}, sessionToken);
}

export async function getCurrentUser(sessionToken) {
  return apiRequest("getCurrentUser", {}, sessionToken);
}

/**
 * FOUNDATION / BRIDGE
 */

export async function pingBackend() {
  return apiRequest("legacyBridgePing", {}, "");
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
  return apiRequest("getLegacyChickenPurchaseBootstrap", payload, sessionToken);
}

export async function createDropAyam(sessionToken, payload = {}) {
  return apiRequest(
    "legacyCreateChickenDropFromOldPurchase",
    payload,
    sessionToken
  );
}

/**
 * PRODUKSI / ADUKAN
 * Belum dipakai di Part 2A, tapi disiapkan supaya action tetap 1 pintu.
 */

export async function getProductionBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyProductionBootstrap", payload, sessionToken);
}

export async function createProductionBatch(sessionToken, payload = {}) {
  return apiRequest(
    "legacyCreateProductionBatchFromOldFactory",
    payload,
    sessionToken
  );
}

export async function voidProductionBatch(sessionToken, payload = {}) {
  return apiRequest(
    "legacyVoidProductionBatchFromOldFactory",
    payload,
    sessionToken
  );
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
  return apiRequest("getLegacyFinishedStockBootstrap", payload, sessionToken);
}

/**
 * KASIR / ORDER
 */

export async function getOrderBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyOrderBootstrap", payload, sessionToken);
}

export async function createOrder(sessionToken, payload = {}) {
  return apiRequest("legacyCreateOrderFromOldPos", payload, sessionToken);
}

export async function voidOrder(sessionToken, payload = {}) {
  return apiRequest("legacyVoidOrderFromOldPos", payload, sessionToken);
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
  return apiRequest("getLegacyMoneyInBootstrap", payload, sessionToken);
}

export async function getKasDompetBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyWalletBootstrap", payload, sessionToken);
}

export async function getKasKeluarBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyCashExpenseBootstrap", payload, sessionToken);
}

export async function createKasKeluar(sessionToken, payload = {}) {
  return apiRequest("legacyCreateCashExpenseFromOldExpense", payload, sessionToken);
}

/**
 * 4 AMPLOP
 */


export async function getAmplopBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyAmplopBootstrap", payload, sessionToken);
}

export async function createAmplopAllocation(sessionToken, payload = {}) {
  return apiRequest("legacyCreateAmplopAllocation", payload, sessionToken);
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
  return apiRequest("getLegacyArchiveUniversalBootstrap", payload, sessionToken);
}

export async function getArchiveUniversalDetail(sessionToken, payload = {}) {
  return apiRequest("getLegacyArchiveUniversalDetail", payload, sessionToken);
}


/**
 * OWNER CONTROL / BENANG MERAH
 */

export async function getOwnerControlBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyOwnerControlBootstrap", payload, sessionToken);
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

export { getConfiguredApiUrl };

/**
 * HUTANG NANA / SUPPLIER AYAM
 */

export async function getHutangNanaBootstrap(sessionToken, payload = {}) {
  return apiRequest("getLegacyHutangNanaBootstrap", payload, sessionToken);
}

export async function recordHutangNanaPayment(sessionToken, payload = {}) {
  return apiRequest("legacyRecordHutangNanaPayment", payload, sessionToken);
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
