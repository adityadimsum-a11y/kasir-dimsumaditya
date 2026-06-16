import React, { useState, useMemo } from 'react';
import { ShieldAlert, Trash2, History, Search, Calendar, UserX, AlertOctagon, Activity, FileText } from 'lucide-react';
import { getTodayStr, formatDate } from '../../utils/helpers';

export default function TabAccountingAudit({ 
  auditLogs = [], audit_logs,
  masterBranches = [], master_branches, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- STATE MANAGEMENT ---
  const [tableDateFilter, setTableDateFilter] = useState(todayStr.substring(0, 7)); 
  const [searchTerm, setSearchTerm] = useState('');
  const [activeBranchFilter, setActiveBranchFilter] = useState(isHQ ? 'SEMUA_CABANG' : currentBranch);

  // --- SINKRONISASI DATABASE ---
  const realAudit = useMemo(() => audit_logs || auditLogs || [], [auditLogs, audit_logs]);
  const rawBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);

  const activeBranchesList = useMemo(() => {
    return rawBranches.filter(b => !b.isDeleted && b.branch_id !== 'PUSAT');
  }, [rawBranches]);

  // --- FILTER ENGINE (RADAR AUDIT) ---
  const filteredAudit = useMemo(() => {
    return realAudit.filter(log => {
      if (!isHQ && log.branch_id !== currentBranch) return false;
      if (isHQ && activeBranchFilter !== 'SEMUA_CABANG' && log.branch_id !== activeBranchFilter) return false;
      
      if (log.timestamp && log.timestamp.substring(0, 7) !== tableDateFilter) return false;

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

  // --- KPI METRIK KEAMANAN INTERNAL ---
  const securityMetrics = useMemo(() => {
    let voidBulanIni = 0;
    let highRiskCount = 0; 

    filteredAudit.forEach(log => {
      voidBulanIni += 1;
      if (['orders', 'cashflow_transactions', 'expenses', 'interbranch_treasury'].includes(log.table_name)) {
        highRiskCount += 1;
      }
    });

    return { voidBulanIni, highRiskCount };
  }, [filteredAudit]);

  // BENTENG PENGUNCI OTORISASI AKUN KASIR/STAF
  if (!isHQ) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400 animate-in fade-in">
        <ShieldAlert size={64} className="mb-4 text-rose-500 opacity-80 animate-pulse"/>
        <h2 className="text-lg font-black text-slate-700">Akses Ditolak</h2>
        <p className="text-xs font-bold mt-2 text-slate-400 text-center max-w-md leading-relaxed">
          Hanya Manajemen Markas Pusat (HQ) yang memiliki otorisasi untuk mengakses buku log keamanan sistem.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER BANNER KORPORAT */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-black text-amber-400 flex items-center gap-2">
            <AlertOctagon className="text-rose-500 animate-bounce" size={18}/> Jurnal Tong Sampah &amp; Audit Trail
          </h2>
          <p className="text-[10px] font-bold text-slate-400 mt-1">
            Sistem Pemantauan Otomatis Jejak Penghapusan Data (Void) Anti-Fraud.
          </p>
        </div>
      </div>

      {/* METRIK RADAR KEAMANAN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-xs">
          <Trash2 className="absolute -right-4 -bottom-4 text-rose-500/10 pointer-events-none" size={100} />
          <div>
            <div className="text-[10px] font-black text-rose-600 flex items-center gap-1.5 mb-1"><Trash2 size={12}/> Total Void Dibatalkan (Bulan Ini)</div>
            <div className="text-3xl font-black text-rose-700 tracking-tight mt-1">{securityMetrics.voidBulanIni} <span className="text-[10px] text-rose-500 font-bold">Kasus</span></div>
          </div>
          <p className="text-[9px] text-rose-600/80 font-bold mt-3">*Jumlah transaksi yang dihapus/void dari server.</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-xs">
          <ShieldAlert className="absolute -right-4 -bottom-4 text-amber-500/10 pointer-events-none" size={100} />
          <div>
            <div className="text-[10px] font-black text-amber-600 flex items-center gap-1.5 mb-1"><AlertOctagon size={12}/> Void Berisiko Tinggi (Uang Kas)</div>
            <div className="text-3xl font-black text-amber-700 tracking-tight mt-1">{securityMetrics.highRiskCount} <span className="text-[10px] text-amber-500 font-bold">Kritis</span></div>
          </div>
          <p className="text-[9px] text-amber-600/80 font-bold mt-3">*Terdeteksi hapus data di Nota Kasir &amp; Arus Kas.</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-center items-center text-center">
          <div className="bg-emerald-50 p-4 rounded-full text-emerald-600 border border-emerald-100 shadow-sm mb-3"><Activity size={24}/></div>
          <div>
            <div className="text-[10px] font-black text-slate-400">Status Pengawasan Server</div>
            <div className="text-sm font-black text-emerald-700 mt-1">Black-Box Aktif</div>
          </div>
        </div>
      </div>

      {/* FILTER PENCARIAN & TABEL */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
             <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
               <History size={16} className="text-blue-500"/> Lembar Rekam Jejak Penghapusan Sistem
             </h4>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <select value={activeBranchFilter} onChange={e => setActiveBranchFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 py-2.5 px-3 outline-none cursor-pointer shadow-sm">
              <option value="SEMUA_CABANG">🌍 Semua Cabang (Global)</option>
              <option value="TANGERANG_PUSAT">🏢 Tangerang Pusat</option>
              {activeBranchesList.map(b => (
                <option key={b.branch_id} value={b.branch_id}>
                   {b.branch_type === 'PRODUCTION_BRANCH' ? '🏭' : '🏪'} {b.branch_name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
              <Calendar size={14} className="text-blue-500 ml-0.5"/>
              <input type="month" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value)} className="text-[10px] font-bold outline-none bg-transparent cursor-pointer text-slate-700" />
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Cari nama pelaku / ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-[10px] font-bold outline-none bg-white focus:border-blue-400 shadow-sm" />
            </div>
          </div>
        </div>

        {/* DATA UTAMA LOG AUDIT TABLE */}
        <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[40vh]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 font-black">Waktu &amp; TKP</th>
                <th className="px-5 py-4 font-black">Pelaku Eksekusi (User)</th>
                <th className="px-5 py-4 font-black">Data / ID Dihapus</th>
                <th className="px-5 py-4 font-black">Isi Detail Mentahan (Payload)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {filteredAudit.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-20 text-slate-400 bg-white">
                    <div className="flex justify-center mb-3 opacity-20"><ShieldAlert size={40}/></div>
                    <span className="font-bold text-xs">Aman! Tidak ada catatan aktivitas void / hapus data.</span>
                  </td>
                </tr>
              ) : (
                filteredAudit.map((log, index) => {
                  const dateObj = new Date(log.timestamp);
                  const isHighRisk = ['orders', 'cashflow_transactions', 'expenses', 'interbranch_treasury'].includes(log.table_name);

                  return (
                    <tr key={index} className="hover:bg-rose-50/30 transition-colors group bg-white">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black text-xs">{formatDate(log.timestamp)}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{dateObj.toLocaleTimeString('id-ID')} WIB</div>
                        <div className="text-[9px] font-black text-slate-400 mt-1">NODE: {log.branch_id?.replace(/_/g, ' ') || 'UNKNOWN'}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0"><UserX size={14}/></div>
                          <div>
                            <div className="font-black text-rose-600 text-[9px]">VOID OLEH:</div>
                            <div className="text-sm font-black text-slate-800">{log.executor_name || 'SYSTEM MACHINE'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg border mb-1.5 inline-block shadow-sm ${isHighRisk ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          Tabel: {log.table_name?.toUpperCase()}
                        </span>
                        <div className="text-slate-700 font-black font-mono text-[10px]">ID: {log.record_id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[10px] text-slate-500 font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 max-w-md line-clamp-2 overflow-hidden group-hover:line-clamp-none transition-all shadow-inner" title={log.deleted_data}>
                          {log.deleted_data || 'Tidak ada detail (Soft Delete)'}
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
