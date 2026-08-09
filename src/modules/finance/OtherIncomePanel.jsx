import { useEffect, useMemo, useState } from "react";
import { createFinanceOtherIncome } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { allowedPaymentMethods, suggestedPaymentMethod } from "../../lib/finance/walletPolicy.js";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function operationId() {
  return `FININ-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const baseForm = {
  income_date: today(),
  wallet_id: "",
  category: "OTHER_INCOME",
  source_name: "",
  payment_method: "Transfer",
  reference_no: "",
  amount: "",
  notes: "Uang masuk non-penjualan.",
};

export default function OtherIncomePanel({ session, wallets = [], onSaved, onSessionExpired }) {
  const [form, setForm] = useState(baseForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectedWallet = useMemo(() => wallets.find((row) => String(row.wallet_id) === String(form.wallet_id)) || null, [wallets, form.wallet_id]);
  const amount = Number(form.amount || 0);
  const methods = selectedWallet ? allowedPaymentMethods(selectedWallet) : ["Transfer", "Cash", "QRIS"];

  useEffect(() => {
    if (!form.wallet_id && wallets.length) {
      const wallet = wallets[0];
      setForm((old) => ({ ...old, wallet_id: wallet.wallet_id, payment_method: suggestedPaymentMethod(wallet) }));
    }
  }, [wallets, form.wallet_id]);

  function update(field, value) {
    setError("");
    setMessage("");
    if (field === "wallet_id") {
      const wallet = wallets.find((row) => String(row.wallet_id) === String(value));
      setForm((old) => ({ ...old, wallet_id: value, payment_method: suggestedPaymentMethod(wallet || {}) }));
      return;
    }
    setForm((old) => ({ ...old, [field]: value }));
  }

  function validate() {
    if (!selectedWallet) return "Pilih dompet tujuan.";
    if (!(amount > 0)) return "Nominal wajib lebih dari Rp0.";
    if (!String(form.notes || "").trim()) return "Catatan wajib diisi.";
    return "";
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      setConfirmOpen(false);
      return;
    }
    setSaving(true);
    setError("");
    const op = operationId();
    const result = await createFinanceOtherIncome(session?.sessionToken, {
      ...form,
      amount,
      operation_id: op,
      request_id: op,
      idempotency_key: op,
      source: "finance_workspace_v12_other_income",
    });
    if (!result?.success) {
      const code = String(result?.error?.code || "").toUpperCase();
      if (code.includes("AUTH") || code.includes("SESSION")) {
        onSessionExpired?.();
        return;
      }
      setError(result?.message || "Gagal menyimpan uang masuk lain.");
      setSaving(false);
      setConfirmOpen(false);
      return;
    }
    setMessage(result?.message || "Uang masuk lain berhasil disimpan.");
    setForm({ ...baseForm, income_date: today(), wallet_id: selectedWallet.wallet_id, payment_method: suggestedPaymentMethod(selectedWallet) });
    setSaving(false);
    setConfirmOpen(false);
    onSaved?.();
  }

  return (
    <>
      <div className="da-finance-modal-panel">
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">PENERIMAAN NON-PENJUALAN</div>
            <div className="da-big-text">Catat Uang yang Benar-benar Masuk</div>
            <p className="da-muted">Gunakan untuk tambahan modal, reimbursement, pengembalian vendor, koreksi kas masuk, atau penerimaan lain yang bukan omzet penjualan.</p>
          </div>
        </div>

        {message ? <div className="da-alert da-alert-success">{message}</div> : null}
        {error ? <div className="da-alert da-alert-danger">{error}</div> : null}

        <div className="da-finance-modal-form">
          <label className="da-field-label">Tanggal<input className="da-input" type="date" value={form.income_date} onChange={(e) => update("income_date", e.target.value)} /></label>
          <label className="da-field-label">Kategori
            <select className="da-input" value={form.category} onChange={(e) => update("category", e.target.value)}>
              <option value="OWNER_CAPITAL">Tambahan Modal / Uang Putaran</option>
              <option value="REIMBURSEMENT">Reimbursement</option>
              <option value="VENDOR_REFUND">Pengembalian Vendor</option>
              <option value="CORRECTION_IN">Koreksi Kas Masuk</option>
              <option value="OTHER_INCOME">Uang Masuk Lain</option>
            </select>
          </label>
          <label className="da-field-label">Dompet Tujuan
            <select className="da-input" value={form.wallet_id} onChange={(e) => update("wallet_id", e.target.value)}>
              {wallets.length ? wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name || wallet.wallet_code}</option>) : <option value="">Belum ada dompet</option>}
            </select>
          </label>
          <label className="da-field-label">Sumber / Pemberi<input className="da-input" value={form.source_name} onChange={(e) => update("source_name", e.target.value)} placeholder="Owner / nama vendor / sumber dana" /></label>
          <label className="da-field-label">Metode
            <select className="da-input" value={form.payment_method} onChange={(e) => update("payment_method", e.target.value)}>{methods.map((method) => <option key={method} value={method}>{method}</option>)}</select>
          </label>
          <label className="da-field-label">Nominal<input className="da-input" type="number" min="0" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="Rp 0" /></label>
          <label className="da-field-label">Referensi Bukti<input className="da-input" value={form.reference_no} onChange={(e) => update("reference_no", e.target.value)} placeholder="Nomor transfer / bukti" /></label>
          <label className="da-field-label da-finance-span-2">Catatan<input className="da-input" value={form.notes} onChange={(e) => update("notes", e.target.value)} /></label>
        </div>
        <div className="da-finance-preview-row">
          <div><span>Dompet</span><strong>{selectedWallet?.wallet_name || "-"}</strong></div>
          <div><span>Nominal</span><strong>{formatRupiah(amount)}</strong></div>
          <div><span>Status</span><strong>Uang masuk aktual</strong></div>
        </div>
        <div className="da-form-actions">
          <Button type="button" variant="ghost" onClick={() => setForm({ ...baseForm, income_date: today(), wallet_id: selectedWallet?.wallet_id || "", payment_method: suggestedPaymentMethod(selectedWallet || {}) })}>Reset</Button>
          <Button type="button" onClick={() => { const problem = validate(); if (problem) setError(problem); else setConfirmOpen(true); }} disabled={saving}>{saving ? "Menyimpan..." : "Tinjau Penerimaan"}</Button>
        </div>
      </div>

      <Modal open={confirmOpen} title="Konfirmasi Penerimaan" subtitle={form.category.replaceAll("_", " ")} onClose={() => setConfirmOpen(false)}>
        <div className="da-modal-summary"><div><div className="da-mini-title">Masuk ke Dompet</div><div className="da-big-text">{formatRupiah(amount)}</div><p className="da-muted">{selectedWallet?.wallet_name || "-"}</p></div><Badge tone="success">Uang Masuk</Badge></div>
        <div className="da-detail-grid">
          <div className="da-detail-box"><p><strong>Sumber:</strong> {form.source_name || "-"}</p><p><strong>Metode:</strong> {form.payment_method}</p><p><strong>Referensi:</strong> {form.reference_no || "-"}</p></div>
          <div className="da-detail-box"><p><strong>Catatan:</strong> {form.notes}</p><p><strong>Alokasi:</strong> Setelah tersimpan, sumber yang memenuhi syarat dapat dibagi melalui menu 4 Amplop.</p></div>
        </div>
        <div className="da-form-actions"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Batal</Button><Button onClick={submit} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Penerimaan"}</Button></div>
      </Modal>
    </>
  );
}
