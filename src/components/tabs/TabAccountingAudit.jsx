import React, { useMemo } from 'react';
import { ShieldCheck, AlertOctagon, FileSearch, Scale, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatRp } from '../../utils/helpers';

export default function TabAccountingAudit({ generalLedger, inventoryCostLayers, cashflowTransactions, marketplaceSettlement }) {
  
  const audit = useMemo(() => {
    // 1. TRIAL BALANCE VALIDATOR
    let tbDebit = 0, tbCredit = 0;
    (generalLedger || []).forEach(gl => { 
        if(!gl.isDeleted) { tbDebit += Number(gl.debit)||0; tbCredit += Number(gl.credit)||0; } 
    });
    const tbDiff = Math.abs(tbDebit - tbCredit);
    const isTbBalanced = tbDiff <= 5;

    // 2. INVENTORY RECONCILIATION
    let fifoRaw = 0, fifoFrozen = 0;
    (inventoryCostLayers || []).forEach(l => {
       if(!l.isDeleted && l.status === 'ACTIVE') {
           if(String(l.item_name).toUpperCase() === 'AYAM') fifoRaw += (Number(l.qty_remaining) * Number(l.unit_cost));
           if(String(l.item_name).toUpperCase().includes('DIMSUM')) fifoFrozen += (Number(l.qty_remaining) * Number(l.unit_cost));
       }
    });

    let glRaw = 0, glFrozen = 0;
    (generalLedger || []).forEach(gl => {
       if(!gl.isDeleted) {
           if(gl.account_code === '1101') glRaw += (Number(gl.debit) - Number(gl.credit));
           if(gl.account_code === '1102') glFrozen += (Number(gl.debit) - Number(gl.credit));
       }
    });
    const invRawDiff = Math.abs(fifoRaw - glRaw);
    const invFrozenDiff = Math.abs(fifoFrozen - glFrozen);

    // 3. CASH RECONCILIATION
    let realCash = 0;
    (cashflowTransactions || []).forEach(c => {
       if(!c.isDeleted) realCash += (Number(c.amount_in || (c.type === 'CASH_IN' ? c.amount : 0)) - Number(c.amount_out || (c.type === 'CASH_OUT' ? c.amount : 0)));
    });
    let glCash = 0;
    (generalLedger || []).forEach(gl => {
       if(!gl.isDeleted && gl.account_code === '1001') glCash += (Number(gl.debit) - Number(gl.credit));
    });
    const cashDiff = Math.abs(realCash - glCash);

    // 4. MARKETPLACE RECONCILIATION
    let arMarketplace = 0;
    (marketplaceSettlement || []).forEach(m => {
       if(!m.isDeleted && m.status === 'PENDING') arMarketplace += Number(m.net);
    });
    let glArMarketplace = 0;
    (generalLedger || []).forEach(gl => {
       if(!gl.isDeleted && gl.account_code === '1002') glArMarketplace += (Number(gl.debit) - Number(gl.credit));
    });
    const arDiff = Math.abs(arMarketplace - glArMarketplace);

    // 5. NEGATIVE ACCOUNTS & DUPLICATES
    const glBalances = {};
    const refCounts = {};
    const negativeAlerts = [];
    const duplicateAlerts = [];

    (generalLedger || []).forEach(gl => {
       if(!gl.isDeleted) {
          const code = gl.account_code;
          if(!glBalances[code]) glBalances[code] = 0;
          glBalances[code] += (Number(gl.debit) - Number(gl.credit)); 

          const key = `${gl.ref_id}_${code}_${gl.debit}_${gl.credit}`;
          if(!refCounts[key]) refCounts[key] = 0;
          refCounts[key]++;
          if(refCounts[key] === 2) duplicateAlerts.push(`Indikasi Double Posting: Ref ${gl.ref_id} pada Akun ${code}`);
       }
    });

    if(glBalances['1001'] < -10) negativeAlerts.push('Kas Utama (1001) minus!');
    if(glBalances['1101'] < -10) negativeAlerts.push('Inventory Ayam (1101) minus!');
    if(glBalances['1102'] < -10) negativeAlerts.push('Inventory Frozen (1102) minus!');
    if(glBalances['2001'] > 10) negativeAlerts.push('Hutang Supplier (2001) bersaldo Debit (Abnormal)!'); // Normalnya Credit (Net minus di logika ini)

    // 6. HEALTH SCORE & AUTO REPAIR SUGGESTIONS
    let score = 100;
    const issues = [];

    if(!isTbBalanced) { score -= 40; issues.push({ type: 'CRITICAL', title: 'Trial Balance Mismatch', desc: `Total Debit dan Credit selisih Rp ${formatRp(tbDiff)}. Closing Harian DIBLOKIR. Saran: Periksa jurnal manual yang salah input.`}); }
    if(invRawDiff > 10) { score -= 10; issues.push({ type: 'WARNING', title: 'Selisih Valuasi Ayam (Raw)', desc: `GL vs Buku Gudang beda Rp ${formatRp(invRawDiff)}. Saran: Pastikan semua pembuangan (Waste) sudah dicatat ke sistem.`}); }
    if(invFrozenDiff > 10) { score -= 10; issues.push({ type: 'WARNING', title: 'Selisih Valuasi Dimsum (FG)', desc: `GL vs Buku Gudang beda Rp ${formatRp(invFrozenDiff)}. Saran: Periksa apakah ada DO masuk/Transit yang rusak namun belum di-adjust.`}); }
    if(cashDiff > 10) { score -= 15; issues.push({ type: 'CRITICAL', title: 'Selisih Kas & Bank', desc: `Arus Kas vs Buku Besar beda Rp ${formatRp(cashDiff)}. Saran: Cek duplikasi setoran cabang.`}); }
    if(arDiff > 10) { score -= 10; issues.push({ type: 'WARNING', title: 'Selisih Piutang Marketplace', desc: `Buku Piutang vs GL beda Rp ${formatRp(arDiff)}. Saran: Pastikan tidak ada double settlement pencairan.`}); }
    if(negativeAlerts.length > 0) { score -= (negativeAlerts.length * 5); negativeAlerts.forEach(n => issues.push({ type: 'CRITICAL', title: 'Saldo Akun Abnormal', desc: n })); }
    if(duplicateAlerts.length > 0) { score -= (duplicateAlerts.length * 5); duplicateAlerts.forEach(d => issues.push({ type: 'WARNING', title: 'Duplicate Journal Detected', desc: d })); }

    if (score < 0) score = 0;

    return { tbDebit, tbCredit, isTbBalanced, tbDiff, invRawDiff, invFrozenDiff, cashDiff, arDiff, score, issues, fifoRaw, glRaw, fifoFrozen, glFrozen, realCash, glCash, arMarketplace, glArMarketplace };
  }, [generalLedger, inventoryCostLayers, cashflowTransactions, marketplaceSettlement]);

  const ReconCard = ({ title, valA, valB, diff, labelA, labelB }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b pb-2 mb-3">{title}</div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold text-slate-600">{labelA}</span>
        <span className="text-sm font-black text-slate-800">{formatRp(valA)}</span>
      </div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-slate-600">{labelB}</span>
        <span className="text-sm font-black text-slate-800">{formatRp(valB)}</span>
      </div>
      <div className={`p-2 rounded-lg text-xs font-bold text-center flex justify-center items-center gap-2 ${diff <= 10 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200 animate-pulse'}`}>
        {diff <= 10 ? <><CheckCircle size={14}/> BALANCED (MATCH)</> : <><AlertTriangle size={14}/> SELISIH: {formatRp(diff)}</>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 1. HEALTH SCORE HEADER */}
      <div className="bg-slate-900 rounded-2xl p-8 relative overflow-hidden shadow-xl border border-slate-800 flex items-center justify-between">
        <div className="absolute -top-10 -right-10 text-slate-800 opacity-40"><ShieldCheck size={200}/></div>
        <div className="relative z-10 text-white flex gap-6 items-center w-full">
          <div className={`w-32 h-32 rounded-full flex flex-col items-center justify-center border-4 ${audit.score >= 90 ? 'border-emerald-500 bg-emerald-900/50' : audit.score >= 60 ? 'border-amber-500 bg-amber-900/50' : 'border-red-500 bg-red-900/50 shadow-[0_0_30px_rgba(220,38,38,0.5)]'}`}>
            <span className="text-4xl font-black">{audit.score}</span>
            <span className="text-[10px] font-bold tracking-widest uppercase">Score</span>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight mb-1 flex items-center gap-2">Financial Health & Audit Center</h2>
            <p className="text-sm text-slate-400 font-medium mb-3 max-w-lg">Sistem otomatis mencocokkan data pergerakan fisik operasional melawan catatan Buku Besar Akuntansi (GL) untuk mencegah korupsi data.</p>
            {audit.isTbBalanced ? (
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2 w-max"><Scale size={14}/> TRIAL BALANCE SEIMBANG</span>
            ) : (
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2 w-max"><AlertOctagon size={14}/> TRIAL BALANCE INVALID - CLOSING DIBLOKIR!</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. RECONCILIATION MATRICES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReconCard title="Recon 1: Kas & Bank" valA={audit.realCash} labelA="Arus Kas Fisik" valB={audit.glCash} labelB="Buku Besar Kas (1001)" diff={audit.cashDiff} />
        <ReconCard title="Recon 2: Valuasi Ayam" valA={audit.fifoRaw} labelA="Fisik Gudang (FIFO)" valB={audit.glRaw} labelB="Buku Besar Raw (1101)" diff={audit.invRawDiff} />
        <ReconCard title="Recon 3: Valuasi Dimsum" valA={audit.fifoFrozen} labelA="Fisik Freezer (FIFO)" valB={audit.glFrozen} labelB="Buku Besar FG (1102)" diff={audit.invFrozenDiff} />
        <ReconCard title="Recon 4: Piutang Marketplace" valA={audit.arMarketplace} labelA="Tagihan Pending" valB={audit.glArMarketplace} labelB="Buku Besar AR (1002)" diff={audit.arDiff} />
      </div>

      {/* 3. AUTO REPAIR SUGGESTIONS (ISSUE TRACKER) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b bg-slate-50 flex items-center gap-3">
          <Wrench size={20} className="text-slate-600"/>
          <div>
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Auto Repair Suggestions</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Temuan Mismatch & Rekomendasi Perbaikan Sistem</p>
          </div>
        </div>
        <div className="p-5">
          {audit.issues.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck size={48} className="mx-auto text-emerald-200 mb-3"/>
              <h4 className="text-emerald-700 font-bold">Semua Rekonsiliasi Cocok 100%</h4>
              <p className="text-xs text-slate-500 mt-1">Tidak ada anomali akuntansi, duplikasi jurnal, atau saldo abnormal.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {audit.issues.map((issue, idx) => (
                <div key={idx} className={`p-4 rounded-xl border flex items-start gap-4 ${issue.type === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  {issue.type === 'CRITICAL' ? <AlertOctagon size={24} className="text-red-600 shrink-0"/> : <AlertTriangle size={24} className="text-amber-500 shrink-0"/>}
                  <div>
                    <div className="font-black text-sm uppercase">{issue.title}</div>
                    <div className="text-xs font-medium mt-1">{issue.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
