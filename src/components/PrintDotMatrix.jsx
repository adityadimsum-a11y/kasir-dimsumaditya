import React, { useEffect } from 'react';

export default function PrintDotMatrix({ printData, onClose }) {
  useEffect(() => {
    if (printData) {
      const timer = setTimeout(() => { window.print(); }, 300);
      const handleAfterPrint = () => { if (onClose) onClose(); };
      window.addEventListener('afterprint', handleAfterPrint);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [printData, onClose]);

  if (!printData) return null;

  const { title = 'INVOICE', id = '-', date = '-', branch_name = '-', admin_name = '-', customer_name = '-', items = [], amount = 0, paymentMethod = '-' } = printData;

  const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
  const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

  // AUTOMATIC MODE DETECTOR BERDASARKAN JUDUL & ID BYPASS
  const isProductionTicket = title.includes('PRODUKSI') || title.includes('YIELD') || id.startsWith('PRD-');
  const isWorkOrderTicket = title.includes('WORK ORDER') || title.includes('MANIFEST') || id.startsWith('WO-');

  // Dekompresi data bypass jika menggunakan separator ::
  let trueId = id;
  let pAdukan = "0", pAyam = "0", pYield = "0", pNotes = "-";
  let woQty = "0", woChannel = "-", woRequest = "-", woNotes = "-";

  if (id.includes('::')) {
    const parts = id.split('::');
    trueId = parts[0];
    if (isProductionTicket) {
      pAdukan = parts[1]; pAyam = parts[2]; pYield = parts[3]; pNotes = parts[4];
    } else if (isWorkOrderTicket) {
      woQty = parts[1]; woChannel = parts[2]; woRequest = parts[3]; woNotes = parts[4];
    }
  }

  return (
    <div className="fixed inset-0 bg-white z-[99999] print-container text-black font-mono overflow-y-auto">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          @page { size: auto; margin: 3mm; }
        }
      `}</style>
      
      <div className="max-w-[80mm] md:max-w-xl mx-auto p-4 text-xs print:max-w-full print:p-1 bg-white">
        <div className="text-center font-black uppercase mb-1 text-sm md:text-base tracking-widest">DIMSUM ADITYA</div>
        <div className="text-center font-bold text-[9px] uppercase mb-2">LOKASI: {branch_name}</div>
        <div className="text-center font-black uppercase underline text-xs md:text-sm tracking-wider mb-3">{title}</div>
        <div className="border-t border-dashed border-black mb-2"></div>
        
        <div className="grid grid-cols-2 gap-1 mb-2 font-bold text-[9px] uppercase">
          <div>
            <div>NO. DOC : {trueId}</div>
            <div className="mt-0.5">NAMA : {customer_name}</div>
          </div>
          <div className="text-right">
            <div>TANGGAL : {date}</div>
            <div className="mt-0.5">PETUGAS : {admin_name}</div>
          </div>
        </div>
        <div className="border-t border-dashed border-black mb-3"></div>

        {/* MODE 1: NOTA PRODUKSI PABRIK */}
        {isProductionTicket ? (
          <div className="space-y-4 my-2">
            <div className="grid grid-cols-2 gap-2">
               <div className="border border-black p-2 text-center">
                 <div className="text-[9px] font-black uppercase">TOTAL ADUKAN</div>
                 <div className="text-xl font-black">{pAdukan} BATCH</div>
               </div>
               <div className="border border-black p-2 text-center">
                 <div className="text-[9px] font-black uppercase">AYAM TERPAKAI</div>
                 <div className="text-xl font-black">{formatNumber(pAyam)} KG</div>
               </div>
            </div>
            <div className="border-2 border-black p-3 text-center bg-gray-50">
               <div className="text-[10px] font-black uppercase mb-0.5">YIELD PRODUKSI MASUK FREEZER</div>
               <div className="text-3xl font-black">{formatNumber(pYield)} PCS</div>
            </div>
            <div className="text-[10px] font-bold uppercase border-l-2 border-black pl-2 py-1">
              KETERANGAN: {pNotes}
            </div>
          </div>
        ) : 
        /* MODE 2: WORK ORDER PRE-ORDER DAPUR */
        isWorkOrderTicket ? (
          <div className="space-y-4 my-2">
            <div className="border-2 border-black p-3 text-center">
              <div className="text-[10px] font-black uppercase mb-0.5 tracking-wider">JUMLAH WAJIB MASAK (QTY)</div>
              <div className="text-4xl font-black">{formatNumber(woQty)} PCS</div>
            </div>
            <div className="grid grid-cols-1 gap-1 text-[10px] uppercase font-bold">
              <div>CHANNEL ASAL: <span className="bg-gray-100 px-1 border border-black">{woChannel}</span></div>
              <div className="mt-2 text-xs border-2 border-black p-2 bg-yellow-50">
                <div className="text-[9px] font-black text-red-600">⚠️ SPESIFIKASI REQUEST VARIETAS:</div>
                <div className="text-sm font-black mt-0.5">{woRequest}</div>
              </div>
              <div className="mt-1">CATATAN POS: {woNotes}</div>
            </div>
          </div>
        ) : 
        /* MODE 3: INVOICE BELANJA KLIEN STANDAR */
        (
          <>
            <table className="w-full text-[9px] mb-2">
              <thead className="border-b border-dashed border-black">
                <tr className="text-left font-black">
                  <th className="py-1">DESKRIPSI PRODUK</th>
                  <th className="py-1 text-center">QTY</th>
                  <th className="py-1 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-dashed border-gray-200">
                    <td className="py-1 whitespace-pre-wrap uppercase">{item.name}</td>
                    <td className="py-1 text-center">{formatNumber(item.qty)}{item.suffix || ''}</td>
                    <td className="py-1 text-right">{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-black text-xs pt-1 border-t border-black">
              <span>TOTAL NETTO :</span>
              <span>{formatRupiah(amount)}</span>
            </div>
          </>
        )}

        <div className="border-t border-dashed border-black my-3"></div>
        <div className="text-right font-black text-[9px] uppercase mb-4">STATUS : {paymentMethod}</div>

        <div className="grid grid-cols-3 text-center font-bold text-[8px] uppercase gap-2">
          <div>
            <div className="mb-8">TIM PABRIK</div>
            <div className="underline">_________</div>
          </div>
          <div>
            <div className="mb-8">VALIDASI BOS</div>
            <div className="underline">_________</div>
          </div>
          <div>
            <div className="mb-8">HORMAT KAMI</div>
            <div className="underline">{admin_name}</div>
          </div>
        </div>
        <div className="mt-4 text-center text-[8px] text-gray-400 italic">-- Dokumen Sistem Cloud Dimsum Aditya ERP --</div>
      </div>
    </div>
  );
}
