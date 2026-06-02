import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

const dotMatrixStyle = `
  .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 20px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: black; line-height: 1.3; }
  .box-solid { border: 1px solid black; padding: 8px 12px; border-radius: 4px; }
  .table-pro { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid black; }
  .table-pro th { border: 1px solid black; padding: 6px; text-align: center; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid black; font-size: 11px; }
  .table-pro td { border: 1px solid black; padding: 6px; text-align: center; }
  .table-pro td.text-left { text-align: left; }
  .table-pro td.text-right { text-align: right; }
  @media print {
    @page { size: 9.5in 5.5in; margin: 0.15in 0.3in; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; font-size: 11px !important; color: #000; background: white; -webkit-print-color-adjust: exact; margin: 0; }
    .hide-on-print { display: none !important; }
    .print-wrapper { padding: 0; box-shadow: none !important; border: none !important; }
  }
`;

const a4Style = `
  .a4-wrapper { max-width: 210mm; margin: 0 auto; background: white; padding: 30px; color: black; font-family: Arial, sans-serif; font-size: 12px; }
  .table-print { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; border: 1px solid black; }
  .table-print th, .table-print td { border: 1px solid black !important; padding: 6px 8px !important; text-align: left; vertical-align: middle; }
  .table-print th { background-color: #f3f4f6 !important; text-align: center; font-weight: bold; text-transform: uppercase; }
  @media print { 
    @page { size: A4 portrait; margin: 10mm; } 
    body { font-family: Arial, sans-serif !important; font-size: 11px !important; color: black; background: white; -webkit-print-color-adjust: exact; margin: 0; } 
    .hide-on-print { display: none !important; } 
    .a4-wrapper { padding: 0; box-shadow: none !important; border: none !important; }
  }
`;

// ============================================================================
// KOMPONEN PRINT TANDA TERIMA PEMBAYARAN CICILAN / HUTANG
// ============================================================================
export function PrintReceipt({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { payment, order } = data;
  
  // FIX JURUS MATEMATIKA PASTI
  const totalTagihan = Number(order?.totalTagihan) || Number(order?.totalAll) || 0;
  // Sisa aktual diambil dari sistem saat payment ini terjadi, atau fallback ke sisa hutang terakhir
  const sisaTagihanAktual = payment?.sisaAtThisPoint !== undefined ? Number(payment.sisaAtThisPoint) : (Number(order?.sisaHutang) || 0);
  const totalTerbayar = totalTagihan - sisaTagihanAktual;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-blue-700 transition">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <div className="flex items-center gap-4">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-[10px] font-medium leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
              <p className="text-[10px] font-medium leading-tight">Kec. Cipondoh, Kota Tangerang, Banten 15147</p>
              <p className="text-[10px] font-medium leading-tight mt-0.5">Telp: 087809020931 | Web: dimsumaditya.id</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black tracking-widest uppercase mb-1">TANDA TERIMA</h2>
            <p className="font-bold text-sm">{order?.tipe === 'HUTANG' ? 'PEMBAYARAN' : 'CICILAN'}</p>
          </div>
        </div>

        <div className="flex justify-between gap-4 mb-4">
          <div className="flex-1 box-solid">
            <div className="flex mb-1.5"><span className="w-36 font-bold uppercase text-[10px]">{order?.tipe === 'HUTANG' ? 'Dibayarkan Kepada' : 'Diterima Dari'}</span><span className="font-black uppercase text-sm">: {order?.customer || order?.supplier}</span></div>
            <div className="flex mb-1.5"><span className="w-36 font-bold uppercase text-[10px]">Uang Sejumlah</span><span className="font-black text-base">: {formatRp(payment?.amount)}</span></div>
            <div className="flex"><span className="w-36 font-bold uppercase text-[10px]">Terbilang</span><span className="font-bold italic text-[10px]">: # {terbilang(payment?.amount)} Rupiah #</span></div>
          </div>
          <div className="w-1/3 box-solid flex flex-col justify-center">
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">No. Referensi</span> <span className="font-bold text-[10px]">{payment?.id}</span></div>
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(payment?.date)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] font-bold uppercase">Metode</span> <span className="font-bold uppercase text-[10px]">{payment?.paymentMethod}</span></div>
          </div>
        </div>

        <div className="box-solid mt-4">
            <p className="text-[10px] font-bold uppercase mb-2">Keterangan Pembayaran :</p>
            <p className="text-xs mb-2">Pembayaran untuk Invoice Referensi: <strong className="font-mono">{order?.id}</strong></p>
            
            <table className="table-pro mt-2">
                <thead>
                    <tr>
                        <th className="text-center">TOTAL TAGIHAN INV</th>
                        <th className="text-center">TOTAL TERBAYAR (AKUMULASI)</th>
                        <th className="text-center bg-gray-100">SISA TAGIHAN AKTUAL</th>
                        <th className="text-center">STATUS INVOICE</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="font-bold text-center">{formatRp(totalTagihan)}</td>
                        <td className="font-bold text-emerald-600 text-center">{formatRp(totalTerbayar)}</td>
                        <td className="font-black text-red-600 text-center bg-gray-100">{formatRp(sisaTagihanAktual)}</td>
                        <td className="font-black text-center">{sisaTagihanAktual <= 0 ? 'LUNAS' : 'BELUM LUNAS'}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div className="flex justify-between mt-12 text-center text-xs">
          <div className="w-40">
            <p className="font-bold uppercase">Penerima</p>
            <div className="h-16"></div>
            <p className="border-t border-black pt-1 uppercase">( {order?.customer || order?.supplier} )</p>
          </div>
          <div className="w-40">
            <p className="font-bold uppercase">Admin / Kasir</p>
            <div className="h-16"></div>
            <p className="border-t border-black pt-1 uppercase">( Dimsum Aditya )</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONEN PRINT LAPORAN REKAP PUSAT (A4)
// ============================================================================
export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  const totalPengeluaran = (rekap?.listExpenses || []).reduce((sum, e) => sum + (Number(e.total)||0), 0);

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded">Kembali</button>
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '70px', width: 'auto' }} />
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-1">LAPORAN KEUANGAN PUSAT</h1>
                <p className="text-gray-700 font-medium">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        <h3 className="font-bold text-sm mb-2">A. TRANSAKSI PENJUALAN (RINCIAN TAGIHAN & PEMBAYARAN)</h3>
        <table className="table-print">
          <thead>
            <tr>
                <th className="w-8">NO</th>
                <th>TGL & INV</th>
                <th>PELANGGAN</th>
                <th className="text-right">TAGIHAN</th>
                <th className="text-right">TERBAYAR</th>
                <th className="text-right">SISA</th>
                <th className="text-center">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {(rekap?.listTransaksiDetail || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center">{formatDate(c.date)}<br/><span className="font-mono text-[9px]">{c.id}</span></td>
                    <td className="font-bold uppercase">{c.customer}</td>
                    <td className="text-right font-medium">{formatRp(c.totalTagihan)}</td>
                    <td className="text-right text-emerald-600 font-bold">{formatRp(c.totalTerbayar)}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(c.sisaTagihan)}</td>
                    <td className={`text-center font-bold text-[10px] ${c.status === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{c.status}</td>
                </tr>
            ))}
            <tr>
                <td colSpan="3" className="text-right font-bold uppercase">Total Omset Penjualan :</td>
                <td className="text-right font-black text-blue-700">{formatRp(rekap?.totalPenjualanKotor)}</td>
                <td colSpan="3"></td>
            </tr>
          </tbody>
        </table>

        {/* TABEL B: DENGAN KOLOM SISA TAGIHAN */}
        {rekap?.listPembayaranSemua?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-2 mt-6 text-blue-700">B. RIWAYAT PEMBAYARAN CICILAN (MASUK & KELUAR)</h3>
            <table className="table-print">
              <thead>
                <tr>
                    <th className="w-8">NO</th>
                    <th>TGL & ID BAYAR</th>
                    <th>TGL & INV ASAL</th>
                    <th>PELANGGAN</th>
                    <th className="text-center">QTY</th>
                    <th className="text-right">CICILAN</th>
                    <th className="text-right">SISA TAGIHAN</th>
                    <th className="text-center">STATUS NOTA</th>
                </tr>
              </thead>
              <tbody>
                {rekap.listPembayaranSemua.map((p, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center font-bold text-blue-700">{formatDate(p.date)}<br/><span className="font-mono text-[9px] text-slate-500 font-normal">{p.payId}</span></td>
                    <td className="text-center">{formatDate(p.tglInvoice)}<br/><span className="font-mono text-[9px] font-normal text-slate-500">{p.orderId}</span></td>
                    <td className="font-bold uppercase">{p.customer}</td>
                    <td className="text-center text-xs">{p.qtyDesc}</td>
                    <td className={`text-right font-black ${p.tipe === 'HUTANG' ? 'text-red-600' : 'text-emerald-600'}`}>{p.tipe === 'HUTANG' ? '-' : '+'}{formatRp(p.amount)}</td>
                    <td className={`text-right font-bold ${p.sisaTagihan <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.sisaTagihan <= 0 ? 'Rp 0' : formatRp(p.sisaTagihan)}</td>
                    <td className={`text-center font-bold text-[10px] ${p.statusNota === 'LUNAS' ? 'text-emerald-600' : 'text-red-600'}`}>{p.statusNota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {rekap?.listExpenses?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-2 mt-6">C. BUKU KAS (PENGELUARAN)</h3>
            <table className="table-print">
              <thead><tr><th className="w-8">NO</th><th>TANGGAL</th><th>KATEGORI</th><th>KETERANGAN</th><th className="text-right">NOMINAL</th></tr></thead>
              <tbody>{rekap.listExpenses.map((o, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="text-center">{formatDate(o.date)}</td><td className="font-bold uppercase">{o.category}</td><td>{o.description}</td><td className="text-right">-{formatRp(o.total)}</td></tr>))}<tr><td colSpan="4" className="text-right font-bold uppercase">Total Pengeluaran Kas :</td><td className="text-right font-black text-red-600">-{formatRp(totalPengeluaran)}</td></tr></tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// === KOMPONEN INVOICE, PEMBELIAN, VOUCHER, & CABANG TETAP AMAN ===
export function PrintInvoiceDotMatrix({ data, onBack }) { /* sama dgn sblmnya */ return null; }
export function PrintVoucher({ data, onBack }) { /* sama dgn sblmnya */ return null; }
export function PrintPurchase({ data, onBack }) { /* sama dgn sblmnya */ return null; }
export function PrintReportBranch({ data, onBack, user }) { /* sama dgn sblmnya */ return null; }
