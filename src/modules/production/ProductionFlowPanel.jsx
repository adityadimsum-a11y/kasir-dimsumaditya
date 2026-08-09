import { useMemo, useState } from "react";
import { Factory, PackageCheck, PackageOpen, Snowflake } from "lucide-react";
import Modal from "../../components/ui/Modal";

const STEPS = [
  {
    label: "Pembelian Ayam",
    shortLabel: "Pembelian",
    description: "Catat nota supplier, harga aktual, pembayaran awal, dan hutang supplier.",
    icon: PackageOpen,
  },
  {
    label: "Stok Ayam",
    shortLabel: "Stok Ayam",
    description: "Pantau lot bahan, sisa kilogram, nilai persediaan, dan pemakaian produksi.",
    icon: PackageCheck,
  },
  {
    label: "Produksi / Adukan",
    shortLabel: "Produksi",
    description: "Gunakan lot ayam, catat jumlah adukan, hasil aktual, dan HPP batch.",
    icon: Factory,
  },
  {
    label: "Barang Masuk Freezer",
    shortLabel: "Freezer",
    description: "Hasil produksi masuk sebagai persediaan barang jadi dan membawa HPP batch.",
    icon: Snowflake,
  },
  {
    label: "Stok Jadi",
    shortLabel: "Stok Jadi",
    description: "Pantau stok bebas, alokasi PO, nilai persediaan, dan barang keluar.",
    icon: PackageCheck,
  },
];

function normalizedStep(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(STEPS.length - 1, Math.max(0, Math.trunc(parsed)));
}

const palette = {
  red: "#D9251C",
  redSoft: "#FFF4F2",
  redBorder: "#FECDCA",
  ink: "#101828",
  text: "#344054",
  muted: "#667085",
  subtle: "#98A2B3",
  border: "#E4E7EC",
  panel: "#F9FAFB",
  white: "#FFFFFF",
};

export default function ProductionFlowPanel({ activeStep = 0 }) {
  const [open, setOpen] = useState(false);
  const current = normalizedStep(activeStep);
  const currentStep = STEPS[current];
  const CurrentIcon = currentStep.icon;

  const stepCards = useMemo(
    () =>
      STEPS.map((step, index) => {
        const Icon = step.icon;
        const isCurrent = index === current;

        return (
          <div
            key={step.label}
            aria-current={isCurrent ? "step" : undefined}
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "40px minmax(0, 1fr)",
              gap: 12,
              alignItems: "start",
              minWidth: 0,
              padding: 14,
              borderRadius: 14,
              border: `1px solid ${isCurrent ? palette.redBorder : palette.border}`,
              background: isCurrent ? palette.redSoft : palette.white,
              boxShadow: isCurrent ? "0 4px 14px rgba(217,37,28,.06)" : "none",
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                display: "grid",
                placeItems: "center",
                borderRadius: 12,
                background: isCurrent ? palette.red : palette.panel,
                color: isCurrent ? palette.white : palette.muted,
                border: `1px solid ${isCurrent ? palette.red : palette.border}`,
              }}
            >
              <Icon size={18} />
            </span>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    color: isCurrent ? palette.red : palette.subtle,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: ".06em",
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {isCurrent ? (
                  <span
                    style={{
                      padding: "3px 7px",
                      borderRadius: 999,
                      background: "#FFFFFF",
                      border: `1px solid ${palette.redBorder}`,
                      color: palette.red,
                      fontSize: 9,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Menu aktif
                  </span>
                ) : null}
              </div>
              <strong
                style={{
                  display: "block",
                  color: palette.ink,
                  fontSize: 13,
                  fontWeight: 900,
                  lineHeight: 1.25,
                }}
              >
                {step.label}
              </strong>
              <p
                style={{
                  margin: "6px 0 0",
                  color: palette.muted,
                  fontSize: 11,
                  fontWeight: 650,
                  lineHeight: 1.5,
                }}
              >
                {step.description}
              </p>
            </div>
          </div>
        );
      }),
    [current]
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          minHeight: 38,
          margin: "-2px 0 2px",
        }}
      >
        <button
          type="button"
          className="da-button da-button-secondary"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          title="Lihat alur produksi"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            minHeight: 36,
            padding: "0 12px",
            borderRadius: 10,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 25,
              height: 25,
              display: "grid",
              placeItems: "center",
              borderRadius: 8,
              background: palette.redSoft,
              color: palette.red,
            }}
          >
            <CurrentIcon size={14} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.05 }}>
            <strong style={{ fontSize: 10.5, fontWeight: 900 }}>Alur Produksi</strong>
            <small style={{ marginTop: 2, color: palette.muted, fontSize: 8.5, fontWeight: 750 }}>
              {String(current + 1).padStart(2, "0")}/05 · {currentStep.shortLabel}
            </small>
          </span>
          <span aria-hidden="true" style={{ marginLeft: 2, color: palette.subtle, fontSize: 16, lineHeight: 1 }}>
            →
          </span>
        </button>
      </div>

      <Modal
        open={open}
        title="Alur Produksi"
        subtitle={`Peta proses dari pembelian ayam sampai stok siap jual · menu aktif: ${currentStep.label}`}
        onClose={() => setOpen(false)}
        size="xl"
      >
        <div style={{ display: "grid", gap: 14 }}>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 14,
              alignItems: "center",
              padding: 14,
              borderRadius: 14,
              background: palette.white,
              border: `1px solid ${palette.border}`,
            }}
          >
            <div>
              <span
                style={{
                  display: "block",
                  color: palette.red,
                  fontSize: 9,
                  fontWeight: 950,
                  letterSpacing: ".07em",
                  textTransform: "uppercase",
                }}
              >
                Tahap yang sedang dibuka
              </span>
              <strong
                style={{
                  display: "block",
                  marginTop: 5,
                  color: palette.ink,
                  fontSize: 18,
                  fontWeight: 950,
                }}
              >
                {currentStep.label}
              </strong>
              <p
                style={{
                  margin: "5px 0 0",
                  color: palette.muted,
                  fontSize: 11.5,
                  fontWeight: 650,
                  lineHeight: 1.5,
                }}
              >
                {currentStep.description}
              </p>
            </div>

            <div
              style={{
                width: 54,
                height: 54,
                display: "grid",
                placeItems: "center",
                borderRadius: 16,
                background: palette.redSoft,
                color: palette.red,
                border: `1px solid ${palette.redBorder}`,
              }}
            >
              <CurrentIcon size={24} />
            </div>
          </section>

          <section
            role="list"
            aria-label="Urutan proses produksi"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            {stepCards}
          </section>

          <div
            style={{
              padding: "11px 13px",
              borderRadius: 12,
              background: "#FFFAEB",
              border: "1px solid #FEDF89",
              color: "#7A2E0E",
              fontSize: 10.5,
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            Penanda merah hanya menunjukkan menu yang sedang dibuka. Alur ini adalah peta proses operasional, bukan status bahwa tahap sebelumnya sudah selesai.
          </div>
        </div>
      </Modal>
    </>
  );
}
