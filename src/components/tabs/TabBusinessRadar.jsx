import React, { useState } from 'react';
import { 
  TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, 
  AlertCircle, ShieldAlert, Users, Percent, Gift, 
  Activity, ArrowRight, User, Calendar, FileText, CheckCircle2
} from 'lucide-react';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabBusinessRadar({ 
  orders = [], 
  cashflowTransactions = [], 
  master_customers = [],
  user
}) {
  // --- STATE UNTUK POPUP MODAL MADING PIUTANG ---
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [filterPeriode, setFilterPeriode] = useState('7_HARI'); // 7_HARI | 30_HARI

  const todayStr = new Date().toISOString().split('T')[0];

  // ===================================================================
  // ⚙️ ENGINE RE-COMPUTE INTERNAL (MIRRORING DARI HOOKS JAMINAN INTEGRITAS)
  // ===================================================================
  const rekapMading = React.useMemo(() => {
    const getDaysDifference = (d1, d2) => {
      const diffTime = Math.abs(new Date(d1) - new Date(d2));
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Ambil parameter rentang waktu fluktuasi
    const todayObj = new Date();
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(todayObj.getDate() - 7);
    const limitSevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

    const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(todayObj.getDate() - 14);
    const limitFourteenDaysStr = fourteenDaysAgo.toISOString().split('T')[0];

    let totalOmsetHariIni = 0;
    let totalPengeluaranRiil = 0;

    // Kalkulasi Cashflow & Pengeluaran Riil
    (cashflowTransactions || []).forEach(c => {
      if (c.isDeleted) return;
      if ((c.transaction_type === 'OUTFLOW' || c.type === 'CASH_OUT' || c.type === 'OUT') && c.date === todayStr) {
        totalPengeluaranRiil += Number(c.amount || 0);
      }
    });

    const customerPiutangMap = {};
    const groupOrders = {};

    // Inisialisasi Master Pelanggan
    (master_customers || []).forEach(cust => {
      customerPiutangMap[cust.customer_name.toUpperCase()] = {
        customer_id: cust.id,
        customer_name: cust.customer_name.toUpperCase(),
        phone: cust.phone || '-',
        address: cust.address || '-',
        notes_crm: cust.notes || '-',
        total_bon_gantung: 0,
        tanggal_bon_terlama: null,
        last_order_date: null,
        qty_order_minggu_ini: 0,
        qty_order_minggu_lalu: 0,
        total_belanja_akumulasi: 0,
        frequency_order: 0,
        nota_details: []
      };
    });

    // Kalkulasi Transaksi POS
    (orders || []).forEach(o => {
      if (o.isDeleted) return;
      const oId = o.id;
      const cName = String(o.customer_name || o.customer || 'UMUM').toUpperCase();

      if (o.date === todayStr) {
        totalOmsetHariIni += Number(o.total_amount || o.total || 0);
      }

      if (!groupOrders[oId]) {
        groupOrders[oId] = { 
          id: oId, date: o.date, customer: cName, tagihan: 0, 
          bayar: Number(o.amount_paid || o.paidAmount || 0), 
          method: o.payment_method || o.paymentMethod, status: o.status 
        };
      }
      groupOrders[oId].tagihan += Number(o.total_amount || o.total || 0);

      if (customerPiutangMap[cName]) {
        const qtyOrder = Number(o.qty || 0);
        customerPiutangMap[cName].total_belanja_akumulasi += Number(o.total_amount || o.total || 0);
        customerPiutangMap[cName].frequency_order += 1;
        
        if (!customerPiutangMap[cName].last_order_date || new Date(o.date) > new Date(customerPiutangMap[cName].last_order_date)) {
          customerPiutangMap[cName].last_order_date = o.date;
        }

        // Analitik Fluktuasi Pembelian Mingguan
        if (o.date >= limitSevenDaysStr && o.date <= todayStr) {
          customerPiutangMap[cName].qty_order_minggu_ini += qtyOrder;
        } else if (o.date >= limitFourteenDaysStr && o.date < limitSevenDaysStr) {
          customerPiutangMap[cName].qty_order_minggu_lalu += qtyOrder;
        }
      }
    });

    // Kalkulasi Sisa Bon Gantung
    let totalPiutangGlobal = 0;
    Object.values(groupOrders).forEach(go => {
      const sisaHutang = go.tagihan - go.bayar;
      if (sisaHutang > 0 && (go.method === 'PIUTANG' || go.method === 'TEMPO' || go.status === 'BELUM_LUNAS')) {
        totalPiutangGlobal += sisaHutang;
        const cName = go.customer;

        if (customerPiutangMap[cName]) {
          customerPiutangMap[cName].total_bon_gantung += sisaHutang;
          customerPiutangMap[cName].nota_details.push({
            invoice_id: go.id,
            date: go.date,
            total_tagihan: go.tagihan,
            sudah_dibayar: go.bayar,
            sisa_hutang: sisaHutang,
            metode_asal: go.method
          });

          if (!customerPiutangMap[cName].tanggal_bon_terlama || new Date(go.date) < new Date(customerPiutangMap[cName].tanggal_bon_terlama)) {
            customerPiutangMap[cName].tanggal_bon_terlama = go.date;
          }
        }
      }
    });

    // Mapping Report Mading Pelanggan
    const listMadingPiutang = Object.values(customerPiutangMap)
      .map(cust => {
        let harianAbsen = cust.last_order_date ? getDaysDifference(todayStr, cust.last_order_date) : 999;
        let statusNotifMerah = harianAbsen > 7; 
        
        let trenFluktuasi = 'STABIL';
        let selisihPcs = cust.qty_order_minggu_ini - cust.qty_order_minggu_lalu;
        if (selisihPcs > 0) trenFluktuasi = 'NAIK';
        if (selisihPcs < 0) trenFluktuasi = 'TURUN';

        return {
          ...cust,
          hari_absen: harianAbsen,
          is_notif_merah: statusNotifMerah,
          tren_fluktuasi: trenFluktuasi,
          selisih_pcs_mingguan: Math.abs(selisihPcs)
        };
      })
      .filter(c => c.total_bon_gantung > 0 || c.frequency_order > 0)
      .sort((a, b) => b.total_bon_gantung - a.total_bon_gantung);

    // Rasio Split 4 Amplop Sakral + Amplop THR (5%)
    const amplopBahanBaku = totalOmsetHariIni * 0.55;
    const amplopOperasional = totalOmsetHariIni * 0.20;
    const amplopJagaJaga = totalOmsetHariIni * 0.10;
    const amplopProfitMurni = totalOmsetHariIni * 0.10;
    const amplopAlokasiTHR = totalOmsetHariIni * 0.05;

    return {
      totalOmsetHariIni,
      totalPengeluaranRiil,
      totalPiutangGlobal,
      amplop: {
        bahanBaku: amplopBahanBaku,
        operasional: amplopOperasional,
        jagaJaga: amplopJagaJaga,
        profitMurni: amplopProfitMurni,
        alokasiTHR: amplopAlokasiTHR
      },
      listMadingPiutang
    };
  }, [orders, cashflowTransactions, master_customers, todayStr]);

  const { amplop, listMadingPiutang } = rekapMading;

  // Filter khusus untuk mading pengawasan tagihan macet
  const piutangMacetMading = useMemo(() => {
    return listMadingPiutang.filter(c => c.total_bon_gantung > 0);
  }, [listMadingPiutang]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* HEADER UTAMA */}
      <div className="card-holo p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="pl-2">
          <h2 className="text-sm font-black normal-case flex items-center gap-2 text-slate-800">
            <TrendingUp className="text-red-600" size={18}/> Radar Bisnis &amp; Analitik Sultan Core
          </h2>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5 normal-case">
            Pemantauan otomatis rasio 4 amplop kas laci, kontrol HPP, serta alarm radar pengawasan piutang jatuh tempo.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0">
          <button onClick={() => setFilterPeriode('7_HARI')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${filterPeriode === '7_HARI' ? 'bg-white text-blue-600 shadow-3xs' : 'text-slate-500'}`}>Hari ini / 7 Hari</button>
          <button onClick={() => setFilterPeriode('30_HARI')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${filterPeriode === '30_HARI' ? 'bg-white text-blue-600 shadow-3xs' : 'text-slate-500'}`}>30 Hari Terakhir</button>
        </div>
      </div>

      {/* 💰 MADINGS BARIS 1: ALIRAN OMSET UTAMA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Aliran Omset Masuk (Hari Ini)</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(rekapMading.totalOmsetHariIni)}</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><ArrowUpRight size={20}/></div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Pengeluaran Kas (Hari Ini)</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(rekapMading.totalPengeluaranRiil)}</div>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><ArrowDownRight size={20}/></div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimasi Sisa Selisih Laba</div>
            <div className={`text-2xl font-black tracking-tight ${rekapMading.totalOmsetHariIni - rekapMading.totalPengeluaranRiil >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatRupiah(rekapMading.totalOmsetHariIni - rekapMading.totalPengeluaranRiil)}
            </div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Activity size={20}/></div>
        </div>
      </div>

      {/* 📂 MADINGS BARIS 2: RESTORASI PAPAN 4 AMPLOP SAKRAL + AMPLOP THR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <h3 className="text-xs font-black text-slate-800 normal-case mb-4 flex items-center gap-1.5">
          <Wallet size={16} className="text-blue-600" /> Papan Alokasi 4 Amplop Pendapatan &amp; Tabungan THR (Real-Time Split)
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl shadow-3xs text-center">
            <div className="text-[9px] font-black text-red-700 uppercase mb-1">📦 Amplop 1 (Bahan 55%)</div>
            <div className="text-sm font-black text-slate-800">{formatRupiah(amplop.bahanBaku)}</div>
          </div>
          
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl shadow-3xs text-center">
            <div className="text-[9px] font-black text-blue-700 uppercase mb-1">⚙️ Amplop 2 (Ops 20%)</div>
            <div className="text-sm font-black text-slate-800">{formatRupiah(amplop.operasional)}</div>
          </div>
          
          <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl shadow-3xs text-center">
            <div className="text-[9px] font-black text-amber-700 uppercase mb-1">⚡ Amplop 3 (Jaga 10%)</div>
            <div className="text-sm font-black text-slate-800">{formatRupiah(amplop.jagaJaga)}</div>
          </div>
          
          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-3xs text-center">
            <div className="text-[9px] font-black text-emerald-700 uppercase mb-1">💰 Amplop 4 (Profit 10%)</div>
            <div className="text-sm font-black text-emerald-600">{formatRupiah(amplop.profitMurni)}</div>
          </div>

          {/* 🔥 AMPLOP BARU: CADANGAN THR & BONUS FISIK BARANG */}
          <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-xl shadow-3xs text-center col-span-2 md:col-span-1 border-dashed">
            <div className="text-[9px] font-black text-purple-700 uppercase mb-1 flex items-center justify-center gap-1"><Gift size={10}/> Amplop 5 (Cadangan THR 5%)</div>
            <div className="text-sm font-black text-purple-700">{formatRupiah(amplop.alokasiTHR)}</div>
          </div>
        </div>
      </div>

      {/* 🕵️‍♂️ BARIS 3: MADING RADAR PENGAWASAN TAGIHAN MACET & BON GANTUNG */}
      <div className="card-holo bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h4 className="font-black text-xs text-white flex items-center gap-2 normal-case">
              <ShieldAlert size={16} className="text-yellow-400 animate-pulse"/> Radar Pengawasan Tagihan Macet &amp; Bon Gantung Agen
            </h4>
            <p className="text-[9px] text-slate-400 mt-0.5">Daftar mading detail seluruh piutang berjalan yang wajib ditagih / difollow-up.</p>
          </div>
          <span className="bg-yellow-500 text-slate-950 px-2.5 py-1 rounded-lg text-[9px] font-black shadow-3xs">Total Bon Global: {formatRupiah(rekapMading.totalPiutangGlobal)}</span>
        </div>

        <div className="overflow-x-auto p-1 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[10px] normal-case text-slate-500 bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-black">Nama Agen / Pelanggan</th>
                <th className="px-4 py-3 font-black text-center">Status Absen Order</th>
                <th className="px-4 py-3 font-black text-center">Tren Kuantitas Mingguan</th>
                <th className="px-4 py-3 font-black text-right">Bon Gantung Aktif</th>
                <th className="px-4 py-3 font-black text-center">Aksi Tracing</th>
              </tr>
            </thead>
            <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
              {piutangMacetMading.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-16 text-slate-400 font-bold normal-case bg-white">
                     <div className="flex flex-col items-center justify-center">
                       <CheckCircle2 size={36} className="mb-2 text-emerald-500 opacity-30"/>
                       <span>BERSIH TOTAL! Tidak ada tagihan gantung yang menunggak saat ini.</span>
                     </div>
                  </td>
                </tr>
              ) : (
                piutangMacetMading.map((cust, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-slate-800 font-black text-[13px] normal-case flex items-center gap-2">
                        👤 {cust.customer_name} 
                        {/* 🚨 INDIKATOR LAMPU MERAH ABSEN BELANJA > 7 HARI */}
                        {cust.is_notif_merah && (
                          <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-100 text-rose-700 border border-rose-200 animate-pulse uppercase tracking-wider">⚠️ Macet Belanja</span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-1">ID: {cust.customer_id || 'CRM-MKT'} | 📞 {cust.phone}</div>
                    </td>
                    
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <div className={`text-[11px] font-extrabold ${cust.is_notif_merah ? 'text-rose-600' : 'text-slate-700'}`}>
                        {cust.hari_absen === 999 ? 'Belum Pernah Order' : `${cust.hari_absen} Hari Absen`}
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium mt-0.5 normal-case">Terakhir: {cust.last_order_date ? formatDate(cust.last_order_date) : '-'}</div>
                    </td>

                    {/* 📉 ABSEN / FLUKTUASI MINGGUAN PCS */}
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      {cust.tren_fluktuasi === 'NAIK' && (
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">🔼 Naik +{formatNumber(cust.selisih_pcs_mingguan)} Pcs</span>
                      )}
                      {cust.tren_fluktuasi === 'TURUN' && (
                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">🔽 Turun -{formatNumber(cust.selisih_pcs_mingguan)} Pcs</span>
                      )}
                      {cust.tren_fluktuasi === 'STABIL' && (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Stabil (0)</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <div className="font-black text-rose-600 text-sm tracking-tight">{formatRupiah(cust.total_bon_gantung)}</div>
                      <div className="text-[9px] text-slate-400 font-medium mt-0.5 normal-case">Bon Terlama: {cust.tanggal_bon_terlama ? formatDate(cust.tanggal_bon_terlama) : '-'}</div>
                    </td>

                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => setSelectedCustomerDetail(cust)}
                        className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 hover:border-blue-400 hover:text-blue-600 font-black text-[10px] rounded-lg shadow-3xs transition-colors flex items-center justify-center mx-auto gap-1 cursor-pointer"
                      >
                        Buka Mading Bon <ArrowRight size={12}/>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📊 BARIS 4: KLASEMEN LEADERBOARD AKUMULASI CRM (UNTUK STRATEGI BONUS & THR) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-black text-slate-800 normal-case flex items-center gap-1.5">
              <Users size={16} className="text-purple-600" /> Klasemen Loyalitas &amp; Kelayakan Bonus THR Agen (Akumulasi Belanja)
            </h3>
            <p className="text-[9px] font-bold text-slate-400 normal-case mt-0.5">Peringkat dihitung berdasarkan akumulasi volume rupiah belanja untuk alokasi THR Akhir Tahun.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
          {listMadingPiutang.map((cust, idx) => (
            <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-purple-300 hover:bg-purple-50/10 transition-all shadow-3xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-sm shrink-0 ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                  #{idx + 1}
                </div>
                <div className="min-w-0">
                  <div className="font-black text-slate-800 text-xs uppercase truncate">{cust.customer_name}</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-0.5 normal-case">
                    {cust.frequency_order}x Transaksi • Total Kontribusi Omset: <span className="text-slate-800 font-black">{formatRupiah(cust.total_belanja_akumulasi)}</span>
                  </div>
                </div>
              </div>
              
              {/* STATUS REKOMENDASI KELAYAKAN THR */}
              <div className="text-right shrink-0">
                <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${cust.total_belanja_akumulasi > 10000000 ? 'bg-purple-100 text-purple-700 border border-purple-200' : cust.total_belanja_akumulasi > 3000000 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {cust.total_belanja_akumulasi > 10000000 ? '⭐ KLIEN VIP (THR UTAMA)' : cust.total_belanja_akumulasi > 3000000 ? 'MITRA SETIA' : 'REGULER'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===================================================================
          📑 POPUP MODAL DETAIL MADING BON GANTUNG AGEN (CLICK INTERACTIVE)
      =================================================================== */}
      {selectedCustomerDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col h-[70vh]">
            
            {/* Header Modal */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-sm uppercase flex items-center gap-1.5"><User size={16} className="text-yellow-400"/> Mading Tracing: {selectedCustomerDetail.customer_name}</h3>
                <p className="text-[9px] text-slate-400 font-medium normal-case mt-0.5">Alamat: {selectedCustomerDetail.address} | Telp: {selectedCustomerDetail.phone}</p>
              </div>
              <button onClick={() => setSelectedCustomerDetail(null)} className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer">✕</button>
            </div>

            {/* Isi Detail Bon */}
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-4 bg-slate-50">
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-3xs text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Total Bon Gantung</div>
                  <div className="text-lg font-black text-rose-600 tracking-tight">{formatRupiah(selectedCustomerDetail.total_bon_gantung)}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-3xs text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Akumulasi Belanja Historis</div>
                  <div className="text-lg font-black text-slate-800 tracking-tight">{formatRupiah(selectedCustomerDetail.total_belanja_akumulasi)}</div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-3xs overflow-hidden">
                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-700 uppercase flex items-center gap-1"><FileText size={12}/> Daftar Nota/Invoice Yang Belum Lunas</div>
                <div className="divide-y divide-slate-100 text-xs font-bold">
                  {selectedCustomerDetail.nota_details.map((nota, nIdx) => (
                    <div key={nIdx} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="text-[9px] font-mono text-slate-400">{nota.invoice_id}</div>
                        <div className="text-[10px] font-bold text-slate-600 mt-0.5 flex items-center gap-1"><Calendar size={10}/> Tanggal Nota: {formatDate(nota.date)}</div>
                        <div className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-max mt-1">METODE ASAL: {nota.metode_asal}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-800 font-medium text-[10px] normal-case">Tagihan: {formatRupiah(nota.total_tagihan)}</div>
                        <div className="text-slate-400 font-medium text-[10px] normal-case mt-0.5">Sudah Di-DP: {formatRupiah(nota.sudah_dibayar)}</div>
                        <div className="font-black text-rose-600 text-xs mt-1">Sisa: {formatRupiah(nota.sisa_hutang)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Memo Internal CRM */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3 text-[10px] font-bold text-amber-800 uppercase leading-relaxed">
                📌 Catatan Master CRM: "{selectedCustomerDetail.notes_crm}"
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-right shrink-0">
              <button 
                onClick={() => setSelectedCustomerDetail(null)} 
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase rounded-xl tracking-wider cursor-pointer shadow-md transition-colors"
              >
                Tutup Mading Tracing
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
