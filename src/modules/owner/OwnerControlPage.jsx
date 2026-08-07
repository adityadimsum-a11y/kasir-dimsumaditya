import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Banknote, Boxes, Factory, Package, RefreshCw, ShieldCheck, ShoppingCart, Users, Wallet } from "lucide-react";
import { getOwnerControlBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import FinanceLockPanel from "./FinanceLockPanel";

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();

  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") && message.includes("TIDAK AKTIF"))
  );
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const clean = String(value ?? "0").replace(/[^0-9.-]/g, "");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, suffix = "") {
  return `${Number(value || 0).toLocaleString("id-ID")}${suffix ? ` ${suffix}` : ""}`;
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getToneByStatus(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("AMAN") || text.includes("SEHAT") || text.includes("LUNAS") || text.includes("READY")) return "success";
  if (text.includes("PERLU") || text.includes("BELUM") || text.includes("WARNING") || text.includes("KURANG")) return "warning";
  if (text.includes("BAHAYA") || text.includes("ERROR") || text.includes("MINUS")) return "danger";
  return "default";
}

function ChainStep({ index, title, value, description, status }) {
  return (
    <div className="da-flow-card">
      <div className="da-flow-number">{index}</div>
      <div>
        <div className="da-flow-title">{title}</div>
        <div className="da-flow-desc">{description}</div>
        <div className="da-flow-status">
          <strong>{value}</strong> · {status || "Tercatat"}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ item, onClick }) {
  return (
    <button type="button" className="da-action-card" onClick={() => onClick(item)}>
      <div className="da-action-card-top">
        <Badge tone={getToneByStatus(item.status)}>{item.status || "Pantau"}</Badge>
        <span className="da-action-arrow">›</span>
      </div>
      <div className="da-action-value">{item.title}</div>
      <div className="da-action-desc">{item.description}</div>
      <div className="da-action-desc" style={{ marginTop: 8, fontWeight: 850 }}>
        {item.amount_label || "-"}
      </div>
    </button>
  );
}

function normalizeSummary(data) {
  return data?.summary || {};
}

function buildChain(summary) {
  return [
    {
      title: "DROP Ayam",
      value: formatRupiah(summary?.chicken?.total_drop_amount || 0),
      description: `${formatNumber(summary?.chicken?.total_drop_kg || 0, "kg")} ayam masuk dari nota aktual.`,
      status: `${formatNumber(summary?.chicken?.drops_count || 0)} nota`,
    },
    {
      title: "Stok Ayam / Lot",
      value: formatNumber(summary?.chicken?.remaining_kg || 0, "kg"),
      description: `${formatNumber(summary?.chicken?.used_kg || 0, "kg")} sudah dipakai produksi.`,
      status: `${formatNumber(summary?.chicken?.active_lots_count || 0)} lot aktif`,
    },
    {
      title: "Produksi / Adukan",
      value: formatNumber(summary?.production?.output_pcs || 0, "pcs"),
      description: `${formatNumber(summary?.production?.total_adukan || 0)} adukan diproses dari lot ayam.`,
      status: `${formatNumber(summary?.production?.batches_count || 0)} batch`,
    },
    {
      title: "Stok Jadi Ready",
      value: formatNumber(summary?.stock?.ready_pcs || 0, "pcs"),
      description: "Barang siap jual dari gerak stok produk jadi, bukan kg ayam mentah.",
      status: formatRupiah(summary?.stock?.stock_value || 0),
    },
    {
      title: "PO Customer",
      value: formatNumber(summary?.po?.po_qty || 0, "pcs"),
      description: "PO hanya menahan stok/kebutuhan. Bukan uang masuk dan bukan invoice.",
      status: `${formatNumber(summary?.po?.shortage_qty || 0, "pcs")} kurang`,
    },
    {
      title: "Kasir / Order",
      value: formatRupiah(summary?.sales?.invoice_total || 0),
      description: "Invoice dan order dari stok ready.",
      status: `${formatNumber(summary?.sales?.orders_count || 0)} order`,
    },
    {
      title: "Uang Masuk",
      value: formatRupiah(summary?.wallet?.money_in || 0),
      description: "Uang aktual yang sudah masuk dompet/bank.",
      status: `${formatNumber(summary?.wallet?.mutation_count || 0)} mutasi`,
    },
    {
      title: "Setoran Cabang",
      value: formatRupiah(summary?.branch?.deposit_pending || 0),
      description: "Pending belum menjadi uang pusat sampai owner/Tangerang approve.",
      status: `${formatNumber(summary?.branch?.deposit_count || 0)} setoran`,
    },
    {
      title: "Hutang Nana",
      value: formatRupiah(summary?.obligations?.hutang_remaining || 0),
      description: "Sisa hutang ayam setelah pembayaran supplier.",
      status: summary?.obligations?.hutang_remaining > 0 ? "Belum Lunas" : "Aman",
    },
    {
      title: "Kewajiban Owner",
      value: formatRupiah(summary?.owner_obligations?.total_remaining || 0),
      description: "Cicilan/tagihan owner yang dibayar lewat Kewajiban Owner → KASOUT → Mutasi Dompet.",
      status: `${formatNumber(summary?.owner_obligations?.active_count || 0)} aktif`,
    },
    {
      title: "HRD / Payroll",
      value: formatRupiah(summary?.payroll?.unpaid_total || 0),
      description: "Payroll closing yang belum dibayar ke karyawan dari dompet.",
      status: `${formatNumber(summary?.payroll?.draft_count || 0)} draft`,
    },
    {
      title: "4 Amplop",
      value: formatRupiah(summary?.amplop?.allocated_total || 0),
      description: "Pembagian hanya dari uang masuk aktual yang bersumber jelas.",
      status: `${formatRupiah(summary?.amplop?.unallocated || 0)} belum dibagi`,
    },
  ];
}

function recentColumns() {
  return [
    { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
    { key: "module", label: "Modul" },
    { key: "id", label: "ID" },
    { key: "description", label: "Keterangan" },
    { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
    { key: "status", label: "Status", render: (row) => <Badge tone={getToneByStatus(row.status)}>{row.status || "Tercatat"}</Badge> },
  ];
}

function OwnerControlShortcut({ icon: Icon, title, description, value, onClick, tone = "default" }) {
  return (
    <button type="button" className={`da-control-shortcut-v4 tone-${tone}`} onClick={onClick}>
      <div className="da-control-shortcut-icon-v4"><Icon size={17} /></div>
      <div className="da-control-shortcut-copy-v4"><span>{title}</span><strong>{value}</strong><small>{description}</small></div>
      <ArrowRight size={15} />
    </button>
  );
}

function OwnerControlChainGroup({ index, title, left, right }) {
  return (
    <div className="da-control-chain-group-v4">
      <div className="da-control-chain-index-v4">{index}</div>
      <div className="da-control-chain-copy-v4">
        <span>{title}</span>
        <div><strong>{left?.value || "-"}</strong><small>{left?.title || "-"}</small></div>
        <div><strong>{right?.value || "-"}</strong><small>{right?.title || "-"}</small></div>
      </div>
    </div>
  );
}

export default function OwnerControlPage({ session, onSessionExpired, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [financeOpen, setFinanceOpen] = useState(false);

  const summary = useMemo(() => normalizeSummary(data), [data]);
  const chain = useMemo(() => buildChain(summary), [summary]);
  const actions = useMemo(() => asArray(data?.action_queue), [data]);
  const recent = useMemo(() => asArray(data?.recent_transactions).slice(0, 10), [data]);
  const health = data?.health || {};

  const loadData = async (options = {}) => {
    setLoading(true);
    setError("");

    const result = await getOwnerControlBootstrap(session?.sessionToken, {
      source: "frontend_operations_ui_v4_owner_control",
      view: "owner_full",
      mode: "owner_full",
      limit: 16,
      cache_seconds: 30,
      skip_health: true,
      force_refresh: Boolean(options.forceRefresh),
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca Owner Control.");
      setData(null);
      setLoading(false);
      return;
    }

    setData(result.data || {});
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  const selectedSupportRows = asArray(selectedAction?.support_rows);
  const displayActions = actions.length ? actions.slice(0, 6) : [{
    title: "Tidak ada tindakan mendesak",
    description: "Belum ada alarm besar dari transaksi aktual.",
    amount_label: "-",
    status: "Aman",
    support_rows: [],
  }];
  const chainGroups = [
    { title: "Pasokan", left: chain[0], right: chain[1] },
    { title: "Produksi", left: chain[2], right: chain[3] },
    { title: "Penjualan", left: chain[4], right: chain[5] },
    { title: "Kas", left: chain[6], right: chain[7] },
    { title: "Kewajiban", left: chain[8], right: chain[9] },
    { title: "SDM & Alokasi", left: chain[10], right: chain[11] },
  ];

  return (
    <div className="da-page da-owner-control-v4">
      <PageHeader
        title="Owner Control"
        description="Control tower untuk memantau rantai usaha, prioritas, posisi keuangan, dan hubungan antar transaksi."
        actions={(
          <div className="da-control-header-actions-v4">
            <Button variant="secondary" onClick={() => setFinanceOpen(true)}><ShieldCheck size={15} /> Integritas Keuangan</Button>
            <Button variant="secondary" onClick={() => loadData({ forceRefresh: true })}><RefreshCw size={15} /> {loading ? "Memuat..." : "Refresh"}</Button>
          </div>
        )}
      />

      {error ? <Card tone="danger"><Badge tone="danger">Data belum terbaca</Badge><p className="da-muted" style={{ marginTop: 10 }}>{error}</p></Card> : null}

      <section className="da-control-hero-grid-v4">
        <div className="da-control-hero-v4">
          <div className="da-control-hero-copy-v4">
            <span className="da-control-kicker-v4">KENDALI USAHA HARI INI</span>
            <h2>Uang, stok, order, hutang, dan payroll dalam satu pandangan.</h2>
            <p>Angka di halaman ini hanya membaca transaksi aktual. Detail teknis dan pemeriksaan integritas dipindahkan ke popup agar halaman utama tetap fokus pada keputusan bisnis.</p>
          </div>
          <div className="da-control-hero-balance-v4">
            <span>Saldo Dompet</span>
            <strong>{formatRupiah(summary?.wallet?.wallet_balance_total || 0)}</strong>
            <small>Uang masuk {formatRupiah(summary?.wallet?.money_in || 0)} · keluar {formatRupiah(summary?.wallet?.money_out || 0)}</small>
          </div>
        </div>

        <div className="da-control-shortcut-grid-v4">
          <OwnerControlShortcut icon={Factory} title="Produksi" value={formatNumber(summary?.production?.output_pcs || 0, "pcs")} description={`${formatNumber(summary?.chicken?.remaining_kg || 0, "kg")} ayam tersisa`} onClick={() => onNavigate?.("produksi-adukan")} />
          <OwnerControlShortcut icon={ShoppingCart} title="Penjualan" value={formatRupiah(summary?.sales?.invoice_total || 0)} description={`${formatNumber(summary?.sales?.orders_count || 0)} order`} onClick={() => onNavigate?.("kasir-order")} />
          <OwnerControlShortcut icon={Banknote} title="Hutang Nana" value={formatRupiah(summary?.obligations?.hutang_remaining || 0)} description="Outstanding supplier ayam" tone={summary?.obligations?.hutang_remaining > 0 ? "warning" : "default"} onClick={() => onNavigate?.("hutang-nana")} />
          <OwnerControlShortcut icon={Users} title="Payroll" value={formatRupiah(summary?.payroll?.unpaid_total || 0)} description={`${formatNumber(summary?.payroll?.draft_count || 0)} draft`} onClick={() => onNavigate?.("hrd-dashboard")} />
        </div>
      </section>

      <section className="da-control-main-grid-v4">
        <Card className="da-control-chain-panel-v4" title="Rantai Nilai Usaha" description="Enam kelompok utama dari pasokan sampai SDM dan alokasi uang.">
          <div className="da-control-chain-grid-v4">
            {chainGroups.map((group, index) => <OwnerControlChainGroup key={group.title} index={index + 1} {...group} />)}
          </div>
        </Card>

        <Card className="da-control-position-panel-v4" title="Posisi Keuangan" description="Angka utama untuk menjaga likuiditas dan kewajiban.">
          <div className="da-control-position-list-v4">
            <button type="button" onClick={() => onNavigate?.("kas-dompet")}><span>Kas & Bank</span><strong>{formatRupiah(summary?.wallet?.wallet_balance_total || 0)}</strong><ArrowRight size={14} /></button>
            <button type="button" onClick={() => onNavigate?.("uang-masuk")}><span>Piutang Terbuka</span><strong>{formatRupiah(summary?.sales?.receivable_open || 0)}</strong><ArrowRight size={14} /></button>
            <button type="button" onClick={() => onNavigate?.("hutang-nana")}><span>Hutang Nana</span><strong>{formatRupiah(summary?.obligations?.hutang_remaining || 0)}</strong><ArrowRight size={14} /></button>
            <button type="button" onClick={() => onNavigate?.("kewajiban-owner")}><span>Kewajiban Owner</span><strong>{formatRupiah(summary?.owner_obligations?.total_remaining || 0)}</strong><ArrowRight size={14} /></button>
            <button type="button" onClick={() => onNavigate?.("empat-amplop")}><span>Belum Dibagi 4 Amplop</span><strong>{formatRupiah(summary?.amplop?.unallocated || 0)}</strong><ArrowRight size={14} /></button>
          </div>
        </Card>
      </section>

      <section className="da-control-action-grid-v4">
        <Card title="Perlu Tindakan" description="Prioritas yang berasal dari transaksi aktual. Klik untuk membuka rincian pendukung.">
          <div className="da-control-action-list-v4">
            {displayActions.map((item, index) => <ActionCard key={`${item.title}-${index}`} item={item} onClick={setSelectedAction} />)}
          </div>
        </Card>

        <Card title="Ringkasan Operasi" description="Posisi stok, PO, cabang, dan kewajiban dalam format ringkas.">
          <div className="da-control-ops-grid-v4">
            <div><Package size={16} /><span>Stok Ready</span><strong>{formatNumber(summary?.stock?.ready_pcs || 0, "pcs")}</strong></div>
            <div><Boxes size={16} /><span>Sisa Ayam</span><strong>{formatNumber(summary?.chicken?.remaining_kg || 0, "kg")}</strong></div>
            <div><ShoppingCart size={16} /><span>PO Aktif</span><strong>{formatNumber(summary?.po?.po_count || 0)}</strong></div>
            <div><Activity size={16} /><span>Setoran Pending</span><strong>{formatRupiah(summary?.branch?.deposit_pending || 0)}</strong></div>
            <div><Wallet size={16} /><span>Uang Keluar</span><strong>{formatRupiah(summary?.wallet?.money_out || 0)}</strong></div>
            <div><ShieldCheck size={16} /><span>Integritas Sistem</span><strong>{health?.status || "Aktif"}</strong></div>
          </div>
        </Card>
      </section>

      <Card className="da-control-recent-v4" title="Transaksi Terbaru" description="Jejak transaksi terakhir. Arsip Digital tetap menjadi pintu detail lengkap." action={onNavigate ? <Button variant="secondary" onClick={() => onNavigate("arsip-digital")}>Buka Arsip</Button> : null}>
        <DataTable columns={recentColumns()} rows={recent} getRowKey={(row, index) => `${row.module}-${row.id}-${index}`} onRowClick={() => onNavigate?.("arsip-digital")} />
      </Card>

      <Modal open={financeOpen} title="Integritas Keuangan" subtitle="Pemeriksaan wallet, mutasi, alokasi, dan jejak transaksi." onClose={() => setFinanceOpen(false)} size="xl">
        <div className="da-control-finance-modal-v4"><FinanceLockPanel session={session} onSessionExpired={onSessionExpired} /></div>
      </Modal>

      <Modal open={Boolean(selectedAction)} title={selectedAction?.title || "Detail Tindakan"} subtitle={selectedAction?.description || "Rincian sumber transaksi."} onClose={() => setSelectedAction(null)} size="xl">
        <div className="da-control-action-modal-summary-v4">
          <div><span>Status</span><strong>{selectedAction?.status || "-"}</strong></div>
          <div><span>Nominal</span><strong>{selectedAction?.amount_label || "-"}</strong></div>
        </div>
        <DataTable
          columns={[
            { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
            { key: "id", label: "ID" },
            { key: "name", label: "Nama/Sumber" },
            { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
            { key: "status", label: "Status" },
          ]}
          rows={selectedSupportRows}
          getRowKey={(row, index) => `${row.id}-${index}`}
        />
      </Modal>
    </div>
  );
}
