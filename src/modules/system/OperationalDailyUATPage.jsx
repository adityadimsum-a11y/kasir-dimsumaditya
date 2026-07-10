import { useMemo, useState } from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import { operationalDailyUatPlan } from "../../lib/uat/operationalDailyUatPlan";

const statusTone = {
  PASS: "success",
  CHECK: "warning",
  FAIL: "danger",
  TODO: "warning",
};

function UatPhaseCard({ phase }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="da-uat-phase-card">
      <div className="da-uat-phase-head">
        <div>
          <div className="da-page-kicker">{phase.id}</div>
          <h2>{phase.title}</h2>
          <p>{phase.goal}</p>
        </div>
        <Button variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? "Tutup" : "Buka Checklist"}
        </Button>
      </div>

      {open ? (
        <div className="da-uat-phase-body">
          <div className="da-uat-checklist">
            {phase.steps.map((step, index) => (
              <div className="da-uat-check-item" key={`${phase.id}-step-${index}`}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>

          <div className="da-uat-pass-box">
            <div className="da-page-kicker">KRITERIA PASS</div>
            <ul>
              {phase.passCriteria.map((item, index) => (
                <li key={`${phase.id}-pass-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function ResultTable() {
  const rows = useMemo(
    () =>
      operationalDailyUatPlan.phases.map((phase) => ({
        id: phase.id,
        title: phase.title,
        goal: phase.goal,
        status: "TODO",
      })),
    []
  );

  const columns = [
    { key: "id", label: "Kode" },
    { key: "title", label: "Skenario" },
    { key: "goal", label: "Target" },
    {
      key: "status",
      label: "Status Awal",
      render: (row) => <Badge tone={statusTone[row.status]}>{row.status}</Badge>,
    },
  ];

  return <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />;
}

export default function OperationalDailyUATPage() {
  return (
    <div className="da-page da-uat-page">
      <PageHeader
        title="UAT Operasional Harian"
        description="Checklist end-to-end untuk memastikan ERP siap dipakai kerja harian: DROP Ayam → Produksi → Stok → Order → Uang → Hutang → 4 Amplop → Arsip."
        badge="Part 7A"
        badgeTone="warning"
      />

      <Card className="da-uat-hero">
        <div>
          <div className="da-page-kicker">MODE UAT</div>
          <h2>Test alur harian nyata, bukan sekadar tampilan</h2>
          <p>{operationalDailyUatPlan.warning}</p>
        </div>
        <Badge tone="warning">Read-Only Checklist</Badge>
      </Card>

      <div className="da-grid da-grid-4 da-uat-kpi-grid">
        <Card className="da-uat-kpi-card">
          <div className="da-stat-label">Total Skenario</div>
          <div className="da-stat-value">{operationalDailyUatPlan.phases.length}</div>
          <div className="da-stat-desc">Termasuk persiapan dan final dashboard.</div>
        </Card>
        <Card className="da-uat-kpi-card">
          <div className="da-stat-label">Wajib PASS</div>
          <div className="da-stat-value">10</div>
          <div className="da-stat-desc">Untuk go-live bertahap harian.</div>
        </Card>
        <Card className="da-uat-kpi-card warning">
          <div className="da-stat-label">Mode Aman</div>
          <div className="da-stat-value">Manual</div>
          <div className="da-stat-desc">Checklist ini tidak membuat transaksi.</div>
        </Card>
        <Card className="da-uat-kpi-card">
          <div className="da-stat-label">Fokus</div>
          <div className="da-stat-value">Benang Merah</div>
          <div className="da-stat-desc">Cari ID dan sumber, jangan hanya angka.</div>
        </Card>
      </div>

      <Card>
        <div className="da-section-title">
          <div>
            <div className="da-page-kicker">RINGKASAN SKENARIO</div>
            <h2>Checklist Part 7A</h2>
            <p>Gunakan tabel ini sebagai urutan kerja UAT harian.</p>
          </div>
        </div>
        <ResultTable />
      </Card>

      <div className="da-uat-phase-grid">
        {operationalDailyUatPlan.phases.map((phase) => (
          <UatPhaseCard phase={phase} key={phase.id} />
        ))}
      </div>

      <Card className="da-uat-gonogo">
        <div className="da-grid da-grid-2">
          <div>
            <Badge tone="success">GO Live Bertahap</Badge>
            <ul>
              {operationalDailyUatPlan.goNoGo.goLiveBertahap.map((item, index) => (
                <li key={`go-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <Badge tone="danger">Hold / Jangan Live Dulu</Badge>
            <ul>
              {operationalDailyUatPlan.goNoGo.holdGoLive.map((item, index) => (
                <li key={`hold-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
