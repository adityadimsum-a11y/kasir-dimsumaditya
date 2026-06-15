import React from 'react';
import { Printer, X } from 'lucide-react';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function PrintDotMatrix({ printData, onClose }) {
  // Jika tidak ada data yang dilempar, jangan tampilkan apa-apa
  if (!printData) return null;

  // Fungsi untuk trigger print native browser secara manual
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:bg-white print:backdrop-blur-none">
      
      {/* KOTAK MODAL PREVIEW (Menyembunyikan kotak ini saat proses print berlangsung) */}
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-md overflow-hidden max-h-[90vh] print:shadow-none print:border-none">
        
        {/* HEADER MODAL - Disembunyikan saat print */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0 no-print">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm normal-case">
            <Printer size={16} className="text-red-600" />
            Pratinjau Nota (Preview)
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* AREA SCROLL PREVIEW */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-100 flex justify-center print:p-0 print:bg-white">
          
          {/* ========================================================= */}
          {/* AREA KERTAS NOTA (Hanya area ini yang akan masuk ke printer) */}
          {/* ========================================================= */}
          <div id="print-section" className="bg-white shadow-sm border border-slate-200 p-6 w-[80mm] min-h-[100mm] text-black font-mono text-[11px] leading-tight print:shadow-none print:border-none">
            
            {/* SUNTIKAN CSS KHUSUS PRINTER */}
            <style type="text/css" media="print">
              {`
                @page { size: auto; margin: 0mm; }
                body { background-color: #ffffff; margin: 0; padding: 0; }
                
                /* Sembunyikan semua elemen di layar */
                body * { visibility: hidden; }
                
                /* Tampilkan hanya area id print-section */
                #print-section, #print-section * { visibility: visible; }
                
                /* Posisikan nota tepat di pojok kiri atas kertas printer */
                #print-section { 
                  position: absolute; 
                  left: 0; 
                  top: 0; 
                  width: 76mm; /* Ukuran kertas struk kasir termal/dotmatrix standar */
                  padding: 5mm;
                  margin: 0;
                }
                
                /* Class khusus untuk menyembunyikan tombol saat di-print */
                .no-print { display: none !important; }
              `}
            </style>

            {/* HEADER NOTA */}
            <div className="text-center mb-4">
              <h2 className="font-bold text-sm uppercase">DIMSUM ADITYA</h2>
              <div className="text-[10px] mt-1 uppercase">{printData.branch_name?.replace(/_/g, ' ')}</div>
              <div className="text-[10px] border-b border-dashed border-black pb-2 mt-1 mb-2 font-bold uppercase">
                {printData.title || 'BUKTI TRANSAKSI'}
              </div>
            </div>

            {/* INFO TRANSAKSI */}
            <div className="space-y-1 mb-3 uppercase">
              <div className="flex justify-between"><span>No:</span> <span>{printData.id}</span></div>
              <div className="flex justify-between"><span>Tgl:</span> <span>{printData.date}</span></div>
              <div className="flex justify-between"><span>Opr:</span> <span>{printData.admin_name}</span></div>
              {printData.customer_name && (
                <div className="flex justify-between"><span>Plg:</span> <span>{printData.customer_name}</span></div>
              )}
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* DAFTAR ITEM */}
            <div className="space-y-2 mb-3 uppercase">
              {printData.items?.map((item, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="font-bold whitespace-pre-wrap">{item.name}</div>
                  <div className="flex justify-between mt-0.5">
                    <span>{formatNumber(item.qty)} x {item.price ? formatNumber(item.price) : ''}</span>
                    <span className="font-bold">{formatNumber(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-black my-2"></div>

            {/* TOTAL */}
            <div className="flex justify-between font-bold text-xs mb-1 uppercase">
              <span>TOTAL:</span>
              <span>{formatNumber(printData.amount)}</span>
            </div>
            
            {printData.paymentMethod && (
              <div className="flex justify-between mb-3 uppercase text-[10px]">
                <span>Metode:</span>
                <span>{printData.paymentMethod}</span>
              </div>
            )}

            {/* HISTORY SECTION (Khusus Mutasi/Produksi/Stok) */}
            {printData.history && (
              <div className="mt-4 pt-2 border-t border-dotted border-black uppercase text-[9px]">
                <div className="text-center font-bold mb-2">RINGKASAN SISTEM</div>
                <div className="flex justify-between"><span>{printData.history.labelLama}:</span> <span>{printData.history.nominalLama}</span></div>
                <div className="flex justify-between"><span>{printData.history.labelAksi}:</span> <span>{printData.history.nominalAksi}</span></div>
                <div className="flex justify-between font-bold mt-1"><span>{printData.history.labelBaru}:</span> <span>{printData.history.nominalBaru}</span></div>
              </div>
            )}

            {/* FOOTER NOTA */}
            <div className="border-t border-dashed border-black my-3 pt-3 text-center space-y-1 uppercase">
              <div className="font-bold">Terima Kasih</div>
              <div className="text-[8px]">Sistem Terintegrasi Dimsum Aditya</div>
            </div>

          </div>
          {/* ========================================================= */}
          
        </div>

        {/* FOOTER MODAL & TOMBOL - Disembunyikan saat print */}
        <div className="p-4 bg-white border-t border-slate-200 flex gap-3 shrink-0 no-print">
          <button 
            type="button"
            onClick={onClose} 
            className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs normal-case cursor-pointer"
          >
            Tutup Preview
          </button>
          <button 
            type="button"
            onClick={handlePrint} 
            className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-xs shadow-md normal-case cursor-pointer"
          >
            <Printer size={16} /> Cetak Sekarang
          </button>
        </div>

      </div>
    </div>
  );
}
