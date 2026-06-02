import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

// ============================================================================
// 1. CSS INVOICE DOT MATRIX (9.5" x 5.5")
// ============================================================================
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

// ============================================================================
// 2. CSS LAPORAN A4 (TAMPIL RAPI DI LAYAR & KERTAS)
// ============================================================================
const a4Style = `
  .a4-wrapper { max-width: 210mm; margin: 0 auto; background: white; padding: 30px; color: black; font-family: Arial, sans-serif; font-size: 12px; }
  .table-print { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; border: 1px solid black; }
  .table-print th, .table-print td { border: 1px solid black !important; padding: 6px 8px !important; text-align: left; }
  .table-print th { background-color: #f3f4f6 !important; text-align: center; font-weight: bold; text-transform: uppercase; }
  
  @media print { 
    @page { size: A4 portrait; margin: 10mm; } 
    body { font-family: Arial, sans-serif !important; font-size: 11px !important; color: black; background: white; -webkit-print-color-adjust: exact; margin: 0; } 
    .hide-on-print { display: none !important; } 
    .a4-wrapper { padding: 0; box-shadow: none !important; border: none !important; }
  }
`;

// ============================================================================
// KOMPONEN INVOICE
// ============================================================================
export function PrintInvoiceDotMatrix({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const totalQtyNum = (data.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
  const totalPorsi = totalQtyNum / 4;

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-red-600 text-white px-4 py-2 rounded font-bold shadow-md hover:bg-red-700 transition">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
          <div className="flex items-center gap-4">
            {/* LOGO DIKUNCI UKURANNYA */}
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '64px', width: 'auto' }} />
            <div>
              <h1 className="font-black text-xl tracking-wide uppercase mb-1">Dimsum Aditya</h1>
              <p className="text-[10px] font-medium leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
              <p className="text-[10px] font-medium leading-tight">Kec. Cipondoh, Kota Tangerang, Banten 15147</p>
              <p className="text-[10px] font-medium leading-tight mt-0.5">Telp: 087809020931 | Web: dimsumaditya.id</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-black tracking-widest uppercase mb-1">INVOICE</h2>
            <p className="font-bold text-base">{data.id}</p>
          </div>
        </div>

        <div className="flex justify-between gap-4 mb-4">
          <div className="flex-1 box-solid">
            <p className="text-[10px] font-bold uppercase mb-1">Tagihan Kepada :</p>
            <p className="text-lg font-black uppercase">{data.customer}</p>
          </div>
          <div className="w-1/3 box-solid flex flex-col justify-center">
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(data.date)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] font-bold uppercase">Pembayaran</span> <span className="font-bold uppercase text-[10px]">{data.paymentMethod}</span></div>
          </div>
        </div>

        <table className="table-pro">
          <thead>
            <tr>
              <th className="w-8">NO</th>
              <th className="text-left">DESKRIPSI BARANG</th>
              <th className="w-20">PORSI</th>
              <th className="w-20">QTY</th>
              <th className="w-32 text-right">HARGA SATUAN</th>
              <th className="w-32 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">1</td>
              <td className="text-left font-bold uppercase">Dimsum Ayam Mix</td>
              <td className="font-bold">{totalPorsi} Prs</td>
              <td className="font-bold">{totalQtyNum} Pcs</td>
              <td className="text-right">{formatRp(data.price)}</td>
              <td className="text-right font-black">{formatRp(data.totalAll)}</td>
            </tr>
            <tr><td className="py-2 border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td></tr>
          </tbody>
        </table>

        <div className="flex justify-between items-start mt-2">
            <div className="flex-1 mr-6">
                <div className="border border-black p-2 rounded bg-white">
                    <span className="text-[9px] font-bold uppercase block">Terbilang :</span>
                    <span className="font-bold italic text-xs"># {terbilang(data.totalAll)} Rupiah #</span>
                </div>
                <div className="mt-2 text-xs font-bold">
                    <p className="uppercase underline mb-0.5">Info Transfer :</p>
                    <p>BCA : 1320552261 a/n WASTAM</p>
                    <p>BRI : 775301006132536 a/n WASTAM</p>
                </div>
            </div>
            <div className="w-64">
                <div className="flex justify-between mb-1 text-xs"><span className="font-bold uppercase">Subtotal</span><span className="font-black">{formatRp(data.totalAll)}</span></div>
                <div className="flex justify-between mb-1.5 text-xs"><span className="font-bold uppercase">Telah Dibayar</span><span className="font-bold">{formatRp(data.paidAmount)}</span></div>
                <div className="flex justify-between border-t border-black pt-1.5 mt-0.5"><span className="font-black text-sm uppercase">SISA TAGIHAN</span><span className="font-black text-sm">{formatRp(Number(data.totalAll) - Number(data.paidAmount))}</span></div>
            </div>
        </div>
        
        <div className="flex justify-between mt-6 text-center text-xs">
          <div className="w-40"><p className="font-bold uppercase">Penerima / Pelanggan</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( {data.customer} )</p></div>
          <div className="w-40"><p className="font-bold uppercase">Hormat Kami,</p><div className="h-12"></div><p className="border-t border-black pt-1 uppercase">( Admin Kasir )</p></div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONEN LAPORAN REKAP PUSAT (A4)
// ============================================================================
export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  const totalPengeluaran = (rekap?.listExpenses || []).reduce((sum, e) => sum + (Number(e.total)||0), 0);

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <div className="flex items-center gap-4">
                {/* LOGO DIKUNCI UKURANNYA */}
                <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '70px', width: 'auto' }} />
            </div>
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-1">LAPORAN KEUANGAN DIMSUM ADITYA TANGERANG</h1>
                <p className="text-gray-700 font-medium">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        <div className="flex gap-4 mb-6">
            <div className="border border-black p-4 flex-1 rounded bg-white">
                <h3 className="font-bold mb-2 border-b border-black pb-1">SALDO AKTUAL</h3>
                <div className="flex justify-between"><span>Tunai (CASH):</span> <strong>{formatRp(rekap?.saldoCash)}</strong></div>
                <div className="flex justify-between"><span>Rekening (TF):</span> <strong>{formatRp(rekap?.saldoTF)}</strong></div>
                <div className="flex justify-between border-t border-black mt-2 pt-2 text-sm text-blue-700"><span>TOTAL:</span> <strong>{formatRp(rekap?.saldoAkhir)}</strong></div>
            </div>
            <div className="border border-black p-4 flex-1 rounded bg-white">
                <h3 className="font-bold mb-2 border-b border-black pb-1">OMSET PERIODE</h3>
                <div className="flex justify-between"><span>Porsi Terjual:</span> <strong>{rekap?.totalPorsi} Prs</strong></div>
                <div className="flex justify-between"><span>Piutang Baru:</span> <strong className="text-red-600">{formatRp(rekap?.totalPiutangBaru)}</strong></div>
                <div className="flex justify-between border-t border-black mt-2 pt-2 text-sm text-emerald-700"><span>TOTAL:</span> <strong>{formatRp(rekap?.totalPenjualanKotor)}</strong></div>
            </div>
        </div>

        <h3 className="font-bold text-sm mb-2">A. TRANSAKSI PENJUALAN</h3>
        <table className="table-print">
          <thead><tr><th className="w-8">NO</th><th>NO. INV</th><th>PELANGGAN</th><th>KATEGORI</th><th>VIA</th><th>QTY</th><th className="text-right">OMSET</th></tr></thead>
          <tbody>
            {(rekap?.listTransaksiDetail || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="font-mono text-[10px] text-center">{c.id}</td>
                    <td className="font-bold uppercase">{c.customer}</td>
                    <td className="text-center">{c.category}</td>
                    <td className="text-center">{c.paymentMethod}</td>
                    <td className="text-center">{(c?.items || []).join(', ')}</td>
                    <td className="text-right">{formatRp(c.total)}</td>
                </tr>
            ))}
            {/* TOTAL BAWAH */}
            <tr>
                <td colSpan="6" className="text-right font-bold uppercase">Total Omset Penjualan :</td>
                <td className="text-right font-black text-emerald-600">{formatRp(rekap?.totalPenjualanKotor)}</td>
            </tr>
          </tbody>
        </table>

        {rekap?.listExpenses?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-2 mt-6">B. BUKU KAS (PENGELUARAN)</h3>
            <table className="table-print">
              <thead><tr><th className="w-8">NO</th><th>TANGGAL</th><th>KATEGORI</th><th>KETERANGAN</th><th>VIA</th><th className="text-right">NOMINAL</th></tr></thead>
              <tbody>
                  {rekap.listExpenses.map((o, i) => (
                      <tr key={i}>
                          <td className="text-center">{i + 1}</td>
                          <td className="text-center">{formatDate(o.date)}</td>
                          <td className="font-bold uppercase">{o.category}</td>
                          <td>{o.description}</td>
                          <td className="text-center">{o.paymentMethod}</td>
                          <td className="text-right">{o.type==='IN'?'+':'-'}{formatRp(o.total)}</td>
                      </tr>
                  ))}
                  {/* TOTAL BAWAH */}
                  <tr>
                      <td colSpan="5" className="text-right font-bold uppercase">Total Pengeluaran Kas :</td>
                      <td className="text-right font-black text-red-600">-{formatRp(totalPengeluaran)}</td>
                  </tr>
              </tbody>
            </table>
          </>
        )}

        {rekap?.listPiutangBerjalan?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-2 mt-6 text-red-600">C. DAFTAR PIUTANG BERJALAN (BELUM LUNAS)</h3>
            <table className="table-print">
              <thead><tr><th className="w-8">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th>QTY (PCS/PORSI)</th><th className="text-right">TAGIHAN</th><th className="text-right">DIBAYAR</th><th className="text-right">SISA</th></tr></thead>
              <tbody>
                {rekap.listPiutangBerjalan.map((o, i) => {
                   const totalQtyNum = (o.items || []).reduce((sum, str) => sum + (parseInt(str) || 0), 0);
                   return (
                     <tr key={i}>
                       <td className="text-center">{i + 1}</td>
                       <td className="text-center">{formatDate(o.date)}<br/><span className="font-mono text-[9px]">{o.id}</span></td>
                       <td className="font-bold uppercase">{o.customer}</td>
                       <td className="text-center">{totalQtyNum} Pcs / {totalQtyNum/4} Prs</td>
                       <td className="text-right">{formatRp(o.totalTagihan)}</td>
                       <td className="text-right text-emerald-600">{formatRp((Number(o.paidAmount)||0) + (Number(o.cicilanTerbayar)||0))}</td>
                       <td className="text-right font-bold text-red-600">{formatRp(o.sisaHutang)}</td>
                     </tr>
                   )
                })}
              </tbody>
            </table>
          </>
        )}

        {rekap?.listHutangBerjalan?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mb-2 mt-6 text-orange-600">D. DAFTAR HUTANG SUPPLIER (BELUM LUNAS)</h3>
            <table className="table-print">
              <thead><tr><th className="w-8">NO</th><th>TGL & INV</th><th>SUPPLIER</th><th>BARANG</th><th className="text-right">TAGIHAN</th><th className="text-right">DIBAYAR</th><th className="text-right">SISA</th></tr></thead>
              <tbody>
                {rekap.listHutangBerjalan.map((o, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="text-center">{formatDate(o.date)}<br/><span className="font-mono text-[9px]">{o.id}</span></td>
                    <td className="font-bold uppercase">{o.supplier}</td>
                    <td className="text-center">{(o.items || []).join(', ')}</td>
                    <td className="text-right">{formatRp(o.totalTagihan)}</td>
                    <td className="text-right text-emerald-600">{formatRp((Number(o.paidAmount)||0) + (Number(o.cicilanTerbayar)||0))}</td>
                    <td className="text-right font-bold text-red-600">{formatRp(o.sisaHutang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONEN LAPORAN REKAP CABANG (A4)
// ============================================================================
export function PrintReportBranch({ data, onBack, user }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      <div className="a4-wrapper shadow-xl border border-gray-200">
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <div className="flex items-center gap-4">
                <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{ height: '70px', width: 'auto' }} />
            </div>
            <div className="text-right">
                <h1 className="text-xl font-black uppercase mb-1">LAPORAN OPERASIONAL DIMSUM ADITYA</h1>
                <p className="text-sm font-bold uppercase">CABANG: {user?.name}</p>
                <p className="text-gray-700 font-medium">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>
        
        <div className="flex gap-4 mb-6">
            <div className="border border-black p-4 flex-1 rounded bg-white">
                <h3 className="font-bold mb-2 border-b border-black pb-1">RINGKASAN PENJUALAN</h3>
                <div className="flex justify-between"><span>Omset Kotor:</span> <strong>{formatRp(rekap?.totalPenjualanKotor)}</strong></div>
                <div className="flex justify-between"><span>Porsi Terjual:</span> <strong>{rekap?.totalPorsi} Porsi</strong></div>
            </div>
            <div className="border border-black p-4 flex-1 rounded bg-white">
                <h3 className="font-bold mb-2 border-b border-black pb-1">SETORAN PUSAT</h3>
                <div className="flex justify-between"><span>Total Disetor:</span> <strong className="text-blue-700">{formatRp(rekap?.setoranKePusat)}</strong></div>
                <div className="flex justify-between"><span>Status:</span> <strong>Transfer Bank</strong></div>
            </div>
        </div>

        <h3 className="font-bold text-sm mb-2">A. TRANSAKSI INVOICE CABANG</h3>
        <table className="table-print">
          <thead><tr><th className="w-8">NO</th><th>NO. INV</th><th>PELANGGAN</th><th>VIA</th><th>QTY</th><th className="text-right">TOTAL</th></tr></thead>
          <tbody>
            {(rekap?.listOrders || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="font-mono text-[10px] text-center">{c.id}</td>
                    <td className="font-bold uppercase">{c.customer}</td>
                    <td className="text-center">{c.paymentMethod}</td>
                    <td className="text-center">{(c?.items||[]).join(', ')}</td>
                    <td className="text-right">{formatRp(c.total)}</td>
                </tr>
            ))}
            <tr>
                <td colSpan="5" className="text-right font-bold uppercase">Total Omset Cabang :</td>
                <td className="text-right font-black text-emerald-600">{formatRp(rekap?.totalPenjualanKotor)}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="font-bold text-sm mb-2 mt-6">B. LAPORAN HARIAN & STOK</h3>
        <table className="table-print">
            <thead><tr><th className="w-8">NO</th><th>TGL</th><th className="text-center">PROD / PSN</th><th>STOK FREEZER</th><th className="text-center">TUJUAN TF</th><th className="text-right">UANG DISETOR</th></tr></thead>
            <tbody>
                {(rekap?.listReports || []).map((p, i) => (
                    <tr key={i}>
                        <td className="text-center">{i + 1}</td>
                        <td className="text-center">{formatDate(p.date)}</td>
                        <td className="text-center">{p.produksiMika}M / {p.pesananMika}M</td>
                        <td className="font-bold uppercase text-center">{p.stokFreezer}</td>
                        <td className="text-center font-bold text-indigo-700">{p.transferDestination || 'BCA (WASTAM)'}</td>
                        <td className="text-right font-bold text-emerald-700">{formatRp(p.nominal)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}

export function PrintVoucher({ data, onBack }) { /* ... */ return null; }
export function PrintPurchase({ data, onBack }) { /* ... */ return null; }
export function PrintReceipt({ data, onBack }) { /* ... */ return null; }
