import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import { arsipDigitalDrilldownUatPlan } from "../../lib/uat/arsipDigitalDrilldownUatPlan";

export default function ArsipDigitalDrilldownUATPage() {
  return (
    <div className="da-page da-archive-uat-page">
      <PageHeader
        title="Arsip Digital Drilldown Check"
        description="Final check agar semua ID transaksi harian bisa dicari, diklik, dan ditelusuri rantai sumbernya."
        badge="Part 7E"
        badgeTone="warning"
      />

      <Card className="da-archive-uat-hero">
        <div>
          <div className="da-page-kicker">ARSIP SAFETY</div>
          <h2>Operasional boleh jalan kalau semua angka penting punya arsip dan source ID</h2>
          <p>{arsipDigitalDrilldownUatPlan.objective}</p>
        </div>
        <Badge tone="warning">Read-Only Checklist</Badge>
      </Card>

      <div className="da-archive-uat-grid">
        {arsipDigitalDrilldownUatPlan.scenarios.map((scenario) => (
          <Card className="da-archive-uat-card" key={scenario.id}>
            <div className="da-page-kicker">{scenario.id}</div>
            <h2>{scenario.title}</h2>
            <Badge tone={scenario.risk.includes("Blocker") ? "danger" : "warning"}>{scenario.risk}</Badge>

            <div className="da-archive-uat-section">
              <strong>Langkah Test</strong>
              <ol>
                {scenario.steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
            </div>

            <div className="da-archive-uat-pass">
              <strong>Expected PASS</strong>
              <ul>
                {scenario.expected.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card className="da-archive-uat-blocker">
        <Badge tone="danger">BLOCKER — HOLD GO-LIVE ARSIP</Badge>
        <ul>
          {arsipDigitalDrilldownUatPlan.blockers.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </Card>
    </div>
  );
}
