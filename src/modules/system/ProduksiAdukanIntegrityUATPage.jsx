import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import { produksiAdukanIntegrityUatPlan } from "../../lib/uat/produksiAdukanIntegrityUatPlan";

export default function ProduksiAdukanIntegrityUATPage() {
  return (
    <div className="da-page da-production-uat-page">
      <PageHeader
        title="Produksi / Adukan → Stok Jadi Check"
        description="Final check supaya produksi aman: ayam lot kepotong, stok jadi bertambah, modal/pcs tercatat, dan semua ID masuk Arsip."
        badge="Part 7C"
        badgeTone="warning"
      />

      <Card className="da-production-uat-hero">
        <div>
          <div className="da-page-kicker">PRODUCTION SAFETY</div>
          <h2>Produksi boleh dipakai harian kalau ayam, stok jadi, dan modal nyambung</h2>
          <p>{produksiAdukanIntegrityUatPlan.objective}</p>
        </div>
        <Badge tone="warning">Read-Only Checklist</Badge>
      </Card>

      <div className="da-production-uat-grid">
        {produksiAdukanIntegrityUatPlan.scenarios.map((scenario) => (
          <Card className="da-production-uat-card" key={scenario.id}>
            <div className="da-page-kicker">{scenario.id}</div>
            <h2>{scenario.title}</h2>
            <Badge tone={scenario.risk.includes("Blocker") ? "danger" : "warning"}>{scenario.risk}</Badge>

            <div className="da-production-uat-section">
              <strong>Langkah Test</strong>
              <ol>
                {scenario.steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
            </div>

            <div className="da-production-uat-pass">
              <strong>Expected PASS</strong>
              <ul>
                {scenario.expected.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card className="da-production-uat-blocker">
        <Badge tone="danger">BLOCKER — HOLD PRODUKSI GO-LIVE</Badge>
        <ul>
          {produksiAdukanIntegrityUatPlan.blockers.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </Card>
    </div>
  );
}
