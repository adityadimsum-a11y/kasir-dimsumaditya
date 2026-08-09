import { useEffect, useMemo, useState } from "react";
import { transferFinanceWallet } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";

function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function operationId() { return `WTR-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function balance(wallet) { return Number(wallet?.balance ?? wallet?.current_balance ?? 0); }

export default function WalletTransferPanel({ session, wallets = [], onSaved, onSessionExpired }) {
  const [form, setForm] = useState({ transfer_date: today(), from_wallet_id: "", to_wallet_id: "", amount: "", notes: "Transfer internal antar-dompet usaha." });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fromWallet = useMemo(() => wallets.find((row) => String(row.wallet_id) === String(form.from_wallet_id)) || null, [wallets, form.from_wallet_id]);
  const toWallet = useMemo(() => wallets.find((row) => String(row.wallet_id) === String(form.to_wallet_id)) || null, [wallets, form.to_wallet_id]);
  const amount = Number(form.amount || 0);

  useEffect(() => {
    if (wallets.length >= 2 && (!form.from_wallet_id || !form.to_wallet_id)) {
      setForm((old) => ({ ...old, from_wallet_id: old.from_wallet_id || wallets[0].wallet_id, to_wallet_id: old.to_wallet_id || wallets[1].wallet_id }));
    }
  }, [wallets, form.from_wallet_id, form.to_wallet_id]);

  function validate() {
    if (!fromWallet || !toWallet) return "Pilih dompet asal dan tujuan.";
    if (fromWallet.wallet_id === toWallet.wallet_id) return "Dompet asal dan tujuan tidak boleh sama.";
    if (!(amount > 0)) return "Nominal transfer harus lebih dari Rp0.";
    if (balance(fromWallet) < amount) return `Saldo ${fromWallet.wallet_name} tidak cukup.`;
    if (!String(form.notes || "").trim()) return "Catatan transfer wajib diisi.";
    return "";
  }

  async function submit() {
    const problem = validate();
    if (problem) { setError(problem); setConfirmOpen(false); return; }
    setSaving(true); setError("");
    const op = operationId();
    const result = await transferFinanceWallet(session?.sessionToken, { ...form, amount, operation_id: op, request_id: op, idempotency_key: op, source: "finance_workspace_v12" });
    if (!result?.success) {
      const code = String(result?.error?.code || "").toUpperCase();
      if (code.includes("AUTH") || code.includes("SESSION")) { onSessionExpired?.(); return; }
      setError(result?.message || "Gagal memindahkan saldo."); setSaving(false); setConfirmOpen(false); return;
    }
    setForm((old) => ({ ...old, amount: "", notes: "Transfer internal antar-dompet usaha." }));
    setSaving(false); setConfirmOpen(false); onSaved?.();
  }

  return (
    <>
      <div className="da-finance-modal-panel">
        {error ? <div className="da-alert da-alert-danger">{error}</div> : null}
        <div className="da-finance-modal-form">
          <label className="da-field-label">Tanggal Transfer<input className="da-input" type="date" value={form.transfer_date} onChange={(e) => setForm((old) => ({ ...old, transfer_date: e.target.value }))} /></label>
          <label className="da-field-label">Nominal<input className="da-input" value={form.amount} onChange={(e) => setForm((old) => ({ ...old, amount: e.target.value }))} placeholder="Rp 0" /></label>
          <label className="da-field-label">Dompet Asal<select className="da-input" value={form.from_wallet_id} onChange={(e) => setForm((old) => ({ ...old, from_wallet_id: e.target.value }))}>{wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name} · {formatRupiah(balance(wallet))}</option>)}</select></label>
          <label className="da-field-label">Dompet Tujuan<select className="da-input" value={form.to_wallet_id} onChange={(e) => setForm((old) => ({ ...old, to_wallet_id: e.target.value }))}>{wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name} · {formatRupiah(balance(wallet))}</option>)}</select></label>
          <label className="da-field-label da-finance-span-2">Catatan<input className="da-input" value={form.notes} onChange={(e) => setForm((old) => ({ ...old, notes: e.target.value }))} /></label>
        </div>
        <div className="da-finance-preview-row">
          <div><span>Keluar dari</span><strong>{fromWallet?.wallet_name || "-"}</strong></div>
          <div><span>Nominal</span><strong>{formatRupiah(amount)}</strong></div>
          <div><span>Masuk ke</span><strong>{toWallet?.wallet_name || "-"}</strong></div>
        </div>
        <div className="da-form-actions"><Button variant="ghost" onClick={() => setForm((old) => ({ ...old, amount: "" }))}>Reset</Button><Button onClick={() => { const problem = validate(); if (problem) setError(problem); else setConfirmOpen(true); }} disabled={saving || wallets.length < 2}>{saving ? "Memindahkan..." : "Tinjau Transfer"}</Button></div>
      </div>

      <Modal open={confirmOpen} title="Konfirmasi Transfer Dompet" subtitle="Saldo total usaha tidak berubah" onClose={() => setConfirmOpen(false)}>
        <div className="da-modal-summary"><div><div className="da-mini-title">Nominal Transfer</div><div className="da-big-text">{formatRupiah(amount)}</div><p className="da-muted">{fromWallet?.wallet_name} → {toWallet?.wallet_name}</p></div><Badge tone="warning">Internal</Badge></div>
        <div className="da-finance-note">Sistem membuat mutasi OUT dan IN berpasangan serta satu jurnal pemindahan kas/bank. Transfer ini tidak dihitung sebagai uang masuk baru.</div>
        <div className="da-form-actions"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Batal</Button><Button onClick={submit} disabled={saving}>{saving ? "Memindahkan..." : "Pindahkan Saldo"}</Button></div>
      </Modal>
    </>
  );
}
