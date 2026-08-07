import { useEffect, useMemo, useState } from "react";
import {
  createHRDAttendance,
  createHRDEmployee,
  createHRDKasbonNote,
  createHRDLoanNote,
  getHRDPayrollBootstrap,
  hrdPayrollHealth,
  importHRDPayrollV32Backup,
  previewHRDPayrollV32Import,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import PayrollFinalPanel from "./PayrollFinalPanel";

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const cleaned = String(value ?? "0").replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function monthInput() {
  return new Date().toISOString().slice(0, 7);
}

function makeOperationId(prefix = "HRD") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function badgeTone(status) {
  const value = String(status || "").toUpperCase();
  if (["ACTIVE", "AKTIF", "CLOSED", "IMPORTED", "HADIR"].some((item) => value.includes(item))) return "success";
  if (["ENDING", "DRAFT", "OPEN", "IZIN", "SAKIT"].some((item) => value.includes(item))) return "warning";
  if (["INACTIVE", "NONAKTIF", "VOID", "TIDAK_MASUK"].some((item) => value.includes(item))) return "danger";
  return "default";
}

function normalizeEmployee(row) {
  return {
    employee_id: textValue(row.employee_id, ""),
    employee_code: textValue(row.employee_code, ""),
    employee_name: textValue(row.employee_name, "-"),
    location_id: textValue(row.location_id, ""),
    location_code: textValue(row.location_code, "-"),
    location_name: textValue(row.location_name_snapshot || row.location_name, "-"),
    position: textValue(row.position_name || row.position, "-"),
    payroll_day: numberValue(row.payroll_day),
    salary_mode: textValue(row.salary_mode, "BULANAN"),
    base_salary: row.base_salary == null ? null : numberValue(row.base_salary),
    daily_salary: row.daily_salary == null ? null : numberValue(row.daily_salary),
    fixed_allowance: row.fixed_allowance == null ? null : numberValue(row.fixed_allowance),
    employment_status: textValue(row.employment_status, "ACTIVE"),
    advance_balance: numberValue(row.advance_balance),
    loan_balance: numberValue(row.loan_balance),
    salary_masked: Boolean(row.salary_masked),
    raw: row,
  };
}

function FlowCard() {
  const steps = [
    ["1", "Data karyawan & lokasi", "Master hidup, status kerja, tanggal gajian, dan riwayat gaji."],
    ["2", "Absensi, kasbon & pinjaman", "Cabang menginput lokasinya sendiri; uang keluar wajib memilih dompet."],
    ["3", "Draft & cek THP", "Backend menghitung ulang THP, pembulatan, kasbon, dan cicilan."],
    ["4", "Cetak, closing & bayar", "Slip V32 tidak memotong ledger. Closing mengunci; pembayaran membuat Wallet OUT."],
  ];
  return (
    <div style={{ background: "linear-gradient(135deg,#a11a13 0%,#d9251c 58%,#ff5a50 100%)", color: "#fff", borderRadius: 22, padding: 22, marginBottom: 18, boxShadow: "0 16px 38px rgba(217,37,28,.18)" }}>
      <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 14 }}>Alur Payroll Bulanan Dimsum Aditya</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {steps.map(([no, title, desc]) => (
          <div key={no} style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 17, padding: 15, minHeight: 122 }}>
            <span style={{ display: "inline-flex", width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 999, background: "#fff", color: "#d9251c", fontWeight: 950, marginBottom: 9 }}>{no}</span>
            <strong style={{ display: "block", marginBottom: 6 }}>{title}</strong>
            <span style={{ display: "block", opacity: .92, fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTabs({ active, onChange, fullPayrollAccess }) {
  const tabs = [
    ["board", "Papan Payroll"],
    ["employees", "Data Karyawan"],
    ["attendance", "Absensi & Izin"],
    ["ledger", "Kasbon & Pinjaman"],
    ...(fullPayrollAccess ? [["process", "Proses Gaji"], ["payment", "Pembayaran"], ["history", "Riwayat Payroll"], ["import", "Import V32"]] : []),
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          style={{ border: "1px solid #e5e7eb", borderRadius: 999, padding: "10px 14px", fontWeight: 850, cursor: "pointer", background: active === key ? "#fee2e2" : "#fff", color: active === key ? "#b91c1c" : "#374151" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function NoticeBox({ children, tone = "warning" }) {
  const palette = tone === "success"
    ? ["#ecfdf5", "#047857", "#a7f3d0"]
    : tone === "danger"
      ? ["#fef2f2", "#b91c1c", "#fecaca"]
      : ["#fff7ed", "#92400e", "#fed7aa"];
  return <div style={{ background: palette[0], color: palette[1], border: `1px solid ${palette[2]}`, borderRadius: 13, padding: "12px 14px", fontWeight: 800, marginTop: 12 }}>{children}</div>;
}

export default function HRDPayrollPage({ session, onSessionExpired, viewMode = "dashboard" }) {
  const token = session?.sessionToken || session?.session_token || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(monthInput());
  const [locationId, setLocationId] = useState("ALL");
  const [activeTab, setActiveTab] = useState("board");
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [payrollSubMode, setPayrollSubMode] = useState("process");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");

  const [employeeForm, setEmployeeForm] = useState({
    employee_name: "",
    location_id: "LOC-TGR-001",
    position_name: "Crew",
    payroll_day: "28",
    salary_mode: "BULANAN",
    base_salary: "0",
    daily_salary: "0",
    fixed_allowance: "0",
    employment_status: "ACTIVE",
    effective_period: monthInput(),
    notes: "Karyawan aktif.",
  });
  const [attendanceForm, setAttendanceForm] = useState({ employee_id: "", attendance_date: todayInput(), attendance_type: "HADIR", day_fraction: "1", deduct_salary: false, overtime_amount: "0", notes: "" });
  const [advanceForm, setAdvanceForm] = useState({ employee_id: "", wallet_id: "", date: todayInput(), amount: "0", notes: "Kasbon karyawan." });
  const [loanForm, setLoanForm] = useState({ employee_id: "", wallet_id: "", loan_date: todayInput(), amount: "0", tenor_total: "0", installment_amount: "0", start_period: monthInput(), payment_mode: "AUTO_PAYROLL", notes: "Pinjaman karyawan." });

  const [backupFileName, setBackupFileName] = useState("");
  const [backupObject, setBackupObject] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importConfirmation, setImportConfirmation] = useState("");
  const [importing, setImporting] = useState(false);

  const access = data?.access || {};
  const fullPayrollAccess = Boolean(access.full_payroll_access);
  const employees = useMemo(() => asArray(data?.employees).map(normalizeEmployee), [data]);
  const locations = useMemo(() => asArray(data?.locations), [data]);
  const wallets = useMemo(() => asArray(data?.wallets), [data]);
  const attendanceRows = useMemo(() => asArray(data?.attendance_rows), [data]);
  const advances = useMemo(() => asArray(data?.kasbon_rows), [data]);
  const loans = useMemo(() => asArray(data?.loan_rows), [data]);
  const payrollRows = useMemo(() => asArray(data?.payroll_recaps), [data]);
  const importBatches = useMemo(() => asArray(data?.import_batches), [data]);
  const summary = data?.summary || {};

  const selectedAttendance = useMemo(() => attendanceRows.filter((row) => String(row.employee_id) === String(selectedEmployee?.employee_id)), [attendanceRows, selectedEmployee]);
  const selectedAdvances = useMemo(() => advances.filter((row) => String(row.employee_id) === String(selectedEmployee?.employee_id)), [advances, selectedEmployee]);
  const selectedLoans = useMemo(() => loans.filter((row) => String(row.employee_id) === String(selectedEmployee?.employee_id)), [loans, selectedEmployee]);
  const selectedPayroll = useMemo(() => payrollRows.filter((row) => String(row.employee_id) === String(selectedEmployee?.employee_id)), [payrollRows, selectedEmployee]);

  async function loadData({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const health = await hrdPayrollHealth(token, {});
      if (isAuthRequired(health)) {
        onSessionExpired?.();
        return;
      }
      if (!health?.success) throw new Error(health?.message || "Fondasi HRD belum dapat dibaca.");
      const bootstrapPayload = {
        period,
        ...(locationId && locationId !== "ALL" ? { location_id: locationId } : {}),
      };
      const result = await getHRDPayrollBootstrap(token, bootstrapPayload);
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) throw new Error(result?.message || "Data HRD gagal dibaca.");
      setData(result.data || {});
      const rows = asArray(result?.data?.employees).map(normalizeEmployee);
      setSelectedEmployee((current) => current ? (rows.find((row) => row.employee_id === current.employee_id) || null) : null);
    } catch (err) {
      setError(err?.message || "Data HRD gagal dibaca.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, locationId]);

  useEffect(() => {
    const map = { dashboard: "board", employees: "employees", attendance: "attendance", loans: "ledger", payroll: "process", report: "history" };
    setActiveTab(map[viewMode] || "board");
  }, [viewMode]);

  useEffect(() => {
    if (!selectedEmployee) return;
    setAttendanceForm((prev) => ({ ...prev, employee_id: selectedEmployee.employee_id }));
    setAdvanceForm((prev) => ({ ...prev, employee_id: selectedEmployee.employee_id }));
    setLoanForm((prev) => ({ ...prev, employee_id: selectedEmployee.employee_id }));
  }, [selectedEmployee]);

  async function runWrite(action, payload, prefix, successMessage) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await action(token, { ...payload, operation_id: makeOperationId(prefix), request_id: makeOperationId("REQ") });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return false;
      }
      if (!result?.success) throw new Error(result?.message || "Penyimpanan gagal.");
      setNotice(result?.message || successMessage);
      await loadData({ quiet: true });
      return true;
    } catch (err) {
      setError(err?.message || "Penyimpanan gagal.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitEmployee(event) {
    event.preventDefault();
    const ok = await runWrite(createHRDEmployee, employeeForm, "EMP", "Karyawan berhasil dibuat.");
    if (ok) setEmployeeForm((prev) => ({ ...prev, employee_name: "", base_salary: "0", daily_salary: "0", fixed_allowance: "0", notes: "Karyawan aktif." }));
    return ok;
  }

  async function submitAttendance(event) {
    event.preventDefault();
    return runWrite(createHRDAttendance, attendanceForm, "ABS", "Absensi berhasil disimpan.");
  }

  async function submitAdvance(event) {
    event.preventDefault();
    const ok = await runWrite(createHRDKasbonNote, advanceForm, "KASBON", "Kasbon berhasil disimpan.");
    if (ok) setAdvanceForm((prev) => ({ ...prev, amount: "0", notes: "Kasbon karyawan." }));
    return ok;
  }

  async function submitLoan(event) {
    event.preventDefault();
    const ok = await runWrite(createHRDLoanNote, loanForm, "LOAN", "Pinjaman berhasil dibuat.");
    if (ok) setLoanForm((prev) => ({ ...prev, amount: "0", tenor_total: "0", installment_amount: "0", notes: "Pinjaman karyawan." }));
    return ok;
  }

  async function handleBackupFile(event) {
    const file = event.target.files?.[0];
    setBackupObject(null);
    setImportPreview(null);
    setImportConfirmation("");
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setBackupFileName(file.name);
      setBackupObject(parsed);
      setNotice(`File ${file.name} berhasil dibaca. Klik Preview Import.`);
      setError("");
    } catch (err) {
      setError(`File backup tidak valid: ${err?.message || "JSON gagal dibaca"}`);
    }
  }

  async function previewImport() {
    if (!backupObject) {
      setError("Pilih file Backup Payroll JSON terlebih dahulu.");
      return;
    }
    setImporting(true);
    setError("");
    try {
      const result = await previewHRDPayrollV32Import(token, { backup: backupObject, file_name: backupFileName });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) throw new Error(result?.message || "Preview import gagal.");
      setImportPreview(result.data || null);
      setNotice("Preview selesai. Belum ada satu pun row yang ditulis.");
    } catch (err) {
      setError(err?.message || "Preview import gagal.");
    } finally {
      setImporting(false);
    }
  }

  async function executeImport() {
    if (!backupObject || !importPreview) return;
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const result = await importHRDPayrollV32Backup(token, {
        backup: backupObject,
        file_name: backupFileName,
        confirmation: importConfirmation,
        operation_id: makeOperationId("HRDIMP"),
        request_id: makeOperationId("REQ"),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) throw new Error(result?.message || "Import gagal.");
      setNotice(result?.message || "Import berhasil.");
      setImportPreview(null);
      setImportConfirmation("");
      await loadData({ quiet: true });
    } catch (err) {
      setError(err?.message || "Import gagal.");
    } finally {
      setImporting(false);
    }
  }

  const employeeColumns = [
    { key: "employee_name", label: "Karyawan", render: (row) => <div><strong>{row.employee_name}</strong><div className="da-muted">{row.employee_code}</div></div> },
    { key: "location", label: "Lokasi", render: (row) => <div>{row.location_name}<div className="da-muted">{row.location_code}</div></div> },
    { key: "payroll_day", label: "Tgl Gajian", render: (row) => `Tgl ${row.payroll_day}` },
    ...(fullPayrollAccess ? [{ key: "base_salary", label: "Gaji Pokok", render: (row) => formatRupiah(row.base_salary || 0) }] : []),
    { key: "advance_balance", label: "Sisa Kasbon", render: (row) => <strong style={{ color: row.advance_balance > 0 ? "#dc2626" : "#059669" }}>{formatRupiah(row.advance_balance)}</strong> },
    { key: "loan_balance", label: "Sisa Pinjaman", render: (row) => <strong style={{ color: row.loan_balance > 0 ? "#dc2626" : "#059669" }}>{formatRupiah(row.loan_balance)}</strong> },
    { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.employment_status)}>{row.employment_status}</Badge> },
  ];

  const attendanceColumns = [
    { key: "attendance_date", label: "Tanggal", render: (row) => formatDate(row.attendance_date) },
    { key: "employee_name", label: "Karyawan" },
    { key: "attendance_type", label: "Status", render: (row) => <Badge tone={badgeTone(row.attendance_type)}>{String(row.attendance_type).replaceAll("_", " ")}</Badge> },
    { key: "day_fraction", label: "Hari", render: (row) => numberValue(row.day_fraction) },
    { key: "deduct_salary", label: "Potong Gaji", render: (row) => Number(row.deduct_salary) === 1 ? "Ya" : "Tidak" },
    { key: "notes", label: "Catatan" },
  ];

  const payrollColumns = [
    { key: "employee_name", label: "Karyawan" },
    { key: "location_name", label: "Lokasi" },
    { key: "payroll_day", label: "Tgl" },
    { key: "total_income", label: "Pendapatan", render: (row) => formatRupiah(numberValue(row.total_income)) },
    { key: "total_deduction", label: "Potongan", render: (row) => formatRupiah(numberValue(row.total_deduction)) },
    { key: "net_pay", label: "THP", render: (row) => <strong style={{ color: "#059669" }}>{formatRupiah(numberValue(row.net_pay))}</strong> },
    { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status}</Badge> },
  ];

  if (loading) return <div className="da-page"><Card>Memuat HRD / Payroll PHP/MySQL…</Card></div>;

  const viewMeta = {
    dashboard: ["Dashboard HRD", "Pusat kontrol karyawan, absensi, kasbon, cicilan dan payroll seluruh lokasi."],
    employees: ["Data Karyawan", "Profil karyawan, lokasi kerja, tanggal gajian, status dan buku catatan personal."],
    attendance: ["Absensi & Izin", "Catat kehadiran dan izin, lalu pantau dampaknya ke payroll tanpa mengulang input."],
    loans: ["Kasbon & Cicilan", "Pantau outstanding karyawan dan catat kasbon atau pinjaman dari dompet lokasi."],
    payroll: ["Payroll & Slip Gaji", "Draft THP, preview backend, slip V32, closing dan pembayaran gaji dari satu workspace."],
    report: ["Rekap Payroll", "Rekap per periode/lokasi, histori closing, pembayaran dan cetak A4 payroll."],
  }[viewMode] || ["HRD & Payroll", "Operasional HRD Dimsum Aditya."];

  const attendanceCount = (type) => attendanceRows.filter((row) => String(row.attendance_type || "").toUpperCase() === type).length;
  const attendanceIssueCount = attendanceRows.filter((row) => ["IZIN", "SAKIT", "TIDAK_MASUK", "CUTI"].includes(String(row.attendance_type || "").toUpperCase())).length;
  const activeEmployees = employees.filter((row) => String(row.employment_status || "ACTIVE").toUpperCase() === "ACTIVE");
  const payrollDrafts = payrollRows.filter((row) => String(row.status || "").toUpperCase() === "DRAFT");
  const recentEmployees = activeEmployees.slice(0, 6);
  const recentAttendance = attendanceRows.slice(0, 8);

  const calendarDate = (() => {
    const [year, month] = String(period || monthInput()).split("-").map(Number);
    return { year: year || new Date().getFullYear(), month: (month || new Date().getMonth() + 1) - 1 };
  })();
  const calendarStart = new Date(calendarDate.year, calendarDate.month, 1);
  const calendarDays = [];
  const mondayOffset = (calendarStart.getDay() + 6) % 7;
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(calendarDate.year, calendarDate.month, 1 - mondayOffset + i);
    const iso = d.toISOString().slice(0, 10);
    const count = attendanceRows.filter((row) => String(row.attendance_date || "").slice(0, 10) === iso).length;
    calendarDays.push({ key: iso, day: d.getDate(), outside: d.getMonth() !== calendarDate.month, count });
  }

  const toolbar = (
    <div className="da-hrd-toolbar-v3">
      <div className="da-hrd-toolbar-fields-v3">
        <label className="da-field"><span>Periode</span><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
        {fullPayrollAccess ? <label className="da-field"><span>Lokasi</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="ALL">Semua lokasi</option>{locations.map((row) => <option key={row.location_id} value={row.location_id}>{row.location_name} · {row.location_code}</option>)}</select></label> : <div />}
      </div>
      <div className="da-hrd-toolbar-actions-v3">
        <Badge tone={data?.health?.ready ? "success" : "danger"}>{data?.health?.ready ? "HRD Siap" : "HRD Belum Siap"}</Badge>
        <Button variant="secondary" onClick={() => loadData()}>Refresh Data</Button>
      </div>
    </div>
  );

  return (
    <div className="da-page da-hrd-v3">
      <div className="da-page-heading">
        <div><div className="da-eyebrow">HRD & PAYROLL</div><h1>{viewMeta[0]}</h1><p>{viewMeta[1]}</p></div>
      </div>

      <Card className="da-full-width">{toolbar}{error ? <NoticeBox tone="danger">{error}</NoticeBox> : null}{notice ? <NoticeBox tone="success">{notice}</NoticeBox> : null}</Card>

      {viewMode === "dashboard" ? <>
        <div className="da-stat-grid">
          <StatCard label="Karyawan Aktif" value={summary.active_employee_count || 0} helper={`${summary.employee_count || 0} total master.`} />
          <StatCard label="Absensi Perlu Dilihat" value={attendanceIssueCount} helper={`${attendanceRows.length} catatan periode ini.`} tone={attendanceIssueCount ? "warning" : "success"} />
          <StatCard label="Sisa Kasbon" value={formatRupiah(summary.open_advance_amount || 0)} helper="Saldo ledger kasbon terbuka." tone="warning" />
          <StatCard label="Payroll Closing" value={summary.payroll_closed_count || 0} helper={`${summary.payroll_draft_count || 0} masih draft.`} tone="success" />
        </div>
        <div className="da-hrd-dashboard-grid-v3">
          <section className="da-hrd-panel-v3">
            <div className="da-hrd-panel-head-v3"><div><h3>Ringkasan Operasional HRD</h3><p>Angka periode {period} dari sumber PHP/MySQL.</p></div><Badge tone="success">Aktual</Badge></div>
            <div className="da-hrd-mini-grid-v3">
              <StatCard label="Total THP" value={fullPayrollAccess ? formatRupiah(summary.payroll_total_net_pay || 0) : "Terkunci"} helper="Histori payroll periode." tone="success" />
              <StatCard label="Belum Closing" value={fullPayrollAccess ? summary.payroll_draft_count || 0 : "—"} helper="Draft menunggu pemeriksaan." tone="warning" />
              <StatCard label="Sisa Pinjaman" value={formatRupiah(summary.open_loan_amount || 0)} helper="Pinjaman panjang berjalan." tone="warning" />
              <StatCard label="Lokasi Terhubung" value={summary.location_count || 0} helper="Lokasi sesuai hak akses." />
            </div>
            <div style={{marginTop:12}}><DataTable columns={employeeColumns.slice(0, 4)} rows={recentEmployees} getRowKey={(row) => row.employee_id} onRowClick={(row) => { setSelectedEmployee(row); setDetailTab("overview"); }} /></div>
          </section>
          <aside className="da-hrd-panel-v3">
            <div className="da-hrd-panel-head-v3"><div><h3>Perlu Perhatian</h3><p>Ringkasan yang perlu dicek Owner/HRD.</p></div></div>
            <div className="da-hrd-attention-v3">
              <div className="da-hrd-attention-row-v3"><span>Payroll belum closing</span><strong>{payrollDrafts.length}</strong></div>
              <div className="da-hrd-attention-row-v3"><span>Catatan izin / sakit / tidak masuk</span><strong>{attendanceIssueCount}</strong></div>
              <div className="da-hrd-attention-row-v3"><span>Kasbon outstanding</span><strong>{formatRupiah(summary.open_advance_amount || 0)}</strong></div>
              <div className="da-hrd-attention-row-v3"><span>Pinjaman outstanding</span><strong>{formatRupiah(summary.open_loan_amount || 0)}</strong></div>
            </div>
            <div style={{marginTop:14}}><div className="da-hrd-panel-head-v3"><div><h3>Absensi Terbaru</h3></div></div><DataTable columns={attendanceColumns.slice(0, 3)} rows={recentAttendance} getRowKey={(row) => row.attendance_id} /></div>
          </aside>
        </div>
      </> : null}

      {viewMode === "employees" ? <>
        <div className="da-stat-grid">
          <StatCard label="Karyawan Aktif" value={activeEmployees.length} helper="Status kerja aktif." tone="success" />
          <StatCard label="Total Master" value={employees.length} helper="Semua status karyawan." />
          <StatCard label="Kasbon Terbuka" value={formatRupiah(summary.open_advance_amount || 0)} helper="Dari ledger karyawan." tone="warning" />
          <StatCard label="Pinjaman Terbuka" value={formatRupiah(summary.open_loan_amount || 0)} helper="Sisa pinjaman panjang." tone="warning" />
        </div>
        <Card className="da-full-width" title="Daftar Karyawan" description="Klik karyawan untuk membuka profil, absensi, kasbon, pinjaman dan payroll dalam popup." action={fullPayrollAccess ? <Button onClick={() => setEmployeeModalOpen(true)}>+ Tambah Karyawan</Button> : null}>
          {!fullPayrollAccess ? <NoticeBox>Nominal gaji tidak ditampilkan untuk akun cabang. Cabang tetap dapat melihat karyawan sesuai scope.</NoticeBox> : null}
          <DataTable columns={employeeColumns} rows={employees} getRowKey={(row) => row.employee_id} onRowClick={(row) => { setSelectedEmployee(row); setDetailTab("overview"); }} />
        </Card>
      </> : null}

      {viewMode === "attendance" ? <>
        <div className="da-stat-grid">
          <StatCard label="Hadir" value={attendanceCount("HADIR")} helper={`Periode ${period}.`} tone="success" />
          <StatCard label="Izin / Sakit" value={attendanceCount("IZIN") + attendanceCount("SAKIT")} helper="Catatan izin dan sakit." tone="warning" />
          <StatCard label="Tidak Masuk" value={attendanceCount("TIDAK_MASUK")} helper="Perlu dicek dampak payroll." tone={attendanceCount("TIDAK_MASUK") ? "danger" : "success"} />
          <StatCard label="Cuti" value={attendanceCount("CUTI")} helper="Cuti periode berjalan." />
        </div>
        <div className="da-hrd-dashboard-grid-v3">
          <section className="da-hrd-panel-v3">
            <div className="da-hrd-panel-head-v3"><div><h3>Catatan Absensi</h3><p>Klik data karyawan dari menu Data Karyawan untuk histori personal.</p></div><Button onClick={() => setAttendanceModalOpen(true)}>+ Catat Absensi</Button></div>
            <DataTable columns={attendanceColumns} rows={attendanceRows} getRowKey={(row) => row.attendance_id} />
          </section>
          <aside className="da-hrd-panel-v3">
            <div className="da-hrd-panel-head-v3"><div><h3>Kalender {period}</h3><p>Titik merah menandakan ada catatan absensi.</p></div></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:6}}>{["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((d)=><strong key={d} style={{textAlign:"center",fontSize:8,color:"#98A2B3"}}>{d}</strong>)}</div>
            <div className="da-hrd-calendar-v3">{calendarDays.map((d)=><div key={d.key} className={`da-hrd-calendar-day-v3 ${d.outside ? "is-outside" : ""} ${d.count ? "has-data" : ""}`}><span>{d.day}</span>{d.count ? <i className="da-hrd-calendar-dot-v3" title={`${d.count} catatan`} /> : null}</div>)}</div>
            <NoticeBox>Absensi tersimpan sebagai sumber payroll. Status tidak otomatis memotong gaji kecuali field potong gaji diaktifkan sesuai keputusan operasional.</NoticeBox>
          </aside>
        </div>
      </> : null}

      {viewMode === "loans" ? <>
        <div className="da-stat-grid">
          <StatCard label="Sisa Kasbon" value={formatRupiah(summary.open_advance_amount || 0)} helper={`${advances.length} gerakan ledger.`} tone="warning" />
          <StatCard label="Sisa Pinjaman" value={formatRupiah(summary.open_loan_amount || 0)} helper={`${loans.length} pinjaman tercatat.`} tone="warning" />
          <StatCard label="Karyawan Aktif" value={activeEmployees.length} helper="Basis limit kasbon." />
          <StatCard label="Dompet Tersedia" value={wallets.length} helper="Sumber pencairan sesuai lokasi." />
        </div>
        <div className="da-hrd-split-list-v3">
          <section className="da-hrd-panel-v3"><div className="da-hrd-panel-head-v3"><div><h3>Kasbon Bulanan</h3><p>Kasbon baru membuat Wallet OUT dan piutang karyawan.</p></div><Button onClick={() => setAdvanceModalOpen(true)}>+ Kasbon</Button></div><DataTable columns={[{ key: "entry_date", label: "Tanggal", render: (row) => formatDate(row.entry_date) }, { key: "employee_name", label: "Karyawan" }, { key: "amount", label: "Nominal", render: (row) => formatRupiah(numberValue(row.amount)) }, { key: "notes", label: "Catatan" }]} rows={advances} getRowKey={(row) => row.advance_entry_id} /></section>
          <section className="da-hrd-panel-v3"><div className="da-hrd-panel-head-v3"><div><h3>Pinjaman & Cicilan</h3><p>Saldo berjalan dan cicilan wajib per periode.</p></div><Button onClick={() => setLoanModalOpen(true)}>+ Pinjaman</Button></div><DataTable columns={[{ key: "employee_name", label: "Karyawan" }, { key: "original_amount", label: "Awal", render: (row) => formatRupiah(numberValue(row.original_amount)) }, { key: "remaining_amount", label: "Sisa", render: (row) => <strong>{formatRupiah(numberValue(row.remaining_amount))}</strong> }, { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status}</Badge> }]} rows={loans} getRowKey={(row) => row.loan_id} /></section>
        </div>
      </> : null}

      {viewMode === "payroll" && fullPayrollAccess ? <>
        <Card className="da-full-width">
          <div className="da-hrd-panel-head-v3"><div><h3>Workspace Payroll</h3><p>Proses THP/slip dan pembayaran dipisah agar alurnya tidak menumpuk dalam satu halaman.</p></div><div style={{display:"flex",gap:7}}><Button variant={payrollSubMode === "process" ? "primary" : "secondary"} onClick={() => setPayrollSubMode("process")}>Proses & Slip</Button><Button variant={payrollSubMode === "payment" ? "primary" : "secondary"} onClick={() => setPayrollSubMode("payment")}>Pembayaran Gaji</Button></div></div>
          <PayrollFinalPanel session={session} period={period} locationId={locationId} baseEmployees={employees} mode={payrollSubMode} onSessionExpired={onSessionExpired} onChanged={() => loadData({ quiet: true })} />
        </Card>
      </> : null}

      {viewMode === "report" && fullPayrollAccess ? <>
        <div className="da-stat-grid">
          <StatCard label="Closing" value={summary.payroll_closed_count || 0} helper={`Periode ${period}.`} tone="success" />
          <StatCard label="Draft" value={summary.payroll_draft_count || 0} helper="Belum dikunci." tone="warning" />
          <StatCard label="Total THP" value={formatRupiah(summary.payroll_total_net_pay || 0)} helper="Rekap histori periode." tone="success" />
          <StatCard label="Import Histori" value={importBatches.length} helper="Batch migrasi V32 tercatat." />
        </div>
        <Card className="da-full-width" title="Rekap & Histori Payroll" description="Klik baris untuk membuka profil payroll karyawan. Cetak A4 tersedia pada pusat rekap." action={<Button variant="secondary" onClick={() => setImportModalOpen(true)}>Import V32</Button>}>
          <PayrollFinalPanel session={session} period={period} locationId={locationId} baseEmployees={employees} mode="report" onSessionExpired={onSessionExpired} onChanged={() => loadData({ quiet: true })} />
        </Card>
      </> : null}

      <Modal open={employeeModalOpen} title="Tambah Karyawan" subtitle="Master HRD Dimsum Aditya" onClose={() => setEmployeeModalOpen(false)} size="xl">
        <form onSubmit={async (event) => { if (await submitEmployee(event)) setEmployeeModalOpen(false); }} className="da-hrd-modal-form-v3">
          <div className="da-form-grid">
            <label className="da-field"><span>Nama Lengkap</span><input required value={employeeForm.employee_name} onChange={(e) => setEmployeeForm({ ...employeeForm, employee_name: e.target.value })} /></label>
            <label className="da-field"><span>Lokasi</span><select value={employeeForm.location_id} onChange={(e) => setEmployeeForm({ ...employeeForm, location_id: e.target.value })}>{locations.map((row) => <option key={row.location_id} value={row.location_id}>{row.location_name}</option>)}</select></label>
            <label className="da-field"><span>Jabatan</span><input value={employeeForm.position_name} onChange={(e) => setEmployeeForm({ ...employeeForm, position_name: e.target.value })} /></label>
            <label className="da-field"><span>Tanggal Gajian</span><input type="number" min="1" max="31" value={employeeForm.payroll_day} onChange={(e) => setEmployeeForm({ ...employeeForm, payroll_day: e.target.value })} /></label>
            <label className="da-field"><span>Mode Gaji</span><select value={employeeForm.salary_mode} onChange={(e) => setEmployeeForm({ ...employeeForm, salary_mode: e.target.value })}><option value="BULANAN">Bulanan</option><option value="HARIAN">Harian</option></select></label>
            <label className="da-field"><span>Gaji Pokok</span><input inputMode="numeric" value={employeeForm.base_salary} onChange={(e) => setEmployeeForm({ ...employeeForm, base_salary: e.target.value })} /></label>
            <label className="da-field"><span>Gaji Harian</span><input inputMode="numeric" value={employeeForm.daily_salary} onChange={(e) => setEmployeeForm({ ...employeeForm, daily_salary: e.target.value })} /></label>
            <label className="da-field"><span>Tunjangan Tetap</span><input inputMode="numeric" value={employeeForm.fixed_allowance} onChange={(e) => setEmployeeForm({ ...employeeForm, fixed_allowance: e.target.value })} /></label>
          </div><div className="da-form-actions"><Button type="submit" disabled={saving}>Simpan Karyawan</Button></div>
        </form>
      </Modal>

      <Modal open={attendanceModalOpen} title="Catat Absensi / Izin" subtitle={`Periode ${period}`} onClose={() => setAttendanceModalOpen(false)}>
        <form onSubmit={async (event) => { if (await submitAttendance(event)) setAttendanceModalOpen(false); }} className="da-hrd-modal-form-v3">
          <div className="da-form-grid">
            <label className="da-field"><span>Karyawan</span><select required value={attendanceForm.employee_id} onChange={(e) => setAttendanceForm({ ...attendanceForm, employee_id: e.target.value })}><option value="">Pilih karyawan</option>{activeEmployees.map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_name} · {row.location_code}</option>)}</select></label>
            <label className="da-field"><span>Tanggal</span><input type="date" value={attendanceForm.attendance_date} onChange={(e) => setAttendanceForm({ ...attendanceForm, attendance_date: e.target.value })} /></label>
            <label className="da-field"><span>Status</span><select value={attendanceForm.attendance_type} onChange={(e) => setAttendanceForm({ ...attendanceForm, attendance_type: e.target.value, deduct_salary: e.target.value === "TIDAK_MASUK" })}><option value="HADIR">Hadir</option><option value="IZIN">Izin</option><option value="SAKIT">Sakit</option><option value="TIDAK_MASUK">Tidak Masuk</option><option value="CUTI">Cuti</option><option value="DINAS">Dinas</option><option value="SETENGAH_HARI">Setengah Hari</option><option value="LIBUR">Libur</option><option value="LEMBUR">Lembur</option></select></label>
            <label className="da-field"><span>Nilai Hari</span><input type="number" step="0.5" min="0" max="1" value={attendanceForm.day_fraction} onChange={(e) => setAttendanceForm({ ...attendanceForm, day_fraction: e.target.value })} /></label>
            <label className="da-field"><span>Uang Lembur</span><input inputMode="numeric" value={attendanceForm.overtime_amount} onChange={(e) => setAttendanceForm({ ...attendanceForm, overtime_amount: e.target.value })} /></label>
            <label className="da-field"><span>Catatan</span><input value={attendanceForm.notes} onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })} /></label>
          </div><label style={{display:"flex",alignItems:"center",gap:8,fontWeight:800}}><input type="checkbox" checked={attendanceForm.deduct_salary} onChange={(e) => setAttendanceForm({ ...attendanceForm, deduct_salary: e.target.checked })} /> Dihitung sebagai hari potong gaji</label><div className="da-form-actions"><Button type="submit" disabled={saving}>Simpan Absensi</Button></div>
        </form>
      </Modal>

      <Modal open={advanceModalOpen} title="Kasbon Karyawan" subtitle="Wallet OUT + Piutang Kasbon" onClose={() => setAdvanceModalOpen(false)}>
        <form onSubmit={async (event) => { if (await submitAdvance(event)) setAdvanceModalOpen(false); }} className="da-hrd-modal-form-v3">
          <label className="da-field"><span>Karyawan</span><select required value={advanceForm.employee_id} onChange={(e) => setAdvanceForm({ ...advanceForm, employee_id: e.target.value })}><option value="">Pilih karyawan</option>{activeEmployees.map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_name}</option>)}</select></label>
          <label className="da-field"><span>Dompet Pengeluaran</span><select required value={advanceForm.wallet_id} onChange={(e) => setAdvanceForm({ ...advanceForm, wallet_id: e.target.value })}><option value="">Pilih dompet lokasi</option>{wallets.filter((row) => !advanceForm.employee_id || row.location_id === employees.find((emp) => emp.employee_id === advanceForm.employee_id)?.location_id).map((row) => <option key={row.wallet_id} value={row.wallet_id}>{row.wallet_name} · {row.location_code} · {formatRupiah(row.current_balance || 0)}</option>)}</select></label>
          <div className="da-form-grid"><label className="da-field"><span>Tanggal</span><input type="date" value={advanceForm.date} onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })} /></label><label className="da-field"><span>Nominal</span><input required inputMode="numeric" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} /></label></div>
          <label className="da-field"><span>Keterangan</span><input value={advanceForm.notes} onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })} /></label><div className="da-form-actions"><Button type="submit" disabled={saving}>Catat Kasbon</Button></div>
        </form>
      </Modal>

      <Modal open={loanModalOpen} title="Pinjaman / Cicilan Karyawan" subtitle="Wallet OUT + Jadwal Cicilan" onClose={() => setLoanModalOpen(false)} size="xl">
        <form onSubmit={async (event) => { if (await submitLoan(event)) setLoanModalOpen(false); }} className="da-hrd-modal-form-v3">
          <div className="da-form-grid">
            <label className="da-field"><span>Karyawan</span><select required value={loanForm.employee_id} onChange={(e) => setLoanForm({ ...loanForm, employee_id: e.target.value })}><option value="">Pilih karyawan</option>{activeEmployees.map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_name}</option>)}</select></label>
            <label className="da-field"><span>Dompet Pengeluaran</span><select required value={loanForm.wallet_id} onChange={(e) => setLoanForm({ ...loanForm, wallet_id: e.target.value })}><option value="">Pilih dompet lokasi</option>{wallets.filter((row) => !loanForm.employee_id || row.location_id === employees.find((emp) => emp.employee_id === loanForm.employee_id)?.location_id).map((row) => <option key={row.wallet_id} value={row.wallet_id}>{row.wallet_name} · {row.location_code}</option>)}</select></label>
            <label className="da-field"><span>Tanggal</span><input type="date" value={loanForm.loan_date} onChange={(e) => setLoanForm({ ...loanForm, loan_date: e.target.value })} /></label>
            <label className="da-field"><span>Nominal</span><input required inputMode="numeric" value={loanForm.amount} onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })} /></label>
            <label className="da-field"><span>Tenor</span><input type="number" min="0" max="120" value={loanForm.tenor_total} onChange={(e) => setLoanForm({ ...loanForm, tenor_total: e.target.value })} /></label>
            <label className="da-field"><span>Cicilan / Bulan</span><input inputMode="numeric" value={loanForm.installment_amount} onChange={(e) => setLoanForm({ ...loanForm, installment_amount: e.target.value })} /></label>
            <label className="da-field"><span>Mulai Potong</span><input type="month" value={loanForm.start_period} onChange={(e) => setLoanForm({ ...loanForm, start_period: e.target.value })} /></label>
            <label className="da-field"><span>Keterangan</span><input value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} /></label>
          </div><div className="da-form-actions"><Button type="submit" disabled={saving}>Buat Pinjaman</Button></div>
        </form>
      </Modal>

      <Modal open={importModalOpen} title="Import Backup Payroll V32" subtitle="Admin tool — histori tidak membuat mutasi uang baru" onClose={() => setImportModalOpen(false)} size="xl">
        <div className="da-hrd-modal-form-v3"><input type="file" accept="application/json,.json" onChange={handleBackupFile} /><Button variant="secondary" onClick={previewImport} disabled={!backupObject || importing}>{importing ? "Memeriksa…" : "Preview Import"}</Button>{importPreview ? <><div className="da-stat-grid"><StatCard label="Karyawan" value={importPreview.summary?.employee_count || 0} /><StatCard label="Payroll Closing" value={importPreview.summary?.payroll_closed_count || 0} tone="success" /><StatCard label="Baris Kasbon" value={importPreview.summary?.advance_entry_count || 0} tone="warning" /><StatCard label="Gerakan Pinjaman" value={importPreview.summary?.loan_movement_count || 0} tone="warning" /></div>{asArray(importPreview.warnings).map((warning) => <NoticeBox key={warning}>{warning}</NoticeBox>)}{asArray(importPreview.errors).map((item) => <NoticeBox key={item} tone="danger">{item}</NoticeBox>)}{!importPreview.already_imported && importPreview.ready_to_import ? <><label className="da-field"><span>Ketik persis: IMPORT PAYROLL V32</span><input value={importConfirmation} onChange={(e) => setImportConfirmation(e.target.value)} /></label><Button onClick={executeImport} disabled={importing || importConfirmation !== "IMPORT PAYROLL V32"}>Import Riwayat</Button></> : null}</> : null}</div>
      </Modal>

      <Modal open={Boolean(selectedEmployee)} title={selectedEmployee?.employee_name || "Detail Karyawan"} subtitle={`${selectedEmployee?.location_name || ""} · Tanggal gajian ${selectedEmployee?.payroll_day || "-"}`} onClose={() => setSelectedEmployee(null)} size="xl">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {[["overview","Ringkasan"],["attendance","Absensi"],["advance","Kasbon"],["loan","Pinjaman"], ...(fullPayrollAccess ? [["payroll","Payroll"]] : [])].map(([key,label]) => <button key={key} type="button" onClick={() => setDetailTab(key)} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 11px", cursor: "pointer", fontWeight: 850, background: detailTab === key ? "#fef2f2" : "#fff", color: detailTab === key ? "#b91c1c" : "#374151" }}>{label}</button>)}
        </div>
        {detailTab === "overview" ? <div className="da-detail-grid"><div className="da-detail-box"><span className="da-muted">Employee ID</span><strong style={{display:"block"}}>{selectedEmployee?.employee_id}</strong></div><div className="da-detail-box"><span className="da-muted">Status</span><strong style={{display:"block"}}>{selectedEmployee?.employment_status}</strong></div><div className="da-detail-box"><span className="da-muted">Gaji</span><strong style={{display:"block"}}>{fullPayrollAccess ? formatRupiah(selectedEmployee?.base_salary || 0) : "Terkunci"}</strong></div><div className="da-detail-box"><span className="da-muted">Sisa Kasbon</span><strong style={{display:"block",color:"#dc2626"}}>{formatRupiah(selectedEmployee?.advance_balance || 0)}</strong></div><div className="da-detail-box"><span className="da-muted">Sisa Pinjaman</span><strong style={{display:"block",color:"#dc2626"}}>{formatRupiah(selectedEmployee?.loan_balance || 0)}</strong></div></div> : null}
        {detailTab === "attendance" ? <DataTable columns={attendanceColumns} rows={selectedAttendance} getRowKey={(row) => row.attendance_id} /> : null}
        {detailTab === "advance" ? <DataTable columns={[{ key: "entry_date", label: "Tanggal", render: (row) => formatDate(row.entry_date) }, { key: "entry_type", label: "Jenis" }, { key: "amount", label: "Nominal", render: (row) => formatRupiah(numberValue(row.amount)) }, { key: "notes", label: "Catatan" }]} rows={selectedAdvances} getRowKey={(row) => row.advance_entry_id} /> : null}
        {detailTab === "loan" ? <DataTable columns={[{ key: "loan_date", label: "Tanggal", render: (row) => formatDate(row.loan_date) }, { key: "original_amount", label: "Awal", render: (row) => formatRupiah(numberValue(row.original_amount)) }, { key: "remaining_amount", label: "Sisa", render: (row) => formatRupiah(numberValue(row.remaining_amount)) }, { key: "installment_amount", label: "Cicilan", render: (row) => formatRupiah(numberValue(row.installment_amount)) }]} rows={selectedLoans} getRowKey={(row) => row.loan_id} /> : null}
        {detailTab === "payroll" && fullPayrollAccess ? <DataTable columns={payrollColumns} rows={selectedPayroll} getRowKey={(row) => row.payroll_run_id} /> : null}
      </Modal>
    </div>
  );
}
