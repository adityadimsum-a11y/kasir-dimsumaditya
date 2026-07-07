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
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";

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
    allocated_amount: numberValue(row.allocated_amount || row.masuk || row.amount || 0),
    used_amount: numberValue(row.used_amount || row.keluar || 0),
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

  const [form, setForm] = useState({
    allocation_date: todayInputValue(),
    period: currentMonthValue(),
    total_amount: 0,
    notes: "Pembagian uang masuk aktual ke 4 amplop",
  });

  const [lines, setLines] = useState(DEFAULT_ENVELOPES);
  const sessionToken = session?.sessionToken || "";

  const selectedSourceIds = useMemo(() => {
    return bootstrap.eligible_income.map((row) => row.mutation_id).filter(Boolean);
  }, [bootstrap.eligible_income]);

  const splitTotal = useMemo(() => {
    return lines.reduce((total, row) => total + numberValue(row.amount), 0);
  }, [lines]);

  const remainingSplit = numberValue(form.total_amount) - splitTotal;
  const canSave =
    numberValue(form.total_amount) > 0 &&
    selectedSourceIds.length > 0 &&
    Math.abs(remainingSplit) <= 1 &&
    !saving;

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAmplopBootstrap(sessionToken, { period: form.period });

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Gagal membaca data 4 Amplop.");
        return;
      }

      const normalized = normalizeBootstrap(result.data || result);
      setBootstrap(normalized);

      setForm((current) => ({
        ...current,
        total_amount:
          numberValue(current.total_amount) > 0
            ? current.total_amount
            : normalized.summary.unallocated_income,
      }));

      setLines((current) => {
        const hasInput = current.some((row) => numberValue(row.amount) > 0 || numberValue(row.percentage) > 0);
        if (hasInput) return current;
        return normalized.envelope_templates.map((row) => ({
          envelope_code: row.envelope_code,
          envelope_name: row.envelope_name,
          percentage: numberValue(row.percentage || 0),
          amount: 0,
        }));
      });
    } catch (err) {
      setError(err?.message || "Gagal membaca data 4 Amplop.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionToken) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const updateLine = (index, key, value) => {
    setLines((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const next = { ...row, [key]: value };
      if (key === "percentage") {
        const percentage = numberValue(value);
        next.percentage = percentage;
        next.amount = Math.round((numberValue(form.total_amount) * percentage) / 100);
      }
      if (key === "amount") {
        next.amount = numberValue(value);
      }
      return next;
    }));
  };

  const resetDraft = () => {
    setForm((current) => ({
      ...current,
      allocation_date: todayInputValue(),
      total_amount: bootstrap.summary.unallocated_income,
      notes: "Pembagian uang masuk aktual ke 4 amplop",
    }));
    setLines(bootstrap.envelope_templates.map((row) => ({
      envelope_code: row.envelope_code,
      envelope_name: row.envelope_name,
      percentage: numberValue(row.percentage || 0),
      amount: 0,
    })));
    setSuccess("");
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!canSave) {
      if (selectedSourceIds.length === 0) {
        setError("Belum ada uang masuk aktual yang siap dibagi. Uang masuk tanpa source ID harus dibereskan dulu di Kas & Dompet/Uang Masuk.");
      } else {
        setError("Total pembagian harus sama dengan total uang yang akan dibagi.");
      }
      return;
    }

    setSaving(true);
    try {
      const result = await createAmplopAllocation(sessionToken, {
        operation_id: buildOperationId(),
        allocation_date: form.allocation_date,
        period: form.period,
        total_amount: numberValue(form.total_amount),
        source_mutation_ids: selectedSourceIds,
        envelopes: lines.map((row) => ({
          envelope_code: row.envelope_code,
          envelope_name: row.envelope_name,
          percentage: numberValue(row.percentage),
          amount: numberValue(row.amount),
        })),
        notes: form.notes,
      });

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Gagal menyimpan pembagian 4 Amplop.");
        return;
      }

      setSuccess(result.message || "Pembagian 4 Amplop berhasil disimpan.");
      setForm((current) => ({ ...current, total_amount: 0 }));
      setLines((current) => current.map((row) => ({ ...row, amount: 0 })));
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan pembagian 4 Amplop.");
    } finally {
      setSaving(false);
    }
  };

  const filteredAllocations = useMemo(() => {
    const rows = bootstrap.allocations;
    if (filter === "ayam") return rows.filter((row) => String(row.envelope_code).toUpperCase() === "AYAM");
    if (filter === "operasional") return rows.filter((row) => String(row.envelope_code).toUpperCase() === "OPERASIONAL");
    if (filter === "cicilan") return rows.filter((row) => String(row.envelope_code).toUpperCase() === "CICILAN");
    if (filter === "owner") return rows.filter((row) => String(row.envelope_code).toUpperCase() === "OWNER");
    return rows;
  }, [bootstrap.allocations, filter]);

  const incomeRows = bootstrap.eligible_income.slice(0, 10);
  const needSourceRows = bootstrap.income_need_source.slice(0, 8);

  const detailSourceIds = activeDetail ? splitIdText(activeDetail.source_mutation_ids) : [];
  const detailSourceRows = activeDetail
    ? bootstrap.income_mutations.filter((row) => detailSourceIds.includes(row.mutation_id))
    : [];
  const detailLedgerRows = activeDetail
    ? bootstrap.ledger.filter((row) => row.allocation_id === activeDetail.allocation_id)
    : [];

  return (
    <div>
      <PageHeader
        title="4 Amplop"
        description="Bagi uang masuk aktual ke Amplop Ayam, Operasional, Cicilan/Hutang, dan Owner. Sumbernya hanya mutasi uang masuk yang sudah benar-benar masuk dompet."
        badge="Live Trace"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Uang Aktual</div>
          <div className="da-dashboard-banner-title">Uang Masuk → Dompet → 4 Amplop</div>
          <div className="da-dashboard-banner-desc">
            Tidak mengambil dari PO, piutang, atau nilai stok. Uang tanpa source ID tidak boleh masuk bahan 4 Amplop.
          </div>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone="success">Terhubung</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading || saving}>Refresh Data</Button>
        </div>
      </div>

      {bootstrap.summary.hidden_rows > 0 ? (
        <div className="da-form-warning">
          {bootstrap.summary.hidden_rows} baris kosong/formatting disembunyikan supaya 4 Amplop tidak menampilkan angka yatim.
        </div>
      ) : null}
      {error ? <div className="da-form-warning">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}

      <div className="da-grid da-grid-3" style={{ marginBottom: 16 }}>
        <StatCard label="Uang Masuk Aktual" value={formatRupiah(bootstrap.summary.total_income)} description="Mutasi IN bersih dari dompet." tone="success" />
        <StatCard label="Belum Dibagi" value={formatRupiah(bootstrap.summary.unallocated_income)} description="Uang masuk yang siap dibagi." tone="warning" />
        <StatCard label="Perlu Sumber" value={formatRupiah(bootstrap.summary.income_need_source)} description={`${bootstrap.summary.need_source_count} mutasi perlu source ID.`} tone={bootstrap.summary.need_source_count > 0 ? "warning" : undefined} />
        <StatCard label="Sudah Dibagi" value={formatRupiah(bootstrap.summary.allocated_income)} description={`${bootstrap.summary.allocation_count} pembagian tercatat.`} />
        <StatCard label="Saldo 4 Amplop" value={formatRupiah(bootstrap.summary.envelope_balance)} description="Saldo catatan amplop saat ini." />
      </div>

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-page-kicker">Pembagian Uang</div>
            <h2>Tambah Pembagian ke 4 Amplop</h2>
            <p className="da-muted" style={{ margin: 0 }}>
              Isi nominal per amplop. Total uang dibagi otomatis dari uang masuk aktual yang belum masuk 4 Amplop.
            </p>
          </div>
          <Badge tone="warning">Tidak Potong Dompet</Badge>
        </div>

        <div className="da-form-grid">
          <label className="da-field">
            <span>Tanggal Pembagian</span>
            <input type="date" value={form.allocation_date} onChange={(event) => setForm((current) => ({ ...current, allocation_date: event.target.value }))} />
          </label>
          <label className="da-field">
            <span>Periode</span>
            <input type="month" value={form.period} onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))} />
          </label>
          <label className="da-field">
            <span>Total Uang Dibagi</span>
            <input type="number" min="0" value={formatNumberInput(form.total_amount)} readOnly />
          </label>
          <label className="da-field">
            <span>Catatan</span>
            <input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Catatan singkat" />
          </label>
        </div>

        <div className="da-table-card" style={{ marginTop: 14 }}>
          <table className="da-table">
            <thead>
              <tr>
                <th>Amplop</th>
                <th>Persen Bantu Hitung</th>
                <th>Nominal Masuk</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.envelope_code || index}>
                  <td><strong>{line.envelope_name}</strong><div className="da-muted">{line.envelope_code}</div></td>
                  <td><input type="number" min="0" max="100" value={formatNumberInput(line.percentage)} onChange={(event) => updateLine(index, "percentage", event.target.value)} style={{ width: 120 }} /></td>
                  <td><input type="number" min="0" value={formatNumberInput(line.amount)} onChange={(event) => updateLine(index, "amount", event.target.value)} style={{ width: 180 }} /></td>
                  <td className="da-muted">Nominal ini menjadi saldo catatan amplop, bukan saldo bank terpisah.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={Math.abs(remainingSplit) <= 1 ? "da-drop-preview-panel" : "da-form-warning"}>
          <strong>Total split: {formatRupiah(splitTotal)}</strong>
          <span style={{ marginLeft: 12 }}>Sisa belum pas: {formatRupiah(remainingSplit)}</span>
          <span style={{ marginLeft: 12 }}>Sumber uang masuk: {selectedSourceIds.length} mutasi</span>
        </div>

        <div className="da-form-actions">
          <Button variant="ghost" onClick={resetDraft} disabled={saving}>Reset Draft</Button>
          <Button onClick={handleSubmit} disabled={!canSave}>{saving ? "Menyimpan..." : "Simpan Pembagian"}</Button>
        </div>
      </Card>

      <div className="da-grid da-grid-2" style={{ marginTop: 16 }}>
        <Card>
          <div className="da-section-heading">
            <div><div className="da-page-kicker">Saldo Amplop</div><h2>Posisi 4 Amplop</h2></div>
          </div>
          <DataTable
            columns={[
              { key: "name", label: "Amplop", render: (row) => <strong>{row.envelope_name}</strong> },
              { key: "allocated", label: "Masuk", render: (row) => formatRupiah(row.allocated_amount || row.amount) },
              { key: "used", label: "Keluar", render: (row) => formatRupiah(row.used_amount) },
              { key: "saldo", label: "Saldo", render: (row) => <strong>{formatRupiah(row.balance)}</strong> },
            ]}
            rows={bootstrap.envelope_balances}
            getRowKey={(row) => row.envelope_code}
          />
        </Card>

        <Card>
          <div className="da-section-heading">
            <div>
              <div className="da-page-kicker">Bahan Pembagian</div>
              <h2>Uang Masuk Belum Dibagi</h2>
              <p className="da-muted" style={{ margin: 0 }}>Yang tampil di sini sudah punya source ID dan belum pernah dibagi.</p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.mutation_date) },
              { key: "dompet", label: "Dompet", render: (row) => safeText(row.wallet_name, "Dompet") },
              { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) },
              { key: "sumber", label: "Sumber", render: (row) => <strong>{safeText(row.source_id || row.source_module)}</strong> },
            ]}
            rows={incomeRows}
            getRowKey={(row, index) => row.mutation_id || index}
          />
        </Card>
      </div>

      {needSourceRows.length ? (
        <Card style={{ marginTop: 16 }}>
          <div className="da-section-heading">
            <div>
              <div className="da-page-kicker">Perlu Dibereskan</div>
              <h2>Uang Masuk Tanpa Source ID</h2>
              <p className="da-muted" style={{ margin: 0 }}>Mutasi ini belum boleh masuk 4 Amplop sampai sumbernya jelas.</p>
            </div>
            <Badge tone="warning">Perlu Sumber</Badge>
          </div>
          <DataTable
            columns={[
              { key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.mutation_date) },
              { key: "id", label: "Mutasi ID", render: (row) => <strong>{row.mutation_id}</strong> },
              { key: "dompet", label: "Dompet", render: (row) => safeText(row.wallet_name, "Dompet") },
              { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) },
              { key: "status", label: "Status", render: () => <Badge tone="warning">Perlu Sumber</Badge> },
            ]}
            rows={needSourceRows}
            getRowKey={(row, index) => row.mutation_id || index}
          />
        </Card>
      ) : null}

      <Card style={{ marginTop: 16 }}>
        <div className="da-section-heading">
          <div>
            <div className="da-page-kicker">Riwayat</div>
            <h2>Pembagian yang Sudah Dicatat</h2>
            <p className="da-muted" style={{ margin: 0 }}>Klik baris untuk melihat sumber mutasi uang masuk dan ledger amplop.</p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>

        <div className="da-tabs" style={{ marginBottom: 12 }}>
          <button className={filter === "all" ? "da-tab active" : "da-tab"} onClick={() => setFilter("all")}>Semua</button>
          <button className={filter === "ayam" ? "da-tab active" : "da-tab"} onClick={() => setFilter("ayam")}>Ayam</button>
          <button className={filter === "operasional" ? "da-tab active" : "da-tab"} onClick={() => setFilter("operasional")}>Operasional</button>
          <button className={filter === "cicilan" ? "da-tab active" : "da-tab"} onClick={() => setFilter("cicilan")}>Cicilan</button>
          <button className={filter === "owner" ? "da-tab active" : "da-tab"} onClick={() => setFilter("owner")}>Owner</button>
        </div>

        <DataTable
          columns={[
            { key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.allocation_date) },
            { key: "id", label: "Allocation ID", render: (row) => <strong>{row.allocation_id}</strong> },
            { key: "amplop", label: "Amplop", render: (row) => row.envelope_name },
            { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) },
            { key: "sumber", label: "Sumber", render: (row) => `${splitIdText(row.source_mutation_ids).length} mutasi` },
            { key: "status", label: "Status", render: (row) => <Badge tone="success">{row.status}</Badge> },
          ]}
          rows={filteredAllocations}
          getRowKey={(row, index) => row.allocation_line_id || `${row.allocation_id}-${index}`}
          onRowClick={setActiveDetail}
        />
      </Card>

      <Modal open={Boolean(activeDetail)} title="Detail Pembagian 4 Amplop" subtitle={activeDetail?.allocation_id} onClose={() => setActiveDetail(null)}>
        {activeDetail ? (
          <div className="da-grid">
            <div className="da-detail-grid">
              <div className="da-detail-box"><div className="da-stat-label">Amplop</div><strong>{activeDetail.envelope_name}</strong><div>{formatRupiah(activeDetail.amount)}</div></div>
              <div className="da-detail-box"><div className="da-stat-label">Sumber Total</div><strong>{formatRupiah(activeDetail.source_total_amount)}</strong><div>Periode: {safeText(activeDetail.period)}</div></div>
              <div className="da-detail-box"><div className="da-stat-label">Tanggal</div><strong>{formatDisplayDate(activeDetail.allocation_date)}</strong><div>{safeText(activeDetail.status)}</div></div>
            </div>

            <div className="da-form-warning" style={{ marginTop: 0 }}>
              Rantai ini harus bisa ditelusuri: Uang Masuk Aktual → Mutasi Dompet → 4 Amplop → nanti Bayar Ayam / Belanja / Cicilan.
            </div>

            <div className="da-detail-box">
              <div className="da-stat-label">Source Mutation IDs</div>
              <p style={{ wordBreak: "break-word", margin: 0 }}>{safeText(activeDetail.source_mutation_ids)}</p>
            </div>

            <Card>
              <div className="da-section-heading"><div><div className="da-page-kicker">Sumber Uang</div><h2>Mutasi Dompet Dipakai</h2></div></div>
              <DataTable
                columns={[
                  { key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.mutation_date) },
                  { key: "id", label: "Mutasi ID", render: (row) => <strong>{row.mutation_id}</strong> },
                  { key: "dompet", label: "Dompet", render: (row) => safeText(row.wallet_name, "Dompet") },
                  { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) },
                  { key: "sumber", label: "Sumber", render: (row) => safeText(row.source_id || row.source_module) },
                ]}
                rows={detailSourceRows}
                getRowKey={(row, index) => row.mutation_id || index}
              />
            </Card>

            <Card>
              <div className="da-section-heading"><div><div className="da-page-kicker">Ledger Amplop</div><h2>Catatan Masuk/Keluar Amplop</h2></div></div>
              <DataTable
                columns={[
                  { key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.ledger_date) },
                  { key: "id", label: "Ledger ID", render: (row) => <strong>{row.ledger_id}</strong> },
                  { key: "amplop", label: "Amplop", render: (row) => row.envelope_name },
                  { key: "arah", label: "Arah", render: (row) => <Badge tone={row.direction === "OUT" ? "warning" : "success"}>{row.direction}</Badge> },
                  { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) },
                ]}
                rows={detailLedgerRows}
                getRowKey={(row, index) => row.ledger_id || index}
              />
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
