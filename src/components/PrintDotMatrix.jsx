import React from 'react';
import { Printer, X } from 'lucide-react';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function PrintDotMatrix({ printData, onClose }) {
  // Jika tidak ada data yang dilempar, jangan render apa-apa
  if (!printData) return null;

  // Fungsi khusus untuk trigger dialog printer tanpa menutup layar modal
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      
      {/* KOTAK MODAL PREVIEW */}
      <div className="bg-slate-100 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-slate-300">
        
        {/* HEADER MODAL (Tombol-tombol ini TIDAK akan ikut tercetak) */}
        <div className="bg-white p-4 flex justify-between items-center border-b border-slate-200 shrink-0 no-print">
          <div>
            <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider">Mode Preview Nota</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">Periksa nota sebelum dicetak ke printer Dot Matrix / Thermal.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-md transition-all active:scale-95">
              <Printer size={16} /> Cetak Sekarang
            </button>
            <button onClick={onClose} className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2.5 rounded-xl transition-all border border-rose-200" title="Tutup Preview">
              <X size={16} strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* AREA KERTAS NOTA (Ini yang akan murni tercetak ke kertas) */}
        <div className="p-6 overflow-y-auto flex justify-center bg-slate-200/50 custom-scrollbar flex-1">
          
          <div 
            id="printable-receipt" 
            className="bg-white p-8 shadow-sm border border-slate-300 text-black font-mono text-xs w-full max-w-[14cm] min-h-[10cm] mx-auto leading-relaxed"
          >
            {/* HEADER NOTA */}
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold tracking-widest uppercase mb-1">=== DIMSUM ADITYA ===</h1>
              <div className="text-[10px] uppercase">Grosir & Distribusi Area {printData.branch_name || 'Pusat'}</div>
              <div className="text-[10px] uppercase">Tgl Cetak: {printData.date}</div>
            </div>

            <div className="border-b-2 border-dashed border-black mb-3"></div>

            {/* META DATA TRANSAKSI */}
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
              <div>
                <span className="inline-block w-20">No. Inv</span>: {printData.id}
              </div>
              <div>
                <span className="inline-block w-20">Pelanggan</span>: <span className="font-bold">{printData.customer_name}</span>
              </div>
              <div>
                <span className="inline-block w-20">Kasir/Admin</span>: {printData.admin_name}
              </div>
              <div>
                <span className="inline-block w-20">Jalur Bayar</span>: {printData.paymentMethod}
              </div>
            </div>

            <div className="border-b-2 border-dashed border-black mb-3"></div>

            {/* RINCIAN ITEM */}
            <div className="text-[11px] uppercase tracking-wide mb-1 font-bold">Rincian Pembelian:</div>
            <table className="w-full text-[11px] mb-4">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-1 text-left w-3/5 font-normal">Deskripsi Item</th>
                  <th className="py-1 text-center w-1/5 font-normal">Qty</th>
                  <th className="py-1 text-right w-1/5 font-normal">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(printData.items || []).map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-1.5">{item.name}</td>
                    <td className="py-1.5 text-center">{item.qty}</td>
                    <td className="py-1.5 text-right">{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* SUMMARY KEUANGAN */}
            <div className="flex justify-end mt-4 text-[11px]">
              <div className="w-64 space-y-1.5">
                {/* Riwayat Bon / Pembayaran */}
                {printData.history && (
                  <>
                    <div className="flex justify-between">
                      <span>{printData.history.labelLama}:</span>
                      <span className="font-bold">{formatRupiah(printData.history.nominalLama)}</span>
                    </div>
                    <div className="flex justify-between text-black">
                      <span>{printData.history.labelAksi}:</span>
                      <span>{formatRupiah(printData.history.nominalAksi)}</span>
                    </div>
                    <div className="border-b border-black my-1"></div>
                    <div className="flex justify-between font-bold">
                      <span>{printData.history.labelBaru}:</span>
                      <span>{formatRupiah(printData.history.nominalBaru)}</span>
                    </div>
                  </>
                )}
                {!printData.history && (
                  <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
                    <span>GRAND TOTAL:</span>
                    <span>{formatRupiah(printData.amount)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-b-2 border-dashed border-black mt-6 mb-4"></div>

            {/* FOOTER */}
            <div className="text-center text-[10px]">
              <div>*** TERIMA KASIH ***</div>
              <div className="mt-1 uppercase text-[9px]">Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</div>
              <div className="mt-1 font-bold text-[9px] uppercase">{printData.title}</div>
            </div>
          </div>
          
        </div>
      </div>

      {/* 🔥 CSS SAKTI KHUSUS PRINT */}
      <style>{`
        /* Sembunyikan scrollbar di layar preview biar rapi */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }

        @media print {
          /* Saat print, sembunyikan SEMUA elemen di layar React/Website */
          body * { 
            visibility: hidden !important; 
          }
          
          /* Tapi, tampilkan KEMBALI area kertas nota kita */
          #printable-receipt, #printable-receipt * { 
            visibility: visible !important; 
          }
          
          /* Atur posisi nota jadi ke ujung kiri atas kertas printer */
          #printable-receipt { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            max-width: none !important;
            margin: 0 !important; 
            padding: 10px !important; 
            border: none !important;
            box-shadow: none !important;
          }

          /* Hilangkan elemen yang punya class .no-print */
          .no-print {
            display: none !important;
          }

          /* Aturan margin kertas printer bawaan browser */
          @page { 
            size: auto; 
            margin: 5mm; 
          }
        }
      `}</style>
    </div>
  );
}
