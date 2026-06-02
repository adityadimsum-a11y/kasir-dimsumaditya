import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

// ============================================================================
// 1. STYLING PRINT (CLEAN & PROFESSIONAL)
// ============================================================================
const printStyle = `
  @media print {
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Helvetica', Arial, sans-serif !important; font-size: 11px !important; color: #000; background: white; margin: 0; }
    .hide-on-print { display: none !important; }
    .table-print { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .table-print th, .table-print td { border: 1px solid #000 !important; padding: 6px !important; text-align: left; }
    .table-print th { background-color: #f3f3f3 !important; text-align: center; font-weight: bold; }
    .logo-print { height: 50px; }
  }
`;

export function PrintInvoiceDotMatrix({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const totalQtyNum = (data.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
  const totalPorsi = totalQtyNum / 4;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: printStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-red-600 text-white px-4 py-2 rounded font-bold">Kembali</button>
      <div className="bg-white p-8 max-w-[800px] mx-auto shadow-lg border border-gray-300">
        <div className="flex justify-between border-b border-black pb-4 mb-4">
          <div className="flex items-center gap-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="logo-print" />
            <div>
              <h1 className="text-xl font-black uppercase">Dimsum Aditya</h1>
              <p className="text-xs">Jl. Thamrin, Ketapang, Cipondoh, Tangerang</p>
              <p className="text-xs font-bold">087809020931 | dimsumaditya.id</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black uppercase">INVOICE</h2>
            <p className="font-bold">{data.id}</p>
          </div>
        </div>
        <div className="flex justify-between mb-4">
            <div><p className="text-[10px] font-bold uppercase">Kepada:</p><p className="font-bold text-lg uppercase">{data.customer}</p></div>
            <div className="text-right text-xs"><p>Tanggal: <strong>{formatDate(data.date)}</strong></p><p>Bayar: <strong>{data.paymentMethod}</strong></p></div>
        </div>
        <table className="table-print">
          <thead><tr><th>NO</th><th>DESKRIPSI BARANG</th><th>PORSI</th><th>QTY</th><th>HARGA</th><th>TOTAL</th></tr></thead>
          <tbody>
            <tr><td className="text-center">1</td><td className="font-bold">DIMSUM AYAM MIX</td><td className="text-center">{totalPorsi} Prs</td><td className="text-center">{totalQtyNum} Pcs</td><td className="text-right">{formatRp(data.price)}</td><td className="text-right font-bold">{formatRp(data.totalAll)}</td></tr>
          </tbody>
        </table>
        <div className="flex justify-end mt-4">
            <div className="w-64 space-y-1 text-xs">
                <div className="flex justify-between"><span>SUBTOTAL</span><strong>{formatRp(data.totalAll)}</strong></div>
                <div className="flex justify-between"><span>DIBAYAR</span><strong>{formatRp(data.paidAmount)}</strong></div>
                <div className="flex justify-between border-t border-black pt-1 font-bold"><span>SISA TAGIHAN</span><span>{formatRp(Number(data.totalAll) - Number(data.paidAmount))}</span></div>
            </div>
        </div>
        <div className="mt-8 flex justify-between text-xs">
            <div><p>Info Transfer:</p><p className="font-bold">BCA: 1320552261 | BRI: 775301006132536 (WASTAM)</p></div>
            <div className="text-center w-32"><p className="mb-12">Hormat Kami,</p><p className="border-t border-black">( Admin Kasir )</p></div>
        </div>
      </div>
    </div>
  );
}

// === TEMPLATE LAPORAN (FIXED) ===
export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: printStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded">Kembali</button>
      <div className="bg-white p-8 max-w-[210mm] mx-auto shadow-lg border border-gray-300">
        <div className="header flex items-center justify-between border-b-2 border-black pb-4 mb-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="logo-print" />
            <div className="text-right">
                <h1 className="text-lg font-bold">LAPORAN KEUANGAN PUSAT</h1>
                <p className="text-xs">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>
        <div className="flex gap-4 mb-6">
            <div className="border p-4 flex-1"><strong>Total Saldo:</strong> {formatRp(rekap?.saldoAkhir)}</div>
            <div className="border p-4 flex-1"><strong>Total Penjualan:</strong> {formatRp(rekap?.totalPenjualanKotor)}</div>
        </div>
        <h3>A. TRANSAKSI PENJUALAN</h3>
        <table className="table-print">
          <thead><tr><th>NO</th><th>NO. INV</th><th>PELANGGAN</th><th>VIA</th><th>OMSET</th></tr></thead>
          <tbody>
            {(rekap?.listTransaksiDetail || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td>{c.id}</td>
                    <td>{c.customer}</td>
                    <td>{c.paymentMethod}</td>
                    <td className="text-right">{formatRp(c.total)}</td>
                </tr>
            ))}
          </tbody>
        </table>
        {rekap?.listExpenses?.length > 0 && (
          <>
            <h3 className="mt-4">B. BUKU KAS (PENGELUARAN)</h3>
            <table className="table-print">
              <thead><tr><th>NO</th><th>TANGGAL</th><th>KETERANGAN</th><th>NOMINAL</th></tr></thead>
              <tbody>{rekap.listExpenses.map((o, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td>{formatDate(o.date)}</td><td>{o.description}</td><td className="text-right">{formatRp(o.total)}</td></tr>))}</tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// (Fungsi Print lainnya bisa disalin serupa dengan struktur di atas)
export function PrintPurchase({ data, onBack }) { /* Sama dengan struktur PrintInvoice */ return null; }
export function PrintVoucher({ data, onBack }) { /* Sama dengan struktur PrintInvoice */ return null; }
export function PrintReceipt({ data, onBack }) { /* Sama dengan struktur PrintInvoice */ return null; }
export function PrintReportBranch({ data, onBack, user }) { /* Sama dengan struktur PrintReport */ return null; }
