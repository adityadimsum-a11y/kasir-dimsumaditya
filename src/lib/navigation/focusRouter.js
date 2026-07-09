/********************************************************
 * focusRouter.js
 * ERP DIMSUM ADITYA — Cross Module Focus v1
 *
 * Tujuan:
 * - Membaca link lama seperti /finance/cash-expenses?focus=KASOUT-xxx
 * - Mengubahnya menjadi navigasi internal SPA: ?page=kas-keluar&focus=KASOUT-xxx
 * - Mengirim event ke App.jsx agar halaman aktif pindah tanpa reload kasar
 *
 * Aman:
 * - Tidak mengubah data.
 * - Tidak memanggil backend.
 * - Tidak memotong dompet/stok/payroll/closing.
 ********************************************************/

export const FOCUS_EVENT_NAME = "da:navigate-focus";

const PAGE_LABELS = {
  "papan-pusat": "Papan Pantau",
  "owner-control": "Owner Control",
  "arsip-digital": "Arsip Digital",
  "closing-owner": "Laporan Owner",
  "system-health": "Data Health",
  "drop-ayam": "DROP Ayam",
  "stok-ayam": "Stok Ayam",
  "produksi-adukan": "Produksi / Adukan",
  "barang-freezer": "Barang Masuk Freezer",
  "stok-jadi": "Stok Jadi",
  "kasir-order": "Kasir / Order",
  "antrian-po": "Antrian PO",
  "uang-masuk": "Uang Masuk",
  "kas-dompet": "Kas & Dompet",
  "kas-keluar": "Belanja & Kas Keluar",
  "hutang-nana": "Hutang Nana",
  "kewajiban-owner": "Kewajiban Owner",
  "empat-amplop": "4 Amplop",
  "laporan-harian": "Laporan Harian",
  "setoran-cabang": "Setoran Cabang",
  "request-do": "Request & DO",
  "hrd-payroll": "HRD / Payroll",
  "master-produk": "Produk",
  "master-customer": "Customer",
  "master-supplier": "Supplier",
  "master-lokasi": "Lokasi",
};

const ROUTE_TO_PAGE = [
  { match: "/finance/cash-expenses", pageKey: "kas-keluar", sourceModule: "KAS_KELUAR" },
  { match: "/finance/owner-obligations", pageKey: "kewajiban-owner", sourceModule: "KEWAJIBAN_OWNER" },
  { match: "/finance/branch-deposits", pageKey: "setoran-cabang", sourceModule: "SETORAN_CABANG" },
  { match: "/distribution/transfers", pageKey: "request-do", sourceModule: "DELIVERY_ORDER" },
  { match: "/production/adukan", pageKey: "produksi-adukan", sourceModule: "PRODUCTION" },
  { match: "/finance/receivables", pageKey: "kasir-order", sourceModule: "PIUTANG" },
  { match: "/finance/invoices", pageKey: "kasir-order", sourceModule: "INVOICE" },
  { match: "/finance/payments", pageKey: "uang-masuk", sourceModule: "PAYMENT" },
  { match: "/finance/wallets", pageKey: "kas-dompet", sourceModule: "WALLET" },
  { match: "/finance/hutang-nana", pageKey: "hutang-nana", sourceModule: "HUTANG_NANA" },
  { match: "/finance/empat-amplop", pageKey: "empat-amplop", sourceModule: "EMPAT_AMPLOP" },
  { match: "/hrd/payroll", pageKey: "hrd-payroll", sourceModule: "PAYROLL" },
  { match: "/closing", pageKey: "closing-owner", sourceModule: "CLOSING" },
  { match: "/archive/search", pageKey: "arsip-digital", sourceModule: "ARSIP" },
];

const MODULE_TO_PAGE = {
  KAS_KELUAR: "kas-keluar",
  CASH_EXPENSE: "kas-keluar",
  KASOUT: "kas-keluar",
  KEWAJIBAN_OWNER: "kewajiban-owner",
  OWNER_OBLIGATION: "kewajiban-owner",
  HUTANG_PAYMENT: "kewajiban-owner",
  PAYABLE_PAYMENT: "kewajiban-owner",
  SETORAN_CABANG: "setoran-cabang",
  BRANCH_DEPOSIT: "setoran-cabang",
  DELIVERY_ORDER: "request-do",
  DO: "request-do",
  DISTRIBUTION: "request-do",
  PRODUCTION: "produksi-adukan",
  ADUKAN: "produksi-adukan",
  PIUTANG: "kasir-order",
  RECEIVABLE: "kasir-order",
  INVOICE: "kasir-order",
  ORDER: "kasir-order",
  PAYMENT: "uang-masuk",
  WALLET: "kas-dompet",
  WALLET_MUTATION: "kas-dompet",
  HUTANG_NANA: "hutang-nana",
  EMPAT_AMPLOP: "empat-amplop",
  PAYROLL: "hrd-payroll",
  CLOSING: "closing-owner",
  ARSIP: "arsip-digital",
};

export function getPageLabel(pageKey) {
  return PAGE_LABELS[pageKey] || pageKey || "Halaman";
}

export function inferPageFromSourceModule(sourceModule) {
  const key = String(sourceModule || "").trim().toUpperCase();
  return MODULE_TO_PAGE[key] || "arsip-digital";
}

export function parseFocusRoute(input) {
  if (!input && typeof window === "undefined") return null;

  const fallbackOrigin = typeof window !== "undefined" ? window.location.origin : "https://local.erp";
  const fallbackPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const raw = input || (typeof window !== "undefined" ? window.location.href : "");

  let url;
  try {
    url = new URL(raw, fallbackOrigin);
  } catch (err) {
    return null;
  }

  const params = url.searchParams;
  const path = url.pathname || fallbackPath || "/";

  let pageKey = params.get("page") || params.get("p") || params.get("module") || "";
  let focusId = params.get("focus") || params.get("focusId") || params.get("id") || params.get("source_id") || "";
  let searchQuery = params.get("q") || params.get("search") || "";
  let sourceModule = params.get("sourceModule") || params.get("source_module") || "";

  if (!pageKey && sourceModule) {
    pageKey = inferPageFromSourceModule(sourceModule);
  }

  if (!pageKey) {
    const matched = ROUTE_TO_PAGE.find((item) => path.indexOf(item.match) !== -1);
    if (matched) {
      pageKey = matched.pageKey;
      if (!sourceModule) sourceModule = matched.sourceModule;
    }
  }

  if (!focusId && searchQuery) {
    focusId = searchQuery;
  }

  if (!pageKey && !focusId && !searchQuery) return null;

  if (!pageKey) pageKey = "arsip-digital";

  return {
    pageKey,
    pageLabel: getPageLabel(pageKey),
    focusId: String(focusId || "").trim(),
    searchQuery: String(searchQuery || focusId || "").trim(),
    sourceModule: String(sourceModule || "").trim().toUpperCase(),
    sourceRoute: raw,
    sourcePath: path,
    createdAt: Date.now(),
  };
}

export function buildFocusUrl(focusRequest) {
  const focus = focusRequest || {};
  const pageKey = focus.pageKey || inferPageFromSourceModule(focus.sourceModule);
  const params = new URLSearchParams();

  if (pageKey) params.set("page", pageKey);

  if (focus.focusId) {
    params.set("focus", focus.focusId);
  }

  if (focus.searchQuery && pageKey === "arsip-digital") {
    params.set("q", focus.searchQuery);
  }

  if (focus.sourceModule) {
    params.set("sourceModule", focus.sourceModule);
  }

  const basePath = typeof window !== "undefined" ? window.location.pathname : "/";
  return `${basePath}?${params.toString()}`;
}

export function openFocusRoute(routeOrRequest, options = {}) {
  let focusRequest = null;

  if (typeof routeOrRequest === "string") {
    focusRequest = parseFocusRoute(routeOrRequest);
  } else if (routeOrRequest && typeof routeOrRequest === "object") {
    focusRequest = {
      ...routeOrRequest,
      pageKey: routeOrRequest.pageKey || inferPageFromSourceModule(routeOrRequest.sourceModule),
      createdAt: Date.now(),
    };
    focusRequest.pageLabel = getPageLabel(focusRequest.pageKey);
  }

  if (!focusRequest?.pageKey) {
    if (typeof routeOrRequest === "string" && routeOrRequest) {
      window.location.href = routeOrRequest;
    }
    return null;
  }

  if (typeof window !== "undefined") {
    const nextUrl = buildFocusUrl(focusRequest);
    if (options.replace) {
      window.history.replaceState({ focusRequest }, "", nextUrl);
    } else {
      window.history.pushState({ focusRequest }, "", nextUrl);
    }

    window.dispatchEvent(
      new CustomEvent(FOCUS_EVENT_NAME, {
        detail: focusRequest,
      })
    );
  }

  return focusRequest;
}

export function clearFocusUrl() {
  if (typeof window === "undefined") return;
  window.history.pushState({}, "", window.location.pathname);
}

export function readFocusFromLocation() {
  return parseFocusRoute();
}
