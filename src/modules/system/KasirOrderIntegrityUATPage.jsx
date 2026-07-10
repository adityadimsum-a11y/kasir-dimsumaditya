import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import { kasirOrderIntegrityUatPlan } from "../../lib/uat/kasirOrderIntegrityUatPlan";

export default function KasirOrderIntegrityUATPage() {
  return (
    <div className="da-page da-order-uat-page">
      <PageHeader
        title="Kasir / Order Integrity Check"
        description="Final check supaya Kasir/Order aman dipakai harian: tidak kosong, tidak qty 0, tidak double submit, stok dan uang nyambung ke arsip."
        badge="Part 7B"
        badgeTone="warning"
      />

      <Card className="da-order-uat-hero">
        <div>
          <div className="da-page-kicker">ORDER SAFETY</div>
          <h2>Kasir boleh dipakai harian kalau semua test utama PASS</h2>
          <p>{kasirOrderIntegrityUatPlan.objective}</p>
        </div>
        <Badge tone="warning">Read-Only Checklist</Badge>
      </Card>

      <div className="da-order-uat-grid">
        {kasirOrderIntegrityUatPlan.scenarios.map((scenario) => (
          <Card className="da-order-uat-card" key={scenario.id}>
            <div className="da-page-kicker">{scenario.id}</div>
            <h2>{scenario.title}</h2>
            <Badge tone={scenario.risk.includes("Blocker") ? "danger" : "warning"}>{scenario.risk}</Badge>

            <div className="da-order-uat-section">
              <strong>Langkah Test</strong>
              <ol>
                {scenario.steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
            </div>

            <div className="da-order-uat-pass">
              <strong>Expected PASS</strong>
              <ul>
                {scenario.expected.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card className="da-order-uat-blocker">
        <Badge tone="danger">BLOCKER — HOLD KASIR GO-LIVE</Badge>
        <ul>
          {kasirOrderIntegrityUatPlan.blockers.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </Card>
    </div>
  );
}
