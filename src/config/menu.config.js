export const MENU_GROUPS = [
  {
    key: "pusat-kendali",
    title: "Pusat Kendali",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: true,
    items: [
      {
        key: "papan-pusat",
        label: "Dashboard Owner",
        description: "Ringkasan keputusan harian: uang, penjualan, stok, hutang, PO, payroll, dan tindak lanjut.",
      },
      {
        key: "owner-control",
        label: "Kendali Usaha",
        description: "Pantau posisi uang, produksi, penjualan, supplier, kewajiban, cabang, dan keputusan owner.",
      },
    ],
  },
  {
    key: "produksi-stok",
    title: "Produksi & Stok",
    visibleFor: ["OWNER", "TANGERANG", "PEMALANG"],
    defaultOpen: true,
    items: [
      {
        key: "drop-ayam",
        label: "DROP Ayam",
        description: "Input ayam masuk, harga aktual, nota, lot, dan hutang Nana.",
      },
      {
        key: "stok-ayam",
        label: "Stok Ayam",
        description: "Pantau stok ayam awal, masuk, dipakai, lot aktif, dan sisa.",
      },
      {
        key: "produksi-adukan",
        label: "Produksi / Adukan",
        description: "Catat adukan, ayam dipakai, hasil pcs, HPP historis, dan posting produksi.",
      },
      {
        key: "barang-freezer",
        label: "Barang Masuk Freezer",
        description: "Hasil produksi yang sudah diposting dan masuk stok jadi.",
      },
      {
        key: "stok-jadi",
        label: "Stok Jadi",
        description: "Pantau stok bebas, reserved, PO, karantina, dan barang keluar.",
      },
    ],
  },
  {
    key: "penjualan-distribusi",
    title: "Penjualan & Distribusi",
    visibleFor: ["OWNER", "TANGERANG", "PEMALANG", "CIBINONG"],
    defaultOpen: true,
    items: [
      {
        key: "kasir-order",
        label: "Kasir / Order",
        description: "Kelola order, invoice, pembayaran, piutang, dan ketersediaan stok penjualan.",
      },
      {
        key: "antrian-po",
        label: "Antrian PO",
        description: "PO harian, PO karantina, shortage, due date, dan kebutuhan produksi.",
      },
      {
        key: "request-do",
        label: "Request & DO",
        description: "Permintaan barang, approval pusat, DO, in-transit, penerimaan, dan ongkir.",
      },
    ],
  },
  {
    key: "uang-kewajiban",
    title: "Uang & Kewajiban",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: true,
    items: [
      {
        key: "uang-masuk",
        label: "Uang Masuk",
        description: "Catat dan pantau seluruh penerimaan usaha yang masuk ke kas atau bank.",
      },
      {
        key: "kas-dompet",
        label: "Kas & Dompet",
        description: "Pantau saldo Cash, BCA, BRI, saldo awal, transfer, dan pergerakan dana.",
      },
      {
        key: "kas-keluar",
        label: "Belanja & Kas Keluar",
        description: "Catat belanja operasional, nota, rincian barang, dan pengeluaran kas atau bank.",
      },
      {
        key: "hutang-nana",
        label: "Hutang Nana",
        description: "Pantau nota berjalan, saldo hutang lama, dan pembayaran supplier ayam.",
      },
      {
        key: "kewajiban-owner",
        label: "Kewajiban Owner",
        description: "Cicilan usaha, tagihan rutin, jatuh tempo, pembayaran, dan saldo kewajiban.",
      },
      {
        key: "empat-amplop",
        label: "4 Amplop",
        description: "Alokasi uang aktual ke Ayam, Operasional, Cicilan/Kewajiban, dan Owner.",
      },
    ],
  },
  {
    key: "cabang",
    title: "Cabang",
    visibleFor: ["OWNER", "TANGERANG", "PEMALANG", "CIBINONG"],
    defaultOpen: false,
    items: [
      {
        key: "laporan-harian",
        label: "Laporan Harian",
        description: "Rekap harian otomatis dari transaksi sumber per lokasi.",
      },
      {
        key: "setoran-cabang",
        label: "Setoran Cabang",
        description: "Submit, validasi, approval, transfer cabang ke pusat, dan bukti setoran.",
      },
    ],
  },
  {
    key: "hrd-payroll",
    title: "HRD & Payroll",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: false,
    items: [
      {
        key: "hrd-dashboard",
        label: "Dashboard HRD",
        description: "Ringkasan karyawan, absensi, kasbon, cicilan, payroll, dan status closing.",
      },
      {
        key: "hrd-employees",
        label: "Data Karyawan",
        description: "Profil karyawan, lokasi, jadwal gajian, status kerja, dan riwayat personal.",
      },
      {
        key: "hrd-attendance",
        label: "Absensi & Izin",
        description: "Kehadiran, izin, sakit, cuti, tidak masuk, lembur, dan dampak payroll.",
      },
      {
        key: "hrd-loans",
        label: "Kasbon & Cicilan",
        description: "Kasbon bulanan, pinjaman panjang, cicilan, limit, dan saldo outstanding.",
      },
      {
        key: "hrd-payroll",
        label: "Payroll & Slip Gaji",
        description: "Proses gaji, slip A5, closing payroll, dan pembayaran karyawan.",
      },
      {
        key: "hrd-payroll-report",
        label: "Rekap Payroll",
        description: "Rekap payroll per periode/lokasi, status closing, histori, dan cetak A4.",
      },
    ],
  },
  {
    key: "master-data",
    title: "Master Data",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: false,
    items: [
      {
        key: "master-produk",
        label: "Produk",
        description: "Produk, harga, status jual, unit, dan aturan proses produksi.",
      },
      {
        key: "master-customer",
        label: "Customer",
        description: "Pelanggan, jenis harga, dan referensi transaksi.",
      },
      {
        key: "master-supplier",
        label: "Supplier",
        description: "Supplier usaha, termasuk Nana Chicken dan vendor operasional.",
      },
      {
        key: "master-lokasi",
        label: "Lokasi",
        description: "Tangerang, Pemalang, Cibinong, tipe lokasi, dan kesiapan operasional.",
      },
    ],
  },
  {
    key: "laporan-arsip",
    title: "Laporan & Arsip",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: false,
    items: [
      {
        key: "closing-owner",
        label: "Laporan Owner",
        description: "Laporan periode, snapshot, lock, revisi, dan cetak A4 owner.",
      },
      {
        key: "arsip-digital",
        label: "Arsip Digital",
        description: "Pencarian transaksi, rantai ID, dokumen, print log, dan audit trail.",
      },
    ],
  },
  {
    key: "sistem",
    title: "Sistem",
    visibleFor: ["OWNER", "TANGERANG"],
    defaultOpen: false,
    systemGroup: true,
    items: [
      {
        key: "go-live-check",
        label: "Kesiapan Operasional",
        description: "Kelola data awal, kesiapan lokasi, dan status pembukaan operasional.",
      },
      {
        key: "system-health",
        label: "Integritas Data",
        description: "Periksa konsistensi data, hubungan transaksi, dan kelengkapan arsip.",
      },
      {
        key: "permission-role-check",
        label: "Hak Akses",
        description: "Atur hak akses Owner, Tangerang, Pemalang, Cibinong, dan staff.",
      },
      {
        key: "print-backup",
        label: "Cetak & Backup",
        description: "Kelola format cetak, ekspor data, dan backup sistem.",
      },
    ],
  },
];

export const PAGE_META = MENU_GROUPS.reduce((acc, group) => {
  group.items.forEach((item) => {
    acc[item.key] = {
      ...item,
      groupTitle: group.title,
    };
  });
  return acc;
}, {});
