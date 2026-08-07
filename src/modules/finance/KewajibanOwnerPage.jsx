import { useEffect, useMemo, useState } from "react";
import {
  createOwnerObligation,
  getOwnerObligationBootstrap,
  getOwnerObligationDetail,
  payOwnerObligation,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import { allowedPaymentMethods, suggestedPaymentMethod } from "../../lib/finance/walletPolicy.js";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";

function isAuthRequired(result) {
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
  return code === "UNAUTHORIZED" || code === "SESSION_EXPIRED" || code === "AUTH_REQUIRED";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ym() {
  return new Date().toISOString().slice(0, 7);
}

function toNumber(value) {
  const clean = String(value ?? "0").replace(/[^0-9.-]/g, "");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value, fallback = "-") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function makeOperationId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const emptyObligationForm = {
  obligation_name: "",
  obligation_type: "Cicilan Usaha",
  due_day: "1",
  due_date: today(),
  monthly_amount: "0",
  original_amount: "0",
  total_tenor: "0",
  paid_tenor: "0",
  wallet_id: "",
  notes: "Kewajiban aktif.",
};

const emptyPaymentForm = {
  obligation_id: "",
  payment_date: today(),
  amount: "0",
  wallet_id: "",
  method: "Transfer",
  notes: "Pembayaran kewajiban owner.",
};

export default function KewajibanOwnerPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState({});
  const [obligationForm, setObligationForm] = useState(emptyObligationForm);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const sessionToken = session?.sessionToken || session?.session_token || "";
  const summary = data.summary || {};
  const obligations = data.obligations || [];
  const payments = data.payments || [];
  const wallets = data.wallets || [];
  const hiddenRows = Number(data.hidden_rows || summary.hidden_rows || 0);

  const activeObligations = useMemo(() => {
    return obligations.filter((item) => {
      const status = String(item.status || "Active").toUpperCase();
      return status !== "LUNAS" && status !== "CLOSED" && status !== "VOID";
    });
  }, [obligations]);

  const selectedObligation = useMemo(() => {
    return obligations.find((item) => item.obligation_id === paymentForm.obligation_id);
  }, [obligations, paymentForm.obligation_id]);

  const selectedRemaining = toNumber(selectedObligation?.remaining_balance || selectedObligation?.remaining_amount || 0);
  const paymentAmount = toNumber(paymentForm.amount);
  const paymentAfter = Math.max(0, selectedRemaining - paymentAmount);
  const selectedPaymentWallet = useMemo(() => wallets.find((wallet) => String(wallet.wallet_id) === String(paymentForm.wallet_id)) || null, [wallets, paymentForm.wallet_id]);
  const paymentMethods = useMemo(() => selectedPaymentWallet ? allowedPaymentMethods(selectedPaymentWallet) : ["Transfer", "Cash"], [selectedPaymentWallet]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const result = await getOwnerObligationBootstrap(sessionToken, {
        location_id: session?.user?.location_id || "TGR",
        period: ym(),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membaca Kewajiban Owner.");
        setData({});
        return;
      }
      const nextData = result.data || {};
      setData(nextData);
      const firstWallet = (nextData.wallets || [])[0]?.wallet_id || "";
      const firstObligation = (nextData.obligations || []).find((item) => String(item.status || "Active").toUpperCase() !== "LUNAS")?.obligation_id || "";
      setObligationForm((old) => ({ ...old, wallet_id: old.wallet_id || firstWallet }));
      setPaymentForm((old) => {
        const wallet = (nextData.wallets || []).find((item) => item.wallet_id === (old.wallet_id || firstWallet));
        return {
          ...old,
          wallet_id: old.wallet_id || firstWallet,
          obligation_id: old.obligation_id || firstObligation,
          method: old.wallet_id ? old.method : suggestedPaymentMethod(wallet || {}),
        };
      });
    } catch (err) {
      setError(err?.message || "Gagal koneksi ke backend.");
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionToken) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  function updateObligationField(field, value) {
    setObligationForm((old) => ({ ...old, [field]: value }));
  }

  function updatePaymentField(field, value) {
    setPaymentForm((old) => ({ ...old, [field]: value }));
  }

  async function handleCreateObligation(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await createOwnerObligation(sessionToken, {
        obligation: obligationForm,
        operation_id: makeOperationId("OBL-CREATE"),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal menyimpan kewajiban.");
        return;
      }
      setMessage(result.message || "Kewajiban berhasil disimpan.");
      setObligationForm(emptyObligationForm);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan kewajiban.");
    } finally {
      setSaving(false);
    }
  }


  async function openObligationDetail(row) {
    setDetail(row);
    setDetailError("");
    if (!row?.obligation_id) return;
    setDetailLoading(true);
    try {
      const result = await getOwnerObligationDetail(sessionToken, { obligation_id: row.obligation_id });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setDetailError(result?.message || "Gagal membaca detail kewajiban.");
        return;
      }
      setDetail({ ...row, ...(result.data || {}), obligation: result.data?.obligation || row });
    } catch (err) {
      setDetailError(err?.message || "Gagal membaca detail kewajiban.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handlePayObligation(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await payOwnerObligation(sessionToken, {
        payment: paymentForm,
        operation_id: makeOperationId("OBL-PAY"),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Gagal membayar kewajiban.");
        return;
      }
      setMessage(result.message || "Pembayaran kewajiban berhasil dicatat.");
      setPaymentForm((old) => ({ ...emptyPaymentForm, wallet_id: old.wallet_id }));
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal membayar kewajiban.");
    } finally {
      setSaving(false);
    }
  }

  const obligationColumns = [
    { key: "name", label: "Kewajiban", render: (row) => <strong>{text(row.obligation_name)}</strong> },
    { key: "type", label: "Jenis", render: (row) => text(row.obligation_type) },
    { key: "due", label: "Jatuh Tempo", render: (row) => row.due_day ? `Tgl ${row.due_day}` : formatDate(row.due_date) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.monthly_amount || row.amount) },
    { key: "remaining", label: "Sisa", render: (row) => <strong>{formatRupiah(row.remaining_balance)}</strong> },
    { key: "status", label: "Status", render: (row) => <Badge tone={String(row.status).toUpperCase() === "LUNAS" ? "success" : "warning"}>{text(row.status, "Active")}</Badge> },
  ];

  const paymentColumns = [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.payment_date || row.date) },
    { key: "id", label: "Payment ID", render: (row) => <strong>{text(row.payment_id)}</strong> },
    { key: "obligation", label: "Kewajiban", render: (row) => text(row.obligation_name) },
    { key: "wallet", label: "Dompet", render: (row) => text(row.wallet_name || row.wallet_id) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "status", label: "Status", render: (row) => <Badge tone="success">{text(row.status, "Paid")}</Badge> },
  ];


  const cashExpenseColumns = [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.transaction_date) },
    { key: "id", label: "KASOUT ID", render: (row) => <strong>{text(row.cash_expense_id)}</strong> },
    { key: "desc", label: "Keterangan", render: (row) => text(row.description || row.recipient) },
    { key: "wallet", label: "Dompet", render: (row) => text(row.wallet_id) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "status", label: "Status", render: (row) => <Badge tone="success">{text(row.status, "POSTED")}</Badge> },
  ];

  const mutationColumns = [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.transaction_date) },
    { key: "id", label: "Mutasi ID", render: (row) => <strong>{text(row.mutation_id || row.wallet_mutation_id)}</strong> },
    { key: "wallet", label: "Dompet", render: (row) => text(row.wallet_name || row.wallet_id) },
    { key: "direction", label: "Arah", render: () => <Badge tone="danger">OUT</Badge> },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "source", label: "Sumber", render: (row) => text(row.source_id || row.source_ref) },
  ];

  const traceColumns = [
    { key: "step", label: "Step", render: (row) => row.step },
    { key: "label", label: "Rantai", render: (row) => <strong>{text(row.label)}</strong> },
    { key: "id", label: "ID", render: (row) => text(row.id) },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "status", label: "Status", render: (row) => <Badge tone={String(row.status).toUpperCase().includes("BELUM") ? "warning" : "success"}>{text(row.status)}</Badge> },
  ];

  return (
    <div className="da-page da-page-wide">
      <div className="da-page-header">
        <div>
          <div className="da-kicker">DIMSUM ADITYA</div>
          <h1>Kewajiban Owner</h1>
          <p>
            Cicilan usaha, tagihan rutin, jatuh tempo, dan pembayaran dari dompet. Semua pembayaran harus punya ID dan bisa ditelusuri ke Kas & Dompet.
          </p>
        </div>
        <Badge tone="warning">Live Kewajiban</Badge>
      </div>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-kicker">KEWAJIBAN USAHA</div>
            <h2>Jatuh Tempo → Bayar → Kas Keluar → Mutasi Dompet → Owner Control → Arsip</h2>
            <p className="da-muted">
              Modul ini untuk BPJS, cicilan mobil/bank, wifi, kontrakan, parkir, listrik, dan kewajiban owner lain. Data dimasukkan manual tanpa seed; pembayaran memotong dompet, membuat KASOUT, jurnal, arsip, dan pemakaian Amplop Cicilan/Kewajiban.
            </p>
          </div>
          <div className="da-actions">
            <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
            <Button variant="secondary" onClick={loadData} disabled={loading}>{loading ? "Memuat..." : "Refresh Data"}</Button>
          </div>
        </div>
      </Card>

      {hiddenRows > 0 && <div className="da-alert da-alert-danger">{hiddenRows} baris kosong/formatting disembunyikan supaya kewajiban tidak menampilkan angka yatim.</div>}
      {message && <div className="da-alert da-alert-success">{message}</div>}
      {error && <div className="da-alert da-alert-danger">{error}</div>}

      <div className="da-grid da-grid-3">
        <StatCard label="Kewajiban Aktif" value={summary.active_count || 0} description="Jumlah kewajiban yang masih dipantau." />
        <StatCard label="Sisa Kewajiban" value={formatRupiah(summary.total_remaining || 0)} description="Sisa saldo kewajiban/cicilan aktif." tone="warning" />
        <StatCard label="Jatuh Tempo Bulan Ini" value={formatRupiah(summary.due_this_month || 0)} description="Perkiraan tagihan yang perlu disiapkan bulan ini." tone="warning" />
        <StatCard label="Overdue" value={summary.overdue_count || 0} description="Lewat jatuh tempo dan belum lunas." tone={summary.overdue_count ? "danger" : "default"} />
        <StatCard label="Dibayar Bulan Ini" value={formatRupiah(summary.paid_this_month || 0)} description="Pembayaran kewajiban yang sudah tercatat." />
        <StatCard label="Mutasi OUT" value={summary.wallet_mutation_count || 0} description="Pembayaran yang punya mutasi dompet." />
      </div>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-kicker">INPUT LIVE</div>
            <h2>Tambah Kewajiban / Cicilan</h2>
            <p className="da-muted">Data ini menjadi daftar pantauan owner. Jangan hapus fisik; nanti pakai aktif/nonaktif atau lunas.</p>
          </div>
          <Badge tone="warning">Owner Only</Badge>
        </div>
        <form onSubmit={handleCreateObligation} className="da-form-grid">
          <label>
            Nama Kewajiban
            <input value={obligationForm.obligation_name} onChange={(e) => updateObligationField("obligation_name", e.target.value)} placeholder="Contoh: Angsuran Mobil Luxio" />
          </label>
          <label>
            Jenis
            <select value={obligationForm.obligation_type} onChange={(e) => updateObligationField("obligation_type", e.target.value)}>
              <option>Cicilan Usaha</option>
              <option>Tagihan Rutin</option>
              <option>Kontrakan</option>
              <option>BPJS</option>
              <option>Wifi</option>
              <option>Listrik</option>
              <option>Parkir</option>
              <option>Lainnya</option>
            </select>
          </label>
          <label>
            Jatuh Tempo Tanggal
            <input type="number" min="1" max="31" value={obligationForm.due_day} onChange={(e) => updateObligationField("due_day", e.target.value)} />
          </label>
          <label>
            Nominal Bulanan
            <input value={obligationForm.monthly_amount} onChange={(e) => updateObligationField("monthly_amount", e.target.value)} placeholder="0" />
          </label>
          <label>
            Saldo Awal / Total Kewajiban
            <input value={obligationForm.original_amount} onChange={(e) => updateObligationField("original_amount", e.target.value)} placeholder="0 jika tagihan rutin" />
          </label>
          <label>
            Total Tenor
            <input type="number" min="0" value={obligationForm.total_tenor} onChange={(e) => updateObligationField("total_tenor", e.target.value)} />
          </label>
          <label>
            Tenor Sudah Dibayar
            <input type="number" min="0" value={obligationForm.paid_tenor} onChange={(e) => updateObligationField("paid_tenor", e.target.value)} />
          </label>
          <label>
            Dompet Biasa
            <select value={obligationForm.wallet_id} onChange={(e) => updateObligationField("wallet_id", e.target.value)}>
              <option value="">Pilih dompet</option>
              {wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name || wallet.wallet_id}</option>)}
            </select>
          </label>
          <label className="da-form-span-2">
            Catatan
            <input value={obligationForm.notes} onChange={(e) => updateObligationField("notes", e.target.value)} />
          </label>
          <div className="da-form-footer da-form-span-3">
            <span className="da-muted">Preview: {text(obligationForm.obligation_name, "Kewajiban baru")} · {formatRupiah(obligationForm.monthly_amount)} per bulan</span>
            <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Kewajiban"}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-kicker">POTONG DOMPET</div>
            <h2>Bayar Kewajiban</h2>
            <p className="da-muted">Saat dibayar, sistem mencatat pembayaran, KASOUT, dan mutasi dompet OUT.</p>
          </div>
          <Badge tone="danger">Pembayaran Aktif</Badge>
        </div>
        <form onSubmit={handlePayObligation} className="da-form-grid">
          <label>
            Pilih Kewajiban
            <select value={paymentForm.obligation_id} onChange={(e) => updatePaymentField("obligation_id", e.target.value)}>
              <option value="">Pilih kewajiban</option>
              {activeObligations.map((item) => <option key={item.obligation_id} value={item.obligation_id}>{item.obligation_name} · sisa {formatRupiah(item.remaining_balance)}</option>)}
            </select>
          </label>
          <label>
            Tanggal Bayar
            <input type="date" value={paymentForm.payment_date} onChange={(e) => updatePaymentField("payment_date", e.target.value)} />
          </label>
          <label>
            Nominal Bayar
            <input value={paymentForm.amount} onChange={(e) => updatePaymentField("amount", e.target.value)} placeholder="0" />
          </label>
          <label>
            Dompet Pembayaran
            <select value={paymentForm.wallet_id} onChange={(e) => { const wallet = wallets.find((item) => String(item.wallet_id) === String(e.target.value)); setPaymentForm((old) => ({ ...old, wallet_id: e.target.value, method: suggestedPaymentMethod(wallet || {}) })); }}>
              <option value="">Pilih dompet</option>
              {wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name || wallet.wallet_id}</option>)}
            </select>
          </label>
          <label>
            Metode
            <select value={paymentForm.method} onChange={(e) => updatePaymentField("method", e.target.value)}>
              {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
          <label>
            Catatan
            <input value={paymentForm.notes} onChange={(e) => updatePaymentField("notes", e.target.value)} />
          </label>
          <div className="da-form-footer da-form-span-3">
            <span className="da-muted">Sisa awal: {formatRupiah(selectedRemaining)} · Dibayar: {formatRupiah(paymentAmount)} · Sisa akhir: {formatRupiah(paymentAfter)}</span>
            <Button type="submit" disabled={saving || !paymentForm.obligation_id}>{saving ? "Menyimpan..." : "Simpan Pembayaran"}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-kicker">DAFTAR KEWAJIBAN</div>
            <h2>Kewajiban Owner yang Dipantau</h2>
            <p className="da-muted">Klik baris untuk melihat detail, riwayat bayar, KASOUT, dan mutasi dompet.</p>
          </div>
          <Badge tone="success">Data Aktual</Badge>
        </div>
        <DataTable columns={obligationColumns} rows={obligations} getRowKey={(row) => row.obligation_id} onRowClick={openObligationDetail} />
      </Card>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-kicker">RIWAYAT BAYAR</div>
            <h2>Pembayaran Kewajiban</h2>
            <p className="da-muted">Pembayaran yang sudah tercatat sebagai KASOUT dan mutasi OUT.</p>
          </div>
          <Badge tone="success">Kas Keluar</Badge>
        </div>
        <DataTable columns={paymentColumns} rows={payments} getRowKey={(row) => row.payment_id} />
      </Card>

      {detail && (
        <Modal open={!!detail} title="Detail Kewajiban Owner" onClose={() => { setDetail(null); setDetailError(""); }}>
          {detailLoading && <div className="da-alert da-alert-warning">Membaca rantai detail kewajiban...</div>}
          {detailError && <div className="da-alert da-alert-danger">{detailError}</div>}
          {(() => {
            const activeDetail = detail.obligation || detail;
            const detailPayments = detail.payments || payments.filter((row) => row.obligation_id === activeDetail.obligation_id);
            const detailCash = detail.cash_expenses || [];
            const detailMutations = detail.wallet_mutations || [];
            const detailTrace = detail.trace || [];
            const detailSummary = detail.summary || {};
            return (
              <>
                <div className="da-detail-grid">
                  <div className="da-detail-box da-detail-box-full">
                    <span className="da-detail-label">Kewajiban</span>
                    <h2>{text(activeDetail.obligation_name)}</h2>
                    <Badge tone={String(activeDetail.status).toUpperCase() === "LUNAS" ? "success" : "warning"}>{text(activeDetail.status, "Active")}</Badge>
                  </div>
                  <div className="da-detail-box">
                    <span className="da-detail-label">Nominal Bulanan</span>
                    <strong>{formatRupiah(activeDetail.monthly_amount)}</strong>
                  </div>
                  <div className="da-detail-box">
                    <span className="da-detail-label">Sisa Kewajiban</span>
                    <strong>{formatRupiah(activeDetail.remaining_balance)}</strong>
                  </div>
                  <div className="da-detail-box">
                    <span className="da-detail-label">Total Dibayar</span>
                    <strong>{formatRupiah(detailSummary.paid_total || 0)}</strong>
                  </div>
                  <div className="da-detail-box">
                    <span className="da-detail-label">KASOUT</span>
                    <strong>{detailSummary.cashout_count || detailCash.length} catatan</strong>
                  </div>
                  <div className="da-detail-box">
                    <span className="da-detail-label">Mutasi OUT</span>
                    <strong>{detailSummary.mutation_count || detailMutations.length} catatan</strong>
                  </div>
                  <div className="da-detail-box da-detail-box-full">
                    <span className="da-detail-label">Rantai yang harus bisa ditelusuri</span>
                    <p>Kewajiban Owner → Pembayaran → KASOUT → Mutasi Dompet OUT → Kas & Dompet → Owner Control → Arsip Digital.</p>
                  </div>
                </div>

                <h3 className="da-section-title">Peta Rantai</h3>
                <DataTable columns={traceColumns} rows={detailTrace} getRowKey={(row) => `${row.step}-${row.label}`} />

                <h3 className="da-section-title">Pembayaran Kewajiban</h3>
                <DataTable columns={paymentColumns} rows={detailPayments} getRowKey={(row) => row.payment_id} />

                <h3 className="da-section-title">Kas Keluar / KASOUT Terkait</h3>
                <DataTable columns={cashExpenseColumns} rows={detailCash} getRowKey={(row) => row.cash_expense_id} />

                <h3 className="da-section-title">Mutasi Dompet OUT Terkait</h3>
                <DataTable columns={mutationColumns} rows={detailMutations} getRowKey={(row) => row.mutation_id || row.wallet_mutation_id} />
              </>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
