import { useEffect, useMemo, useState } from "react";
import { createHRDEmployee, createHRDKasbonNote, createHRDLoanNote, getHRDPayrollBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import { formatDate } from "../../lib/format/date";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
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

function textValue(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function makeOperationId(prefix = "HRD") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function monthInput() {
  return new Date().toISOString().slice(0, 7);
}

function badgeTone(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("AKTIF") || text.includes("LUNAS") || text.includes("CLOSED") || text.includes("PAID")) return "success";
  if (text.includes("DRAFT") || text.includes("OPEN") || text.includes("BELUM")) return "warning";
  if (text.includes("NON") || text.includes("VOID") || text.includes("STOP")) return "danger";
  return "default";
}

function normalizeEmployee(row) {
  return {
    employee_id: textValue(row.employee_id || row.karyawan_id || row.id, ""),
    employee_name: textValue(row.employee_name || row.nama_karyawan || row.name || row.nama, "-"),
    location_id: textValue(row.location_id || row.lokasi || row.cabang, "TGR"),
    location_name: textValue(row.location_name || row.lokasi || row.location_id || row.cabang, "-"),
    position: textValue(row.position || row.jabatan || row.role_name || row.role, "-"),
    payroll_day: textValue(row.payroll_day || row.tanggal_gajian || row.pay_day, "-"),
    base_salary: numberValue(row.base_salary || row.gaji_pokok || row.salary),
    meal_allowance: numberValue(row.meal_allowance || row.uang_makan || row.tunjangan_makan),
    job_allowance: numberValue(row.job_allowance || row.uang_jabatan || row.tunjangan_jabatan),
    status: textValue(row.status || row.employee_status, "Aktif"),
    raw: row,
  };
}

function normalizeKasbon(row) {
  return {
    kasbon_id: textValue(row.kasbon_id || row.id, ""),
    employee_id: textValue(row.employee_id || row.karyawan_id, ""),
    employee_name: textValue(row.employee_name || row.nama_karyawan, "-"),
    date: textValue(row.date || row.kasbon_date || row.tanggal, ""),
    amount: numberValue(row.amount || row.nominal || row.kasbon_amount),
    notes: textValue(row.notes || row.catatan, "-"),
    status: textValue(row.status, "Open"),
    source_id: textValue(row.source_id || row.kasbon_id || row.id, ""),
    raw: row,
  };
}

function normalizeLoan(row) {
  return {
    loan_id: textValue(row.loan_id || row.pinjaman_id || row.id, ""),
    employee_id: textValue(row.employee_id || row.karyawan_id, ""),
    employee_name: textValue(row.employee_name || row.nama_karyawan, "-"),
    loan_date: textValue(row.loan_date || row.date || row.tanggal, ""),
    original_amount: numberValue(row.original_amount || row.amount || row.nominal),
    remaining_amount: numberValue(row.remaining_amount || row.sisa || row.amount),
    installment_amount: numberValue(row.installment_amount || row.cicilan),
    tenor_total: numberValue(row.tenor_total || row.tenor || row.total_tenor),
    tenor_paid: numberValue(row.tenor_paid || row.tenor_terbayar || row.paid_tenor),
    notes: textValue(row.notes || row.catatan, "-"),
    status: textValue(row.status, "Open"),
    source_id: textValue(row.source_id || row.loan_id || row.pinjaman_id || row.id, ""),
    raw: row,
  };
}

function employeeColumns(onSelect) {
  return [
    { key: "employee_name", label: "Karyawan", render: (row) => <strong>{row.employee_name}</strong> },
    { key: "location_name", label: "Lokasi" },
    { key: "position", label: "Jabatan" },
    { key: "payroll_day", label: "Tgl Gajian" },
    { key: "base_salary", label: "Gaji Pokok", render: (row) => formatRupiah(row.base_salary || 0) },
    { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status}</Badge> },
    { key: "action", label: "Aksi", render: (row) => <Button variant="secondary" onClick={() => onSelect(row)}>Buku Catatan</Button> },
  ];
}

function NoteBox({ children, tone = "warning" }) {
  const bg = tone === "success" ? "#dcfce7" : tone === "danger" ? "#fee2e2" : "#fff7ed";
  const color = tone === "success" ? "#047857" : tone === "danger" ? "#b91c1c" : "#92400e";
  return (
    <div style={{ background: bg, color, borderRadius: 12, padding: "12px 14px", fontWeight: 850, marginTop: 12 }}>
      {children}
    </div>
  );
}

function MiniMetric({ label, value, tone = "default" }) {
  const bg = tone === "danger" ? "#fef2f2" : tone === "success" ? "#ecfdf5" : tone === "warning" ? "#fffbeb" : "#f8fafc";
  return (
    <div style={{ background: bg, border: "1px solid #e5e7eb", borderRadius: 14, padding: 14 }}>
      <div className="da-eyebrow">{label}</div>
      <strong style={{ fontSize: 18 }}>{value}</strong>
    </div>
  );
}

export default function HRDPayrollPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKasbon, setSavingKasbon] = useState(false);
  const [savingLoan, setSavingLoan] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [period, setPeriod] = useState(monthInput());
  const [kasbonForm, setKasbonForm] = useState({ date: todayInput(), amount: "0", notes: "Kasbon karyawan." });
  const [loanForm, setLoanForm] = useState({ loan_date: todayInput(), amount: "0", installment_amount: "0", tenor_total: "0", notes: "Pinjaman panjang karyawan." });
  const [form, setForm] = useState({
    employee_name: "",
    location_id: "TGR",
    location_name: "Tangerang HO",
    position: "Crew",
    payroll_day: "28",
    base_salary: "0",
    meal_allowance: "0",
    job_allowance: "0",
    notes: "Karyawan aktif.",
  });

  const summary = data?.summary || {};
  const employees = useMemo(() => asArray(data?.employees).map(normalizeEmployee), [data]);
  const payrollRecaps = useMemo(() => asArray(data?.payroll_recaps), [data]);
  const kasbonRows = useMemo(() => asArray(data?.kasbon_rows).map(normalizeKasbon), [data]);
  const loanRows = useMemo(() => asArray(data?.loan_rows).map(normalizeLoan), [data]);

  const selectedKasbonRows = useMemo(() => {
    if (!selectedEmployee?.employee_id) return [];
    return kasbonRows.filter((row) => row.employee_id === selectedEmployee.employee_id || row.employee_name === selectedEmployee.employee_name);
  }, [kasbonRows, selectedEmployee]);

  const selectedLoanRows = useMemo(() => {
    if (!selectedEmployee?.employee_id) return [];
    return loanRows.filter((row) => row.employee_id === selectedEmployee.employee_id || row.employee_name === selectedEmployee.employee_name);
  }, [loanRows, selectedEmployee]);

  const selectedOpenKasbon = useMemo(() => {
    return selectedKasbonRows.reduce((total, row) => {
      const status = String(row.status || "Open").toUpperCase();
      if (["CLOSED", "LUNAS", "VOID"].includes(status)) return total;
      return total + numberValue(row.amount);
    }, 0);
  }, [selectedKasbonRows]);

  const selectedOpenLoan = useMemo(() => {
    return selectedLoanRows.reduce((total, row) => {
      const status = String(row.status || "Open").toUpperCase();
      if (["CLOSED", "LUNAS", "VOID"].includes(status)) return total;
      return total + numberValue(row.remaining_amount || row.original_amount);
    }, 0);
  }, [selectedLoanRows]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getHRDPayrollBootstrap(session?.sessionToken, {
      source: "frontend_part_5b_hrd_buku_catatan_kasbon",
      period,
      location_id: session?.user?.location_id || "TGR",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Data HRD belum bisa dibaca.");
      setData(null);
    } else {
      setData(result.data || {});
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateKasbonForm = (key, value) => {
    setKasbonForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateLoanForm = (key, value) => {
    setLoanForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveEmployee = async () => {
    setError("");
    setNotice("");

    if (!form.employee_name.trim()) {
      setError("Nama karyawan wajib diisi.");
      return;
    }

    setSaving(true);
    const payload = {
      operation_id: makeOperationId("EMP"),
      employee: {
        employee_name: form.employee_name.trim(),
        location_id: form.location_id.trim() || "TGR",
        location_name: form.location_name.trim() || form.location_id.trim() || "Tangerang HO",
        position: form.position.trim() || "Crew",
        payroll_day: form.payroll_day || "28",
        base_salary: numberValue(form.base_salary),
        meal_allowance: numberValue(form.meal_allowance),
        job_allowance: numberValue(form.job_allowance),
        notes: form.notes,
        status: "Aktif",
      },
    };

    const result = await createHRDEmployee(session?.sessionToken, payload);
    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Karyawan belum berhasil disimpan.");
    } else {
      setNotice(result.message || "Karyawan berhasil disimpan.");
      setForm((prev) => ({ ...prev, employee_name: "", base_salary: "0", meal_allowance: "0", job_allowance: "0" }));
      await loadData();
    }
    setSaving(false);
  };

  const handleSaveKasbon = async () => {
    setError("");
    setNotice("");

    if (!selectedEmployee?.employee_id) {
      setError("Pilih karyawan dulu untuk catat kasbon.");
      return;
    }

    const amount = numberValue(kasbonForm.amount);
    if (amount <= 0) {
      setError("Nominal kasbon harus lebih dari 0.");
      return;
    }

    setSavingKasbon(true);
    const payload = {
      operation_id: makeOperationId("KASBON"),
      kasbon: {
        employee_id: selectedEmployee.employee_id,
        employee_name: selectedEmployee.employee_name,
        location_id: selectedEmployee.location_id || "TGR",
        date: kasbonForm.date || todayInput(),
        amount,
        notes: kasbonForm.notes || "Kasbon karyawan.",
        status: "Open",
      },
    };

    const result = await createHRDKasbonNote(session?.sessionToken, payload);
    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Kasbon belum berhasil disimpan.");
    } else {
      setNotice(result.message || "Kasbon karyawan berhasil dicatat.");
      setKasbonForm({ date: todayInput(), amount: "0", notes: "Kasbon karyawan." });
      await loadData();
    }
    setSavingKasbon(false);
  };

  const handleSaveLoan = async () => {
    setError("");
    setNotice("");

    if (!selectedEmployee?.employee_id) {
      setError("Pilih karyawan dulu untuk catat pinjaman panjang.");
      return;
    }

    const amount = numberValue(loanForm.amount);
    const installmentAmount = numberValue(loanForm.installment_amount);
    if (amount <= 0) {
      setError("Nominal pinjaman harus lebih dari 0.");
      return;
    }

    setSavingLoan(true);
    const payload = {
      operation_id: makeOperationId("PINJAMAN"),
      loan: {
        employee_id: selectedEmployee.employee_id,
        employee_name: selectedEmployee.employee_name,
        location_id: selectedEmployee.location_id || "TGR",
        loan_date: loanForm.loan_date || todayInput(),
        original_amount: amount,
        remaining_amount: amount,
        installment_amount: installmentAmount,
        tenor_total: numberValue(loanForm.tenor_total),
        tenor_paid: 0,
        notes: loanForm.notes || "Pinjaman panjang karyawan.",
        status: "Open",
      },
    };

    const result = await createHRDLoanNote(session?.sessionToken, payload);
    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setError(result.message || "Pinjaman panjang belum berhasil disimpan.");
    } else {
      setNotice(result.message || "Pinjaman panjang karyawan berhasil dicatat.");
      setLoanForm({ loan_date: todayInput(), amount: "0", installment_amount: "0", tenor_total: "0", notes: "Pinjaman panjang karyawan." });
      await loadData();
    }
    setSavingLoan(false);
  };

  return (
    <div className="da-page">
      <div className="da-page-header">
        <div>
          <div className="da-eyebrow">DIMSUM ADITYA</div>
          <h1>HRD / Payroll</h1>
          <p>Data karyawan, buku catatan karyawan, kasbon, pinjaman, rekap gaji, dan slip gaji. Payroll tetap owner/Tangerang.</p>
        </div>
        <Badge tone="warning">Buku Catatan</Badge>
      </div>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-eyebrow">HRD & PAYROLL</div>
            <h2>Data Karyawan → Buku Catatan → Kasbon/Pinjaman → Payroll</h2>
            <p className="da-muted">Kasbon dan pinjaman panjang dicatat dari Buku Catatan Karyawan. Print slip tetap belum memotong ledger; closing payroll nanti yang mengunci potongan.</p>
          </div>
          <div className="da-inline-actions">
            <Badge tone={error ? "danger" : "success"}>{error ? "Perlu Dicek" : "Terhubung"}</Badge>
            <Button variant="secondary" onClick={loadData} disabled={loading}>Refresh Data</Button>
          </div>
        </div>
        {error ? <NoteBox tone="danger">{error}</NoteBox> : null}
        {notice ? <NoteBox tone="success">{notice}</NoteBox> : null}
      </Card>

      <div className="da-stat-grid">
        <StatCard label="Karyawan Aktif" value={summary.active_employees || 0} description="Karyawan yang bisa masuk payroll." />
        <StatCard label="Total Gaji Pokok" value={formatRupiah(summary.total_base_salary || 0)} description="Dari data karyawan aktif." />
        <StatCard label="Kasbon Terbuka" value={formatRupiah(summary.open_kasbon || 0)} tone="warning" description="Catatan kasbon yang belum ditutup payroll." />
        <StatCard label="Pinjaman Panjang" value={formatRupiah(summary.open_loans || 0)} description="Sisa pinjaman/cicilan karyawan." />
        <StatCard label="Payroll Draft" value={summary.payroll_draft || 0} description="Payroll yang belum closing." />
        <StatCard label="Sudah Closing" value={summary.payroll_closed || 0} description="Payroll yang sudah dikunci." />
      </div>

      <Card>
        <div className="da-section-title">
          <div>
            <div className="da-eyebrow">ALUR PAYROLL BULANAN</div>
            <h2>Cetak Dulu → Closing Belakangan</h2>
            <p className="da-muted">Kasbon bisa dicatat harian/bulanan. Slip nanti membaca catatan ini, tapi potongan final baru terkunci saat closing payroll.</p>
          </div>
          <Badge tone="warning">Aman Dulu</Badge>
        </div>
        <div className="da-flow-grid">
          {[
            "Data karyawan hidup",
            "Catat kasbon/cicilan",
            "Cek THP dan rekap area",
            "Cetak slip gaji",
            "Closing payroll",
          ].map((title, index) => (
            <div className="da-flow-card" key={title}>
              <div className="da-flow-number">{index + 1}</div>
              <div>
                <div className="da-flow-title">{title}</div>
                <div className="da-flow-desc">Setiap langkah tetap punya ID dan tidak dobel potong.</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="da-section-title">
          <div>
            <div className="da-eyebrow">INPUT LIVE</div>
            <h2>Tambah Karyawan</h2>
            <p className="da-muted">Data ini akan jadi sumber payroll, kasbon, pinjaman, dan slip gaji.</p>
          </div>
          <Badge tone="success">Live Input</Badge>
        </div>

        <div className="da-form-grid">
          <label className="da-field">
            <span>Nama Karyawan</span>
            <input value={form.employee_name} onChange={(e) => updateForm("employee_name", e.target.value)} placeholder="Nama lengkap" />
          </label>
          <label className="da-field">
            <span>Lokasi</span>
            <select value={form.location_id} onChange={(e) => updateForm("location_id", e.target.value)}>
              <option value="TGR">Tangerang HO</option>
              <option value="PML">Produksi Pemalang</option>
              <option value="CBN">Resto Cibinong</option>
            </select>
          </label>
          <label className="da-field">
            <span>Jabatan</span>
            <input value={form.position} onChange={(e) => updateForm("position", e.target.value)} placeholder="Crew / Kasir / Produksi" />
          </label>
          <label className="da-field">
            <span>Tanggal Gajian</span>
            <input type="number" min="1" max="31" value={form.payroll_day} onChange={(e) => updateForm("payroll_day", e.target.value)} />
          </label>
          <label className="da-field">
            <span>Gaji Pokok</span>
            <input value={form.base_salary} onChange={(e) => updateForm("base_salary", e.target.value)} placeholder="0" />
          </label>
          <label className="da-field">
            <span>Uang Makan / Tunjangan</span>
            <input value={form.meal_allowance} onChange={(e) => updateForm("meal_allowance", e.target.value)} placeholder="0" />
          </label>
          <label className="da-field">
            <span>Uang Jabatan</span>
            <input value={form.job_allowance} onChange={(e) => updateForm("job_allowance", e.target.value)} placeholder="0" />
          </label>
          <label className="da-field">
            <span>Catatan</span>
            <input value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Catatan singkat" />
          </label>
        </div>

        <div className="da-form-summary">
          Preview: {form.employee_name || "Karyawan baru"} · {form.location_id} · gaji pokok {formatRupiah(numberValue(form.base_salary))}
        </div>

        <div className="da-form-actions">
          <Button variant="secondary" onClick={() => setForm((prev) => ({ ...prev, employee_name: "", base_salary: "0" }))}>Reset</Button>
          <Button onClick={handleSaveEmployee} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Karyawan"}</Button>
        </div>
      </Card>

      <Card>
        <div className="da-section-title">
          <div>
            <div className="da-eyebrow">DATA KARYAWAN</div>
            <h2>Karyawan Terdaftar</h2>
            <p className="da-muted">Klik Buku Catatan untuk catat kasbon dan lihat riwayat karyawan.</p>
          </div>
          <Badge tone="success">Live Data</Badge>
        </div>
        <DataTable columns={employeeColumns(setSelectedEmployee)} rows={employees} getRowKey={(row, idx) => row.employee_id || idx} />
      </Card>

      <div className="da-grid-2">
        <Card>
          <div className="da-section-title">
            <div>
              <div className="da-eyebrow">KASBON</div>
              <h2>Kasbon Bulanan</h2>
              <p className="da-muted">Kasbon dicatat dari Buku Catatan Karyawan supaya tidak tercampur dengan belanja umum.</p>
            </div>
            <Badge tone="warning">Belum Closing</Badge>
          </div>
          <DataTable
            columns={[
              { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
              { key: "employee_name", label: "Karyawan" },
              { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
              { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status || "Open"}</Badge> },
            ]}
            rows={kasbonRows.slice(0, 8)}
            getRowKey={(row, idx) => row.kasbon_id || idx}
          />
        </Card>
        <Card>
          <div className="da-section-title">
            <div>
              <div className="da-eyebrow">PINJAMAN PANJANG</div>
              <h2>Cicilan Karyawan</h2>
              <p className="da-muted">Dipisah dari kasbon bulanan supaya tenor dan sisa pinjaman lebih jelas.</p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: "employee_name", label: "Karyawan" },
              { key: "original_amount", label: "Awal", render: (row) => formatRupiah(row.original_amount || 0) },
              { key: "remaining_amount", label: "Sisa", render: (row) => formatRupiah(row.remaining_amount || 0) },
              { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status || "Open"}</Badge> },
            ]}
            rows={loanRows.slice(0, 8)}
            getRowKey={(row, idx) => row.loan_id || idx}
          />
        </Card>
      </div>

      <Card>
        <div className="da-section-title">
          <div>
            <div className="da-eyebrow">REKAP PAYROLL</div>
            <h2>Rekap Bulanan</h2>
            <p className="da-muted">Periode payroll disiapkan untuk slip A5/Epson-safe dan rekapan payroll A4.</p>
          </div>
          <div className="da-inline-actions">
            <input value={period} type="month" onChange={(e) => setPeriod(e.target.value)} />
            <Button variant="secondary" onClick={loadData}>Tarik Periode</Button>
          </div>
        </div>
        <DataTable
          columns={[
            { key: "period", label: "Periode" },
            { key: "location_name", label: "Lokasi" },
            { key: "employee_count", label: "Karyawan" },
            { key: "total_payroll", label: "Total Gaji", render: (row) => formatRupiah(row.total_payroll || 0) },
            { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status || "Draft"}</Badge> },
          ]}
          rows={payrollRecaps}
          getRowKey={(row, idx) => row.payroll_run_id || idx}
        />
      </Card>

      <Modal open={Boolean(selectedEmployee)} title="Buku Catatan Karyawan" onClose={() => setSelectedEmployee(null)}>
        {selectedEmployee ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-eyebrow">KARYAWAN</div>
                <h3>{selectedEmployee.employee_name}</h3>
                <p>Lokasi: <strong>{selectedEmployee.location_name}</strong></p>
                <p>Jabatan: <strong>{selectedEmployee.position}</strong></p>
                <p>Tanggal gajian: <strong>{selectedEmployee.payroll_day}</strong></p>
              </div>
              <div className="da-detail-box">
                <div className="da-eyebrow">PAYROLL</div>
                <p>Gaji pokok: <strong>{formatRupiah(selectedEmployee.base_salary)}</strong></p>
                <p>Uang makan/tunjangan: <strong>{formatRupiah(selectedEmployee.meal_allowance)}</strong></p>
                <p>Uang jabatan: <strong>{formatRupiah(selectedEmployee.job_allowance)}</strong></p>
                <p>Status: <Badge tone={badgeTone(selectedEmployee.status)}>{selectedEmployee.status}</Badge></p>
              </div>
            </div>

            <div className="da-grid-2">
              <MiniMetric label="Kasbon Terbuka" value={formatRupiah(selectedOpenKasbon)} tone="warning" />
              <MiniMetric label="Sisa Pinjaman Panjang" value={formatRupiah(selectedOpenLoan)} />
            </div>

            <Card>
              <div className="da-section-title">
                <div>
                  <div className="da-eyebrow">KASBON BULANAN</div>
                  <h2>Catat Pengambilan Kasbon</h2>
                  <p className="da-muted">Catatan ini belum memotong dompet/payroll. Nanti closing payroll yang mengunci potongan supaya tidak dobel.</p>
                </div>
                <Badge tone="success">Live Input</Badge>
              </div>
              <div className="da-form-grid">
                <label className="da-field">
                  <span>Tanggal Ambil</span>
                  <input type="date" value={kasbonForm.date} onChange={(e) => updateKasbonForm("date", e.target.value)} />
                </label>
                <label className="da-field">
                  <span>Nominal Kasbon</span>
                  <input value={kasbonForm.amount} onChange={(e) => updateKasbonForm("amount", e.target.value)} placeholder="0" />
                </label>
                <label className="da-field">
                  <span>Keterangan</span>
                  <input value={kasbonForm.notes} onChange={(e) => updateKasbonForm("notes", e.target.value)} placeholder="Contoh: kasbon bensin / kebutuhan" />
                </label>
              </div>
              <div className="da-form-summary">
                Preview kasbon: {selectedEmployee.employee_name} · {formatRupiah(numberValue(kasbonForm.amount))} · status Open
              </div>
              <div className="da-form-actions">
                <Button variant="secondary" onClick={() => setKasbonForm({ date: todayInput(), amount: "0", notes: "Kasbon karyawan." })}>Reset Kasbon</Button>
                <Button onClick={handleSaveKasbon} disabled={savingKasbon}>{savingKasbon ? "Menyimpan..." : "Simpan Kasbon"}</Button>
              </div>
            </Card>

            <Card>
              <div className="da-section-title">
                <div>
                  <div className="da-eyebrow">RIWAYAT KASBON</div>
                  <h2>Kasbon Karyawan Ini</h2>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "date", label: "Tanggal", render: (row) => formatDate(row.date) },
                  { key: "kasbon_id", label: "Kasbon ID" },
                  { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
                  { key: "notes", label: "Catatan" },
                  { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status || "Open"}</Badge> },
                ]}
                rows={selectedKasbonRows}
                getRowKey={(row, idx) => row.kasbon_id || idx}
              />
            </Card>

            <Card>
              <div className="da-section-title">
                <div>
                  <div className="da-eyebrow">PINJAMAN PANJANG</div>
                  <h2>Cicilan / Pinjaman Karyawan Ini</h2>
                  <p className="da-muted">Pinjaman panjang dicatat terpisah dari kasbon bulanan. Payroll closing nanti yang memotong cicilan supaya tidak dobel.</p>
                </div>
                <Badge tone="success">Live Input</Badge>
              </div>

              <div className="da-form-grid">
                <label className="da-field">
                  <span>Tanggal Pinjam</span>
                  <input type="date" value={loanForm.loan_date} onChange={(e) => updateLoanForm("loan_date", e.target.value)} />
                </label>
                <label className="da-field">
                  <span>Nominal Pinjaman</span>
                  <input value={loanForm.amount} onChange={(e) => updateLoanForm("amount", e.target.value)} placeholder="0" />
                </label>
                <label className="da-field">
                  <span>Cicilan per Bulan</span>
                  <input value={loanForm.installment_amount} onChange={(e) => updateLoanForm("installment_amount", e.target.value)} placeholder="0" />
                </label>
                <label className="da-field">
                  <span>Total Tenor</span>
                  <input value={loanForm.tenor_total} onChange={(e) => updateLoanForm("tenor_total", e.target.value)} placeholder="0" />
                </label>
                <label className="da-field da-span-2">
                  <span>Catatan</span>
                  <input value={loanForm.notes} onChange={(e) => updateLoanForm("notes", e.target.value)} placeholder="Catatan pinjaman panjang" />
                </label>
              </div>
              <div className="da-form-summary">
                Preview pinjaman: {selectedEmployee.employee_name} · awal {formatRupiah(numberValue(loanForm.amount))} · cicilan {formatRupiah(numberValue(loanForm.installment_amount))} · tenor {numberValue(loanForm.tenor_total)}x
              </div>
              <div className="da-form-actions">
                <Button variant="secondary" onClick={() => setLoanForm({ loan_date: todayInput(), amount: "0", installment_amount: "0", tenor_total: "0", notes: "Pinjaman panjang karyawan." })}>Reset Pinjaman</Button>
                <Button onClick={handleSaveLoan} disabled={savingLoan}>{savingLoan ? "Menyimpan..." : "Simpan Pinjaman"}</Button>
              </div>

              <DataTable
                columns={[
                  { key: "loan_date", label: "Tanggal", render: (row) => formatDate(row.loan_date) },
                  { key: "loan_id", label: "Loan ID" },
                  { key: "original_amount", label: "Awal", render: (row) => formatRupiah(row.original_amount || 0) },
                  { key: "remaining_amount", label: "Sisa", render: (row) => formatRupiah(row.remaining_amount || 0) },
                  { key: "installment_amount", label: "Cicilan", render: (row) => formatRupiah(row.installment_amount || 0) },
                  { key: "tenor_total", label: "Tenor", render: (row) => `${row.tenor_paid || 0}/${row.tenor_total || 0}` },
                  { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status || "Open"}</Badge> },
                ]}
                rows={selectedLoanRows}
                getRowKey={(row, idx) => row.loan_id || idx}
              />
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
