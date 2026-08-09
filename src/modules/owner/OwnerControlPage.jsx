import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Banknote,
  Boxes,
  Factory,
  RefreshCw,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { getOwnerControlBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
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

function getToneByStatus(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("AMAN") || text.includes("SEHAT") || text.includes("LUNAS") || text.includes("READY")) return "success";
  if (text.includes("PERLU") || text.includes("BELUM") || text.includes("WARNING") || text.includes("KURANG") || text.includes("JATUH")) return "warning";
  if (text.includes("BAHAYA") || text.includes("ERROR") || text.includes("MINUS") || text.includes("GAGAL")) return "danger";
  return "default";
}

function MetricCard({ label, value, helper, icon: Icon, tone = "default", onClick }) {
  return (
    <button type="button" className={`da-owner-v5-metric tone-${tone}`} onClick={onClick}>
      <div className="da-owner-v5-metric-head">
        <span>{label}</span>
        <div className="da-owner-v5-metric-icon"><Icon size={17} /></div>
      </div>
      <strong>{value}</strong>
      <small>{helper}</small>
    </button>
  );
}

function BusinessPanel({ icon: Icon, title, subtitle, metrics = [], actionLabel, onClick }) {
  return (
    <section className="da-owner-v5-business-card">
      <div className="da-owner-v5-business-head">
        <div className="da-owner-v5-business-title">
          <span className="da-owner-v5-business-icon"><Icon size={17} /></span>
          <div><strong>{title}</strong><small>{subtitle}</small></div>
        </div>
        <button type="button" onClick={onClick}>{actionLabel}<ArrowRight size={14} /></button>
      </div>
      <div className="da-owner-v5-business-metrics">
        {metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.note ? <small>{item.note}</small> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function PriorityRow({ item, onClick }) {
  return (
    <button type="button" className="da-owner-v5-priority" onClick={() => onClick(item)}>
      <span className={`da-owner-v5-priority-dot tone-${getToneByStatus(item.status)}`} />
      <div>
        <strong>{item.title || "Perlu ditinjau"}</strong>
        <small>{item.description || "Buka rincian untuk melihat sumbernya."}</small>
      </div>
      <div className="da-owner-v5-priority-value">
        <b>{item.amount_label || "-"}</b>
        <Badge tone={getToneByStatus(item.status)}>{item.status || "Pantau"}</Badge>
      </div>
      <ArrowRight size={15} />
    </button>
  );
}

function FlowStage({ no, label, value, note }) {
  return (
    <div className="da-owner-v5-flow-stage">
      <span className="da-owner-v5-flow-no">{no}</span>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </div>
  );
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

export default function OwnerControlPage({ session, onSessionExpired, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);

  const summary = useMemo(() => data?.summary || {}, [data]);
  const actions = useMemo(() => asArray(data?.action_queue), [data]);
  const recent = useMemo(() => asArray(data?.recent_transactions).slice(0, 8), [data]);

  const loadData = async (options = {}) => {
    setLoading(true);
    setError("");

    const result = await getOwnerControlBootstrap(session?.sessionToken, {
      source: "owner_control",
      view: "owner_full",
      mode: "owner_full",
      limit: 12,
      cache_seconds: 30,
      skip_health: true,
      force_refresh: Boolean(options.forceRefresh),
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Data kendali usaha belum dapat dibaca.");
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

  const walletBalance = numberValue(summary?.wallet?.wallet_balance_total);
  const moneyIn = numberValue(summary?.wallet?.money_in);
  const moneyOut = numberValue(summary?.wallet?.money_out);
  const salesTotal = numberValue(summary?.sales?.invoice_total);
  const receivable = numberValue(summary?.sales?.receivable_open);
  const hutangNana = numberValue(summary?.obligations?.hutang_remaining);
  const ownerDue = numberValue(summary?.owner_obligations?.due_this_month);
  const payrollDue = numberValue(summary?.payroll?.unpaid_total);
  const stockReady = numberValue(summary?.stock?.ready_pcs);
  const chickenRemain = numberValue(summary?.chicken?.remaining_kg);
  const productionOutput = numberValue(summary?.production?.output_pcs);
  const poQty = numberValue(summary?.po?.po_qty);
  const poShortage = numberValue(summary?.po?.shortage_qty);
  const depositPending = numberValue(summary?.branch?.deposit_pending);
  const requestPending = numberValue(summary?.branch?.request_pending_count);
  const unallocated = numberValue(summary?.amplop?.unallocated);

  const priorityRows = actions.slice(0, 5);
  const selectedSupportRows = asArray(selectedAction?.support_rows);
  const netCashFlow = moneyIn - moneyOut;

  return (
    <div className="da-page da-owner-control-v5">
      <PageHeader
        title="Kendali Usaha"
        description="Pantau posisi uang, produksi, penjualan, persediaan, kewajiban, cabang, dan payroll dalam satu ruang kerja."
        actions={(
          <Button variant="secondary" onClick={() => loadData({ forceRefresh: true })}>
            <RefreshCw size={15} /> {loading ? "Memuat..." : "Perbarui"}
          </Button>
        )}
      />

      {error ? <Card tone="danger"><Badge tone="danger">Data belum tersedia</Badge><p className="da-muted" style={{ marginTop: 10 }}>{error}</p></Card> : null}

      <section className="da-owner-v5-metric-grid">
        <MetricCard label="Kas & Bank" value={loading ? "..." : formatRupiah(walletBalance)} helper={`Arus bersih ${formatRupiah(netCashFlow)} · ${formatNumber(summary?.wallet?.mutation_count || 0)} mutasi`} icon={Wallet} onClick={() => onNavigate?.("kas-dompet")} />
        <MetricCard label="Penjualan" value={loading ? "..." : formatRupiah(salesTotal)} helper={`Piutang ${formatRupiah(receivable)}`} icon={ShoppingCart} onClick={() => onNavigate?.("kasir-order")} />
        <MetricCard label="Hutang Supplier" value={loading ? "..." : formatRupiah(hutangNana)} helper="Posisi Hutang Nana" icon={Banknote} tone={hutangNana > 0 ? "warning" : "success"} onClick={() => onNavigate?.("hutang-nana")} />
        <MetricCard label="Jatuh Tempo" value={loading ? "..." : formatRupiah(ownerDue + payrollDue)} helper={`Kewajiban ${formatRupiah(ownerDue)} · Payroll ${formatRupiah(payrollDue)}`} icon={Activity} tone={(ownerDue + payrollDue) > 0 ? "warning" : "success"} onClick={() => onNavigate?.("kewajiban-owner")} />
      </section>

      <section className="da-owner-v5-main-grid">
        <div className="da-owner-v5-business-grid">
          <BusinessPanel
            icon={Factory}
            title="Produksi & Persediaan"
            subtitle="Ketersediaan bahan dan hasil produksi."
            actionLabel="Buka Produksi"
            onClick={() => onNavigate?.("produksi-adukan")}
            metrics={[
              { label: "Sisa Ayam", value: formatNumber(chickenRemain, "kg") },
              { label: "Hasil Produksi", value: formatNumber(productionOutput, "pcs") },
              { label: "Stok Siap Jual", value: formatNumber(stockReady, "pcs") },
            ]}
          />
          <BusinessPanel
            icon={ShoppingCart}
            title="Penjualan & PO"
            subtitle="Order, kebutuhan stok, dan penagihan."
            actionLabel="Buka Penjualan"
            onClick={() => onNavigate?.("kasir-order")}
            metrics={[
              { label: "Nilai Penjualan", value: formatRupiah(salesTotal) },
              { label: "PO Customer", value: formatNumber(poQty, "pcs") },
              { label: "Kekurangan PO", value: formatNumber(poShortage, "pcs") },
            ]}
          />
          <BusinessPanel
            icon={Banknote}
            title="Kas & Kewajiban"
            subtitle="Likuiditas dan pembayaran yang harus dijaga."
            actionLabel="Buka Keuangan"
            onClick={() => onNavigate?.("kas-dompet")}
            metrics={[
              { label: "Saldo Dompet", value: formatRupiah(walletBalance) },
              { label: "Hutang Nana", value: formatRupiah(hutangNana) },
              { label: "Belum Dialokasikan", value: formatRupiah(unallocated) },
            ]}
          />
          <BusinessPanel
            icon={Users}
            title="Cabang & SDM"
            subtitle="Setoran cabang, permintaan barang, dan payroll."
            actionLabel="Buka HRD"
            onClick={() => onNavigate?.("hrd-dashboard")}
            metrics={[
              { label: "Setoran Pending", value: formatRupiah(depositPending) },
              { label: "Request Cabang", value: formatNumber(requestPending) },
              { label: "Payroll Belum Dibayar", value: formatRupiah(payrollDue) },
            ]}
          />
        </div>

        <Card className="da-owner-v5-priority-card" title="Prioritas Owner" description="Tindak lanjut yang perlu diperiksa berdasarkan transaksi usaha.">
          <div className="da-owner-v5-priority-list">
            {priorityRows.length ? (
              priorityRows.map((item, index) => (
                <PriorityRow key={`${item.code || item.title}-${index}`} item={item} onClick={setSelectedAction} />
              ))
            ) : (
              <div className="da-owner-v8-empty-priority">
                <span className="da-owner-v8-empty-dot" />
                <div>
                  <strong>Belum ada prioritas yang perlu ditindak</strong>
                  <small>Daftar ini akan terisi otomatis saat transaksi nyata memerlukan perhatian Owner.</small>
                </div>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="da-owner-v5-lower-grid">
        <Card title="Alur Operasional" description="Ringkasan perjalanan barang dan uang hari ini.">
          <div className="da-owner-v5-flow">
            <FlowStage no="01" label="Pasokan" value={formatNumber(summary?.chicken?.total_drop_kg || 0, "kg")} note="Ayam masuk" />
            <FlowStage no="02" label="Produksi" value={formatNumber(productionOutput, "pcs")} note="Hasil produksi" />
            <FlowStage no="03" label="Persediaan" value={formatNumber(stockReady, "pcs")} note="Siap dijual" />
            <FlowStage no="04" label="Penjualan" value={formatRupiah(salesTotal)} note={`${formatNumber(summary?.sales?.orders_count || 0)} order`} />
            <FlowStage no="05" label="Penerimaan" value={formatRupiah(moneyIn)} note="Uang masuk" />
          </div>
        </Card>

        <Card title="Arus Dana" description="Posisi penerimaan, pengeluaran, dan dana yang belum dialokasikan.">
          <div className="da-owner-v5-cash-list">
            <button type="button" onClick={() => onNavigate?.("uang-masuk")}><span>Uang Masuk</span><strong>{formatRupiah(moneyIn)}</strong><ArrowRight size={14} /></button>
            <button type="button" onClick={() => onNavigate?.("kas-keluar")}><span>Uang Keluar</span><strong>{formatRupiah(moneyOut)}</strong><ArrowRight size={14} /></button>
            <button type="button" onClick={() => onNavigate?.("empat-amplop")}><span>Belum Dialokasikan</span><strong>{formatRupiah(unallocated)}</strong><ArrowRight size={14} /></button>
            <button type="button" onClick={() => onNavigate?.("setoran-cabang")}><span>Setoran Cabang Pending</span><strong>{formatRupiah(depositPending)}</strong><ArrowRight size={14} /></button>
          </div>
        </Card>
      </section>

      <Card className="da-owner-v5-recent" title="Aktivitas Terbaru" description="Transaksi terbaru yang tercatat di sistem." action={<Button variant="secondary" onClick={() => onNavigate?.("arsip-digital")}>Buka Arsip</Button>}>
        <DataTable columns={recentColumns()} rows={recent} getRowKey={(row, index) => `${row.module}-${row.id}-${index}`} onRowClick={() => onNavigate?.("arsip-digital")} />
      </Card>

      <Modal
        open={Boolean(selectedAction)}
        title={selectedAction?.title || "Rincian Prioritas"}
        subtitle={selectedAction?.description || "Rincian transaksi yang memerlukan perhatian."}
        onClose={() => setSelectedAction(null)}
        size="xl"
      >
        <div className="da-owner-v5-modal-summary">
          <div><span>Status</span><strong>{selectedAction?.status || "-"}</strong></div>
          <div><span>Nilai</span><strong>{selectedAction?.amount_label || "-"}</strong></div>
        </div>
        {selectedSupportRows.length ? (
          <DataTable
            columns={[
              { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
              { key: "id", label: "ID" },
              { key: "name", label: "Sumber" },
              { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
              { key: "status", label: "Status" },
            ]}
            rows={selectedSupportRows}
            getRowKey={(row, index) => `${row.id}-${index}`}
          />
        ) : (
          <div className="da-owner-v8-action-note">
            <strong>Ringkasan tindakan</strong>
            <p>{selectedAction?.description || "Belum ada rincian transaksi tambahan untuk prioritas ini."}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
