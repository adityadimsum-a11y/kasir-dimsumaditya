import { useEffect, useMemo, useState } from "react";
import {
  getKasDompetBootstrap,
  getKasDompetMutationDetail,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
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
    source_type: row.source_type || row.ref_type || row.module || row.category || "Transaksi",
    description: row.description || row.note || row.notes || row.memo || row.keterangan || "",
    status: row.status || row.mutation_status || "Tercatat",
    created_at: row.created_at || row.mutation_date || row.date || "",
  };
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
        {safeText(wallet.wallet_name)} · Masuk {formatRupiah(wallet.uang_masuk)} · Keluar {formatRupiah(wallet.uang_keluar)}
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

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);

  const wallets = useMemo(() => asArray(bootstrap?.wallets).map(normalizeWallet), [bootstrap]);
  const mutations = useMemo(() => asArray(bootstrap?.wallet_mutations).map(normalizeMutation), [bootstrap]);
  const filteredMutations = useMemo(() => filterMutations(mutations, activeTab, selectedWalletId), [mutations, activeTab, selectedWalletId]);

  const needSourceCount = useMemo(() => mutations.filter((row) => !row.source_id).length, [mutations]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getKasDompetBootstrap(session?.sessionToken, {
      source: "frontend_part_4r_kas_dompet_detail_trace",
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
      source: "frontend_part_4r_detail_click",
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
    <div>
      <PageHeader
        title="Kas & Dompet"
        description="Pantau saldo cash, BCA, BRI, mutasi uang, dan sumber ID transaksi. Semua uang harus bisa ditelusuri."
        badge="Live Trace"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Dompet usaha</div>
          <div className="da-dashboard-banner-title">Uang Masuk → Dompet → 4 Amplop</div>
          <div className="da-dashboard-banner-desc">
            Halaman ini membaca uang aktual dari mutasi dompet. Klik mutasi untuk melihat sumber transaksi dan rantai ID.
          </div>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading}>{loading ? "Membaca..." : "Refresh Data"}</Button>
        </div>
      </div>

      {error ? <div className="da-login-error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="da-grid da-grid-3">
        <StatCard tone="primary" label="Total Saldo Dompet" value={loading ? "..." : formatRupiah(summary.total_balance)} description="Saldo hitung dari uang masuk dan keluar." />
        <StatCard label="Uang Masuk Aktual" value={loading ? "..." : formatRupiah(summary.total_in)} description="Bahan 4 Amplop dari payment/setoran aktual." />
        <StatCard tone="warning" label="Uang Keluar" value={loading ? "..." : formatRupiah(summary.total_out)} description="Belanja, hutang, dan pengeluaran lain." />
      </div>

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard label="Dompet Aktif" value={loading ? "..." : summary.wallet_count} description="Jumlah dompet yang terbaca." />
        <StatCard label="Mutasi Tercatat" value={loading ? "..." : summary.mutation_count} description="Jumlah mutasi uang masuk/keluar." />
        <StatCard tone={needSourceCount > 0 ? "warning" : "success"} label="Mutasi Perlu Sumber" value={loading ? "..." : needSourceCount} description="Mutasi tanpa source ID perlu dicek." />
      </div>

      <div style={{ height: 18 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Dompet</div>
            <div className="da-big-text">Saldo per Cash / Bank</div>
            <p className="da-muted">Klik kartu dompet untuk filter mutasi. Klik Semua Dompet untuk reset.</p>
          </div>
          <Button variant="ghost" onClick={() => setSelectedWalletId("")}>Semua Dompet</Button>
        </div>
        <div className="da-action-grid">
          {wallets.length === 0 ? <div className="da-muted">Belum ada dompet terbaca.</div> : wallets.map((wallet) => (
            <WalletCard key={wallet.wallet_id || wallet.wallet_name} wallet={wallet} selected={selectedWalletId === wallet.wallet_id} onClick={() => setSelectedWalletId(wallet.wallet_id)} />
          ))}
        </div>
      </Card>

      <div style={{ height: 18 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Mutasi Uang</div>
            <div className="da-big-text">Catatan Keuangan Otomatis</div>
            <p className="da-muted">Klik baris untuk membuka detail sumber: order, payment, kas keluar, hutang, setoran, atau 4 Amplop.</p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>

        <div className="da-tabs">
          <button type="button" className={activeTab === "all" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("all")}>Semua Mutasi</button>
          <button type="button" className={activeTab === "in" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("in")}>Uang Masuk</button>
          <button type="button" className={activeTab === "out" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("out")}>Uang Keluar</button>
          <button type="button" className={activeTab === "need_source" ? "da-tab active" : "da-tab"} onClick={() => setActiveTab("need_source")}>Perlu Sumber</button>
        </div>

        <DataTable
          columns={mutationColumns}
          rows={loading ? [] : filteredMutations}
          getRowKey={(row, index) => row.mutation_id || index}
          onRowClick={openMutationDetail}
        />
      </Card>

      <Modal open={Boolean(selectedMutation)} title="Detail Mutasi Uang" subtitle={selectedMutation?.mutation_id || ""} onClose={() => setSelectedMutation(null)}>
        {selectedMutation ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Nominal Mutasi</div>
                <div className="da-big-text">{formatRupiah(selectedMutation.amount)}</div>
                <p className="da-muted">Dompet: <strong>{safeText(selectedMutation.wallet_name)}</strong></p>
              </div>
              <Badge tone={getDirectionTone(selectedMutation.direction, selectedMutation.signed_amount)}>{selectedMutation.direction_label}</Badge>
            </div>

            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Mutasi</div>
                <p><strong>ID:</strong> {safeText(selectedMutation.mutation_id)}</p>
                <p><strong>Tanggal:</strong> {formatDisplayDate(selectedMutation.date)}</p>
                <p><strong>Status:</strong> {safeText(selectedMutation.status)}</p>
                <p><strong>Catatan:</strong> {safeText(selectedMutation.description)}</p>
              </div>
              <div className="da-detail-box">
                <div className="da-mini-title">Sumber Transaksi</div>
                <p><strong>Tipe:</strong> {safeText(selectedMutation.source_type)}</p>
                <p><strong>Sumber ID:</strong> {safeText(selectedMutation.source_id)}</p>
                <p><strong>Dompet ID:</strong> {safeText(selectedMutation.wallet_id)}</p>
                <p><strong>Status detail:</strong> {detailLoading ? "Membaca detail..." : detailError ? detailError : detail ? "Detail terbaca" : "Ringkasan lokal"}</p>
              </div>
            </div>

            <div style={{ height: 14 }} />
            <div className="da-mini-title">Baris Sumber Terkait</div>
            <SourceRows rows={detail?.source?.rows || []} />

            {detail?.related_ids?.length ? (
              <div className="da-modal-note" style={{ marginTop: 14 }}>
                <strong>ID terkait:</strong> {detail.related_ids.join(" → ")}
              </div>
            ) : null}

            <div className="da-modal-note" style={{ marginTop: 14 }}>
              Uang masuk aktual dari mutasi ini bisa menjadi bahan 4 Amplop. PO, piutang, dan stok tidak boleh masuk amplop sebelum berubah jadi uang masuk nyata.
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
