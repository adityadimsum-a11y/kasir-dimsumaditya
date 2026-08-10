import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Building2,
  ChevronRight,
  DollarSign,
  Edit2,
  MapPin,
  Package,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import {
  createMasterDataCoreRecord,
  getMasterDataCoreBootstrap,
  setMasterDataCoreStatus,
  updateMasterDataCoreRecord,
} from "../../lib/api/actions";

import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";

import ProductPricingPanel from "./ProductPricingPanel";
import PricingCutoverPanel from "./PricingCutoverPanel";
import TangerangGoLiveCutoverPanel from "./TangerangGoLiveCutoverPanel";
import BranchCommercePanel from "./BranchCommercePanel";

const PROTECTED_IDS = {
  produk: ["PRD-DIMSUM"],
  customer: [],
  supplier: ["SUP-001"],
  lokasi: ["LOC-TGR-001"],
};

const MODULE_CONFIG = {
  produk: {
    title: "Master Produk",
    singular: "Produk",
    eyebrow: "Master Data · Produk",
    description:
      "Kelola identitas produk, aturan produksi, harga jual, dan kesiapan produk untuk transaksi.",
    icon: Package,
    heroLabel: "Produk Aktif",
    tableTitle: "Daftar Produk",
    tableDescription: "Produk yang dipakai oleh produksi, stok, PO, kasir, harga, dan laporan.",
    idKey: "product_id",
    defaultDraft: {
      product_code: "",
      product_name: "",
      category: "Barang Jadi",
      unit: "pcs",
      adukan_conversion_active: "0",
      chicken_kg_per_adukan: "30",
      default_yield_pcs: "1000",
      chicken_bag_kg: "10",
      notes: "",
    },
    fields: [
      { key: "product_code", label: "Kode Produk", placeholder: "DIMSUM", lockedOnEdit: true },
      { key: "product_name", label: "Nama Produk", placeholder: "Dimsum Ayam Mix", required: true },
      { key: "category", label: "Kategori", placeholder: "Barang Jadi" },
      {
        key: "unit",
        label: "Satuan Transaksi",
        type: "unit-type",
        required: true,
        placeholder: "pcs / pack / box / kg",
      },
      {
        key: "adukan_conversion_active",
        label: "Diproduksi lewat Adukan",
        type: "select",
        options: [
          { value: "0", label: "Tidak" },
          { value: "1", label: "Ya" },
        ],
      },
      {
        key: "chicken_kg_per_adukan",
        label: "Ayam per Adukan (kg)",
        type: "number",
        productionOnly: true,
        placeholder: "30",
      },
      {
        key: "default_yield_pcs",
        label: "Target Hasil / Adukan (pcs)",
        type: "number",
        productionOnly: true,
        placeholder: "1000",
      },
      {
        key: "chicken_bag_kg",
        label: "Berat per Kantong Ayam (kg)",
        type: "number",
        productionOnly: true,
        placeholder: "10",
      },
      { key: "notes", label: "Catatan", placeholder: "Catatan produk", wide: true },
    ],
    tabs: [
      ["data", "Produk"],
      ["pricing", "Harga & Rule"],
      ["activation", "Opening & Aktivasi"],
      ["readiness", "Kesiapan Penjualan"],
    ],
  },
  customer: {
    title: "Master Customer",
    singular: "Customer",
    eyebrow: "Master Data · Customer",
    description:
      "Satu identitas pelanggan untuk order, harga khusus, piutang, pembayaran, dan riwayat pembelian.",
    icon: Users,
    heroLabel: "Customer Aktif",
    tableTitle: "Daftar Customer",
    tableDescription: "Klik customer untuk melihat posisi order, piutang, lokasi, dan status penggunaan.",
    idKey: "customer_id",
    defaultDraft: {
      customer_name: "",
      phone: "",
      area: "",
      location_id: "",
      price_type: "NORMAL",
      notes: "",
    },
    fields: [
      { key: "customer_name", label: "Nama Customer", placeholder: "Nama pelanggan", required: true },
      { key: "phone", label: "No HP / WhatsApp", placeholder: "08xxx" },
      { key: "area", label: "Area", placeholder: "Tangerang / Bogor" },
      { key: "location_id", label: "Lokasi Utama", type: "location-select" },
      {
        key: "price_type",
        label: "Tipe Harga",
        type: "select",
        options: [
          { value: "NORMAL", label: "Normal" },
          { value: "RESELLER", label: "Reseller" },
          { value: "KHUSUS", label: "Khusus" },
        ],
      },
      { key: "notes", label: "Catatan", placeholder: "Catatan customer", wide: true },
    ],
    tabs: [["data", "Customer"]],
  },
  supplier: {
    title: "Master Supplier",
    singular: "Supplier",
    eyebrow: "Master Data · Supplier",
    description:
      "Kelola supplier pembelian agar nota, hutang, lot bahan, pembayaran, dan arsip tetap satu rantai.",
    icon: Truck,
    heroLabel: "Supplier Aktif",
    tableTitle: "Daftar Supplier",
    tableDescription: "Klik supplier untuk melihat hutang terbuka, pembelian, lot aktif, dan status.",
    idKey: "supplier_id",
    defaultDraft: {
      supplier_name: "",
      supplier_type: "Bahan Baku",
      phone: "",
      default_wallet: "",
      notes: "",
    },
    fields: [
      { key: "supplier_name", label: "Nama Supplier", placeholder: "Nama supplier", required: true },
      { key: "supplier_type", label: "Jenis Supplier", placeholder: "Bahan Baku / Packaging / Logistik / Jasa" },
      { key: "phone", label: "Kontak", placeholder: "08xxx" },
      { key: "default_wallet", label: "Jalur Bayar Biasa", placeholder: "BCA / BRI / Cash" },
      { key: "notes", label: "Catatan", placeholder: "Catatan supplier", wide: true },
    ],
    tabs: [["data", "Supplier"]],
  },
  lokasi: {
    title: "Master Lokasi",
    singular: "Lokasi",
    eyebrow: "Master Data · Lokasi",
    description:
      "Kelola HO, produksi, outlet, gudang, akun kerja, dompet, harga, dan kesiapan operasional per lokasi.",
    icon: Building2,
    heroLabel: "Lokasi Aktif",
    tableTitle: "Daftar Lokasi",
    tableDescription: "Setiap lokasi menjadi ruang kerja dan titik stok tersendiri di ERP.",
    idKey: "location_id",
    defaultDraft: {
      location_code: "",
      location_name: "",
      location_type: "BRANCH",
      parent_location: "LOC-TGR-001",
      notes: "",
    },
    fields: [
      { key: "location_code", label: "Kode Lokasi", placeholder: "PML", required: true, lockedOnEdit: true },
      { key: "location_name", label: "Nama Lokasi", placeholder: "Produksi Pemalang", required: true },
      {
        key: "location_type",
        label: "Tipe Lokasi",
        type: "location-type",
        placeholder: "HQ / PRODUCTION / OUTLET / WAREHOUSE / tipe lain",
      },
      { key: "parent_location", label: "Lokasi Induk", type: "parent-location-select" },
      { key: "notes", label: "Catatan", placeholder: "Catatan lokasi", wide: true },
    ],
    tabs: [
      ["data", "Lokasi"],
      ["commerce", "Kesiapan Cabang"],
    ],
  },
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanValue(value) {
  return String(value ?? "").trim();
}

function safeText(value, fallback = "-") {
  const text = cleanValue(value);
  return text || fallback;
}

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function formatQty(value, unit = "pcs") {
  return `${numberValue(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  })} ${unit}`;
}

function makeOperationId(moduleType, action) {
  return [
    "OP-MASTER",
    String(moduleType || "MASTER").toUpperCase(),
    action,
    Date.now(),
    Math.random().toString(16).slice(2),
  ].join("-");
}

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") &&
      (message.includes("TIDAK AKTIF") || message.includes("KADALUWARSA")))
  );
}

function isActiveValue(value) {
  return ![
    "FALSE",
    "NO",
    "0",
    "NONAKTIF",
    "INACTIVE",
    "DELETED",
    "DISABLED",
    "VOID",
  ].includes(String(value ?? "TRUE").trim().toUpperCase());
}

function normalizeRow(row, moduleType) {
  const active = isActiveValue(row?.active ?? row?.is_active ?? row?.status ?? "TRUE");

  if (moduleType === "produk") {
    const id = cleanValue(row.product_id || row.id || row.product_code);
    return {
      ...row,
      id,
      master_id: id,
      product_id: id,
      product_code: cleanValue(row.product_code),
      product_name: cleanValue(row.product_name),
      category: cleanValue(row.category),
      unit: cleanValue(row.unit),
      price_rule_count: numberValue(row.price_rule_count),
      stock_qty: numberValue(row.stock_qty),
      reserved_qty: numberValue(row.reserved_qty),
      production_count: numberValue(row.production_count),
      order_line_count: numberValue(row.order_line_count),
      active,
      notes: cleanValue(row.notes),
    };
  }

  if (moduleType === "customer") {
    const id = cleanValue(row.customer_id || row.id || row.customer_code);
    return {
      ...row,
      id,
      master_id: id,
      customer_id: id,
      customer_name: cleanValue(row.customer_name),
      phone: cleanValue(row.phone),
      area: cleanValue(row.area),
      location_id: cleanValue(row.location_id),
      location_name: cleanValue(row.location_name),
      location_code: cleanValue(row.location_code),
      price_type: cleanValue(row.price_type || "NORMAL").toUpperCase(),
      order_count: numberValue(row.order_count),
      purchase_value: numberValue(row.purchase_value),
      open_receivable_amount: numberValue(row.open_receivable_amount),
      active_po_count: numberValue(row.active_po_count),
      active,
      notes: cleanValue(row.notes),
    };
  }

  if (moduleType === "supplier") {
    const id = cleanValue(row.supplier_id || row.id || row.supplier_code);
    return {
      ...row,
      id,
      master_id: id,
      supplier_id: id,
      supplier_code: cleanValue(row.supplier_code),
      supplier_name: cleanValue(row.supplier_name),
      supplier_type: cleanValue(row.supplier_type),
      phone: cleanValue(row.phone),
      default_wallet: cleanValue(row.default_wallet),
      purchase_count: numberValue(row.purchase_count),
      open_payable_amount: numberValue(row.open_payable_amount),
      active_chicken_kg: numberValue(row.active_chicken_kg),
      active,
      notes: cleanValue(row.notes),
    };
  }

  const id = cleanValue(row.location_id || row.id || row.location_code);
  return {
    ...row,
    id,
    master_id: id,
    location_id: id,
    location_code: cleanValue(row.location_code),
    location_name: cleanValue(row.location_name),
    location_type: cleanValue(row.location_type),
    parent_location: cleanValue(row.parent_location),
    parent_location_name: cleanValue(row.parent_location_name),
    active_user_count: numberValue(row.active_user_count),
    wallet_count: numberValue(row.wallet_count),
    stock_qty: numberValue(row.stock_qty),
    priced_product_count: numberValue(row.priced_product_count),
    open_report_count: numberValue(row.open_report_count),
    pending_deposit_count: numberValue(row.pending_deposit_count),
    live_commerce_count: numberValue(row.live_commerce_count),
    active,
    notes: cleanValue(row.notes),
  };
}

function normalizePayload(payload, moduleType) {
  const data = payload?.data || payload || {};
  const rows = asArray(data.rows || data.items || data[moduleType] || []).map((row) =>
    normalizeRow(row, moduleType)
  );

  return {
    rows,
    source_of_truth: data.source_of_truth || "PHP_MYSQL",
    summary: {
      total_rows: numberValue(data.summary?.total_rows ?? rows.length),
      active_rows: numberValue(data.summary?.active_rows ?? rows.filter((row) => row.active).length),
      inactive_rows: numberValue(data.summary?.inactive_rows ?? rows.filter((row) => !row.active).length),
      missing_id_rows: numberValue(data.summary?.missing_id_rows ?? rows.filter((row) => !row.master_id).length),
    },
    business_summary: data.business_summary || {},
    reference_data: {
      locations: asArray(data.reference_data?.locations),
    },
    write_policy: {
      writes_enabled: Boolean(data.write_policy?.writes_enabled),
      legacy_seed_enabled: Boolean(data.write_policy?.legacy_seed_enabled),
      physical_delete_allowed: Boolean(data.write_policy?.physical_delete_allowed),
    },
  };
}

function rowToDraft(row, config) {
  const next = { ...config.defaultDraft };
  for (const field of config.fields) {
    if (row?.[field.key] !== undefined && row?.[field.key] !== null) {
      next[field.key] = String(row[field.key]);
    }
  }
  return next;
}

function moduleName(row, moduleType) {
  if (moduleType === "produk") return safeText(row?.product_name);
  if (moduleType === "customer") return safeText(row?.customer_name);
  if (moduleType === "supplier") return safeText(row?.supplier_name);
  return safeText(row?.location_name);
}

function dependencyBlockers(row, moduleType) {
  const blockers = [];
  if (moduleType === "produk") {
    if (numberValue(row.stock_qty) > 0) blockers.push("stok aktif");
    if (numberValue(row.reserved_qty) > 0) blockers.push("reservasi PO/order");
    if (numberValue(row.price_rule_count) > 0) blockers.push("aturan harga aktif");
    if (numberValue(row.open_order_count) > 0) blockers.push("order/PO belum selesai");
    if (numberValue(row.open_transfer_count) > 0) blockers.push("request barang belum selesai");
  } else if (moduleType === "customer") {
    if (numberValue(row.open_receivable_amount) > 0) blockers.push("piutang terbuka");
    if (numberValue(row.active_po_count) > 0) blockers.push("PO aktif");
    if (numberValue(row.open_order_count) > 0) blockers.push("order belum selesai");
  } else if (moduleType === "supplier") {
    if (numberValue(row.open_payable_amount) > 0) blockers.push("hutang terbuka");
    if (numberValue(row.active_chicken_kg) > 0) blockers.push("lot ayam aktif");
  } else {
    if (numberValue(row.active_user_count) > 0) blockers.push("akun aktif");
    if (numberValue(row.wallet_count) > 0) blockers.push("dompet aktif");
    if (numberValue(row.stock_qty) > 0) blockers.push("stok barang jadi");
    if (numberValue(row.raw_chicken_kg) > 0) blockers.push("stok ayam");
    if (numberValue(row.active_price_rule_count) > 0) blockers.push("aturan harga aktif");
    if (numberValue(row.active_child_count) > 0) blockers.push("lokasi turunan aktif");
    if (numberValue(row.live_commerce_count) > 0) blockers.push("kasir aktif");
    if (numberValue(row.open_transfer_count) > 0) blockers.push("request/DO belum selesai");
    if (numberValue(row.open_report_count) > 0) blockers.push("laporan cabang aktif");
    if (numberValue(row.pending_deposit_count) > 0) blockers.push("setoran pending");
  }
  return blockers;
}

function metricValue(moduleType, kind, value) {
  if (moduleType === "produk") {
    if (kind === "primary" || kind === "secondary") return formatQty(value, "pcs");
    return numberValue(value).toLocaleString("id-ID");
  }
  if (moduleType === "customer") {
    if (kind === "primary" || kind === "secondary") return formatRupiah(value);
    return numberValue(value).toLocaleString("id-ID");
  }
  if (moduleType === "supplier") {
    if (kind === "primary") return formatRupiah(value);
    if (kind === "secondary") return formatQty(value, "kg");
    return numberValue(value).toLocaleString("id-ID");
  }
  if (kind === "tertiary") return formatQty(value, "pcs");
  return numberValue(value).toLocaleString("id-ID");
}

function usageCards(row, moduleType) {
  if (moduleType === "produk") {
    return [
      ["Stok tersedia", formatQty(row.stock_qty, "pcs"), Boxes],
      ["Direservasi", formatQty(row.reserved_qty, "pcs"), ShoppingCart],
      ["Rule harga", `${numberValue(row.price_rule_count)} aktif`, DollarSign],
      ["Produksi", `${numberValue(row.production_count)} batch`, Package],
      ["Order aktif", `${numberValue(row.open_order_count)}`, ShoppingCart],
      ["Request barang", `${numberValue(row.open_transfer_count)}`, Truck],
    ];
  }
  if (moduleType === "customer") {
    return [
      ["Total order", `${numberValue(row.order_count)} transaksi`, ShoppingCart],
      ["Nilai order", formatRupiah(row.purchase_value), DollarSign],
      ["Piutang", formatRupiah(row.open_receivable_amount), Wallet],
      ["PO aktif", `${numberValue(row.active_po_count)}`, Package],
      ["Order belum selesai", `${numberValue(row.open_order_count)}`, ShoppingCart],
    ];
  }
  if (moduleType === "supplier") {
    return [
      ["Pembelian", `${numberValue(row.purchase_count)} transaksi`, ShoppingCart],
      ["Hutang terbuka", formatRupiah(row.open_payable_amount), Wallet],
      ["Lot ayam aktif", formatQty(row.active_chicken_kg, "kg"), Boxes],
      ["Pembelian terakhir", safeText(row.last_purchase_date), Truck],
    ];
  }
  return [
    ["Akun aktif", `${numberValue(row.active_user_count)}`, Users],
    ["Dompet", `${numberValue(row.wallet_count)}`, Wallet],
    ["Stok jadi", formatQty(row.stock_qty, "pcs"), Boxes],
    ["Stok ayam", formatQty(row.raw_chicken_kg, "kg"), Boxes],
    ["Produk berharga", `${numberValue(row.priced_product_count)}`, DollarSign],
    ["Kasir aktif", `${numberValue(row.live_commerce_count)}`, ShoppingCart],
    ["Lokasi turunan", `${numberValue(row.active_child_count)}`, Building2],
    ["Request/DO aktif", `${numberValue(row.open_transfer_count)}`, Truck],
  ];
}

export default function MasterDataPage({ moduleType = "produk", session, onSessionExpired }) {
  const config = MODULE_CONFIG[moduleType] || MODULE_CONFIG.produk;
  const ModuleIcon = config.icon;
  const sessionToken = session?.sessionToken || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState("data");
  const [bootstrap, setBootstrap] = useState(() => normalizePayload({}, moduleType));
  const [draft, setDraft] = useState(() => ({ ...config.defaultDraft }));
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [pricingRefreshKey, setPricingRefreshKey] = useState(0);

  const writeEnabled = bootstrap.write_policy.writes_enabled === true;
  const references = bootstrap.reference_data || { locations: [] };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bootstrap.rows.filter((row) => {
      if (statusFilter === "ACTIVE" && !row.active) return false;
      if (statusFilter === "INACTIVE" && row.active) return false;
      if (!term) return true;
      return JSON.stringify(row).toLowerCase().includes(term);
    });
  }, [bootstrap.rows, search, statusFilter]);

  const columns = useMemo(() => {
    if (moduleType === "produk") {
      return [
        {
          key: "product_name",
          label: "Produk",
          render: (row) => (
            <div className="da-master-table-primary">
              <strong>{safeText(row.product_name)}</strong>
              <span>{safeText(row.product_code)} · {safeText(row.category)}</span>
            </div>
          ),
        },
        { key: "stock_qty", label: "Stok", render: (row) => formatQty(row.stock_qty, "pcs") },
        { key: "reserved_qty", label: "Reservasi", render: (row) => formatQty(row.reserved_qty, "pcs") },
        { key: "price_rule_count", label: "Harga", render: (row) => `${numberValue(row.price_rule_count)} rule` },
        { key: "unit", label: "Satuan", render: (row) => safeText(row.unit) },
        {
          key: "status",
          label: "Status",
          render: (row) => <Badge tone={row.active ? "success" : "warning"}>{row.active ? "Aktif" : "Nonaktif"}</Badge>,
        },
      ];
    }

    if (moduleType === "customer") {
      return [
        {
          key: "customer_name",
          label: "Customer",
          render: (row) => (
            <div className="da-master-table-primary">
              <strong>{safeText(row.customer_name)}</strong>
              <span>{safeText(row.phone, "Tanpa nomor")} · {safeText(row.area, "Area belum diisi")}</span>
            </div>
          ),
        },
        { key: "location_name", label: "Lokasi", render: (row) => safeText(row.location_name, "Semua lokasi") },
        { key: "order_count", label: "Order", render: (row) => numberValue(row.order_count).toLocaleString("id-ID") },
        { key: "last_order_date", label: "Order Terakhir", render: (row) => safeText(row.last_order_date, "Belum pernah") },
        { key: "open_receivable_amount", label: "Piutang", render: (row) => formatRupiah(row.open_receivable_amount) },
        { key: "price_type", label: "Harga", render: (row) => safeText(row.price_type, "NORMAL") },
        {
          key: "status",
          label: "Status",
          render: (row) => <Badge tone={row.active ? "success" : "warning"}>{row.active ? "Aktif" : "Nonaktif"}</Badge>,
        },
      ];
    }

    if (moduleType === "supplier") {
      return [
        {
          key: "supplier_name",
          label: "Supplier",
          render: (row) => (
            <div className="da-master-table-primary">
              <strong>{safeText(row.supplier_name)}</strong>
              <span>{safeText(row.supplier_code)} · {safeText(row.supplier_type)}</span>
            </div>
          ),
        },
        { key: "purchase_count", label: "Pembelian", render: (row) => numberValue(row.purchase_count).toLocaleString("id-ID") },
        { key: "open_payable_amount", label: "Hutang", render: (row) => formatRupiah(row.open_payable_amount) },
        { key: "active_chicken_kg", label: "Lot Aktif", render: (row) => formatQty(row.active_chicken_kg, "kg") },
        { key: "phone", label: "Kontak", render: (row) => safeText(row.phone) },
        {
          key: "status",
          label: "Status",
          render: (row) => <Badge tone={row.active ? "success" : "warning"}>{row.active ? "Aktif" : "Nonaktif"}</Badge>,
        },
      ];
    }

    return [
      {
        key: "location_name",
        label: "Lokasi",
        render: (row) => (
          <div className="da-master-table-primary">
            <strong>{safeText(row.location_name)}</strong>
            <span>{safeText(row.location_code)} · {safeText(row.location_type)}</span>
          </div>
        ),
      },
      { key: "active_user_count", label: "Akun", render: (row) => numberValue(row.active_user_count).toLocaleString("id-ID") },
      { key: "wallet_count", label: "Dompet", render: (row) => numberValue(row.wallet_count).toLocaleString("id-ID") },
      { key: "stock_qty", label: "Stok", render: (row) => formatQty(row.stock_qty, "pcs") },
      { key: "priced_product_count", label: "Produk Berharga", render: (row) => numberValue(row.priced_product_count).toLocaleString("id-ID") },
      {
        key: "status",
        label: "Status",
        render: (row) => <Badge tone={row.active ? "success" : "warning"}>{row.active ? "Aktif" : "Nonaktif"}</Badge>,
      },
    ];
  }, [moduleType]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const result = await getMasterDataCoreBootstrap(sessionToken, { module_type: moduleType });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Master data belum bisa dibaca.");
        return;
      }
      setBootstrap(normalizePayload(result, moduleType));
    } catch (err) {
      setError(err?.message || "Gagal membaca master data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setDraft({ ...config.defaultDraft });
    setEditingId("");
    setFormOpen(false);
    setSearch("");
    setStatusFilter("ALL");
    setActiveTab("data");
    setSelected(null);
    setStatusTarget(null);
    setSuccess("");
    setError("");
    // Jangan membawa angka/row modul sebelumnya ketika user berpindah tab master.
    // Jika request baru gagal, layar harus tetap kosong dan jujur, bukan menampilkan
    // data Produk sebagai Customer/Supplier/Lokasi.
    setBootstrap(normalizePayload({}, moduleType));
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleType]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setDraft({ ...config.defaultDraft });
    setEditingId("");
    setSelected(null);
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function startEdit(row) {
    if (!row?.master_id) return;
    setEditingId(row.master_id);
    setDraft(rowToDraft(row, config));
    setSelected(null);
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingId("");
    setDraft({ ...config.defaultDraft });
  }

  function isProtected(row) {
    const id = String(row?.master_id || row?.id || "");
    return (PROTECTED_IDS[moduleType] || []).includes(id);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!writeEnabled) {
      setError("Penyimpanan master belum tersedia. Perbarui data dan periksa kesiapan sistem.");
      return;
    }

    const visibleFields = config.fields.filter((field) => {
      if (field.productionOnly && String(draft.adukan_conversion_active) !== "1") return false;
      return true;
    });
    const requiredField = visibleFields.find(
      (field) => field.required && !String(draft[field.key] || "").trim()
    );
    if (requiredField) {
      setError(`${requiredField.label} wajib diisi.`);
      return;
    }

    const operationId = makeOperationId(moduleType, editingId ? "UPDATE" : "CREATE");
    const payload = {
      module_type: moduleType,
      ...draft,
      operation_id: operationId,
      request_id: operationId,
      idempotency_key: operationId,
    };
    if (editingId) {
      payload.master_id = editingId;
      payload[config.idKey] = editingId;
    }

    setSaving(true);
    try {
      const result = editingId
        ? await updateMasterDataCoreRecord(sessionToken, payload)
        : await createMasterDataCoreRecord(sessionToken, payload);

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Master data belum bisa disimpan.");
        return;
      }

      setSuccess(result?.message || `${config.singular} berhasil disimpan.`);
      setFormOpen(false);
      setEditingId("");
      setDraft({ ...config.defaultDraft });
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan master data.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmStatusChange() {
    const row = statusTarget;
    if (!row?.master_id || statusSaving) return;
    const nextActive = !row.active;

    setStatusSaving(true);
    setError("");
    setSuccess("");
    try {
      const operationId = makeOperationId(moduleType, nextActive ? "ACTIVATE" : "DEACTIVATE");
      const result = await setMasterDataCoreStatus(sessionToken, {
        module_type: moduleType,
        master_id: row.master_id,
        [config.idKey]: row.master_id,
        active: nextActive,
        reason: nextActive
          ? "Diaktifkan kembali dari Master Data"
          : "Dinonaktifkan dari Master Data",
        operation_id: operationId,
        request_id: operationId,
        idempotency_key: operationId,
      });

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        const blockers = asArray(result?.error?.details?.blockers || result?.details?.blockers);
        setError(
          blockers.length
            ? `${result?.message || "Master belum bisa dinonaktifkan."} ${blockers.join(" ")}`
            : result?.message || "Status master belum bisa diubah."
        );
        return;
      }

      setSuccess(result?.message || "Status master berhasil diubah.");
      setSelected(null);
      setStatusTarget(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal mengubah status master.");
    } finally {
      setStatusSaving(false);
    }
  }

  const business = bootstrap.business_summary || {};
  const blockersForSelected = selected ? dependencyBlockers(selected, moduleType) : [];
  const protectedSelected = selected ? isProtected(selected) : false;

  function renderField(field) {
    if (field.productionOnly && String(draft.adukan_conversion_active) !== "1") return null;
    const locked = Boolean(editingId && field.lockedOnEdit);
    let control = null;

    if (field.type === "select") {
      control = (
        <select
          value={String(draft[field.key] ?? "")}
          disabled={saving || locked || !writeEnabled}
          onChange={(event) => updateDraft(field.key, event.target.value)}
        >
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    } else if (field.type === "unit-type" || field.type === "location-type") {
      const listId = field.type === "unit-type" ? "master-unit-options" : "master-location-type-options";
      const values = field.type === "unit-type"
        ? ["pcs", "pack", "box", "porsi", "kg", "gram", "liter", "unit"]
        : ["HQ", "PRODUCTION", "OUTLET", "WAREHOUSE", "BRANCH", "RUKO", "KITCHEN"];
      control = (
        <>
          <input
            list={listId}
            value={draft[field.key] ?? ""}
            placeholder={field.placeholder || ""}
            disabled={saving || locked || !writeEnabled}
            onChange={(event) => updateDraft(field.key, event.target.value)}
          />
          <datalist id={listId}>
            {values.map((value) => <option key={value} value={value} />)}
          </datalist>
        </>
      );
    } else if (field.type === "location-select" || field.type === "parent-location-select") {
      const options = asArray(references.locations).filter((location) => {
        if (field.type !== "parent-location-select") return true;
        return !editingId || cleanValue(location.location_id) !== editingId;
      });
      control = (
        <select
          value={String(draft[field.key] ?? "")}
          disabled={saving || locked || !writeEnabled}
          onChange={(event) => updateDraft(field.key, event.target.value)}
        >
          <option value="">{field.type === "location-select" ? "Semua lokasi / belum ditentukan" : "Tanpa induk"}</option>
          {options.map((location) => (
            <option key={location.location_id} value={location.location_id}>
              {location.location_name} · {location.location_code}
            </option>
          ))}
        </select>
      );
    } else {
      control = (
        <input
          type={field.type || "text"}
          value={draft[field.key] ?? ""}
          placeholder={field.placeholder || ""}
          disabled={saving || locked || !writeEnabled}
          onChange={(event) => updateDraft(field.key, event.target.value)}
        />
      );
    }

    return (
      <label key={field.key} className={`da-field ${field.wide ? "da-field-wide" : ""}`}>
        {field.label}{field.required ? " *" : ""}
        {control}
        {locked ? <small className="da-muted">Dikunci agar referensi transaksi lama tidak berubah.</small> : null}
      </label>
    );
  }

  return (
    <div className={`da-master-control-center da-master-${moduleType}`}>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={(
          <>
            <Button variant="ghost" onClick={loadData} disabled={loading}>
              <RefreshCw size={16} /> {loading ? "Memuat" : "Perbarui"}
            </Button>
            <Button onClick={openCreate} disabled={!writeEnabled}>
              <Plus size={16} /> Tambah {config.singular}
            </Button>
          </>
        )}
      />

      {error ? <div className="da-form-warning da-master-message">{error}</div> : null}
      {success ? <div className="da-form-success da-master-message">{success}</div> : null}

      <section className="da-registry-overview">
        <div className="da-registry-overview-main">
          <div className="da-registry-overview-icon"><ModuleIcon size={22} /></div>
          <div className="da-registry-overview-copy">
            <span>{config.heroLabel}</span>
            <strong>{bootstrap.summary.active_rows.toLocaleString("id-ID")}</strong>
            <small>{bootstrap.summary.total_rows.toLocaleString("id-ID")} total master · {bootstrap.summary.inactive_rows.toLocaleString("id-ID")} nonaktif</small>
          </div>
          <Badge tone={writeEnabled ? "success" : "warning"}>{writeEnabled ? "Siap digunakan" : "Pantau"}</Badge>
        </div>

        <div className="da-registry-overview-metrics">
          <div>
            <span>{safeText(business.primary_label, "Penggunaan")}</span>
            <strong>{metricValue(moduleType, "primary", business.primary_value)}</strong>
          </div>
          <div>
            <span>{safeText(business.secondary_label, "Posisi aktif")}</span>
            <strong>{metricValue(moduleType, "secondary", business.secondary_value)}</strong>
          </div>
          <div>
            <span>{safeText(business.tertiary_label, "Terkait")}</span>
            <strong>{metricValue(moduleType, "tertiary", business.tertiary_value)}</strong>
          </div>
        </div>
      </section>

      {config.tabs.length > 1 ? (
        <div className="da-master-tabs" role="tablist">
          {config.tabs.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={activeTab === key ? "is-active" : ""}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "data" ? (
        <div className="da-master-workspace">
          <Card className="da-master-list-card">
            <div className="da-section-heading da-master-list-heading">
              <div>
                <span>Data Utama</span>
                <h2>{config.tableTitle}</h2>
                <p>{config.tableDescription}</p>
              </div>
              <Badge tone="success">{filteredRows.length} data</Badge>
            </div>

            <div className="da-master-toolbar">
              <label className="da-master-search">
                <Search size={17} />
                <input
                  value={search}
                  placeholder={`Cari ${config.singular.toLowerCase()}...`}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div className="da-master-status-filter">
                {[
                  ["ALL", "Semua"],
                  ["ACTIVE", "Aktif"],
                  ["INACTIVE", "Nonaktif"],
                ].map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    className={statusFilter === key ? "is-active" : ""}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <DataTable
              columns={columns}
              rows={filteredRows}
              getRowKey={(row, index) => row.id || `${moduleType}-${index}`}
              onRowClick={setSelected}
            />

            {!loading && filteredRows.length === 0 ? (
              <div className="da-master-empty">
                <ModuleIcon size={25} />
                <strong>Belum ada data yang cocok</strong>
                <span>{search ? "Ubah kata pencarian atau filter status." : `Tambahkan ${config.singular.toLowerCase()} pertama saat sudah dibutuhkan operasional.`}</span>
              </div>
            ) : null}
          </Card>

          <aside className="da-master-side">
            <Card>
              <div className="da-section-heading">
                <div>
                  <span>Kualitas Data</span>
                  <h2>Kontrol Master</h2>
                </div>
                <ShieldCheck size={20} />
              </div>
              <div className="da-master-quality-list">
                <div>
                  <span>ID master lengkap</span>
                  <strong>{bootstrap.summary.missing_id_rows === 0 ? "Aman" : `${bootstrap.summary.missing_id_rows} perlu cek`}</strong>
                </div>
                <div>
                  <span>Penyimpanan</span>
                  <strong>{writeEnabled ? "Aktif" : "Terkunci"}</strong>
                </div>
                <div>
                  <span>Hapus permanen</span>
                  <strong>Tidak digunakan</strong>
                </div>
                <div>
                  <span>Master inti dilindungi</span>
                  <strong>{(PROTECTED_IDS[moduleType] || []).length}</strong>
                </div>
              </div>
            </Card>

            <Card>
              <div className="da-section-heading">
                <div>
                  <span>Aturan Operasional</span>
                  <h2>Sebelum Nonaktif</h2>
                </div>
                <AlertTriangle size={20} />
              </div>
              <p className="da-muted">
                Master yang masih membawa saldo, stok, order/PO, piutang, hutang, aturan harga, akun, dompet, atau proses antar-lokasi aktif akan ditahan oleh backend sampai ketergantungannya selesai.
              </p>
              <div className="da-master-rule-note">
                Riwayat lama tidak dihapus. Perubahan master hanya memengaruhi transaksi berikutnya.
              </div>
            </Card>
          </aside>
        </div>
      ) : null}

      {moduleType === "produk" && activeTab === "pricing" ? (
        <ProductPricingPanel
          key={`product-pricing-${pricingRefreshKey}`}
          sessionToken={sessionToken}
          products={bootstrap.rows}
          masterWriteEnabled={writeEnabled}
          onSessionExpired={onSessionExpired}
          onPricingChanged={loadData}
        />
      ) : null}

      {moduleType === "produk" && activeTab === "activation" ? (
        <TangerangGoLiveCutoverPanel
          sessionToken={sessionToken}
          onSessionExpired={onSessionExpired}
          onCutoverChanged={async () => {
            await loadData();
            setPricingRefreshKey((value) => value + 1);
          }}
        />
      ) : null}

      {moduleType === "produk" && activeTab === "readiness" ? (
        <PricingCutoverPanel
          key={`pricing-readiness-${pricingRefreshKey}`}
          sessionToken={sessionToken}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {moduleType === "lokasi" && activeTab === "commerce" ? (
        <BranchCommercePanel sessionToken={sessionToken} onSessionExpired={onSessionExpired} />
      ) : null}

      <Modal
        open={formOpen}
        title={`${editingId ? "Edit" : "Tambah"} ${config.singular}`}
        subtitle={editingId ? `ID ${editingId} · ID inti tidak berubah` : "Master baru untuk transaksi berikutnya"}
        onClose={closeForm}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="da-master-form-modal">
          <div className="da-master-form-intro">
            <div className="da-master-form-icon"><ModuleIcon size={20} /></div>
            <div>
              <strong>{editingId ? `Perbarui ${moduleName(draft, moduleType)}` : `Data ${config.singular} baru`}</strong>
              <span>
                {moduleType === "produk"
                  ? "Standar produksi baru hanya berlaku untuk batch berikutnya; HPP historis tetap terkunci."
                  : "Gunakan identitas yang benar agar transaksi, arsip, dan laporan tidak terpecah."}
              </span>
            </div>
          </div>

          <div className="da-form-grid da-master-form-grid">
            {config.fields.map(renderField)}
          </div>

          <div className="da-modal-sticky-actions da-master-modal-actions">
            <Button type="button" variant="ghost" onClick={closeForm} disabled={saving}>Batal</Button>
            <Button type="submit" disabled={saving || !writeEnabled}>
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : `Simpan ${config.singular}`}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selected)}
        title={selected ? moduleName(selected, moduleType) : `Detail ${config.singular}`}
        subtitle={selected ? safeText(selected.master_id || selected.id) : ""}
        onClose={() => setSelected(null)}
        size="lg"
      >
        {selected ? (
          <div className="da-master-detail">
            <div className="da-master-detail-head">
              <div>
                <span>{config.singular}</span>
                <h2>{moduleName(selected, moduleType)}</h2>
                <p>{safeText(selected.notes, "Tidak ada catatan tambahan.")}</p>
              </div>
              <div className="da-master-detail-status">
                {protectedSelected ? <Badge tone="warning">Master Inti</Badge> : null}
                <Badge tone={selected.active ? "success" : "warning"}>{selected.active ? "Aktif" : "Nonaktif"}</Badge>
              </div>
            </div>

            <div className="da-master-usage-grid">
              {usageCards(selected, moduleType).map(([label, value, Icon]) => (
                <div key={label}>
                  <Icon size={17} />
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            <div className="da-master-detail-grid">
              {moduleType === "produk" ? (
                <>
                  <div><span>Kode</span><strong>{safeText(selected.product_code)}</strong></div>
                  <div><span>Kategori</span><strong>{safeText(selected.category)}</strong></div>
                  <div><span>Satuan</span><strong>{safeText(selected.unit)}</strong></div>
                  <div><span>Produksi Adukan</span><strong>{selected.uses_adukan ? "Ya" : "Tidak"}</strong></div>
                  <div><span>Ayam / Adukan</span><strong>{safeText(selected.chicken_kg_per_adukan_display)}</strong></div>
                  <div><span>Target / Adukan</span><strong>{safeText(selected.default_yield_pcs_display)}</strong></div>
                </>
              ) : null}
              {moduleType === "customer" ? (
                <>
                  <div><span>Kontak</span><strong>{safeText(selected.phone)}</strong></div>
                  <div><span>Area</span><strong>{safeText(selected.area)}</strong></div>
                  <div><span>Lokasi Utama</span><strong>{safeText(selected.location_name, "Semua lokasi")}</strong></div>
                  <div><span>Tipe Harga</span><strong>{safeText(selected.price_type)}</strong></div>
                  <div><span>Order Terakhir</span><strong>{safeText(selected.last_order_date)}</strong></div>
                </>
              ) : null}
              {moduleType === "supplier" ? (
                <>
                  <div><span>Kode</span><strong>{safeText(selected.supplier_code)}</strong></div>
                  <div><span>Jenis</span><strong>{safeText(selected.supplier_type)}</strong></div>
                  <div><span>Kontak</span><strong>{safeText(selected.phone)}</strong></div>
                  <div><span>Jalur Bayar</span><strong>{safeText(selected.default_wallet)}</strong></div>
                </>
              ) : null}
              {moduleType === "lokasi" ? (
                <>
                  <div><span>Kode</span><strong>{safeText(selected.location_code)}</strong></div>
                  <div><span>Tipe</span><strong>{safeText(selected.location_type)}</strong></div>
                  <div><span>Induk</span><strong>{safeText(selected.parent_location_name, "Pusat / mandiri")}</strong></div>
                  <div><span>Laporan Aktif</span><strong>{numberValue(selected.open_report_count)}</strong></div>
                  <div><span>Setoran Pending</span><strong>{numberValue(selected.pending_deposit_count)}</strong></div>
                </>
              ) : null}
            </div>

            {selected.active && (protectedSelected || blockersForSelected.length) ? (
              <div className="da-master-dependency-alert">
                <AlertTriangle size={18} />
                <div>
                  <strong>{protectedSelected ? "Master inti dilindungi" : "Masih dipakai proses aktif"}</strong>
                  <span>
                    {protectedSelected
                      ? "Master ini tidak dapat dinonaktifkan dari halaman ini."
                      : `Selesaikan ${blockersForSelected.join(", ")} sebelum menonaktifkan.`}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="da-modal-sticky-actions da-master-detail-actions">
              <Button type="button" variant="ghost" onClick={() => setSelected(null)}>Tutup</Button>
              <Button type="button" variant="ghost" onClick={() => startEdit(selected)} disabled={!writeEnabled || statusSaving}>
                <Edit2 size={16} /> Edit Data
              </Button>
              <Button
                type="button"
                onClick={() => setStatusTarget(selected)}
                disabled={!writeEnabled || statusSaving || (selected.active && protectedSelected)}
              >
                <Power size={16} /> {selected.active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(statusTarget)}
        title={statusTarget?.active ? `Nonaktifkan ${config.singular}?` : `Aktifkan ${config.singular}?`}
        subtitle={statusTarget ? moduleName(statusTarget, moduleType) : ""}
        onClose={() => !statusSaving && setStatusTarget(null)}
        size="md"
      >
        {statusTarget ? (
          <div className="da-master-status-confirm">
            <div className="da-master-confirm-icon"><AlertTriangle size={22} /></div>
            <div>
              <h3>{statusTarget.active ? "Transaksi baru tidak lagi memakai master ini." : "Master kembali tersedia untuk transaksi baru."}</h3>
              <p>
                Riwayat transaksi lama tidak dihapus. Backend akan menolak penonaktifan jika masih ada saldo, stok, PO, piutang, hutang, rule harga, akun, dompet, atau proses aktif yang terkait.
              </p>
            </div>
            <div className="da-modal-sticky-actions da-master-confirm-actions">
              <Button type="button" variant="ghost" onClick={() => setStatusTarget(null)} disabled={statusSaving}>Batal</Button>
              <Button type="button" onClick={confirmStatusChange} disabled={statusSaving}>
                {statusSaving ? "Memproses..." : statusTarget.active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
