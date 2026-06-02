import React, { useEffect } from 'react';
import { formatRp, formatDate, terbilang } from '../../utils/helpers';

// ============================================================================
// 1. TEMPLATE INVOICE & KUITANSI (DESAIN SESUAI GAMBAR)
// ============================================================================
const dotMatrixStyle = `
  @media print {
    @page { size: 9.5in 11in; margin: 0.3in; }
    body { font-family: Arial, sans-serif !important; font-size: 13px !important; color: #000; background: white; -webkit-print-color-adjust: exact; margin: 0; }
    .hide-on-print { display: none !important; }
  }
  .print-wrapper { max-width: 9.5in; margin: 0 auto; padding: 20px; background: white; font-family: Arial, sans-serif; color: black; }
  
  /* CSS KHUSUS TABEL SESUAI GAMBAR (Inner Dashed, Outer Solid) */
  .table-dotted { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid black; }
  .table-dotted th { border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; background: white; }
  .table-dotted td { border: 1px dashed black; padding: 8px; text-align: center; }
  .table-dotted tr td:first-child { border-left: 1px solid black; }
  .table-dotted tr td:last-child { border-right: 1px solid black; }
  .table-dotted tr:last-child td { border-bottom: 1px solid black; }
`;

export function PrintInvoiceDotMatrix({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-red-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-lg">
        {/* HEADER */}
        <div className="flex justify-between items-start mb-6">
          <div className="text-sm">
            <h1 className="font-bold text-lg mb-1">INVOICE DIMSUM ADITYA</h1>
            <p>Jl. Thamrin, RT.001/RW.003, Ketapang</p>
            <p>Kec. Cipondoh, Kota Tangerang, Banten 15147</p>
            <p>Telp/Wa : 087809020931, dimsumaditya@gmail.com</p>
          </div>
          <div>
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-20 object-contain" />
          </div>
        </div>

        {/* INFO INVOICE */}
        <div className="flex justify-between mb-4 text-sm">
          <div className="w-[45%]">
            <div className="flex mb-2"><span className="w-28 font-bold">No. Invoice</span><span className="flex-1 border-b border-dashed border-black">{data.id}</span></div>
            <div className="flex"><span className="w-28 font-bold">Kepada</span><span className="flex-1 border-b border-dashed border-black uppercase">{data.customer}</span></div>
          </div>
          <div className="w-[45%]">
            <div className="flex mb-2"><span className="w-32 font-bold">Tanggal</span><span className="flex-1 border-b border-dashed border-black text-right">{formatDate(data.date)}</span></div>
            <div className="flex"><span className="w-32 font-bold">Metode Bayar</span><span className="flex-1 border-b border-dashed border-black text-right">{data.paymentMethod}</span></div>
          </div>
        </div>

        {/* TABEL ITEM */}
        <table className="table-dotted text-sm">
          <thead>
            <tr>
              <th>KATEGORI</th>
              <th>QTY</th>
              <th>HARGA / Btr</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{data.category}</td>
              <td>{(data.items || []).join(', ')}</td>
              <td>{formatRp(data.price)}</td>
              <td><strong>{formatRp(data.totalAll)}</strong></td>
            </tr>
            {/* Baris Kosong untuk menyamai visual gambar */}
            {[1, 2, 3].map(i => <tr key={i}><td>&nbsp;</td><td></td><td></td><td></td></tr>)}
          </tbody>
        </table>

        {/* TERBILANG & TTD */}
        <div className="mt-1 text-sm italic border-b-0">TERBILANG : {terbilang(data.totalAll)} Rupiah</div>
        
        <div className="flex justify-between mt-12 text-center text-sm">
          <div className="w-48">
            <p className="mb-20">&nbsp;</p>
            <p className="border-t border-dashed border-black pt-1">Penerima / Pelanggan</p>
          </div>
          <div className="w-48">
            <p className="text-left mb-20">Hormat kami,</p>
            <p className="border-t border-dashed border-black pt-1">Admin / Kasir</p>
          </div>
        </div>

        {/* FOOTER BANK & WEB */}
        <div className="flex justify-between items-end mt-4 text-sm">
            <div className="font-bold">
                <p>BCA : 1320552261 (WASTAM)</p>
                <p>BRI : 775301006132536 (WASTAM)</p>
            </div>
            <div>
                <a href="https://dimsumaditya.id/" target="_blank" rel="noreferrer" className="text-black no-underline">www.dimsumaditya.id</a>
            </div>
        </div>
      </div>
    </div>
  );
}

export function PrintVoucher({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      
      <div className="print-wrapper shadow-lg">
        {/* HEADER */}
        <div className="flex justify-between items-start mb-6">
          <div className="mt-4">
            <h1 className="font-bold text-xl uppercase">BUKTI PENGELUARAN KAS - DIMSUM ADITYA</h1>
          </div>
          <div>
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="h-20 object-contain" />
          </div>
        </div>

        {/* INFO VOUCHER */}
        <div className="flex justify-between mb-4 text-sm">
          <div className="w-[45%]">
            <div className="flex mb-2"><span className="w-28 font-bold">ID Voucher</span><span className="flex-1 border-b border-dashed border-black">{data.id}</span></div>
            <div className="flex"><span className="w-28 font-bold">Kepada</span><span className="flex-1 border-b border-dashed border-black uppercase">{data.recipient}</span></div>
          </div>
          <div className="w-[40%]">
            <div className="flex"><span className="w-24 font-bold">Tanggal</span><span className="flex-1 border-b border-dashed border-black text-right">{formatDate(data.date)}</span></div>
          </div>
        </div>

        {/* TABEL ITEM */}
        <table className="table-dotted text-sm">
          <thead>
            <tr>
              <th>KATEGORI</th>
              <th>KETERANGAN</th>
              <th>QTY</th>
              <th>HARGA</th>
              <th>TOTAL (KAS KELUAR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{data.category}</td>
              <td>{data.description}</td>
              <td>{data.qty}</td>
              <td>{formatRp(data.price)}</td>
              <td><strong>{formatRp(data.total)}</strong></td>
            </tr>
            {[1, 2, 3].map(i => <tr key={i}><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>)}
          </tbody>
        </table>

        {/* TERBILANG & TTD */}
        <div className="mt-1 text-sm italic">TERBILANG : {terbilang(data.total)} Rupiah</div>
        
        <div className="flex justify-between mt-16 text-center text-sm">
          <div className="w-48">
            <p className="mb-20">&nbsp;</p>
            <p className="border-t border-dashed border-black pt-1">Penerima / Pelanggan</p>
          </div>
          <div className="w-48">
            <p className="text-left mb-20">Hormat kami,</p>
            <p className="border-t border-dashed border-black pt-1">Admin / Kasir</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// === TEMPLATE LAINNYA (SISA YANG TIDAK DIUBAH) ===
export function PrintPurchase({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-orange-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button>
      <div className="print-wrapper shadow-lg">
        <div className="text-center border-b-2 border-black pb-2 mb-4"><h2 className="font-bold text-lg">BUKTI PEMBELIAN BAHAN (RESTOCK)</h2><p className="text-xs">No. Ref: {data.id} | Tgl: {formatDate(data.date)}</p></div>
        <div className="mb-3 text-sm"><p>Supplier / Toko: <span className="font-bold uppercase text-base">{data.supplier}</span></p><p>Metode Bayar: {data.paymentMethod}</p></div>
        <table className="w-full text-left table-dotted">
          <thead><tr><th className="w-8 text-center">NO</th><th>BARANG & SATUAN</th></tr></thead>
          <tbody>{(data.items || []).map((item, idx) => (<tr key={idx}><td className="text-center">{idx + 1}</td><td>{item}</td></tr>))}</tbody>
        </table>
        <div className="flex justify-end mt-4 text-sm">
          <div className="w-64 border-t border-black pt-1">
            <div className="flex justify-between font-bold"><span>TOTAL BELANJA:</span><span>{formatRp(data.totalAll)}</span></div>
            <div className="flex justify-between"><span>DIBAYAR:</span><span>{formatRp(data.paidAmount)}</span></div>
          </div>
        </div>
        <div className="mt-8 flex justify-end text-center text-sm"><div className="w-40"><p className="mb-10">Admin Pembelian,</p><p className="border-t border-black pt-1">( Dimsum Aditya )</p></div></div>
      </div>
    </div>
  );
}

export function PrintReceipt({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { payment, order } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: dotMatrixStyle }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-md">Kembali</button>
      <div className="print-wrapper shadow-lg">
        <div className="text-center border-b-2 border-black pb-2 mb-4"><h2 className="font-bold text-lg">TANDA TERIMA {order.tipe === 'HUTANG' ? 'PEMBAYARAN HUTANG' : 'CICILAN PIUTANG'}</h2><p className="text-xs">No. Ref: {payment.id} | Tgl: {formatDate(payment.date)}</p></div>
        <div className="text-sm space-y-2 mb-4 border border-black p-3">
          <div className="flex"><span className="w-40 font-bold">{order.tipe === 'HUTANG' ? 'Dibayarkan Kepada:' : 'Diterima Dari:'}</span><span className="uppercase font-bold">{order.customer}</span></div>
          <div className="flex"><span className="w-40 font-bold">Nominal Cicilan:</span><span className="font-bold text-base">{formatRp(payment.amount)}</span></div>
          <div className="flex"><span className="w-40 font-bold">Untuk Pembayaran:</span><span>Invoice No. {order.id}</span></div>
          <div className="flex"><span className="w-40 font-bold">Metode:</span><span>{payment.paymentMethod}</span></div>
        </div>
        <div className="mt-12 flex justify-end text-center text-sm"><div className="w-40"><p className="mb-10">Penerima,</p><p className="border-t border-black pt-1">( Dimsum Aditya )</p></div></div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. TEMPLATE LAPORAN HARIAN (KHUSUS A4 - MARGIN PADAT & HEMAT KERTAS)
// ============================================================================
const a4Style = `
  @media print { 
    @page { size: A4 portrait; margin: 10mm; } 
    body { font-family: Arial, sans-serif; font-size: 10px; color: black; background: white; margin: 0; padding: 0; -webkit-print-color-adjust: exact; } 
    .hide-on-print { display: none !important; } 
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; } 
    th, td { padding: 3px 4px !important; border: 1px solid black !important; line-height: 1.1; } 
    th { background-color: #f3f4f6 !important; font-weight: bold; }
    h1 { font-size: 16px; margin: 0 0 4px 0; } 
    h3 { font-size: 12px; margin: 12px 0 4px 0; } 
    p { margin: 2px 0; }
    .grid-summary { display: flex; gap: 10px; margin-bottom: 10px; }
    .grid-summary > div { flex: 1; border: 1px solid black; padding: 6px; }
  }
  .a4-wrapper { max-width: 210mm; margin: 0 auto; background: white; padding: 20px; color: black; font-family: Arial, sans-serif; font-size: 12px; }
`;

export function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      <div className="a4-wrapper shadow-lg">
        <div className="text-center border-b-2 border-black pb-2 mb-4">
            <h1 className="font-bold uppercase">Laporan Keuangan & Penjualan Pusat</h1>
            <p className="text-gray-700">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
        </div>
        <div className="grid-summary">
            <div><h3 className="border-b border-black pb-1 mb-2 mt-0">SALDO AKTUAL BERJALAN</h3><div className="flex justify-between"><span>Tunai (CASH):</span> <strong>{formatRp(rekap?.saldoCash)}</strong></div><div className="flex justify-between"><span>Rekening (TF):</span> <strong>{formatRp(rekap?.saldoTF)}</strong></div><div className="flex justify-between border-t border-black mt-1 pt-1"><span>TOTAL SALDO:</span> <strong>{formatRp(rekap?.saldoAkhir)}</strong></div></div>
            <div><h3 className="border-b border-black pb-1 mb-2 mt-0">OMSET PERIODE INI</h3><div className="flex justify-between"><span>Total Penjualan:</span> <strong>{formatRp(rekap?.totalPenjualanKotor)}</strong></div><div className="flex justify-between"><span>Porsi Terjual:</span> <strong>{rekap?.totalPorsi} Prs</strong></div><div className="flex justify-between"><span>Piutang Baru:</span> <strong>{formatRp(rekap?.totalPiutangBaru)}</strong></div></div>
        </div>

        <h3>A. TRANSAKSI PENJUALAN</h3>
        <table>
          <thead><tr><th className="w-6 text-center">NO</th><th>NO. INV</th><th>PELANGGAN</th><th>KATEGORI</th><th>VIA</th><th>QTY</th><th className="text-right">OMSET</th></tr></thead>
          <tbody>
            {(rekap?.listTransaksiDetail || []).map((c, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="font-mono text-[9px]">{c.id}</td><td className="font-bold uppercase">{c.customer}</td><td>{c.category}</td><td>{c.paymentMethod}</td><td>{(c?.items || []).join(', ')}</td><td className="text-right font-medium">{formatRp(c.total)}</td></tr>))}
            {(!rekap?.listTransaksiDetail || rekap.listTransaksiDetail.length === 0) && <tr><td colSpan="7" className="text-center italic">Nihil.</td></tr>}
          </tbody>
        </table>

        {rekap?.listExpenses?.length > 0 && (
          <>
            <h3>B. BUKU KAS (PENGELUARAN & CLOSING)</h3>
            <table>
              <thead><tr><th className="w-6 text-center">NO</th><th>TANGGAL</th><th>KATEGORI</th><th>KETERANGAN</th><th>VIA</th><th className="text-right">NOMINAL</th></tr></thead>
              <tbody>{rekap.listExpenses.map((o, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td>{formatDate(o.date)}</td><td className="font-bold uppercase">{o.category}</td><td>{o.description}</td><td>{o.paymentMethod}</td><td className="text-right font-bold">{o.type==='IN'?'+':'-'}{formatRp(o.total)}</td></tr>))}</tbody>
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
  return (
    <div className="bg-slate-100 min-h-screen p-4">
      <style dangerouslySetInnerHTML={{ __html: a4Style }} />
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded font-bold shadow-md">Kembali ke Aplikasi</button>
      <div className="a4-wrapper shadow-lg">
        <div className="text-center border-b-2 border-black pb-2 mb-4">
            <h1 className="font-bold uppercase">Laporan Operasional {user?.name}</h1>
            <p className="text-gray-700">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
        </div>
        <div className="grid-summary">
            <div><h3 className="border-b border-black pb-1 mb-2 mt-0">RINGKASAN PENJUALAN</h3><div className="flex justify-between"><span>Omset Kotor:</span> <strong>{formatRp(rekap?.totalPenjualanKotor)}</strong></div><div className="flex justify-between"><span>Porsi Terjual:</span> <strong>{rekap?.totalPorsi} Porsi</strong></div></div>
            <div><h3 className="border-b border-black pb-1 mb-2 mt-0">SETORAN PUSAT</h3><div className="flex justify-between"><span>Total Disetor:</span> <strong>{formatRp(rekap?.setoranKePusat)}</strong></div><div className="flex justify-between"><span>Status:</span> <strong>Transfer Bank</strong></div></div>
        </div>

        <h3>A. TRANSAKSI INVOICE CABANG</h3>
        <table>
          <thead><tr><th className="w-6 text-center">NO</th><th>NO. INV</th><th>PELANGGAN</th><th>VIA</th><th>QTY</th><th className="text-right">TOTAL</th></tr></thead>
          <tbody>{(rekap?.listOrders || []).map((c, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td className="font-mono text-[9px]">{c.id}</td><td className="font-bold uppercase">{c.customer}</td><td>{c.paymentMethod}</td><td>{(c?.items||[]).join(', ')}</td><td className="text-right font-medium">{formatRp(c.total)}</td></tr>))}</tbody>
        </table>

        <h3>B. LAPORAN HARIAN & STOK</h3>
        <table>
            <thead><tr><th className="w-6 text-center">NO</th><th>TGL</th><th className="text-center">PROD / PSN</th><th>STOK FREEZER</th><th className="text-center">TUJUAN TF</th><th className="text-right">UANG DISETOR</th></tr></thead>
            <tbody>{(rekap?.listReports || []).map((p, i) => (<tr key={i}><td className="text-center">{i + 1}</td><td>{formatDate(p.date)}</td><td className="text-center">{p.produksiMika}M / {p.pesananMika}M</td><td className="font-bold uppercase">{p.stokFreezer}</td><td className="text-center">{p.transferDestination || 'BCA (WASTAM)'}</td><td className="text-right font-bold">{formatRp(p.nominal)}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
