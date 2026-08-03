import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import { uangKasDompetHutangUatPlan } from "../../lib/uat/uangKasDompetHutangUatPlan";

export default function UangKasDompetHutangUATPage() {
  return (
    <div className="da-page da-money-uat-page">
      <PageHeader
        title="Uang / Kas Dompet / Hutang Nana Check"
        description="Final check supaya uang harian aman: payment masuk dompet, kas keluar potong dompet, hutang Nana turun, semua mutasi punya source ID."
        badge="Part 7D"
        badgeTone="warning"
      />

      <Card className="da-money-uat-hero">
        <div>
          <div className="da-page-kicker">MONEY SAFETY</div>
          <h2>Uang boleh dipakai harian kalau dompet, hutang, piutang, dan arsip nyambung</h2>
          <p>{uangKasDompetHutangUatPlan.objective}</p>
        </div>
        <Badge tone="warning">Read-Only Checklist</Badge>
      </Card>

      <div className="da-money-uat-grid">
        {uangKasDompetHutangUatPlan.scenarios.map((scenario) => (
          <Card className="da-money-uat-card" key={scenario.id}>
            <div className="da-page-kicker">{scenario.id}</div>
            <h2>{scenario.title}</h2>
            <Badge tone={scenario.risk.includes("Blocker") ? "danger" : "warning"}>{scenario.risk}</Badge>

            <div className="da-money-uat-section">
              <strong>Langkah Test</strong>
              <ol>
                {scenario.steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
            </div>

            <div className="da-money-uat-pass">
              <strong>Expected PASS</strong>
              <ul>
                {scenario.expected.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card className="da-money-uat-blocker">
        <Badge tone="danger">BLOCKER — HOLD UANG/DOMPET GO-LIVE</Badge>
        <ul>
          {uangKasDompetHutangUatPlan.blockers.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </Card>
    </div>
  );
}
