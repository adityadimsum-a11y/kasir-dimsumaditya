import { apiRequest } from './erpApiClient';

const READ_ONLY_MESSAGE = 'Fitur simpan ini belum disambungkan ke mesin baru pada bridge tahap ini.';

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

const normalizeTable = (value) => String(value || '').trim().toLowerCase();
const normalizeAction = (value) => String(value || '').trim().toLowerCase();

const firstPayload = (payload) => asArray(payload)[0] || payload || {};

const parseMaybeJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
};

const isHandledSideEffectTable = (table) => {
  return [
    'inventory_cost_layers',
    'stock_movements',
    'cashflow_transactions',
    'payments',
    'piutang_payments',
  ].includes(table);
};

export async function legacyWriteAction({ action, tableName, payload, user, sessionToken, requestId }) {
  const table = normalizeTable(tableName);
  const oldAction = normalizeAction(action);

  if (!sessionToken) {
    return {
      success: false,
      message: 'Session backend baru kosong. Silakan login ulang.',
    };
  }

  if (oldAction === 'delete') {
    return {
      success: false,
      message: 'Hapus/void transaksi lama belum aktif. Nanti diarahkan ke endpoint void/reversal baru, bukan delete manual.',
    };
  }

  // ======================================================
  // 1) QUICK CUSTOMER dari modal Kasir Lama
  // table lama: master_customers
  // backend bridge: legacyCreateCustomerFromOldPos
  // ======================================================
  if (table === 'master_customers' && oldAction === 'insert') {
    const rows = asArray(payload);
    let lastResult = null;

    for (const row of rows) {
      lastResult = await apiRequest(
        'legacyCreateCustomerFromOldPos',
        {
          customer: row,
          legacy_payload: row,
          request_id: requestId,
          user_context: {
            user_id: user?.user_id || user?.id || '',
            username: user?.username || '',
            location_id: user?.location_id || user?.branch_id || '',
          },
        },
        sessionToken,
      );

      if (!lastResult.success) return lastResult;
    }

    return {
      success: true,
      message: lastResult?.message || 'Customer berhasil diproses mesin baru.',
      data: lastResult?.data || null,
    };
  }

  // ======================================================
  // 2) ORDER / KASIR LAMA
  // table lama: orders
  // backend bridge: legacyCreateOrderFromOldPos
  // Catatan:
  // - Backend bridge membuat Order + Items + Invoice + Payment + Piutang + Wallet Mutation.
  // - UI lama masih akan memanggil inventory/cashflow setelah order sukses.
  //   Panggilan side-effect itu kita jadikan no-op success supaya tidak double posting.
  // ======================================================
  if (table === 'orders' && oldAction === 'insert') {
    const order = firstPayload(payload);

    return apiRequest(
      'legacyCreateOrderFromOldPos',
      {
        order,
        legacy_order: order,
        items: parseMaybeJson(order?.items, []),
        payment_breakdown: parseMaybeJson(order?.payment_breakdown_json, []),
        request_id: requestId,
        source: 'LEGACY_POS_TAB_ORDERS',
        user_context: {
          user_id: user?.user_id || user?.id || '',
          username: user?.username || '',
          location_id: user?.location_id || user?.branch_id || '',
        },
      },
      sessionToken,
    );
  }



  // ======================================================
  // 2A) DROP AYAM / PURCHASE SUPPLIER NANA
  // table lama: purchases
  // backend bridge: legacyCreateChickenDropFromOldPurchase
  // Catatan:
  // - Ini gerbang resmi agar Produksi/Adukan punya stok ayam.
  // - Membuat Chicken Lot + Stock IN + Hutang Supplier + Journal Preview.
  // ======================================================
  if (table === 'purchases' && oldAction === 'insert') {
    const purchase = firstPayload(payload);

    return apiRequest(
      'legacyCreateChickenDropFromOldPurchase',
      {
        purchase,
        legacy_purchase: purchase,
        request_id: requestId,
        source: 'LEGACY_PURCHASE_TAB_CHICKEN_DROP',
        user_context: {
          user_id: user?.user_id || user?.id || '',
          username: user?.username || '',
          location_id: user?.location_id || user?.branch_id || '',
        },
      },
      sessionToken,
    );
  }


  if (table === 'orders' && oldAction === 'update') {
    return {
      success: false,
      message: 'Edit nota dari kasir lama belum aktif di Bridge Package 2. Untuk koreksi aman, nanti dibuat flow revisi/void resmi.',
    };
  }

  // Side effects lama sudah ditangani oleh legacyCreateOrderFromOldPos.
  if (isHandledSideEffectTable(table) && oldAction === 'insert') {
    return {
      success: true,
      message: 'Side-effect lama dilewati karena transaksi utama sudah diproses mesin baru.',
      data: {
        skipped_table: table,
        bridge_mode: 'NO_DOUBLE_POSTING',
      },
    };
  }



  // ======================================================
  // 2B) PRODUKSI / ADUKAN LAMA
  // table lama: pemalang
  // backend bridge: legacyCreateProductionBatchFromOldFactory
  // Catatan:
  // - UI lama tetap boleh memakai route/tab pemalang untuk kompatibilitas.
  // - Backend baru menulis Production Batch + Stock Movement IN barang jadi.
  // - Inventory side-effect lama setelah submit tetap no-op agar tidak double posting.
  // ======================================================
  if (table === 'pemalang' && oldAction === 'insert') {
    const batch = firstPayload(payload);

    return apiRequest(
      'legacyCreateProductionBatchFromOldFactory',
      {
        batch,
        legacy_batch: batch,
        items: parseMaybeJson(batch?.items_json || batch?.items, []),
        request_id: requestId,
        source: 'LEGACY_FACTORY_TAB_PEMALANG',
        user_context: {
          user_id: user?.user_id || user?.id || '',
          username: user?.username || '',
          location_id: user?.location_id || user?.branch_id || '',
        },
      },
      sessionToken,
    );
  }

  if (table === 'pemalang' && oldAction === 'update') {
    const batch = firstPayload(payload);

    return apiRequest(
      'legacyVoidProductionBatchFromOldFactory',
      {
        batch,
        legacy_batch: batch,
        request_id: requestId,
        source: 'LEGACY_FACTORY_TAB_PEMALANG_VOID',
        user_context: {
          user_id: user?.user_id || user?.id || '',
          username: user?.username || '',
          location_id: user?.location_id || user?.branch_id || '',
        },
      },
      sessionToken,
    );
  }

  // ======================================================
  // 2C) PO KARANTINA / PO HARIAN / PINJAM STOK
  // table lama baru: po_stock_plans / stock_allocations / antrian_po
  // backend bridge: legacyCreatePOStockPlanFromOldQueue
  // Catatan:
  // - Ini hanya menahan / merencanakan stok, bukan omzet.
  // - Uang DP/lunas tetap masuk payment/order resmi pada flow berikutnya.
  // ======================================================
  if (['po_stock_plans', 'stock_allocations', 'antrian_po', 'po_karantina', 'daily_po'].includes(table) && oldAction === 'insert') {
    const plan = firstPayload(payload);

    return apiRequest(
      'legacyCreatePOStockPlanFromOldQueue',
      {
        po_plan: plan,
        legacy_po: plan,
        request_id: requestId,
        source: 'LEGACY_TAB_ANTRIAN_PO_5C',
        user_context: {
          user_id: user?.user_id || user?.id || '',
          username: user?.username || '',
          location_id: user?.location_id || user?.branch_id || '',
        },
      },
      sessionToken,
    );
  }

  // ======================================================
  // 3) Bridge test opsional
  // ======================================================
  if (table === 'bridge_test') {
    return apiRequest('legacyBridgePing', { action, tableName, payload, requestId }, sessionToken);
  }

  return {
    success: false,
    message: READ_ONLY_MESSAGE,
  };
}
