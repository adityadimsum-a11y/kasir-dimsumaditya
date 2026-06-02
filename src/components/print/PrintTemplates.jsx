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

// [SISA INVOICE DOT MATRIX TETAP AMAN]
const dotMatrixStyle = `
  @media print {
    @page { size: 9.5in 5.5in; margin: 0.15in 0.3in; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important; font-size: 11px !important; color: #000; background: white; -webkit-print-color-adjust: exact; margin: 0; }
    .hide-on-print { display: none !important; }
  }
  .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 10px 20px; background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: black; line-height: 1.3; }
  .box-solid { border: 1px solid black; padding: 8px 12px; border-radius: 4px; }
  .table-pro { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid black; }
  .table-pro th { border: 1px solid black; padding: 6px; text-align: center; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid black; font-size: 11px; }
  .table-pro td { border: 1px solid black; padding: 6px; text-align: center; }
  .table-pro td.text-left { text-align: left; }
  .table-pro td.text-right { text-align: right; }
`;

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
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-16 object-contain" />
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
          <div className="flex-1 box-solid"><p className="text-[10px] font-bold uppercase mb-1">Tagihan Kepada :</p><p className="text-lg font-black uppercase">{data.customer}</p></div>
          <div className="w-1/3 box-solid flex flex-col justify-center">
            <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(data.date)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] font-bold uppercase">Pembayaran</span> <span className="font-bold uppercase text-[10px]">{data.paymentMethod}</span></div>
          </div>
        </div>
        <table className="table-pro">
          <thead><tr><th>NO</th><th className="text-left">DESKRIPSI BARANG</th><th>PORSI</th><th>QTY</th><th className="text-right">HARGA</th><th className="text-right">TOTAL</th></tr></thead>
          <tbody>
            <tr><td className="font-bold">1</td><td className="text-left font-bold uppercase">Dimsum Ayam Mix</td><td className="font-bold">{totalPorsi} Prs</td><td className="font-bold">{totalQtyNum} Pcs</td><td className="text-right">{formatRp(data.price)}</td><td className="text-right font-black">{formatRp(data.totalAll)}</td></tr>
            <tr><td className="py-2"></td><td></td><td></td><td></td><td></td><td></td></tr>
          </tbody>
        </table>
        <div className="flex justify-between items-start mt-2">
            <div className="flex-1 mr-6">
                <div className="border border-black p-2 rounded"><span className="text-[9px] font-bold uppercase block">Terbilang :</span><span className="font-bold italic text-xs"># {terbilang(data.totalAll)} Rupiah #</span></div>
                <div className="mt-2 text-xs font-bold"><p className="uppercase underline mb-0.5">Info Transfer :</p><p>BCA : 1320552261 a/n WASTAM</p><p>BRI : 775301006132536 a/n WASTAM</p></div>
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

// === TEMPLATE LAPORAN (SUPER LENGKAP & RAPI) ===
export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  
  // Total Bawah Tabel
  const totalOmsetPenjualan = (rekap?.listTransaksiDetail || []).reduce((a, b) => a + Number(b.total), 0);
  const totalPengeluaran = (rekap?.listExpenses || []).filter(x => x.type === 'OUT').reduce((a, b) => a + Number(b.total), 0);

  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: printStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="bg-white p-8 max-w-[210mm] mx-auto shadow-lg border border-gray-300">
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4">
            <div className="flex items-center gap-4">
                <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-16 object-contain" />
            </div>
            <div className="text-right">
                {/* JUDUL DIGANTI SESUAI REQUEST */}
                <h1 className="text-xl font-black uppercase">LAPORAN KEUANGAN DIMSUM ADITYA TANGERANG</h1>
                <p className="text-xs">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>
        
        <div className="flex gap-4 mb-6 text-sm">
            <div className="border p-4 flex-1">
                <h3 className="font-bold mb-2 border-b border-black pb-1">SALDO AKTUAL BERJALAN</h3>
                <div className="flex justify-between"><span>Tunai (CASH):</span> <strong>{formatRp(rekap?.saldoCash)}</strong></div>
                <div className="flex justify-between"><span>Rekening (TF):</span> <strong>{formatRp(rekap?.saldoTF)}</strong></div>
                <div className="flex justify-between border-t border-black mt-2 pt-1 font-bold"><span>TOTAL SALDO:</span> <span>{formatRp(rekap?.saldoAkhir)}</span></div>
            </div>
            <div className="border p-4 flex-1">
                <h3 className="font-bold mb-2 border-b border-black pb-1">OMSET PERIODE INI</h3>
                <div className="flex justify-between"><span>Total Penjualan:</span> <strong>{formatRp(rekap?.totalPenjualanKotor)}</strong></div>
                <div className="flex justify-between"><span>Porsi Terjual:</span> <strong>{rekap?.totalPorsi} Prs</strong></div>
                <div className="flex justify-between"><span>Piutang Baru:</span> <strong className="text-red-600">{formatRp(rekap?.totalPiutangBaru)}</strong></div>
            </div>
        </div>

        <h3 className="font-bold text-sm">A. TRANSAKSI PENJUALAN</h3>
        <table className="table-print">
          <thead><tr><th className="w-8">NO</th><th>NO. INV</th><th>PELANGGAN</th><th>VIA</th><th>QTY</th><th className="text-right">OMSET</th></tr></thead>
          <tbody>
            {(rekap?.listTransaksiDetail || []).map((c, i) => (
                <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="font-mono text-[9px]">{c.id}</td>
                    <td className="font-bold uppercase">{c.customer}</td>
                    <td className="text-center">{c.paymentMethod}</td>
                    <td className="text-center">{(c?.items || []).join(', ')}</td>
                    <td className="text-right">{formatRp(c.total)}</td>
                </tr>
            ))}
            {(!rekap?.listTransaksiDetail || rekap.listTransaksiDetail.length === 0) && <tr><td colSpan="6" className="text-center italic py-2">Nihil.</td></tr>}
            {/* TOTAL BAWAH TABEL */}
            {(rekap?.listTransaksiDetail || []).length > 0 && <tr><td colSpan="5" className="text-right font-bold">TOTAL KESELURUHAN</td><td className="text-right font-black">{formatRp(totalOmsetPenjualan)}</td></tr>}
          </tbody>
        </table>

        {rekap?.listExpenses?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mt-6">B. BUKU KAS (PENGELUARAN & CLOSING)</h3>
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
                        <td className={`text-right font-bold ${o.type==='IN'?'text-emerald-600':'text-red-600'}`}>{o.type==='IN'?'+':'-'}{formatRp(o.total)}</td>
                    </tr>
                ))}
                {/* TOTAL BAWAH TABEL */}
                <tr><td colSpan="5" className="text-right font-bold">TOTAL PENGELUARAN</td><td className="text-right font-black text-red-600">-{formatRp(totalPengeluaran)}</td></tr>
              </tbody>
            </table>
          </>
        )}

        {/* TABEL PELACAKAN PIUTANG PINTAR */}
        {rekap?.listPiutangBerjalan?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mt-6">C. DAFTAR PIUTANG PELANGGAN BERJALAN</h3>
            <table className="table-print text-[10px]">
              <thead><tr><th className="w-6">NO</th><th>TGL & INV</th><th>PELANGGAN</th><th>PESANAN</th><th className="text-right">TOTAL TAGIHAN</th><th>RIWAYAT PEMBAYARAN</th><th className="text-right">SISA HUTANG</th><th>STATUS</th></tr></thead>
              <tbody>
                 {rekap.listPiutangBerjalan.map((p, i) => (
                    <tr key={i}>
                       <td className="text-center">{i+1}</td>
                       <td>{formatDate(p.date)}<br/><span className="font-mono text-[9px]">{p.id}</span></td>
                       <td className="font-bold uppercase">{p.customer}</td>
                       <td className="text-center">{p.totalPcs} Pcs<br/>({p.totalPorsi} Prs)</td>
                       <td className="text-right font-bold">{formatRp(p.totalTagihan)}</td>
                       <td className="text-[9px]">
                          {p.paidAmount > 0 ? <div>DP Awal: {formatRp(p.paidAmount)}</div> : null}
                          {(p.riwayat || []).map((r, ri) => <div key={ri}>{formatDate(r.date)}: +{formatRp(r.amount)} ({r.paymentMethod})</div>)}
                          {p.paidAmount === 0 && (!p.riwayat || p.riwayat.length === 0) && <i className="text-gray-400">Belum ada cicilan</i>}
                       </td>
                       <td className="text-right font-bold text-red-600">{formatRp(p.sisaHutang)}</td>
                       <td className="text-center font-bold">
                          {p.sisaHutang <= 0 ? <span className="text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded">LUNAS</span> : <span className="text-red-600 bg-red-100 px-1 py-0.5 rounded">BELUM LUNAS</span>}
                       </td>
                    </tr>
                 ))}
              </tbody>
            </table>
          </>
        )}

        {/* TABEL PELACAKAN HUTANG SUPPLIER PINTAR */}
        {rekap?.listHutangBerjalan?.length > 0 && (
          <>
            <h3 className="font-bold text-sm mt-6">D. DAFTAR HUTANG KE SUPPLIER BERJALAN</h3>
            <table className="table-print text-[10px]">
              <thead><tr><th className="w-6">NO</th><th>TGL & INV</th><th>SUPPLIER</th><th>RINCIAN</th><th className="text-right">TOTAL TAGIHAN</th><th>RIWAYAT PEMBAYARAN</th><th className="text-right">SISA HUTANG</th><th>STATUS</th></tr></thead>
              <tbody>
                 {rekap.listHutangBerjalan.map((p, i) => (
                    <tr key={i}>
                       <td className="text-center">{i+1}</td>
                       <td>{formatDate(p.date)}<br/><span className="font-mono text-[9px]">{p.id}</span></td>
                       <td className="font-bold uppercase">{p.supplier || p.customer}</td>
                       <td><ul className="pl-3 m-0">{(p.items||[]).map((it, idx)=><li key={idx}>{it}</li>)}</ul></td>
                       <td className="text-right font-bold">{formatRp(p.totalTagihan)}</td>
                       <td className="text-[9px]">
                          {p.paidAmount > 0 ? <div>DP Awal: {formatRp(p.paidAmount)}</div> : null}
                          {(p.riwayat || []).map((r, ri) => <div key={ri}>{formatDate(r.date)}: +{formatRp(r.amount)} ({r.paymentMethod})</div>)}
                          {p.paidAmount === 0 && (!p.riwayat || p.riwayat.length === 0) && <i className="text-gray-400">Belum ada cicilan</i>}
                       </td>
                       <td className="text-right font-bold text-red-600">{formatRp(p.sisaHutang)}</td>
                       <td className="text-center font-bold">
                          {p.sisaHutang <= 0 ? <span className="text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded">LUNAS</span> : <span className="text-red-600 bg-red-100 px-1 py-0.5 rounded">BELUM LUNAS</span>}
                       </td>
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

export function PrintReportBranch({ data, onBack, user }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  const totalOmsetBranch = (rekap?.listOrders || []).reduce((sum, item) => sum + Number(item.total), 0);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: printStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      <div className="bg-white p-8 max-w-[210mm] mx-auto shadow-lg border border-gray-300">
        
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <div className="flex items-center gap-4"><img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-16 object-contain" /></div>
            <div className="text-right">
                <h1 className="text-xl font-black uppercase">LAPORAN OPERASIONAL CABANG {user?.name}</h1>
                <p className="text-xs">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
            </div>
        </div>

        <div className="flex gap-4 mb-6 text-sm">
            <div className="border p-4 flex-1">
                <h3 className="font-bold mb-2 border-b border-black pb-1">RINGKASAN PENJUALAN</h3>
                <div className="flex justify-between mb-1"><span>Omset Kotor:</span> <strong>{formatRp(rekap?.totalPenjualanKotor)}</strong></div>
                <div className="flex justify-between mb-1"><span>Porsi Terjual:</span> <strong>{rekap?.totalPorsi} Porsi</strong></div>
            </div>
            <div className="border p-4 flex-1">
                <h3 className="font-bold mb-2 border-b border-black pb-1">SETORAN PUSAT</h3>
                <div className="flex justify-between mb-1"><span>Total Disetor:</span> <strong>{formatRp(rekap?.setoranKePusat)}</strong></div>
                <div className="flex justify-between"><span>Status:</span> <strong>Transfer Bank</strong></div>
            </div>
        </div>

        <h3 className="font-bold text-sm">A. TRANSAKSI INVOICE CABANG</h3>
        <table className="table-print">
          <thead><tr><th className="w-8">NO</th><th>NO. INV</th><th>PELANGGAN</th><th>VIA</th><th>QTY</th><th className="text-right">TOTAL</th></tr></thead>
          <tbody>
            {(rekap?.listOrders || []).map((c, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="font-mono text-[9px]">{c.id}</td><td className="font-bold uppercase">{c.customer}</td><td className="text-center">{c.paymentMethod}</td><td className="text-center">{(c?.items||[]).join(', ')}</td><td className="text-right font-medium">{formatRp(c.total)}</td></tr>))}
            {/* TOTAL BAWAH TABEL */}
            {(rekap?.listOrders || []).length > 0 && <tr><td colSpan="5" className="text-right font-bold">TOTAL KESELURUHAN</td><td className="text-right font-black">{formatRp(totalOmsetBranch)}</td></tr>}
          </tbody>
        </table>

        <h3 className="font-bold text-sm mt-6">B. LAPORAN HARIAN & STOK</h3>
        <table className="table-print">
            <thead><tr><th className="w-8">NO</th><th>TGL</th><th className="text-center">PROD / PSN</th><th>STOK FREEZER</th><th className="text-center">TUJUAN TF</th><th className="text-right">UANG DISETOR</th></tr></thead>
            <tbody>{(rekap?.listReports || []).map((p, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="text-center">{formatDate(p.date)}</td><td className="text-center">{p.produksiMika}M / {p.pesananMika}M</td><td className="font-bold uppercase text-center">{p.stokFreezer}</td><td className="text-center font-bold text-indigo-700">{p.transferDestination || 'BCA (WASTAM)'}</td><td className="text-right font-bold text-emerald-700">{formatRp(p.nominal)}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

// === FUNGSI BAWAAN YANG AMAN (Hanya dipadatkan) ===
export function PrintVoucher({ data, onBack }) { useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []); return ( <div className="bg-slate-100 min-h-screen p-4"> <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} /> <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button> <div className="print-wrapper shadow-xl"> <div className="flex justify-between items-center mb-4 border-b border-black pb-2"> <div className="flex items-center gap-4"> <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-14 object-contain" /> <h1 className="font-black text-xl tracking-wide uppercase">Dimsum Aditya</h1> </div> <div className="text-right"> <h2 className="text-2xl font-black tracking-widest uppercase mb-1">VOUCHER KAS</h2> <p className="font-bold text-base">KAS KELUAR</p> </div> </div> <div className="flex justify-between gap-4 mb-4"> <div className="flex-1 box-solid"> <div className="flex mb-1.5"><span className="w-32 font-bold uppercase text-[10px]">Dibayarkan Kpd</span><span className="font-black uppercase text-sm">: {data.recipient}</span></div> <div className="flex mb-1.5"><span className="w-32 font-bold uppercase text-[10px]">Terbilang</span><span className="font-bold italic text-[10px]">: # {terbilang(data.total)} Rupiah #</span></div> <div className="flex"><span className="w-32 font-bold uppercase text-[10px]">Uang Sejumlah</span><span className="font-black text-base">: {formatRp(data.total)}</span></div> </div> <div className="w-1/3 box-solid flex flex-col justify-center"> <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">No. Ref</span> <span className="font-bold text-[10px]">{data.id}</span></div> <div className="flex justify-between mb-1.5"><span className="text-[10px] font-bold uppercase">Tanggal</span> <span className="font-bold text-[10px]">{formatDate(data.date)}</span></div> <div className="flex justify-between"><span className="text-[10px] font-bold uppercase">Metode</span> <span className="font-bold uppercase text-[10px]">{data.paymentMethod}</span></div> </div> </div> <table className="table-pro"> <thead> <tr> <th className="w-8">NO</th> <th className="text-left w-48">KATEGORI</th> <th className="text-left">KETERANGAN / RINCIAN</th> <th className="w-32 text-right">TOTAL</th> </tr> </thead> <tbody> <tr> <td className="font-bold">1</td> <td className="text-left font-bold uppercase">{data.category}</td> <td className="text-left">{data.description} (Qty: {data.qty})</td> <td className="text-right font-black">{formatRp(data.total)}</td> </tr> <tr><td className="py-4 border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td><td className="border-b-0"></td></tr> </tbody> </table> <div className="flex justify-between mt-8 text-center text-[10px]"> <div className="w-32"> <p className="font-bold uppercase">Dibuat Oleh,</p> <div className="h-12"></div> <p className="border-t border-black pt-1 uppercase">( Admin / Kasir )</p> </div> <div className="w-32"> <p className="font-bold uppercase">Disetujui Oleh,</p> <div className="h-12"></div> <p className="border-t border-black pt-1 uppercase">( Manajemen )</p> </div> <div className="w-32"> <p className="font-bold uppercase">Penerima,</p> <div className="h-12"></div> <p className="border-t border-black pt-1 uppercase">( {data.recipient} )</p> </div> </div> </div> </div> ); }
export function PrintPurchase({ data, onBack }) { useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []); return ( <div className="bg-slate-100 min-h-screen p-4"> <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} /> <button onClick={onBack} className="hide-on-print mb-4 bg-orange-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button> <div className="print-wrapper shadow-lg"> <div className="text-center border-b border-black pb-2 mb-4"><h2 className="font-black text-xl uppercase">BUKTI PEMBELIAN BAHAN</h2><p className="text-xs font-bold">No. Ref: {data.id} | Tgl: {formatDate(data.date)}</p></div> <div className="mb-4 text-xs box-solid flex justify-between"><p>Supplier: <span className="font-bold uppercase text-base">{data.supplier}</span></p><p>Metode Bayar: <strong>{data.paymentMethod}</strong></p></div> <table className="table-pro"> <thead><tr><th className="w-8">NO</th><th className="text-left">BARANG & SATUAN</th></tr></thead> <tbody>{(data.items || []).map((item, idx) => (<tr key={idx}><td>{idx + 1}</td><td className="text-left font-bold">{item}</td></tr>))}</tbody> </table> <div className="flex justify-end mt-2 text-xs"> <div className="w-64 box-solid"> <div className="flex justify-between font-bold mb-1.5"><span>TOTAL BELANJA</span><span className="text-sm">{formatRp(data.totalAll)}</span></div> <div className="flex justify-between font-bold border-t border-black pt-1.5"><span>DIBAYAR</span><span>{formatRp(data.paidAmount)}</span></div> </div> </div> <div className="mt-6 flex justify-end text-center text-xs"><div className="w-40"><p className="font-bold uppercase">Admin Pembelian,</p><div className="h-10"></div><p className="border-t border-black pt-1">( Dimsum Aditya )</p></div></div> </div> </div> ); }
export function PrintReceipt({ data, onBack }) { useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []); const { payment, order } = data; return ( <div className="bg-slate-100 min-h-screen p-4"> <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} /> <button onClick={onBack} className="hide-on-print mb-4 bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button> <div className="print-wrapper shadow-lg"> <div className="text-center border-b border-black pb-2 mb-6"><h2 className="font-black text-2xl uppercase">TANDA TERIMA {order.tipe === 'HUTANG' ? 'PEMBAYARAN' : 'CICILAN'}</h2><p className="font-bold text-xs">No. Ref: {payment.id} | Tgl: {formatDate(payment.date)}</p></div> <div className="text-xs box-solid"> <div className="flex mb-2"><span className="w-40 font-bold uppercase">{order.tipe === 'HUTANG' ? 'Dibayarkan Kepada:' : 'Diterima Dari:'}</span><span className="uppercase font-black text-sm">{order.customer}</span></div> <div className="flex mb-2"><span className="w-40 font-bold uppercase">Nominal Uang:</span><span className="font-black text-base">{formatRp(payment.amount)}</span></div> <div className="flex mb-2"><span className="w-40 font-bold uppercase">Untuk Pembayaran:</span><span className="font-bold">Cicilan Invoice No. {order.id}</span></div> <div className="flex"><span className="w-40 font-bold uppercase">Metode Pembayaran:</span><span className="font-bold">{payment.paymentMethod}</span></div> </div> <div className="mt-8 flex justify-end text-center text-xs"><div className="w-40"><p className="font-bold uppercase">Penerima,</p><div className="h-10"></div><p className="border-t border-black pt-1">( Dimsum Aditya )</p></div></div> </div> </div> ); }
