import React, { useEffect } from 'react';

export default function PrintDotMatrix({ printData, onClose }) {
  useEffect(() => {
    if (printData) {
      // Delay sebentar biar DOM render sempurna sebelum nembak ke printer
      const timer = setTimeout(() => { window.print(); }, 500);
      const handleAfterPrint = () => { if (onClose) onClose(); };
      window.addEventListener('afterprint', handleAfterPrint);
      return () => { clearTimeout(timer); window.removeEventListener('afterprint', handleAfterPrint); };
    }
  }, [printData, onClose]);

  if (!printData) return null;

  const { 
    title = 'INVOICE', id = '-', date = '-', branch_name = 'PUSAT', 
    admin_name = '-', customer_name = '-', items = [], amount = 0, 
    paymentMethod = '-', history = null 
  } = printData;

  const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
  const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

  // ALGORITMA PENYELUNDUP DATA KUSUS PABRIK (WORK ORDER / PRODUKSI)
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
    <div className="fixed inset-0 bg-white z-[99999] print-container text-black font-mono overflow-y-auto">
      {/* CSS KHUSUS PRINTER DOT MATRIX & THERMAL */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; background: white; }
          @page { size: auto; margin: 5mm; }
          
          /* Memaksa font selalu hitam tebal untuk tembus kertas karbon rangkap */
          * { color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      
      {/* KERTAS CONTINUOUS FORM MAX-WIDTH */}
      <div className="max-w-3xl mx-auto p-4 md:p-8 bg-white print:max-w-full print:p-2 text-sm md:text-base leading-snug">
        
        {/* ======================================= */}
        {/* KOP STRUK GAYA GRABMERCHANT / GOBIZ */}
        {/* ======================================= */}
        <div className="text-center mb-4">
          <div className="border-b-2 border-dashed border-black pb-2 mb-2">
            <h1 className="text-3xl font-black uppercase tracking-widest mb-1">DIMSUM ADITYA</h1>
            <div className="font-bold text-xs uppercase">Distributor & Pabrik Dimsum</div>
            {mode === 'INVOICE' || history ? (
              <div className="text-xs font-bold mt-1">
                Jl. Thamrin Ketapang, Cipondoh, Tangerang<br/>
                Telp: 0878-0902-0931
              </div>
            ) : (
              <div className="text-xs font-black mt-1 uppercase">CABANG OPERASIONAL: {branch_name}</div>
            )}
          </div>
          <h2 className="text-xl font-black uppercase tracking-wider">{title}</h2>
        </div>
        
        {/* INFORMASI TRANSAKSI */}
        <div className="grid grid-cols-2 gap-2 mb-4 font-bold text-xs uppercase border-b-2 border-dashed border-black pb-4">
          <div>
            <div>NO TRX : {id}</div>
            <div>TANGGAL: {date}</div>
            <div>KASIR  : {admin_name}</div>
          </div>
          <div className="text-right">
            <div>CUST / PIC:</div>
            <div className="text-base font-black truncate">{customer_name}</div>
          </div>
        </div>

        {/* =========================================
            MODE 1: WORK ORDER PABRIK (KARANTINA)
        ========================================= */}
        {mode === 'WORK_ORDER' && (
          <div className="space-y-4 my-6 text-center border-b-2 border-dashed border-black pb-6">
            <div className="border-2 border-black p-4">
              <div className="font-bold uppercase mb-1">JUMLAH WAJIB MASAK</div>
              <div className="text-5xl font-black">{formatNumber(meta.qty)} <span className="text-xl">PCS</span></div>
            </div>
            <div className="text-lg font-bold uppercase">AGEN: {meta.channel}</div>
            <div className="border-2 border-black p-3 border-dotted">
              <div className="font-bold mb-1">⚠️ SPESIFIKASI REQUEST:</div>
              <div className="text-2xl font-black uppercase">{meta.request}</div>
            </div>
            <div className="font-bold uppercase text-left">📝 MEMO: {meta.notes}</div>
          </div>
        )}

        {/* =========================================
            MODE 2: LAPORAN HASIL PRODUKSI
        ========================================= */}
        {mode === 'PRODUCTION' && (
          <div className="space-y-4 my-6 border-b-2 border-dashed border-black pb-6">
            <div className="grid grid-cols-2 gap-4 text-center">
               <div className="border-2 border-black p-4">
                 <div className="font-bold uppercase mb-1">ADUKAN</div>
                 <div className="text-3xl font-black">{formatNumber(meta.adukan)}</div>
               </div>
               <div className="border-2 border-black p-4">
                 <div className="font-bold uppercase mb-1">AYAM SAKRAL</div>
                 <div className="text-3xl font-black">{formatNumber(meta.ayam)} <span className="text-lg">KG</span></div>
               </div>
            </div>
            <div className="border-2 border-black p-4 text-center bg-gray-100">
               <div className="font-bold uppercase mb-1">YIELD MASUK FREEZER</div>
               <div className="text-5xl font-black">{formatNumber(meta.yield)} <span className="text-2xl">PCS</span></div>
            </div>
          </div>
        )}

        {/* =========================================
            MODE 3: INVOICE & SLIP PENARIKAN (UMUM)
        ========================================= */}
        {(mode === 'INVOICE' || history) && (
          <div className="mb-6">
            <table className="w-full text-xs md:text-sm font-bold uppercase">
              <thead className="border-b-2 border-dashed border-black">
                <tr className="text-left">
                  <th className="py-2 w-1/2">DESKRIPSI ITEM</th>
                  <th className="py-2 text-center w-1/4">QTY</th>
                  <th className="py-2 text-right w-1/4">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-b border-dotted border-black/30">
                    <td className="py-3 pr-2 whitespace-pre-wrap leading-tight">{item.name}</td>
                    <td className="py-3 text-center font-black text-base">{formatNumber(item.qty)}{item.suffix || ''}</td>
                    <td className="py-3 text-right font-black">{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* GRAND TOTAL */}
            <div className="flex justify-between items-center font-black text-lg md:text-xl pt-3 mt-2 border-t-2 border-dashed border-black">
              <span>TOTAL :</span>
              <span>{formatRupiah(amount)}</span>
            </div>
            
            <div className="flex justify-between items-center mt-2 font-bold text-xs uppercase">
              <span>PEMBAYARAN :</span>
              <span className="border border-black px-2 py-0.5">{paymentMethod}</span>
            </div>

            {/* 🔥 BLOK HISTORY: KHUSUS SLIP PENARIKAN 15% (WAR ROOM) */}
            {history && (
              <div className="mt-4 pt-3 border-t-2 border-dashed border-black text-xs font-bold uppercase">
                <div className="text-center mb-2 underline font-black">MUTASI PLAFON DANA HOLDING</div>
                <div className="flex justify-between mb-1">
                  <span>{history.labelLama || 'PLAFON AWAL'} :</span>
                  <span>{formatRupiah(history.nominalLama)}</span>
                </div>
                <div className="flex justify-between mb-1 text-black font-black">
                  <span>{history.labelAksi || 'DITARIK'} :</span>
                  <span>-{formatRupiah(history.nominalAksi)}</span>
                </div>
                <div className="flex justify-between mt-2 pt-1 border-t border-black font-black">
                  <span>{history.labelBaru || 'SISA PLAFON'} :</span>
                  <span>{formatRupiah(history.nominalBaru)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* TANDA TANGAN RANGKAP */}
        {/* ======================================= */}
        <div className="grid grid-cols-2 text-center font-bold text-xs uppercase gap-4 mt-8">
          <div>
            <div className="mb-16">{mode === 'WORK_ORDER' || mode === 'PRODUCTION' ? "KEPALA PRODUKSI" : "PENERIMA / KLIEN"}</div>
            <div className="border-b border-black mx-8 mb-1"></div>
            <div>( NAMA JELAS )</div>
          </div>
          <div>
            <div className="mb-16">HORMAT KAMI,</div>
            <div className="border-b border-black mx-8 mb-1 font-black text-sm">{admin_name}</div>
            <div>( ADMIN DIMSUM )</div>
          </div>
        </div>
        
        <div className="mt-8 text-center text-[10px] font-bold border-t-2 border-dashed border-black pt-4">
          *** TERIMA KASIH ATAS KEPERCAYAAN ANDA ***<br/>
          Dicetak oleh Sistem ERP Dimsum Aditya
        </div>
      </div>
    </div>
  );
}
