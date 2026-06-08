import React, { useEffect } from 'react';
import { formatDate, formatRp } from '../utils/helpers';

export default function PrintDotMatrix({ printData, onClose }) {
  useEffect(() => {
    if (printData) {
      setTimeout(() => {
        window.print();
      }, 500); 
    }
  }, [printData]);

  if (!printData) return null;

  const { type, data } = printData;

  return (
    <div id="print-section" className="fixed inset-0 z-[9999] bg-white text-black print-only-wrapper">
      
      {/* CSS UNIVERSAL UNTUK EPSON LX-310 (KERTAS SETENGAH LETTER) */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          @page { size: 8.5in 5.5in; margin: 0.15in; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: #000 !important; }
        }
        .dot-matrix-font { font-family: 'Courier New', Courier, monospace; color: #000; line-height: 1.3; }
        .dot-table th, .dot-table td { border: 1px solid #000; padding: 6px 8px; }
      `}</style>

      {/* ========================================================= */}
      {/* TEMPLATE 1: SURAT JALAN (DELIVERY ORDER) */}
      {/* ========================================================= */}
      {type === 'DO' && (
        <div className="dot-matrix-font p-2 w-[8.2in] mx-auto">
          <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-4">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-widest">DIMSUM ADITYA</h1>
              <p className="text-sm font-bold">Pusat Produksi & Distribusi F&B</p>
              <p className="text-xs mt-1">Sistem ERP Terintegrasi</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black uppercase">SURAT JALAN</h2>
              <div className="text-sm font-bold border border-black p-1 mt-1 inline-block">NO: {data.id}</div>
            </div>
          </div>

          <div className="flex justify-between mb-4 text-sm font-bold">
            <div className="space-y-1">
              <div><span className="inline-block w-24">TANGGAL</span>: {formatDate(data.date)}</div>
              <div><span className="inline-block w-24">PENGIRIM</span>: GUDANG PUSAT</div>
            </div>
            <div className="space-y-1">
              <div><span className="inline-block w-24">TUJUAN</span>: CABANG {data.to_branch}</div>
              <div><span className="inline-block w-24">STATUS</span>: {data.status}</div>
            </div>
          </div>

          <table className="w-full text-sm font-bold dot-table mb-6 text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-16 text-center">NO</th>
                <th>NAMA BARANG / DESKRIPSI</th>
                <th className="w-32 text-center">QTY (PCS)</th>
                <th className="w-40 text-center">KETERANGAN</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-center">1</td>
                <td className="uppercase">{data.item_name || 'DIMSUM FROZEN'}</td>
                <td className="text-center font-black text-lg">{Number(data.qty).toLocaleString('id-ID')}</td>
                <td></td>
              </tr>
              <tr><td className="py-4 border-b-0 border-t-0"></td><td className="border-b-0 border-t-0"></td><td className="border-b-0 border-t-0"></td><td className="border-b-0 border-t-0"></td></tr>
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-4 text-center text-sm font-bold mt-8">
            <div><p className="mb-12">Dibuat Oleh (Pusat),</p><p className="border-t border-black border-dashed pt-1 w-3/4 mx-auto">( .................... )</p></div>
            <div><p className="mb-12">Pengirim / Driver,</p><p className="border-t border-black border-dashed pt-1 w-3/4 mx-auto">( .................... )</p></div>
            <div><p className="mb-12">Diterima Oleh (Cabang),</p><p className="border-t border-black border-dashed pt-1 w-3/4 mx-auto">( .................... )</p></div>
          </div>
          <div className="mt-4 text-xs font-bold text-center border-t border-black pt-2">*Dokumen ini dicetak otomatis oleh Sistem ERP Dimsum Aditya. Harap simpan sesuai lembar peruntukan.</div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TEMPLATE 2: INVOICE PENJUALAN (OFFLINE & MARKETPLACE) */}
      {/* ========================================================= */}
      {type === 'INVOICE' && (
        <div className="dot-matrix-font p-2 w-[8.2in] mx-auto">
          <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-4">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-widest">DIMSUM ADITYA</h1>
              <p className="text-sm font-bold">{data.branch_id === 'PUSAT' ? 'PUSAT DISTRIBUSI' : `CABANG ${data.branch_id}`}</p>
              <p className="text-xs mt-1">Invoice Resmi Penjualan</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black uppercase">INVOICE / FAKTUR</h2>
              <div className="text-sm font-bold border border-black p-1 mt-1 inline-block">NO: {data.id}</div>
            </div>
          </div>

          <div className="flex justify-between mb-4 text-sm font-bold">
            <div className="space-y-1">
              <div><span className="inline-block w-24">TANGGAL</span>: {formatDate(data.date)}</div>
              <div><span className="inline-block w-24">PELANGGAN</span>: <span className="uppercase">{data.customer_name}</span></div>
            </div>
            <div className="space-y-1">
              <div><span className="inline-block w-28">SUMBER ORDER</span>: <span className="uppercase">{data.source}</span></div>
              <div><span className="inline-block w-28">PEMBAYARAN</span>: <span className="uppercase">{data.paymentMethod}</span></div>
            </div>
          </div>

          <table className="w-full text-sm font-bold dot-table mb-2 text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-12 text-center">NO</th>
                <th>DESKRIPSI BARANG</th>
                <th className="w-24 text-center">QTY</th>
                <th className="w-32 text-right">HARGA SATUAN</th>
                <th className="w-40 text-right">SUB TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-center">1</td>
                <td className="uppercase">{data.itemName}</td>
                <td className="text-center font-black">{data.qty} Pcs</td>
                <td className="text-right">{formatRp(data.price)}</td>
                <td className="text-right font-black">{formatRp(data.total)}</td>
              </tr>
              {/* Spacing estetika */}
              <tr><td className="py-2 border-b-0 border-t-0"></td><td className="border-b-0 border-t-0"></td><td className="border-b-0 border-t-0"></td><td className="border-b-0 border-t-0"></td><td className="border-b-0 border-t-0"></td></tr>
            </tbody>
          </table>

          {/* TOTAL & TERBILANG */}
          <div className="flex justify-end mb-6">
              <div className="w-1/2">
                  <div className="flex justify-between border-t-2 border-black pt-2 font-black text-lg">
                      <span>GRAND TOTAL:</span>
                      <span>{formatRp(data.total)}</span>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center text-sm font-bold mt-4 w-2/3 mx-auto">
            <div>
              <p className="mb-12">Kasir / Diserahkan Oleh,</p>
              <p className="border-t border-black border-dashed pt-1 w-3/4 mx-auto">( .................... )</p>
            </div>
            <div>
              <p className="mb-12">Pelanggan / Driver {data.source !== 'OFFLINE' ? data.source : ''},</p>
              <p className="border-t border-black border-dashed pt-1 w-3/4 mx-auto">( .................... )</p>
            </div>
          </div>
          
          <div className="mt-4 text-xs font-bold text-center border-t border-black pt-2">
            *Terima kasih telah berbelanja di Dimsum Aditya. Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.
          </div>
        </div>
      )}

      {/* TOMBOL TUTUP */}
      <div className="fixed top-4 right-4 print:hidden">
        <button onClick={onClose} className="bg-red-600 text-white font-bold px-6 py-2 rounded-lg shadow-lg hover:bg-red-700">Tutup Layar Cetak (X)</button>
      </div>
    </div>
  );
}
