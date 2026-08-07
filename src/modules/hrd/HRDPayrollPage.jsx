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

export default function HRDPayrollPage({ session, onSessionExpired }) {
  const token = session?.sessionToken || session?.session_token || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(monthInput());
  const [locationId, setLocationId] = useState("ALL");
  const [activeTab, setActiveTab] = useState("board");
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
  }

  async function submitAttendance(event) {
    event.preventDefault();
    await runWrite(createHRDAttendance, attendanceForm, "ABS", "Absensi berhasil disimpan.");
  }

  async function submitAdvance(event) {
    event.preventDefault();
    const ok = await runWrite(createHRDKasbonNote, advanceForm, "KASBON", "Kasbon berhasil disimpan.");
    if (ok) setAdvanceForm((prev) => ({ ...prev, amount: "0", notes: "Kasbon karyawan." }));
  }

  async function submitLoan(event) {
    event.preventDefault();
    const ok = await runWrite(createHRDLoanNote, loanForm, "LOAN", "Pinjaman berhasil dibuat.");
    if (ok) setLoanForm((prev) => ({ ...prev, amount: "0", tenor_total: "0", installment_amount: "0", notes: "Pinjaman karyawan." }));
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

  return (
    <div className="da-page">
      <div className="da-page-heading">
        <div>
          <div className="da-eyebrow">Dimsum Aditya</div>
          <h1>HRD / Payroll</h1>
          <p>Interface dan aturan kerja mengikuti Payroll V32. Data hidup disimpan di PHP/MySQL dan dikunci per lokasi.</p>
        </div>
        <Badge tone={data?.health?.ready ? "success" : "danger"}>{data?.health?.ready ? "HRD Siap" : "Mesin HRD Belum Siap"}</Badge>
      </div>

      <FlowCard />

      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div className="da-eyebrow">HRD & PAYROLL</div>
            <h2 style={{ margin: "4px 0" }}>Papan Payroll & Buku Karyawan</h2>
            <p className="da-muted">Cabang tidak melihat gaji/THP. Owner/Tangerang memegang payroll, closing, dan pembayaran.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Badge tone="success">Mesin Payroll Aktif</Badge>
            <Badge tone={data?.health?.latest_import ? "success" : "warning"}>{data?.health?.latest_import ? "Riwayat Payroll Tersedia" : "Riwayat Payroll Belum Diimpor"}</Badge>
            <Button variant="secondary" onClick={() => loadData()}>Refresh Data</Button>
          </div>
        </div>
        {error ? <NoticeBox tone="danger">{error}</NoticeBox> : null}
        {notice ? <NoticeBox tone="success">{notice}</NoticeBox> : null}
      </Card>

      <div className="da-stat-grid">
        <StatCard label="Karyawan Aktif" value={summary.active_employee_count || 0} helper={`${summary.employee_count || 0} total master.`} />
        <StatCard label="Sisa Kasbon" value={formatRupiah(summary.open_advance_amount || 0)} helper="Saldo ledger kasbon terbuka." tone="warning" />
        <StatCard label="Sisa Pinjaman" value={formatRupiah(summary.open_loan_amount || 0)} helper="Pinjaman panjang berjalan." tone="warning" />
        <StatCard label="Sudah Closing" value={summary.payroll_closed_count || 0} helper={`Periode ${period}.`} tone="success" />
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 16 }}>
          <label className="da-field"><span>Periode</span><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
          {fullPayrollAccess ? (
            <label className="da-field"><span>Lokasi</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="ALL">Semua lokasi</option>{locations.map((row) => <option key={row.location_id} value={row.location_id}>{row.location_name} · {row.location_code}</option>)}</select></label>
          ) : null}
        </div>
        <SectionTabs active={activeTab} onChange={setActiveTab} fullPayrollAccess={fullPayrollAccess} />

        {activeTab === "board" ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 18, padding: 18 }}><div className="da-eyebrow">Total THP histori</div><strong style={{ fontSize: 27, color: "#059669" }}>{fullPayrollAccess ? formatRupiah(summary.payroll_total_net_pay || 0) : "Terkunci Owner"}</strong><p className="da-muted">Snapshot payroll periode terpilih.</p></div>
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 18, padding: 18 }}><div className="da-eyebrow">Belum Closing</div><strong style={{ fontSize: 27 }}>{fullPayrollAccess ? summary.payroll_draft_count || 0 : "—"}</strong><p className="da-muted">Draft aktif siap dicek pada tab Proses Gaji.</p></div>
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18 }}><div className="da-eyebrow">Lokasi terhubung</div><strong style={{ fontSize: 27 }}>{summary.location_count || 0}</strong><p className="da-muted">Tangerang, Pemalang, dan Cibinong sesuai hak akses.</p></div>
            </div>
            <NoticeBox>Payroll operasional aktif: preview dan print tidak mengubah ledger; closing mengunci kasbon/cicilan; pembayaran gaji membuat Wallet OUT dari Tangerang.</NoticeBox>
          </div>
        ) : null}

        {activeTab === "employees" ? (
          <div>
            {fullPayrollAccess ? (
              <form onSubmit={submitEmployee} style={{ marginBottom: 20, padding: 18, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 18 }}>
                <h3 style={{ marginTop: 0 }}>Tambah Karyawan</h3>
                <div className="da-form-grid">
                  <label className="da-field"><span>Nama Lengkap</span><input required value={employeeForm.employee_name} onChange={(e) => setEmployeeForm({ ...employeeForm, employee_name: e.target.value })} /></label>
                  <label className="da-field"><span>Lokasi</span><select value={employeeForm.location_id} onChange={(e) => setEmployeeForm({ ...employeeForm, location_id: e.target.value })}>{locations.map((row) => <option key={row.location_id} value={row.location_id}>{row.location_name}</option>)}</select></label>
                  <label className="da-field"><span>Jabatan</span><input value={employeeForm.position_name} onChange={(e) => setEmployeeForm({ ...employeeForm, position_name: e.target.value })} /></label>
                  <label className="da-field"><span>Tanggal Gajian</span><input type="number" min="1" max="31" value={employeeForm.payroll_day} onChange={(e) => setEmployeeForm({ ...employeeForm, payroll_day: e.target.value })} /></label>
                  <label className="da-field"><span>Mode Gaji</span><select value={employeeForm.salary_mode} onChange={(e) => setEmployeeForm({ ...employeeForm, salary_mode: e.target.value })}><option value="BULANAN">Bulanan</option><option value="HARIAN">Harian</option></select></label>
                  <label className="da-field"><span>Gaji Pokok</span><input inputMode="numeric" value={employeeForm.base_salary} onChange={(e) => setEmployeeForm({ ...employeeForm, base_salary: e.target.value })} /></label>
                  <label className="da-field"><span>Gaji Harian</span><input inputMode="numeric" value={employeeForm.daily_salary} onChange={(e) => setEmployeeForm({ ...employeeForm, daily_salary: e.target.value })} /></label>
                  <label className="da-field"><span>Tunjangan Tetap</span><input inputMode="numeric" value={employeeForm.fixed_allowance} onChange={(e) => setEmployeeForm({ ...employeeForm, fixed_allowance: e.target.value })} /></label>
                </div>
                <Button type="submit" disabled={saving}>Simpan Karyawan</Button>
              </form>
            ) : <NoticeBox>Nominal gaji tidak ditampilkan untuk akun cabang. Cabang tetap dapat membuka daftar karyawan lokasinya serta menginput absensi, kasbon, dan pinjaman.</NoticeBox>}
            <DataTable columns={employeeColumns} rows={employees} getRowKey={(row) => row.employee_id} onRowClick={(row) => { setSelectedEmployee(row); setDetailTab("overview"); }} />
          </div>
        ) : null}

        {activeTab === "attendance" ? (
          <div>
            <form onSubmit={submitAttendance} style={{ marginBottom: 18, padding: 18, background: "#f9fafb", borderRadius: 18, border: "1px solid #e5e7eb" }}>
              <h3 style={{ marginTop: 0 }}>Catat Absensi / Izin</h3>
              <div className="da-form-grid">
                <label className="da-field"><span>Karyawan</span><select required value={attendanceForm.employee_id} onChange={(e) => setAttendanceForm({ ...attendanceForm, employee_id: e.target.value })}><option value="">Pilih karyawan</option>{employees.filter((row) => row.employment_status === "ACTIVE").map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_name} · {row.location_code}</option>)}</select></label>
                <label className="da-field"><span>Tanggal</span><input type="date" value={attendanceForm.attendance_date} onChange={(e) => setAttendanceForm({ ...attendanceForm, attendance_date: e.target.value })} /></label>
                <label className="da-field"><span>Status</span><select value={attendanceForm.attendance_type} onChange={(e) => setAttendanceForm({ ...attendanceForm, attendance_type: e.target.value, deduct_salary: e.target.value === "TIDAK_MASUK" })}><option value="HADIR">Hadir</option><option value="IZIN">Izin</option><option value="SAKIT">Sakit</option><option value="TIDAK_MASUK">Tidak Masuk</option><option value="CUTI">Cuti</option><option value="DINAS">Dinas</option><option value="SETENGAH_HARI">Setengah Hari</option><option value="LIBUR">Libur</option><option value="LEMBUR">Lembur</option></select></label>
                <label className="da-field"><span>Nilai Hari</span><input type="number" step="0.5" min="0" max="1" value={attendanceForm.day_fraction} onChange={(e) => setAttendanceForm({ ...attendanceForm, day_fraction: e.target.value })} /></label>
                <label className="da-field"><span>Uang Lembur</span><input inputMode="numeric" value={attendanceForm.overtime_amount} onChange={(e) => setAttendanceForm({ ...attendanceForm, overtime_amount: e.target.value })} /></label>
                <label className="da-field"><span>Catatan</span><input value={attendanceForm.notes} onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })} /></label>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontWeight: 800 }}><input type="checkbox" checked={attendanceForm.deduct_salary} onChange={(e) => setAttendanceForm({ ...attendanceForm, deduct_salary: e.target.checked })} /> Dihitung sebagai hari potong gaji</label>
              <Button type="submit" disabled={saving}>Simpan Absensi</Button>
            </form>
            <DataTable columns={attendanceColumns} rows={attendanceRows} getRowKey={(row) => row.attendance_id} />
          </div>
        ) : null}

        {activeTab === "ledger" ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 16, marginBottom: 20 }}>
              <form onSubmit={submitAdvance} style={{ padding: 18, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 18 }}>
                <h3 style={{ marginTop: 0 }}>Kasbon Bulanan</h3>
                <p className="da-muted">Kasbon baru langsung membuat Wallet OUT dan Piutang Kasbon Karyawan.</p>
                <label className="da-field"><span>Karyawan</span><select required value={advanceForm.employee_id} onChange={(e) => setAdvanceForm({ ...advanceForm, employee_id: e.target.value })}><option value="">Pilih karyawan</option>{employees.filter((row) => row.employment_status === "ACTIVE").map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_name}</option>)}</select></label>
                <label className="da-field"><span>Dompet Pengeluaran</span><select required value={advanceForm.wallet_id} onChange={(e) => setAdvanceForm({ ...advanceForm, wallet_id: e.target.value })}><option value="">Pilih dompet lokasi</option>{wallets.filter((row) => !advanceForm.employee_id || row.location_id === employees.find((emp) => emp.employee_id === advanceForm.employee_id)?.location_id).map((row) => <option key={row.wallet_id} value={row.wallet_id}>{row.wallet_name} · {row.location_code} · {formatRupiah(row.current_balance || 0)}</option>)}</select></label>
                <label className="da-field"><span>Tanggal</span><input type="date" value={advanceForm.date} onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })} /></label>
                <label className="da-field"><span>Nominal</span><input required inputMode="numeric" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} /></label>
                <label className="da-field"><span>Keterangan</span><input value={advanceForm.notes} onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })} /></label>
                <Button type="submit" disabled={saving}>Catat Kasbon</Button>
              </form>

              <form onSubmit={submitLoan} style={{ padding: 18, border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 18 }}>
                <h3 style={{ marginTop: 0 }}>Pinjaman Panjang / Cicilan</h3>
                <p className="da-muted">Pinjaman baru langsung membuat Wallet OUT dan jadwal cicilan.</p>
                <label className="da-field"><span>Karyawan</span><select required value={loanForm.employee_id} onChange={(e) => setLoanForm({ ...loanForm, employee_id: e.target.value })}><option value="">Pilih karyawan</option>{employees.filter((row) => row.employment_status === "ACTIVE").map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee_name}</option>)}</select></label>
                <label className="da-field"><span>Dompet Pengeluaran</span><select required value={loanForm.wallet_id} onChange={(e) => setLoanForm({ ...loanForm, wallet_id: e.target.value })}><option value="">Pilih dompet lokasi</option>{wallets.filter((row) => !loanForm.employee_id || row.location_id === employees.find((emp) => emp.employee_id === loanForm.employee_id)?.location_id).map((row) => <option key={row.wallet_id} value={row.wallet_id}>{row.wallet_name} · {row.location_code}</option>)}</select></label>
                <div className="da-form-grid">
                  <label className="da-field"><span>Tanggal</span><input type="date" value={loanForm.loan_date} onChange={(e) => setLoanForm({ ...loanForm, loan_date: e.target.value })} /></label>
                  <label className="da-field"><span>Nominal</span><input required inputMode="numeric" value={loanForm.amount} onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })} /></label>
                  <label className="da-field"><span>Tenor</span><input type="number" min="0" max="120" value={loanForm.tenor_total} onChange={(e) => setLoanForm({ ...loanForm, tenor_total: e.target.value })} /></label>
                  <label className="da-field"><span>Cicilan / Bulan</span><input inputMode="numeric" value={loanForm.installment_amount} onChange={(e) => setLoanForm({ ...loanForm, installment_amount: e.target.value })} placeholder="Kosong = otomatis pembulatan 5.000" /></label>
                </div>
                <label className="da-field"><span>Mulai Potong</span><input type="month" value={loanForm.start_period} onChange={(e) => setLoanForm({ ...loanForm, start_period: e.target.value })} /></label>
                <label className="da-field"><span>Keterangan</span><input value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} /></label>
                <Button type="submit" disabled={saving}>Buat Pinjaman</Button>
              </form>
            </div>
            <h3>Kasbon Periode {period}</h3>
            <DataTable columns={[{ key: "entry_date", label: "Tanggal", render: (row) => formatDate(row.entry_date) }, { key: "employee_name", label: "Karyawan" }, { key: "entry_type", label: "Jenis" }, { key: "amount", label: "Nominal", render: (row) => formatRupiah(numberValue(row.amount)) }, { key: "notes", label: "Catatan" }]} rows={advances} getRowKey={(row) => row.advance_entry_id} />
            <h3 style={{ marginTop: 22 }}>Pinjaman Berjalan</h3>
            <DataTable columns={[{ key: "employee_name", label: "Karyawan" }, { key: "loan_date", label: "Tanggal", render: (row) => formatDate(row.loan_date) }, { key: "original_amount", label: "Awal", render: (row) => formatRupiah(numberValue(row.original_amount)) }, { key: "remaining_amount", label: "Sisa", render: (row) => <strong>{formatRupiah(numberValue(row.remaining_amount))}</strong> }, { key: "installment_amount", label: "Cicilan", render: (row) => formatRupiah(numberValue(row.installment_amount)) }, { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status}</Badge> }]} rows={loans} getRowKey={(row) => row.loan_id} />
          </div>
        ) : null}

        {activeTab === "process" && fullPayrollAccess ? (
          <PayrollFinalPanel
            session={session}
            period={period}
            locationId={locationId}
            baseEmployees={employees}
            mode="process"
            onSessionExpired={onSessionExpired}
            onChanged={() => loadData({ quiet: true })}
          />
        ) : null}

        {activeTab === "payment" && fullPayrollAccess ? (
          <PayrollFinalPanel
            session={session}
            period={period}
            locationId={locationId}
            baseEmployees={employees}
            mode="payment"
            onSessionExpired={onSessionExpired}
            onChanged={() => loadData({ quiet: true })}
          />
        ) : null}

        {activeTab === "history" && fullPayrollAccess ? (
          <div>
            <NoticeBox tone="success">Riwayat yang diimpor tetap mempertahankan angka historisnya. Pembayaran lama tidak membuat mutasi dompet baru secara otomatis.</NoticeBox>
            <DataTable columns={payrollColumns} rows={payrollRows} getRowKey={(row) => row.payroll_run_id} onRowClick={(row) => { const employee = employees.find((item) => item.employee_id === row.employee_id); if (employee) { setSelectedEmployee(employee); setDetailTab("payroll"); } }} />
          </div>
        ) : null}

        {activeTab === "import" && fullPayrollAccess ? (
          <div>
            <div style={{ padding: 20, border: "1px dashed #f59e0b", background: "#fffbeb", borderRadius: 18 }}>
              <div className="da-eyebrow">Migrasi dari HTML Payroll V32</div>
              <h3 style={{ margin: "5px 0" }}>Import Backup JSON Resmi</h3>
              <p className="da-muted">Pilih file Backup_Payroll_Dimsum_Aditya_*.json. Preview tidak menulis data. Import histori tidak membuat mutasi uang lama.</p>
              <input type="file" accept="application/json,.json" onChange={handleBackupFile} />
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Button variant="secondary" onClick={previewImport} disabled={!backupObject || importing}>{importing ? "Memeriksa…" : "Preview Import"}</Button>
              </div>
            </div>

            {importPreview ? (
              <div style={{ marginTop: 18 }}>
                <div className="da-stat-grid">
                  <StatCard label="Karyawan" value={importPreview.summary?.employee_count || 0} helper={`${importPreview.summary?.active_employee_count || 0} aktif.`} />
                  <StatCard label="Payroll Closing" value={importPreview.summary?.payroll_closed_count || 0} helper={`${importPreview.summary?.payroll_draft_count || 0} draft.`} tone="success" />
                  <StatCard label="Baris Kasbon" value={importPreview.summary?.advance_entry_count || 0} helper="Histori ledger." tone="warning" />
                  <StatCard label="Gerakan Pinjaman" value={importPreview.summary?.loan_movement_count || 0} helper="Pencairan dan cicilan." tone="warning" />
                </div>
                {asArray(importPreview.warnings).map((warning) => <NoticeBox key={warning}>{warning}</NoticeBox>)}
                {asArray(importPreview.errors).map((item) => <NoticeBox key={item} tone="danger">{item}</NoticeBox>)}
                {importPreview.already_imported ? <NoticeBox tone="success">Backup dengan checksum yang sama sudah pernah di-import. Sistem tidak akan menggandakan data.</NoticeBox> : null}
                {!importPreview.already_imported && importPreview.ready_to_import ? (
                  <div style={{ marginTop: 18, padding: 18, border: "1px solid #fecaca", borderRadius: 18, background: "#fef2f2" }}>
                    <strong>Konfirmasi migrasi permanen</strong>
                    <p className="da-muted">Ketik persis: <code>IMPORT PAYROLL V32</code></p>
                    <input style={{ width: "100%", padding: 13, border: "1px solid #d1d5db", borderRadius: 12, marginBottom: 12 }} value={importConfirmation} onChange={(e) => setImportConfirmation(e.target.value)} />
                    <Button onClick={executeImport} disabled={importing || importConfirmation !== "IMPORT PAYROLL V32"}>{importing ? "Mengimport…" : "Import Riwayat"}</Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {importBatches.length ? (
              <div style={{ marginTop: 24 }}>
                <h3>Riwayat Import</h3>
                <DataTable columns={[{ key: "imported_at", label: "Waktu", render: (row) => row.imported_at }, { key: "import_batch_id", label: "Import ID" }, { key: "source_version", label: "Versi" }, { key: "employee_count", label: "Karyawan" }, { key: "payroll_closed_count", label: "Closing" }, { key: "status", label: "Status", render: (row) => <Badge tone="success">{row.status}</Badge> }]} rows={importBatches} getRowKey={(row) => row.import_batch_id} />
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Modal open={Boolean(selectedEmployee)} title={selectedEmployee?.employee_name || "Detail Karyawan"} subtitle={`${selectedEmployee?.location_name || ""} · Tanggal gajian ${selectedEmployee?.payroll_day || "-"}`} onClose={() => setSelectedEmployee(null)}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {[['overview','Ringkasan'],['attendance','Absensi'],['advance','Kasbon'],['loan','Pinjaman'], ...(fullPayrollAccess ? [['payroll','Payroll']] : [])].map(([key,label]) => <button key={key} type="button" onClick={() => setDetailTab(key)} style={{ border: 0, borderRadius: 999, padding: "9px 12px", cursor: "pointer", fontWeight: 850, background: detailTab === key ? "#fee2e2" : "#f3f4f6", color: detailTab === key ? "#b91c1c" : "#374151" }}>{label}</button>)}
        </div>
        {detailTab === "overview" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}><div><span className="da-muted">Employee ID</span><strong style={{ display: "block" }}>{selectedEmployee?.employee_id}</strong></div><div><span className="da-muted">Status</span><strong style={{ display: "block" }}>{selectedEmployee?.employment_status}</strong></div><div><span className="da-muted">Gaji</span><strong style={{ display: "block" }}>{fullPayrollAccess ? formatRupiah(selectedEmployee?.base_salary || 0) : "Terkunci"}</strong></div><div><span className="da-muted">Sisa Kasbon</span><strong style={{ display: "block", color: "#dc2626" }}>{formatRupiah(selectedEmployee?.advance_balance || 0)}</strong></div><div><span className="da-muted">Sisa Pinjaman</span><strong style={{ display: "block", color: "#dc2626" }}>{formatRupiah(selectedEmployee?.loan_balance || 0)}</strong></div></div> : null}
        {detailTab === "attendance" ? <DataTable columns={attendanceColumns} rows={selectedAttendance} getRowKey={(row) => row.attendance_id} /> : null}
        {detailTab === "advance" ? <DataTable columns={[{ key: "entry_date", label: "Tanggal", render: (row) => formatDate(row.entry_date) }, { key: "entry_type", label: "Jenis" }, { key: "amount", label: "Nominal", render: (row) => formatRupiah(numberValue(row.amount)) }, { key: "notes", label: "Catatan" }]} rows={selectedAdvances} getRowKey={(row) => row.advance_entry_id} /> : null}
        {detailTab === "loan" ? <DataTable columns={[{ key: "loan_date", label: "Tanggal", render: (row) => formatDate(row.loan_date) }, { key: "original_amount", label: "Awal", render: (row) => formatRupiah(numberValue(row.original_amount)) }, { key: "remaining_amount", label: "Sisa", render: (row) => formatRupiah(numberValue(row.remaining_amount)) }, { key: "installment_amount", label: "Cicilan", render: (row) => formatRupiah(numberValue(row.installment_amount)) }]} rows={selectedLoans} getRowKey={(row) => row.loan_id} /> : null}
        {detailTab === "payroll" && fullPayrollAccess ? <DataTable columns={payrollColumns} rows={selectedPayroll} getRowKey={(row) => row.payroll_run_id} /> : null}
      </Modal>
    </div>
  );
}
