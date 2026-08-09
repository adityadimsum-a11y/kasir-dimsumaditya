import { useEffect, useMemo, useState } from "react";
import {
  createAmplopAllocation,
  getAmplopBootstrap,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import FinanceSnapshot from "./FinanceSnapshot";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";

const DEFAULT_ENVELOPES = [
  { envelope_code: "AYAM", envelope_name: "Amplop Ayam", percentage: 0, amount: 0 },
  { envelope_code: "OPERASIONAL", envelope_name: "Amplop Operasional", percentage: 0, amount: 0 },
  { envelope_code: "CICILAN", envelope_name: "Amplop Cicilan & Hutang", percentage: 0, amount: 0 },
  { envelope_code: "OWNER", envelope_name: "Amplop Owner", percentage: 0, amount: 0 },
];

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

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

function isRealId(value) {
  const text = String(value || "").trim();
  if (!text || text === "-") return false;
  if (/^TAB[A-Z_]*-ROW-\d+$/i.test(text)) return false;
  return true;
}

function normalizeEnvelope(row) {
  return {
    envelope_code: safeText(row.envelope_code || row.code, "").toUpperCase(),
    envelope_name: row.envelope_name || row.name || row.label || "Amplop",
    percentage: numberValue(row.percentage || row.percent || 0),
    amount: numberValue(row.amount || row.saldo || row.balance || 0),
    allocated_amount: numberValue(row.allocated_amount || row.total_in || row.masuk || row.amount || 0),
    used_amount: numberValue(row.used_amount || row.total_out || row.keluar || 0),
    balance: numberValue(row.balance || row.saldo || row.amount || 0),
  };
}

function normalizeIncome(row) {
  const mutationId = row.mutation_id || row.wallet_mutation_id || row.id || "";
  return {
    ...row,
    mutation_id: mutationId,
    mutation_date: row.mutation_date || row.date || row.created_at || "",
    wallet_id: row.wallet_id || "",
    wallet_name: row.wallet_name || row.name || "Dompet",
    amount: numberValue(row.amount || row.nominal || 0),
    source_module: row.source_module || row.source_type || "-",
    source_id: row.source_id || row.ref_id || "",
    status: row.status || "Tercatat",
    allocated: row.allocated === true || String(row.allocated || "").toLowerCase() === "true",
    needs_source: row.needs_source === true || String(row.needs_source || "").toLowerCase() === "true" || !safeText(row.source_id || row.ref_id, ""),
  };
}

function normalizeAllocation(row) {
  const allocationId = row.allocation_id || row.id || "";
  return {
    ...row,
    allocation_id: allocationId,
    allocation_line_id: row.allocation_line_id || row.line_id || "",
    allocation_date: row.allocation_date || row.date || row.created_at || "",
    period: row.period || "",
    envelope_code: row.envelope_code || "",
    envelope_name: row.envelope_name || "Amplop",
    percentage: numberValue(row.percentage || 0),
    amount: numberValue(row.amount || 0),
    source_total_amount: numberValue(row.source_total_amount || 0),
    source_mutation_ids: row.source_mutation_ids || "",
    status: row.status || "Active",
    notes: row.notes || "",
  };
}

function normalizeLedger(row) {
  return {
    ...row,
    ledger_id: row.ledger_id || row.id || "",
    allocation_id: row.allocation_id || "",
    ledger_date: row.ledger_date || row.date || row.created_at || "",
    period: row.period || "",
    envelope_code: row.envelope_code || "",
    envelope_name: row.envelope_name || "Amplop",
    direction: String(row.direction || "IN").toUpperCase(),
    amount: numberValue(row.amount || 0),
    source_module: row.source_module || "-",
    source_id: row.source_id || "",
    status: row.status || "Active",
    notes: row.notes || "",
  };
}

function normalizeBootstrap(payload) {
  const data = payload?.data || payload || {};
  const summary = data.summary || {};

  const envelopes = asArray(data.envelope_balances || data.amplop_balances || data.envelopes)
    .map(normalizeEnvelope)
    .filter((row) => row.envelope_code);

  const templates = asArray(data.envelope_templates || data.amplop_templates || data.presets)
    .map(normalizeEnvelope)
    .filter((row) => row.envelope_code);

  const eligibleIncome = asArray(data.eligible_income || data.unallocated_income_mutations)
    .map(normalizeIncome)
    .filter((row) => isRealId(row.mutation_id) && row.amount > 0 && !row.needs_source && !row.allocated);

  const incomeNeedSource = asArray(data.income_need_source || data.mutations_need_source || [])
    .map(normalizeIncome)
    .filter((row) => isRealId(row.mutation_id) && row.amount > 0);

  const allIncome = asArray(data.income_mutations || data.all_income_mutations || [])
    .map(normalizeIncome)
    .filter((row) => isRealId(row.mutation_id) && row.amount > 0);

  const allocations = asArray(data.allocations || data.amplop_allocations)
    .map(normalizeAllocation)
    .filter((row) => isRealId(row.allocation_id) && row.amount > 0);

  const ledger = asArray(data.ledger || data.amplop_ledger)
    .map(normalizeLedger)
    .filter((row) => isRealId(row.ledger_id) && row.amount > 0);

  return {
    summary: {
      total_income: numberValue(summary.total_income || summary.uang_masuk || 0),
      allocated_income: numberValue(summary.allocated_income || summary.sudah_dibagi || 0),
      unallocated_income: numberValue(summary.unallocated_income || summary.belum_dibagi || 0),
      income_need_source: numberValue(summary.income_need_source || summary.perlu_sumber_amount || 0),
      need_source_count: numberValue(summary.need_source_count || 0),
      allocation_count: numberValue(summary.allocation_count || 0),
      allocation_line_count: numberValue(summary.allocation_line_count || allocations.length),
      source_count: numberValue(summary.source_count || 0),
      envelope_balance: numberValue(summary.envelope_balance || summary.total_saldo_amplop || 0),
      hidden_rows: numberValue(summary.hidden_rows || 0),
    },
    envelope_templates: templates.length ? templates : DEFAULT_ENVELOPES,
    envelope_balances: envelopes.length ? envelopes : DEFAULT_ENVELOPES,
    eligible_income: eligibleIncome,
    income_need_source: incomeNeedSource,
    income_mutations: allIncome,
    allocations,
    ledger,
  };
}

function formatNumberInput(value) {
  const number = numberValue(value);
  return number ? String(number) : "";
}

function splitIdText(value) {
  return String(value || "")
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildOperationId() {
  return `AMPLOP-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function EmpatAmplopPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bootstrap, setBootstrap] = useState(() => normalizeBootstrap({}));
  const [activeDetail, setActiveDetail] = useState(null);
  const [filter, setFilter] = useState("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [form, setForm] = useState({ allocation_date: todayInputValue(), period: currentMonthValue(), notes: "Pembagian uang masuk aktual ke 4 amplop" });
  const sessionToken = session?.sessionToken || "";

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAmplopBootstrap(sessionToken, { period: form.period });
      if (isAuthRequired(result)) { onSessionExpired?.(); return; }
      if (!result?.success) { setError(result?.message || "Gagal membaca data 4 Amplop."); return; }
      const normalized = normalizeBootstrap(result.data || result);
      setBootstrap(normalized);
      const validIds = new Set(normalized.eligible_income.map((row) => row.mutation_id));
      setSelectedSourceIds((current) => current.filter((id) => validIds.has(id)));
    } catch (err) {
      setError(err?.message || "Gagal membaca data 4 Amplop.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (sessionToken) loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sessionToken]);

  const selectedSources = useMemo(() => bootstrap.eligible_income.filter((row) => selectedSourceIds.includes(row.mutation_id)), [bootstrap.eligible_income, selectedSourceIds]);
  const selectedTotal = useMemo(() => selectedSources.reduce((sum, row) => sum + numberValue(row.amount), 0), [selectedSources]);
  const previewLines = useMemo(() => {
    const templates = bootstrap.envelope_templates;
    const totals = templates.map((row) => ({ ...row, amount: 0 }));
    const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    selectedSources.forEach((source) => {
      let running = 0;
      const amounts = templates.map((line) => { const amount = round2(numberValue(source.amount) * numberValue(line.percentage) / 100); running = round2(running + amount); return amount; });
      if (amounts.length) amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + round2(numberValue(source.amount) - running));
      amounts.forEach((amount, index) => { if (totals[index]) totals[index].amount = round2(numberValue(totals[index].amount) + amount); });
    });
    return totals;
  }, [bootstrap.envelope_templates, selectedSources]);

  const toggleSource = (id) => setSelectedSourceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectAll = () => setSelectedSourceIds((current) => current.length === bootstrap.eligible_income.length ? [] : bootstrap.eligible_income.map((row) => row.mutation_id));
  const presetTotal = useMemo(() => bootstrap.envelope_templates.reduce((sum, row) => sum + numberValue(row.percentage), 0), [bootstrap.envelope_templates]);
  const presetReady = bootstrap.envelope_templates.length > 0 && Math.abs(presetTotal - 100) < 0.0001;
  const canSave = selectedSourceIds.length > 0 && selectedTotal > 0 && presetReady && !saving;

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!canSave) {
      setError(!presetReady ? "Preset 4 Amplop aktif belum siap atau total persentasenya belum 100%." : "Pilih minimal satu sumber uang masuk yang akan dibagi.");
      setConfirmOpen(false);
      return;
    }
    setSaving(true);
    try {
      const result = await createAmplopAllocation(sessionToken, {
        operation_id: buildOperationId(),
        allocation_date: form.allocation_date,
        period: form.period,
        source_mutation_ids: selectedSourceIds,
        notes: form.notes,
      });
      if (isAuthRequired(result)) { onSessionExpired?.(); return; }
      if (!result?.success) { setError(result?.message || "Gagal menyimpan pembagian 4 Amplop."); return; }
      setSuccess(result.message || "Pembagian 4 Amplop berhasil disimpan.");
      setSelectedSourceIds([]);
      setConfirmOpen(false);
      await loadData();
    } catch (err) { setError(err?.message || "Gagal menyimpan pembagian 4 Amplop."); }
    finally { setSaving(false); }
  };

  const filteredAllocations = useMemo(() => {
    const rows = bootstrap.allocations;
    if (filter === "ayam") return rows.filter((row) => String(row.envelope_code).toUpperCase() === "AYAM");
    if (filter === "operasional") return rows.filter((row) => String(row.envelope_code).toUpperCase() === "OPERASIONAL");
    if (filter === "cicilan") return rows.filter((row) => String(row.envelope_code).toUpperCase() === "CICILAN");
    if (filter === "owner") return rows.filter((row) => String(row.envelope_code).toUpperCase() === "OWNER");
    return rows;
  }, [bootstrap.allocations, filter]);

  const detailSourceIds = activeDetail ? splitIdText(activeDetail.source_mutation_ids) : [];
  const detailSourceRows = activeDetail ? bootstrap.income_mutations.filter((row) => detailSourceIds.includes(row.mutation_id)) : [];
  const detailLedgerRows = activeDetail ? bootstrap.ledger.filter((row) => row.allocation_id === activeDetail.allocation_id) : [];

  return (
    <div className="da-finance-page">
      <PageHeader
        eyebrow="Uang & Kewajiban"
        title="4 Amplop"
        description="Alokasikan uang yang benar-benar sudah masuk ke empat pos pengelolaan usaha. Persentase mengikuti preset aktif dan tidak diubah dari transaksi pembagian."
        actions={<div className="da-actions"><Button variant="ghost" onClick={loadData} disabled={loading || saving}>{loading ? "Memuat..." : "Perbarui"}</Button><Button onClick={() => setConfirmOpen(true)} disabled={!canSave}>Bagi Uang Terpilih</Button></div>}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}

      <FinanceSnapshot
        eyebrow="Dana Siap Dialokasikan"
        value={loading ? "..." : formatRupiah(bootstrap.summary.unallocated_income)}
        caption={`${bootstrap.summary.source_count || 0} sumber uang masuk siap dibagi berdasarkan preset aktif.`}
        metrics={[
          { label: "Saldo 4 Amplop", value: loading ? "..." : formatRupiah(bootstrap.summary.envelope_balance), helper: "Saldo catatan seluruh pos", tone: "success" },
          { label: "Sudah Dialokasikan", value: loading ? "..." : formatRupiah(bootstrap.summary.allocated_income), helper: `${bootstrap.summary.allocation_count || 0} sumber sudah dibagi` },
          { label: "Perlu Referensi", value: loading ? "..." : formatRupiah(bootstrap.summary.income_need_source), helper: `${bootstrap.summary.need_source_count || 0} transaksi perlu dilengkapi`, tone: bootstrap.summary.need_source_count > 0 ? "warning" : "success" },
        ]}
      />

      <div className="da-envelope-balance-grid">
        {bootstrap.envelope_balances.map((row) => <Card key={row.envelope_code} className="da-envelope-balance-card"><div className="da-page-kicker">{row.envelope_name}</div><div className="da-big-text">{formatRupiah(row.balance)}</div><div className="da-muted">Masuk {formatRupiah(row.allocated_amount || row.amount)} · Terpakai {formatRupiah(row.used_amount)}</div></Card>)}
      </div>

      <div className="da-finance-workspace">
        <Card className="da-finance-main-card">
          <div className="da-section-heading">
            <div><div className="da-page-kicker">Sumber Uang Masuk</div><h2 style={{ margin: "4px 0 6px" }}>Pilih Uang yang Akan Dibagi</h2><p className="da-muted" style={{ margin: 0 }}>Hanya uang masuk yang mempunyai sumber transaksi dan belum pernah dialokasikan.</p></div>
            <Button variant="ghost" onClick={selectAll} disabled={!bootstrap.eligible_income.length}>{selectedSourceIds.length === bootstrap.eligible_income.length && bootstrap.eligible_income.length ? "Kosongkan Pilihan" : "Pilih Semua"}</Button>
          </div>
          <div className="da-envelope-source-list">
            {bootstrap.eligible_income.map((row) => <label key={row.mutation_id} className={`da-envelope-source-item ${selectedSourceIds.includes(row.mutation_id) ? "selected" : ""}`}><input type="checkbox" checked={selectedSourceIds.includes(row.mutation_id)} onChange={() => toggleSource(row.mutation_id)} /><div><strong>{safeText(row.source_id || row.source_module)}</strong><span>{formatDisplayDate(row.mutation_date)} · {safeText(row.wallet_name)}</span></div><strong>{formatRupiah(row.amount)}</strong></label>)}
            {!loading && bootstrap.eligible_income.length === 0 ? <div className="da-finance-empty">Belum ada uang masuk yang siap dibagi.</div> : null}
          </div>
          {bootstrap.income_need_source.length ? <div className="da-alert da-alert-warning">Ada {bootstrap.income_need_source.length} mutasi uang masuk yang belum mempunyai sumber transaksi. Mutasi tersebut belum dapat masuk 4 Amplop.</div> : null}
        </Card>

        <Card className="da-finance-side-card">
          <div className="da-page-kicker">Preview Preset Aktif</div><h2 style={{ margin: "6px 0 6px" }}>Pembagian Otomatis</h2><p className="da-muted">Persentase dikunci oleh preset Owner. Sistem membagi setiap sumber secara otomatis saat disimpan.</p>{!presetReady ? <div className="da-alert da-alert-warning">Preset aktif belum siap. Atur total persentase menjadi 100% sebelum melakukan pembagian.</div> : null}
          <div className="da-finance-hero-number da-finance-hero-number-dark"><span>Total dipilih</span><strong>{formatRupiah(selectedTotal)}</strong><small>{selectedSourceIds.length} sumber uang masuk</small></div>
          <div className="da-envelope-preview-list">{previewLines.map((row) => <div key={row.envelope_code}><span><strong>{row.envelope_name}</strong><small>{numberValue(row.percentage)}%</small></span><strong>{formatRupiah(row.amount)}</strong></div>)}</div>
          <div className="da-finance-note">Nilai akhir mengikuti pembulatan backend per sumber. Tidak ada saldo bank baru yang dibuat; 4 Amplop adalah ledger alokasi dari uang yang sudah masuk.</div>
          <Button onClick={() => setConfirmOpen(true)} disabled={!canSave}>Bagi Uang Terpilih</Button>
        </Card>
      </div>

      <Card className="da-finance-ledger-card">
        <div className="da-section-heading"><div><div className="da-page-kicker">Riwayat Pembagian</div><h2 style={{ margin: "4px 0 6px" }}>Alokasi yang Sudah Dicatat</h2><p className="da-muted" style={{ margin: 0 }}>Klik baris untuk melihat sumber uang dan ledger amplop.</p></div></div>
        <div className="da-finance-tabs">{[["all","Semua"],["ayam","Ayam"],["operasional","Operasional"],["cicilan","Cicilan"],["owner","Owner"]].map(([key,label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div>
        <DataTable columns={[{ key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.allocation_date) }, { key: "id", label: "Allocation ID", render: (row) => <strong>{row.allocation_id}</strong> }, { key: "amplop", label: "Amplop", render: (row) => row.envelope_name }, { key: "persen", label: "%", render: (row) => `${numberValue(row.percentage)}%` }, { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) }, { key: "status", label: "Status", render: (row) => <Badge tone="success">{row.status}</Badge> }]} rows={filteredAllocations} getRowKey={(row, index) => row.allocation_line_id || `${row.allocation_id}-${index}`} onRowClick={setActiveDetail} />
        {!loading && filteredAllocations.length === 0 ? <div className="da-finance-empty">Belum ada riwayat pembagian.</div> : null}
      </Card>

      <Modal open={confirmOpen} title="Konfirmasi Pembagian 4 Amplop" subtitle={`${selectedSourceIds.length} sumber · ${formatRupiah(selectedTotal)}`} onClose={() => !saving && setConfirmOpen(false)}>
        <div className="da-finance-modal-panel">
          <div className="da-finance-modal-form"><label className="da-field"><span>Tanggal Pembagian</span><input type="date" value={form.allocation_date} onChange={(event) => setForm((current) => ({ ...current, allocation_date: event.target.value }))} /></label><label className="da-field"><span>Periode</span><input type="month" value={form.period} onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))} /></label><label className="da-field da-finance-span-2"><span>Catatan</span><input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label></div>
          <div className="da-envelope-preview-list da-finance-section-gap">{previewLines.map((row) => <div key={row.envelope_code}><span><strong>{row.envelope_name}</strong><small>{numberValue(row.percentage)}%</small></span><strong>{formatRupiah(row.amount)}</strong></div>)}</div>
          <div className="da-form-actions"><Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>Batal</Button><Button onClick={handleSubmit} disabled={!canSave}>{saving ? "Menyimpan..." : "Simpan Pembagian"}</Button></div>
        </div>
      </Modal>

      <Modal open={Boolean(activeDetail)} title="Detail Pembagian 4 Amplop" subtitle={activeDetail?.allocation_id} onClose={() => setActiveDetail(null)}>
        {activeDetail ? <div className="da-finance-modal-panel">
          <div className="da-modal-summary"><div><div className="da-mini-title">{activeDetail.envelope_name}</div><div className="da-big-text">{formatRupiah(activeDetail.amount)}</div><p className="da-muted">{numberValue(activeDetail.percentage)}% · {formatDisplayDate(activeDetail.allocation_date)}</p></div><Badge tone="success">{activeDetail.status}</Badge></div>
          <div className="da-finance-detail-section"><h3>Sumber Uang</h3><DataTable columns={[{ key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.mutation_date) }, { key: "id", label: "Mutasi ID", render: (row) => <strong>{row.mutation_id}</strong> }, { key: "dompet", label: "Dompet", render: (row) => safeText(row.wallet_name) }, { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) }, { key: "sumber", label: "Sumber", render: (row) => safeText(row.source_id || row.source_module) }]} rows={detailSourceRows} getRowKey={(row, index) => row.mutation_id || index} /></div>
          <div className="da-finance-detail-section"><h3>Ledger Amplop</h3><DataTable columns={[{ key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.ledger_date) }, { key: "id", label: "Ledger ID", render: (row) => <strong>{row.ledger_id}</strong> }, { key: "amplop", label: "Amplop", render: (row) => row.envelope_name }, { key: "arah", label: "Arah", render: (row) => <Badge tone={row.direction === "OUT" ? "warning" : "success"}>{row.direction}</Badge> }, { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) }]} rows={detailLedgerRows} getRowKey={(row, index) => row.ledger_id || index} /></div>
        </div> : null}
      </Modal>
    </div>
  );
}
