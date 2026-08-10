import { useEffect, useMemo, useState } from "react";
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
import DataTable from "../../components/ui/DataTable";
import StatCard from "../../components/ui/StatCard";
import Modal from "../../components/ui/Modal";
import {
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
  if (["DRAFT", "UNPAID", "LEGACY"].some((item) => value.includes(item))) return "warning";
  return "default";
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

export default function PayrollFinalPanel({
  session,
  period,
  locationId,
  baseEmployees = [],
  mode = "process",
  onSessionExpired,
  onChanged,
  onOpenEmployee,
}) {
  const token = session?.sessionToken || session?.session_token || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ payroll_run_id: "", wallet_id: "", payment_date: today(), payment_method: "TRANSFER", reference_no: "", notes: "Pembayaran gaji." });
  const [reopenReason, setReopenReason] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const employees = useMemo(() => {
    const source = arr(data?.employees).length ? arr(data?.employees) : baseEmployees;
    return source.filter((employee) => String(employee.employment_status || "ACTIVE").toUpperCase() !== "INACTIVE");
  }, [data, baseEmployees]);
  const rows = useMemo(() => arr(data?.payroll_rows), [data]);
  const payments = useMemo(() => arr(data?.payments), [data]);
  const wallets = useMemo(() => arr(data?.payment_wallets), [data]);
  const summary = data?.summary || {};
  const health = data?.health || {};
  const selectedEmployee = employees.find((employee) => String(employee.employee_id) === String(form.employee_id));
  const selectedRun = rows.find((row) => String(row.payroll_run_id) === String(form.payroll_run_id)) || null;
  const selectedPaymentRun = rows.find((row) => String(row.payroll_run_id) === String(paymentForm.payroll_run_id)) || null;

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

  useEffect(() => { load(); }, [period, locationId]);

  function resetForm() {
    setForm(emptyForm);
    setPreview(null);
    setReopenReason("");
  }

  function selectEmployee(employeeId, preferredRun = null) {
    const employee = employees.find((item) => String(item.employee_id) === String(employeeId));
    const candidates = rows.filter((row) => String(row.employee_id) === String(employeeId));
    const existing = preferredRun || candidates.find((row) => row.week_no == null) || candidates[0] || null;
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

  async function previewServer() {
    if (!form.employee_id) return setError("Pilih karyawan terlebih dahulu.");
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await previewHRDPayrollFinal(token, payloadFromForm());
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) throw new Error(result?.message || "Preview THP gagal.");
      setPreview(result.data);
      setNotice("Preview backend selesai. Ledger dan dompet belum berubah.");
    } catch (err) { setError(err?.message || "Preview gagal."); }
    finally { setSaving(false); }
  }

  async function saveDraft() {
    if (!form.employee_id) return setError("Pilih karyawan terlebih dahulu.");
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await createHRDPayrollDraft(token, payloadFromForm());
      if (authRequired(result)) return onSessionExpired?.();
      if (!result?.success) throw new Error(result?.message || "Draft gagal disimpan.");
      setNotice(result.message || "Draft payroll tersimpan.");
      await load({ quiet: true });
      await onChanged?.();
      const runId = result.data?.payroll_run_id;
      if (runId) setForm((old) => ({ ...old, payroll_run_id: runId }));
    } catch (err) { setError(err?.message || "Draft gagal disimpan."); }
    finally { setSaving(false); }
  }

  async function closePayroll() {
    if (!form.payroll_run_id) return setError("Simpan draft terlebih dahulu.");
    if (!window.confirm("Closing payroll ini? Kasbon dan cicilan akan dikunci satu kali, tetapi dompet belum berkurang.")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await createHRDPayrollClosing(token, {
        payroll_run_id: form.payroll_run_id,
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
    } catch { /* Print should remain available even if logging is interrupted. */ }
  }

  async function printSlip(row = selectedRun || preview) {
    if (!row) return setError("Preview atau pilih payroll terlebih dahulu.");
    const printable = { ...row, employee_name_snapshot: row.employee_name_snapshot || selectedEmployee?.employee_name, location_name_snapshot: row.location_name_snapshot || selectedEmployee?.location_name_snapshot };
    await recordPrint(row, printable?.absence_notice?.enabled ? "SLIP_AND_NOTICE_A5" : "SLIP_A5", printable);
    printPayrollSlipV32(printable);
  }

  async function printRecap() {
    await recordPrint(null, "RECAP_A4", { row_count: rows.length, period });
    printPayrollRecapA4V32(rows, period);
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

  const processColumns = [
    { key: "employee_name_snapshot", label: "Karyawan", render: (row) => <button type="button" className="da-hrd-employee-link-v4" onClick={(event) => { event.stopPropagation(); onOpenEmployee?.(row.employee_id); }}>{row.employee_name_snapshot}</button> },
    { key: "location_name_snapshot", label: "Lokasi" },
    { key: "schedule", label: "Jadwal", render: (row) => row.pay_cycle === "MINGGUAN" ? `Minggu ${row.week_no || "-"}` : `Tgl ${row.payroll_day || "-"}` },
    { key: "total_income", label: "Pendapatan", render: (row) => formatRupiah(num(row.total_income)) },
    { key: "total_deduction", label: "Potongan", render: (row) => formatRupiah(num(row.total_deduction)) },
    { key: "net_pay", label: "THP", render: (row) => <strong>{formatRupiah(num(row.net_pay))}</strong> },
    { key: "status", label: "Status", render: (row) => <Badge tone={tone(row.status)}>{row.status}</Badge> },
    { key: "payment_status", label: "Bayar", render: (row) => <Badge tone={tone(row.payment_status)}>{row.payment_status}</Badge> },
    { key: "actions", label: "Aksi", render: (row) => <div className="da-hrd-row-actions-v4"><button type="button" className="da-hrd-action-btn-v4" onClick={(event) => { event.stopPropagation(); openEditor(row); }}>Edit</button><button type="button" className="da-hrd-action-btn-v4 is-danger" disabled={String(row.status || "").toUpperCase() !== "DRAFT"} title={String(row.status || "").toUpperCase() !== "DRAFT" ? "Hanya draft yang boleh dihapus" : ""} onClick={(event) => { event.stopPropagation(); deleteDraft(row); }}>Hapus</button><button type="button" className="da-hrd-action-btn-v4" onClick={(event) => { event.stopPropagation(); printSlip(row); }}>Print</button></div> },
  ];

  if (loading) return <div className="da-muted">Memuat Payroll Final…</div>;

  const paymentColumns = [
    { key: "payment_date", label: "Tanggal" },
    { key: "payment_id", label: "Payment ID" },
    { key: "employee_name_snapshot", label: "Karyawan", render: (row) => <button type="button" className="da-hrd-employee-link-v4" onClick={(event) => { event.stopPropagation(); onOpenEmployee?.(row.employee_id); }}>{row.employee_name_snapshot}</button> },
    { key: "wallet_name", label: "Dompet" },
    { key: "amount", label: "Nominal", render: (row) => <strong>{formatRupiah(num(row.amount))}</strong> },
    { key: "status", label: "Status", render: (row) => <Badge tone="success">{row.status}</Badge> },
    { key: "print", label: "Cetak", render: (row) => <button type="button" onClick={(event) => { event.stopPropagation(); printPayrollPaymentReceiptV32(row); }}>Bukti</button> },
  ];

  const openEditor = (row = null) => {
    if (row) selectEmployee(row.employee_id, row);
    else resetForm();
    setEditorOpen(true);
  };

  return (
    <div className="da-payroll-final-v3">
      <div className="da-stat-grid">
        <StatCard label="Draft" value={summary.draft_count || 0} helper={formatRupiah(num(summary.draft_net_pay))} />
        <StatCard label="Closed Belum Dibayar" value={summary.closed_unpaid_count || 0} helper={formatRupiah(num(summary.closed_unpaid_amount))} tone="warning" />
        <StatCard label="Sudah Dibayar" value={summary.paid_count || 0} helper={formatRupiah(num(summary.paid_amount))} tone="success" />
        <StatCard label="Histori Bayar Tidak Diketahui" value={summary.legacy_unknown_count || 0} helper="Tidak dibuat Wallet OUT ulang." />
      </div>

      {error ? <div className="da-alert da-alert--danger" style={{marginTop:12}}>{error}</div> : null}
      {notice ? <div className="da-alert da-alert--success" style={{marginTop:12}}>{notice}</div> : null}

      {mode === "process" ? (
        <section className="da-hrd-panel-v3" style={{marginTop:14}}>
          <div className="da-hrd-panel-head-v3">
            <div><h3>Payroll Periode {period}</h3><p>Klik karyawan untuk membuka workspace THP dan slip dalam popup.</p></div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              <Button variant="secondary" onClick={printRecap}>Cetak Rekap A4</Button>
              <Button onClick={() => openEditor()}>+ Proses Payroll</Button>
            </div>
          </div>
          <DataTable columns={processColumns} rows={rows} getRowKey={(row) => row.payroll_run_id} onRowClick={(row) => openEditor(row)} />
        </section>
      ) : null}

      {mode === "payment" ? (
        <section className="da-hrd-panel-v3" style={{marginTop:14}}>
          <div className="da-hrd-panel-head-v3">
            <div><h3>Pembayaran Gaji</h3><p>Closing payroll → Wallet OUT Tangerang → status lunas.</p></div>
            <Button onClick={() => setPaymentOpen(true)}>+ Bayar Gaji</Button>
          </div>
          <DataTable columns={paymentColumns} rows={payments} getRowKey={(row) => row.payment_id} />
        </section>
      ) : null}

      {["report", "history"].includes(mode) ? (
        <div className="da-hrd-split-list-v3" style={{marginTop:14}}>
          <section className="da-hrd-panel-v3">
            <div className="da-hrd-panel-head-v3"><div><h3>Status Payroll</h3><p>Draft, closing dan status pembayaran periode {period}.</p></div><Button variant="secondary" onClick={printRecap}>Cetak A4</Button></div>
            <DataTable columns={processColumns} rows={rows} getRowKey={(row) => row.payroll_run_id} onRowClick={(row) => openEditor(row)} />
          </section>
          <section className="da-hrd-panel-v3">
            <div className="da-hrd-panel-head-v3"><div><h3>Riwayat Pembayaran</h3><p>Bukti pembayaran payroll yang sudah memotong dompet.</p></div></div>
            <DataTable columns={paymentColumns.slice(0, 6)} rows={payments} getRowKey={(row) => row.payment_id} />
          </section>
        </div>
      ) : null}

      <Modal open={editorOpen} title="Proses Payroll & Slip Gaji" subtitle={`Periode ${period} · Server calculation`} onClose={() => setEditorOpen(false)} size="xl">
        <div className="da-hrd-modal-form-v3">
          <div className="da-modal-summary">
            <div><div className="da-eyebrow">Payroll V32 — Backend Resmi</div><strong style={{display:"block",fontSize:18,marginTop:4}}>{selectedEmployee?.employee_name || "Pilih karyawan"}</strong><span className="da-muted">Preview dan print tidak mengubah ledger. Closing yang mengunci kasbon/cicilan.</span></div>
            <Badge tone={health.ready ? "success" : "danger"}>{health.ready ? "Payroll Ready" : "Belum Siap"}</Badge>
          </div>
          <div className="da-form-grid da-form-grid--2">
            <label className="da-field"><span>Karyawan</span><select value={form.employee_id} onChange={(e) => selectEmployee(e.target.value)}><option value="">Pilih karyawan</option>{employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>{employee.employee_name} · {employee.location_code}</option>)}</select></label>
            <label className="da-field"><span>Payroll ID</span><input value={form.payroll_run_id || "Belum disimpan"} readOnly /></label>
            <label className="da-field"><span>Bonus / Insentif</span><input inputMode="numeric" value={form.bonus_amount} onChange={(e) => setForm({ ...form, bonus_amount: e.target.value })} /></label>
            <label className="da-field"><span>Uang Lembur</span><input inputMode="numeric" value={form.overtime_amount} onChange={(e) => setForm({ ...form, overtime_amount: e.target.value })} placeholder="Kosong = tarik absensi" /></label>
            <label className="da-field"><span>Hari Absen</span><input type="number" min="0" step="0.5" value={form.absence_days} onChange={(e) => setForm({ ...form, absence_days: e.target.value })} placeholder="Kosong = tarik absensi" /></label>
            <label className="da-field"><span>Potongan Cicilan</span><input inputMode="numeric" value={form.loan_deduction} onChange={(e) => setForm({ ...form, loan_deduction: e.target.value })} placeholder="Kosong = cicilan wajib otomatis" /></label>
            <label className="da-field"><span>Potongan Lain</span><input inputMode="numeric" value={form.extra_deduction} onChange={(e) => setForm({ ...form, extra_deduction: e.target.value })} /></label>
            {String(selectedEmployee?.salary_mode || "").toUpperCase() === "HARIAN" ? <label className="da-field"><span>Hari Dibayar</span><input type="number" min="0" step="0.5" value={form.work_days} onChange={(e) => setForm({ ...form, work_days: e.target.value })} /></label> : null}
            {String(selectedEmployee?.pay_cycle || "").toUpperCase() === "MINGGUAN" ? <><label className="da-field"><span>Minggu Ke</span><select value={form.week_no} onChange={(e) => setForm({ ...form, week_no: e.target.value })}>{[1,2,3,4,5].map((week) => <option key={week} value={week}>Minggu {week}</option>)}</select></label><label className="da-field"><span>Rentang Minggu</span><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><input type="date" value={form.week_start} onChange={(e) => setForm({ ...form, week_start: e.target.value })} /><input type="date" value={form.week_end} onChange={(e) => setForm({ ...form, week_end: e.target.value })} /></div></label></> : null}
          </div>
          <label className="da-field"><span>Catatan Slip</span><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>

          <div style={{border:"1px solid #fecaca",borderRadius:13,padding:12,background:"#fff7f7"}}>
            <label style={{display:"flex",gap:8,alignItems:"center",fontWeight:850}}><input type="checkbox" checked={form.absence_notice_enabled} onChange={(e) => setForm({ ...form, absence_notice_enabled: e.target.checked })} /> Buat surat pemberitahuan potongan absen</label>
            {form.absence_notice_enabled ? <div className="da-form-grid da-form-grid--2" style={{marginTop:10}}><label className="da-field"><span>Jenis Surat</span><select value={form.absence_notice_type} onChange={(e) => setForm({ ...form, absence_notice_type: e.target.value })}><option>PEMBERITAHUAN</option><option>TEGURAN TERTULIS / SP-1</option></select></label><label className="da-field"><span>Tanggal Surat</span><input type="date" value={form.absence_notice_date} onChange={(e) => setForm({ ...form, absence_notice_date: e.target.value })} /></label><label className="da-field"><span>Nomor Surat</span><input value={form.absence_notice_no} onChange={(e) => setForm({ ...form, absence_notice_no: e.target.value })} /></label><label className="da-field"><span>Tanggal Tidak Masuk</span><input value={form.absence_dates} onChange={(e) => setForm({ ...form, absence_dates: e.target.value })} /></label><label className="da-field"><span>Rincian</span><input value={form.absence_detail} onChange={(e) => setForm({ ...form, absence_detail: e.target.value })} /></label><label className="da-field"><span>Catatan Karyawan</span><input value={form.absence_employee_note} onChange={(e) => setForm({ ...form, absence_employee_note: e.target.value })} /></label></div> : null}
          </div>

          {preview ? <div style={{padding:12,borderRadius:14,background:"#fffaf0",border:"1px solid #fbbf24"}}><div className="da-stat-grid"><StatCard label="Total Penghasilan" value={formatRupiah(num(preview.total_income))} /><StatCard label="Kasbon" value={formatRupiah(num(preview.advance_deduction))} tone="warning" /><StatCard label="Cicilan" value={formatRupiah(num(preview.loan_deduction))} tone="warning" /><StatCard label="Take Home Pay" value={formatRupiah(num(preview.net_pay))} tone={num(preview.net_pay) < 0 ? "danger" : "success"} /></div></div> : null}

          <div className="da-form-actions" style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            <Button variant="secondary" onClick={previewServer} disabled={saving || !form.employee_id}>Cek THP Backend</Button>
            <Button onClick={saveDraft} disabled={saving || !form.employee_id}>Simpan Draft</Button>
            <Button variant="secondary" onClick={() => printSlip()} disabled={!preview}>Cetak Slip Gaji</Button>
            <Button onClick={closePayroll} disabled={saving || !form.payroll_run_id || String(selectedRun?.status).toUpperCase() === "CLOSED"}>Closing Payroll</Button>
            <Button variant="secondary" onClick={resetForm}>Reset</Button>
          </div>
          {String(selectedRun?.status).toUpperCase() === "CLOSED" && String(selectedRun?.payment_status).toUpperCase() !== "PAID" && !selectedRun?.legacy_payment_locked ? <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}><input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Alasan buka revisi closing" /><Button variant="secondary" onClick={reopenPayrollRun} disabled={saving}>Buka Revisi</Button></div> : null}
        </div>
      </Modal>

      <Modal open={paymentOpen} title="Pembayaran Gaji" subtitle="Closing payroll → Wallet OUT → Lunas" onClose={() => setPaymentOpen(false)} size="xl">
        <div className="da-hrd-modal-form-v3">
          <div className="da-form-grid da-form-grid--2">
            <label className="da-field"><span>Payroll Closed Belum Dibayar</span><select value={paymentForm.payroll_run_id} onChange={(e) => setPaymentForm({ ...paymentForm, payroll_run_id: e.target.value })}><option value="">Pilih payroll</option>{rows.filter((row) => String(row.status).toUpperCase() === "CLOSED" && String(row.payment_status).toUpperCase() === "UNPAID" && !row.legacy_payment_locked).map((row) => <option key={row.payroll_run_id} value={row.payroll_run_id}>{row.employee_name_snapshot} · {formatRupiah(num(row.net_pay))}</option>)}</select></label>
            <label className="da-field"><span>Dompet Tangerang</span><select value={paymentForm.wallet_id} onChange={(e) => setPaymentForm({ ...paymentForm, wallet_id: e.target.value })}><option value="">Pilih dompet</option>{wallets.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name} · saldo {formatRupiah(num(wallet.current_balance))}</option>)}</select></label>
            <label className="da-field"><span>Tanggal Bayar</span><input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} /></label>
            <label className="da-field"><span>Metode</span><select value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}><option>TRANSFER</option><option>CASH</option></select></label>
            <label className="da-field"><span>Referensi</span><input value={paymentForm.reference_no} onChange={(e) => setPaymentForm({ ...paymentForm, reference_no: e.target.value })} /></label>
            <label className="da-field"><span>Catatan</span><input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></label>
          </div>
          {selectedPaymentRun ? <div className="da-modal-summary"><div><span className="da-muted">Karyawan</span><strong style={{display:"block",fontSize:17}}>{selectedPaymentRun.employee_name_snapshot}</strong></div><div style={{textAlign:"right"}}><span className="da-muted">THP Dibayar</span><strong style={{display:"block",fontSize:20,color:"#00A86B"}}>{formatRupiah(num(selectedPaymentRun.net_pay))}</strong></div></div> : null}
          <div className="da-form-actions"><Button onClick={async () => { if (await payPayroll()) setPaymentOpen(false); }} disabled={saving || !paymentForm.payroll_run_id || !paymentForm.wallet_id}>Bayar Gaji</Button></div>
        </div>
      </Modal>
    </div>
  );
}
