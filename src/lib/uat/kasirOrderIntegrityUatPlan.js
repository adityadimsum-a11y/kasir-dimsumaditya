export const kasirOrderIntegrityUatPlan = {
  "title": "Kasir / Order Integrity Final Check",
  "version": "Part 7B",
  "mode": "Checklist Read-Only",
  "objective": "Pastikan Kasir/Order aman untuk operasional harian: order tidak kosong, qty 0 ditolak, stok tidak minus, invoice/payment/piutang/dompet/arsip nyambung, dan anti double submit.",
  "scenarios": [
    {
      "id": "7B-PRE",
      "title": "Persiapan Kasir / Order",
      "risk": "Low",
      "steps": [
        "Login Owner/Tangerang atau role kasir yang diizinkan.",
        "Buka Data Health, pastikan Masalah Bahaya = 0.",
        "Buka Stok Jadi, catat stok ready produk UAT.",
        "Buka Kas & Dompet, catat saldo dompet pembayaran.",
        "Siapkan customer UAT dan produk UAT dengan qty kecil."
      ],
      "expected": [
        "Baseline stok ready dan saldo dompet tercatat.",
        "Produk UAT punya stok cukup."
      ]
    },
    {
      "id": "7B-01",
      "title": "Block Order Kosong",
      "risk": "Blocker jika gagal",
      "steps": [
        "Buka Kasir / Order.",
        "Jangan pilih item.",
        "Klik simpan/order jika tombol tersedia."
      ],
      "expected": [
        "Order kosong ditolak.",
        "Tidak ada Order ID baru.",
        "Stok/dompet/invoice/payment/piutang tidak berubah."
      ]
    },
    {
      "id": "7B-02",
      "title": "Block Qty 0 / Total Rp0 Tidak Valid",
      "risk": "Blocker jika gagal",
      "steps": [
        "Pilih produk UAT.",
        "Input qty 0 atau kosong.",
        "Pastikan total Rp0.",
        "Klik simpan/order."
      ],
      "expected": [
        "Qty 0 ditolak.",
        "Total Rp0 ditolak kecuali mode promo/influencer valid.",
        "Stok tidak berubah."
      ]
    },
    {
      "id": "7B-03",
      "title": "Block Stok Tidak Cukup",
      "risk": "Blocker jika gagal",
      "steps": [
        "Pilih produk UAT.",
        "Input qty lebih besar dari stok ready.",
        "Klik simpan/order."
      ],
      "expected": [
        "Order ditolak karena stok tidak cukup.",
        "Tidak ada stok minus.",
        "Tidak ada invoice/payment/piutang."
      ]
    },
    {
      "id": "7B-04",
      "title": "Order Cash Lunas Normal",
      "risk": "High",
      "steps": [
        "Catat stok ready awal dan saldo dompet awal.",
        "Buat order UAT qty kecil.",
        "Pilih pembayaran lunas dan dompet penerimaan.",
        "Simpan order.",
        "Catat Order ID, Invoice ID, Payment ID, Wallet Mutation ID."
      ],
      "expected": [
        "Order item terbaca.",
        "Invoice dan Payment terbentuk.",
        "Dompet IN terbentuk.",
        "Stok berkurang sesuai qty.",
        "Arsip menemukan semua ID."
      ]
    },
    {
      "id": "7B-05",
      "title": "Order Belum Lunas / Piutang",
      "risk": "High",
      "steps": [
        "Buat order UAT dengan bayar sebagian atau belum bayar.",
        "Cek invoice, payment, dan piutang.",
        "Cek dompet hanya bertambah sebesar uang diterima."
      ],
      "expected": [
        "Piutang ID terbentuk jika belum lunas.",
        "Remaining benar.",
        "Dompet hanya bertambah sebesar payment aktual."
      ]
    },
    {
      "id": "7B-06",
      "title": "Anti Double Submit",
      "risk": "Blocker jika gagal",
      "steps": [
        "Buat order UAT kecil.",
        "Saat klik simpan, coba klik cepat berulang jika UI memungkinkan.",
        "Cek order/invoice/payment/stock movement."
      ],
      "expected": [
        "Hanya satu Order ID valid.",
        "Tidak ada invoice/payment ganda.",
        "Stok hanya berkurang sekali.",
        "Tombol saving/disabled atau idempotency bekerja."
      ]
    },
    {
      "id": "7B-07",
      "title": "Detail Order & Rantai ID",
      "risk": "High",
      "steps": [
        "Buka daftar Order/Kasir.",
        "Klik detail Order ID UAT.",
        "Cek item, invoice, payment, piutang, stock movement, wallet mutation.",
        "Cari Order ID di Arsip Digital."
      ],
      "expected": [
        "Detail order tidak 0 pcs/Rp0 untuk order valid.",
        "Related IDs tampil.",
        "Arsip menampilkan timeline."
      ]
    },
    {
      "id": "7B-08",
      "title": "Void / Batal Order Jika Fitur Ada",
      "risk": "High",
      "steps": [
        "Pilih order UAT yang boleh dibatalkan.",
        "Klik void/batal jika fitur tersedia.",
        "Isi alasan batal.",
        "Cek stok, invoice/payment/piutang/dompet/arsip."
      ],
      "expected": [
        "Void punya alasan dan audit trail.",
        "Status berubah, bukan hilang.",
        "Koreksi stok/dompet jelas jika ada."
      ]
    },
    {
      "id": "7B-09",
      "title": "Papan Pantau Setelah Order",
      "risk": "Medium",
      "steps": [
        "Buka Papan Pantau.",
        "Klik Refresh Data.",
        "Cek Stok Ready, Uang Masuk Aktual, Piutang, Transaksi Terbaru."
      ],
      "expected": [
        "Dashboard berubah sesuai order/payment/piutang.",
        "Transaksi terbaru menampilkan ID terkait."
      ]
    }
  ],
  "blockers": [
    "Order kosong bisa tersimpan.",
    "Qty 0 / Rp0 invalid bisa tersimpan.",
    "Stok berkurang tapi order item tidak terbaca.",
    "Order header 0 pcs/Rp0 padahal stok berkurang.",
    "Double submit membuat transaksi ganda.",
    "Stok minus.",
    "Payment masuk tapi wallet mutation tidak ada.",
    "Wallet mutation ada tapi source ID kosong.",
    "Piutang salah hitung.",
    "Arsip Digital tidak menemukan Order/Invoice/Payment ID."
  ]
};
