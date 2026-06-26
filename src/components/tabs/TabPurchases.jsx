import React, { useState, useMemo } from 'react';
import {
  Calendar,
  FileText,
  Trash2,
  Printer,
  Wallet,
  Truck,
  CheckCircle2,
  Plus,
  ShoppingCart,
  User,
  Database,
  Edit2,
  AlertTriangle,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import {
  isNanaSupplierName,
  makeNanaPurchaseLedgerRecord,
  makeNanaPaymentLedgerRecord,
} from '../../utils/erpHutangAyamCore';

const formatRupiah = (angka) => `Rp ${Number(angka || 0).toLocaleString('id-ID')}`;
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

const normalizeDateStr = (dateVal) => {
  if (!dateVal) return '';

  const strVal = String(dateVal);
  if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) return strVal.substring(0, 10);
  if (strVal.includes('T')) return strVal.split('T')[0];

  const parts = strVal.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }

  return strVal.substring(0, 10);
};

export default function TabPurchases({
  purchases = [],
  purchases_data,
  inventoryCostLayers = [],
  inventory_cost_layers,
  expenses = [],
  expenses_data,
  masterSuppliers = [],
  master_suppliers,
  masterRawMaterials = [],
  master_raw_materials,
  karyawan = [],
  master_karyawan,
  masterConversionRules = [],
  master_conversion_rules = [],
  sendToSheet,
  showToast,
  user,
  requestDelete,
  setPrintData,
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id)
    ? 'TANGERANG_PUSAT'
    : user?.branch_id;

  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realSuppliers = useMemo(() => master_suppliers || masterSuppliers || [], [master_suppliers, masterSuppliers]);
  const realRawMaterials = useMemo(() => master_raw_materials || masterRawMaterials || [], [master_raw_materials, masterRawMaterials]);
  const realKaryawan = useMemo(() => master_karyawan || karyawan || [], [karyawan, master_karyawan]);
  const realInventory = useMemo(() => inventory_cost_layers || inventoryCostLayers || [], [inventory_cost_layers, inventoryCostLayers]);
  const realConversionRules = useMemo(() => master_conversion_rules || masterConversionRules || [], [master_conversion_rules, masterConversionRules]);

  const activeRule = useMemo(() => {
    return realConversionRules.find((rule) => rule.id === 'RULE-GLOBAL' && !rule.isDeleted);
  }, [realConversionRules]);

  const kgPerKantong = Number(activeRule?.kg_per_kantong || 10);

  const [activeSubTab, setActiveTab] = useState('SUPPLIER');
  const [tableDateFilter, setTableDateFilter] = useState(todayStr.substring(0, 7));
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);

  const handleMoneyInput = (val, setRaw, setDisplay) => {
    const rawVal = val.replace(/\D/g, '');
    setRaw(rawVal);
    setDisplay(rawVal ? Number(rawVal).toLocaleString('id-ID') : '');
  };

  const stockGudang = useMemo(() => {
    let ayamKg = 0;

    realInventory.forEach((inventoryRow) => {
      if (inventoryRow.isDeleted || (inventoryRow.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return;

      if (inventoryRow.category === 'BAHAN_BAKU' && String(inventoryRow.item_name).toUpperCase().includes('AYAM')) {
        ayamKg += Number(inventoryRow.qty_remaining || 0);
      }
    });

    return {
      ayamKg,
      ayamKantong: ayamKg / kgPerKantong,
    };
  }, [realInventory, currentBranch, kgPerKantong]);

  const [formSupplier, setFormSupplier] = useState({
    supplierName: '',
    itemName: '',
    qty: '',
    price: '',
  });
  const [displaySupplierPrice, setDisplaySupplierPrice] = useState('');

  const [splIsSplit, setSplIsSplit] = useState(false);
  const [splPayCash, setSplPayCash] = useState('');
  const [displaySplPayCash, setDisplaySplPayCash] = useState('');
  const [splPayBCA, setSplPayBCA] = useState('');
  const [displaySplPayBCA, setDisplaySplPayBCA] = useState('');
  const [splPayBRI, setSplPayBRI] = useState('');
  const [displaySplPayBRI, setDisplaySplPayBRI] = useState('');
  const [splSingleMethod, setSplSingleMethod] = useState('PIUTANG');
  const [splDpMethod, setSplDpMethod] = useState('CASH');
  const [splSingleAmount, setSplSingleAmount] = useState('');
  const [displaySplSingleAmount, setDisplaySplSingleAmount] = useState('');

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [storeName, setStoreName] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [displayCashGiven, setDisplayCashGiven] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cart, setCart] = useState([]);
  const [itemSelector, setItemSelector] = useState({
    category: 'Bahan Baku',
    itemName: '',
    unit: '',
    qty: '1',
    price: '',
  });
  const [displayItemPrice, setDisplayItemPrice] = useState('');

  const supplierOptions = useMemo(() => {
    return realSuppliers.filter((supplier) => !supplier.isDeleted && String(supplier.isDeleted).toUpperCase() !== 'TRUE');
  }, [realSuppliers]);

  const employeeOptions = useMemo(() => {
    return realKaryawan.filter((employee) => !employee.isDeleted && String(employee.isDeleted).toUpperCase() !== 'TRUE');
  }, [realKaryawan]);

  const opsCategories = useMemo(() => {
    const validItems = realRawMaterials.filter((material) => !material.isDeleted && String(material.isDeleted).toUpperCase() !== 'TRUE');
    const categories = [...new Set(validItems.map((material) => material.category))];

    if (categories.length === 0) {
      return ['Bahan Baku', 'Kemasan', 'Operasional Kendaraan', 'ATK & Perlengkapan', 'Air & Kebersihan'];
    }

    return categories;
  }, [realRawMaterials]);

  const hitungKantongSupplier = useMemo(() => {
    return Number(formSupplier.qty || 0) / kgPerKantong;
  }, [formSupplier.qty, kgPerKantong]);

  const totalTagihanSupplier = useMemo(() => {
    return Number(formSupplier.qty || 0) * Number(formSupplier.price || 0);
  }, [formSupplier.qty, formSupplier.price]);

  const splPaymentSummary = useMemo(() => {
    let cash = 0;
    let bca = 0;
    let bri = 0;

    if (splIsSplit) {
      cash = Number(splPayCash || 0);
      bca = Number(splPayBCA || 0);
      bri = Number(splPayBRI || 0);
    } else {
      const amount = Number(splSingleAmount || 0);

      if (splSingleMethod === 'CASH') cash = amount;
      else if (splSingleMethod === 'TF_BCA_PUSAT') bca = amount;
      else if (splSingleMethod === 'TF_BRI_PUSAT') bri = amount;
      else if (splSingleMethod === 'DP_PIUTANG') {
        if (splDpMethod === 'CASH') cash = amount;
        else if (splDpMethod === 'TF_BCA_PUSAT') bca = amount;
        else if (splDpMethod === 'TF_BRI_PUSAT') bri = amount;
      }
    }

    const totalMasuk = cash + bca + bri;
    const sisaHutang = Math.max(0, totalTagihanSupplier - totalMasuk);

    const methods = [];
    const breakdown = [];

    if (cash > 0) {
      methods.push('CASH');
      breakdown.push({ method: 'CASH', amount: cash });
    }

    if (bca > 0) {
      methods.push('BCA');
      breakdown.push({ method: 'TF_BCA_PUSAT', amount: bca });
    }

    if (bri > 0) {
      methods.push('BRI');
      breakdown.push({ method: 'TF_BRI_PUSAT', amount: bri });
    }

    let methodStr = splIsSplit ? `MIX (${methods.join('+')})` : splSingleMethod;

    if (sisaHutang > 0 && totalMasuk > 0) {
      methodStr = splIsSplit ? 'DP_MIX+HUTANG' : `DP_${splDpMethod}+HUTANG`;
    }

    if (sisaHutang === totalTagihanSupplier) methodStr = 'HUTANG_TEMPO';

    return {
      totalMasuk,
      sisaHutang,
      methodStr,
      breakdown,
    };
  }, [
    splIsSplit,
    splPayCash,
    splPayBCA,
    splPayBRI,
    splSingleMethod,
    splSingleAmount,
    splDpMethod,
    totalTagihanSupplier,
  ]);

  const setLunasOtomatisSupplier = (event) => {
    event.preventDefault();

    if (splIsSplit) {
      handleMoneyInput(String(totalTagihanSupplier), setSplPayCash, setDisplaySplPayCash);
      handleMoneyInput('', setSplPayBCA, setDisplaySplPayBCA);
      handleMoneyInput('', setSplPayBRI, setDisplaySplPayBRI);
    } else {
      handleMoneyInput(String(totalTagihanSupplier), setSplSingleAmount, setDisplaySplSingleAmount);
    }
  };

  const totalTagihanCart = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  }, [cart]);

  const estimasiKembalian = useMemo(() => {
    const cash = Number(cashGiven || 0);
    if (cash === 0 || cash < totalTagihanCart) return 0;

    return cash - totalTagihanCart;
  }, [cashGiven, totalTagihanCart]);

  const historyCombined = useMemo(() => {
    const all = [];

    realPurchases.forEach((purchase) => {
      if (!purchase.isDeleted && String(purchase.isDeleted).toUpperCase() !== 'TRUE') {
        all.push({
          doc_type: 'PURCHASE',
          id: purchase.id,
          date: purchase.date,
          branch_id: purchase.branch_id,
          title: purchase.supplier_name || purchase.supplierName || 'Belanja kas / supplier',
          subtitle: purchase.item_name || purchase.itemName,
          qty: purchase.qty,
          unit: purchase.unit,
          price: purchase.price,
          total_amount: Number(purchase.total_amount || purchase.amount || 0),
          paid_amount: Number(purchase.paid_amount || 0),
          payment_status: purchase.payment_status,
          payment_method: purchase.payment_method,
          employee_name: purchase.employee_name,
          change_status: purchase.change_status,
        });
      }
    });

    realExpenses.forEach((expense) => {
      if (!expense.isDeleted && String(expense.isDeleted).toUpperCase() !== 'TRUE') {
        all.push({
          doc_type: 'EXPENSE',
          id: expense.id,
          date: expense.date,
          branch_id: expense.branch_id,
          title: expense.category || 'Biaya operasional',
          subtitle: expense.description || expense.item_name || 'Beban kas',
          qty: 1,
          unit: 'Lot',
          total_amount: Number(expense.amount || 0),
          paid_amount: Number(expense.amount || 0),
          payment_status: 'LUNAS',
          payment_method: expense.payment_method || 'CASH',
          employee_name: expense.employee_name,
          change_status: expense.change_status,
        });
      }
    });

    return all
      .filter((item) => {
        const itemDate = normalizeDateStr(item.date);
        const isDateMatch = tableDateFilter ? itemDate.startsWith(tableDateFilter) : true;
        const isBranchMatch = currentBranch === 'TANGERANG_PUSAT'
          ? String(item.branch_id || '').toUpperCase().includes('TANGERANG')
          : String(item.branch_id || '').toUpperCase() === currentBranch.toUpperCase();

        return isDateMatch && isBranchMatch;
      })
      .sort((a, b) => new Date(normalizeDateStr(b.date)) - new Date(normalizeDateStr(a.date)));
  }, [realPurchases, realExpenses, tableDateFilter, currentBranch]);

  const handleSupplierSelect = (event) => {
    const supplierName = event.target.value;
    const supplierData = supplierOptions.find((supplier) => supplier.supplier_name === supplierName || supplier.name === supplierName);

    setFormSupplier((prev) => ({
      ...prev,
      supplierName,
      price: supplierData && supplierData.default_price ? String(supplierData.default_price) : '',
    }));

    if (supplierData && supplierData.default_price) {
      setDisplaySupplierPrice(Number(supplierData.default_price).toLocaleString('id-ID'));
    } else {
      setDisplaySupplierPrice('');
    }
  };

  const handleAddItemToCart = () => {
    if (!itemSelector.itemName) return alert('Pilih item terlebih dahulu!');
    if (Number(itemSelector.qty) <= 0 || Number(itemSelector.price) <= 0) {
      return alert('Jumlah dan harga harus lebih dari 0!');
    }

    const newItem = {
      cart_id: `CART-${new Date().getTime()}`,
      category: itemSelector.category,
      itemName: itemSelector.itemName,
      unit: itemSelector.unit || 'Pcs',
      qty: Number(itemSelector.qty),
      price: Number(itemSelector.price),
      total: Number(itemSelector.qty) * Number(itemSelector.price),
    };

    setCart((prev) => [...prev, newItem]);
    setItemSelector((prev) => ({
      ...prev,
      itemName: '',
      qty: '1',
      price: '',
      unit: '',
    }));
    setDisplayItemPrice('');
  };

  const handleRemoveFromCart = (cartId) => {
    setCart((prev) => prev.filter((item) => item.cart_id !== cartId));
  };

  const handleOpsItemSelect = (event) => {
    const selectedName = event.target.value;
    const itemDef = realRawMaterials.find((item) => (
      !item.isDeleted &&
      item.category === itemSelector.category &&
      item.item_name === selectedName
    ));

    if (itemDef) {
      setItemSelector((prev) => ({
        ...prev,
        itemName: selectedName,
        unit: itemDef.unit || 'Pcs',
        price: itemDef.default_price > 0 ? String(itemDef.default_price) : '',
      }));

      setDisplayItemPrice(itemDef.default_price > 0 ? Number(itemDef.default_price).toLocaleString('id-ID') : '');
    } else {
      setItemSelector((prev) => ({
        ...prev,
        itemName: selectedName,
      }));
    }
  };

  const handleSubmitSupplier = async (event) => {
    event.preventDefault();

    if (!formSupplier.supplierName) return alert('Pilih nama Supplier rekanan resmi terlebih dahulu!');
    if (totalTagihanSupplier <= 0) return alert('Total tagihan nol! Masukkan volume dan harga yang benar.');
    if (typeof sendToSheet !== 'function') return alert('Kabel sendToSheet belum tersambung!');

    const purchaseId = editingPurchaseId ? editingPurchaseId : generateId('PO-DMA', todayStr);
    const finalQtyKg = Number(formSupplier.qty);
    const finalPricePerKg = Number(formSupplier.price);
    const supplierNameUpper = String(formSupplier.supplierName || '').toUpperCase();
    const itemNameUpper = String(formSupplier.itemName || '').toUpperCase();
    const isNanaPurchase = isNanaSupplierName(supplierNameUpper);

    const confirmMessage = `${editingPurchaseId ? 'Revisi Nota Supplier' : 'Sahkan Nota Belanja Supplier'} senilai ${formatRupiah(totalTagihanSupplier)}? Stok Gudang akan bertambah otomatis.`;

    if (!window.confirm(confirmMessage)) return;

    const payloadPurchase = {
      id: purchaseId,
      date: todayStr,
      branch_id: currentBranch,
      category: 'BAHAN_BAKU',
      supplier_name: supplierNameUpper,
      item_name: itemNameUpper,
      qty: finalQtyKg,
      unit: 'Kg',
      price: finalPricePerKg,
      total_amount: totalTagihanSupplier,
      paid_amount: splPaymentSummary.totalMasuk,
      payment_status: splPaymentSummary.sisaHutang <= 0 ? 'LUNAS' : 'BELUM_LUNAS',
      payment_method: splPaymentSummary.methodStr,
      isDeleted: false,
    };

    const actionType = editingPurchaseId ? 'update' : 'insert';
    const isSuccess = await sendToSheet(actionType, payloadPurchase, 'purchases');

    if (isSuccess) {
      if (!editingPurchaseId) {
        await sendToSheet('insert', {
          id: generateId('LAY', todayStr),
          date: todayStr,
          branch_id: currentBranch,
          category: 'BAHAN_BAKU',
          item_name: itemNameUpper,
          qty_received: finalQtyKg,
          qty_remaining: finalQtyKg,
          unit_cost: finalPricePerKg,
          reference_id: payloadPurchase.id,
          status: 'ACTIVE',
          notes: `Belanja dari: ${supplierNameUpper}`,
          isDeleted: false,
        }, 'inventory_cost_layers');

        if (isNanaPurchase) {
          const purchaseLedgerPayload = makeNanaPurchaseLedgerRecord({
            purchase: payloadPurchase,
            user,
            branchId: currentBranch,
          });

          await sendToSheet('insert', purchaseLedgerPayload, 'supplier_ledger');
        }

        for (const pay of splPaymentSummary.breakdown) {
          if (pay.amount <= 0) continue;

          const cashflowPayload = {
            id: generateId('CFO', todayStr),
            date: todayStr,
            branch_id: currentBranch,
            type: 'OUT',
            transaction_type: 'OUTFLOW',
            category: isNanaPurchase ? 'PELUNASAN HUTANG AYAM' : 'BELANJA LOGISTIK',
            description: `Pembayaran ${itemNameUpper} ke ${supplierNameUpper}`,
            amount: pay.amount,
            method: pay.method,
            reference_id: payloadPurchase.id,
            source_table: 'purchases',
            source_id: payloadPurchase.id,
            isDeleted: false,
          };

          const cashflowSuccess = await sendToSheet('insert', cashflowPayload, 'cashflow_transactions');

          if (isNanaPurchase && cashflowSuccess) {
            const paymentLedgerPayload = makeNanaPaymentLedgerRecord({
              amount: pay.amount,
              date: todayStr,
              method: pay.method,
              notes: `Pembayaran ${itemNameUpper} ke ${supplierNameUpper}`,
              user,
              branchId: currentBranch,
              sourceId: cashflowPayload.id,
            });

            await sendToSheet('insert', paymentLedgerPayload, 'supplier_ledger');
          }
        }
      }

      if (typeof showToast === 'function') {
        showToast(editingPurchaseId ? 'Revisi Belanja Berhasil!' : 'Nota Belanja Supplier Berhasil Disimpan!', 'success');
      }

      setFormSupplier({
        supplierName: '',
        itemName: '',
        qty: '',
        price: '',
      });
      setDisplaySupplierPrice('');
      setSplSingleAmount('');
      setDisplaySplSingleAmount('');
      setSplPayCash('');
      setDisplaySplPayCash('');
      setSplPayBCA('');
      setDisplaySplPayBCA('');
      setSplPayBRI('');
      setDisplaySplPayBRI('');
      setEditingPurchaseId(null);
    }
  };

  const handleEditPurchase = (purchase) => {
    if (!window.confirm('Tarik nota belanja ini untuk direvisi? Pastikan Anda mengecek ulang nilai yang dimasukkan.')) return;

    setEditingPurchaseId(purchase.id);
    setActiveTab('SUPPLIER');

    const isKg = String(purchase.unit).toLowerCase() === 'kg';
    const convertedQty = isKg ? purchase.qty : String(Number(purchase.qty) * kgPerKantong);
    const convertedPrice = isKg ? purchase.price : String(Number(purchase.total_amount) / (Number(purchase.qty) * kgPerKantong));

    setFormSupplier({
      supplierName: purchase.title,
      itemName: purchase.subtitle,
      qty: convertedQty,
      price: convertedPrice > 0 ? convertedPrice : '0',
    });

    setDisplaySupplierPrice(convertedPrice > 0 ? Number(convertedPrice).toLocaleString('id-ID') : '0');
    handleMoneyInput(String(purchase.paid_amount), setSplSingleAmount, setDisplaySplSingleAmount);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitMultiOps = async (event) => {
    event.preventDefault();

    if (!selectedEmployee) return alert('Wajib memilih nama Karyawan Penerima Uang / Kasbon!');
    if (cart.length === 0) return alert('Keranjang belanja masih kosong! Tambahkan item belanja terlebih dahulu.');
    if (typeof sendToSheet !== 'function') return alert('Kabel sendToSheet belum tersambung!');

    const cashGivenNum = Number(cashGiven || 0);
    if (cashGivenNum < totalTagihanCart) {
      return alert(`Uang yang diberikan (${formatRupiah(cashGivenNum)}) kurang dari total nota aktual (${formatRupiah(totalTagihanCart)})!`);
    }

    const kasbonId = generateId('KSB', todayStr);
    const hasKembalian = estimasiKembalian > 0;

    for (const item of cart) {
      const isBarangFisik = (
        item.category === 'Bahan Baku' ||
        item.category === 'Kemasan' ||
        item.category === 'BAHAN BAKU' ||
        item.category === 'KEMASAN'
      );

      const itemTrxId = generateId(isBarangFisik ? 'PO-KAS' : 'EXP', todayStr);

      if (isBarangFisik) {
        await sendToSheet('insert', {
          id: itemTrxId,
          date: todayStr,
          branch_id: currentBranch,
          supplier_name: storeName ? `Toko ${storeName.toUpperCase()}` : 'Belanja kas manual',
          item_name: item.itemName.toUpperCase(),
          qty: item.qty,
          unit: item.unit,
          price: item.price,
          total_amount: item.total,
          paid_amount: item.total,
          payment_status: 'LUNAS',
          payment_method: paymentMethod,
          employee_name: selectedEmployee.toUpperCase(),
          cash_given: cashGivenNum,
          expected_change: estimasiKembalian,
          change_status: hasKembalian ? 'PENDING' : 'SETTLED',
          kasbon_id: kasbonId,
          isDeleted: false,
        }, 'purchases');

        await sendToSheet('insert', {
          id: generateId('LAY', todayStr),
          date: todayStr,
          branch_id: currentBranch,
          category: item.category.toUpperCase().replace(' ', '_'),
          item_name: item.itemName.toUpperCase(),
          qty_received: item.qty,
          qty_remaining: item.qty,
          unit_cost: item.price,
          status: 'ACTIVE',
          reference_id: itemTrxId,
          isDeleted: false,
        }, 'inventory_cost_layers');
      } else {
        await sendToSheet('insert', {
          id: itemTrxId,
          date: todayStr,
          branch_id: currentBranch,
          category: item.category.toUpperCase(),
          description: `${item.itemName.toUpperCase()} (${item.qty} ${item.unit}) ${storeName ? `- ${storeName.toUpperCase()}` : ''}`,
          amount: item.total,
          payment_method: paymentMethod,
          employee_name: selectedEmployee.toUpperCase(),
          cash_given: cashGivenNum,
          expected_change: estimasiKembalian,
          change_status: hasKembalian ? 'PENDING' : 'SETTLED',
          kasbon_id: kasbonId,
          isDeleted: false,
        }, 'expenses');
      }
    }

    await sendToSheet('insert', {
      id: generateId('CFO', todayStr),
      date: todayStr,
      branch_id: currentBranch,
      type: 'OUT',
      transaction_type: 'OUTFLOW',
      category: 'KASBON BELANJA KARYAWAN',
      description: `Kasbon keluar ke ${selectedEmployee.toUpperCase()} (Nota: ${formatRupiah(totalTagihanCart)}, Titipan: ${formatRupiah(cashGivenNum)})`,
      amount: cashGivenNum,
      method: paymentMethod,
      reference_id: kasbonId,
      isDeleted: false,
    }, 'cashflow_transactions');

    if (typeof showToast === 'function') {
      showToast(`Sukses mencatat kasbon ${selectedEmployee}. Menunggu sisa kembalian di setor!`, 'success');
    }

    setCart([]);
    setSelectedEmployee('');
    setStoreName('');
    setCashGiven('');
    setDisplayCashGiven('');
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-200">
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between relative overflow-hidden rounded-3xl shadow-xl border border-blue-800 gap-6">
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full md:w-1/2">
          <h2 className="text-white text-xl lg:text-2xl font-black uppercase tracking-tight flex items-center gap-3 mb-2">
            <Truck className="text-blue-400" size={28} />
            Belanja &amp; Pembayaran Supplier
          </h2>
          <p className="text-[11px] font-bold text-slate-300 leading-relaxed normal-case max-w-sm">
            Satu pintu utama pengeluaran kas internal dan pembayaran nota belanja supplier pabrik. Stok gudang akan otomatis bertambah saat disahkan.
          </p>
        </div>

        <div className="relative z-10 w-full md:w-auto flex flex-col gap-3 bg-slate-900/60 border border-slate-700/50 p-5 rounded-2xl shadow-inner backdrop-blur-sm shrink-0">
          <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
            <Database size={14} />
            Sisa Stok Gudang Ayam
          </div>
          <div className="flex gap-4 items-center">
            <div>
              <div className="text-3xl font-black text-white tracking-tighter">
                {formatNumber(stockGudang.ayamKantong)}
                {' '}
                <span className="text-xs font-bold text-slate-400">Kntg</span>
              </div>
            </div>
            <div className="border-l border-slate-600 pl-4">
              <div className={`text-xl font-black tracking-tight ${stockGudang.ayamKg <= 0 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
                {formatNumber(stockGudang.ayamKg)}
                {' '}
                <span className="text-[10px] font-bold text-slate-500">Kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-max shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('MANUAL')}
          className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'MANUAL'
              ? 'bg-white text-red-600 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet size={14} />
          Kas &amp; Ops Manual
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SUPPLIER')}
          className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'SUPPLIER'
              ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck size={14} />
          Nota Supplier Besar
        </button>
      </div>

      {editingPurchaseId && (
        <div className="bg-orange-600 text-white font-black text-xs p-5 rounded-2xl shadow-md animate-bounce flex flex-col sm:flex-row justify-between items-center shrink-0 gap-3 border border-orange-500">
          <span className="flex items-center gap-2 uppercase tracking-wider">
            <AlertTriangle size={18} />
            ⚠️ ANDA SEDANG DALAM MODE REVISI NOTA BELANJA.
          </span>
          <button
            type="button"
            onClick={() => {
              setEditingPurchaseId(null);
              setFormSupplier({
                supplierName: '',
                itemName: 'Daging fillet dada mentah',
                qty: '',
                price: '',
              });
              setDisplaySupplierPrice('');
            }}
            className="bg-white text-orange-700 px-4 py-2 rounded-xl font-black uppercase tracking-wider cursor-pointer shadow-sm hover:bg-orange-50 w-full sm:w-auto"
          >
            Batal Revisi
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 flex flex-col gap-6">
          {activeSubTab === 'MANUAL' && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm border-t-4 border-t-red-600 overflow-hidden animate-in slide-in-from-left-2">
              <div className="p-5 border-b border-slate-100 bg-slate-50 font-black text-sm flex items-center gap-2 text-slate-800 uppercase tracking-wide">
                <ShoppingCart size={18} className="text-red-600" />
                Formulir Pengeluaran Kas (Multi-Item)
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-inner">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider flex items-center gap-1">
                      <User size={12} />
                      PIC Bawa Uang
                    </label>
                    <select
                      required
                      value={selectedEmployee}
                      onChange={(event) => setSelectedEmployee(event.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none cursor-pointer focus:border-red-400 shadow-sm uppercase tracking-wider"
                    >
                      <option value="">-- Pilih karyawan --</option>
                      {employeeOptions.map((employee) => (
                        <option key={employee.id} value={employee.name}>{employee.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                      Nama Toko / Warung
                    </label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(event) => setStoreName(event.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-red-400 shadow-sm uppercase tracking-wider"
                      placeholder="Cth: Warung Madura"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 p-5 rounded-3xl bg-slate-50/80 space-y-4 shadow-sm">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-1">
                    Input Item Belanja
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5">
                      <select
                        value={itemSelector.category}
                        onChange={(event) => {
                          setItemSelector({
                            ...itemSelector,
                            category: event.target.value,
                            itemName: '',
                            unit: '',
                            price: '',
                          });
                          setDisplayItemPrice('');
                        }}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none cursor-pointer focus:border-red-400 shadow-sm uppercase tracking-wider"
                      >
                        {opsCategories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-7">
                      <select
                        value={itemSelector.itemName}
                        onChange={handleOpsItemSelect}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs text-red-600 outline-none cursor-pointer focus:border-red-400 shadow-sm uppercase tracking-wider"
                      >
                        <option value="">-- Pilih Variant Item --</option>
                        {realRawMaterials
                          .filter((material) => !material.isDeleted && material.category === itemSelector.category)
                          .map((item) => (
                            <option key={item.id} value={item.item_name}>{item.item_name}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                        Jumlah
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={itemSelector.qty}
                        onChange={(event) => setItemSelector({ ...itemSelector, qty: event.target.value })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center font-bold text-sm outline-none focus:border-red-400 shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                        Satuan
                      </label>
                      <input
                        type="text"
                        value={itemSelector.unit}
                        onChange={(event) => setItemSelector({ ...itemSelector, unit: event.target.value })}
                        className="w-full p-3 bg-white/50 border border-slate-200 text-center font-bold text-sm text-slate-500 rounded-xl shadow-inner focus:border-red-400 outline-none uppercase tracking-wider"
                        placeholder="Pcs"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                        Harga Satuan
                      </label>
                      <input
                        type="text"
                        value={displayItemPrice}
                        onChange={(event) => handleMoneyInput(
                          event.target.value,
                          (value) => setItemSelector((prev) => ({ ...prev, price: value })),
                          setDisplayItemPrice,
                        )}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-right font-bold text-sm outline-none focus:border-red-400 shadow-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemToCart}
                    className="w-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl hover:bg-slate-800 transition-transform active:scale-95 shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    Masukkan Ke Keranjang
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-50">
                  <div className="bg-slate-100 p-3 text-[10px] font-black text-slate-500 uppercase tracking-wider flex justify-between border-b border-slate-200">
                    <span>Keranjang Belanja Kas Harian</span>
                    <span className="bg-white px-2 py-0.5 rounded shadow-3xs">{cart.length} Item</span>
                  </div>

                  <div className="max-h-[250px] overflow-y-auto divide-y divide-slate-100 font-bold text-xs bg-white custom-scrollbar">
                    {cart.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
                        <ShoppingCart size={32} className="opacity-20" />
                        Keranjang belanja kosong.
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div key={item.cart_id} className="p-4 flex justify-between items-center hover:bg-slate-50/80 transition-colors">
                          <div className="flex-1 pr-3">
                            <div className="text-slate-800 font-black uppercase tracking-wide">{item.itemName}</div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                              {item.qty}
                              {' '}
                              {item.unit}
                              {' '}
                              x
                              {' '}
                              {formatRupiah(item.price)}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-slate-800 font-black text-sm tracking-tight">
                              {formatRupiah(item.total)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.cart_id)}
                              className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded-lg shadow-3xs transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 flex justify-between items-center font-black">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total Nota Aktual:</span>
                    <span className="text-xl text-emerald-400 tracking-tight">{formatRupiah(totalTagihanCart)}</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-3xl grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-inner">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                      Uang Kas Diberikan
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">Rp</span>
                      <input
                        type="text"
                        required
                        value={displayCashGiven}
                        onChange={(event) => handleMoneyInput(event.target.value, setCashGiven, setDisplayCashGiven)}
                        className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl font-black text-sm bg-white outline-none focus:border-red-500 text-slate-800 shadow-sm transition-colors"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                      Kembalian (Wajib Setor)
                    </label>
                    <div className="w-full py-3 bg-blue-50 border border-blue-200 rounded-xl font-black text-lg text-center text-blue-700 tracking-tight shadow-inner">
                      {formatRupiah(estimasiKembalian)}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-white flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-wider shadow-sm">
                  <span>Jalur Uang Laci</span>
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg outline-none cursor-pointer text-slate-800 font-bold focus:border-red-400 transition-colors shadow-3xs uppercase tracking-wider"
                  >
                    <option value="CASH">Cash / Tunai Laci</option>
                    <option value="TF_BCA_PUSAT">TF Rek BCA Pusat</option>
                    <option value="TF_BRI_PUSAT">TF Rek BRI Pusat</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSubmitMultiOps}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 uppercase tracking-wider transition-transform active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  Potong Kas &amp; Simpan Biaya
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'SUPPLIER' && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm border-t-4 border-t-blue-600 overflow-hidden animate-in slide-in-from-left-2">
              <div className="p-5 border-b border-slate-100 bg-slate-50 font-black text-sm flex items-center gap-2 text-slate-800 uppercase tracking-wide">
                <FileText size={18} className="text-blue-600" />
                Formulir Belanja Bahan Baku Utama
              </div>

              <form onSubmit={handleSubmitSupplier} className="p-6 space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                    Pilih Rekanan Supplier Resmi
                  </label>
                  <select
                    required
                    value={formSupplier.supplierName}
                    onChange={handleSupplierSelect}
                    className="w-full p-3.5 bg-white border border-slate-200 rounded-xl font-bold text-xs cursor-pointer outline-none focus:border-blue-500 text-blue-800 uppercase tracking-wider shadow-sm transition-colors"
                  >
                    <option value="">-- Pilih supplier --</option>
                    {supplierOptions.map((supplier) => (
                      <option key={supplier.id} value={supplier.supplier_name || supplier.name}>
                        {supplier.supplier_name || supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                    Nama Item Bahan Baku
                  </label>
                  <input
                    type="text"
                    required
                    value={formSupplier.itemName}
                    onChange={(event) => setFormSupplier({ ...formSupplier, itemName: event.target.value })}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 shadow-sm uppercase tracking-wider transition-colors"
                    placeholder="Cth: Daging fillet dada mentah"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                      Volume Beli (Kg)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      required
                      value={formSupplier.qty}
                      onChange={(event) => setFormSupplier({ ...formSupplier, qty: event.target.value })}
                      className="w-full p-3.5 border border-slate-200 rounded-xl font-black text-lg text-center outline-none focus:border-blue-500 shadow-inner bg-slate-50 focus:bg-white transition-colors text-blue-700"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                      Setara Konversi
                    </label>
                    <div className="w-full py-4 bg-slate-900 border border-slate-800 rounded-xl font-black text-sm text-center text-white shadow-md">
                      {formatNumber(hitungKantongSupplier)}
                      {' '}
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kantong</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                    Harga Satuan (Per Kg)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">Rp</span>
                    <input
                      type="text"
                      required
                      value={displaySupplierPrice}
                      onChange={(event) => handleMoneyInput(
                        event.target.value,
                        (value) => setFormSupplier((prev) => ({ ...prev, price: value })),
                        setDisplaySupplierPrice,
                      )}
                      className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-xl font-black text-base outline-none focus:border-blue-500 bg-white shadow-sm transition-colors text-slate-800"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex justify-between items-center shadow-inner mt-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Tagihan Nota:</span>
                  <span className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(totalTagihanSupplier)}</span>
                </div>

                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                      Opsi Model Bayar
                    </label>
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-700 cursor-pointer uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={splIsSplit}
                        onChange={(event) => {
                          setSplIsSplit(event.target.checked);
                          setSplPayCash('');
                          setDisplaySplPayCash('');
                          setSplPayBCA('');
                          setDisplaySplPayBCA('');
                          setSplPayBRI('');
                          setDisplaySplPayBRI('');
                          setSplSingleAmount('');
                          setDisplaySplSingleAmount('');
                        }}
                        className="accent-blue-600 w-3 h-3"
                      />
                      Aktifkan Bayar Campuran (Mix)
                    </label>
                  </div>

                  {splIsSplit ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border shadow-sm">
                        <span className="text-[10px] font-black text-slate-400 w-20 tracking-wider">💵 LACI CASH</span>
                        <input
                          type="text"
                          value={displaySplPayCash}
                          onChange={(event) => handleMoneyInput(event.target.value, setSplPayCash, setDisplaySplPayCash)}
                          className="w-full text-right bg-transparent outline-none font-black text-sm text-slate-800"
                          placeholder="0"
                        />
                      </div>

                      <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border shadow-sm">
                        <span className="text-[10px] font-black text-blue-600 w-20 tracking-wider">🏦 BCA PUSAT</span>
                        <input
                          type="text"
                          value={displaySplPayBCA}
                          onChange={(event) => handleMoneyInput(event.target.value, setSplPayBCA, setDisplaySplPayBCA)}
                          className="w-full text-right bg-transparent outline-none font-black text-sm text-blue-700"
                          placeholder="0"
                        />
                      </div>

                      <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border shadow-sm">
                        <span className="text-[10px] font-black text-orange-600 w-20 tracking-wider">🏦 BRI PUSAT</span>
                        <input
                          type="text"
                          value={displaySplPayBRI}
                          onChange={(event) => handleMoneyInput(event.target.value, setSplPayBRI, setDisplaySplPayBRI)}
                          className="w-full text-right bg-transparent outline-none font-black text-sm text-orange-700"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <select
                            value={splSingleMethod}
                            onChange={(event) => {
                              setSplSingleMethod(event.target.value);
                              setSplSingleAmount('');
                              setDisplaySplSingleAmount('');
                            }}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none cursor-pointer shadow-sm uppercase tracking-wider focus:border-blue-400 transition-colors"
                          >
                            <option value="CASH">Cash (Tunai Laci)</option>
                            <option value="TF_BCA_PUSAT">Transfer BCA Pusat</option>
                            <option value="TF_BRI_PUSAT">Transfer BRI Pusat</option>
                            <option value="DP_PIUTANG">Bayar DP Awal</option>
                            <option value="PIUTANG">Full Bon (Hutang Tempo)</option>
                          </select>
                        </div>

                        {splSingleMethod !== 'DP_PIUTANG' && splSingleMethod !== 'PIUTANG' && (
                          <div>
                            <input
                              type="text"
                              value={displaySplSingleAmount}
                              onChange={(event) => handleMoneyInput(event.target.value, setSplSingleAmount, setDisplaySplSingleAmount)}
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-right text-slate-800 outline-none shadow-sm focus:border-blue-400 transition-colors"
                              placeholder="Rp 0"
                            />
                          </div>
                        )}

                        {splSingleMethod === 'PIUTANG' && (
                          <div>
                            <input
                              type="text"
                              disabled
                              value=""
                              className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-right text-slate-400 outline-none opacity-50 shadow-inner"
                              placeholder="Rp 0 (Full Bon)"
                            />
                          </div>
                        )}
                      </div>

                      {splSingleMethod === 'DP_PIUTANG' && (
                        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl shadow-inner">
                          <select
                            value={splDpMethod}
                            onChange={(event) => setSplDpMethod(event.target.value)}
                            className="w-1/2 p-2.5 bg-white border border-blue-200 rounded-lg text-[10px] font-bold outline-none cursor-pointer text-blue-900 shadow-sm uppercase tracking-wider focus:border-blue-500"
                          >
                            <option value="CASH">Jalur: Tunai Laci</option>
                            <option value="TF_BCA_PUSAT">Jalur: TF BCA</option>
                            <option value="TF_BRI_PUSAT">Jalur: TF BRI</option>
                          </select>

                          <input
                            type="text"
                            value={displaySplSingleAmount}
                            onChange={(event) => handleMoneyInput(event.target.value, setSplSingleAmount, setDisplaySplSingleAmount)}
                            className="w-1/2 p-2.5 bg-white border border-blue-200 rounded-lg text-sm font-black text-right text-blue-700 outline-none shadow-sm placeholder:text-blue-300 focus:border-blue-500"
                            placeholder="Nominal DP (Rp)"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-3 text-[10px] font-bold space-y-2 text-slate-600 uppercase tracking-wider">
                    <div className="flex justify-between items-center">
                      <span>Total Keluar Kas:</span>
                      <span className="font-black text-slate-800 text-sm">{formatRupiah(splPaymentSummary.totalMasuk)}</span>
                    </div>

                    {splPaymentSummary.sisaHutang > 0 && (
                      <div className="flex justify-between items-center text-rose-600 font-black bg-rose-50 px-3 py-1.5 rounded-lg mt-1 border border-rose-200 shadow-3xs">
                        <span>⚠️ Sisa Tagihan (Hutang Dagang):</span>
                        <span className="text-sm">{formatRupiah(splPaymentSummary.sisaHutang)}</span>
                      </div>
                    )}

                    {splSingleMethod !== 'PIUTANG' && splSingleMethod !== 'DP_PIUTANG' && (
                      <div className="flex justify-end pt-1.5">
                        <button
                          type="button"
                          onClick={setLunasOtomatisSupplier}
                          className="text-[10px] font-black text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-sm cursor-pointer hover:bg-blue-50 transition-colors"
                        >
                          Set Lunas Sesuai Tagihan
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl text-white text-xs font-black shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 uppercase tracking-wider cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  {editingPurchaseId ? 'Sahkan Revisi Belanja' : 'Sahkan Nota Belanja Supplier'}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-black text-sm uppercase tracking-wide text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                Jurnal Buku Kas &amp; Belanja Aktual
              </h4>
              <p className="text-[11px] font-bold text-slate-400 normal-case mt-1 max-w-sm leading-relaxed">
                Rekam jejak belanja harian dan operasional manual yang memotong saldo fisik secara real-time.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm shrink-0">
              <Calendar size={14} className="text-blue-500" />
              <input
                type="month"
                value={tableDateFilter}
                onChange={(event) => setTableDateFilter(event.target.value)}
                className="text-[11px] font-bold text-slate-700 outline-none cursor-pointer bg-transparent uppercase tracking-wider"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 sticky top-0 shadow-sm bg-white z-10">
                <tr>
                  <th className="px-5 py-4 font-black">Bukti &amp; Ref</th>
                  <th className="px-5 py-4 font-black min-w-[200px]">Detail Transaksi</th>
                  <th className="px-5 py-4 text-right font-black min-w-[180px]">Rincian Nominal</th>
                  <th className="px-5 py-4 text-center font-black">Status</th>
                  <th className="px-5 py-4 text-center font-black">Aksi Hub</th>
                </tr>
              </thead>

              <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
                {historyCombined.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-24 text-slate-400 normal-case font-bold">
                      <Wallet size={48} className="mx-auto mb-4 opacity-20" />
                      <div className="text-sm font-black uppercase tracking-wider">Aman Terkendali</div>
                      Tidak ada catatan kas keluar pada periode ini.
                    </td>
                  </tr>
                ) : (
                  historyCombined.map((purchase) => {
                    const isPurchase = purchase.doc_type === 'PURCHASE';
                    const totalBill = Number(purchase.total_amount || 0);
                    const paidAmt = Number(purchase.paid_amount || 0);
                    const isLunas = String(purchase.payment_status).toUpperCase() === 'LUNAS' || (totalBill - paidAmt) <= 0;
                    const paymentMethodText = String(purchase.payment_method || 'CASH').replace(/_/g, ' ');

                    const isKantong = String(purchase.unit).toLowerCase() === 'kantong';
                    const isKg = String(purchase.unit).toLowerCase() === 'kg';

                    return (
                      <tr key={purchase.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-black text-sm">{formatDate(purchase.date)}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-1">{purchase.id}</div>
                          <span className={`text-[9px] font-black uppercase tracking-wider mt-2 px-2.5 py-1 rounded-md border inline-block shadow-3xs ${
                            isPurchase
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                          >
                            {isPurchase ? 'Belanja Gudang' : 'Biaya Operasional'}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-black text-slate-800 text-sm uppercase tracking-wide mb-1 line-clamp-1">
                            {purchase.title}
                          </div>
                          <div className="text-[11px] text-slate-500 normal-case font-bold leading-relaxed">
                            {purchase.subtitle}
                          </div>

                          {purchase.employee_name && (
                            <div className="text-[10px] font-black text-slate-600 mt-2 uppercase tracking-wider border-t border-slate-100 pt-2">
                              PIC:
                              {' '}
                              {purchase.employee_name}
                              {' '}
                              <span className={purchase.change_status === 'PENDING' ? 'text-amber-600' : 'text-emerald-600'}>
                                {purchase.change_status === 'PENDING' ? '(⏳ Sisa Kembalian)' : '(✅ Lunas Balance)'}
                              </span>
                            </div>
                          )}

                          <div className="text-[10px] text-blue-600 font-black mt-1 uppercase tracking-wider">
                            Vol:
                            {' '}
                            {formatNumber(purchase.qty)}
                            {' '}
                            {purchase.unit}
                            {' '}
                            {isKantong
                              ? `(≈ ${formatNumber(purchase.qty * kgPerKantong)} Kg)`
                              : isKg
                                ? `(≈ ${formatNumber(purchase.qty / kgPerKantong)} Kantong)`
                                : ''}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="text-slate-500 text-[11px] font-black uppercase tracking-wider mb-0.5">
                            Nota:
                            {' '}
                            {formatRupiah(totalBill)}
                          </div>
                          <div className="text-slate-800 font-black text-base tracking-tight">
                            Bayar:
                            {' '}
                            {formatRupiah(paidAmt)}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-3xs ${
                            isLunas
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                          >
                            {isLunas ? 'LUNAS' : 'HUTANG / DP'}
                          </span>
                          <div className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
                            {paymentMethodText}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (typeof setPrintData === 'function') {
                                  setPrintData({
                                    type: 'PURCHASE',
                                    title: 'NOTA BELANJA',
                                    id: purchase.id,
                                    date: formatDate(purchase.date),
                                    branch_name: currentBranch.replace(/_/g, ' '),
                                    admin_name: user?.name || 'ADMIN',
                                    customer_name: purchase.title,
                                    supplier_name: purchase.title,
                                    items: [{
                                      name: purchase.subtitle,
                                      qty: purchase.qty,
                                      unit: purchase.unit,
                                      subtotal: totalBill,
                                    }],
                                    amount: totalBill,
                                    paymentMethod: paymentMethodText,
                                    history: {
                                      labelLama: 'Total Tagihan',
                                      nominalLama: totalBill,
                                      labelAksi: 'Total Dibayar',
                                      nominalAksi: paidAmt,
                                      labelBaru: 'Sisa Hutang',
                                      nominalBaru: Math.max(0, totalBill - paidAmt),
                                    },
                                  });
                                }
                              }}
                              className="p-2.5 text-slate-400 hover:text-emerald-600 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-emerald-50 cursor-pointer transition-colors"
                              title="Cetak Bukti"
                            >
                              <Printer size={16} />
                            </button>

                            {isPurchase && (isKantong || isKg) && (
                              <button
                                type="button"
                                onClick={() => handleEditPurchase(purchase)}
                                className="p-2.5 text-slate-400 hover:text-blue-600 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-blue-50 cursor-pointer transition-colors"
                                title="Edit / Revisi Nota"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('🔥 PERINGATAN OWNER: Yakin void pembatalan data pengeluaran belanja ini secara permanen?')) {
                                  if (typeof requestDelete === 'function') requestDelete(purchase.id);
                                }
                              }}
                              className="p-2.5 text-slate-400 hover:text-red-600 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-red-50 cursor-pointer transition-colors"
                              title="Void / Hapus Permanen"
                            >
                              <Trash2 size={16} />
                            </button>
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
    </div>
  );
}
