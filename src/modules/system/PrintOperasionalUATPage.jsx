import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import { printOperasionalUatPlan } from "../../lib/uat/printOperasionalUatPlan";

export default function PrintOperasionalUATPage() {
  return (
    <div className="da-page da-print-uat-page">
      <PageHeader
        title="Print Operasional Final Check"
        description="Final check dokumen harian: nota customer, SPK/WO, DO, kas masuk/keluar, hutang supplier, rekap harian, dan export."
        badge="Part 7F"
        badgeTone="warning"
      />

      <Card className="da-print-uat-hero">
        <div>
          <div className="da-page-kicker">PRINT SAFETY</div>
          <h2>Dokumen boleh dipakai kerja harian kalau print dari data live dan tidak bocor data sensitif</h2>
          <p>{printOperasionalUatPlan.objective}</p>
        </div>
        <Badge tone="warning">Read-Only Checklist</Badge>
      </Card>

      <div className="da-print-uat-grid">
        {printOperasionalUatPlan.scenarios.map((scenario) => (
          <Card className="da-print-uat-card" key={scenario.id}>
            <div className="da-page-kicker">{scenario.id}</div>
            <h2>{scenario.title}</h2>
            <Badge tone={scenario.risk.includes("Blocker") ? "danger" : "warning"}>{scenario.risk}</Badge>

            <div className="da-print-uat-section">
              <strong>Langkah Test</strong>
              <ol>
                {scenario.steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
            </div>

            <div className="da-print-uat-pass">
              <strong>Expected PASS</strong>
              <ul>
                {scenario.expected.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card className="da-print-uat-blocker">
        <Badge tone="danger">BLOCKER — HOLD PRINT OPERASIONAL</Badge>
        <ul>
          {printOperasionalUatPlan.blockers.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </Card>
    </div>
  );
}
