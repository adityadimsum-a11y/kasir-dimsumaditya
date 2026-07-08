import { useEffect, useMemo, useState } from "react";
import { createHRDEmployee, getHRDPayrollBootstrap } from "../../lib/api/actions";
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

function badgeTone(status) {
  const text = String(status || "").toUpperCase();
  if (text.includes("AKTIF") || text.includes("LUNAS") || text.includes("CLOSED")) return "success";
  if (text.includes("DRAFT") || text.includes("OPEN") || text.includes("BELUM")) return "warning";
  if (text.includes("NON") || text.includes("VOID") || text.includes("STOP")) return "danger";
  return "default";
}

function normalizeEmployee(row) {
  return {
    employee_id: textValue(row.employee_id || row.karyawan_id || row.id, ""),
    employee_name: textValue(row.employee_name || row.nama_karyawan || row.name || row.nama, "-"),
    location_name: textValue(row.location_name || row.lokasi || row.location_id || row.cabang, "-"),
    position: textValue(row.position || row.jabatan || row.role_name || row.role, "-"),
    payroll_day: textValue(row.payroll_day || row.tanggal_gajian || row.pay_day, "-"),
    base_salary: numberValue(row.base_salary || row.gaji_pokok || row.salary),
    status: textValue(row.status || row.employee_status, "Aktif"),
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
    { key: "action", label: "Aksi", render: (row) => <Button variant="secondary" onClick={() => onSelect(row)}>Detail</Button> },
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

export default function HRDPayrollPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
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
  const kasbonRows = useMemo(() => asArray(data?.kasbon_rows), [data]);
  const loanRows = useMemo(() => asArray(data?.loan_rows), [data]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getHRDPayrollBootstrap(session?.sessionToken, {
      source: "frontend_part_5a_hrd_payroll_foundation",
      period: new Date().toISOString().slice(0, 7),
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

  return (
    <div className="da-page">
      <div className="da-page-header">
        <div>
          <div className="da-eyebrow">DIMSUM ADITYA</div>
          <h1>HRD / Payroll</h1>
          <p>Data karyawan, buku catatan karyawan, kasbon, pinjaman, rekap gaji, dan slip gaji. Payroll tetap owner/Tangerang.</p>
        </div>
        <Badge tone="warning">Foundation</Badge>
      </div>

      <Card>
        <div className="da-card-header-row">
          <div>
            <div className="da-eyebrow">HRD & PAYROLL</div>
            <h2>Data Karyawan → Buku Catatan → Payroll</h2>
            <p className="da-muted">Model tampilan mengikuti patokan payroll yang sudah kamu suka: rekap bulanan, kasbon, pinjaman, closing, dan slip print. Part ini fondasi data dulu.</p>
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
            <p className="da-muted">Print slip tidak memotong ledger. Closing payroll nanti yang mengunci potongan kasbon/cicilan supaya tidak dobel.</p>
          </div>
          <Badge tone="warning">Read First</Badge>
        </div>
        <div className="da-flow-grid">
          {["Pilih periode & karyawan", "Input bonus/lembur/absen", "Cek THP dan rekap area", "Cetak slip", "Closing payroll"].map((title, index) => (
            <div className="da-flow-card" key={title}>
              <div className="da-flow-number">{index + 1}</div>
              <div>
                <div className="da-flow-title">{title}</div>
                <div className="da-flow-desc">Fondasi payroll disiapkan bertahap supaya aman dan tidak dobel potong.</div>
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
            <p className="da-muted">Klik Detail untuk membuka buku catatan karyawan.</p>
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
              <p className="da-muted">Part ini baru baca ringkasan. Input kasbon live kita sambungkan di step berikutnya supaya tidak dobel dengan kas keluar.</p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: "date", label: "Tanggal", render: (row) => formatDate(row.date || row.kasbon_date) },
              { key: "employee_name", label: "Karyawan" },
              { key: "amount", label: "Nominal", render: (row) => formatRupiah(row.amount || 0) },
              { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status || "Open"}</Badge> },
            ]}
            rows={kasbonRows.slice(0, 6)}
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
              { key: "original_amount", label: "Awal", render: (row) => formatRupiah(row.original_amount || row.amount || 0) },
              { key: "remaining_amount", label: "Sisa", render: (row) => formatRupiah(row.remaining_amount || 0) },
              { key: "status", label: "Status", render: (row) => <Badge tone={badgeTone(row.status)}>{row.status || "Open"}</Badge> },
            ]}
            rows={loanRows.slice(0, 6)}
            getRowKey={(row, idx) => row.loan_id || idx}
          />
        </Card>
      </div>

      <Card>
        <div className="da-section-title">
          <div>
            <div className="da-eyebrow">REKAP PAYROLL</div>
            <h2>Rekap Bulanan</h2>
            <p className="da-muted">Nanti lanjut ke slip A5/Epson-safe dan rekapan payroll A4 seperti contoh yang kamu upload.</p>
          </div>
          <Badge tone="warning">Next Payroll</Badge>
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
              <p>Status: <Badge tone={badgeTone(selectedEmployee.status)}>{selectedEmployee.status}</Badge></p>
              <p className="da-muted">Kasbon, pinjaman, dan slip print akan disambungkan di step berikutnya.</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
