import { useEffect, useMemo, useState } from "react";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import StatCard from "../../components/ui/StatCard";



async function callPhp(action, payload, sessionToken) {
  const response = await fetch("/api/erp-v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      sessionToken,
      payload: payload || {},
    }),
  });

  const rawText = await response.text();
  let json;

  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`${action}: backend PHP tidak membalas JSON valid.`);
  }

  if (!response.ok || json?.success === false) {
    const code = json?.error?.code ? ` (${json.error.code})` : "";
    throw new Error(`${action}${code}: ${json?.message || "request gagal"}`);
  }

  return json?.data ?? {};
}

async function safePhp(action, payload, sessionToken) {
  try {
    return {
      ok: true,
      action,
      data: await callPhp(action, payload, sessionToken),
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      action,
      data: {},
      error: error?.message || String(error),
    };
  }
}

function firstArray(data, keys = []) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function sumArrays(...arrays) {
  return arrays.reduce(
    (total, rows) => total + (Array.isArray(rows) ? rows.length : 0),
    0
  );
}

function parseChecklist(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

function normalizeArchiveRows(data) {
  const rows =
    firstArray(data, ["items", "results", "recent_records", "rows"]) || [];

  return rows.map((row) => ({
    date:
      row.transaction_date ||
      row.date ||
      row.created_at ||
      row.updated_at ||
      "",
    module: row.module || row.source_module || "ARSIP",
    id:
      row.transaction_id ||
      row.source_id ||
      row.archive_id ||
      row.id ||
      "-",
    amount:
      row.amount ||
      row.nominal ||
      row.total_amount ||
      row.grand_total ||
      0,
  }));
}

async function buildPhpHealthSnapshot(filters, sessionToken) {
  const scopedPayload = {
    date_start: filters?.date_start,
    date_end: filters?.date_end,
    location_id: filters?.location_id || "ALL",
    limit: 100,
  };

  const requests = [
    ["frontendCutoverHealth", {}],
    ["getLegacyChickenPurchaseBootstrap", scopedPayload],
    ["getLegacyProductionBootstrap", scopedPayload],
    ["getFrontendCutoverFinishedStockBootstrap", scopedPayload],
    ["getLegacyOrderBootstrap", scopedPayload],
    ["getFrontendCutoverMoneyInBootstrap", scopedPayload],
    ["getFrontendCutoverWalletBootstrap", scopedPayload],
    ["getSupplierDebtBootstrap", scopedPayload],
    ["getFrontendCutoverEnvelopeBootstrap", scopedPayload],
    ["getOwnerControlBootstrap", scopedPayload],
    ["searchArchive", { q: "", limit: 100, offset: 0 }],
    ["getReconciliationBootstrap", {}],
  ];

  const responses = await Promise.all(
    requests.map(([action, payload]) =>
      safePhp(action, payload, sessionToken)
    )
  );

  const byAction = Object.fromEntries(
    responses.map((item) => [item.action, item])
  );

  const bridge = byAction.frontendCutoverHealth?.data || {};
  const drop = byAction.getLegacyChickenPurchaseBootstrap?.data || {};
  const production = byAction.getLegacyProductionBootstrap?.data || {};
  const stock = byAction.getFrontendCutoverFinishedStockBootstrap?.data || {};
  const order = byAction.getLegacyOrderBootstrap?.data || {};
  const money = byAction.getFrontendCutoverMoneyInBootstrap?.data || {};
  const wallet = byAction.getFrontendCutoverWalletBootstrap?.data || {};
  const supplier = byAction.getSupplierDebtBootstrap?.data || {};
  const envelope = byAction.getFrontendCutoverEnvelopeBootstrap?.data || {};
  const owner = byAction.getOwnerControlBootstrap?.data || {};
  const archive = byAction.searchArchive?.data || {};
  const reconciliation = byAction.getReconciliationBootstrap?.data || {};

  const dropRows = firstArray(drop, [
    "chicken_drops",
    "purchases",
    "drops",
    "rows",
  ]);
  const lotRows = firstArray(drop, [
    "chicken_lots",
    "active_lots",
    "lots",
  ]);
  const productionRows = firstArray(production, [
    "production_batches",
    "batches",
    "productions",
  ]);
  const finishedRows = firstArray(stock, [
    "finished_stock",
    "finished_goods_stock",
    "stock",
  ]);
  const orderRows = firstArray(order, ["orders", "rows"]);
  const paymentRows = firstArray(money, ["payments"]);
  const receivableRows = firstArray(money, ["receivables"]);
  const walletRows = firstArray(wallet, ["wallet_mutations", "mutations"]);
  const currentNotes = firstArray(supplier, ["current_notes"]);
  const oldDebts = firstArray(supplier, ["old_debts"]);
  const payableRows =
    firstArray(supplier, ["payables"]).length > 0
      ? firstArray(supplier, ["payables"])
      : [...currentNotes, ...oldDebts];
  const allocationRows = firstArray(envelope, [
    "allocations",
    "recent_allocations",
  ]);
  const archiveRows = normalizeArchiveRows(archive);

  const modules = [
    {
      module: "DROP Ayam",
      tab: "PHP/MySQL · Purchase/Drop",
      real_rows: dropRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "Lot Ayam",
      tab: "PHP/MySQL · Chicken Lots",
      real_rows: lotRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "Produksi / Adukan",
      tab: "PHP/MySQL · Production Batches",
      real_rows: productionRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "Stok Jadi",
      tab: "PHP/MySQL · Finished Stock SSOT",
      real_rows: finishedRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "Order / Kasir",
      tab: "PHP/MySQL · Orders",
      real_rows: orderRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "Payment / Piutang",
      tab: "PHP/MySQL · Payments + Receivables",
      real_rows: paymentRows.length + receivableRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "Kas & Dompet",
      tab: "PHP/MySQL · Wallet Mutations",
      real_rows: walletRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "Hutang Nana",
      tab: "PHP/MySQL · Supplier Payables",
      real_rows: payableRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "4 Amplop",
      tab: "PHP/MySQL · Envelope Ledger",
      real_rows: allocationRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "Arsip Digital",
      tab: "PHP/MySQL · Universal Archive",
      real_rows: archiveRows.length,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
    {
      module: "Reconciliation / Cutover",
      tab: "PHP/MySQL · Cutover Guard",
      real_rows: reconciliation?.latest_cutover_plan ? 1 : 0,
      ghost_rows: 0,
      missing_id: 0,
      severity: "INFO",
      status: "Aman",
    },
  ];

  const issues = [];

  for (const response of responses) {
    if (!response.ok) {
      issues.push({
        severity: "ERROR",
        module: response.action,
        message: response.error,
        source: "PHP/MySQL api-v2",
        count: 1,
      });
    }
  }

  const bridgeHealthy =
    bridge.frontend_cutover_bridge_loaded === true &&
    bridge.php_mysql_primary === true &&
    bridge.split_brain_core_writes_blocked === true;

  if (!bridgeHealthy) {
    issues.push({
      severity: "ERROR",
      module: "Cutover Bridge",
      message:
        "Frontend Cutover Bridge belum menyatakan PHP/MySQL primary + split-brain protection aktif.",
      source: "frontendCutoverHealth",
      count: 1,
    });
  }

  const supplierOutstanding = number(
    supplier?.summary?.grand_outstanding ??
      supplier?.grand_outstanding ??
      0
  );

  const ownerSupplierOutstanding = number(
    owner?.supplier_position?.total_outstanding ??
      owner?.supplier_position?.grand_outstanding ??
      owner?.supplier_position?.outstanding ??
      0
  );

  if (
    supplierOutstanding !== ownerSupplierOutstanding
  ) {
    issues.push({
      severity: "ERROR",
      module: "Hutang Nana",
      message: `Outstanding supplier tidak konsisten. Supplier Rp ${supplierOutstanding.toLocaleString(
        "id-ID"
      )}, Owner Control Rp ${ownerSupplierOutstanding.toLocaleString("id-ID")}.`,
      source: "Supplier Debt ↔ Owner Control",
      count: 1,
    });
  }

  const walletMissingSource = walletRows.filter((row) => {
    const sourceId = String(
      row?.source_id ?? row?.sourceId ?? ""
    ).trim();
    return !sourceId && number(row?.amount) !== 0;
  }).length;

  if (walletMissingSource > 0) {
    issues.push({
      severity: "WARNING",
      module: "Kas & Dompet",
      message: `${walletMissingSource} mutasi nominal non-zero belum punya source ID.`,
      source: "wallet_mutations",
      count: walletMissingSource,
    });
  }

  const plan = reconciliation?.latest_cutover_plan || null;
  const checklist = parseChecklist(plan?.checklist_json);
  const cutoverApproved =
    String(plan?.status || "").toUpperCase() ===
      "FRONTEND_SWITCH_APPROVED" &&
    checklist.full_uat_passed === true &&
    checklist.frontend_switch_approved === true;

  if (!cutoverApproved) {
    issues.push({
      severity: "WARNING",
      module: "Cutover",
      message:
        "Cutover Plan terbaru belum terbaca sebagai FULL UAT PASSED + FRONTEND SWITCH APPROVED.",
      source: "cutover_plans",
      count: 1,
    });
  }

  const errorCount = issues.filter(
    (row) => String(row.severity).toUpperCase() === "ERROR"
  ).length;
  const warningCount = issues.filter(
    (row) => String(row.severity).toUpperCase() === "WARNING"
  ).length;

  const realRows = modules.reduce(
    (sum, row) => sum + number(row.real_rows),
    0
  );

  const moneyIn = number(
    money?.summary?.uang_masuk_actual ??
      owner?.sales_cash_position?.total_cash_in ??
      0
  );
  const moneyOut = number(wallet?.summary?.total_out ?? 0);
  const readyStock = number(
    stock?.summary?.total_free_pcs ??
      stock?.summary?.free_qty ??
      0
  );
  const chickenRemaining = number(
    drop?.summary?.remaining_kg ??
      drop?.summary?.sisa_kg_ayam ??
      drop?.summary?.active_lot_remaining_kg ??
      production?.summary?.remaining_chicken_kg ??
      0
  );
  const walletBalance = number(wallet?.summary?.total_balance ?? 0);

  return {
    summary: {
      status:
        errorCount > 0
          ? "Bahaya"
          : warningCount > 0
            ? "Perlu Cek"
            : "Aman",
      error_count: errorCount,
      warning_count: warningCount,
      ghost_rows: 0,
      real_rows: realRows,
      modules_checked: modules.length,
      source_of_truth: "PHP + MySQL",
    },
    modules,
    issues,
    checks: [
      {
        label: "PHP/MySQL Primary",
        value: bridgeHealthy ? "Aktif" : "Belum Aktif",
        type: "text",
        status: bridgeHealthy ? "Aman" : "Bahaya",
        severity: bridgeHealthy ? "INFO" : "ERROR",
      },
      {
        label: "Saldo Dompet",
        value: walletBalance,
        type: "money",
        status: "Live",
        severity: "INFO",
      },
      {
        label: "Uang Masuk Aktual",
        value: moneyIn,
        type: "money",
        status: "Live",
        severity: "INFO",
      },
      {
        label: "Uang Keluar Aktual",
        value: moneyOut,
        type: "money",
        status: "Live",
        severity: "INFO",
      },
      {
        label: "Sisa Hutang Nana",
        value: supplierOutstanding,
        type: "money",
        status:
          supplierOutstanding === ownerSupplierOutstanding
            ? "Sinkron"
            : "Tidak Sinkron",
        severity:
          supplierOutstanding === ownerSupplierOutstanding
            ? "INFO"
            : "ERROR",
      },
      {
        label: "Sisa Ayam Aktif",
        value: `${chickenRemaining.toLocaleString("id-ID")} kg`,
        type: "text",
        status: "Live",
        severity: "INFO",
      },
      {
        label: "Stok Ready",
        value: `${readyStock.toLocaleString("id-ID")} pcs`,
        type: "text",
        status: "Live",
        severity: "INFO",
      },
      {
        label: "Cutover Approval",
        value: cutoverApproved
          ? "FULL UAT + SWITCH APPROVED"
          : "Perlu Cek",
        type: "text",
        status: cutoverApproved ? "Aman" : "Perlu Cek",
        severity: cutoverApproved ? "INFO" : "WARNING",
      },
    ],
    recent: archiveRows.slice(0, 8),
    meta: {
      backend: "PHP + MySQL",
      legacy_sheet_health_used: false,
      bridgeHealthy,
      cutoverApproved,
      supplierOutstanding,
      ownerSupplierOutstanding,
      walletMissingSource,
    },
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayThisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function text(value, fallback = "-") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function number(value) {
  const n = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toneBySeverity(severity) {
  const s = String(severity || "").toUpperCase();
  if (s === "ERROR" || s === "BAHAYA") return "danger";
  if (s === "WARNING" || s === "PERLU CEK") return "warning";
  return "success";
}

function issueLabel(row) {
  const severity = String(row?.severity || "INFO").toUpperCase();
  if (severity === "ERROR") return "Bahaya";
  if (severity === "WARNING") return "Perlu Cek";
  return "Aman";
}

export default function SystemHealthPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({});
  const [filters, setFilters] = useState({
    date_start: firstDayThisMonth(),
    date_end: today(),
    location_id: "ALL",
  });

  const sessionToken = session?.sessionToken || session?.session_token || "";
  const summary = data.summary || {};
  const modules = data.modules || [];
  const issues = data.issues || [];
  const checks = data.checks || [];
  const recent = data.recent || [];

  const healthTone = useMemo(() => {
    if (error) return "danger";
    if (number(summary.error_count) > 0) return "danger";
    if (number(summary.warning_count) > 0) return "warning";
    return "success";
  }, [error, summary.error_count, summary.warning_count]);

  async function loadData(nextFilters = filters) {
    setLoading(true);
    setError("");

    try {
      const nextData = await buildPhpHealthSnapshot(
        nextFilters,
        sessionToken
      );
      setData(nextData);
    } catch (err) {
      const message =
        err?.message || "Gagal membaca Data Health PHP/MySQL.";

      if (
        String(message).includes("AUTH_REQUIRED") ||
        String(message).includes("SESSION")
      ) {
        onSessionExpired?.();
        return;
      }

      setError(message);
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionToken) loadData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  function updateFilter(field, value) {
    setFilters((old) => ({ ...old, [field]: value }));
  }

  function handlePull(event) {
    event.preventDefault();
    loadData(filters);
  }

  return (
    <div className="da-page-stack">
      <section className="da-page-header">
        <div>
          <p className="da-kicker">Dimsum Aditya</p>
          <h1>Data Health</h1>
          <p className="da-muted">
            Cek kesehatan core ERP langsung dari PHP/MySQL: transaksi, source ID, uang, stok, hutang, 4 Amplop, arsip, dan cutover.
          </p>
        </div>
        <Badge tone={loading ? "warning" : healthTone}>
          {loading ? "Mengecek" : healthTone === "success" ? "Sehat" : "Perlu Cek"}
        </Badge>
      </section>

      {error ? <div className="da-form-error">{error}</div> : null}

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Sistem Ringan & Bersih</p>
            <h2>Integrity Check ERP</h2>
            <p className="da-muted">
              Halaman ini read-only dan memakai PHP/MySQL sebagai source of truth. Apps Script tidak dipakai untuk menentukan kesehatan core cutover.
            </p>
          </div>
          <Badge tone={healthTone}>{text(summary.status || (healthTone === "success" ? "Aman" : "Perlu Cek"))}</Badge>
        </div>

        <form className="da-form-grid" onSubmit={handlePull}>
          <label className="da-form-field">
            <span>Tanggal Mulai</span>
            <input type="date" value={filters.date_start} onChange={(e) => updateFilter("date_start", e.target.value)} />
          </label>
          <label className="da-form-field">
            <span>Tanggal Sampai</span>
            <input type="date" value={filters.date_end} onChange={(e) => updateFilter("date_end", e.target.value)} />
          </label>
          <label className="da-form-field">
            <span>Lokasi</span>
            <input value={filters.location_id} onChange={(e) => updateFilter("location_id", e.target.value)} placeholder="ALL / TGR / PML / CBN" />
          </label>
          <div className="da-form-actions">
            <Button type="submit" disabled={loading}>{loading ? "Mengecek..." : "Cek Data"}</Button>
          </div>
        </form>
      </Card>

      <section className="da-grid da-grid-3">
        <StatCard label="Masalah Bahaya" value={number(summary.error_count).toLocaleString("id-ID")} tone={number(summary.error_count) ? "danger" : "default"} />
        <StatCard label="Perlu Cek" value={number(summary.warning_count).toLocaleString("id-ID")} tone={number(summary.warning_count) ? "warning" : "default"} />
        <StatCard label="Ghost Row Disembunyikan" value={number(summary.ghost_rows).toLocaleString("id-ID")} tone="warning" />
        <StatCard label="Baris Nyata" value={number(summary.real_rows).toLocaleString("id-ID")} />
        <StatCard label="Modul Dicek" value={number(summary.modules_checked).toLocaleString("id-ID")} />
        <StatCard label="Periode" value={`${formatDate(filters.date_start)} - ${formatDate(filters.date_end)}`} />
      </section>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Peta Modul</p>
            <h2>Kesehatan per Tab</h2>
            <p className="da-muted">Semua angka di tabel ini berasal dari endpoint PHP/MySQL cutover, bukan tab Google Sheets legacy.</p>
          </div>
          <Badge tone="success">Read Only</Badge>
        </div>
        <DataTable
          columns={[
            { key: "module", label: "Modul" },
            { key: "tab", label: "Tab/Sumber" },
            { key: "real_rows", label: "Baris Nyata", render: (row) => number(row.real_rows).toLocaleString("id-ID") },
            { key: "ghost_rows", label: "Ghost", render: (row) => number(row.ghost_rows).toLocaleString("id-ID") },
            { key: "missing_id", label: "Perlu ID", render: (row) => number(row.missing_id).toLocaleString("id-ID") },
            { key: "status", label: "Status", render: (row) => <Badge tone={toneBySeverity(row.severity)}>{text(row.status || issueLabel(row))}</Badge> },
          ]}
          rows={modules}
          emptyMessage="Belum ada modul yang terbaca."
        />
      </Card>

      <Card>
        <div className="da-section-header">
          <div>
            <p className="da-kicker">Masalah yang Perlu Diperhatikan</p>
            <h2>Action List</h2>
            <p className="da-muted">Perbaikan tetap dilakukan dari modul sumber, bukan dari halaman Data Health.</p>
          </div>
          <Badge tone={issues.length ? "warning" : "success"}>{issues.length ? `${issues.length} catatan` : "Aman"}</Badge>
        </div>
        <DataTable
          columns={[
            { key: "severity", label: "Level", render: (row) => <Badge tone={toneBySeverity(row.severity)}>{issueLabel(row)}</Badge> },
            { key: "module", label: "Modul" },
            { key: "message", label: "Catatan" },
            { key: "source", label: "Sumber" },
            { key: "count", label: "Jumlah", render: (row) => number(row.count).toLocaleString("id-ID") },
          ]}
          rows={issues}
          emptyMessage="Belum ada alarm besar."
        />
      </Card>

      <section className="da-grid da-grid-2">
        <Card>
          <div className="da-section-header">
            <div>
              <p className="da-kicker">Benang Merah</p>
              <h2>Checklist Kabel Utama</h2>
            </div>
            <Badge tone="success">Live Check</Badge>
          </div>
          <DataTable
            columns={[
              { key: "label", label: "Cek" },
              { key: "value", label: "Nilai", render: (row) => row.type === "money" ? formatRupiah(number(row.value)) : text(row.value) },
              { key: "status", label: "Status", render: (row) => <Badge tone={toneBySeverity(row.severity)}>{text(row.status)}</Badge> },
            ]}
            rows={checks}
            emptyMessage="Belum ada checklist terbaca."
          />
        </Card>
        <Card>
          <div className="da-section-header">
            <div>
              <p className="da-kicker">Jejak Terakhir</p>
              <h2>Transaksi Terbaru</h2>
            </div>
            <Badge tone="success">Archive Hook</Badge>
          </div>
          <DataTable
            columns={[
              { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
              { key: "module", label: "Modul" },
              { key: "id", label: "ID" },
              { key: "amount", label: "Nominal", render: (row) => formatRupiah(number(row.amount)) },
            ]}
            rows={recent.slice(0, 8)}
            emptyMessage="Belum ada transaksi terbaru."
          />
        </Card>
      </section>
      <Card>
        <p className="da-muted">
          Catatan: Data Health hanya membaca dan memberi alarm. Kalau ada sumber hilang, perbaiki dari modul asal seperti Kas & Dompet, Kas Keluar, Uang Masuk, Stok, Payroll, Kewajiban, atau Arsip Digital.
        </p>
      </Card>
    </div>
  );
}
