export const arsipDigitalDrilldownUatPlan = {
  "title": "Arsip Digital Drilldown Final Check",
  "version": "Part 7E",
  "mode": "Checklist Read-Only",
  "objective": "Pastikan semua transaksi harian punya arsip digital yang bisa dicari, diklik, dan ditelusuri rantai ID-nya: DROP, Lot, Produksi, Stock Movement, Order, Invoice, Payment, Piutang, Kas, Dompet, Hutang, dan Papan Pantau.",
  "scenarios": [
    {
      "id": "7E-PRE",
      "title": "Persiapan Arsip Digital",
      "risk": "Low",
      "steps": [
        "Login sebagai Owner/Tangerang.",
        "Buka Data Health dan pastikan Masalah Bahaya = 0.",
        "Siapkan daftar ID dari UAT sebelumnya: DROP, Lot, Production Batch, Order, Invoice, Payment, Piutang, KasOut, Hutang Payment, Wallet Mutation.",
        "Buka Arsip Digital.",
        "Pastikan fitur search/global search bisa dipakai."
      ],
      "expected": [
        "Daftar ID UAT tersedia.",
        "Arsip Digital bisa dibuka.",
        "Search tidak error.",
        "Owner/Tangerang bisa melihat semua arsip lintas modul."
      ]
    },
    {
      "id": "7E-01",
      "title": "Search DROP Ayam / Lot Ayam",
      "risk": "High",
      "steps": [
        "Cari DROP ID dari Part 7C/7A.",
        "Buka detail DROP.",
        "Cek supplier, tanggal, kg, harga/kg, total nota, hutang terkait.",
        "Klik Lot Ayam ID jika tersedia.",
        "Cek stock movement ayam masuk."
      ],
      "expected": [
        "DROP ID ditemukan.",
        "Detail DROP lengkap.",
        "Lot Ayam terkait tampil.",
        "Stock movement ayam masuk tampil.",
        "Hutang supplier terkait tampil.",
        "Tidak ada angka DROP yang yatim."
      ]
    },
    {
      "id": "7E-02",
      "title": "Search Produksi / Adukan",
      "risk": "High",
      "steps": [
        "Cari Production Batch ID.",
        "Buka detail produksi.",
        "Cek jumlah adukan, kg ayam dipakai, output pcs, lokasi, user, timestamp.",
        "Klik related Lot Ayam / Stock OUT Ayam / Stock IN Produk Jadi.",
        "Cek cost layer/modal jika tersedia."
      ],
      "expected": [
        "Production Batch ID ditemukan.",
        "Adukan dan output jelas.",
        "Ayam OUT dan Produk Jadi IN tampil.",
        "Cost layer/modal punya source lot ayam.",
        "Timeline produksi masuk akal."
      ]
    },
    {
      "id": "7E-03",
      "title": "Search Stok Jadi / Stock Movement",
      "risk": "High",
      "steps": [
        "Cari Stock Movement IN produk jadi.",
        "Cari Stock Movement OUT dari order.",
        "Buka detail masing-masing.",
        "Cek source production/order.",
        "Cek lokasi dan bucket stok."
      ],
      "expected": [
        "Stock Movement IN/OUT ditemukan.",
        "Source ID jelas.",
        "Lokasi dan bucket stok jelas.",
        "Stok tidak berubah tanpa sumber transaksi.",
        "Related IDs bisa diklik."
      ]
    },
    {
      "id": "7E-04",
      "title": "Search Order / Invoice",
      "risk": "High",
      "steps": [
        "Cari Order ID dari Part 7B.",
        "Buka detail order.",
        "Cek customer, item, qty, harga, total.",
        "Klik Invoice ID.",
        "Cek status pembayaran dan piutang."
      ],
      "expected": [
        "Order ID ditemukan.",
        "Order item tidak kosong.",
        "Qty dan nominal tidak 0 untuk order valid.",
        "Invoice terkait tampil.",
        "Payment/piutang terkait tampil jika ada."
      ]
    },
    {
      "id": "7E-05",
      "title": "Search Payment / Piutang",
      "risk": "High",
      "steps": [
        "Cari Payment ID.",
        "Buka detail payment.",
        "Cek invoice/source, customer, nominal, dompet penerimaan.",
        "Cari Piutang ID jika invoice belum lunas.",
        "Cek remaining dan payment history."
      ],
      "expected": [
        "Payment ID ditemukan.",
        "Payment punya source invoice.",
        "Wallet mutation IN terkait tampil.",
        "Piutang ID ditemukan jika belum lunas.",
        "Remaining piutang benar."
      ]
    },
    {
      "id": "7E-06",
      "title": "Search Kas Keluar / Dompet OUT",
      "risk": "High",
      "steps": [
        "Cari Kas Keluar ID.",
        "Buka detail Kas Keluar.",
        "Cek kategori, nominal, dompet, PIC, catatan.",
        "Klik Wallet Mutation OUT jika tersedia.",
        "Cek source balik dari dompet ke kas keluar."
      ],
      "expected": [
        "Kas Keluar ID ditemukan.",
        "Wallet OUT terkait tampil.",
        "Dompet berkurang punya source jelas.",
        "Kategori biaya terbaca.",
        "Detail tidak hilang setelah dicari ulang."
      ]
    },
    {
      "id": "7E-07",
      "title": "Search Hutang Nana / Hutang Payment",
      "risk": "High",
      "steps": [
        "Cari Hutang ID dari DROP ayam.",
        "Buka detail hutang.",
        "Cek supplier, nota berjalan, old debt jika ada, sisa hutang.",
        "Cari Hutang Payment ID.",
        "Cek dompet OUT terkait pembayaran hutang."
      ],
      "expected": [
        "Hutang ID ditemukan.",
        "Hutang Payment ID ditemukan.",
        "Sisa hutang sebelum/sesudah pembayaran jelas.",
        "Wallet OUT terkait tampil.",
        "Current note dan old debt/selipan terpisah jika fitur tersedia."
      ]
    },
    {
      "id": "7E-08",
      "title": "Cross-Module Focus dari Action Hub / Papan Pantau",
      "risk": "High",
      "steps": [
        "Buka Papan Pantau.",
        "Klik transaksi terbaru atau Radar Owner yang punya ID.",
        "Pastikan fokus membuka modul/detail yang benar.",
        "Kembali ke Papan Pantau.",
        "Buka Arsip Digital dan cari ID yang sama."
      ],
      "expected": [
        "Klik ID/focus mengarah ke modul benar.",
        "Detail tidak salah konteks.",
        "Back/Kembali tidak membingungkan.",
        "ID yang sama bisa dicari di Arsip Digital."
      ]
    },
    {
      "id": "7E-09",
      "title": "Audit Trail / Revisi / Void",
      "risk": "Medium",
      "steps": [
        "Pilih transaksi UAT yang pernah diedit/void jika ada.",
        "Buka detail arsip.",
        "Cek status, alasan, user, timestamp, dan riwayat perubahan.",
        "Pastikan data lama tidak hilang permanen."
      ],
      "expected": [
        "Audit trail tampil jika ada revisi/void.",
        "Alasan perubahan tersimpan.",
        "User dan timestamp tampil.",
        "Transaksi void/revisi tidak hilang dari arsip."
      ]
    },
    {
      "id": "7E-10",
      "title": "Search Global by Customer / Supplier / Amount / Date",
      "risk": "Medium",
      "steps": [
        "Cari nama customer UAT.",
        "Cari nama supplier Nana.",
        "Cari nominal payment/kas keluar.",
        "Cari tanggal UAT.",
        "Bandingkan hasil dengan transaksi yang sudah dibuat."
      ],
      "expected": [
        "Search by customer menemukan order/invoice/payment/piutang.",
        "Search by supplier menemukan DROP/hutang/payment hutang.",
        "Search by amount/date membantu menemukan transaksi.",
        "Hasil tidak berisi terlalu banyak ghost row yang membingungkan."
      ]
    },
    {
      "id": "7E-11",
      "title": "Final No Orphan Transaction Check",
      "risk": "Blocker jika gagal",
      "steps": [
        "Ambil satu rantai UAT lengkap.",
        "Mulai dari DROP sampai payment/dompet/hutang.",
        "Pastikan setiap angka penting punya source ID.",
        "Pastikan setiap source ID bisa dibuka/dicari.",
        "Catat ID yang yatim jika ada."
      ],
      "expected": [
        "Tidak ada angka yatim.",
        "Semua ID utama bisa dicari.",
        "Semua related IDs logis.",
        "Owner bisa menjelaskan uang/stok/hutang berasal dari mana."
      ]
    }
  ],
  "blockers": [
    "Arsip Digital tidak bisa dibuka.",
    "Search ID utama tidak menemukan transaksi.",
    "Order/Invoice/Payment ditemukan tapi related ID kosong.",
    "Wallet mutation tidak punya source ID.",
    "Stock movement tidak punya source production/order.",
    "Hutang berubah tapi pembayaran/source tidak bisa dilacak.",
    "Detail arsip menampilkan angka 0/Rp0 padahal transaksi valid.",
    "Cross-module focus membuka modul yang salah.",
    "Void/revisi menghapus riwayat transaksi.",
    "Ada angka penting di Papan Pantau yang tidak bisa ditelusuri ke ID sumber."
  ]
};
