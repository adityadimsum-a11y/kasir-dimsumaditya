import { useEffect, useMemo, useState } from "react";
import {
  getKasDompetBootstrap,
  getKasDompetMutationDetail,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import WalletTransferPanel from "./WalletTransferPanel";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";

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

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

function getDirectionTone(direction, amount) {
  const value = String(direction || "").toUpperCase();
  if (value.includes("OUT") || value.includes("KELUAR") || numberValue(amount) < 0) return "danger";
  if (value.includes("IN") || value.includes("MASUK") || numberValue(amount) > 0) return "success";
  return "warning";
}

function normalizeWallet(row) {
  return {
    ...row,
    wallet_id: row.wallet_id || row.id || row.code || "",
    wallet_code: row.wallet_code || row.code || row.bank_name || row.type || "",
    wallet_name: row.wallet_name || row.name || row.account_name || row.nama_dompet || "Dompet",
    location_id: row.location_id || "",
    balance: numberValue(row.balance || row.current_balance || row.saldo || row.calculated_balance || 0),
    uang_masuk: numberValue(row.uang_masuk || row.total_in || row.in_amount || 0),
    uang_keluar: numberValue(row.uang_keluar || row.total_out || row.out_amount || 0),
    mutation_count: numberValue(row.mutation_count || 0),
    status: row.status || "Aktif",
  };
}

function normalizeMutation(row) {
  const amountRaw = numberValue(row.amount || row.nominal || row.debit || row.credit || 0);
  const directionRaw = String(row.direction || row.mutation_type || row.type || "").toUpperCase();
  const isOut = directionRaw.includes("OUT") || directionRaw.includes("KELUAR") || amountRaw < 0;
  const amount = Math.abs(amountRaw);

  return {
    ...row,
    mutation_id: row.mutation_id || row.wallet_mutation_id || row.id || row.transaction_id || "",
    date: row.mutation_date || row.date || row.created_at || row.transaction_date || "",
    wallet_id: row.wallet_id || row.account_id || row.dompet_id || "",
    wallet_name: row.wallet_name || row.wallet_code || row.wallet_id || row.account_name || "Dompet",
    direction: isOut ? "OUT" : "IN",
    direction_label: isOut ? "Uang Keluar" : "Uang Masuk",
    amount,
    signed_amount: isOut ? -amount : amount,
    source_id: row.source_id || row.ref_id || row.payment_id || row.order_id || row.invoice_id || row.cash_expense_id || row.payable_payment_id || "",
    source_type: row.source_type || row.source_module || row.ref_type || row.module || row.category || "Transaksi",
    description: row.description || row.note || row.notes || row.memo || row.keterangan || "",
    status: row.status || row.mutation_status || "Tercatat",
    created_at: row.created_at || row.mutation_date || row.date || "",
  };
}

function isRealNormalizedMutation(row) {
  const mutationId = String(row?.mutation_id || "").trim();
  const sourceId = String(row?.source_id || "").trim();
  const amount = numberValue(row?.amount);
  const wallet = String(row?.wallet_id || row?.wallet_name || "").trim();
  const date = String(row?.date || row?.created_at || "").trim();
  const note = String(row?.description || "").trim();

  if (!mutationId && !sourceId) return false;
  if (amount <= 0) return false;
  if (!wallet && !date && !note) return false;
  return true;
}

function buildSummary(data) {
  const summary = data?.summary || {};
  return {
    total_balance: numberValue(summary.total_balance),
    total_in: numberValue(summary.total_in),
    total_out: numberValue(summary.total_out),
    today_in: numberValue(summary.today_in),
    today_out: numberValue(summary.today_out),
    wallet_count: numberValue(summary.wallet_count),
    mutation_count: numberValue(summary.mutation_count),
    need_source_count: numberValue(summary.need_source_count),
    transfer_in: numberValue(summary.transfer_in),
    transfer_out: numberValue(summary.transfer_out),
    amplop_ready: numberValue(summary.amplop_ready || summary.total_in),
  };
}

function filterMutations(rows, activeTab, selectedWalletId) {
  return asArray(rows).filter((row) => {
    if (selectedWalletId && row.wallet_id !== selectedWalletId) return false;
    if (activeTab === "in") return row.direction === "IN";
    if (activeTab === "out") return row.direction === "OUT";
    if (activeTab === "need_source") return !row.source_id;
    return true;
  });
}

function WalletCard({ wallet, selected, onClick }) {
  return (
    <button
      type="button"
      className="da-action-card"
      onClick={onClick}
      style={selected ? { borderColor: "var(--da-color-primary)", background: "var(--da-color-primary-faint)" } : undefined}
    >
      <div className="da-action-card-top">
        <Badge tone={wallet.balance >= 0 ? "success" : "danger"}>{safeText(wallet.wallet_code || wallet.wallet_name)}</Badge>
        <span className="da-action-arrow">›</span>
      </div>
      <div className="da-action-value">{formatRupiah(wallet.balance)}</div>
      <div className="da-action-desc">
        {safeText(wallet.wallet_name)} · {safeText(wallet.status, "Aktif")}
      </div>
    </button>
  );
}

function SourceRows({ rows }) {
  if (!rows?.length) {
    return <div className="da-muted">Belum ada baris sumber tambahan. Cek ID sumber di Arsip Digital bila perlu.</div>;
  }

  return (
    <div className="da-detail-grid">
      {rows.map((item, index) => {
        const row = item.row || {};
        return (
          <div className="da-detail-box" key={`${item.module}-${index}`}>
            <div className="da-mini-title">{safeText(item.module)}</div>
            <p><strong>ID:</strong> {safeText(item.id || row.id || row.transaction_id)}</p>
            <p><strong>Tanggal:</strong> {formatDisplayDate(row.date || row.payment_date || row.invoice_date || row.order_date || row.created_at)}</p>
            <p><strong>Nama:</strong> {safeText(row.customer_name || row.supplier_name || row.vendor_name || row.description || row.note)}</p>
            <p><strong>Status:</strong> {safeText(row.status || row.payment_status || row.invoice_status)}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function KasDompetPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [selectedMutation, setSelectedMutation] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);

  const wallets = useMemo(() => asArray(bootstrap?.wallets).map(normalizeWallet), [bootstrap]);
  const mutations = useMemo(() => asArray(bootstrap?.wallet_mutations).map(normalizeMutation).filter(isRealNormalizedMutation), [bootstrap]);
  const filteredMutations = useMemo(() => filterMutations(mutations, activeTab, selectedWalletId), [mutations, activeTab, selectedWalletId]);

  const needSourceCount = numberValue(summary.need_source_count || mutations.filter((row) => !row.source_id).length);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getKasDompetBootstrap(session?.sessionToken, {
      source: "finance_workspace_v12_wallet_bootstrap",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Gagal membaca data Kas & Dompet.");
      setBootstrap(null);
      setLoading(false);
      return;
    }

    setBootstrap(result.data || {});
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  const openMutationDetail = async (row) => {
    const mutation = normalizeMutation(row || {});
    setSelectedMutation(mutation);
    setDetail(null);
    setDetailError("");

    if (!mutation.mutation_id) return;

    setDetailLoading(true);
    const result = await getKasDompetMutationDetail(session?.sessionToken, {
      mutation_id: mutation.mutation_id,
      source: "finance_workspace_v12_wallet_detail",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setDetailError(result.message || "Detail sumber mutasi belum terbaca.");
      setDetailLoading(false);
      return;
    }

    setDetail(result.data || {});
    setDetailLoading(false);
  };

  const mutationColumns = [
    { key: "date", label: "Tanggal", render: (row) => formatDisplayDate(row.date) },
    { key: "mutation_id", label: "Mutasi ID", render: (row) => <strong>{safeText(row.mutation_id)}</strong> },
    { key: "wallet_name", label: "Dompet", render: (row) => safeText(row.wallet_name) },
    { key: "direction", label: "Arah", render: (row) => <Badge tone={getDirectionTone(row.direction, row.signed_amount)}>{row.direction_label}</Badge> },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount) },
    { key: "source_id", label: "Sumber", render: (row) => safeText(row.source_id) },
    { key: "status", label: "Status", render: (row) => <Badge tone={row.source_id ? "success" : "warning"}>{row.source_id ? safeText(row.status) : "Perlu Sumber"}</Badge> },
  ];

  return (
    <div className="da-finance-page">
      <PageHeader
        eyebrow="Uang & Kewajiban"
        title="Kas & Dompet"
        description="Pantau saldo kas dan bank, arus uang usaha, transfer internal, dan sumber setiap mutasi dari satu ruang kerja."
        actions={<div className="da-actions"><Button variant="ghost" onClick={loadData} disabled={loading}>{loading ? "Memuat..." : "Perbarui"}</Button><Button onClick={() => setTransferOpen(true)} disabled={wallets.length < 2}>+ Pindah Saldo</Button></div>}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}

      <div className="da-finance-kpi-grid">
        <StatCard tone="primary" label="Saldo Kas & Bank" value={loading ? "..." : formatRupiah(summary.total_balance)} description={`${summary.wallet_count} dompet aktif.`} />
        <StatCard label="Penerimaan Usaha" value={loading ? "..." : formatRupiah(summary.total_in)} description={`Hari ini ${formatRupiah(summary.today_in)}.`} />
        <StatCard tone="warning" label="Pengeluaran Usaha" value={loading ? "..." : formatRupiah(summary.total_out)} description={`Hari ini ${formatRupiah(summary.today_out)}.`} />
        <StatCard tone={needSourceCount > 0 ? "warning" : "success"} label="Perlu Ditelusuri" value={loading ? "..." : String(needSourceCount)} description="Mutasi eksternal tanpa ID sumber." />
      </div>

      <div className="da-finance-workspace da-finance-wallet-layout">
        <Card className="da-finance-main-card">
          <div className="da-section-heading"><div><div className="da-page-kicker">Dompet Usaha</div><h2 style={{margin:"4px 0 6px"}}>Saldo per Kas / Bank</h2><p className="da-muted" style={{margin:0}}>Klik dompet untuk memfilter mutasi pada ledger di bawah.</p></div>{selectedWalletId ? <Button variant="ghost" onClick={() => setSelectedWalletId("")}>Semua Dompet</Button> : null}</div>
          <div className="da-finance-wallet-grid">{wallets.length === 0 ? <div className="da-finance-empty">Belum ada dompet aktif.</div> : wallets.map((wallet) => <WalletCard key={wallet.wallet_id || wallet.wallet_name} wallet={wallet} selected={selectedWalletId === wallet.wallet_id} onClick={() => setSelectedWalletId(wallet.wallet_id)} />)}</div>
        </Card>
        <Card className="da-finance-side-card">
          <div className="da-page-kicker">Arus Uang</div><h2 style={{margin:"6px 0 6px"}}>Posisi Likuiditas</h2><p className="da-muted">Penerimaan dan pengeluaran usaha tidak mencampur transfer internal antar-dompet.</p>
          <div className="da-finance-hero-number da-finance-hero-number-dark"><span>Saldo fisik</span><strong>{formatRupiah(summary.total_balance)}</strong><small>{summary.wallet_count} dompet</small></div>
          <div className="da-finance-metric-list"><div><span>Masuk usaha</span><strong>{formatRupiah(summary.total_in)}</strong></div><div><span>Keluar usaha</span><strong>{formatRupiah(summary.total_out)}</strong></div><div><span>Transfer internal masuk</span><strong>{formatRupiah(summary.transfer_in)}</strong></div><div><span>Transfer internal keluar</span><strong>{formatRupiah(summary.transfer_out)}</strong></div></div>
          <Button onClick={() => setTransferOpen(true)} disabled={wallets.length < 2}>Pindahkan Saldo</Button>
          <div className="da-finance-note">Transfer internal memindahkan posisi kas/bank saja; tidak menambah penerimaan usaha dan tidak menjadi sumber baru 4 Amplop.</div>
        </Card>
      </div>

      <Card className="da-finance-ledger-card">
        <div className="da-section-heading"><div><div className="da-page-kicker">Ledger Dompet</div><h2 style={{margin:"4px 0 6px"}}>Riwayat Mutasi Uang</h2><p className="da-muted" style={{margin:0}}>Klik baris untuk membuka sumber transaksi dan ID terkait.</p></div><span className="da-finance-counter">{summary.mutation_count} mutasi</span></div>
        <div className="da-finance-tabs"><button className={activeTab === "all" ? "active" : ""} onClick={() => setActiveTab("all")}>Semua</button><button className={activeTab === "in" ? "active" : ""} onClick={() => setActiveTab("in")}>Masuk</button><button className={activeTab === "out" ? "active" : ""} onClick={() => setActiveTab("out")}>Keluar</button><button className={activeTab === "need_source" ? "active" : ""} onClick={() => setActiveTab("need_source")}>Perlu Ditelusuri</button></div>
        <DataTable columns={mutationColumns} rows={loading ? [] : filteredMutations} getRowKey={(row,index) => row.mutation_id || index} onRowClick={openMutationDetail} />
        {!loading && filteredMutations.length === 0 ? <div className="da-finance-empty">Belum ada mutasi pada pilihan ini.</div> : null}
      </Card>

      <Modal open={transferOpen} title="Pindahkan Saldo Antar-Dompet" subtitle="Transfer internal tidak mengubah total uang usaha" onClose={() => setTransferOpen(false)}><div className="da-finance-embedded"><WalletTransferPanel session={session} wallets={wallets} onSaved={async () => { await loadData(); setTransferOpen(false); }} onSessionExpired={onSessionExpired} /></div></Modal>

      <Modal open={Boolean(selectedMutation)} title="Detail Mutasi Uang" subtitle={selectedMutation?.mutation_id || ""} onClose={() => setSelectedMutation(null)}>
        {selectedMutation ? <div className="da-finance-modal-panel"><div className="da-modal-summary"><div><div className="da-mini-title">Nominal Mutasi</div><div className="da-big-text">{formatRupiah(selectedMutation.amount)}</div><p className="da-muted">{safeText(selectedMutation.wallet_name)}</p></div><Badge tone={getDirectionTone(selectedMutation.direction, selectedMutation.signed_amount)}>{selectedMutation.direction_label}</Badge></div><div className="da-detail-grid"><div className="da-detail-box"><p><strong>Tanggal:</strong> {formatDisplayDate(selectedMutation.date)}</p><p><strong>Status:</strong> {safeText(selectedMutation.status)}</p><p><strong>Catatan:</strong> {safeText(selectedMutation.description)}</p></div><div className="da-detail-box"><p><strong>Sumber:</strong> {safeText(selectedMutation.source_type)}</p><p><strong>Source ID:</strong> {safeText(selectedMutation.source_id)}</p><p><strong>Detail:</strong> {detailLoading ? "Membaca..." : detailError ? detailError : detail?.source?.rows?.length ? "Tertelusur" : "Ringkasan mutasi"}</p></div></div><div className="da-finance-detail-section"><h3>Sumber Terkait</h3><SourceRows rows={detail?.source?.rows || []} /></div>{detail?.related_ids?.length ? <div className="da-finance-note"><strong>ID terkait:</strong> {detail.related_ids.join(" → ")}</div> : null}</div> : null}
      </Modal>
    </div>
  );
}
