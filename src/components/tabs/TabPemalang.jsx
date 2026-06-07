import React, { useState } from 'react';
import { Lock, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { getTodayStr, formatDate } from '../../utils/helpers';

export default function TabPemalang({ sendToSheet, user }) {
  const [closingDate, setClosingDate] = useState(getTodayStr());

  const handleTutupBuku = (e) => {
    e.preventDefault();

    const confirmMsg = `🚨 PERINGATAN FATAL!\n\nAnda akan MENGUNCI PERMANEN seluruh transaksi pada tanggal ${formatDate(closingDate)} dan hari-hari sebelumnya.\n\nKasir Cabang TIDAK AKAN BISA lagi menginput, mengubah, atau menghapus data penjualan di tanggal tersebut.\n\nApakah Kas Aktual sudah sesuai dengan Sistem dan Anda yakin ingin TUTUP BUKU?`;
    
    if (window.confirm(confirmMsg)) {
        // Tembak event_closing ke Backend
        const payload = {
            date: closingDate,
            cash_ready: 0, // Disederhanakan untuk UAT
            inventory_value: 0,
            hutang_aktif: 0,
            net_profit_today: 0
        };
        
        sendToSheet('event_closing', payload, 'system_events');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10 flex justify-center items-start mt-10">
      
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-lg w-full relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-red-600"></div>
          
          <div className="flex flex-col items-center text-center mb-8">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
                  <Lock size={40} className="text-red-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Tutup Buku Harian</h2>
              <p className="text-sm font-medium text-slate-500 mt-2">Kunci sistem untuk mencegah manipulasi data kasir di hari yang sudah berlalu.</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-6">
              <ShieldAlert size={24} className="text-amber-600 shrink-0"/>
              <div className="text-xs font-bold text-amber-800">
                  Transaksi yang diinput pada atau sebelum tanggal Closing akan <b>DITOLAK OTOMATIS</b> oleh Server Pusat. Hanya Super Admin yang dapat membuka gembok ini.
              </div>
          </div>

          <form onSubmit={handleTutupBuku} className="space-y-6">
              <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest text-center block">Pilih Tanggal Closing</label>
                  <input 
                      type="date" 
                      required 
                      value={closingDate} 
                      onChange={e => setClosingDate(e.target.value)} 
                      className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-slate-800 text-center text-lg outline-none focus:border-red-500 transition" 
                  />
              </div>

              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl shadow-lg shadow-red-600/30 transition flex justify-center items-center gap-2 uppercase tracking-wide">
                  <Lock size={18}/> Kunci & Tutup Buku Sekarang
              </button>
          </form>
      </div>
    </div>
  );
}
