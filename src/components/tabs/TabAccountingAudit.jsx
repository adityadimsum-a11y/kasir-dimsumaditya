import React, { useState, useMemo } from 'react';
import { ShieldAlert, Trash2, History, Search, Calendar, UserX, AlertOctagon, Activity, FileText } from 'lucide-react';
import { getTodayStr, formatDate } from '../../utils/helpers';

export default function TabAccountingAudit({ 
  auditLogs = [], audit_logs,
  masterBranches = [], user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- STATE MANAGEMENT ---
  const [tableDateFilter, setTableDateFilter] = useState(todayStr.substring(0, 7)); // Default: Bulan Ini (YYYY-MM)
  const [searchTerm, setSearchTerm] = useState('');
  const [activeBranchFilter, setActiveBranchFilter] = useState(isHQ ? 'SEMUA_CABANG' : currentBranch);

  // --- SINKRONISASI DATABASE ---
  const realAudit = useMemo(() => audit_logs || auditLogs || [], [auditLogs, audit_logs]);

  // --- FILTER ENGINE (RADAR AUDIT) ---
  const filteredAudit = useMemo(() => {
    return realAudit.filter(log => {
      // 1. Filter Cabang (HQ bisa lihat semua, Cabang cuma lihat sampahnya sendiri)
      if (!isHQ && log.branch_id !== currentBranch) return false;
      if (isHQ && activeBranchFilter !== 'SEMUA_CABANG' && log.branch_id !== activeBranchFilter) return false;
      
      // 2. Filter Waktu (Bulan)
      if (log.timestamp && log.timestamp.substring(0, 7) !== tableDateFilter) return false;

      // 3. Filter Pencarian
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (
          !log.table_name?.toLowerCase().includes(s) && 
          !log.executor_name?.toLowerCase().includes(s) && 
          !log.record_id?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [realAudit, isHQ, currentBranch, activeBranchFilter, tableDateFilter, searchTerm]);

  // --- KPI METRIK KEAMANAN ---
  const securityMetrics = useMemo(() => {
    let voidBulanIni = 0;
    let highRiskCount = 0; // Transaksi uang dihapus

    filteredAudit.forEach(log => {
      voidBulanIni += 1;
      // Deteksi kalau yang dihapus itu urusan uang/kasir
      if (['orders', 'cashflow_transactions', 'expenses', 'interbranch_treasury'].includes(log.table_name)) {
        highRiskCount += 1;
      }
    });

    return { voidBulanIni, highRiskCount };
  }, [filteredAudit]);

  // --- TAMPILAN JIKA BUKAN HQ (Blokir Akses) ---
  // Fitur ini sangat rahasia, cabang bisa lihat tapi dibatasi
  if (!isHQ) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <ShieldAlert size={64} className="mb-4 text-slate-300"/>
        <h2 className="text-xl font-black uppercase tracking-widest text-slate-500">Akses Dibatasi</h2>
        <p className="text-xs font-bold mt-2">Hanya Markas Pusat (HQ) yang memiliki otorisasi penuh membaca jejak audit sistem.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 text-slate-800">
      
      {/* HEADER BANNER KORPORAT */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <AlertOctagon className="text-rose-500"/> Jurnal Tong Sampah &amp; Audit Trail
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Sistem Pemantauan Jejak Penghapusan Data (Void) Anti-Fraud.
          </p>
        </div>
      </div>

      {/* METRIK RADAR KEAMANAN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-rose-50/80 p-6 rounded-3xl border border-rose-200 shadow-sm relative overflow-hidden">
          <Trash2 className="absolute -right-4 -bottom-4 text-rose-500/10 pointer-events-none" size={120} />
          <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Trash2 size={12}/> Total Void (Bulan Ini)</div>
          <div className="text-4xl font-black text-rose-700 tracking-tight">{securityMetrics.voidBulanIni} <span className="text-sm text-rose-400">DATA</span></div>
          <div className="mt-2 text-[9px] font-bold text-rose-700/60 uppercase">Data dibatalkan dan ditarik dari sistem.</div>
        </div>

        <div className="bg-amber-50/80 p-6 rounded-3xl border border-amber-200 shadow-sm relative overflow-hidden">
          <ShieldAlert className="absolute -right-4 -bottom-4 text-amber-500/10 pointer-events-none" size={120} />
          <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><AlertOctagon size={12}/> Risiko Tinggi (Kas/Uang)</div>
          <div className="text-4xl font-black text-amber-700 tracking-tight">{securityMetrics.highRiskCount} <span className="text-sm text-amber-400">KASUS</span></div>
          <div className="mt-2 text-[9px] font-bold text-amber-700/60 uppercase">Void pada tabel Kasir, Kasbon, & Pengeluaran.</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 border border-emerald-100"><Activity size={24}/></div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sistem Audit Latar Belakang</div>
              <div className="text-sm font-black text-slate-800 uppercase mt-0.5">MEREKAM OTOMATIS AKTIF</div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER PENCARIAN & TABEL */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        
        {/* PANEL FILTER */}
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2">
            <History size={16} className="text-blue-500"/> Log Jejak Penghapusan Sistem
          </h4>
          
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <select value={activeBranchFilter} onChange={e => setActiveBranchFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-700 py-2 px-3 outline-none cursor-pointer shadow-sm">
              <option value="SEMUA_CABANG">🌍 SEMUA CABANG</option>
              <option value="TANGERANG_PUSAT">🏢 TANGERANG PUSAT</option>
              <option value="CIBINONG">🏪 CIBINONG</option>
              <option value="PRODUKSI_PEMALANG">🏭 PEMALANG</option>
            </select>

            <div className="flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl shadow-sm">
              <Calendar size={12} className="text-slate-400"/>
              <input type="month" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value)} className="text-xs font-black outline-none bg-transparent cursor-pointer text-slate-700" />
            </div>

            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Cari pelaku/ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none bg-white focus:border-blue-400 shadow-sm" />
            </div>
          </div>
        </div>

        {/* TABEL AUDIT */}
        <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[50vh]">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 font-black">Waktu &amp; TKP</th>
                <th className="px-5 py-4 font-black">Pelaku Eksekusi (User)</th>
                <th className="px-5 py-4 font-black">Data / ID Dihapus</th>
                <th className="px-5 py-4 font-black">Detail / Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {filteredAudit.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-24 text-slate-400 font-bold uppercase tracking-widest">
                  <div className="flex justify-center mb-3 opacity-30"><ShieldAlert size={40}/></div>
                  Bersih. Tidak ada data yang dihapus pada periode ini.
                </td></tr>
              ) : (
                filteredAudit.map((log, index) => {
                  const dateObj = new Date(log.timestamp);
                  const isHighRisk = ['orders', 'cashflow_transactions', 'expenses', 'interbranch_treasury'].includes(log.table_name);

                  return (
                    <tr key={index} className="hover:bg-rose-50/30 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black">{formatDate(log.timestamp)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">JAM: {dateObj.toLocaleTimeString('id-ID')}</div>
                        <div className="text-[9px] font-black tracking-widest text-slate-500 mt-1">LOKASI: {log.branch_id || 'UNKNOWN'}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border flex items-center justify-center text-slate-400"><UserX size={14}/></div>
                          <div>
                            <div className="font-black text-rose-600 uppercase tracking-widest text-[10px]">DIHAPUS OLEH:</div>
                            <div className="text-sm font-black text-slate-800 uppercase">{log.executor_name || 'SYSTEM'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md border tracking-wider shadow-sm mb-1.5 inline-block ${isHighRisk ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                          TABEL: {log.table_name}
                        </span>
                        <div className="text-slate-700 font-black font-mono mt-1">ID: {log.record_id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded-xl border border-slate-200 max-w-sm line-clamp-3 overflow-hidden" title={log.deleted_data}>
                          {log.deleted_data || 'Tidak ada detail (Soft Delete terpicu)'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
