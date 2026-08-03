import { useEffect, useMemo, useState } from "react";
import { transferFinanceWallet } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";

function today() { return new Date().toISOString().slice(0, 10); }
function opId() { return `WTRF-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function balance(wallet) { return Number(wallet?.balance ?? wallet?.current_balance ?? 0); }

export default function WalletTransferPanel({ session, wallets = [], onSaved, onSessionExpired }) {
  const [form, setForm] = useState({ transfer_date: today(), from_wallet_id: "", to_wallet_id: "", amount: "", notes: "Transfer internal antar-dompet usaha." });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
    if (!(amount > 0)) return "Nominal transfer wajib lebih dari Rp0.";
    if (balance(fromWallet) < amount) return `Saldo ${fromWallet.wallet_name} tidak cukup.`;
    if (!String(form.notes || "").trim()) return "Catatan transfer wajib diisi.";
    return "";
  }

  async function submit() {
    const problem = validate();
    if (problem) { setError(problem); setConfirmOpen(false); return; }
    setSaving(true); setError("");
    const op = opId();
    const result = await transferFinanceWallet(session?.sessionToken, { ...form, amount, operation_id: op, request_id: op, idempotency_key: op, source: "package_4_wallet_transfer_live" });
    if (!result?.success) {
      const code = String(result?.error?.code || "").toUpperCase();
      if (code.includes("AUTH") || code.includes("SESSION")) { onSessionExpired?.(); return; }
      setError(result?.message || "Transfer antar-dompet gagal."); setSaving(false); setConfirmOpen(false); return;
    }
    setMessage(result?.message || "Transfer antar-dompet berhasil.");
    setForm((old) => ({ ...old, amount: "", notes: "Transfer internal antar-dompet usaha." }));
    setSaving(false); setConfirmOpen(false); onSaved?.();
  }

  return (
    <>
      <Card style={{ marginTop: 18 }}>
        <div className="da-section-heading"><div><div className="da-mini-title">TRANSFER INTERNAL</div><div className="da-big-text">Pindahkan Saldo Antar-Dompet</div><p className="da-muted">Membuat satu Transfer ID, Wallet OUT asal, Wallet IN tujuan, jurnal pemindahan aset, Arsip, dan Audit. Tidak menambah uang usaha dan tidak masuk 4 Amplop.</p></div><Badge tone="warning">Netral</Badge></div>
        {message ? <div className="da-form-success" style={{ marginBottom: 12 }}>{message}</div> : null}
        {error ? <div className="da-login-error" style={{ marginBottom: 12 }}>{error}</div> : null}
        <div className="da-form-grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
          <label className="da-field-label">Tanggal Transfer<input className="da-input" type="date" value={form.transfer_date} onChange={(e) => setForm((old) => ({ ...old, transfer_date: e.target.value }))} /></label>
          <label className="da-field-label">Nominal<input className="da-input" type="number" min="0" value={form.amount} onChange={(e) => setForm((old) => ({ ...old, amount: e.target.value }))} /></label>
          <label className="da-field-label">Dompet Asal<select className="da-input" value={form.from_wallet_id} onChange={(e) => setForm((old) => ({ ...old, from_wallet_id: e.target.value }))}>{wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name} · {formatRupiah(balance(wallet))}</option>)}</select></label>
          <label className="da-field-label">Dompet Tujuan<select className="da-input" value={form.to_wallet_id} onChange={(e) => setForm((old) => ({ ...old, to_wallet_id: e.target.value }))}>{wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name} · {formatRupiah(balance(wallet))}</option>)}</select></label>
          <label className="da-field-label" style={{ gridColumn: "span 2" }}>Catatan<input className="da-input" value={form.notes} onChange={(e) => setForm((old) => ({ ...old, notes: e.target.value }))} /></label>
        </div>
        <div className="da-modal-note" style={{ marginTop: 12 }}>Preview: {fromWallet?.wallet_name || "-"} OUT {formatRupiah(amount)} → {toWallet?.wallet_name || "-"} IN {formatRupiah(amount)}. Total uang usaha tetap sama.</div>
        <div className="da-form-actions" style={{ marginTop: 12 }}><Button variant="ghost" onClick={() => setForm((old) => ({ ...old, amount: "" }))}>Reset</Button><Button onClick={() => { const problem=validate(); if(problem) setError(problem); else setConfirmOpen(true); }} disabled={saving || wallets.length < 2}>{saving ? "Memindahkan..." : "Preview & Transfer"}</Button></div>
      </Card>
      <Modal open={confirmOpen} title="Konfirmasi Transfer Antar-Dompet" subtitle="Bukan uang masuk baru" onClose={() => setConfirmOpen(false)}>
        <div className="da-modal-summary"><div><div className="da-mini-title">Nominal Transfer</div><div className="da-big-text">{formatRupiah(amount)}</div><p className="da-muted">{fromWallet?.wallet_name} → {toWallet?.wallet_name}</p></div><Badge tone="warning">NETRAL</Badge></div>
        <div className="da-modal-note">Transfer ini tidak boleh muncul sebagai sumber uang baru untuk 4 Amplop. Sistem hanya memindahkan saldo fisik antar-dompet.</div>
        <div className="da-form-actions" style={{ marginTop: 16 }}><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Batal</Button><Button onClick={submit} disabled={saving}>{saving ? "Memindahkan..." : "Konfirmasi Transfer"}</Button></div>
      </Modal>
    </>
  );
}
