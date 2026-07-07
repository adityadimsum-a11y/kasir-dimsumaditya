import { useEffect, useMemo, useState } from "react";
import {
  createMasterDataCoreRecord,
  getMasterDataCoreBootstrap,
} from "../../lib/api/actions";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";

const MODULE_CONFIG = {
  produk: {
    title: "Master Produk",
    badge: "Live Master",
    description:
      "Data produk/menu yang dipakai oleh produksi, stok, order, PO, dan laporan. Tidak untuk angka dummy.",
    introTitle: "Produk Jadi & Menu Usaha",
    introFlow: "Produk → Harga → Stok → Order → Arsip",
    introDesc:
      "Nama produk harus konsisten supaya kabel stok, kasir, PO, dan HPP tidak putus.",
    tableTitle: "Produk yang Terdaftar",
    emptyText: "Belum ada produk aktif terbaca.",
    defaultDraft: {
      product_code: "",
      product_name: "",
      category: "Produk Jadi",
      unit: "pcs",
      selling_price: "0",
      notes: "Produk aktif untuk transaksi ERP.",
    },
    fields: [
      { key: "product_code", label: "Kode Produk", placeholder: "DAM" },
      { key: "product_name", label: "Nama Produk", placeholder: "Dimsum Ayam Mix", required: true },
      { key: "category", label: "Kategori", placeholder: "Produk Jadi" },
      { key: "unit", label: "Satuan", placeholder: "pcs" },
      { key: "selling_price", label: "Harga Jual Default", placeholder: "0", type: "number" },
      { key: "notes", label: "Catatan", placeholder: "Catatan produk" },
    ],
    columns: [
      { key: "product_code", label: "Kode" },
      { key: "product_name", label: "Produk" },
      { key: "category", label: "Kategori" },
      { key: "unit", label: "Satuan" },
      { key: "selling_price", label: "Harga", render: (row) => formatMoney(row.selling_price) },
      { key: "status", label: "Status", render: (row) => <Badge tone={row.active ? "success" : "warning"}>{row.active ? "Aktif" : "Nonaktif"}</Badge> },
    ],
  },
  customer: {
    title: "Master Customer",
    badge: "Live Customer",
    description:
      "Data pelanggan untuk kasir/order, harga khusus, piutang, riwayat pembelian, dan follow-up.",
    introTitle: "Pelanggan & Riwayat Order",
    introFlow: "Customer → Order → Piutang → Uang Masuk → Arsip",
    introDesc:
      "Nama customer jangan dibuat beda-beda supaya transaksi dan riwayat pembelian bisa menyatu.",
    tableTitle: "Customer yang Terdaftar",
    emptyText: "Belum ada customer aktif terbaca.",
    defaultDraft: {
      customer_name: "",
      phone: "",
      area: "",
      price_type: "Normal",
      notes: "Customer aktif.",
    },
    fields: [
      { key: "customer_name", label: "Nama Customer", placeholder: "Nama pelanggan", required: true },
      { key: "phone", label: "No HP / WA", placeholder: "08xxx" },
      { key: "area", label: "Area", placeholder: "Tangerang / Bogor" },
      { key: "price_type", label: "Tipe Harga", placeholder: "Normal / Khusus" },
      { key: "notes", label: "Catatan", placeholder: "Catatan customer" },
    ],
    columns: [
      { key: "customer_name", label: "Customer" },
      { key: "phone", label: "Kontak" },
      { key: "area", label: "Area" },
      { key: "price_type", label: "Tipe Harga" },
      { key: "status", label: "Status", render: (row) => <Badge tone={row.active ? "success" : "warning"}>{row.active ? "Aktif" : "Nonaktif"}</Badge> },
    ],
  },
  supplier: {
    title: "Master Supplier",
    badge: "Live Supplier",
    description:
      "Data supplier untuk pembelian, hutang, pembayaran, dan arsip. Nana ayam tetap jadi supplier kunci.",
    introTitle: "Supplier & Kewajiban",
    introFlow: "Supplier → Nota → Hutang → Bayar → Mutasi Dompet",
    introDesc:
      "Supplier harus punya nama yang konsisten supaya hutang dan pembayaran bisa ditelusuri.",
    tableTitle: "Supplier yang Terdaftar",
    emptyText: "Belum ada supplier aktif terbaca.",
    defaultDraft: {
      supplier_name: "",
      supplier_type: "Bahan Baku",
      phone: "",
      default_wallet: "",
      notes: "Supplier aktif.",
    },
    fields: [
      { key: "supplier_name", label: "Nama Supplier", placeholder: "NANA / BANG ITEM AYAM", required: true },
      { key: "supplier_type", label: "Jenis Supplier", placeholder: "Ayam / Bahan Baku / Packaging" },
      { key: "phone", label: "Kontak", placeholder: "08xxx" },
      { key: "default_wallet", label: "Dompet Biasa", placeholder: "BCA / BRI / Cash" },
      { key: "notes", label: "Catatan", placeholder: "Catatan supplier" },
    ],
    columns: [
      { key: "supplier_name", label: "Supplier" },
      { key: "supplier_type", label: "Jenis" },
      { key: "phone", label: "Kontak" },
      { key: "default_wallet", label: "Dompet" },
      { key: "status", label: "Status", render: (row) => <Badge tone={row.active ? "success" : "warning"}>{row.active ? "Aktif" : "Nonaktif"}</Badge> },
    ],
  },
  lokasi: {
    title: "Master Lokasi",
    badge: "Live Lokasi",
    description:
      "Data lokasi kerja, cabang, outlet, dan titik stok. Tangerang tetap pusat owner control.",
    introTitle: "Kamar Cabang & Titik Stok",
    introFlow: "Lokasi → Permission → Stok → Setoran → Monitoring",
    introDesc:
      "Setiap lokasi punya kamar sendiri. Owner/Tangerang bisa pantau sesuai izin.",
    tableTitle: "Lokasi yang Terdaftar",
    emptyText: "Belum ada lokasi terbaca.",
    defaultDraft: {
      location_code: "",
      location_name: "",
      location_type: "Cabang",
      parent_location: "TGR",
      notes: "Lokasi aktif.",
    },
    fields: [
      { key: "location_code", label: "Kode Lokasi", placeholder: "TGR / PML / CBN", required: true },
      { key: "location_name", label: "Nama Lokasi", placeholder: "Tangerang HO", required: true },
      { key: "location_type", label: "Tipe", placeholder: "HO / Produksi / Resto" },
      { key: "parent_location", label: "Induk", placeholder: "TGR" },
      { key: "notes", label: "Catatan", placeholder: "Catatan lokasi" },
    ],
    columns: [
      { key: "location_code", label: "Kode" },
      { key: "location_name", label: "Lokasi" },
      { key: "location_type", label: "Tipe" },
      { key: "parent_location", label: "Induk" },
      { key: "status", label: "Status", render: (row) => <Badge tone={row.active ? "success" : "warning"}>{row.active ? "Aktif" : "Nonaktif"}</Badge> },
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

function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function formatMoney(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") && message.includes("TIDAK AKTIF"))
  );
}

function normalizeRow(row, moduleType) {
  const activeRaw = row.active ?? row.is_active ?? row.status ?? "TRUE";
  const activeText = String(activeRaw).trim().toUpperCase();
  const active = !(activeText === "FALSE" || activeText === "NO" || activeText === "0" || activeText === "NONAKTIF" || activeText === "INACTIVE");

  if (moduleType === "produk") {
    return {
      ...row,
      id: row.product_id || row.id || row.product_code || row.code || "",
      product_id: row.product_id || row.id || "",
      product_code: row.product_code || row.code || row.sku || "",
      product_name: row.product_name || row.name || row.nama || row.item_name || "Produk",
      category: row.category || row.kategori || row.product_type || "Produk Jadi",
      unit: row.unit || row.satuan || "pcs",
      selling_price: numberValue(row.selling_price || row.price || row.harga_jual || 0),
      active,
      notes: row.notes || row.catatan || "",
    };
  }

  if (moduleType === "customer") {
    return {
      ...row,
      id: row.customer_id || row.id || row.customer_code || row.customer_name || "",
      customer_id: row.customer_id || row.id || "",
      customer_name: row.customer_name || row.name || row.nama || "Customer",
      phone: row.phone || row.whatsapp || row.no_hp || row.contact || "",
      area: row.area || row.city || row.location || row.alamat || "",
      price_type: row.price_type || row.tipe_harga || row.customer_type || "Normal",
      active,
      notes: row.notes || row.catatan || "",
    };
  }

  if (moduleType === "supplier") {
    return {
      ...row,
      id: row.supplier_id || row.id || row.supplier_code || row.supplier_name || "",
      supplier_id: row.supplier_id || row.id || "",
      supplier_name: row.supplier_name || row.name || row.nama || "Supplier",
      supplier_type: row.supplier_type || row.type || row.kategori || "Supplier",
      phone: row.phone || row.no_hp || row.contact || "",
      default_wallet: row.default_wallet || row.wallet || row.rekening || "",
      active,
      notes: row.notes || row.catatan || "",
    };
  }

  return {
    ...row,
    id: row.location_id || row.id || row.location_code || row.code || "",
    location_id: row.location_id || row.id || row.location_code || row.code || "",
    location_code: row.location_code || row.code || row.location_id || row.id || "",
    location_name: row.location_name || row.name || row.nama || row.location_code || "Lokasi",
    location_type: row.location_type || row.type || row.kategori || "Lokasi",
    parent_location: row.parent_location || row.parent_code || row.parent || "",
    active,
    notes: row.notes || row.catatan || "",
  };
}

function normalizePayload(payload, moduleType) {
  const data = payload?.data || payload || {};
  const rows = asArray(data.rows || data.items || data[moduleType] || []).map((row) => normalizeRow(row, moduleType));
  return {
    rows,
    summary: {
      total_rows: numberValue(data.summary?.total_rows ?? rows.length),
      active_rows: numberValue(data.summary?.active_rows ?? rows.filter((row) => row.active).length),
      inactive_rows: numberValue(data.summary?.inactive_rows ?? rows.filter((row) => !row.active).length),
      missing_id_rows: numberValue(data.summary?.missing_id_rows ?? rows.filter((row) => !row.id).length),
    },
    warnings: asArray(data.warnings),
  };
}

export default function MasterDataPage({ moduleType = "produk", session, onSessionExpired }) {
  const config = MODULE_CONFIG[moduleType] || MODULE_CONFIG.produk;
  const sessionToken = session?.sessionToken || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [bootstrap, setBootstrap] = useState(() => normalizePayload({}, moduleType));
  const [draft, setDraft] = useState(() => ({ ...config.defaultDraft }));
  const [selected, setSelected] = useState(null);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return bootstrap.rows;
    return bootstrap.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term));
  }, [bootstrap.rows, search]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getMasterDataCoreBootstrap(sessionToken, { module_type: moduleType });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Data master belum bisa dibaca.");
        return;
      }
      setBootstrap(normalizePayload(result, moduleType));
    } catch (err) {
      setError(err?.message || "Gagal membaca master data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDraft({ ...config.defaultDraft });
    setSearch("");
    setSelected(null);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleType]);

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const resetDraft = () => {
    setDraft({ ...config.defaultDraft });
    setSuccess("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const requiredField = config.fields.find((field) => field.required && !String(draft[field.key] || "").trim());
    if (requiredField) {
      setError(`${requiredField.label} wajib diisi.`);
      return;
    }

    setSaving(true);
    try {
      const result = await createMasterDataCoreRecord(sessionToken, {
        module_type: moduleType,
        ...draft,
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Master data belum bisa disimpan.");
        return;
      }
      setSuccess(result.message || "Master data berhasil disimpan.");
      setDraft({ ...config.defaultDraft });
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan master data.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title={config.title} description={config.description} badge={config.badge} />

      <Card>
        <div className="da-backend-panel">
          <div>
            <div className="da-dashboard-banner-kicker">Master Data Hidup</div>
            <div className="da-dashboard-banner-title">{config.introTitle}</div>
            <div className="da-dashboard-banner-desc">{config.introFlow}</div>
            <p className="da-muted">{config.introDesc}</p>
          </div>
          <div className="da-dashboard-banner-actions">
            <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Cek" : "Terhubung"}</Badge>
            <Button variant="ghost" onClick={loadData} disabled={loading}>Refresh Data</Button>
          </div>
        </div>
      </Card>

      {error ? <div className="da-form-warning">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}

      <div className="da-grid da-grid-3">
        <StatCard label="Total Data" value={bootstrap.summary.total_rows} description="Jumlah baris master terbaca." />
        <StatCard label="Aktif" value={bootstrap.summary.active_rows} description="Data yang bisa dipakai transaksi." />
        <StatCard tone="warning" label="Perlu ID" value={bootstrap.summary.missing_id_rows} description="Harus dibereskan agar tidak jadi angka yatim." />
      </div>

      <Card>
        <div className="da-section-heading">
          <div>
            <span>Input Master</span>
            <h2>Tambah Data Baru</h2>
            <p>Data ini akan dipakai modul hidup. Hapus fisik tidak disarankan, nanti pakai aktif/nonaktif.</p>
          </div>
          <Badge tone="warning">Live Input</Badge>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="da-form-grid">
            {config.fields.map((field) => (
              <label key={field.key} className="da-field">
                {field.label}
                <input
                  type={field.type || "text"}
                  value={draft[field.key] || ""}
                  placeholder={field.placeholder || ""}
                  onChange={(event) => updateDraft(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>

          <div className="da-form-actions">
            <Button variant="ghost" onClick={resetDraft} disabled={saving}>Reset</Button>
            <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Master"}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="da-section-heading">
          <div>
            <span>Daftar Master</span>
            <h2>{config.tableTitle}</h2>
            <p>Klik baris untuk melihat detail ringkas dan ID sumber.</p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>

        <div className="da-filter-row">
          <input
            className="da-input"
            value={search}
            placeholder="Cari nama, kode, area, supplier..."
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button variant="ghost" onClick={() => setSearch("")}>Reset</Button>
        </div>

        <DataTable
          columns={config.columns}
          rows={filteredRows}
          getRowKey={(row, index) => row.id || `${moduleType}-${index}`}
          onRowClick={(row) => setSelected(row)}
        />
        {!loading && filteredRows.length === 0 ? <p className="da-muted" style={{ marginTop: 12 }}>{config.emptyText}</p> : null}
      </Card>

      <Modal
        open={Boolean(selected)}
        title={`Detail ${config.title}`}
        subtitle={safeText(selected?.id || selected?.product_id || selected?.customer_id || selected?.supplier_id || selected?.location_id)}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="da-detail-grid">
            {Object.entries(selected).slice(0, 18).map(([key, value]) => (
              <div className="da-detail-box" key={key}>
                <div className="da-mini-info-label">{key}</div>
                <div className="da-mini-info-value">{String(value ?? "-")}</div>
              </div>
            ))}
            <div className="da-modal-note da-detail-box" style={{ gridColumn: "1 / -1" }}>
              Master data ini harus bisa dipakai ulang oleh modul transaksi tanpa bikin nama/kode ganda.
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
