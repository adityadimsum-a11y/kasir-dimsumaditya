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

function normalizeEnvelope(row) {
  return {
    envelope_code: row.envelope_code || row.code || "",
    envelope_name: row.envelope_name || row.name || row.label || "Amplop",
    percentage: numberValue(row.percentage || row.percent || 0),
    amount: numberValue(row.amount || row.saldo || row.balance || 0),
    allocated_amount: numberValue(row.allocated_amount || row.amount || 0),
    used_amount: numberValue(row.used_amount || row.keluar || 0),
    balance: numberValue(row.balance || row.saldo || row.amount || 0),
  };
}

function normalizeIncome(row) {
  return {
    ...row,
    mutation_id: row.mutation_id || row.wallet_mutation_id || row.id || "",
    mutation_date: row.mutation_date || row.date || row.created_at || "",
    wallet_id: row.wallet_id || "",
    wallet_name: row.wallet_name || row.name || "Dompet",
    amount: numberValue(row.amount || row.nominal || 0),
    source_module: row.source_module || row.source_type || "-",
    source_id: row.source_id || row.ref_id || "",
    status: row.status || "Tercatat",
    allocated: row.allocated === true || String(row.allocated || "").toLowerCase() === "true",
  };
}

function normalizeAllocation(row) {
  return {
    ...row,
    allocation_id: row.allocation_id || row.id || "",
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

function normalizeBootstrap(payload) {
  const data = payload?.data || payload || {};
  const summary = data.summary || {};

  const envelopes = asArray(data.envelope_balances || data.amplop_balances || data.envelopes)
    .map(normalizeEnvelope);

  const templates = asArray(data.envelope_templates || data.amplop_templates || data.presets)
    .map(normalizeEnvelope)
    .filter((row) => row.envelope_code);

  return {
    summary: {
      total_income: numberValue(summary.total_income || summary.uang_masuk || 0),
      allocated_income: numberValue(summary.allocated_income || summary.sudah_dibagi || 0),
      unallocated_income: numberValue(summary.unallocated_income || summary.belum_dibagi || 0),
      allocation_count: numberValue(summary.allocation_count || 0),
      source_count: numberValue(summary.source_count || 0),
      envelope_balance: numberValue(summary.envelope_balance || summary.total_saldo_amplop || 0),
    },
    envelope_templates: templates.length ? templates : DEFAULT_ENVELOPES,
    envelope_balances: envelopes.length ? envelopes : DEFAULT_ENVELOPES,
    eligible_income: asArray(data.eligible_income || data.unallocated_income_mutations || data.income_mutations)
      .map(normalizeIncome)
      .filter((row) => row.amount > 0),
    allocations: asArray(data.allocations || data.amplop_allocations)
      .map(normalizeAllocation),
  };
}

function formatNumberInput(value) {
  const number = numberValue(value);
  return number ? String(number) : "";
}

export default function EmpatAmplopPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bootstrap, setBootstrap] = useState(() => normalizeBootstrap({}));
  const [activeDetail, setActiveDetail] = useState(null);

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
      const result = await getAmplopBootstrap(sessionToken, {
        period: form.period,
      });

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
    setLines((current) => {
      return current.map((row, rowIndex) => {
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
      });
    });
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
        setError("Belum ada uang masuk aktual yang belum dibagi. 4 Amplop tidak boleh mengambil dari PO, piutang, atau stok.");
      } else {
        setError("Total pembagian harus sama dengan total uang yang akan dibagi.");
      }
      return;
    }

    setSaving(true);
    try {
      const result = await createAmplopAllocation(sessionToken, {
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

  const allocationRows = bootstrap.allocations.slice(0, 20);
  const incomeRows = bootstrap.eligible_income.slice(0, 10);

  return (
    <div>
      <PageHeader
        title="4 Amplop"
        description="Bagi uang masuk aktual ke Amplop Ayam, Operasional, Cicilan/Hutang, dan Owner. Sumbernya hanya mutasi uang masuk yang sudah benar-benar masuk dompet."
        badge="Live Allocation"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Uang Aktual</div>
          <div className="da-dashboard-banner-title">Uang Masuk → Dompet → 4 Amplop</div>
          <div className="da-dashboard-banner-desc">
            Halaman ini tidak mengambil dari PO, piutang, atau nilai stok. Yang bisa dibagi hanya uang masuk aktual dari mutasi dompet.
          </div>
        </div>
        <div className="da-dashboard-banner-actions">
          <Badge tone="success">Terhubung</Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading || saving}>
            Refresh Data
          </Button>
        </div>
      </div>

      {error ? <div className="da-form-warning">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}

      <div className="da-grid da-grid-3" style={{ marginBottom: 16 }}>
        <StatCard
          label="Uang Masuk Aktual"
          value={formatRupiah(bootstrap.summary.total_income)}
          description="Total uang masuk dari mutasi dompet."
          tone="success"
        />
        <StatCard
          label="Sudah Dibagi"
          value={formatRupiah(bootstrap.summary.allocated_income)}
          description="Total uang yang sudah masuk catatan 4 Amplop."
        />
        <StatCard
          label="Belum Dibagi"
          value={formatRupiah(bootstrap.summary.unallocated_income)}
          description="Bahan pembagian berikutnya."
          tone="warning"
        />
        <StatCard
          label="Saldo 4 Amplop"
          value={formatRupiah(bootstrap.summary.envelope_balance)}
          description="Saldo catatan amplop saat ini."
        />
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
            <input
              type="date"
              value={form.allocation_date}
              onChange={(event) => setForm((current) => ({ ...current, allocation_date: event.target.value }))}
            />
          </label>

          <label className="da-field">
            <span>Periode</span>
            <input
              type="month"
              value={form.period}
              onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
            />
          </label>

          <label className="da-field">
            <span>Total Uang Dibagi</span>
            <input
              type="number"
              min="0"
              value={formatNumberInput(form.total_amount)}
              readOnly
            />
          </label>

          <label className="da-field">
            <span>Catatan</span>
            <input
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Catatan singkat"
            />
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
                  <td>
                    <strong>{line.envelope_name}</strong>
                    <div className="da-muted">{line.envelope_code}</div>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formatNumberInput(line.percentage)}
                      onChange={(event) => updateLine(index, "percentage", event.target.value)}
                      style={{ width: 120 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={formatNumberInput(line.amount)}
                      onChange={(event) => updateLine(index, "amount", event.target.value)}
                      style={{ width: 180 }}
                    />
                  </td>
                  <td className="da-muted">Nominal ini menjadi saldo catatan amplop, bukan saldo bank terpisah.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={Math.abs(remainingSplit) <= 1 ? "da-drop-preview-panel" : "da-form-warning"}>
          <strong>Total split: {formatRupiah(splitTotal)}</strong>
          <span style={{ marginLeft: 12 }}>
            Sisa belum pas: {formatRupiah(remainingSplit)}
          </span>
          <span style={{ marginLeft: 12 }}>
            Sumber uang masuk: {selectedSourceIds.length} mutasi
          </span>
        </div>

        <div className="da-form-actions">
          <Button variant="ghost" onClick={resetDraft} disabled={saving}>
            Reset Draft
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave}>
            {saving ? "Menyimpan..." : "Simpan Pembagian"}
          </Button>
        </div>
      </Card>

      <div className="da-grid da-grid-2" style={{ marginTop: 16 }}>
        <Card>
          <div className="da-section-heading">
            <div>
              <div className="da-page-kicker">Saldo Amplop</div>
              <h2>Posisi 4 Amplop</h2>
            </div>
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
              <p className="da-muted" style={{ margin: 0 }}>
                Maksimal 10 mutasi pertama ditampilkan di sini.
              </p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.mutation_date) },
              { key: "dompet", label: "Dompet", render: (row) => safeText(row.wallet_name, "Dompet") },
              { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) },
              { key: "sumber", label: "Sumber", render: (row) => safeText(row.source_id || row.source_module) },
            ]}
            rows={incomeRows}
            getRowKey={(row, index) => row.mutation_id || index}
          />
        </Card>
      </div>

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-page-kicker">Riwayat</div>
            <h2>Pembagian yang Sudah Dicatat</h2>
            <p className="da-muted" style={{ margin: 0 }}>
              Klik baris untuk melihat sumber mutasi uang masuk yang dipakai.
            </p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>

        <DataTable
          columns={[
            { key: "tanggal", label: "Tanggal", render: (row) => formatDisplayDate(row.allocation_date) },
            { key: "id", label: "Allocation ID", render: (row) => <strong>{row.allocation_id}</strong> },
            { key: "amplop", label: "Amplop", render: (row) => row.envelope_name },
            { key: "nominal", label: "Nominal", render: (row) => formatRupiah(row.amount) },
            { key: "status", label: "Status", render: (row) => <Badge tone="success">{row.status}</Badge> },
          ]}
          rows={allocationRows}
          getRowKey={(row, index) => row.allocation_line_id || `${row.allocation_id}-${index}`}
          onRowClick={setActiveDetail}
        />
      </Card>

      <Modal
        open={Boolean(activeDetail)}
        title="Detail Pembagian 4 Amplop"
        subtitle={activeDetail?.allocation_id}
        onClose={() => setActiveDetail(null)}
      >
        {activeDetail ? (
          <div className="da-grid">
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-stat-label">Amplop</div>
                <strong>{activeDetail.envelope_name}</strong>
                <div>{formatRupiah(activeDetail.amount)}</div>
              </div>
              <div className="da-detail-box">
                <div className="da-stat-label">Sumber Total</div>
                <strong>{formatRupiah(activeDetail.source_total_amount)}</strong>
                <div>Periode: {safeText(activeDetail.period)}</div>
              </div>
            </div>

            <div className="da-form-warning" style={{ marginTop: 0 }}>
              Rantai ini harus bisa ditelusuri: Uang Masuk Aktual → Mutasi Dompet → 4 Amplop → nanti Bayar Ayam / Belanja / Cicilan.
            </div>

            <div className="da-detail-box">
              <div className="da-stat-label">Source Mutation IDs</div>
              <p style={{ wordBreak: "break-word", margin: 0 }}>{safeText(activeDetail.source_mutation_ids)}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
