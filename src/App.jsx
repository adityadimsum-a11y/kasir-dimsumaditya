import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, Clock, Store, Loader2, LogOut, 
  Package, Truck, Users, AlertCircle, Activity, Send, ShieldAlert, TrendingUp, WifiOff, PieChart, Menu, X, Search, Bell, CheckCircle, Radar, BookOpen, ShieldCheck, Database, RefreshCcw
} from 'lucide-react';

// ... (IMPORT TABS AND PRINT COMPONENTS EXACTLY AS BEFORE) ...
import TabDashboard from './components/tabs/TabDashboard';
import TabOrders from './components/tabs/TabOrders';
import TabPurchases from './components/tabs/TabPurchases';
import TabExpenses from './components/tabs/TabExpenses';
import TabPiutang from './components/tabs/TabPiutang';
import TabPemalang from './components/tabs/TabPemalang';
import TabStok from './components/tabs/TabStok';
import TabDistribusi from './components/tabs/TabDistribusi';
import TabKaryawan from './components/tabs/TabKaryawan';
import TabMonitoringPemalang from './components/tabs/TabMonitoringPemalang';
import TabDashboardBranch from './components/tabs/TabDashboardBranch';
import TabCashWarRoom from './components/tabs/TabCashWarRoom';
import TabSCMWarRoom from './components/tabs/TabSCMWarRoom'; 
import TabAnalytics from './components/tabs/TabAnalytics'; 
import TabBusinessRadar from './components/tabs/TabBusinessRadar'; 
import TabAccounting from './components/tabs/TabAccounting'; 
import TabAccountingAudit from './components/tabs/TabAccountingAudit'; 
import TabMasterData from './components/tabs/TabMasterData'; 
import PrintDotMatrix from './components/PrintDotMatrix';

import { generateRequestId } from './utils/helpers'; 

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec'; 

// =====================================================================
// PHASE 11: ADVANCED CACHE & BACKGROUND SYNC ENGINE
// =====================================================================
const CACHE_TTL = 60000; // 60 Detik Cache
let globalCache = { data: null, timestamp: 0 };

function useDataEngine(user, showToast) {
  const [data, setData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [fetchError, setFetchError] = useState(null);
  
  // BACKGROUND SYNC QUEUE
  const offlineQueueRef = useRef(JSON.parse(window.localStorage.getItem('erp_offline_queue') || '[]'));

  useEffect(() => {
    const handleOnline = async () => {
        setIsOffline(false);
        showToast("🌐 Koneksi pulih. Memproses antrean data...", 'success');
        if (offlineQueueRef.current.length > 0) await processOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const processOfflineQueue = async () => {
      const queue = offlineQueueRef.current;
      if (queue.length === 0) return;
      setIsLoading(true);
      const newQueue = [];
      for (let req of queue) {
          try {
              const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(req) });
              const result = await res.json();
              if (result.status !== 'success') newQueue.push(req); // Retry later if failed
          } catch(e) { newQueue.push(req); }
      }
      offlineQueueRef.current = newQueue;
      window.localStorage.setItem('erp_offline_queue', JSON.stringify(newQueue));
      if(newQueue.length === 0) showToast("✅ Semua antrean offline berhasil disinkronisasi.", 'success');
      fetchData(true); // Force refresh
  };

  const fetchData = useCallback(async (force = false) => {
    if (!SCRIPT_URL || isOffline) return;
    
    // CACHE LAYER: Jangan fetch jika belum 60 detik (kecuali force refresh)
    const now = new Date().getTime();
    if (!force && globalCache.data && (now - globalCache.timestamp < CACHE_TTL)) {
        setData(globalCache.data); return;
    }

    setIsLoading(true); setFetchError(null);
    try {
      // Lazy Fetch Mechanism: Idealnya memanggil read_table per module, 
      // namun untuk menjaga kompatibilitas, kita load all dengan agregasi tinggi.
      const response = await fetch(`${SCRIPT_URL}?action=read_all&limit=2000`);
      if(!response.ok) throw new Error("Gagal mengambil data server.");
      const result = await response.json();
      
      if (result.status === 'success') {
        const raw = result.data || [];
        const sortData = (arr) => arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        // Pengelompokan Data Cepat
        const processed = {
            masterUsers: raw.filter(i => i.table === 'users' && !i.isDeleted),
            masterBranches: raw.filter(i => i.table === 'branches' && !i.isDeleted),
            orders: sortData(raw.filter(i => i.table === 'orders' && !i.isDeleted)),
            expenses: sortData(raw.filter(i => i.table === 'expenses' && !i.isDeleted)),
            purchases: sortData(raw.filter(i => i.table === 'purchases' && !i.isDeleted)),
            stockMovements: sortData(raw.filter(i => i.table === 'stock_movements' && !i.isDeleted)),
            generalLedger: sortData(raw.filter(i => i.table === 'general_ledger' && !i.isDeleted)),
            chartOfAccounts: raw.filter(i => i.table === 'chart_of_accounts' && !i.isDeleted),
            masterProducts: raw.filter(i => i.table === 'master_products' && !i.isDeleted),
            masterRawMaterials: raw.filter(i => i.table === 'master_raw_materials' && !i.isDeleted),
            masterSuppliers: raw.filter(i => i.table === 'master_suppliers' && !i.isDeleted),
            // ... (Sisanya)
            piutangPayments: sortData(raw.filter(i => i.table === 'payments' && !i.isDeleted)),
            pemalangReports: sortData(raw.filter(i => i.table === 'pemalang' && !i.isDeleted)),
            karyawan: sortData(raw.filter(i => i.table === 'karyawan' && !i.isDeleted)),
            productionBatches: sortData(raw.filter(i => i.table === 'production_batches' && !i.isDeleted)),
            distributionOrders: sortData(raw.filter(i => i.table === 'distribution_orders' && !i.isDeleted)),
            supplierLedger: sortData(raw.filter(i => i.table === 'supplier_ledger' && !i.isDeleted)),
            cashflowTransactions: sortData(raw.filter(i => i.table === 'cashflow_transactions' && !i.isDeleted)),
            marketplaceSettlement: sortData(raw.filter(i => i.table === 'marketplace_settlement' && !i.isDeleted)),
            inventoryCostLayers: sortData(raw.filter(i => i.table === 'inventory_cost_layers' && !i.isDeleted)),
            discrepancyLogs: sortData(raw.filter(i => i.table === 'discrepancy_logs' && !i.isDeleted)),
            financialClosings: sortData(raw.filter(i => i.table === 'financial_closings' && !i.isDeleted))
        };
        
        globalCache = { data: processed, timestamp: now };
        setData(processed);
      }
    } catch (error) { 
        setFetchError("Koneksi terputus atau server sedang sibuk."); 
    } finally { setIsLoading(false); }
  }, [isOffline]);

  // DUPLICATE REQUEST GUARD & BACKGROUND QUEUE
  const sendToSheet = async (action, payloadData, table) => {
    const reqId = generateRequestId();
    const requestPayload = { action, table, data: payloadData, executor: user, request_id: reqId };

    if (isOffline) { 
        offlineQueueRef.current.push(requestPayload);
        window.localStorage.setItem('erp_offline_queue', JSON.stringify(offlineQueueRef.current));
        showToast("⚠️ OFFLINE: Transaksi masuk antrean background sync.", 'error'); 
        return true; // Asumsikan sukses agar UI bisa reset
    }

    if (isLoading) { showToast("⏳ Mohon tunggu, mencegah double click...", 'error'); return false; }
    
    setIsLoading(true);
    try { 
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(requestPayload) }); 
        const result = await response.json();
        
        if (result.status === 'error' || result.status === 'forbidden') {
            showToast(`⛔ GAGAL: ${result.message || 'Validasi Ditolak'}`, 'error'); 
            setIsLoading(false); return false;
        }
        
        showToast(`✅ ${result.data?.message || 'Transaksi Tersimpan.'}`, 'success');
        await fetchData(true); // SAFE REFETCH: Force override cache
        return true;
    } catch (error) { 
        // Jika putus di tengah jalan, lempar ke Queue
        offlineQueueRef.current.push(requestPayload);
        window.localStorage.setItem('erp_offline_queue', JSON.stringify(offlineQueueRef.current));
        showToast("🚨 Jaringan putus. Transaksi diamankan di Background Sync.", 'error'); 
        setIsLoading(false); return true;
    }
  };

  return { data, isLoading, isOffline, fetchError, fetchData, sendToSheet };
}

// ... [KODE UI DAN ROUTING (App() & UniversalNodeLayout) TETAP SAMA SEPERTI SEBELUMNYA] ...
