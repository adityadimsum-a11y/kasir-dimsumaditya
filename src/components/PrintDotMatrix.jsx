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

  // ALGORITMA PENYELUNDUP DATA RAHASIA (BYPASS)
  let isWO = false;
  let isProd = false;
  let meta = {};

  if (items && items.length > 0) {
    try {
      const parsedData = JSON.parse(items[0].name);
      if (parsedData.type === 'WORK_ORDER') {
        isWO = true;
        meta = parsedData;
        meta.qty = items[0].qty; // Ambil Qty asli
      } else if (parsedData.type === 'PRODUCTION') {
        isProd = true;
        meta = parsedData;
      }
    } catch (e) {
      // Jika gagal parse, berarti ini nota invoice biasa
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
      
      <div className="max-w-4xl mx-auto p-4 md:p-8 bg-white text-sm md:text-base print:max-w-full print:p-2">
        
        {/* =========================================
            HEADER RAKSASA PROFESIONAL (REQUEST BOS)
        ========================================= */}
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-widest mb-3">DIMSUM ADITYA</h1>
          <div className="text-sm md:text-xl font-bold uppercase tracking-wider mb-1">Pusat Produksi & Supplier Dimsum Tangerang</div>
          <div className="text-xs md:text-lg font-bold text-gray-800">Jl. Thamrin Ketapang, Cipondoh, Kota Tangerang 15147</div>
          <div className="text-xs md:text-lg font-bold text-gray-800 mb-2">CS / Pemesanan: 0878-0902-0931</div>
          
          <div className="inline-block border-2 border-black p-2 mt-2 bg-gray-100">
            <div className="text-xs md:text-lg font-black uppercase">Pembayaran Transfer:</div>
            <div className="text-xs md:text-lg font-bold">BCA: 1320552261 (WASTAM) | BRI: 775301006132536 (WASTAM)</div>
          </div>
        </div>
        
        <div className="text-center font-black uppercase underline text-2xl md:text-3xl tracking-widest mb-4">
          {title}
        </div>
        
        <div className="border-t-4 border-black mb-3"></div>
        
        <div className="grid grid-cols-2 gap-4 mb-4 font-bold text-sm md:text-xl uppercase">
          <div>
            <div>NO. DOKUMEN : {id}</div>
            <div className="mt-2 text-xl md:text-3xl font-black">KLIEN/PIC : {customer_name}</div>
          </div>
          <div className="text-right">
            <div>TANGGAL : {date}</div>
            <div className="mt-2">KASIR/ADMIN : {admin_name}</div>
          </div>
        </div>

        <div className="border-t-4 border-black mb-6"></div>

        {/* =========================================
            MODE 1: TIKET WORK ORDER PABRIK (KARANTINA)
        ========================================= */}
        {isWO ? (
          <div className="space-y-6 my-6">
            <div className="border-4 border-black p-6 text-center">
              <div className="text-lg md:text-2xl font-black uppercase mb-2 tracking-widest text-gray-600">JUMLAH WAJIB MASAK (QTY)</div>
              <div className="text-7xl md:text-9xl font-black">{formatNumber(meta.qty)} <span className="text-3xl">PCS</span></div>
            </div>
            <div className="grid grid-cols-1 gap-4 uppercase font-bold">
              <div className="text-lg md:text-xl">CHANNEL ASAL: <span className="bg-black text-white px-4 py-1">{meta.channel}</span></div>
              <div className="mt-4 border-4 border-dashed border-black p-4 bg-gray-50">
                <div className="text-xl md:text-2xl font-black">⚠️ SPESIFIKASI REQUEST VARIETAS:</div>
                <div className="text-4xl md:text-5xl font-black mt-2">{meta.request}</div>
              </div>
              <div className="mt-2 text-lg md:text-xl">CATATAN POS: {meta.notes}</div>
            </div>
          </div>
        ) : 
        
        /* =========================================
            MODE 2: LAPORAN PRODUKSI PABRIK (YIELD)
        ========================================= */
        isProd ? (
          <div className="space-y-6 my-6">
            <div className="grid grid-cols-2 gap-6">
               <div className="border-4 border-black p-4 text-center">
                 <div className="text-sm md:text-xl font-black uppercase mb-1">TOTAL ADUKAN</div>
                 <div className="text-5xl md:text-7xl font-black">{formatNumber(meta.adukan)} <span className="text-2xl">BATCH</span></div>
               </div>
               <div className="border-4 border-black p-4 text-center">
                 <div className="text-sm md:text-xl font-black uppercase mb-1">AYAM TERPAKAI</div>
                 <div className="text-5xl md:text-7xl font-black">{formatNumber(meta.ayam)} <span className="text-2xl">KG</span></div>
               </div>
            </div>
            <div className="border-4 border-black p-6 text-center bg-gray-100 mt-6">
               <div className="text-xl md:text-3xl font-black uppercase mb-2">YIELD MASUK FREEZER (FROZEN)</div>
               <div className="text-7xl md:text-9xl font-black">{formatNumber(meta.yield)} <span className="text-3xl">PCS</span></div>
            </div>
            <div className="mt-4 text-lg md:text-2xl font-bold uppercase border-l-8 border-black pl-4 py-2">
              KETERANGAN: {meta.notes}
            </div>
          </div>
        ) : 
        
        /* =========================================
            MODE 3: INVOICE PENJUALAN CUSTOMER (STANDAR)
        ========================================= */
        (
          <div className="mb-10">
            <table className="w-full text-sm md:text-xl mb-4">
              <thead className="border-b-4 border-black">
                <tr className="text-left font-black uppercase tracking-wider">
                  <th className="py-3">DESKRIPSI PRODUK</th>
                  <th className="py-3 text-center">QTY</th>
                  <th className="py-3 text-right">TOTAL (Rp)</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-400">
                    <td className="py-4 whitespace-pre-wrap uppercase">{item.name}</td>
                    <td className="py-4 text-center text-xl md:text-2xl font-black">{formatNumber(item.qty)}{item.suffix || ''}</td>
                    <td className="py-4 text-right text-xl md:text-2xl font-black">{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-black text-2xl md:text-4xl pt-4 border-t-4 border-black mt-6">
              <span>TOTAL TAGIHAN :</span>
              <span>{formatRupiah(amount)}</span>
            </div>
            <div className={`text-right font-black text-xl md:text-3xl uppercase mt-4 p-3 border-2 border-black inline-block float-right ${paymentMethod.includes('BELUM LUNAS') ? 'bg-gray-200' : ''}`}>
              STATUS: {paymentMethod}
            </div>
            <div className="clear-both"></div>
          </div>
        )}

        {/* =========================================
            FOOTER TANDA TANGAN
        ========================================= */}
        <div className="border-t-4 border-black my-8"></div>
        <div className="grid grid-cols-2 text-center font-bold text-sm md:text-xl uppercase gap-8">
          <div>
            <div className="mb-20">{isWO ? "TIM DAPUR PABRIK" : isProd ? "KEPALA PRODUKSI" : "PENERIMA / KLIEN"}</div>
            <div className="border-b-2 border-black mx-10"></div>
          </div>
          <div>
            <div className="mb-20">HORMAT KAMI,</div>
            <div className="border-b-2 border-black mx-10 text-xl font-black">{admin_name}</div>
          </div>
        </div>
        
        <div className="mt-10 text-center text-xs md:text-sm font-bold text-gray-500 italic">
          -- Dihasilkan otomatis oleh Sistem ERP Dimsum Aditya. Harap simpan bukti ini. --
        </div>
      </div>
    </div>
  );
}
