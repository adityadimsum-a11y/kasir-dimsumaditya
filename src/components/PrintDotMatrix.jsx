import React, { useEffect } from 'react';

export default function PrintDotMatrix({ printData, onClose }) {
  useEffect(() => {
    if (printData) {
      const timer = setTimeout(() => {
        window.print();
      }, 300);
      
      const handleAfterPrint = () => {
        if (onClose) onClose();
      };
      
      window.addEventListener('afterprint', handleAfterPrint);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [printData, onClose]);

  if (!printData) return null;

  // Tarik data dengan dukungan parameter khusus Work Order
  const { 
    title = 'INVOICE', id = '-', date = '-', branch_name = '-', admin_name = '-', 
    customer_name = '-', items = [], amount = 0, paymentMethod = '-', footerCustom = '',
    isWorkOrder = false, qty = 0, channel = '', customRequest = '', notes = ''
  } = printData;

  const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
  const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

  return (
    <div className="fixed inset-0 bg-white z-[99999] print-container text-black font-mono overflow-y-auto">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          @page { size: auto; margin: 5mm; }
        }
      `}</style>
      
      <div className="max-w-[80mm] md:max-w-3xl mx-auto p-4 md:p-8 text-xs md:text-sm print:max-w-full print:p-2 bg-white">
        
        {/* HEADER PERUSAHAAN */}
        <div className="text-center font-black uppercase mb-1 text-base md:text-xl tracking-widest">DIMSUM ADITYA</div>
        <div className="text-center font-bold uppercase mb-4 text-[10px] md:text-xs">CABANG OPERASIONAL {branch_name}</div>
        
        <div className={`text-center font-black uppercase underline tracking-wider mb-4 ${isWorkOrder ? 'text-lg md:text-2xl' : 'md:text-lg'}`}>
          {title}
        </div>
        
        <div className="border-t-2 border-dashed border-black mb-2"></div>
        
        <div className="grid grid-cols-2 gap-2 mb-2 font-bold text-[10px] md:text-xs uppercase">
          <div>
            <div>NO. TRX : {id}</div>
            <div className={isWorkOrder ? "text-lg md:text-3xl font-black mt-2" : "mt-1"}>NAMA : {customer_name}</div>
          </div>
          <div className="text-right">
            <div>TGL TRX : {date}</div>
            <div className="mt-1">ADMIN : {admin_name}</div>
          </div>
        </div>

        <div className="border-t-2 border-dashed border-black mb-4"></div>

        {/* =========================================
            CABANG LOGIKA: JIKA TIKET PABRIK
        ========================================= */}
        {isWorkOrder ? (
          <div className="space-y-6 my-6">
            
            <div className="text-center border-4 border-black p-4">
              <div className="text-sm md:text-lg font-black uppercase mb-1 tracking-widest">JUMLAH PRODUKSI (QTY)</div>
              <div className="text-5xl md:text-7xl font-black">{formatNumber(qty)} <span className="text-2xl">PCS</span></div>
            </div>

            <div className="space-y-2">
              <div className="font-black uppercase text-xs md:text-sm">CHANNEL PENJUALAN / KATEGORI:</div>
              <div className="text-lg md:text-2xl font-black uppercase bg-gray-100 p-2 inline-block border border-black">{channel}</div>
            </div>

            <div className="space-y-2">
              <div className="font-black uppercase text-xs md:text-sm">⚠️ SPESIFIKASI REQUEST:</div>
              <div className="text-2xl md:text-4xl font-black uppercase border-4 border-black p-4">
                {customRequest}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-black uppercase text-xs md:text-sm">CATATAN TAMBAHAN (NOTES):</div>
              <div className="text-lg md:text-2xl font-bold uppercase border-l-4 border-black pl-3 py-2">
                {notes || "TIDAK ADA CATATAN TAMBAHAN"}
              </div>
            </div>

          </div>
        ) : (
          /* =========================================
             CABANG LOGIKA: JIKA NOTA KASIR/INVOICE
          ========================================= */
          <>
            <table className="w-full mb-2 text-[10px] md:text-xs">
              <thead className="border-b-2 border-dashed border-black">
                <tr className="text-left font-black">
                  <th className="py-2">KETERANGAN</th>
                  <th className="py-2 text-center">QTY</th>
                  <th className="py-2 text-right">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-dashed border-gray-400">
                    <td className="py-2 whitespace-pre-wrap">{item.name}</td>
                    <td className="py-2 text-center">{formatNumber(item.qty)}{item.suffix || ''}</td>
                    <td className="py-2 text-right">{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-black mt-4 text-sm md:text-base">
              <span>TOTAL TAGIHAN :</span>
              <span>{formatRupiah(amount)}</span>
            </div>
          </>
        )}

        <div className="border-t-2 border-dashed border-black my-4"></div>

        <div className="text-right font-bold text-[10px] md:text-xs uppercase mb-8">
          <div>STATUS/TIPE : {paymentMethod}</div>
        </div>

        {/* TANDA TANGAN */}
        <div className="grid grid-cols-2 text-center font-bold text-[10px] md:text-xs uppercase">
          <div>
            <div className="mb-12">{isWorkOrder ? "KEPALA PRODUKSI," : "PENERIMA / KLIEN,"}</div>
            <div className="underline">_________________</div>
          </div>
          <div>
            <div className="mb-12">HORMAT KAMI,</div>
            <div className="underline">{admin_name}</div>
          </div>
        </div>

        {footerCustom && (
          <div className="mt-8 text-center text-[10px] md:text-xs font-bold uppercase whitespace-pre-wrap border-t border-black pt-4">
            {footerCustom}
          </div>
        )}
        
        <div className="mt-4 text-center text-[9px] text-gray-500 italic">-- Dokumen sah Sistem ERP Dimsum Aditya --</div>
      </div>
    </div>
  );
}
