import { useEffect, useMemo, useState } from "react";
import { Edit2, Printer, Trash2, User } from "lucide-react";
import {
  createHRDAttendance,
  createHRDEmployee,
  createHRDKasbonNote,
  createHRDLoanNote,
  createHRDLoanInstallment,
  getHRDEmployeeProfile,
  getHRDPayrollBootstrap,
  hrdPayrollHealth,
  updateHRDAttendance,
  updateHRDEmployee,
  updateHRDKasbonNote,
  updateHRDLoanNote,
  voidHRDAttendance,
  voidHRDEmployee,
  voidHRDKasbonNote,
  voidHRDLoanNote,
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
import {
  printHRDAdvanceV32,
  printHRDAttendanceV32,
  printHRDEmployeeProfileV32,
  printHRDEmployeeRecordV32,
  printHRDLoanV32,
} from "./PayrollPrintTemplates";

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED") || (message.includes("SESSION") && message.includes("TIDAK AKTIF"));
}

function asArray(value) { return Array.isArray(value) ? value : []; }
function numberValue(value) {
  const cleaned = String(value ?? "0").replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
function textValue(value, fallback = "-") { const text = String(value ?? "").trim(); return text || fallback; }
function todayInput() { return new Date().toISOString().slice(0, 10); }
function monthInput() { return new Date().toISOString().slice(0, 7); }
function currentYear() { return String(new Date().getFullYear()); }
function makeOperationId(prefix = "HRD") { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function badgeTone(status) {
  const value = String(status || "").toUpperCase();
  if (["ACTIVE", "AKTIF", "CLOSED", "IMPORTED", "HADIR", "PAID"].some((item) => value.includes(item))) return "success";
  if (["ENDING", "DRAFT", "OPEN", "IZIN", "SAKIT", "LEGACY"].some((item) => value.includes(item))) return "warning";
  if (["INACTIVE", "NONAKTIF", "VOID", "TIDAK_MASUK"].some((item) => value.includes(item))) return "danger";
  return "default";
}

function normalizeEmployee(row) {
  return {
    employee_id: textValue(row.employee_id, ""), employee_code: textValue(row.employee_code, ""), employee_name: textValue(row.employee_name, "-"),
    location_id: textValue(row.location_id, ""), location_code: textValue(row.location_code, "-"), location_name: textValue(row.location_name_snapshot || row.location_name, "-"),
    position: textValue(row.position_name || row.position, "-"), position_name: textValue(row.position_name || row.position, ""), payroll_day: numberValue(row.payroll_day),
    salary_mode: textValue(row.salary_mode, "BULANAN"), pay_cycle: textValue(row.pay_cycle, "BULANAN"), base_salary: row.base_salary == null ? null : numberValue(row.base_salary),
    daily_salary: row.daily_salary == null ? null : numberValue(row.daily_salary), default_work_days: numberValue(row.default_work_days), fixed_allowance: row.fixed_allowance == null ? null : numberValue(row.fixed_allowance),
    employment_status: textValue(row.employment_status, "ACTIVE"), advance_balance: numberValue(row.advance_balance), loan_balance: numberValue(row.loan_balance), salary_masked: Boolean(row.salary_masked), raw: row,
  };
}

function FlowCard() {
  const steps = [
    ["1", "Data karyawan & lokasi", "Master hidup, status kerja, tanggal gajian, dan riwayat gaji."],
    ["2", "Absensi, kasbon & pinjaman", "Cabang menginput lokasinya sendiri; uang keluar wajib memilih dompet."],
    ["3", "Draft & cek THP", "Backend menghitung ulang THP, pembulatan, kasbon, dan cicilan."],
    ["4", "Cetak, closing & bayar", "Slip tidak memotong ledger. Closing mengunci; pembayaran membuat Wallet OUT."],
  ];
  return <div className="da-hrd-flow-v4"><div className="da-hrd-flow-title-v4">Alur Payroll Bulanan Dimsum Aditya</div><div className="da-hrd-flow-grid-v4">{steps.map(([no,title,desc]) => <div key={no}><span>{no}</span><strong>{title}</strong><small>{desc}</small></div>)}</div></div>;
}

function NoticeBox({ children, tone = "warning" }) {
  const palette = tone === "success" ? ["#ecfdf5", "#047857", "#a7f3d0"] : tone === "danger" ? ["#fef2f2", "#b91c1c", "#fecaca"] : ["#fff7ed", "#92400e", "#fed7aa"];
  return <div style={{ background: palette[0], color: palette[1], border: `1px solid ${palette[2]}`, borderRadius: 13, padding: "12px 14px", fontWeight: 800, marginTop: 12 }}>{children}</div>;
}

function ActionButtons({ children }) { return <div className="da-hrd-row-actions-v4">{children}</div>; }
function ActionButton({ children, tone = "default", disabled = false, title = "", onClick, iconOnly = false }) {
  return <button type="button" className={`da-hrd-action-btn-v4 is-${tone}${iconOnly ? " is-icon" : ""}`} disabled={disabled} title={title} aria-label={title || undefined} onClick={(event) => { event.stopPropagation(); onClick?.(event); }}>{children}</button>;
}

function PagedDataTable({ columns = [], rows = [], getRowKey, onRowClick, pageSize = 20, resetKey = "" }) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const totalPages = Math.max(1, Math.ceil(normalizedRows.length / safePageSize));
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), totalPages));
  }, [totalPages]);

  const startIndex = (page - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, normalizedRows.length);
  const pageRows = normalizedRows.slice(startIndex, endIndex);

  return (
    <div className="da-hrd-paged-table-v5">
      <DataTable columns={columns} rows={pageRows} getRowKey={getRowKey} onRowClick={onRowClick} />
      {normalizedRows.length > safePageSize ? (
        <div className="da-hrd-pagination-v5" role="navigation" aria-label="Navigasi halaman data">
          <div className="da-hrd-pagination-copy-v5">
            <strong>{startIndex + 1}–{endIndex}</strong>
            <span>dari {normalizedRows.length} data · maks. {safePageSize} / halaman</span>
          </div>
          <div className="da-hrd-pagination-actions-v5">
            <button type="button" onClick={() => setPage(1)} disabled={page <= 1} aria-label="Halaman pertama">«</button>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Sebelumnya</button>
            <span>Halaman <strong>{page}</strong> / {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Berikutnya</button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages} aria-label="Halaman terakhir">»</button>
          </div>
        </div>
      ) : normalizedRows.length > 0 ? (
        <div className="da-hrd-pagination-v5 is-single-page">
          <div className="da-hrd-pagination-copy-v5"><span>{normalizedRows.length} data · maks. {safePageSize} / halaman</span></div>
        </div>
      ) : null}
    </div>
  );
}

const emptyEmployee = () => ({ employee_name: "", location_id: "LOC-TGR-001", position_name: "Crew", payroll_day: "28", salary_mode: "BULANAN", pay_cycle: "BULANAN", base_salary: "0", daily_salary: "0", default_work_days: "0", employment_status: "ACTIVE", effective_period: monthInput(), notes: "Karyawan aktif." });
const emptyAttendance = () => ({ employee_id: "", attendance_date: todayInput(), attendance_type: "HADIR", day_fraction: "1", deduct_salary: false, overtime_amount: "0", notes: "" });
const emptyAdvance = () => ({ employee_id: "", wallet_id: "", date: todayInput(), amount: "0", notes: "Kasbon karyawan." });
const emptyLoan = () => ({ employee_id: "", wallet_id: "", loan_date: todayInput(), amount: "0", tenor_total: "0", installment_amount: "0", start_period: monthInput(), payment_mode: "AUTO_PAYROLL", notes: "Pinjaman karyawan." });
const emptyLoanInstallment = () => ({ loan_id: "", wallet_id: "", payment_date: todayInput(), amount: "0", notes: "Bayar cicilan pinjaman manual." });

function round5000(value) { return Math.round(numberValue(value) / 5000) * 5000; }

export default function HRDPayrollPage({ session, onSessionExpired, viewMode = "dashboard" }) {
  const token = session?.sessionToken || session?.session_token || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(monthInput());
  const [locationId, setLocationId] = useState("ALL");
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [loanInstallmentOpen, setLoanInstallmentOpen] = useState(false);
  const [payrollSubMode, setPayrollSubMode] = useState("process");
  const [editingEmployeeId, setEditingEmployeeId] = useState("");
  const [editingAttendanceId, setEditingAttendanceId] = useState("");
  const [editingAdvanceId, setEditingAdvanceId] = useState("");
  const [editingLoanId, setEditingLoanId] = useState("");
  const [editingAdvanceMeta, setEditingAdvanceMeta] = useState(null);
  const [editingLoanMeta, setEditingLoanMeta] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileYear, setProfileYear] = useState(currentYear());
  const [detailTab, setDetailTab] = useState("overview");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerMode, setLedgerMode] = useState("advance");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("ALL");
  const [employeeSalaryFilter, setEmployeeSalaryFilter] = useState("ALL");

  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
  const [attendanceForm, setAttendanceForm] = useState(emptyAttendance);
  const [advanceForm, setAdvanceForm] = useState(emptyAdvance);
  const [loanForm, setLoanForm] = useState(emptyLoan);
  const [loanInstallmentForm, setLoanInstallmentForm] = useState(emptyLoanInstallment);

  const access = data?.access || {};
  const fullPayrollAccess = Boolean(access.full_payroll_access);
  const employees = useMemo(() => asArray(data?.employees).map(normalizeEmployee), [data]);
  const locations = useMemo(() => asArray(data?.locations), [data]);
  const wallets = useMemo(() => asArray(data?.wallets), [data]);
  const attendanceRows = useMemo(() => asArray(data?.attendance_rows), [data]);
  const advances = useMemo(() => asArray(data?.kasbon_rows), [data]);
  const loans = useMemo(() => asArray(data?.loan_rows), [data]);
  const payrollRows = useMemo(() => asArray(data?.payroll_recaps), [data]);
  const summary = data?.summary || {};

  const profileAttendance = asArray(employeeProfile?.attendance_rows);
  const profileAdvances = asArray(employeeProfile?.kasbon_rows);
  const profileLoans = asArray(employeeProfile?.loan_rows);
  const profileLoanMovements = asArray(employeeProfile?.loan_movement_rows);
  const profilePayroll = asArray(employeeProfile?.payroll_rows);
  const profilePayments = asArray(employeeProfile?.payment_rows);
  const profileSalary = asArray(employeeProfile?.salary_history);
  const profileStatus = asArray(employeeProfile?.status_history);

  async function loadData({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const health = await hrdPayrollHealth(token, {});
      if (isAuthRequired(health)) return onSessionExpired?.();
      if (!health?.success) throw new Error(health?.message || "Fondasi HRD belum dapat dibaca.");
      const result = await getHRDPayrollBootstrap(token, { period, ...(locationId && locationId !== "ALL" ? { location_id: locationId } : {}) });
      if (isAuthRequired(result)) return onSessionExpired?.();
      if (!result?.success) throw new Error(result?.message || "Data HRD gagal dibaca.");
      setData(result.data || {});
      const rows = asArray(result?.data?.employees).map(normalizeEmployee);
      setSelectedEmployee((current) => current ? (rows.find((row) => row.employee_id === current.employee_id) || current) : null);
    } catch (err) { setError(err?.message || "Data HRD gagal dibaca."); }
    finally { setLoading(false); }
  }

  async function loadEmployeeProfile(employeeId, year = profileYear) {
    if (!employeeId) return;
    setProfileLoading(true);
    try {
      const result = await getHRDEmployeeProfile(token, { employee_id: employeeId, year: Number(year) });
      if (isAuthRequired(result)) return onSessionExpired?.();
      if (!result?.success) throw new Error(result?.message || "Profil karyawan gagal dibaca.");
      setEmployeeProfile(result.data || null);
    } catch (err) { setError(err?.message || "Profil karyawan gagal dibaca."); }
    finally { setProfileLoading(false); }
  }

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period, locationId]);
  useEffect(() => { if (selectedEmployee?.employee_id) loadEmployeeProfile(selectedEmployee.employee_id, profileYear); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedEmployee?.employee_id, profileYear]);

  async function runWrite(action, payload, prefix, successMessage) {
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await action(token, { ...payload, operation_id: makeOperationId(prefix), request_id: makeOperationId("REQ"), idempotency_key: makeOperationId("IDEMP") });
      if (isAuthRequired(result)) { onSessionExpired?.(); return false; }
      if (!result?.success) throw new Error(result?.message || "Penyimpanan gagal.");
      setNotice(result?.message || successMessage);
      await loadData({ quiet: true });
      if (selectedEmployee?.employee_id) await loadEmployeeProfile(selectedEmployee.employee_id, profileYear);
      return true;
    } catch (err) { setError(err?.message || "Penyimpanan gagal."); return false; }
    finally { setSaving(false); }
  }

  function openEmployeeProfile(row, tab = "overview") { setSelectedEmployee(normalizeEmployee(row?.raw || row)); setDetailTab(tab); }
  function employeeLink(row, label = row.employee_name) { return <button type="button" className="da-hrd-employee-link-v4" onClick={(event) => { event.stopPropagation(); openEmployeeProfile(employees.find((emp) => emp.employee_id === row.employee_id) || row); }}>{label}</button>; }

  function openCreateEmployee() { setEditingEmployeeId(""); setEmployeeForm(emptyEmployee()); setEmployeeModalOpen(true); }
  function openEditEmployee(row) {
    setEditingEmployeeId(row.employee_id);
    setEmployeeForm({ employee_id: row.employee_id, employee_name: row.employee_name, location_id: row.location_id, position_name: row.position_name || row.position || "", payroll_day: String(row.payroll_day || 28), salary_mode: row.salary_mode || "BULANAN", pay_cycle: row.pay_cycle || "BULANAN", base_salary: String(row.base_salary ?? 0), daily_salary: String(row.daily_salary ?? 0), default_work_days: String(row.default_work_days ?? 0), employment_status: row.employment_status || "ACTIVE", effective_period: period, notes: "Update data karyawan." });
    setEmployeeModalOpen(true);
  }
  async function submitEmployee(event) {
    event.preventDefault();
    const action = editingEmployeeId ? updateHRDEmployee : createHRDEmployee;
    const ok = await runWrite(action, employeeForm, editingEmployeeId ? "EMPUPD" : "EMP", editingEmployeeId ? "Karyawan berhasil di-update." : "Karyawan berhasil dibuat.");
    if (ok) { setEmployeeModalOpen(false); setEditingEmployeeId(""); setEmployeeForm(emptyEmployee()); }
    return ok;
  }
  async function deleteEmployee(row) {
    if (!window.confirm(`Hapus master ${row.employee_name}? Jika sudah punya histori, server akan menolak dan menyarankan status INACTIVE.`)) return;
    await runWrite(voidHRDEmployee, { employee_id: row.employee_id, reason: "Hapus dari Data Karyawan" }, "EMPVOID", "Karyawan dihapus.");
  }

  function openCreateAttendance() { setEditingAttendanceId(""); setAttendanceForm(emptyAttendance()); setAttendanceModalOpen(true); }
  function openEditAttendance(row) { setEditingAttendanceId(row.attendance_id); setAttendanceForm({ attendance_id: row.attendance_id, employee_id: row.employee_id, attendance_date: String(row.attendance_date || "").slice(0,10), attendance_type: row.attendance_type || "HADIR", day_fraction: String(row.day_fraction ?? 1), deduct_salary: Number(row.deduct_salary) === 1, overtime_amount: String(row.overtime_amount ?? 0), notes: row.notes || "" }); setAttendanceModalOpen(true); }
  async function submitAttendance(event) { event.preventDefault(); const ok = await runWrite(editingAttendanceId ? updateHRDAttendance : createHRDAttendance, attendanceForm, editingAttendanceId ? "ABSUPD" : "ABS", editingAttendanceId ? "Absensi berhasil di-update." : "Absensi berhasil disimpan."); if (ok) { setAttendanceModalOpen(false); setEditingAttendanceId(""); setAttendanceForm(emptyAttendance()); } return ok; }
  async function deleteAttendance(row) { if (!window.confirm(`Hapus absensi ${row.employee_name} tanggal ${formatDate(row.attendance_date)}?`)) return; await runWrite(voidHRDAttendance, { attendance_id: row.attendance_id, reason: "Hapus data absensi" }, "ABSVOID", "Absensi dihapus."); }

  function openCreateAdvance() { setEditingAdvanceId(""); setEditingAdvanceMeta(null); setAdvanceForm(emptyAdvance()); setAdvanceModalOpen(true); }
  function openCreateAdvanceForEmployee(row) { setEditingAdvanceId(""); setEditingAdvanceMeta(null); setAdvanceForm({ ...emptyAdvance(), employee_id: row?.employee_id || "" }); setSelectedEmployee(null); setEmployeeProfile(null); setAdvanceModalOpen(true); }
  function openEditAdvance(row) { setEditingAdvanceId(row.advance_entry_id); setEditingAdvanceMeta(row); setAdvanceForm({ advance_entry_id: row.advance_entry_id, employee_id: row.employee_id, wallet_id: "", date: String(row.entry_date || "").slice(0,10), amount: String(row.amount ?? 0), notes: row.notes || "" }); setAdvanceModalOpen(true); }
  async function submitAdvance(event) { event.preventDefault(); const ok = await runWrite(editingAdvanceId ? updateHRDKasbonNote : createHRDKasbonNote, advanceForm, editingAdvanceId ? "KASBONUPD" : "KASBON", editingAdvanceId ? "Kasbon berhasil di-update." : "Kasbon berhasil disimpan."); if (ok) { setAdvanceModalOpen(false); setEditingAdvanceId(""); setEditingAdvanceMeta(null); setAdvanceForm(emptyAdvance()); } return ok; }
  async function deleteAdvance(row) { if (!window.confirm(`Hapus kasbon ${row.employee_name} sebesar ${formatRupiah(numberValue(row.amount))}? Efek dompet hanya dibalik untuk transaksi ERP live yang aman.`)) return; await runWrite(voidHRDKasbonNote, { advance_entry_id: row.advance_entry_id, reason: "Hapus kasbon HRD" }, "KASBONVOID", "Kasbon dihapus."); }

  function openCreateLoan() { setEditingLoanId(""); setEditingLoanMeta(null); setLoanForm(emptyLoan()); setLoanModalOpen(true); }
  function openCreateLoanForEmployee(row) { setEditingLoanId(""); setEditingLoanMeta(null); setLoanForm({ ...emptyLoan(), employee_id: row?.employee_id || "" }); setSelectedEmployee(null); setEmployeeProfile(null); setLoanModalOpen(true); }
  function openEditLoan(row) { setEditingLoanId(row.loan_id); setEditingLoanMeta(row); setLoanForm({ loan_id: row.loan_id, employee_id: row.employee_id, wallet_id: "", loan_date: String(row.loan_date || "").slice(0,10), amount: String(row.original_amount ?? 0), tenor_total: String(row.tenor_total ?? 0), installment_amount: String(row.installment_amount ?? 0), start_period: row.start_period || period, payment_mode: row.payment_mode || "AUTO_PAYROLL", notes: row.notes || "" }); setLoanModalOpen(true); }
  async function submitLoan(event) { event.preventDefault(); const ok = await runWrite(editingLoanId ? updateHRDLoanNote : createHRDLoanNote, loanForm, editingLoanId ? "LOANUPD" : "LOAN", editingLoanId ? "Pinjaman berhasil di-update." : "Pinjaman berhasil dibuat."); if (ok) { setLoanModalOpen(false); setEditingLoanId(""); setEditingLoanMeta(null); setLoanForm(emptyLoan()); } return ok; }
  async function deleteLoan(row) { if (!window.confirm(`Hapus pinjaman ${row.employee_name}? Hanya pinjaman ERP live yang belum dicicil dapat dihapus.`)) return; await runWrite(voidHRDLoanNote, { loan_id: row.loan_id, reason: "Hapus pinjaman HRD" }, "LOANVOID", "Pinjaman dihapus."); }

  function openLoanInstallment(row) {
    setLoanInstallmentForm({ loan_id: row.loan_id, wallet_id: "", payment_date: todayInput(), amount: String(row.installment_amount || row.remaining_amount || 0), notes: `Bayar cicilan pinjaman ${row.employee_name || "karyawan"}.` });
    setLoanInstallmentOpen(true);
  }
  async function submitLoanInstallment(event) {
    event.preventDefault();
    const ok = await runWrite(createHRDLoanInstallment, loanInstallmentForm, "LOANPAY", "Cicilan pinjaman berhasil dicatat.");
    if (ok) { setLoanInstallmentOpen(false); setLoanInstallmentForm(emptyLoanInstallment()); }
    return ok;
  }

  function advancePrintContext(row) {
    const employee = employees.find((item) => String(item.employee_id) === String(row.employee_id));
    if (!employee) return {};
    const rowPeriod = String(row.entry_date || period).slice(0, 7);
    if (!fullPayrollAccess || employee.salary_masked) return { employee };
    const salaryBase = String(employee.salary_mode || "").toUpperCase() === "HARIAN"
      ? round5000(numberValue(employee.daily_salary) * numberValue(employee.default_work_days))
      : numberValue(employee.base_salary);
    const loanReservedRaw = loans
      .filter((loan) => String(loan.employee_id) === String(employee.employee_id) && String(loan.status || "").toUpperCase() === "OPEN" && String(loan.payment_mode || "AUTO_PAYROLL").toUpperCase() === "AUTO_PAYROLL" && (!loan.start_period || String(loan.start_period) <= rowPeriod))
      .reduce((total, loan) => {
        const remaining = Math.max(0, numberValue(loan.remaining_amount));
        const configured = numberValue(loan.installment_amount);
        const fallback = numberValue(loan.tenor_total) > 0 ? remaining / Math.max(1, numberValue(loan.tenor_total)) : 0;
        return total + Math.min(remaining, configured > 0 ? configured : fallback);
      }, 0);
    const loanReserved = round5000(loanReservedRaw);
    const absenceDays = attendanceRows
      .filter((att) => String(att.employee_id) === String(employee.employee_id) && String(att.attendance_date || "").slice(0, 7) === rowPeriod && numberValue(att.deduct_salary) === 1)
      .reduce((total, att) => total + numberValue(att.day_fraction), 0);
    const absenceReserved = String(employee.salary_mode || "").toUpperCase() === "HARIAN" ? 0 : round5000((salaryBase / 26) * absenceDays);
    const safeLimit = Math.max(0, salaryBase - loanReserved - absenceReserved);
    const taken = advances
      .filter((adv) => String(adv.employee_id) === String(employee.employee_id) && String(adv.entry_date || "").slice(0, 7) === rowPeriod && ["TAKE", "AMBIL"].includes(String(adv.entry_type || "TAKE").toUpperCase()) && String(adv.status || "ACTIVE").toUpperCase() !== "VOID")
      .reduce((total, adv) => total + numberValue(adv.amount), 0);
    return {
      employee,
      salary_base: salaryBase,
      loan_reserved: loanReserved,
      absence_reserved: absenceReserved,
      safe_limit: safeLimit,
      taken_amount: taken,
      remaining_limit: Math.max(0, safeLimit - taken),
    };
  }

  function loanPrintContext(row) {
    return { employee: employees.find((item) => String(item.employee_id) === String(row.employee_id)) || null };
  }

  const employeeColumns = [
    { key: "employee_name", label: "Nama Lengkap", render: (row) => <div>{employeeLink(row, row.employee_name)}<div className="da-muted">{row.employee_code} · {String(row.salary_mode || "BULANAN").toLowerCase()}</div></div> },
    { key: "location", label: "Lokasi", render: (row) => <div>{row.location_name}<div className="da-muted">{row.location_code}</div></div> },
    { key: "payroll_day", label: "Tgl Gajian", render: (row) => <span className="da-employee-local-date-v20">Tgl {row.payroll_day || "-"}</span> },
    ...(fullPayrollAccess ? [{ key: "base_salary", label: "Gaji Pokok", render: (row) => <span className="da-employee-local-salary-v20">{formatRupiah(row.base_salary || 0)}</span> }] : []),
    { key: "loan_summary", label: "Sisa Pinjaman Panjang", render: (row) => <div className="da-employee-local-debt-v20"><strong>{formatRupiah(row.loan_balance)}</strong><small>Kasbon bulan ini: {formatRupiah(row.advance_balance)}</small></div> },
    { key: "actions", label: "Aksi & Buku Catatan", render: (row) => <div className="da-employee-local-actions-v20"><ActionButton tone="advance" title="Buka buku kasbon karyawan" onClick={() => openEmployeeProfile(row, "advance")}>Kasbon</ActionButton><ActionButton tone="ledger" title="Buka pinjaman & cicilan karyawan" onClick={() => openEmployeeProfile(row, "loan")}>Ledger</ActionButton><ActionButton iconOnly tone="profile" title="Profil & riwayat lengkap" onClick={() => openEmployeeProfile(row, "overview")}><User size={17} /></ActionButton>{fullPayrollAccess ? <ActionButton iconOnly tone="edit" title="Edit data karyawan" onClick={() => openEditEmployee(row)}><Edit2 size={17} /></ActionButton> : null}<ActionButton iconOnly tone="print" title="Print data karyawan" onClick={() => printHRDEmployeeRecordV32(row.raw || row)}><Printer size={17} /></ActionButton>{fullPayrollAccess ? <ActionButton iconOnly tone="danger" title="Hapus / nonaktifkan data karyawan" onClick={() => deleteEmployee(row)}><Trash2 size={17} /></ActionButton> : null}</div> },
  ];

  const attendanceColumns = [
    { key: "attendance_date", label: "Tanggal", render: (row) => formatDate(row.attendance_date) },
    { key: "employee_name", label: "Karyawan", render: (row) => employeeLink(row) },
    { key: "attendance_type", label: "Status", render: (row) => <Badge tone={badgeTone(row.attendance_type)}>{String(row.attendance_type).replaceAll("_", " ")}</Badge> },
    { key: "day_fraction", label: "Hari", render: (row) => numberValue(row.day_fraction) },
    { key: "deduct_salary", label: "Potong Gaji", render: (row) => Number(row.deduct_salary) === 1 ? "Ya" : "Tidak" },
    { key: "overtime_amount", label: "Lembur", render: (row) => formatRupiah(numberValue(row.overtime_amount)) },
    { key: "notes", label: "Catatan" },
    { key: "actions", label: "Aksi", render: (row) => <ActionButtons><ActionButton iconOnly tone="edit" title="Edit absensi / izin" onClick={() => openEditAttendance(row)}><Edit2 size={17} /></ActionButton><ActionButton iconOnly tone="danger" title="Hapus absensi / izin" onClick={() => deleteAttendance(row)}><Trash2 size={17} /></ActionButton><ActionButton iconOnly tone="print" title="Print catatan absensi" onClick={() => printHRDAttendanceV32(row)}><Printer size={17} /></ActionButton></ActionButtons> },
  ];

  const advanceColumns = [
    { key: "entry_date", label: "Tanggal", render: (row) => formatDate(row.entry_date) },
    { key: "employee_name", label: "Karyawan", render: (row) => employeeLink(row) },
    { key: "amount", label: "Nominal", render: (row) => <strong>{formatRupiah(numberValue(row.amount))}</strong> },
    { key: "notes", label: "Catatan", render: (row) => <div className="da-hrd-cell-note-v4">{row.notes || "-"}{String(row.source_system || "").includes("DIRECT_SEED") ? <small>Histori lama · nominal terkunci</small> : null}</div> },
    { key: "actions", label: "Aksi", render: (row) => <ActionButtons><ActionButton iconOnly tone="edit" disabled={Number(row.locked) === 1} title={Number(row.locked) === 1 ? "Sudah terkunci payroll" : "Edit kasbon"} onClick={() => openEditAdvance(row)}><Edit2 size={17} /></ActionButton><ActionButton iconOnly tone="danger" disabled={Number(row.locked) === 1 || String(row.source_system || "").toUpperCase() !== "ERP_LIVE"} title={String(row.source_system || "").toUpperCase() !== "ERP_LIVE" ? "Histori migrasi tidak boleh dihapus" : Number(row.locked) === 1 ? "Sudah terkunci payroll" : "Hapus kasbon"} onClick={() => deleteAdvance(row)}><Trash2 size={17} /></ActionButton><ActionButton iconOnly tone="print" title="Print bukti kasbon" onClick={() => printHRDAdvanceV32(row, advancePrintContext(row))}><Printer size={17} /></ActionButton></ActionButtons> },
  ];

  const loanColumns = [
    { key: "employee_name", label: "Karyawan", render: (row) => employeeLink(row) },
    { key: "original_amount", label: "Awal", render: (row) => formatRupiah(numberValue(row.original_amount)) },
    { key: "remaining_amount", label: "Sisa", render: (row) => <strong>{formatRupiah(numberValue(row.remaining_amount))}</strong> },
    { key: "installment", label: "Cicilan", render: (row) => <div>{formatRupiah(numberValue(row.installment_amount))}<small className="da-muted">{numberValue(row.tenor_paid)} / {numberValue(row.tenor_total)} tenor</small></div> },
    { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status}</Badge> },
    { key: "actions", label: "Aksi", render: (row) => <ActionButtons>{String(row.status || "").toUpperCase() === "OPEN" && numberValue(row.remaining_amount) > 0 && String(row.source_system || "").toUpperCase() === "ERP_LIVE" ? <ActionButton tone="pay" title="Catat pembayaran cicilan manual" onClick={() => openLoanInstallment(row)}>Bayar</ActionButton> : null}<ActionButton iconOnly tone="edit" title="Edit pinjaman / cicilan" onClick={() => openEditLoan(row)}><Edit2 size={17} /></ActionButton><ActionButton iconOnly tone="danger" disabled={String(row.source_system || "").toUpperCase() !== "ERP_LIVE" || numberValue(row.tenor_paid) > 0} title={String(row.source_system || "").toUpperCase() !== "ERP_LIVE" ? "Histori migrasi tidak boleh dihapus" : numberValue(row.tenor_paid) > 0 ? "Sudah memiliki cicilan" : "Hapus pinjaman"} onClick={() => deleteLoan(row)}><Trash2 size={17} /></ActionButton><ActionButton iconOnly tone="print" title="Print bukti pinjaman" onClick={() => printHRDLoanV32(row, loanPrintContext(row))}><Printer size={17} /></ActionButton></ActionButtons> },
  ];

  const payrollColumns = [
    { key: "employee_name", label: "Karyawan", render: (row) => employeeLink(row) }, { key: "location_name", label: "Lokasi" }, { key: "payroll_day", label: "Tgl" },
    { key: "total_income", label: "Pendapatan", render: (row) => formatRupiah(numberValue(row.total_income)) }, { key: "total_deduction", label: "Potongan", render: (row) => formatRupiah(numberValue(row.total_deduction)) },
    { key: "net_pay", label: "THP", render: (row) => <strong className="da-text-success-v4">{formatRupiah(numberValue(row.net_pay))}</strong> }, { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status}</Badge> },
  ];

  if (loading) return <div className="da-page"><Card>Memuat HRD / Payroll PHP/MySQL…</Card></div>;

  const viewMeta = {
    dashboard: ["Dashboard Payroll", "Pusat kontrol karyawan, absensi, kasbon, cicilan dan payroll seluruh lokasi."],
    employees: ["Data Karyawan", "Profil karyawan, lokasi kerja, tanggal gajian, status dan riwayat personal."],
    attendance: ["Absensi & Izin", "Catat kehadiran, izin dan lembur; edit/hapus aman sebelum payroll terkunci."],
    loans: ["Kasbon & Cicilan", "Pantau outstanding, klik nama untuk profil, serta edit/hapus/print transaksi HRD."],
    payroll: ["Buat Slip Gaji", "Draft THP, update, print, closing dan pembayaran gaji dari satu workspace."],
    report: ["Rekap Payroll", "Rekap per periode/lokasi, histori closing, pembayaran dan cetak A4 payroll."],
  }[viewMode] || ["HRD & Payroll", "Operasional HRD Dimsum Aditya."];

  const attendanceCount = (type) => attendanceRows.filter((row) => String(row.attendance_type || "").toUpperCase() === type).length;
  const attendanceIssueCount = attendanceRows.filter((row) => ["IZIN", "SAKIT", "TIDAK_MASUK", "CUTI"].includes(String(row.attendance_type || "").toUpperCase())).length;
  const activeEmployees = employees.filter((row) => String(row.employment_status || "ACTIVE").toUpperCase() === "ACTIVE");
  const payrollDrafts = payrollRows.filter((row) => String(row.status || "").toUpperCase() === "DRAFT");
  const recentEmployees = activeEmployees.slice(0, 6);
  const recentAttendance = attendanceRows.slice(0, 8);
  const ledgerQuery = ledgerSearch.trim().toLowerCase();
  const filteredAdvances = ledgerQuery ? advances.filter((row) => `${row.employee_name || ""} ${row.notes || ""} ${row.advance_entry_id || ""}`.toLowerCase().includes(ledgerQuery)) : advances;
  const filteredLoans = ledgerQuery ? loans.filter((row) => `${row.employee_name || ""} ${row.notes || ""} ${row.loan_id || ""}`.toLowerCase().includes(ledgerQuery)) : loans;
  const employeeQuery = employeeSearch.trim().toLowerCase();
  const filteredEmployees = employees.filter((row) => {
    if (employeeQuery && !`${row.employee_name || ""} ${row.employee_code || ""} ${row.location_name || ""} ${row.position || ""}`.toLowerCase().includes(employeeQuery)) return false;
    if (employeeStatusFilter !== "ALL" && String(row.employment_status || "ACTIVE").toUpperCase() !== employeeStatusFilter) return false;
    if (employeeSalaryFilter !== "ALL" && String(row.salary_mode || "BULANAN").toUpperCase() !== employeeSalaryFilter) return false;
    return true;
  });
  const payrollMirrorMode = fullPayrollAccess && ["dashboard", "payroll", "report"].includes(viewMode);

  const calendarDate = (() => { const [year, month] = String(period || monthInput()).split("-").map(Number); return { year: year || new Date().getFullYear(), month: (month || new Date().getMonth() + 1) - 1 }; })();
  const calendarStart = new Date(calendarDate.year, calendarDate.month, 1);
  const calendarDays = [];
  const mondayOffset = (calendarStart.getDay() + 6) % 7;
  for (let i = 0; i < 42; i += 1) { const d = new Date(calendarDate.year, calendarDate.month, 1 - mondayOffset + i); const iso = d.toISOString().slice(0, 10); const count = attendanceRows.filter((row) => String(row.attendance_date || "").slice(0, 10) === iso).length; calendarDays.push({ key: iso, day: d.getDate(), outside: d.getMonth() !== calendarDate.month, count }); }

  const toolbar = <div className="da-hrd-toolbar-v3"><div className="da-hrd-toolbar-fields-v3"><label className="da-field"><span>Periode</span><input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>{fullPayrollAccess ? <label className="da-field"><span>Lokasi</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="ALL">Semua lokasi</option>{locations.map((row) => <option key={row.location_id} value={row.location_id}>{row.location_name} · {row.location_code}</option>)}</select></label> : <div />}</div><div className="da-hrd-toolbar-actions-v3"><Badge tone={data?.health?.ready ? "success" : "danger"}>{data?.health?.ready ? "Data HRD Live" : "Perlu Dicek"}</Badge><Button variant="secondary" onClick={() => loadData()}>Refresh Data</Button></div></div>;

  return <div className="da-page da-hrd-page-v4">
    {!payrollMirrorMode ? <div className="da-page-heading"><div><div className="da-eyebrow">HRD & PAYROLL</div><h1>{viewMeta[0]}</h1><p>{viewMeta[1]}</p></div></div> : null}
    {!payrollMirrorMode ? <Card className="da-full-width">{toolbar}{error ? <NoticeBox tone="danger">{error}</NoticeBox> : null}{notice ? <NoticeBox tone="success">{notice}</NoticeBox> : null}</Card> : null}
    {!payrollMirrorMode && (viewMode === "dashboard" || viewMode === "payroll") ? <FlowCard /> : null}

    {viewMode === "dashboard" && fullPayrollAccess ? <PayrollFinalPanel session={session} period={period} locationId={locationId} baseEmployees={employees} baseAdvances={advances} mode="dashboard" onPeriodChange={setPeriod} onLocationChange={setLocationId} onSessionExpired={onSessionExpired} onChanged={() => loadData({ quiet: true })} onOpenEmployee={(employeeId) => { const employee = employees.find((row) => row.employee_id === employeeId); if (employee) openEmployeeProfile(employee); }} /> : null}

    {viewMode === "dashboard" && !fullPayrollAccess ? <>
      <div className="da-stat-grid"><StatCard label="Karyawan Aktif" value={summary.active_employee_count || 0} helper={`${summary.employee_count || 0} total master.`} /><StatCard label="Absensi Perlu Dilihat" value={attendanceIssueCount} helper={`${attendanceRows.length} catatan periode ini.`} tone={attendanceIssueCount ? "warning" : "success"} /><StatCard label="Sisa Kasbon" value={formatRupiah(summary.open_advance_amount || 0)} helper="Saldo kasbon terbuka." tone="warning" /><StatCard label="Payroll Closing" value={summary.payroll_closed_count || 0} helper={`${summary.payroll_draft_count || 0} masih draft.`} tone="success" /></div>
      <div className="da-hrd-dashboard-grid-v3"><section className="da-hrd-panel-v3"><div className="da-hrd-panel-head-v3"><div><h3>Ringkasan Operasional HRD</h3><p>Angka periode {period} dari sumber PHP/MySQL.</p></div><Badge tone="success">Aktual</Badge></div><div className="da-hrd-mini-grid-v3"><StatCard label="Total THP" value={fullPayrollAccess ? formatRupiah(summary.payroll_total_net_pay || 0) : "Terkunci"} helper="Histori payroll periode." tone="success" /><StatCard label="Belum Closing" value={fullPayrollAccess ? summary.payroll_draft_count || 0 : "—"} helper="Draft menunggu pemeriksaan." tone="warning" /><StatCard label="Sisa Pinjaman" value={formatRupiah(summary.open_loan_amount || 0)} helper="Pinjaman berjalan." tone="warning" /><StatCard label="Lokasi Terhubung" value={summary.location_count || 0} helper="Sesuai hak akses." /></div><div style={{marginTop:12}}><DataTable columns={employeeColumns.slice(0,4)} rows={recentEmployees} getRowKey={(row) => row.employee_id} onRowClick={openEmployeeProfile} /></div></section>
      <aside className="da-hrd-panel-v3"><div className="da-hrd-panel-head-v3"><div><h3>Perlu Perhatian</h3><p>Ringkasan yang perlu dicek Owner/HRD.</p></div></div><div className="da-hrd-attention-v3"><div className="da-hrd-attention-row-v3"><span>Payroll belum closing</span><strong>{payrollDrafts.length}</strong></div><div className="da-hrd-attention-row-v3"><span>Catatan izin / sakit / tidak masuk</span><strong>{attendanceIssueCount}</strong></div><div className="da-hrd-attention-row-v3"><span>Kasbon outstanding</span><strong>{formatRupiah(summary.open_advance_amount || 0)}</strong></div><div className="da-hrd-attention-row-v3"><span>Pinjaman outstanding</span><strong>{formatRupiah(summary.open_loan_amount || 0)}</strong></div></div><div style={{marginTop:14}}><div className="da-hrd-panel-head-v3"><div><h3>Absensi Terbaru</h3></div></div><DataTable columns={attendanceColumns.slice(0,3)} rows={recentAttendance} getRowKey={(row) => row.attendance_id} /></div></aside></div>
    </> : null}

    {viewMode === "employees" ? <>
      <div className="da-stat-grid"><StatCard label="Karyawan Aktif" value={activeEmployees.length} helper="Status kerja aktif." tone="success" /><StatCard label="Total Master" value={employees.length} helper="Semua status karyawan." /><StatCard label="Kasbon Terbuka" value={formatRupiah(summary.open_advance_amount || 0)} helper="Dari catatan karyawan." tone="warning" /><StatCard label="Pinjaman Terbuka" value={formatRupiah(summary.open_loan_amount || 0)} helper="Sisa pinjaman panjang." tone="warning" /></div>
      <Card className="da-full-width da-employee-local-card-v20" title="Daftar & Buku Catatan Karyawan" description="Tampilan mengikuti Database Karyawan Payroll V32: filter cepat, tombol Kasbon/Ledger, profil, edit, hapus, dan print." action={fullPayrollAccess ? <Button onClick={openCreateEmployee}>+ Tambah Karyawan Baru</Button> : null}>
        <div className="da-employee-local-filter-v20"><label><span>Cabang / Area</span><select value={locationId} onChange={(e)=>setLocationId(e.target.value)}><option value="ALL">Semua Cabang ({employees.length})</option>{locations.map((row)=><option key={row.location_id} value={row.location_id}>{row.location_name} · {row.location_code}</option>)}</select></label><label><span>Cari Karyawan</span><input value={employeeSearch} onChange={(e)=>setEmployeeSearch(e.target.value)} placeholder="Nama karyawan…" /></label><label><span>Status Payroll</span><select value={employeeStatusFilter} onChange={(e)=>setEmployeeStatusFilter(e.target.value)}><option value="ALL">Semua Status</option><option value="ACTIVE">Aktif</option><option value="ENDING">Akan Berakhir</option><option value="INACTIVE">Nonaktif</option></select></label><label><span>Tipe Gaji</span><select value={employeeSalaryFilter} onChange={(e)=>setEmployeeSalaryFilter(e.target.value)}><option value="ALL">Semua Tipe</option><option value="BULANAN">Bulanan</option><option value="HARIAN">Harian</option></select></label></div>
        <div className="da-employee-local-counts-v20"><span>Semua: <strong>{employees.length}</strong></span><span>Aktif: <strong>{activeEmployees.length}</strong></span><span>Tampil: <strong>{filteredEmployees.length}</strong></span></div>
        {!fullPayrollAccess ? <NoticeBox>Nominal gaji tidak ditampilkan untuk akun cabang. Cabang tetap dapat melihat profil operasional sesuai scope.</NoticeBox> : null}
        <PagedDataTable columns={employeeColumns} rows={filteredEmployees} getRowKey={(row) => row.employee_id} onRowClick={openEmployeeProfile} pageSize={20} resetKey={`${period}-${locationId}-${employeeSearch}-${employeeStatusFilter}-${employeeSalaryFilter}-employees`} />
      </Card>
    </> : null}

    {viewMode === "attendance" ? <>
      <div className="da-stat-grid"><StatCard label="Hadir" value={attendanceCount("HADIR")} helper={`Periode ${period}.`} tone="success" /><StatCard label="Izin / Sakit" value={attendanceCount("IZIN") + attendanceCount("SAKIT")} helper="Catatan izin dan sakit." tone="warning" /><StatCard label="Tidak Masuk" value={attendanceCount("TIDAK_MASUK")} helper="Perlu dicek dampak payroll." tone={attendanceCount("TIDAK_MASUK") ? "danger" : "success"} /><StatCard label="Cuti" value={attendanceCount("CUTI")} helper="Cuti periode berjalan." /></div>
      <div className="da-hrd-dashboard-grid-v3"><section className="da-hrd-panel-v3"><div className="da-hrd-panel-head-v3"><div><h3>Catatan Absensi</h3><p>Klik nama karyawan untuk melihat histori personal.</p></div><Button onClick={openCreateAttendance}>+ Catat Absensi</Button></div><PagedDataTable columns={attendanceColumns} rows={attendanceRows} getRowKey={(row) => row.attendance_id} pageSize={20} resetKey={`${period}-${locationId}-attendance`} /></section><aside className="da-hrd-panel-v3"><div className="da-hrd-panel-head-v3"><div><h3>Kalender {period}</h3><p>Titik merah menandakan ada catatan absensi.</p></div></div><div className="da-hrd-calendar-head-v4">{["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((d)=><strong key={d}>{d}</strong>)}</div><div className="da-hrd-calendar-v3">{calendarDays.map((d)=><div key={d.key} className={`da-hrd-calendar-day-v3 ${d.outside ? "is-outside" : ""} ${d.count ? "has-data" : ""}`}><span>{d.day}</span>{d.count ? <i className="da-hrd-calendar-dot-v3" title={`${d.count} catatan`} /> : null}</div>)}</div><NoticeBox>Edit/hapus absensi otomatis ditolak jika periode payroll karyawan sudah closing/dibayar. Buka revisi payroll dulu jika memang perlu koreksi.</NoticeBox></aside></div>
    </> : null}

    {viewMode === "loans" ? <>
      <div className="da-stat-grid"><StatCard label="Sisa Kasbon" value={formatRupiah(summary.open_advance_amount || 0)} helper={`${advances.length} catatan periode ini.`} tone="warning" /><StatCard label="Sisa Pinjaman" value={formatRupiah(summary.open_loan_amount || 0)} helper={`${loans.length} pinjaman tercatat.`} tone="warning" /><StatCard label="Karyawan Aktif" value={activeEmployees.length} helper="Basis limit kasbon." /><StatCard label="Dompet Tersedia" value={wallets.length} helper="Sumber pencairan sesuai lokasi." /></div>
      <section className="da-hrd-ledger-workspace-v7">
        <div className="da-hrd-ledger-hero-v7">
          <div className="da-hrd-ledger-heading-v7">
            <span className="da-eyebrow">BUKU KARYAWAN</span>
            <h3>Kasbon, Pinjaman & Cicilan</h3>
            <p>Satu ruang kerja agar tabel lebih lebar, nominal lebih mudah dibaca, dan tombol aksi tidak berdesakan.</p>
          </div>
          <label className="da-hrd-ledger-search-v7">
            <span>Cari data</span>
            <input value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} placeholder="Nama karyawan, ID, atau catatan…" />
          </label>
        </div>

        <div className="da-hrd-ledger-switch-v7" role="tablist" aria-label="Kategori kasbon dan cicilan">
          <button type="button" role="tab" aria-selected={ledgerMode === "advance"} className={ledgerMode === "advance" ? "is-active" : ""} onClick={() => setLedgerMode("advance")}>
            <span>Kasbon Bulanan</span><strong>{filteredAdvances.length}</strong>
          </button>
          <button type="button" role="tab" aria-selected={ledgerMode === "loan"} className={ledgerMode === "loan" ? "is-active" : ""} onClick={() => setLedgerMode("loan")}>
            <span>Pinjaman & Cicilan</span><strong>{filteredLoans.length}</strong>
          </button>
        </div>

        {ledgerMode === "advance" ? (
          <div className="da-hrd-ledger-content-v7">
            <div className="da-hrd-ledger-content-head-v7">
              <div><h4>Kasbon Bulanan</h4><p>{filteredAdvances.length} catatan pada filter aktif · klik nama karyawan untuk membuka profil & riwayat.</p></div>
              <Button onClick={openCreateAdvance}>+ Kasbon Baru</Button>
            </div>
            <div className="da-hrd-table-scroll-v4 da-hrd-ledger-table-v7 is-advance"><PagedDataTable columns={advanceColumns} rows={filteredAdvances} getRowKey={(row) => row.advance_entry_id} pageSize={20} resetKey={`${period}-${locationId}-${ledgerSearch}-advance`} /></div>
          </div>
        ) : (
          <div className="da-hrd-ledger-content-v7">
            <div className="da-hrd-ledger-content-head-v7">
              <div><h4>Pinjaman & Cicilan</h4><p>{filteredLoans.length} pinjaman pada filter aktif · tampilkan modal awal, sisa, cicilan, tenor, dan status dalam satu tabel lebar.</p></div>
              <Button onClick={openCreateLoan}>+ Pinjaman Baru</Button>
            </div>
            <div className="da-hrd-table-scroll-v4 da-hrd-ledger-table-v7 is-loan"><PagedDataTable columns={loanColumns} rows={filteredLoans} getRowKey={(row) => row.loan_id} pageSize={20} resetKey={`${period}-${locationId}-${ledgerSearch}-loan`} /></div>
          </div>
        )}
      </section>
      <NoticeBox>Pengaman histori aktif: kasbon/pinjaman hasil migrasi lama tetap bisa dilihat dan dicetak, tetapi tidak boleh dihapus atau mengubah nominal opening. Transaksi ERP live yang belum terkunci dapat di-edit/hapus dan efek dompet/jurnal ikut disinkronkan.</NoticeBox>
    </> : null}

    {viewMode === "payroll" && fullPayrollAccess ? <PayrollFinalPanel session={session} period={period} locationId={locationId} baseEmployees={employees} baseAdvances={advances} mode="process" onPeriodChange={setPeriod} onLocationChange={setLocationId} onSessionExpired={onSessionExpired} onChanged={() => loadData({ quiet: true })} onOpenEmployee={(employeeId) => { const employee = employees.find((row) => row.employee_id === employeeId); if (employee) openEmployeeProfile(employee); }} /> : null}

    {viewMode === "report" && fullPayrollAccess ? <PayrollFinalPanel session={session} period={period} locationId={locationId} baseEmployees={employees} baseAdvances={advances} mode="report" onPeriodChange={setPeriod} onLocationChange={setLocationId} onSessionExpired={onSessionExpired} onChanged={() => loadData({ quiet: true })} onOpenEmployee={(employeeId) => { const employee = employees.find((row) => row.employee_id === employeeId); if (employee) openEmployeeProfile(employee); }} /> : null}

    <Modal open={employeeModalOpen} title={editingEmployeeId ? "Edit Data Karyawan" : "Tambah Karyawan"} subtitle={editingEmployeeId ? "Update master + riwayat gaji/status" : "Master HRD PHP/MySQL"} onClose={() => setEmployeeModalOpen(false)} size="xl"><form onSubmit={submitEmployee} className="da-hrd-modal-form-v3"><div className="da-form-grid da-form-grid--2"><label className="da-field"><span>Nama</span><input required value={employeeForm.employee_name} onChange={(e)=>setEmployeeForm({...employeeForm,employee_name:e.target.value})} /></label><label className="da-field"><span>Lokasi</span><select value={employeeForm.location_id} onChange={(e)=>setEmployeeForm({...employeeForm,location_id:e.target.value})}>{locations.map((row)=><option key={row.location_id} value={row.location_id}>{row.location_name} · {row.location_code}</option>)}</select></label><label className="da-field"><span>Jabatan</span><input value={employeeForm.position_name} onChange={(e)=>setEmployeeForm({...employeeForm,position_name:e.target.value})} /></label><label className="da-field"><span>Tanggal Gajian</span><input type="number" min="1" max="31" value={employeeForm.payroll_day} onChange={(e)=>setEmployeeForm({...employeeForm,payroll_day:e.target.value})} /></label><label className="da-field"><span>Sistem Gaji</span><select value={employeeForm.salary_mode} onChange={(e)=>setEmployeeForm({...employeeForm,salary_mode:e.target.value})}><option value="BULANAN">Bulanan</option><option value="HARIAN">Harian</option></select></label><label className="da-field"><span>Siklus Bayar</span><select value={employeeForm.pay_cycle} onChange={(e)=>setEmployeeForm({...employeeForm,pay_cycle:e.target.value})}><option value="BULANAN">Bulanan</option><option value="MINGGUAN">Mingguan</option></select></label><label className="da-field"><span>Gaji Pokok</span><input inputMode="numeric" value={employeeForm.base_salary} onChange={(e)=>setEmployeeForm({...employeeForm,base_salary:e.target.value})} /></label><label className="da-field"><span>Gaji Harian</span><input inputMode="numeric" value={employeeForm.daily_salary} onChange={(e)=>setEmployeeForm({...employeeForm,daily_salary:e.target.value})} /></label><label className="da-field"><span>Hari Kerja Default</span><input type="number" step="0.5" min="0" value={employeeForm.default_work_days} onChange={(e)=>setEmployeeForm({...employeeForm,default_work_days:e.target.value})} /></label><label className="da-field"><span>Status Kerja</span><select value={employeeForm.employment_status} onChange={(e)=>setEmployeeForm({...employeeForm,employment_status:e.target.value})}><option value="ACTIVE">Aktif</option><option value="ENDING">Akan Berakhir</option><option value="INACTIVE">Nonaktif</option></select></label><label className="da-field"><span>Berlaku Mulai</span><input type="month" value={employeeForm.effective_period} onChange={(e)=>setEmployeeForm({...employeeForm,effective_period:e.target.value})} /></label><label className="da-field"><span>Catatan Update</span><input value={employeeForm.notes} onChange={(e)=>setEmployeeForm({...employeeForm,notes:e.target.value})} /></label></div><div className="da-form-actions"><Button type="submit" disabled={saving}>{editingEmployeeId ? "Update Karyawan" : "Simpan Karyawan"}</Button></div></form></Modal>

    <Modal open={attendanceModalOpen} title={editingAttendanceId ? "Edit Absensi / Izin" : "Catat Absensi / Izin"} subtitle="Sumber payroll live" onClose={() => setAttendanceModalOpen(false)} size="xl"><form onSubmit={submitAttendance} className="da-hrd-modal-form-v3"><div className="da-form-grid"><label className="da-field"><span>Karyawan</span><select required value={attendanceForm.employee_id} disabled={Boolean(editingAttendanceId)} onChange={(e)=>setAttendanceForm({...attendanceForm,employee_id:e.target.value})}><option value="">Pilih karyawan</option>{activeEmployees.map((row)=><option key={row.employee_id} value={row.employee_id}>{row.employee_name} · {row.location_code}</option>)}</select></label><label className="da-field"><span>Tanggal</span><input type="date" value={attendanceForm.attendance_date} onChange={(e)=>setAttendanceForm({...attendanceForm,attendance_date:e.target.value})} /></label><label className="da-field"><span>Status</span><select value={attendanceForm.attendance_type} onChange={(e)=>setAttendanceForm({...attendanceForm,attendance_type:e.target.value,deduct_salary:e.target.value==="TIDAK_MASUK"})}><option value="HADIR">Hadir</option><option value="IZIN">Izin</option><option value="SAKIT">Sakit</option><option value="TIDAK_MASUK">Tidak Masuk</option><option value="CUTI">Cuti</option><option value="DINAS">Dinas</option><option value="SETENGAH_HARI">Setengah Hari</option><option value="LIBUR">Libur</option><option value="LEMBUR">Lembur</option></select></label><label className="da-field"><span>Nilai Hari</span><input type="number" step="0.5" min="0" max="1" value={attendanceForm.day_fraction} onChange={(e)=>setAttendanceForm({...attendanceForm,day_fraction:e.target.value})} /></label><label className="da-field"><span>Uang Lembur</span><input inputMode="numeric" value={attendanceForm.overtime_amount} onChange={(e)=>setAttendanceForm({...attendanceForm,overtime_amount:e.target.value})} /></label><label className="da-field"><span>Catatan</span><input value={attendanceForm.notes} onChange={(e)=>setAttendanceForm({...attendanceForm,notes:e.target.value})} /></label></div><label className="da-hrd-check-v4"><input type="checkbox" checked={attendanceForm.deduct_salary} onChange={(e)=>setAttendanceForm({...attendanceForm,deduct_salary:e.target.checked})} /> Dihitung sebagai hari potong gaji</label><div className="da-form-actions"><Button type="submit" disabled={saving}>{editingAttendanceId ? "Update Absensi" : "Simpan Absensi"}</Button></div></form></Modal>

    <Modal open={advanceModalOpen} title={editingAdvanceId ? "Edit Kasbon Karyawan" : "Kasbon Bulanan"} subtitle="Buku catatan kasbon · Wallet OUT + Piutang Kasbon Karyawan" onClose={() => setAdvanceModalOpen(false)} size="xl">
      {(() => {
        const emp = employees.find((row)=>String(row.employee_id)===String(advanceForm.employee_id));
        const ctx = advancePrintContext({employee_id:advanceForm.employee_id,entry_date:advanceForm.date});
        const pct = numberValue(ctx.safe_limit) > 0 ? Math.min(100, Math.round((numberValue(ctx.taken_amount)/numberValue(ctx.safe_limit))*100)) : 0;
        const allowedWallets = wallets.filter((row)=>!advanceForm.employee_id || String(row.location_id)===String(emp?.location_id));
        return <form onSubmit={submitAdvance} className="da-local-kasbon-modal-v20"><div className="da-local-kasbon-head-v20"><div><span>Kasbon Bulanan</span><strong>{emp?.employee_name || "Pilih karyawan"}</strong><small>Periode {String(advanceForm.date || period).slice(0,7)} · {emp?.location_name || emp?.location_code || "-"}</small></div>{fullPayrollAccess && emp ? <div><span>Limit Aman Kasbon</span><strong>{formatRupiah(numberValue(ctx.safe_limit))}</strong><small>Cadangan cicilan/absen {formatRupiah(numberValue(ctx.loan_reserved)+numberValue(ctx.absence_reserved))}</small></div> : null}</div>{emp && fullPayrollAccess ? <><div className="da-local-kasbon-reserve-v20"><span>Total Kasbon Bulan Terpilih</span><strong>{formatRupiah(numberValue(ctx.taken_amount))}</strong><span>Sisa Bisa Kasbon</span><strong className="green">{formatRupiah(numberValue(ctx.remaining_limit))}</strong></div><div className="da-local-kasbon-progress-v20"><i style={{width:`${pct}%`}}/><span>{pct}% dari limit aman</span></div></> : null}<div className="da-local-kasbon-form-v20"><label><span>Karyawan</span><select required disabled={Boolean(editingAdvanceId)} value={advanceForm.employee_id} onChange={(e)=>setAdvanceForm({...advanceForm,employee_id:e.target.value,wallet_id:""})}><option value="">Pilih karyawan</option>{activeEmployees.map((row)=><option key={row.employee_id} value={row.employee_id}>{row.employee_name} · {row.location_code}</option>)}</select></label>{!editingAdvanceId ? <label><span>Dompet Pengeluaran</span><select required value={advanceForm.wallet_id} onChange={(e)=>setAdvanceForm({...advanceForm,wallet_id:e.target.value})}><option value="">Pilih dompet lokasi</option>{allowedWallets.map((row)=><option key={row.wallet_id} value={row.wallet_id}>{row.wallet_name} · {row.location_code} · {formatRupiah(row.current_balance || 0)}</option>)}</select></label> : null}<label><span>Tanggal Ambil</span><input type="date" disabled={editingAdvanceId && String(editingAdvanceMeta?.source_system || "").toUpperCase() !== "ERP_LIVE"} value={advanceForm.date} onChange={(e)=>setAdvanceForm({...advanceForm,date:e.target.value})}/></label><label><span>Nominal</span><input required inputMode="numeric" disabled={editingAdvanceId && String(editingAdvanceMeta?.source_system || "").toUpperCase() !== "ERP_LIVE"} value={advanceForm.amount} onChange={(e)=>setAdvanceForm({...advanceForm,amount:e.target.value})}/></label><label className="note"><span>Keterangan</span><input value={advanceForm.notes} onChange={(e)=>setAdvanceForm({...advanceForm,notes:e.target.value})} placeholder="Contoh: Bensin, Pulsa…"/></label><Button type="submit" disabled={saving}>{editingAdvanceId ? "Update" : "Simpan"}</Button></div><div className="da-local-kasbon-accounting-v20">Akunting ERP: <strong>Debit Piutang Kasbon Karyawan</strong> → <strong>Kredit Dompet/Kas</strong>. Saat closing gaji, pelunasan kasbon mengurangi piutang tanpa membuat kas masuk baru.</div>{editingAdvanceId && String(editingAdvanceMeta?.source_system || "").toUpperCase() !== "ERP_LIVE" ? <NoticeBox>Ini histori migrasi lama. Nominal/tanggal tidak boleh diubah, tetapi catatan tetap dapat diperbarui.</NoticeBox> : null}</form>;
      })()}
    </Modal>

    <Modal open={loanModalOpen} title={editingLoanId ? "Edit Pinjaman Panjang" : "Pinjaman Panjang"} subtitle="Buku catatan pinjaman karyawan · tenor & cicilan" onClose={() => setLoanModalOpen(false)} size="xl">
      {(() => {
        const emp = employees.find((row)=>String(row.employee_id)===String(loanForm.employee_id));
        const employeeLoans = loans.filter((row)=>String(row.employee_id)===String(loanForm.employee_id));
        const openRows = employeeLoans.filter((row)=>String(row.status || "").toUpperCase()==="OPEN" && numberValue(row.remaining_amount)>0);
        const openBalance = openRows.reduce((total,row)=>total+numberValue(row.remaining_amount),0);
        const autoInstallment = openRows.filter((row)=>String(row.payment_mode || "AUTO_PAYROLL").toUpperCase()==="AUTO_PAYROLL").reduce((total,row)=>total+numberValue(row.installment_amount),0);
        const allowedWallets = wallets.filter((row)=>!loanForm.employee_id || String(row.location_id)===String(emp?.location_id));
        const locked = Boolean(editingLoanId) && (String(editingLoanMeta?.source_system || "").toUpperCase() !== "ERP_LIVE" || numberValue(editingLoanMeta?.tenor_paid) > 0 || String(editingLoanMeta?.status || "").toUpperCase() === "CLOSED");
        return <form onSubmit={submitLoan} className="da-local-loan-modal-v20"><div className="da-local-loan-kpis-v20"><div><span>Sisa Pinjaman Aktif</span><strong className="red">{formatRupiah(openBalance)}</strong></div><div><span>Cicilan Otomatis Bulan Ini</span><strong>{formatRupiah(autoInstallment)}</strong></div><div><span>Pinjaman Aktif</span><strong className="green">{openRows.length}</strong></div></div><div className="da-local-loan-summary-v20"><div><span>Sisa Utang / Pinjaman Panjang</span><strong>{formatRupiah(openBalance)}</strong></div><div><span>Total Pinjaman</span><strong>{formatRupiah(employeeLoans.reduce((t,row)=>t+numberValue(row.original_amount),0))}</strong></div><div><span>Total Dibayar</span><strong className="green">{formatRupiah(employeeLoans.reduce((t,row)=>t+Math.max(0,numberValue(row.original_amount)-numberValue(row.remaining_amount)),0))}</strong></div></div><div className="da-local-loan-accounting-v20">⚖ Akunting: tambah pinjaman = <strong>Piutang Pinjaman Karyawan naik & kas keluar</strong>. Bayar cicilan manual = piutang turun & kas masuk. Potong gaji = piutang turun saat closing payroll.</div><div className="da-local-loan-form-v20"><label><span>Karyawan</span><select required disabled={Boolean(editingLoanId)} value={loanForm.employee_id} onChange={(e)=>setLoanForm({...loanForm,employee_id:e.target.value,wallet_id:""})}><option value="">Pilih karyawan</option>{activeEmployees.map((row)=><option key={row.employee_id} value={row.employee_id}>{row.employee_name} · {row.location_code}</option>)}</select></label>{!editingLoanId ? <label><span>Dompet Pengeluaran</span><select required value={loanForm.wallet_id} onChange={(e)=>setLoanForm({...loanForm,wallet_id:e.target.value})}><option value="">Pilih dompet lokasi</option>{allowedWallets.map((row)=><option key={row.wallet_id} value={row.wallet_id}>{row.wallet_name} · {row.location_code}</option>)}</select></label> : null}<label><span>Jenis</span><input readOnly value="Pinjam Uang (Tambah Utang)"/></label><label><span>Tanggal</span><input type="date" disabled={locked} value={loanForm.loan_date} onChange={(e)=>setLoanForm({...loanForm,loan_date:e.target.value})}/></label><label><span>Nominal</span><input required inputMode="numeric" disabled={locked} value={loanForm.amount} onChange={(e)=>setLoanForm({...loanForm,amount:e.target.value})}/></label><label className="note"><span>Catatan</span><input value={loanForm.notes} onChange={(e)=>setLoanForm({...loanForm,notes:e.target.value})} placeholder="Catatan…"/></label><label><span>Tenor Cicilan</span><input type="number" min="0" max="120" value={loanForm.tenor_total} onChange={(e)=>setLoanForm({...loanForm,tenor_total:e.target.value})}/></label><label><span>Cicilan / Bulan Otomatis</span><input inputMode="numeric" value={loanForm.installment_amount} onChange={(e)=>setLoanForm({...loanForm,installment_amount:e.target.value})}/></label><label><span>Mulai Potong Periode</span><input type="month" value={loanForm.start_period} onChange={(e)=>setLoanForm({...loanForm,start_period:e.target.value})}/></label><label><span>Mode Cicilan</span><select value={loanForm.payment_mode} onChange={(e)=>setLoanForm({...loanForm,payment_mode:e.target.value})}><option value="AUTO_PAYROLL">Otomatis ikut payroll</option><option value="MANUAL">Manual</option></select></label></div>{editingLoanId && (String(editingLoanMeta?.source_system || "").toUpperCase() !== "ERP_LIVE" || numberValue(editingLoanMeta?.tenor_paid) > 0) ? <NoticeBox>Nominal/tanggal dikunci karena ini histori lama atau sudah memiliki cicilan. Tenor, nilai cicilan, mulai potong, cara bayar, dan catatan tetap dapat di-update.</NoticeBox> : null}<div className="da-form-actions"><Button type="submit" disabled={saving}>{editingLoanId ? "Update Pinjaman" : "Simpan Pinjaman"}</Button></div></form>;
      })()}
    </Modal>

    <Modal open={loanInstallmentOpen} title="Bayar Cicilan Pinjaman" subtitle="Cicilan manual → Piutang Pinjaman turun → uang masuk ke dompet lokasi" onClose={() => { setLoanInstallmentOpen(false); setLoanInstallmentForm(emptyLoanInstallment()); }} size="xl">
      {(() => {
        const targetLoan = loans.find((row) => String(row.loan_id) === String(loanInstallmentForm.loan_id));
        const targetEmployee = employees.find((row) => String(row.employee_id) === String(targetLoan?.employee_id));
        const allowedWallets = wallets.filter((wallet) => !targetEmployee?.location_id || String(wallet.location_id) === String(targetEmployee.location_id));
        return <form onSubmit={submitLoanInstallment} className="da-hrd-modal-form-v3 da-loan-installment-local-v20"><div className="da-modal-summary"><div><span className="da-muted">Karyawan</span><strong style={{display:"block",fontSize:18}}>{targetLoan?.employee_name || targetEmployee?.employee_name || "-"}</strong><small className="da-muted">Pinjaman: {targetLoan?.loan_id || "-"}</small></div><div style={{textAlign:"right"}}><span className="da-muted">Sisa Pinjaman</span><strong style={{display:"block",fontSize:22,color:"#D9251C"}}>{formatRupiah(numberValue(targetLoan?.remaining_amount))}</strong></div></div><NoticeBox>Cicilan manual mengikuti akunting Payroll V32: Piutang Pinjaman Karyawan berkurang. Karena uang benar-benar dikembalikan oleh karyawan, ERP mencatat Kas/Bank Masuk ke dompet lokasi. Jika cicilan dipotong dari gaji, jangan gunakan form ini—biarkan Closing Payroll yang mencatatnya.</NoticeBox><div className="da-form-grid da-form-grid--2"><label className="da-field"><span>Tanggal Bayar</span><input type="date" required value={loanInstallmentForm.payment_date} onChange={(e)=>setLoanInstallmentForm({...loanInstallmentForm,payment_date:e.target.value})}/></label><label className="da-field"><span>Dompet Penerima</span><select required value={loanInstallmentForm.wallet_id} onChange={(e)=>setLoanInstallmentForm({...loanInstallmentForm,wallet_id:e.target.value})}><option value="">Pilih dompet lokasi</option>{allowedWallets.map((wallet)=><option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name} · {wallet.location_code || targetEmployee?.location_code || ""}</option>)}</select></label><label className="da-field"><span>Nominal Cicilan</span><input inputMode="numeric" required value={loanInstallmentForm.amount} onChange={(e)=>setLoanInstallmentForm({...loanInstallmentForm,amount:e.target.value})}/></label><label className="da-field"><span>Catatan</span><input value={loanInstallmentForm.notes} onChange={(e)=>setLoanInstallmentForm({...loanInstallmentForm,notes:e.target.value})}/></label></div><div className="da-form-actions"><Button type="submit" disabled={saving || !loanInstallmentForm.wallet_id}>Simpan Pembayaran Cicilan</Button></div></form>;
      })()}
    </Modal>

    <Modal open={Boolean(selectedEmployee)} title="Profil & Riwayat Karyawan" subtitle={`${selectedEmployee?.employee_name || "-"} · ${selectedEmployee?.location_name || ""} · ${selectedEmployee?.position || ""}`} onClose={() => { setSelectedEmployee(null); setEmployeeProfile(null); }} size="xl">
      <div className="da-hrd-profile-shell-v5">
      <div className="da-hrd-profile-head-v4"><div><span className="da-eyebrow">PROFIL & RIWAYAT KARYAWAN</span><h2>{selectedEmployee?.employee_name}</h2><p>{selectedEmployee?.employee_code} · {selectedEmployee?.location_name} · Gajian tgl {selectedEmployee?.payroll_day || "-"}</p></div><div className="da-hrd-profile-controls-v4"><label><span>Tahun</span><select value={profileYear} onChange={(e)=>setProfileYear(e.target.value)}>{Array.from({length:7},(_,i)=>String(new Date().getFullYear()-i)).map((year)=><option key={year} value={year}>{year}</option>)}</select></label><Button className="da-hrd-icon-label-btn-v6" variant="secondary" onClick={() => employeeProfile && printHRDEmployeeProfileV32(employeeProfile)} disabled={!employeeProfile}><Printer size={15} /> Print Profil</Button>{fullPayrollAccess ? <Button className="da-hrd-icon-label-btn-v6" variant="secondary" onClick={() => { const row = selectedEmployee; setSelectedEmployee(null); setEmployeeProfile(null); openEditEmployee(row); }}><Edit2 size={15} /> Edit</Button> : null}</div></div>
      {profileLoading ? <div className="da-hrd-profile-loading-v4">Memuat riwayat karyawan…</div> : null}
      {!profileLoading && employeeProfile ? <>
        <div className="da-hrd-profile-kpis-v4">{fullPayrollAccess ? <><StatCard label={`Gaji Diterima ${profileYear}`} value={formatRupiah(numberValue(employeeProfile?.totals?.salary_received_year))} helper="Hanya payment PAID di tahun terpilih." tone="success" /><StatCard label="Gaji Diterima s.d. Kemarin" value={formatRupiah(numberValue(employeeProfile?.totals?.salary_received_to_yesterday))} helper={`Sampai ${formatDate(employeeProfile?.yesterday)}.`} tone="success" /><StatCard label={`Bonus Dibayar ${profileYear}`} value={formatRupiah(numberValue(employeeProfile?.totals?.bonus_paid_year))} helper="Dari payroll yang sudah dibayar." /><StatCard label={`Lembur Dibayar ${profileYear}`} value={formatRupiah(numberValue(employeeProfile?.totals?.overtime_paid_year))} helper="Dari payroll yang sudah dibayar." /></> : null}<StatCard label="Sisa Kasbon" value={formatRupiah(numberValue(employeeProfile?.totals?.advance_balance))} helper={`Diambil ${profileYear}: ${formatRupiah(numberValue(employeeProfile?.totals?.kasbon_taken_year))}`} tone="warning" /><StatCard label="Sisa Pinjaman" value={formatRupiah(numberValue(employeeProfile?.totals?.loan_balance))} helper={`Cicilan ${profileYear}: ${formatRupiah(numberValue(employeeProfile?.totals?.loan_installments_year))}`} tone="warning" /></div>
        {employeeProfile?.data_note ? <NoticeBox>{employeeProfile.data_note}</NoticeBox> : null}
        <div className="da-hrd-profile-tabs-v4">{[["overview","Ringkasan"],["payroll","Gaji & Pembayaran"],["attendance","Absensi & Lembur"],["advance","Kasbon"],["loan","Pinjaman & Cicilan"],["history","Riwayat Master"]].filter(([key])=>fullPayrollAccess || !["payroll","history"].includes(key)).map(([key,label])=><button key={key} type="button" className={detailTab===key?"is-active":""} onClick={()=>setDetailTab(key)}>{label}</button>)}</div>
        {detailTab === "overview" ? <div className="da-detail-grid"><div className="da-detail-box"><span className="da-muted">Employee ID</span><strong>{selectedEmployee?.employee_id}</strong></div><div className="da-detail-box"><span className="da-muted">Status</span><strong>{selectedEmployee?.employment_status}</strong></div><div className="da-detail-box"><span className="da-muted">Jabatan</span><strong>{selectedEmployee?.position}</strong></div>{fullPayrollAccess ? <div className="da-detail-box"><span className="da-muted">Gaji Pokok Saat Ini</span><strong>{formatRupiah(selectedEmployee?.base_salary || 0)}</strong></div> : null}<div className="da-detail-box"><span className="da-muted">Absensi Tahun</span><strong>{profileAttendance.length} catatan</strong></div><div className="da-detail-box"><span className="da-muted">Lembur dari Absensi</span><strong>{formatRupiah(numberValue(employeeProfile?.totals?.overtime_attendance_year))}</strong></div></div> : null}
        {detailTab === "payroll" && fullPayrollAccess ? <><h3 className="da-hrd-profile-section-title-v4">Payroll {profileYear}</h3><PagedDataTable columns={[{key:"period",label:"Periode"},{key:"status",label:"Status",render:(row)=><Badge tone={badgeTone(row.status)}>{row.status}</Badge>},{key:"payment_status",label:"Bayar",render:(row)=><Badge tone={badgeTone(row.payment_status)}>{row.payment_status}</Badge>},{key:"bonus_amount",label:"Bonus",render:(row)=>formatRupiah(numberValue(row.bonus_amount))},{key:"overtime_amount",label:"Lembur",render:(row)=>formatRupiah(numberValue(row.overtime_amount))},{key:"net_pay",label:"THP",render:(row)=><strong>{formatRupiah(numberValue(row.net_pay))}</strong>}]} rows={profilePayroll} getRowKey={(row)=>row.payroll_run_id} pageSize={20} resetKey={`${selectedEmployee?.employee_id}-${profileYear}-profile-payroll`} /><h3 className="da-hrd-profile-section-title-v4">Pembayaran Gaji {profileYear}</h3><PagedDataTable columns={[{key:"payment_date",label:"Tanggal",render:(row)=>formatDate(row.payment_date)},{key:"payment_id",label:"Payment ID"},{key:"wallet_name",label:"Dompet"},{key:"amount",label:"Dibayar",render:(row)=><strong>{formatRupiah(numberValue(row.amount))}</strong>}]} rows={profilePayments} getRowKey={(row)=>row.payment_id} pageSize={20} resetKey={`${selectedEmployee?.employee_id}-${profileYear}-profile-payments`} /></> : null}
        {detailTab === "attendance" ? <PagedDataTable columns={[{key:"attendance_date",label:"Tanggal",render:(row)=>formatDate(row.attendance_date)},{key:"attendance_type",label:"Jenis",render:(row)=><Badge tone={badgeTone(row.attendance_type)}>{row.attendance_type}</Badge>},{key:"day_fraction",label:"Hari",render:(row)=>numberValue(row.day_fraction)},{key:"deduct_salary",label:"Potong Gaji",render:(row)=>numberValue(row.deduct_salary) ? "Ya" : "Tidak"},{key:"overtime_amount",label:"Lembur",render:(row)=>formatRupiah(numberValue(row.overtime_amount))},{key:"notes",label:"Catatan"}]} rows={profileAttendance} getRowKey={(row)=>row.attendance_id} pageSize={20} resetKey={`${selectedEmployee?.employee_id}-${profileYear}-profile-attendance`} /> : null}
        {detailTab === "advance" ? <div className="da-profile-ledger-local-v20">{(() => { const ctx = advancePrintContext({ employee_id:selectedEmployee?.employee_id, entry_date:`${period}-01` }); return <><div className="da-profile-ledger-summary-v20"><div><span>Total Kasbon Bulan Terpilih</span><strong className="red">{formatRupiah(numberValue(ctx.taken_amount))}</strong></div>{fullPayrollAccess ? <div><span>Limit Aman Kasbon</span><strong>{formatRupiah(numberValue(ctx.safe_limit))}</strong><small>Cadangan cicilan/absen {formatRupiah(numberValue(ctx.loan_reserved)+numberValue(ctx.absence_reserved))}</small></div> : null}<div className="green"><span>Sisa yang Masih Bisa Dikasbon</span><strong>{fullPayrollAccess ? formatRupiah(numberValue(ctx.remaining_limit)) : "Sesuai hak akses"}</strong></div></div><div className="da-profile-ledger-head-v20"><div><h3>Riwayat Kasbon</h3><p>Pengambilan, pelunasan payroll, dan histori lama dalam satu ledger.</p></div><Button onClick={() => openCreateAdvanceForEmployee(selectedEmployee)}>+ Kasbon Baru</Button></div></>; })()}<PagedDataTable columns={[{key:"entry_date",label:"Tanggal",render:(row)=>formatDate(row.entry_date)},{key:"entry_type",label:"Jenis"},{key:"amount",label:"Nominal",render:(row)=>formatRupiah(numberValue(row.amount))},{key:"balance_effect",label:"Gerak Saldo",render:(row)=>formatRupiah(numberValue(row.balance_effect))},{key:"notes",label:"Catatan"}]} rows={profileAdvances} getRowKey={(row)=>row.advance_entry_id} pageSize={20} resetKey={`${selectedEmployee?.employee_id}-${profileYear}-profile-advance`} /></div> : null}
        {detailTab === "loan" ? <div className="da-profile-ledger-local-v20"><div className="da-profile-ledger-summary-v20"><div><span>Total Pinjaman Awal</span><strong>{formatRupiah(profileLoans.reduce((t,row)=>t+numberValue(row.original_amount),0))}</strong></div><div><span>Total Cicilan Tercatat</span><strong className="green-text">{formatRupiah(profileLoanMovements.reduce((t,row)=>t+Math.max(0,numberValue(row.amount)),0))}</strong></div><div className="redbox"><span>Sisa Pinjaman Aktif</span><strong>{formatRupiah(numberValue(employeeProfile?.totals?.loan_balance))}</strong></div></div><div className="da-profile-ledger-accounting-v20">Akunting: tambah pinjaman → Piutang Pinjaman Karyawan naik & kas keluar. Cicilan manual → piutang turun & kas masuk. Potongan payroll → piutang turun saat closing.</div><div className="da-profile-ledger-head-v20"><div><h3>Pinjaman Panjang</h3><p>Tenor, sisa saldo, dan status pinjaman karyawan.</p></div><Button onClick={() => openCreateLoanForEmployee(selectedEmployee)}>+ Pinjaman Baru</Button></div><PagedDataTable columns={[{key:"loan_date",label:"Tanggal",render:(row)=>formatDate(row.loan_date)},{key:"original_amount",label:"Awal",render:(row)=>formatRupiah(numberValue(row.original_amount))},{key:"remaining_amount",label:"Sisa",render:(row)=><strong>{formatRupiah(numberValue(row.remaining_amount))}</strong>},{key:"installment_amount",label:"Cicilan",render:(row)=>formatRupiah(numberValue(row.installment_amount))},{key:"status",label:"Status"}]} rows={profileLoans} getRowKey={(row)=>row.loan_id} pageSize={20} resetKey={`${selectedEmployee?.employee_id}-${profileYear}-profile-loans`} /><h3 className="da-hrd-profile-section-title-v4">Gerakan Cicilan {profileYear}</h3><PagedDataTable columns={[{key:"movement_date",label:"Tanggal",render:(row)=>formatDate(row.movement_date)},{key:"movement_type",label:"Jenis"},{key:"amount",label:"Nominal",render:(row)=>formatRupiah(numberValue(row.amount))},{key:"balance_after",label:"Sisa Setelah",render:(row)=>formatRupiah(numberValue(row.balance_after))},{key:"notes",label:"Catatan"}]} rows={profileLoanMovements} getRowKey={(row)=>row.loan_movement_id} pageSize={20} resetKey={`${selectedEmployee?.employee_id}-${profileYear}-profile-loan-movements`} /></div> : null}
        {detailTab === "history" && fullPayrollAccess ? <><h3 className="da-hrd-profile-section-title-v4">Riwayat Gaji Master</h3><PagedDataTable columns={[{key:"effective_period",label:"Berlaku"},{key:"salary_mode",label:"Sistem"},{key:"base_salary",label:"Gaji Pokok",render:(row)=>formatRupiah(numberValue(row.base_salary))},{key:"daily_salary",label:"Gaji Harian",render:(row)=>formatRupiah(numberValue(row.daily_salary))},{key:"source_type",label:"Sumber"}]} rows={profileSalary} getRowKey={(row)=>row.salary_history_id} pageSize={20} resetKey={`${selectedEmployee?.employee_id}-${profileYear}-profile-salary`} /><h3 className="da-hrd-profile-section-title-v4">Riwayat Status</h3><PagedDataTable columns={[{key:"effective_date",label:"Tanggal",render:(row)=>formatDate(row.effective_date)},{key:"from_status",label:"Dari"},{key:"to_status",label:"Menjadi"},{key:"reason",label:"Alasan"}]} rows={profileStatus} getRowKey={(row)=>row.status_history_id} pageSize={20} resetKey={`${selectedEmployee?.employee_id}-${profileYear}-profile-status`} /></> : null}
      </> : null}
      </div>
    </Modal>
  </div>;
}
