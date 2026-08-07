import { useEffect, useMemo, useState } from "react";
import {
  activateBranchCommerce,
  createBranchWallet,
  getBranchCommerceBootstrap,
  setBranchCommerceStatus,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";

const today = new Date().toISOString().slice(0, 10);

const initialWalletForm = {
  location_id: "",
  wallet_code: "",
  wallet_name: "",
  wallet_type: "CASH",
  payment_channel: "",
  set_opening_balance: false,
  opening_date: today,
  opening_balance: "",
  opening_reason: "",
  notes: "",
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

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") && message.includes("TIDAK AKTIF"))
  );
}

function operationId(prefix, locationId) {
  const location = String(locationId || "LOC").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `${prefix}-${location}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function readinessTone(row) {
  if (row.cashier_live) return "success";
  if (row.ready_for_activation) return "warning";
  return "danger";
}

function readinessLabel(row) {
  if (row.cashier_live) return "Kasir Live";
  if (row.ready_for_activation) return "Siap Diaktifkan";
  if (String(row.profile_status || "").toUpperCase() === "SUSPENDED") return "Ditangguhkan";
  return "Belum Siap";
}

export default function BranchCommercePanel({ sessionToken, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [walletForm, setWalletForm] = useState(initialWalletForm);
  const [activationRow, setActivationRow] = useState(null);
  const [activationText, setActivationText] = useState("");
  const [activationNotes, setActivationNotes] = useState("");

  const locations = useMemo(() => asArray(data?.locations), [data]);
  const readiness = useMemo(() => asArray(data?.readiness), [data]);
  const wallets = useMemo(() => asArray(data?.wallets), [data]);
  const summary = data?.summary || {};
  const health = data?.health || {};

  const loadData = async () => {
    setLoading(true);
    setError("");

    const response = await getBranchCommerceBootstrap(sessionToken, {});
    if (!response.success) {
      if (isAuthRequired(response)) {
        onSessionExpired?.();
        return;
      }
      setError(response.message || "Gagal membaca kesiapan Kasir Cabang.");
      setData(null);
      setLoading(false);
      return;
    }

    const next = response.data || {};
    setData(next);
    setWalletForm((current) => ({
      ...current,
      location_id: current.location_id || next.locations?.[0]?.location_id || "",
    }));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const updateWallet = (field, value) => {
    setWalletForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateWallet = async (event) => {
    event.preventDefault();
    setResult(null);

    if (!walletForm.location_id || !walletForm.wallet_code.trim() || !walletForm.wallet_name.trim()) {
      setResult({ success: false, message: "Lokasi, kode dompet, dan nama dompet wajib diisi." });
      return;
    }

    if (walletForm.set_opening_balance && !walletForm.opening_reason.trim()) {
      setResult({ success: false, message: "Catatan saldo awal wajib diisi." });
      return;
    }

    setSubmitting(true);
    const opId = operationId("BRC-WALLET", walletForm.location_id);
    const response = await createBranchWallet(sessionToken, {
      ...walletForm,
      opening_balance: numberValue(walletForm.opening_balance),
      operation_id: opId,
      request_id: opId,
      idempotency_key: opId,
    });

    if (!response.success) {
      if (isAuthRequired(response)) {
        onSessionExpired?.();
        return;
      }
      setResult({ success: false, message: response.message || "Dompet cabang gagal dibuat." });
      setSubmitting(false);
      return;
    }

    setResult({ success: true, message: response.message || "Dompet cabang berhasil dibuat." });
    setWalletForm((current) => ({
      ...initialWalletForm,
      location_id: current.location_id,
    }));
    setSubmitting(false);
    await loadData();
  };

  const openActivation = (row) => {
    setActivationRow(row);
    setActivationText("");
    setActivationNotes("");
    setResult(null);
  };

  const handleActivate = async () => {
    if (!activationRow || submitting) return;
    setSubmitting(true);
    const opId = operationId("BRC-ACTIVATE", activationRow.location_id);
    const response = await activateBranchCommerce(sessionToken, {
      location_id: activationRow.location_id,
      confirmation: activationText,
      notes: activationNotes,
      operation_id: opId,
      request_id: opId,
      idempotency_key: opId,
    });

    if (!response.success) {
      if (isAuthRequired(response)) {
        onSessionExpired?.();
        return;
      }
      setResult({ success: false, message: response.message || "Kasir cabang gagal diaktifkan." });
      setSubmitting(false);
      return;
    }

    setResult({ success: true, message: response.message || "Kasir cabang berhasil diaktifkan." });
    setActivationRow(null);
    setActivationText("");
    setActivationNotes("");
    setSubmitting(false);
    await loadData();
  };

  const handleSuspend = async (row) => {
    if (submitting) return;
    const confirmed = window.confirm(`Tangguhkan Kasir ${row.location_name}? Order baru akan diblokir.`);
    if (!confirmed) return;

    setSubmitting(true);
    const opId = operationId("BRC-SUSPEND", row.location_id);
    const response = await setBranchCommerceStatus(sessionToken, {
      location_id: row.location_id,
      status: "SUSPENDED",
      notes: "Ditangguhkan manual oleh Owner dari panel Kasir Cabang.",
      operation_id: opId,
      request_id: opId,
      idempotency_key: opId,
    });

    if (!response.success) {
      if (isAuthRequired(response)) {
        onSessionExpired?.();
        return;
      }
      setResult({ success: false, message: response.message || "Kasir cabang gagal ditangguhkan." });
      setSubmitting(false);
      return;
    }

    setResult({ success: true, message: response.message || "Kasir cabang ditangguhkan." });
    setSubmitting(false);
    await loadData();
  };

  const readinessColumns = [
    {
      key: "location_name",
      label: "Lokasi",
      render: (row) => (
        <div>
          <strong>{safeText(row.location_name)}</strong>
          <div className="da-muted">{safeText(row.location_code)} · {safeText(row.location_type)}</div>
        </div>
      ),
    },
    {
      key: "account_ready",
      label: "Akun",
      render: (row) => <Badge tone={row.account_ready ? "success" : "warning"}>{row.active_account_count} aktif</Badge>,
    },
    {
      key: "price_ready",
      label: "Harga",
      render: (row) => <Badge tone={row.price_ready ? "success" : "warning"}>{row.priced_product_count} produk</Badge>,
    },
    {
      key: "wallet_ready",
      label: "Dompet",
      render: (row) => <Badge tone={row.wallet_ready ? "success" : "warning"}>{row.wallet_count} dompet</Badge>,
    },
    {
      key: "free_stock_pcs",
      label: "Stok Bebas",
      render: (row) => `${numberValue(row.free_stock_pcs).toLocaleString("id-ID")} pcs`,
    },
    {
      key: "cashier_live",
      label: "Status",
      render: (row) => <Badge tone={readinessTone(row)}>{readinessLabel(row)}</Badge>,
    },
    {
      key: "action",
      label: "Aksi",
      render: (row) => (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!row.cashier_live ? (
            <Button
              type="button"
              variant={row.ready_for_activation ? "primary" : "ghost"}
              disabled={!row.ready_for_activation || submitting}
              onClick={() => openActivation(row)}
            >
              Aktifkan
            </Button>
          ) : (
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => handleSuspend(row)}>
              Tangguhkan
            </Button>
          )}
        </div>
      ),
    },
  ];

  const walletColumns = [
    { key: "location_name", label: "Lokasi", render: (row) => safeText(row.location_name) },
    {
      key: "wallet_name",
      label: "Dompet",
      render: (row) => (
        <div>
          <strong>{safeText(row.wallet_name)}</strong>
          <div className="da-muted">{safeText(row.wallet_code)} · {safeText(row.wallet_type)}</div>
        </div>
      ),
    },
    { key: "payment_channel", label: "Jalur Bayar", render: (row) => safeText(row.payment_channel) },
    { key: "current_balance", label: "Saldo", render: (row) => formatRupiah(numberValue(row.current_balance)) },
    { key: "status", label: "Status", render: (row) => <Badge tone={String(row.status).toUpperCase() === "ACTIVE" ? "success" : "warning"}>{safeText(row.status)}</Badge> },
  ];

  return (
    <>
      <div style={{ height: 16 }} />
      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Part 3C · Multi-Lokasi</div>
            <div className="da-big-text">Kasir, Harga, Stok & Uang Cabang</div>
            <p className="da-muted">
              Owner menyiapkan dompet secara manual. Kasir hanya aktif jika akun, harga lokasi, stok bebas, dan dompet sudah siap.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge tone={health.ready ? "success" : "danger"}>
              {health.ready ? "Gerbang Cabang Aktif" : "Gerbang Cabang Belum Siap"}
            </Badge>
            <Badge tone="warning">Tanpa Seed Otomatis</Badge>
            <Button type="button" variant="ghost" onClick={loadData} disabled={loading || submitting}>
              {loading ? "Membaca..." : "Refresh Data"}
            </Button>
          </div>
        </div>

        {error ? <div className="da-login-error">{error}</div> : null}
        {result ? (
          <div className={result.success ? "da-form-success" : "da-form-warning"} style={{ marginTop: 12 }}>
            {result.message}
          </div>
        ) : null}

        <div style={{ height: 14 }} />
        <div className="da-grid da-grid-3">
          <StatCard label="Lokasi Terbaca" value={loading ? "..." : numberValue(summary.location_count)} description="Sumber dari Master Lokasi." />
          <StatCard tone="success" label="Kasir Live" value={loading ? "..." : numberValue(summary.live_count)} description="Lokasi yang sudah aktif dan tetap memenuhi syarat." />
          <StatCard tone="warning" label="Siap Diaktifkan" value={loading ? "..." : numberValue(summary.ready_to_activate_count)} description="Menunggu konfirmasi Owner." />
        </div>

        <div style={{ height: 16 }} />
        <DataTable
          columns={readinessColumns}
          rows={loading ? [] : readiness}
          getRowKey={(row) => row.location_id}
        />

        {!loading && readiness.some((row) => asArray(row.blockers).length > 0) ? (
          <div className="da-form-warning" style={{ marginTop: 14 }}>
            <strong>Yang masih harus disiapkan:</strong>
            {readiness.map((row) => (
              asArray(row.blockers).length > 0 ? (
                <div key={row.location_id} style={{ marginTop: 8 }}>
                  <strong>{row.location_name}:</strong> {row.blockers.join(" · ")}
                </div>
              ) : null
            ))}
          </div>
        ) : null}
      </Card>

      <div style={{ height: 16 }} />
      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Dompet Pembayaran Cabang</div>
            <div className="da-big-text">Tambah Dompet Secara Manual</div>
            <p className="da-muted">
              Buat hanya dompet nyata: kas laci, rekening bank, e-wallet, atau merchant. Pembayaran order akan masuk ke dompet lokasi yang sama.
            </p>
          </div>
          <Badge tone="success">Owner Only</Badge>
        </div>

        <form onSubmit={handleCreateWallet}>
          <div className="da-drop-form-preview">
            <div className="da-drop-field">
              <label>Lokasi</label>
              <select value={walletForm.location_id} onChange={(event) => updateWallet("location_id", event.target.value)} disabled={submitting}>
                <option value="">Pilih lokasi</option>
                {locations.map((location) => (
                  <option key={location.location_id} value={location.location_id}>
                    {location.location_name} · {location.location_code}
                  </option>
                ))}
              </select>
            </div>
            <div className="da-drop-field">
              <label>Kode Dompet</label>
              <input value={walletForm.wallet_code} placeholder="Contoh: CASH / BCA / GOPAY" onChange={(event) => updateWallet("wallet_code", event.target.value.toUpperCase())} disabled={submitting} />
            </div>
            <div className="da-drop-field">
              <label>Nama Dompet</label>
              <input value={walletForm.wallet_name} placeholder="Contoh: Kas Tunai Pemalang" onChange={(event) => updateWallet("wallet_name", event.target.value)} disabled={submitting} />
            </div>
            <div className="da-drop-field">
              <label>Jenis Dompet</label>
              <select value={walletForm.wallet_type} onChange={(event) => updateWallet("wallet_type", event.target.value)} disabled={submitting}>
                <option value="CASH">Kas Tunai</option>
                <option value="BANK">Bank</option>
                <option value="EWALLET">E-Wallet</option>
                <option value="MERCHANT">Merchant</option>
                <option value="OTHER">Lainnya</option>
              </select>
            </div>
            <div className="da-drop-field">
              <label>Jalur Bayar</label>
              <input value={walletForm.payment_channel} placeholder="Contoh: CASH / TRANSFER / QRIS" onChange={(event) => updateWallet("payment_channel", event.target.value.toUpperCase())} disabled={submitting} />
            </div>
            <div className="da-drop-field">
              <label>Catatan</label>
              <input value={walletForm.notes} placeholder="Pemilik rekening/PIC atau fungsi dompet" onChange={(event) => updateWallet("notes", event.target.value)} disabled={submitting} />
            </div>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            <input
              type="checkbox"
              checked={walletForm.set_opening_balance}
              onChange={(event) => updateWallet("set_opening_balance", event.target.checked)}
              disabled={submitting}
            />
            Tetapkan saldo awal sekarang berdasarkan hitungan fisik/rekening
          </label>

          {walletForm.set_opening_balance ? (
            <div className="da-drop-form-preview" style={{ marginTop: 12 }}>
              <div className="da-drop-field">
                <label>Tanggal Saldo Awal</label>
                <input type="date" value={walletForm.opening_date} onChange={(event) => updateWallet("opening_date", event.target.value)} disabled={submitting} />
              </div>
              <div className="da-drop-field">
                <label>Saldo Awal</label>
                <input inputMode="numeric" value={walletForm.opening_balance} placeholder="0" onChange={(event) => updateWallet("opening_balance", event.target.value)} disabled={submitting} />
              </div>
              <div className="da-drop-field">
                <label>Sumber Pemeriksaan</label>
                <input value={walletForm.opening_reason} placeholder="Contoh: Hitung kas fisik / mutasi rekening" onChange={(event) => updateWallet("opening_reason", event.target.value)} disabled={submitting} />
              </div>
            </div>
          ) : null}

          <div className="da-form-actions">
            <Button type="button" variant="ghost" onClick={() => setWalletForm((current) => ({ ...initialWalletForm, location_id: current.location_id }))} disabled={submitting}>
              Reset
            </Button>
            <Button type="submit" disabled={submitting || !health.ready}>
              {submitting ? "Menyimpan..." : "Buat Dompet Cabang"}
            </Button>
          </div>
        </form>

        <div style={{ height: 16 }} />
        <DataTable columns={walletColumns} rows={loading ? [] : wallets} getRowKey={(row) => row.wallet_id} />
      </Card>

      <Modal
        open={Boolean(activationRow)}
        title="Aktifkan Kasir Cabang"
        subtitle={activationRow ? `${activationRow.location_name} · ${activationRow.location_code}` : ""}
        onClose={() => {
          if (!submitting) setActivationRow(null);
        }}
      >
        {activationRow ? (
          <div>
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Akun Aktif</div>
                <div className="da-big-text">{activationRow.active_account_count}</div>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Produk Berharga</div>
                <div className="da-big-text">{activationRow.priced_product_count}</div>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Dompet Aktif</div>
                <div className="da-big-text">{activationRow.wallet_count}</div>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Stok Bebas</div>
                <div className="da-big-text">{numberValue(activationRow.free_stock_pcs).toLocaleString("id-ID")} pcs</div>
              </div>
            </div>

            <div className="da-form-warning" style={{ marginTop: 14 }}>
              Setelah aktif, order nyata dapat membuat invoice, pembayaran/piutang, stok keluar, mutasi dompet, jurnal, arsip, dan audit. Harga tetap divalidasi ulang oleh sistem.
            </div>

            <div className="da-drop-field" style={{ marginTop: 14 }}>
              <label>Ketik: AKTIFKAN KASIR {activationRow.location_code}</label>
              <input value={activationText} onChange={(event) => setActivationText(event.target.value.toUpperCase())} disabled={submitting} />
            </div>
            <div className="da-drop-field" style={{ marginTop: 12 }}>
              <label>Catatan Aktivasi</label>
              <input value={activationNotes} placeholder="Contoh: STO, harga, akun, dan dompet sudah diperiksa Owner" onChange={(event) => setActivationNotes(event.target.value)} disabled={submitting} />
            </div>

            <div className="da-form-actions">
              <Button type="button" variant="ghost" onClick={() => setActivationRow(null)} disabled={submitting}>Batal</Button>
              <Button type="button" onClick={handleActivate} disabled={submitting || activationText !== `AKTIFKAN KASIR ${activationRow.location_code}`}>
                {submitting ? "Mengaktifkan..." : "Aktifkan Kasir Live"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
