import { Factory, PackageCheck, PackageOpen, Snowflake } from "lucide-react";

const STEPS = [
  { label: "Pembelian", hint: "Ayam masuk", icon: PackageOpen },
  { label: "Stok Ayam", hint: "Lot bahan", icon: PackageCheck },
  { label: "Produksi", hint: "Adukan", icon: Factory },
  { label: "Freezer", hint: "Hasil masuk", icon: Snowflake },
  { label: "Stok Jadi", hint: "Siap jual", icon: PackageCheck },
];

function normalizedStep(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(STEPS.length - 1, Math.max(0, Math.trunc(parsed)));
}

export default function ProductionFlowPanel({ activeStep = 0 }) {
  const current = normalizedStep(activeStep);

  return (
    <nav className="da-prod-flow-v9" aria-label="Tahapan produksi">
      <div className="da-prod-flow-v9-label">
        <span>Proses</span>
        <strong>{STEPS[current].label}</strong>
      </div>

      <div className="da-prod-flow-v9-track" role="list">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const state =
            index === current
              ? "is-current"
              : index < current
                ? "is-before"
                : "is-after";

          return (
            <div
              className={`da-prod-flow-v9-step ${state}`}
              key={step.label}
              role="listitem"
              aria-current={index === current ? "step" : undefined}
            >
              <span className="da-prod-flow-v9-dot">
                <Icon size={13} />
              </span>
              <span className="da-prod-flow-v9-copy">
                <small>{String(index + 1).padStart(2, "0")}</small>
                <strong>{step.label}</strong>
                <em>{step.hint}</em>
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
