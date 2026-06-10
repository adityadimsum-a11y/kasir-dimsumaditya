import React, { useEffect } from 'react';

export default function PrintDotMatrix({ printData, onClose }) {
  useEffect(() => {
    if (printData) {
      const timer = setTimeout(() => { window.print(); }, 300);
      const handleAfterPrint = () => { if (onClose) onClose(); };
      window.addEventListener('afterprint', handleAfterPrint);
      return () => { clearTimeout(timer); window.removeEventListener('afterprint', handleAfterPrint); };
    }
  }, [printData, onClose]);

  if (!printData) return null;

  const { title = 'INVOICE', id = '-', date = '-', branch_name = '-', admin_name = '-', customer_name = '-', items = [], amount = 0, paymentMethod = '-' } = printData;

  const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
  const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

  // ALGORITMA PENYELUNDUP DATA ANTI-GAGAL
  let mode = 'INVOICE';
  let meta = {};

  if (items && items.length > 0 && typeof items[0].name === 'string') {
    if (items[0].name.startsWith('@@WORK_ORDER@@')) {
      mode = 'WORK_ORDER';
      const parts = items[0].name.split('||');
      meta = { channel: parts[1], request: parts[2], notes: parts[3], qty: items[0].qty };
    } else if (items[0].name.startsWith('@@PRODUCTION@@')) {
      mode = 'PRODUCTION';
      const parts = items[0].name.split('||');
      meta = { adukan: parts[1], ayam: parts[2], yield: parts[3], notes: parts[4] };
    }
  }

  return (
    <div className="fixed inset-0 bg-white z-[99999] print-container text-black font-sans overflow-y-auto">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          @page { size: auto; margin: 5mm; }
        }
      `}</style>
      
      <div className="max-w-4xl mx-auto p-4 md:p-8 bg-white print:max-w-full print:p-4 text-base">
        
        {/* HEADER INVOICE CUSTOMER & GLOBAL HEADER */}
        <div className="text-center mb-6 border-b-4 border-black pb-4">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest mb-2">DIMSUM ADITYA</h1>
          
          {mode === 'INVOICE' && (
            <div className="text-sm md:text-base font-bold text-gray-800 leading-relaxed">
              <div>Alamat : Jl. Thamrin Ketapang, Cipondoh, Kota Tangerang 15147</div>
              <div>No tlp : 0878 0902 0931</div>
              <div className="mt-2 inline-block border-2 border-black p-2 bg-gray-50">
                <div>No. Rek : 1320552261 (BCA) - WASTAM</div>
                <div>No. Rek : 775301006132536 (BRI) - WASTAM</div>
              </div>
            </div>
          )}
          {mode !== 'INVOICE' && (
            <div className="text-lg font-bold uppercase tracking-wider">CABANG OPERASIONAL {branch_name}</div>
          )}
        </div>
        
        <div className="text-center font-black uppercase underline text-2xl md:text-3xl tracking-widest mb-6">
          {title}
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6 font-bold text-base md:text-lg uppercase">
          <div>
            <div>NO. TRX : {id}</div>
            <div className="mt-2 text-xl font-black">NAMA / PIC : {customer_name}</div>
          </div>
          <div className="text-right">
            <div>TANGGAL : {date}</div>
            <div className="mt-2">KASIR : {admin_name}</div>
          </div>
        </div>

        <div className="border-t-4 border-black mb-6"></div>

        {/* =========================================
            MODE 1: TIKET WORK ORDER PABRIK (KARANTINA)
        ========================================= */}
        {mode === 'WORK_ORDER' && (
          <div className="space-y-6 my-6">
            <div className="border-4 border-black p-6 text-center bg-gray-100">
              <div className="text-xl font-black uppercase mb-2">JUMLAH WAJIB MASAK (QTY)</div>
              <div className="text-8xl font-black">{formatNumber(meta.qty)} <span className="text-3xl">PCS</span></div>
            </div>
            <div className="space-y-4">
              <div className="text-xl font-bold uppercase">CHANNEL: <span className="border-2 border-black px-3 py-1 font-black bg-yellow-100">{meta.channel}</span></div>
              <div className="border-4 border-dashed border-black p-4">
                <div className="text-xl font-black mb-2">⚠️ SPESIFIKASI REQUEST:</div>
                <div className="text-4xl font-black uppercase text-red-600">{meta.request}</div>
              </div>
              <div className="text-lg font-bold uppercase border-l-8 border-black pl-4 py-2 bg-gray-50">
                CATATAN POS: {meta.notes}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            MODE 2: LAPORAN HASIL PRODUKSI (PABRIK)
        ========================================= */}
        {mode === 'PRODUCTION' && (
          <div className="space-y-6 my-6">
            <div className="grid grid-cols-2 gap-6">
               <div className="border-4 border-black p-6 text-center">
                 <div className="text-xl font-black uppercase mb-2">TOTAL ADUKAN</div>
                 <div className="text-6xl font-black">{formatNumber(meta.adukan)} <span className="text-2xl">BATCH</span></div>
               </div>
               <div className="border-4 border-black p-6 text-center">
                 <div className="text-xl font-black uppercase mb-2">AYAM TERPAKAI</div>
                 <div className="text-6xl font-black">{formatNumber(meta.ayam)} <span className="text-2xl">KG</span></div>
               </div>
            </div>
            <div className="border-4 border-black p-6 text-center bg-gray-100 mt-6">
               <div className="text-2xl font-black uppercase mb-2">YIELD MASUK FREEZER (FROZEN)</div>
               <div className="text-8xl font-black">{formatNumber(meta.yield)} <span className="text-3xl">PCS</span></div>
            </div>
          </div>
        )}

        {/* =========================================
            MODE 3: INVOICE CUSTOMER (STANDAR)
        ========================================= */}
        {mode === 'INVOICE' && (
          <div className="mb-10">
            <table className="w-full text-lg mb-4">
              <thead className="border-b-4 border-black">
                <tr className="text-left font-black uppercase">
                  <th className="py-3">DESKRIPSI PRODUK</th>
                  <th className="py-3 text-center">QTY</th>
                  <th className="py-3 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b-2 border-dashed border-gray-400">
                    <td className="py-4 whitespace-pre-wrap uppercase leading-relaxed">{item.name}</td>
                    <td className="py-4 text-center text-2xl font-black">{formatNumber(item.qty)}{item.suffix || ''}</td>
                    <td className="py-4 text-right text-2xl font-black">{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-black text-2xl pt-4 border-t-4 border-black mt-6">
              <span>TOTAL TAGIHAN :</span>
              <span>{formatRupiah(amount)}</span>
            </div>
            <div className="text-right mt-6">
              <div className={`inline-block border-4 border-black p-4 text-2xl font-black uppercase ${paymentMethod.includes('BELUM') ? 'bg-gray-200' : ''}`}>
                STATUS: {paymentMethod}
              </div>
            </div>
            <div className="clear-both"></div>
          </div>
        )}

        <div className="border-t-4 border-black my-8"></div>
        
        <div className="grid grid-cols-2 text-center font-bold text-lg uppercase gap-8 mt-12">
          <div>
            <div className="mb-24">{mode === 'WORK_ORDER' ? "TIM DAPUR PABRIK" : mode === 'PRODUCTION' ? "KEPALA PRODUKSI" : "PENERIMA / KLIEN"}</div>
            <div className="border-b-4 border-black mx-12"></div>
          </div>
          <div>
            <div className="mb-24">HORMAT KAMI,</div>
            <div className="border-b-4 border-black mx-12 text-2xl font-black">{admin_name}</div>
          </div>
        </div>
        
        <div className="mt-12 text-center text-sm font-bold text-gray-500 italic">
          -- Dicetak Otomatis dari Sistem ERP Dimsum Aditya --
        </div>
      </div>
    </div>
  );
}
