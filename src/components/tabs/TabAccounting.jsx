import React, { useMemo, useState } from 'react';
import { BookOpen, PieChart, TrendingUp, Briefcase, Layers, DollarSign, ListFilter, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { formatRp, formatDate } from '../../utils/helpers';

export default function TabAccounting({ generalLedger, chartOfAccounts }) {
  const [activeSubTab, setActiveSubTab] = useState('trial_balance'); // 'trial_balance', 'general_ledger'
  const [filterAccount, setFilterAccount] = useState('ALL');

  // ==============================================================
  // ACCOUNTING ENGINE CORE (DOUBLE-ENTRY MAPPING PHASE 12.5)
  // ==============================================================
  const accountingData = useMemo(() => {
    const balances = {};
    
    // 1. Inisialisasi Chart of Accounts (COA Resmi Sistem)
    // Jika data COA dari props kosong, gunakan standar akun Phase 12.5
    const defaultCOA = [
      { code: '1001', name: 'KAS TUNAI / LACI POS', type: 'ASSET' },
      { code: '1002', name: 'PIUTANG PLATFORM MARKETPLACE', type: 'ASSET' },
      { code: '1101', name: 'PERSEDIAAN BAHAN BAKU (AYAM)', type: 'ASSET' },
      { code: '1102', name: 'PERSEDIAAN BARANG JADI (DIMSUM)', type: 'ASSET' },
      { code: '4001', name: 'PENDAPATAN KOTOR PENJUALAN', type: 'REVENUE' },
      { code: '5001', name: 'HARGA POKOK PENJUALAN (HPP FIFO)', type: 'EXPENSE' },
      { code: '6001', name: 'BEBAN BIAYA ADMIN MARKETPLACE', type: 'EXPENSE' },
      { code: '6002', name: 'BEBAN OPERASIONAL & OPEX LAIN', type: 'EXPENSE' }
    ];

    const currentCOA = chartOfAccounts && chartOfAccounts.length > 0 
      ? chartOfAccounts.filter(acc => !acc.isDeleted)
      : defaultCOA;

    currentCOA.forEach(acc => {
      balances[acc.code] = { 
        code: acc.code, 
        name: acc.name, 
        type: acc.type, 
        debit: 0, 
        credit: 0, 
        balance: 0 
      };
    });

    // 2. Proses Aliran Mutasi Jurnal Umum (General Ledger Lines)
    let totalDebitJurnal = 0;
    let totalKreditJurnal = 0;

    const validGL = (generalLedger || []).filter(gl => !gl.isDeleted);

    validGL.forEach(gl => {
      const code = String(gl.account_code);
      // Proteksi jika ada kode akun siluman yang belum terdaftar di COA
      if (!balances[code]) {
        balances[code] = { code: code, name: gl.memo || 'AKUN BELUM TERDEFINISI', type: 'EXPENSE', debit: 0, credit: 0, balance: 0 };
      }

      const dr = Number(gl.debit) || 0;
      const cr = Number(gl.credit) || 0;
      
      balances[code].debit += dr;
      balances[code].credit += cr;
      totalDebitJurnal += dr;
      totalKreditJurnal += cr;

      // Aturan Saldo Normal Akuntansi Kunci Utama Finansial
      if (['ASSET', 'EXPENSE'].includes(balances[code].type)) {
        balances[code].balance += (dr - cr);
      } else if (['LIABILITY', 'EQUITY', 'REVENUE'].includes(balances[code].type)) {
        balances[code].balance += (cr - dr);
      }
    });

    const accountList = Object.values(balances).sort((a, b) => a.code.localeCompare(b.code));

    // 3. KALKULASI EXECUTIVE METRICS (Kinerja Finansial dari Aset & Buku Besar)
    const kasReady = balances['1001']?.balance || 0;
    const piutangAplikasi = balances['1002']?.balance || 0;
    const omzetKotor = balances['4001']?.balance || 0;
    const hppTerealisasi = balances['5001']?.balance || 0;
    const adminFeeMarketplace = balances['6001']?.balance || 0;
    
    // Laba Bersih Operasional Sementara sebelum Pajak
    const labaBersihLedger = omzetKotor - hppTerealisasi - adminFeeMarketplace;

    return { 
      accountList, 
      totalDebitJurnal, 
      totalKreditJurnal, 
      kasReady, 
      piutangAplikasi, 
      omzetKotor, 
      labaBersihLedger,
      validGL
    };
  }, [generalLedger, chartOfAccounts]);

  // Filter Log Jurnal Berdasarkan Akun Pilihan Admin
  const filteredGLRows = useMemo(() => {
    if (filterAccount === 'ALL') return accountingData.validGL.sort((a,b) => new Date(b.date) - new Date(a.date));
    return accountingData.validGL
      .filter(gl => String(gl.account_code) === filterAccount)
      .sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [accountingData.validGL, filterAccount]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">

      {/* HEADER NAVIGASI AKUNTANSI */}
      <div className="flex flex-wrap gap-2 border-b pb-4">
        <button onClick={() => setActiveSubTab('trial_balance')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'trial_balance' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><PieChart size={16} className="inline mr-2"/> Neraca Saldo (Trial Balance)</button>
        <button onClick={() => setActiveSubTab('general_ledger')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'general_ledger' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><BookOpen size={16} className="inline mr-2"/> Jurnal & Buku Besar Log</button>
      </div>

      {/* ========================================================== */}
      {/* KONDISI TAB 1: TRIAL BALANCE (NERACA SALDO UTAMA)          */}
      {/* ========================================================== */}
      {activeSubTab === 'trial_balance' && (
        <>
          {/* CARDS FINANCIAL INSIGHTS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kas Laci Kasir Aktif</div>
                  <div className="text-xl font-black text-slate-800">{formatRp(accountingData.kasReady)}</div>
                  <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Kode Akun: 1001</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Piutang Merchant App</div>
                  <div className="text-xl font-black text-orange-600">{formatRp(accountingData.piutangAplikasi)}</div>
                  <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Kode Akun: 1002</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Omzet Finansial</div>
                  <div className="text-xl font-black text-blue-600">{formatRp(accountingData.omzetKotor)}</div>
                  <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Kode Akun: 4001</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm border-b-4 border-b-emerald-500">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Laba Bersih Buku Besar</div>
                  <div className="text-xl font-black text-emerald-600">{formatRp(accountingData.labaBersihLedger)}</div>
                  <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Realized Profit FIFO</p>
              </div>
          </div>

          {/* TABEL BALANCE SHEET NERACA SALDO */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm flex items-center gap-2"><Briefcase size={18} className="text-slate-500"/> Trial Balance Dashboard</h4>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1"><ShieldCheck size={12}/> Double-Entry Validated</span>
              </div>
              <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                          <tr>
                              <th className="px-4 py-3">Kode Akun</th>
                              <th className="px-4 py-3">Nama Rekening Rekonsiliasi</th>
                              <th className="px-4 py-3 text-center">Tipe Akun</th>
                              <th className="px-4 py-3 text-right">Mutasi Debit</th>
                              <th className="px-4 py-3 text-right">Mutasi Kredit</th>
                              <th className="px-4 py-3 text-right bg-slate-50">Saldo Akhir Riil</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700">
                          {accountingData.accountList.map(a => (
                              <tr key={a.code} className="hover:bg-slate-50 transition">
                                  <td className="px-4 py-3 font-mono text-slate-400">{a.code}</td>
                                  <td className="px-4 py-3 uppercase text-slate-800 font-black">{a.name}</td>
                                  <td className="px-4 py-3 text-center"><span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider">{a.type}</span></td>
                                  <td className="px-4 py-3 text-right text-slate-500">{formatRp(a.debit)}</td>
                                  <td className="px-4 py-3 text-right text-slate-500">{formatRp(a.credit)}</td>
                                  <td className="px-4 py-3 text-right bg-slate-50 text-slate-900 font-black">{formatRp(a.balance)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
        </>
      )}

      {/* ========================================================== */}
      {/* KONDISI TAB 2: GENERAL LEDGER (AUDIT TRAIL LOG JURNAL)      */}
      {/* ========================================================== */}
      {activeSubTab === 'general_ledger' && (
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              
              {/* PANEL FILTER BAR */}
              <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm flex items-center gap-2"><ArrowRightLeft size={18} className="text-slate-500"/> Audit Trail: Aliran Buku Besar</h4>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                      <ListFilter size={14} className="text-slate-400 shrink-0"/>
                      <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className="p-2 border rounded-xl font-black text-xs uppercase bg-white w-full sm:w-64 outline-none focus:ring-2 focus:ring-slate-400">
                          <option value="ALL">Semua Aliran Akun (All GL Lines)</option>
                          {accountingData.accountList.map(a => <option key={a.code} value={a.code}>[{a.code}] {a.name}</option>)}
                      </select>
                  </div>
              </div>

              {/* TABEL LEDGER LOG */}
              <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                          <tr>
                              <th className="px-4 py-3">Waktu & Ref ID</th>
                              <th className="px-4 py-3 text-center">Kode Akun</th>
                              <th className="px-4 py-3">Memo Keterangan Jurnal</th>
                              <th className="px-4 py-3 text-right text-emerald-600">Debit (+)</th>
                              <th className="px-4 py-3 text-right text-rose-600">Kredit (-)</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-bold text-xs">
                          {filteredGLRows.length === 0 ? (
                              <tr><td colSpan="5" className="text-center py-8 text-slate-400">Tidak ada baris entri jurnal ditemukan.</td></tr>
                          ) : (
                              filteredGLRows.map(gl => (
                                  <tr key={gl.id} className="hover:bg-slate-50 transition">
                                      <td className="px-4 py-3">
                                          <div className="text-slate-700">{formatDate(gl.date)}</div>
                                          <div className="text-[10px] font-mono text-slate-400 font-bold uppercase">{gl.ref_id || gl.id}</div>
                                      </td>
                                      <td className="px-4 py-3 text-center font-mono text-blue-600 bg-slate-50/50">{gl.account_code}</td>
                                      <td className="px-4 py-3 text-slate-800 max-w-xs truncate uppercase font-medium">{gl.memo}</td>
                                      <td className="px-4 py-3 text-right text-emerald-600 font-black">{gl.debit > 0 ? formatRp(gl.debit) : '-'}</td>
                                      <td className="px-4 py-3 text-right text-rose-600 font-black">{gl.credit > 0 ? formatRp(gl.credit) : '-'}</td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
         </div>
      )}

    </div>
  );
}
