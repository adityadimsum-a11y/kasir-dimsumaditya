import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import {
  createHRDPayrollClosing,
  createHRDPayrollDraft,
  createHRDPayrollPayment,
  getHRDPayrollFinalBootstrap,
  hrdPayrollFinalHealth,
  previewHRDPayrollFinal,
  recordHRDPayrollPrint,
  reopenHRDPayroll,
  voidHRDPayrollDraft,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import {
  printPayrollBatchV32,
  printPayrollPaymentReceiptV32,
  printPayrollRecapA4V32,
  printPayrollSlipV32,
} from "./PayrollPrintTemplates";

function arr(value) { return Array.isArray(value) ? value : []; }
function num(value) {
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function today() { return new Date().toISOString().slice(0, 10); }
function operationId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function authRequired(result) {
  const text = `${result?.message || ""} ${result?.error?.code || ""}`.toUpperCase();
  return text.includes("AUTH_REQUIRED") || text.includes("SESSION_INVALID");
}
function tone(status) {
  const value = String(status || "").toUpperCase();
  if (["PAID", "CLOSED", "ACTIVE"].some((item) => value.includes(item))) return "success";
  if (["DRAFT", "UNPAID", "ENDING", "LEGACY"].some((item) => value.includes(item))) return "warning";
  if (["VOID", "INACTIVE"].some((item) => value.includes(item))) return "danger";
  return "default";
}
function scheduleLabel(row) {
  if (String(row?.pay_cycle || "").toUpperCase() === "MINGGUAN") return `Minggu ${row?.week_no || "-"}`;
  return `Tgl ${row?.payroll_day || "-"}`;
}
function employeeLocationName(employee) {
  return employee?.location_name_snapshot || employee?.location_name || employee?.location_code || "-";
}
function employeeName(employee) { return employee?.employee_name || employee?.employee_name_snapshot || "-"; }
function round5000(value) { return Math.round(num(value) / 5000) * 5000; }
function sum(rows, field) { return arr(rows).reduce((total, row) => total + num(row?.[field]), 0); }
function groupRows(rows, keyFn) {
  const map = new Map();
  arr(rows).forEach((row) => {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return Array.from(map.entries()).map(([key, items]) => ({ key, rows: items }));
}
function statusText(row) {
  const payment = String(row?.payment_status || "UNPAID").toUpperCase();
  if (payment === "PAID") return "PAID";
  return String(row?.status || "DRAFT").toUpperCase();
}
function formatPeriod(period) {
  const [year, month] = String(period || "").split("-");
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return month ? `${months[Number(month) - 1] || month} ${year}` : period || "-";
}
function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

const emptyForm = {
  employee_id: "",
  payroll_run_id: "",
  bonus_amount: "0",
  overtime_amount: "",
  absence_days: "",
  loan_deduction: "",
  extra_deduction: "0",
  work_days: "",
  week_no: "1",
  week_start: "",
  week_end: "",
  final_week: true,
  notes: "",
  absence_notice_enabled: false,
  absence_notice_type: "PEMBERITAHUAN",
  absence_notice_date: today(),
  absence_notice_no: "",
  absence_basis: "TANPA_KETERANGAN",
  absence_dates: "",
  absence_detail: "",
  absence_employee_note: "",
  absence_print_with_slip: true,
};

function LocalKpi({ label, value, helper, toneName = "default", onClick }) {
  return (
    <button type="button" className={`da-payroll-v32-kpi is-${toneName}${onClick ? " is-clickable" : ""}`} onClick={onClick} disabled={!onClick}>
      <span>{label}</span><strong>{value}</strong>{helper ? <small>{helper}</small> : null}
    </button>
  );
}

function LocalAction({ children, variant = "soft", onClick, disabled = false, title = "" }) {
  return <button type="button" className={`da-payroll-v32-action is-${variant}`} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}

function PayrollMiniTable({ rows = [], onOpen, onPrint, onDelete, pageSize = 20 }) {
  const dataRows = arr(rows);
  const pages = Math.max(1, Math.ceil(dataRows.length / pageSize));
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [dataRows.length]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const start = (page - 1) * pageSize;
  const visible = dataRows.slice(start, start + pageSize);
  return (
    <div className="da-payroll-v32-paged-table">
      <div className="da-payroll-v32-table-scroll">
        <table className="da-payroll-v32-table">
          <thead><tr><th>Karyawan / Status</th><th>Area</th><th>Jadwal</th><th>Penghasilan</th><th>Kasbon</th><th>Cicilan</th><th>Total Pot.</th><th>THP</th><th>Aksi</th></tr></thead>
          <tbody>
            {visible.length ? visible.map((row) => (
              <tr key={row.payroll_run_id}>
                <td><button type="button" className="da-payroll-v32-name" onClick={() => onOpen?.(row)}>{row.employee_name_snapshot}</button><small><Badge tone={tone(statusText(row))}>{statusText(row)}</Badge></small></td>
                <td>{row.location_name_snapshot || "-"}</td><td>{scheduleLabel(row)}</td>
                <td className="money">{formatRupiah(num(row.total_income))}</td><td className="money red">{formatRupiah(num(row.advance_deduction))}</td><td className="money red">{formatRupiah(num(row.loan_deduction))}</td><td className="money">{formatRupiah(num(row.total_deduction))}</td><td className="money green">{formatRupiah(num(row.net_pay))}</td>
                <td><div className="da-payroll-v32-icon-actions"><button type="button" title="Rincian / Edit" onClick={() => onOpen?.(row)}><Edit2 size={16}/></button><button type="button" title="Cetak Slip" onClick={() => onPrint?.(row)}><Printer size={16}/></button><button type="button" className="danger" title="Hapus Draft" disabled={String(row.status || "").toUpperCase() !== "DRAFT"} onClick={() => onDelete?.(row)}><Trash2 size={16}/></button></div></td>
              </tr>
            )) : <tr><td colSpan="9" className="empty">Belum ada draft / closing payroll pada filter ini.</td></tr>}
          </tbody>
        </table>
      </div>
      {dataRows.length > pageSize ? <div className="da-payroll-v32-pagination"><span>{start + 1}–{Math.min(start + pageSize, dataRows.length)} dari {dataRows.length} data</span><div><button type="button" disabled={page===1} onClick={()=>setPage(1)}>«</button><button type="button" disabled={page===1} onClick={()=>setPage((p)=>Math.max(1,p-1))}>Sebelumnya</button><strong>Halaman {page} / {pages}</strong><button type="button" disabled={page===pages} onClick={()=>setPage((p)=>Math.min(pages,p+1))}>Berikutnya</button><button type="button" disabled={page===pages} onClick={()=>setPage(pages)}>»</button></div></div> : dataRows.length ? <div className="da-payroll-v32-pagination single"><span>{dataRows.length} data · maks. {pageSize} / halaman</span></div> : null}
    </div>
  );
}

export default function PayrollFinalPanel({
  session,
  period,
  locationId,
  baseEmployees = [],
  baseAdvances = [],
  mode = "process",
  onPeriodChange,
  onLocationChange,
  onSessionExpired,
  onChanged,
  onOpenEmployee,
}) {
  const token = session?.sessionToken || session?.session_token || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [paymentForm, setPaymentForm] = useState({ payroll_run_id: "", wallet_id: "", payment_date: today(), payment_method: "TRANSFER", reference_no: "", notes: "Pembayaran gaji." });
  const [reopenReason, setReopenReason] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [printArea, setPrintArea] = useState("ALL");
  const [printSchedule, setPrintSchedule] = useState("ALL");
  const [printMode, setPrintMode] = useState("READY");
  const previewSeq = useRef(0);

  const employees = useMemo(() => {
    const source = arr(data?.employees).length ? arr(data?.employees) : baseEmployees;
    return source.filter((employee) => String(employee.employment_status || "ACTIVE").toUpperCase() !== "INACTIVE");
  }, [data, baseEmployees]);
  const rows = useMemo(() => arr(data?.payroll_rows), [data]);
  const payments = useMemo(() => arr(data?.payments), [data]);
  const wallets = useMemo(() => arr(data?.payment_wallets), [data]);
  const locations = useMemo(() => arr(data?.locations), [data]);
  const summary = data?.summary || {};
  const health = data?.health || {};
  const selectedEmployee = employees.find((employee) => String(employee.employee_id) === String(form.employee_id));
  const selectedRun = rows.find((row) => String(row.payroll_run_id) === String(form.payroll_run_id)) || null;
  const selectedPaymentRun = rows.find((row) => String(row.payroll_run_id) === String(paymentForm.payroll_run_id)) || null;
  const isRunLocked = ["CLOSED", "PAID"].includes(statusText(selectedRun));

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    return employees.filter((employee) => !q || `${employeeName(employee)} ${employee?.employee_code || ""} ${employeeLocationName(employee)}`.toLowerCase().includes(q));
  }, [employees, employeeSearch]);

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const healthResult = await hrdPayrollFinalHealth(token, {});
      if (authRequired(healthResult)) return onSessionExpired?.();
      if (!healthResult?.success) throw new Error(healthResult?.message || "Payroll Final belum siap.");
      const payload = { period };
      if (locationId && locationId !== "ALL") payload.location_id = locationId;
      const result = await getHRDPayrollFinalBootstrap(token, payload);
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) throw new Error(result?.message || "Data Payroll Final gagal dibaca.");
      setData(result.data || null);
    } catch (err) {
      setError(err?.message || "Payroll Final gagal dibaca.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period, locationId]);

  useEffect(() => {
    if (!form.employee_id || isRunLocked) return undefined;
    const timer = window.setTimeout(() => { void previewServer({ quiet: true }); }, 420);
    return () => window.clearTimeout(timer);
    // Preview harus mengikuti nilai input utama, tetapi operation IDs tidak menjadi dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.employee_id, form.bonus_amount, form.overtime_amount, form.absence_days, form.loan_deduction, form.extra_deduction, form.work_days, form.week_no, form.week_start, form.week_end, form.final_week]);

  function resetForm() {
    setForm(emptyForm);
    setPreview(null);
    setReopenReason("");
  }

  function matchingRun(employeeId, weekNo = null) {
    const candidates = rows.filter((row) => String(row.employee_id) === String(employeeId));
    if (weekNo != null) {
      const weekly = candidates.find((row) => Number(row.week_no || 0) === Number(weekNo || 0));
      if (weekly) return weekly;
    }
    return candidates.find((row) => row.week_no == null) || candidates[0] || null;
  }

  function selectEmployee(employeeId, preferredRun = null) {
    const employee = employees.find((item) => String(item.employee_id) === String(employeeId));
    const existing = preferredRun || matchingRun(employeeId);
    const input = existing?.input_snapshot || {};
    setForm({
      ...emptyForm,
      employee_id: employeeId,
      payroll_run_id: existing?.payroll_run_id || "",
      bonus_amount: String(input.bonus_amount ?? existing?.bonus_amount ?? 0),
      overtime_amount: input.overtime_amount ?? existing?.overtime_amount ?? "",
      absence_days: input.absence_days ?? existing?.absence_days ?? "",
      loan_deduction: input.loan_deduction ?? existing?.loan_deduction ?? "",
      extra_deduction: String(input.extra_deduction ?? existing?.extra_deduction ?? 0),
      work_days: input.work_days ?? existing?.work_days ?? employee?.default_work_days ?? "",
      week_no: String(input.week_no ?? existing?.week_no ?? 1),
      week_start: input.week_start ?? existing?.week_start ?? "",
      week_end: input.week_end ?? existing?.week_end ?? "",
      final_week: input.final_week ?? true,
      notes: input.notes ?? existing?.notes ?? "",
      absence_notice_enabled: Boolean(existing?.absence_notice?.enabled ?? input.absence_notice_enabled),
      absence_notice_type: existing?.absence_notice?.type || input.absence_notice_type || "PEMBERITAHUAN",
      absence_notice_date: existing?.absence_notice?.date || input.absence_notice_date || today(),
      absence_notice_no: existing?.absence_notice?.number || input.absence_notice_no || "",
      absence_basis: existing?.absence_notice?.basis || input.absence_basis || "TANPA_KETERANGAN",
      absence_dates: existing?.absence_notice?.dates || input.absence_dates || "",
      absence_detail: existing?.absence_notice?.detail || input.absence_detail || "",
      absence_employee_note: existing?.absence_notice?.employee_note || input.absence_employee_note || "",
      absence_print_with_slip: existing?.absence_notice?.print_with_slip ?? input.absence_print_with_slip ?? true,
    });
    setPreview(existing || null);
    setReopenReason("");
  }

  function openRun(row) {
    selectEmployee(row.employee_id, row);
    setDetailOpen(true);
  }

  function updateWeek(weekNo) {
    const existing = matchingRun(form.employee_id, weekNo);
    if (existing) selectEmployee(form.employee_id, existing);
    else setForm((old) => ({ ...old, payroll_run_id: "", week_no: String(weekNo) }));
  }

  function payloadFromForm() {
    return {
      ...form,
      period,
      bonus_amount: num(form.bonus_amount),
      overtime_amount: form.overtime_amount === "" ? "" : num(form.overtime_amount),
      absence_days: form.absence_days === "" ? "" : num(form.absence_days),
      loan_deduction: form.loan_deduction === "" ? "" : num(form.loan_deduction),
      extra_deduction: num(form.extra_deduction),
      work_days: form.work_days === "" ? "" : num(form.work_days),
      week_no: num(form.week_no),
      operation_id: operationId("PAYROLL"),
      request_id: operationId("REQ"),
      idempotency_key: operationId("IDEMP"),
    };
  }

  async function previewServer({ quiet = false } = {}) {
    if (!form.employee_id) { if (!quiet) setError("Pilih karyawan terlebih dahulu."); return false; }
    const seq = ++previewSeq.current;
    if (!quiet) { setPreviewing(true); setError(""); setNotice(""); }
    try {
      const result = await previewHRDPayrollFinal(token, payloadFromForm());
      if (authRequired(result)) { onSessionExpired?.(); return false; }
      if (!result?.success) throw new Error(result?.message || "Preview THP gagal.");
      if (seq === previewSeq.current) setPreview(result.data);
      if (!quiet) setNotice("THP dihitung ulang oleh server. Preview tidak mengubah ledger atau dompet.");
      return true;
    } catch (err) {
      if (!quiet) setError(err?.message || "Preview gagal.");
      return false;
    } finally { if (!quiet) setPreviewing(false); }
  }

  async function saveDraft() {
    if (!form.employee_id) return setError("Pilih karyawan terlebih dahulu.");
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await createHRDPayrollDraft(token, payloadFromForm());
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) throw new Error(result?.message || "Draft gagal disimpan.");
      setNotice(result.message || "Draft payroll tersimpan.");
      if (result.data?.calculation) setPreview(result.data.calculation);
      const runId = result.data?.payroll_run_id;
      if (runId) setForm((old) => ({ ...old, payroll_run_id: runId }));
      await load({ quiet: true });
      await onChanged?.();
    } catch (err) { setError(err?.message || "Draft gagal disimpan."); }
    finally { setSaving(false); }
  }

  async function closePayroll() {
    let runId = form.payroll_run_id;
    if (!runId) {
      await saveDraft();
      // React state belum tentu sudah commit pada tick yang sama; pengguna tinggal klik closing lagi.
      setNotice("Draft sudah dibuat. Cek angka lalu klik Closing sekali lagi untuk mengunci payroll.");
      return;
    }
    if (!window.confirm("Closing gajian ini? Kasbon/cicilan akan dikunci dan dibukukan satu kali. Dompet gaji belum berkurang sampai pembayaran dilakukan.")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await createHRDPayrollClosing(token, {
        payroll_run_id: runId,
        closed_date: today(),
        notes: form.notes,
        operation_id: operationId("PAYCLOSE"),
        idempotency_key: operationId("IDEMP"),
      });
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) throw new Error(result?.message || "Closing gagal.");
      setNotice(result.message || "Payroll berhasil closing.");
      await load({ quiet: true });
      await onChanged?.();
    } catch (err) { setError(err?.message || "Closing gagal."); }
    finally { setSaving(false); }
  }

  async function reopenPayrollRun() {
    if (!form.payroll_run_id) return;
    if (!reopenReason.trim()) return setError("Alasan revisi wajib diisi.");
    if (!window.confirm("Buka kembali closing? Efek kasbon, cicilan, dan jurnal closing akan dibalik.")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await reopenHRDPayroll(token, {
        payroll_run_id: form.payroll_run_id,
        reason: reopenReason,
        operation_id: operationId("PAYREOPEN"),
        idempotency_key: operationId("IDEMP"),
      });
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) throw new Error(result?.message || "Reopen gagal.");
      setNotice(result.message || "Closing dibuka kembali.");
      setReopenReason("");
      await load({ quiet: true });
      await onChanged?.();
    } catch (err) { setError(err?.message || "Reopen gagal."); }
    finally { setSaving(false); }
  }

  async function recordPrint(row, type, snapshot) {
    try {
      await recordHRDPayrollPrint(token, {
        payroll_run_id: row?.payroll_run_id || "",
        period,
        print_type: type,
        snapshot,
        operation_id: operationId("PAYPRINT"),
        idempotency_key: operationId("IDEMP"),
      });
    } catch { /* Print tetap berjalan walau audit print terputus. */ }
  }

  function printSlip(row = selectedRun || preview) {
    if (!row) return setError("Preview atau pilih payroll terlebih dahulu.");
    const printable = {
      ...row,
      employee_name_snapshot: row.employee_name_snapshot || selectedEmployee?.employee_name,
      location_name_snapshot: row.location_name_snapshot || selectedEmployee?.location_name_snapshot || selectedEmployee?.location_name,
      payroll_day: row.payroll_day || selectedEmployee?.payroll_day,
      salary_mode: row.salary_mode || selectedEmployee?.salary_mode,
      pay_cycle: row.pay_cycle || selectedEmployee?.pay_cycle,
    };
    try {
      printPayrollSlipV32(printable);
      void recordPrint(row, printable?.absence_notice?.enabled ? "SLIP_AND_NOTICE_A5" : "SLIP_A5", printable);
    } catch (err) { setError(err?.message || "Jendela cetak gagal dibuka. Izinkan popup ERP Dimsum Aditya."); }
  }

  function printRecap(custom = {}) {
    try {
      const options = { area: printArea, schedule: printSchedule, mode: printMode, advances: baseAdvances, ...custom };
      printPayrollRecapA4V32(rows, period, options);
      void recordPrint(null, "RECAP_A4", { row_count: rows.length, period, ...options, advances: undefined });
    } catch (err) { setError(err?.message || "Jendela cetak gagal dibuka. Izinkan popup ERP Dimsum Aditya."); }
  }

  function printBatch(customRows = null) {
    const candidates = arr(customRows || filteredPrintRows).filter((row) => String(row.status || "").toUpperCase() !== "VOID");
    if (!candidates.length) return setError("Belum ada slip yang bisa dicetak pada filter ini.");
    try {
      printPayrollBatchV32(candidates, `Slip Payroll ${formatPeriod(period)}`);
      void recordPrint(null, "BATCH_SLIP_A4", { period, row_count: candidates.length, area: printArea, schedule: printSchedule });
    } catch (err) { setError(err?.message || "Cetak massal gagal dibuka."); }
  }

  async function payPayroll() {
    if (!paymentForm.payroll_run_id || !paymentForm.wallet_id) { setError("Pilih payroll dan dompet pembayaran."); return false; }
    if (!window.confirm(`Bayar gaji ${selectedPaymentRun?.employee_name_snapshot || "karyawan"} sebesar ${formatRupiah(num(selectedPaymentRun?.net_pay))}?`)) return false;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await createHRDPayrollPayment(token, {
        ...paymentForm,
        operation_id: operationId("PAYPAY"),
        idempotency_key: operationId("IDEMP"),
      });
      if (authRequired(result)) { onSessionExpired?.(); return false; }
      if (!result?.success) throw new Error(result?.message || "Pembayaran gagal.");
      setNotice(result.message || "Gaji berhasil dibayar.");
      setPaymentForm((old) => ({ ...old, payroll_run_id: "", reference_no: "" }));
      await load({ quiet: true });
      await onChanged?.();
      return true;
    } catch (err) { setError(err?.message || "Pembayaran gagal."); return false; }
    finally { setSaving(false); }
  }

  async function deleteDraft(row) {
    if (String(row?.status || "").toUpperCase() !== "DRAFT") return setError("Hanya draft payroll yang dapat dihapus.");
    if (!window.confirm(`Hapus draft payroll ${row?.employee_name_snapshot || "karyawan"}? Ledger dan dompet tidak akan berubah.`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await voidHRDPayrollDraft(token, {
        payroll_run_id: row.payroll_run_id,
        reason: "Hapus draft dari workspace HRD",
        operation_id: operationId("PAYVOID"),
        idempotency_key: operationId("IDEMP"),
      });
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) throw new Error(result?.message || "Draft gagal dihapus.");
      setNotice(result.message || "Draft payroll dihapus.");
      if (String(form.payroll_run_id) === String(row.payroll_run_id)) resetForm();
      await load({ quiet: true });
      await onChanged?.();
    } catch (err) { setError(err?.message || "Draft gagal dihapus."); }
    finally { setSaving(false); }
  }

  const readyRows = rows.filter((row) => String(row.payment_status || "").toUpperCase() !== "PAID");
  const paidRows = rows.filter((row) => String(row.payment_status || "").toUpperCase() === "PAID");
  const closedRows = rows.filter((row) => String(row.status || "").toUpperCase() === "CLOSED");
  const draftRows = rows.filter((row) => String(row.status || "").toUpperCase() === "DRAFT");
  const employeeWithRun = new Set(rows.map((row) => String(row.employee_id)));
  const projectionRows = employees.filter((employee) => !employeeWithRun.has(String(employee.employee_id)));
  const projectionPay = projectionRows.reduce((total, employee) => {
    const daily = String(employee.salary_mode || "").toUpperCase() === "HARIAN";
    return total + (daily ? round5000(num(employee.daily_salary) * num(employee.default_work_days)) : num(employee.base_salary));
  }, 0);
  const readyPay = sum(readyRows, "net_pay");
  const closedUnpaid = closedRows.filter((row) => String(row.payment_status || "").toUpperCase() !== "PAID");
  const allProjected = readyPay + sum(paidRows, "net_pay") + projectionPay;
  const scheduleGroups = groupRows(rows, scheduleLabel).sort((a,b) => a.key.localeCompare(b.key, "id", { numeric: true }));
  const areaGroups = groupRows(rows, (row) => row.location_name_snapshot || row.location_name || row.location_code || "Tanpa Cabang").sort((a,b) => a.key.localeCompare(b.key));
  const areaOptions = Array.from(new Set(rows.map((row) => row.location_name_snapshot || row.location_name || row.location_code).filter(Boolean))).sort();
  const scheduleOptions = Array.from(new Set(rows.map(scheduleLabel))).sort((a,b) => a.localeCompare(b, "id", { numeric: true }));
  const filteredPrintRows = rows.filter((row) => {
    if (printArea !== "ALL" && String(row.location_name_snapshot || row.location_name || row.location_code) !== String(printArea)) return false;
    if (printSchedule !== "ALL" && scheduleLabel(row) !== printSchedule) return false;
    if (printMode === "CLOSED" && String(row.status || "").toUpperCase() !== "CLOSED") return false;
    return true;
  });
  const dailyLedgerRows = rows.filter((row) => String(row.salary_mode || "").toUpperCase() === "HARIAN" || String(row.pay_cycle || "").toUpperCase() === "MINGGUAN");

  useEffect(() => {
    if (printArea !== "ALL" && !areaOptions.includes(printArea)) setPrintArea("ALL");
    if (printSchedule !== "ALL" && !scheduleOptions.includes(printSchedule)) setPrintSchedule("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, rows.length]);

  if (loading) return <div className="da-payroll-v32-loading">Memuat Sistem Penggajian Dimsum Aditya…</div>;

  const locationValue = locationId || "ALL";
  const processSnapshot = preview || selectedRun || {};
  const employeeDaily = String(selectedEmployee?.salary_mode || "").toUpperCase() === "HARIAN";
  const employeeWeekly = String(selectedEmployee?.pay_cycle || "").toUpperCase() === "MINGGUAN";
  const baseSalaryShown = employeeDaily ? num(processSnapshot.base_salary || (num(selectedEmployee?.daily_salary) * num(form.work_days || selectedEmployee?.default_work_days))) : num(processSnapshot.base_salary || selectedEmployee?.base_salary);

  function processWorkspace({ compact = false } = {}) {
    return (
      <div className={`da-payroll-v32-process${compact ? " is-compact" : ""}`}>
        {!compact ? <div className="da-payroll-v32-page-title"><div><h1>Buat Slip Gaji Karyawan</h1><p>Perhitungan live dari PHP/MySQL. Bentuk kerja mengikuti Payroll V32 lokal, tetapi semua transaksi tetap memakai ledger ERP.</p></div><div className="da-payroll-v32-top-actions"><LocalAction variant="soft" onClick={() => load()}><RefreshCw size={15}/> Refresh</LocalAction><LocalAction variant="soft" onClick={() => setPaymentOpen(true)}><Wallet size={15}/> Pembayaran Gaji</LocalAction></div></div> : null}

        {!compact ? <div className="da-payroll-v32-flow"><div className="da-payroll-v32-flow-title"><Banknote size={17}/> Alur Payroll Bulanan</div><div className="da-payroll-v32-flow-grid">{[
          ["1","Pilih periode & karyawan","Gaji pokok, cabang, kasbon dan pinjaman otomatis ikut terbaca."],
          ["2","Input komponen variabel","Masukkan absen, bonus, lembur, cicilan, dan koreksi bulan ini."],
          ["3","Cek THP & rekap area","Server menghitung ulang THP, pembulatan, serta saldo pinjaman."],
          ["4","Cetak dulu, closing belakangan","Print tidak memotong ledger. Closing mengunci kasbon/cicilan satu kali."],
        ].map(([n,t,d]) => <div key={n}><span>{n}</span><strong>{t}</strong><small>{d}</small></div>)}</div></div> : null}

        <section className="da-payroll-v32-card">
          <h3><FileText size={17}/> 1. Periode & Identitas Karyawan</h3>
          <div className="da-payroll-v32-form-grid identity">
            <label><span>Periode Gaji (Bulan/Tahun)</span><input type="month" value={period} onChange={(e) => onPeriodChange?.(e.target.value)} /></label>
            <label><span>Filter Cabang</span><select value={locationValue} onChange={(e) => onLocationChange?.(e.target.value)}><option value="ALL">Semua Cabang ({employees.length})</option>{locations.map((loc) => <option key={loc.location_id} value={loc.location_id}>{loc.location_name} · {loc.location_code}</option>)}</select><small>Data karyawan dikelompokkan sesuai cabang.</small></label>
            <label><span>Cari Nama Karyawan</span><input value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder="Ketik nama…" /><small>{filteredEmployees.length} karyawan sesuai filter.</small></label>
            <label><span>Pilih Karyawan</span><select value={form.employee_id} onChange={(e) => selectEmployee(e.target.value)}><option value="">-- Pilih Karyawan --</option>{filteredEmployees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employeeName(employee)} · {String(employee.salary_mode || "BULANAN").toLowerCase()} · {employee.employment_status || "ACTIVE"}</option>)}</select></label>
            <label><span>Lokasi Operasional</span><input readOnly value={selectedEmployee ? employeeLocationName(selectedEmployee) : ""} /></label>
            <label><span>Tanggal Gajian</span><input readOnly value={selectedEmployee ? (employeeWeekly ? `Minggu ${form.week_no}` : `Tanggal ${selectedEmployee.payroll_day || "-"}`) : ""} /></label>
          </div>
          {employeeWeekly && selectedEmployee ? <div className="da-payroll-v32-week-control"><label><span>Minggu Ke</span><select value={form.week_no} disabled={isRunLocked} onChange={(e) => updateWeek(e.target.value)}>{[1,2,3,4,5].map((week) => <option key={week} value={week}>Minggu {week}</option>)}</select></label><label><span>Tanggal Awal</span><input type="date" disabled={isRunLocked} value={form.week_start} onChange={(e)=>setForm({...form,week_start:e.target.value})}/></label><label><span>Tanggal Akhir</span><input type="date" disabled={isRunLocked} value={form.week_end} onChange={(e)=>setForm({...form,week_end:e.target.value})}/></label><label className="check"><input type="checkbox" disabled={isRunLocked} checked={Boolean(form.final_week)} onChange={(e)=>setForm({...form,final_week:e.target.checked})}/><span>Minggu final — potong kasbon/cicilan</span></label></div> : null}
        </section>

        <section className="da-payroll-v32-card salary-card">
          <h3><Banknote size={17}/> 2. Rincian Gaji Bulan Ini</h3>
          <div className="da-payroll-v32-form-grid salary">
            <label><span>{employeeDaily ? "Gaji Dasar Periode" : "Gaji Pokok"}</span><div className="money-input"><b>Rp</b><input readOnly value={baseSalaryShown ? new Intl.NumberFormat("id-ID").format(baseSalaryShown) : ""}/></div>{employeeDaily ? <small>{formatRupiah(num(selectedEmployee?.daily_salary))} × {num(form.work_days || selectedEmployee?.default_work_days)} hari</small> : null}</label>
            <label><span>Bonus / Insentif Tambahan</span><div className="money-input"><b>Rp</b><input disabled={isRunLocked} inputMode="numeric" value={form.bonus_amount} onChange={(e)=>setForm({...form,bonus_amount:e.target.value})}/></div></label>
            <label><span>Uang Lembur</span><div className="money-input"><b>Rp</b><input disabled={isRunLocked} inputMode="numeric" value={form.overtime_amount} onChange={(e)=>setForm({...form,overtime_amount:e.target.value})} placeholder="auto dari absensi"/></div></label>
            {employeeDaily ? <label><span>Hari Dibayar</span><input disabled={isRunLocked} type="number" min="0" step="0.5" value={form.work_days} onChange={(e)=>setForm({...form,work_days:e.target.value})}/></label> : null}
            <label className="deduction"><span>Jumlah Hari Absen</span><input disabled={isRunLocked} type="number" min="0" step="0.5" value={form.absence_days} onChange={(e)=>setForm({...form,absence_days:e.target.value})} placeholder="auto dari absensi"/><small>{employeeDaily ? "Untuk gaji harian, ketidakhadiran memengaruhi hari dibayar." : "Memotong (Gaji / 26) × Hari dan dibulatkan Rp5.000."}</small></label>
            <label className="deduction"><span>Potongan Kasbon (Otomatis dari Ledger)</span><div className="money-input danger"><b>Rp</b><input readOnly value={new Intl.NumberFormat("id-ID").format(num(processSnapshot.advance_deduction))}/></div><small>Total kasbon periode yang akan dilunasi dari gaji.</small></label>
            <label className="deduction"><span>Potongan Cicilan Pinjaman</span><div className="money-input"><b>Rp</b><input disabled={isRunLocked} inputMode="numeric" value={form.loan_deduction} onChange={(e)=>setForm({...form,loan_deduction:e.target.value})} placeholder="auto cicilan wajib"/></div><small>Sisa utang sebelum potong: <strong className="red">{formatRupiah(num(processSnapshot.loan_balance_before))}</strong></small></label>
            <label className="deduction"><span>Potongan Lain / Koreksi</span><div className="money-input"><b>Rp</b><input disabled={isRunLocked} inputMode="numeric" value={form.extra_deduction} onChange={(e)=>setForm({...form,extra_deduction:e.target.value})}/></div><small>Contoh: telat, koreksi, ganti rugi, potongan manual.</small></label>
            <label><span>Catatan Potongan Lain / Slip</span><input disabled={isRunLocked} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="Catatan jika diperlukan…" /></label>
          </div>

          <div className="da-payroll-v32-absence-notice"><div><FileText size={17}/><div><strong>Pemberitahuan Potongan Ketidakhadiran</strong><span>{form.absence_notice_enabled ? "Aktif — dapat ikut tercetak bersama slip." : "Tidak Aktif"}</span></div></div><label><span>Buat Surat</span><input type="checkbox" disabled={isRunLocked} checked={form.absence_notice_enabled} onChange={(e)=>setForm({...form,absence_notice_enabled:e.target.checked})}/></label></div>
          {form.absence_notice_enabled ? <div className="da-payroll-v32-notice-fields"><label><span>Jenis Surat</span><select disabled={isRunLocked} value={form.absence_notice_type} onChange={(e)=>setForm({...form,absence_notice_type:e.target.value})}><option>PEMBERITAHUAN</option><option>TEGURAN TERTULIS / SP-1</option></select></label><label><span>Tanggal Surat</span><input disabled={isRunLocked} type="date" value={form.absence_notice_date} onChange={(e)=>setForm({...form,absence_notice_date:e.target.value})}/></label><label><span>Nomor Surat</span><input disabled={isRunLocked} value={form.absence_notice_no} onChange={(e)=>setForm({...form,absence_notice_no:e.target.value})}/></label><label><span>Tanggal Tidak Masuk</span><input disabled={isRunLocked} value={form.absence_dates} onChange={(e)=>setForm({...form,absence_dates:e.target.value})}/></label><label><span>Rincian</span><input disabled={isRunLocked} value={form.absence_detail} onChange={(e)=>setForm({...form,absence_detail:e.target.value})}/></label><label><span>Catatan Karyawan</span><input disabled={isRunLocked} value={form.absence_employee_note} onChange={(e)=>setForm({...form,absence_employee_note:e.target.value})}/></label></div> : null}

          <div className="da-payroll-v32-thp-summary"><div><span>Total Pendapatan (A)</span><strong>{formatRupiah(num(processSnapshot.total_income))}</strong></div><div><span>Total Potongan (B)</span><strong>{formatRupiah(num(processSnapshot.total_deduction))}</strong></div><div className="green"><span>Take Home Pay (A - B)</span><strong>{formatRupiah(num(processSnapshot.net_pay))}</strong></div></div>

          <div className={`da-payroll-v32-status is-${statusText(selectedRun || preview).toLowerCase()}`}><CheckCircle2 size={16}/><span>{selectedRun ? `Status: ${statusText(selectedRun)}. ${statusText(selectedRun) === "DRAFT" ? "Data masih bisa dikoreksi sebelum closing." : statusText(selectedRun) === "PAID" ? "Gaji sudah dibayar dan Wallet OUT sudah tercatat." : "Angka sudah terkunci; buka revisi bila benar-benar perlu koreksi."}` : "Status: draft baru. Pilih karyawan lalu cek THP; belum ada ledger payroll yang berubah."}</span>{previewing ? <small>Menghitung…</small> : null}</div>

          {error ? <div className="da-payroll-v32-alert danger">{error}</div> : null}
          {notice ? <div className="da-payroll-v32-alert success">{notice}</div> : null}

          <div className="da-payroll-v32-inline-tools"><LocalAction variant="soft" disabled={saving || previewing || !form.employee_id || isRunLocked} onClick={() => previewServer()}><RefreshCw size={15}/> Cek THP</LocalAction><LocalAction variant="soft" disabled={saving || !form.employee_id || isRunLocked} onClick={saveDraft}><FileText size={15}/> Simpan Draft</LocalAction>{selectedEmployee ? <LocalAction variant="soft" onClick={() => onOpenEmployee?.(selectedEmployee.employee_id)}><User size={15}/> Profil</LocalAction> : null}</div>
          <div className="da-payroll-v32-main-actions"><button type="button" className="print" disabled={!processSnapshot?.employee_id && !selectedEmployee} onClick={() => printSlip()}><Printer size={18}/> Cetak Slip Gaji (A5)</button><button type="button" className="close" disabled={saving || !form.employee_id || statusText(selectedRun) === "CLOSED" || statusText(selectedRun) === "PAID"} onClick={closePayroll}><CheckCircle2 size={18}/> Closing Gajian Bulan Ini</button></div>
          <div className="da-payroll-v32-print-helper"><Printer size={15}/><span><strong>Mode print Epson L120:</strong> kertas A4 biasa, Portrait. Template slip dibuat kompak di bagian atas seperti Payroll V32 lokal; tombol print hanya mencetak dan tidak mengurangi ledger.</span></div>

          {String(selectedRun?.status || "").toUpperCase() === "CLOSED" && String(selectedRun?.payment_status || "").toUpperCase() !== "PAID" && !selectedRun?.legacy_payment_locked ? <div className="da-payroll-v32-reopen"><input value={reopenReason} onChange={(e)=>setReopenReason(e.target.value)} placeholder="Alasan buka revisi closing…"/><button type="button" onClick={reopenPayrollRun} disabled={saving}>Buka Revisi Closing</button></div> : null}
        </section>
      </div>
    );
  }

  function dashboardWorkspace() {
    return (
      <div className="da-payroll-v32-dashboard">
        <div className="da-payroll-v32-page-title"><div><h1>Dashboard Payroll</h1><p>Pusat kontrol rekap, status closing, buku besar harian, pencetakan slip dan pembayaran seluruh cabang.</p></div><div className="da-payroll-v32-top-actions"><LocalAction variant="soft" onClick={() => downloadJson(`Dimsum_Aditya_Payroll_${period}.json`, { exported_at: new Date().toISOString(), period, data })}><FileText size={15}/> Backup Rekap</LocalAction><LocalAction variant="dark" onClick={() => printRecap({area:"ALL",schedule:"ALL"})}><Printer size={15}/> Cetak Rekap A4</LocalAction></div></div>
        <div className="da-payroll-v32-command"><div className="main"><span><Banknote size={15}/> PUSAT KENDALI PAYROLL</span><h2>Rekap dan cetak tanpa bolak-balik halaman</h2><p>Semua angka berasal dari karyawan, kasbon, pinjaman, draft, closing dan pembayaran yang sama di PHP/MySQL.</p></div><label><span>Periode Dashboard</span><input type="month" value={period} onChange={(e)=>onPeriodChange?.(e.target.value)}/></label><div><span>Cabang Aktif</span><strong>{locations.length || new Set(employees.map(employeeLocationName)).size} cabang</strong><small>{employees.length} karyawan aktif</small></div><div><span>Status Periode</span><strong>{closedRows.length} closing • {draftRows.length} slip dicek</strong><small>Dana belum dibayar {formatRupiah(readyPay)}</small></div></div>

        {error ? <div className="da-payroll-v32-alert danger">{error}</div> : null}
        {notice ? <div className="da-payroll-v32-alert success">{notice}</div> : null}

        <section className="da-payroll-v32-card dashboard-card"><h3><Banknote size={17}/> Ringkasan Payroll Bulan Ini</h3><div className="da-payroll-v32-kpi-grid">
          <LocalKpi label="Dana Siap Dibayar (THP)" value={formatRupiah(readyPay)} helper="Belum PAID; sudah dikurangi absen, kasbon, cicilan, potongan lain." toneName="success" />
          <LocalKpi label="Sudah Closing" value={formatRupiah(sum(closedUnpaid,"net_pay"))} helper={`${closedUnpaid.length} payroll terkunci belum dibayar.`}/>
          <LocalKpi label="Belum Closing" value={formatRupiah(sum(draftRows,"net_pay"))} helper={`${draftRows.length} draft masih bisa dicek.`}/>
          <LocalKpi label="Proyeksi Rencana" value={formatRupiah(projectionPay)} helper={`${projectionRows.length} karyawan belum punya draft.`}/>
          <LocalKpi label="Karyawan Aktif" value={employees.length} helper={`${locations.length || new Set(employees.map(employeeLocationName)).size} cabang.`}/>
          <LocalKpi label="Total Kasbon" value={formatRupiah(sum(readyRows,"advance_deduction"))} helper="Kasbon pada payroll belum PAID."/>
          <LocalKpi label="Total Cicilan" value={formatRupiah(sum(readyRows,"loan_deduction"))} helper="Cicilan pinjaman pada periode aktif."/>
          <LocalKpi label="Proyeksi Total Bulan" value={formatRupiah(allProjected)} helper="Payroll tercatat + rencana dasar; bukan jurnal final."/>
        </div><div className="da-payroll-v32-note orange"><RefreshCw size={15}/> Total aktual memakai data payroll server. Proyeksi hanya estimasi gaji dasar karyawan yang belum mempunyai draft dan tidak dipakai untuk posting akuntansi.</div><div className="da-payroll-v32-note green"><CheckCircle2 size={15}/> Dana Siap Dibayar tidak menghitung payroll yang sudah PAID, supaya kebutuhan uang tidak terhitung dua kali.</div></section>

        <section className="da-payroll-v32-card"><div className="da-payroll-v32-section-head"><div><h3><Printer size={17}/> Print Center Cepat</h3><p>Cetak slip langsung dari dashboard per cabang / jadwal tanpa mengubah closing.</p></div></div><div className="da-payroll-v32-print-center"><label><span>Pilih Cabang / Area</span><select value={printArea} onChange={(e)=>setPrintArea(e.target.value)}><option value="ALL">Semua Cabang</option>{areaOptions.map((area)=><option key={area} value={area}>{area}</option>)}</select></label><label><span>Pilih Jadwal Bayar</span><select value={printSchedule} onChange={(e)=>setPrintSchedule(e.target.value)}><option value="ALL">Semua Jadwal Gajian</option>{scheduleOptions.map((schedule)=><option key={schedule} value={schedule}>{schedule}</option>)}</select></label><LocalAction variant="green" onClick={() => printBatch()}><Printer size={15}/> Cetak Slip</LocalAction><LocalAction variant="dark" onClick={() => printRecap()}><FileText size={15}/> Rekap A4</LocalAction></div></section>

        <section className="da-payroll-v32-card"><div className="da-payroll-v32-section-head"><div><h3><FileText size={17}/> Pusat Cetak Rekap Payroll</h3><p>Final closed atau pemeriksaan draft + closed dengan filter yang sama seperti lokal.</p></div><Badge tone="success">Tidak mengubah data</Badge></div><div className="da-payroll-v32-recap-center"><label><span>Cabang / Area</span><select value={printArea} onChange={(e)=>setPrintArea(e.target.value)}><option value="ALL">Semua Cabang</option>{areaOptions.map((area)=><option key={area} value={area}>{area}</option>)}</select></label><label><span>Jadwal Gajian</span><select value={printSchedule} onChange={(e)=>setPrintSchedule(e.target.value)}><option value="ALL">Semua Jadwal Gajian</option>{scheduleOptions.map((schedule)=><option key={schedule} value={schedule}>{schedule}</option>)}</select></label><label><span>Jenis Rekapan</span><select value={printMode} onChange={(e)=>setPrintMode(e.target.value)}><option value="READY">Pemeriksaan / Draft + Closed</option><option value="CLOSED">Final — hanya Closed</option></select></label><LocalAction variant="green" onClick={() => printRecap()}><Printer size={15}/> Rekap Filter</LocalAction></div></section>

        <div className="da-payroll-v32-board-grid">
          <section className="da-payroll-v32-card"><div className="da-payroll-v32-section-head"><div><h3><Clock size={17}/> Jadwal Bayar Bulanan</h3><p>THP aktual per jadwal gajian.</p></div></div><div className="da-payroll-v32-board-list">{scheduleGroups.length ? scheduleGroups.map((group)=><div className="da-payroll-v32-board-card" key={group.key}><div><strong>{group.key}</strong><small>{group.rows.length} karyawan • {group.rows.filter((r)=>String(r.status).toUpperCase()==="CLOSED").length} closing</small><div className="chips"><span>{formatRupiah(sum(group.rows,"net_pay"))}</span></div></div><div className="actions"><button type="button" onClick={()=>{setPrintSchedule(group.key);setPrintArea("ALL");}}>Rincian</button><button type="button" onClick={()=>printRecap({schedule:group.key,area:"ALL"})}><Printer size={14}/> Cetak Jadwal</button></div></div>) : <div className="da-payroll-v32-empty">Belum ada draft payroll.</div>}{dailyLedgerRows.length ? <button type="button" className="da-payroll-v32-ledger-card" onClick={()=>setLedgerOpen(true)}><span><FileText size={17}/> Buku Besar Gaji Harian / Mingguan</span><strong>{formatRupiah(sum(dailyLedgerRows,"net_pay"))}</strong><small>{dailyLedgerRows.length} payroll tercatat</small></button> : null}</div></section>
          <section className="da-payroll-v32-card"><div className="da-payroll-v32-section-head"><div><h3><Wallet size={17}/> Dana Siap Dibayar per Cabang</h3><p>Cabang, jumlah slip dan kebutuhan uang.</p></div></div><div className="da-payroll-v32-board-list">{areaGroups.length ? areaGroups.map((group)=><div className="da-payroll-v32-board-card" key={group.key}><div><strong>{group.key}</strong><small>{new Set(group.rows.map(scheduleLabel)).size} jadwal • {group.rows.length} slip</small><div className="chips"><span>{formatRupiah(sum(group.rows.filter((r)=>String(r.payment_status).toUpperCase()!=="PAID"),"net_pay"))}</span></div></div><div className="actions"><button type="button" onClick={()=>{setPrintArea(group.key);setPrintSchedule("ALL");}}>Rincian</button><button type="button" onClick={()=>printRecap({area:group.key,schedule:"ALL"})}><Printer size={14}/> Rekap Final</button></div></div>) : <div className="da-payroll-v32-empty">Belum ada payroll pada periode ini.</div>}<button type="button" className="da-payroll-v32-ledger-card neutral" onClick={()=>setPaymentOpen(true)}><span><Wallet size={17}/> Pembayaran Gaji ERP</span><strong>{formatRupiah(sum(closedUnpaid,"net_pay"))}</strong><small>{closedUnpaid.length} payroll closed belum PAID</small></button></div></section>
        </div>

        <section className="da-payroll-v32-card"><div className="da-payroll-v32-section-head"><div><h3>Rincian Payroll Periode {formatPeriod(period)}</h3><p>Maksimal 20 baris per halaman; gunakan Berikutnya untuk data selanjutnya.</p></div><LocalAction variant="soft" onClick={()=>load()}><RefreshCw size={14}/> Refresh</LocalAction></div><PayrollMiniTable rows={rows} onOpen={openRun} onPrint={printSlip} onDelete={deleteDraft}/></section>
      </div>
    );
  }

  function reportWorkspace() {
    return (
      <div className="da-payroll-v32-dashboard">
        <div className="da-payroll-v32-page-title"><div><h1>Rekap Payroll</h1><p>Rekap pemeriksaan / final, kasbon, cicilan, status pembayaran, dan cetak A4 portrait.</p></div><div className="da-payroll-v32-top-actions"><LocalAction variant="dark" onClick={()=>printRecap()}><Printer size={15}/> Cetak Rekap A4</LocalAction></div></div>
        <div className="da-payroll-v32-kpi-grid report"><LocalKpi label="Dana Belum Dibayar" value={formatRupiah(readyPay)} helper={`${readyRows.length} payroll belum PAID`} toneName="success"/><LocalKpi label="Closing" value={closedRows.length} helper={formatRupiah(sum(closedRows,"net_pay"))}/><LocalKpi label="Draft" value={draftRows.length} helper={formatRupiah(sum(draftRows,"net_pay"))}/><LocalKpi label="Sudah Dibayar" value={payments.length} helper={formatRupiah(sum(payments,"amount"))}/></div>
        {error ? <div className="da-payroll-v32-alert danger">{error}</div> : null}{notice ? <div className="da-payroll-v32-alert success">{notice}</div> : null}
        <section className="da-payroll-v32-card"><div className="da-payroll-v32-recap-center"><label><span>Cabang / Area</span><select value={printArea} onChange={(e)=>setPrintArea(e.target.value)}><option value="ALL">Semua Cabang</option>{areaOptions.map((area)=><option key={area} value={area}>{area}</option>)}</select></label><label><span>Jadwal Gajian</span><select value={printSchedule} onChange={(e)=>setPrintSchedule(e.target.value)}><option value="ALL">Semua Jadwal</option>{scheduleOptions.map((schedule)=><option key={schedule} value={schedule}>{schedule}</option>)}</select></label><label><span>Jenis Rekapan</span><select value={printMode} onChange={(e)=>setPrintMode(e.target.value)}><option value="READY">Pemeriksaan / Draft + Closed</option><option value="CLOSED">Final / Closed</option></select></label><LocalAction variant="green" onClick={()=>printRecap()}><Printer size={15}/> Cetak</LocalAction><LocalAction variant="soft" onClick={()=>printBatch()}><Printer size={15}/> Slip Massal</LocalAction></div></section>
        <section className="da-payroll-v32-card"><div className="da-payroll-v32-section-head"><div><h3>Detail Semua Payroll</h3><p>{filteredPrintRows.length} data sesuai filter cetak.</p></div></div><PayrollMiniTable rows={filteredPrintRows} max={200} onOpen={openRun} onPrint={printSlip} onDelete={deleteDraft}/></section>
        <section className="da-payroll-v32-card"><div className="da-payroll-v32-section-head"><div><h3>Riwayat Pembayaran Gaji</h3><p>Setelah PAID, Wallet OUT sudah tercatat dan bukti dapat dicetak ulang.</p></div><LocalAction variant="soft" onClick={()=>setPaymentOpen(true)}><Wallet size={15}/> Bayar Gaji</LocalAction></div><div className="da-payroll-v32-table-scroll"><table className="da-payroll-v32-table payment"><thead><tr><th>Tanggal</th><th>Karyawan</th><th>Dompet</th><th>Metode</th><th>Nominal</th><th>Bukti</th></tr></thead><tbody>{payments.length ? payments.map((payment)=><tr key={payment.payment_id}><td>{payment.payment_date}</td><td><button type="button" className="da-payroll-v32-name" onClick={()=>onOpenEmployee?.(payment.employee_id)}>{payment.employee_name_snapshot}</button></td><td>{payment.wallet_name}</td><td>{payment.payment_method}</td><td className="money green">{formatRupiah(num(payment.amount))}</td><td><button type="button" className="da-payroll-v32-print-icon" onClick={()=>printPayrollPaymentReceiptV32(payment)}><Printer size={16}/></button></td></tr>) : <tr><td colSpan="6" className="empty">Belum ada pembayaran payroll pada periode ini.</td></tr>}</tbody></table></div></section>
      </div>
    );
  }

  return (
    <div className="da-payroll-v32-root">
      {mode === "dashboard" ? dashboardWorkspace() : null}
      {mode === "process" ? processWorkspace() : null}
      {mode === "report" || mode === "history" ? reportWorkspace() : null}
      {mode === "payment" ? <div className="da-payroll-v32-dashboard"><div className="da-payroll-v32-page-title"><div><h1>Pembayaran Gaji</h1><p>ERP extension: setelah payroll CLOSED, pembayaran mencatat Wallet OUT satu kali.</p></div><LocalAction variant="green" onClick={()=>setPaymentOpen(true)}><Plus size={15}/> Bayar Gaji</LocalAction></div><section className="da-payroll-v32-card"><div className="da-payroll-v32-kpi-grid report"><LocalKpi label="Closed Belum Dibayar" value={closedUnpaid.length} helper={formatRupiah(sum(closedUnpaid,"net_pay"))}/><LocalKpi label="Sudah Dibayar" value={payments.length} helper={formatRupiah(sum(payments,"amount"))} toneName="success"/></div></section></div> : null}

      <Modal open={detailOpen} title="Rincian Payroll" subtitle={`${selectedEmployee?.employee_name || "-"} · ${formatPeriod(period)}`} onClose={()=>setDetailOpen(false)} size="xl">{processWorkspace({compact:true})}</Modal>

      <Modal open={paymentOpen} title="Pembayaran Gaji" subtitle="Closing payroll → Wallet OUT Tangerang / HO → PAID" onClose={() => setPaymentOpen(false)} size="xl">
        <div className="da-payroll-v32-payment-modal">
          <div className="da-payroll-v32-note orange"><Wallet size={16}/><span>Berbeda dari file lokal: ERP menyimpan pembayaran aktual ke dompet agar uang gaji tidak hilang dari kontrol kas. Closing hanya mengunci komponen gaji; tombol ini yang membuat Wallet OUT.</span></div>
          <div className="da-payroll-v32-form-grid payment">
            <label><span>Payroll Closed Belum Dibayar</span><select value={paymentForm.payroll_run_id} onChange={(e)=>setPaymentForm({...paymentForm,payroll_run_id:e.target.value})}><option value="">Pilih payroll</option>{closedUnpaid.filter((row)=>!row.legacy_payment_locked).map((row)=><option key={row.payroll_run_id} value={row.payroll_run_id}>{row.employee_name_snapshot} · {formatRupiah(num(row.net_pay))}</option>)}</select></label>
            <label><span>Dompet Tangerang / HO</span><select value={paymentForm.wallet_id} onChange={(e)=>setPaymentForm({...paymentForm,wallet_id:e.target.value})}><option value="">Pilih dompet</option>{wallets.map((wallet)=><option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name} · saldo {formatRupiah(num(wallet.current_balance))}</option>)}</select></label>
            <label><span>Tanggal Bayar</span><input type="date" value={paymentForm.payment_date} onChange={(e)=>setPaymentForm({...paymentForm,payment_date:e.target.value})}/></label>
            <label><span>Metode</span><select value={paymentForm.payment_method} onChange={(e)=>setPaymentForm({...paymentForm,payment_method:e.target.value})}><option>TRANSFER</option><option>CASH</option></select></label>
            <label><span>Referensi</span><input value={paymentForm.reference_no} onChange={(e)=>setPaymentForm({...paymentForm,reference_no:e.target.value})}/></label>
            <label><span>Catatan</span><input value={paymentForm.notes} onChange={(e)=>setPaymentForm({...paymentForm,notes:e.target.value})}/></label>
          </div>
          {selectedPaymentRun ? <div className="da-payroll-v32-payment-summary"><div><span>Karyawan</span><strong>{selectedPaymentRun.employee_name_snapshot}</strong></div><div><span>THP Dibayar</span><strong>{formatRupiah(num(selectedPaymentRun.net_pay))}</strong></div></div> : null}
          <button type="button" className="da-payroll-v32-pay-button" disabled={saving || !paymentForm.payroll_run_id || !paymentForm.wallet_id} onClick={async()=>{if(await payPayroll()) setPaymentOpen(false);}}><Wallet size={17}/> Bayar Gaji & Catat Wallet OUT</button>
        </div>
      </Modal>

      <Modal open={ledgerOpen} title="Buku Besar Gaji Harian / Mingguan" subtitle={`Periode ${formatPeriod(period)} · klik karyawan untuk rincian payroll`} onClose={()=>setLedgerOpen(false)} size="xl">
        <div className="da-payroll-v32-ledger-modal"><div className="da-payroll-v32-kpi-grid ledger"><LocalKpi label="Total Harian / Mingguan" value={formatRupiah(sum(dailyLedgerRows,"net_pay"))} helper="THP data tercatat" toneName="success"/><LocalKpi label="Karyawan" value={new Set(dailyLedgerRows.map((r)=>r.employee_id)).size}/><LocalKpi label="Sudah Closing" value={dailyLedgerRows.filter((r)=>String(r.status).toUpperCase()==="CLOSED").length}/><LocalKpi label="Draft" value={dailyLedgerRows.filter((r)=>String(r.status).toUpperCase()==="DRAFT").length}/></div><PayrollMiniTable rows={dailyLedgerRows} max={100} onOpen={(row)=>{setLedgerOpen(false);openRun(row);}} onPrint={printSlip} onDelete={deleteDraft}/></div>
      </Modal>
    </div>
  );
}
