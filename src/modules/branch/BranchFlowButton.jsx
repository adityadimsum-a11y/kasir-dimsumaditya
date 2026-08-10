import { ArrowRight, CheckCircle2, FileText, Send, Wallet } from "lucide-react";
import { useState } from "react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";

const STEPS = [
  { no: "01", title: "Transaksi Cabang", desc: "Order, pembayaran, piutang, dan pengeluaran dicatat dari modul sumber.", icon: CheckCircle2 },
  { no: "02", title: "Laporan Harian", desc: "Sistem menarik transaksi otomatis dan membuat snapshot periode.", icon: FileText, page: "laporan-harian" },
  { no: "03", title: "Review Tangerang", desc: "Owner memeriksa sumber transaksi lalu menyetujui atau mengembalikan laporan.", icon: CheckCircle2 },
  { no: "04", title: "Setoran Cabang", desc: "Hanya laporan yang sudah disetujui dapat menjadi bahan setoran.", icon: Wallet, page: "setoran-cabang" },
  { no: "05", title: "Dana Diterima Pusat", desc: "Saat disahkan, dompet cabang OUT dan dompet pusat IN dalam satu transaksi.", icon: Send },
];

export default function BranchFlowButton({ current = "report", onNavigate }) {
  const [open, setOpen] = useState(false);
  const activePage = current === "deposit" ? "setoran-cabang" : "laporan-harian";

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="da-branch-flow-trigger">
        Alur Cabang <ArrowRight size={15} />
      </Button>
      <Modal open={open} title="Alur Cabang" subtitle="Dari transaksi harian sampai dana diterima Tangerang" onClose={() => setOpen(false)}>
        <div className="da-branch-flow-list">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const active = step.page === activePage;
            return (
              <div key={step.no} className={`da-branch-flow-step ${active ? "is-active" : ""}`}>
                <div className="da-branch-flow-no">{step.no}</div>
                <div className="da-branch-flow-icon"><Icon size={18} /></div>
                <div className="da-branch-flow-copy">
                  <strong>{step.title}</strong>
                  <span>{step.desc}</span>
                </div>
                {step.page && step.page !== activePage && onNavigate ? (
                  <button type="button" className="da-branch-flow-link" onClick={() => { setOpen(false); onNavigate(step.page); }}>
                    Buka <ArrowRight size={14} />
                  </button>
                ) : active ? <span className="da-branch-flow-current">Sedang dibuka</span> : null}
              </div>
            );
          })}
        </div>
        <div className="da-branch-flow-note">
          Laporan dan setoran tidak membuat omzet baru. Semua angka tetap berasal dari transaksi sumber dan dapat ditelusuri melalui Arsip Digital.
        </div>
      </Modal>
    </>
  );
}
