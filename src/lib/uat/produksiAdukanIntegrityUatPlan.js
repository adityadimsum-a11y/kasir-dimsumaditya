export const produksiAdukanIntegrityUatPlan = {
  "title": "Produksi / Adukan → Stok Jadi Final Check",
  "version": "Part 7C",
  "mode": "Checklist Read-Only",
  "objective": "Pastikan alur produksi aman untuk operasional harian: ayam lot tersedia, produksi memotong ayam, stok jadi bertambah, modal/pcs tercatat, dan semua ID masuk Arsip Digital.",
  "scenarios": [
    {
      "id": "7C-PRE",
      "title": "Persiapan Produksi / Adukan",
      "risk": "Low",
      "steps": [
        "Login sebagai Owner/Tangerang atau role produksi yang diizinkan.",
        "Buka Data Health, pastikan Masalah Bahaya = 0.",
        "Buka DROP Ayam / Stok Ayam, pastikan ada lot ayam aktif.",
        "Catat sisa kg ayam awal dari lot yang dipakai.",
        "Buka Stok Jadi, catat stok ready produk awal.",
        "Siapkan skenario UAT kecil: contoh 1 adukan."
      ],
      "expected": [
        "Lot ayam aktif tersedia.",
        "Sisa kg ayam awal tercatat.",
        "Stok jadi awal tercatat.",
        "Role produksi punya akses sesuai permission."
      ]
    },
    {
      "id": "7C-01",
      "title": "Block Produksi Tanpa Lot Ayam",
      "risk": "Blocker jika gagal",
      "steps": [
        "Buka Produksi / Adukan.",
        "Coba submit produksi tanpa memilih lot ayam atau tanpa stok ayam yang cukup.",
        "Amati respon UI/backend."
      ],
      "expected": [
        "Produksi ditolak jika tidak ada lot ayam valid.",
        "Tidak ada production batch baru.",
        "Tidak ada stok jadi bertambah.",
        "Tidak ada stock movement palsu."
      ]
    },
    {
      "id": "7C-02",
      "title": "Block Adukan 0 / Kosong",
      "risk": "Blocker jika gagal",
      "steps": [
        "Buka form produksi.",
        "Pilih lot ayam.",
        "Input jumlah adukan 0 atau kosong.",
        "Klik simpan jika tombol tersedia."
      ],
      "expected": [
        "Adukan 0/kosong ditolak.",
        "Tidak ada batch produksi baru.",
        "Stok ayam dan stok jadi tidak berubah."
      ]
    },
    {
      "id": "7C-03",
      "title": "Block Ayam Tidak Cukup",
      "risk": "Blocker jika gagal",
      "steps": [
        "Pilih lot ayam aktif.",
        "Input jumlah adukan lebih besar dari sisa kg ayam.",
        "Klik simpan produksi."
      ],
      "expected": [
        "Produksi ditolak karena ayam tidak cukup.",
        "Sisa kg ayam tidak boleh minus.",
        "Stok jadi tidak boleh bertambah."
      ]
    },
    {
      "id": "7C-04",
      "title": "Produksi Normal 1 Adukan",
      "risk": "High",
      "steps": [
        "Catat sisa kg ayam lot awal.",
        "Catat stok jadi awal.",
        "Buka Produksi / Adukan.",
        "Pilih lot ayam aktif.",
        "Input 1 adukan.",
        "Pastikan preview: 1 adukan = 30 kg ayam = 1.000 pcs.",
        "Simpan produksi jika data UAT disetujui.",
        "Catat Production Batch ID, Stock OUT Ayam ID, Stock IN Jadi ID, Cost Layer ID jika ada."
      ],
      "expected": [
        "Production Batch ID terbentuk.",
        "Ayam lot berkurang 30 kg.",
        "Stok jadi bertambah 1.000 pcs.",
        "Stock movement OUT ayam terbentuk.",
        "Stock movement IN produk jadi terbentuk.",
        "Modal/pcs atau cost layer terbaca.",
        "Arsip Digital menemukan semua ID."
      ]
    },
    {
      "id": "7C-05",
      "title": "Produksi Lebih dari 1 Adukan",
      "risk": "High",
      "steps": [
        "Pakai lot ayam yang masih cukup.",
        "Input 2 adukan atau angka kecil lain yang disetujui.",
        "Simpan produksi.",
        "Cek pengurangan ayam dan penambahan stok jadi."
      ],
      "expected": [
        "Kg ayam berkurang sesuai rumus: adukan x 30 kg.",
        "Stok jadi bertambah sesuai rumus: adukan x 1.000 pcs.",
        "Tidak ada pembulatan aneh.",
        "Cost layer tetap sesuai harga lot ayam aktual."
      ]
    },
    {
      "id": "7C-06",
      "title": "Stok Jadi Masuk Siap Jual / Bucket Benar",
      "risk": "High",
      "steps": [
        "Buka Stok Jadi setelah produksi.",
        "Cek produk Dimsum Ayam Mix / Dimsum Original sesuai output.",
        "Pastikan stok masuk ke bucket yang benar: Stok Bebas/Ready atau bucket produksi yang ditentukan.",
        "Cek apakah Kasir/Order membaca stok ready tersebut."
      ],
      "expected": [
        "Stok jadi muncul di halaman Stok Jadi.",
        "Bucket stok benar.",
        "Kasir/Order bisa membaca stok ready.",
        "Total freezer bukan satu-satunya sumber jual; yang dijual harus stok siap jual."
      ]
    },
    {
      "id": "7C-07",
      "title": "Modal / HPP Terkunci dari Lot",
      "risk": "High",
      "steps": [
        "Cek detail batch produksi.",
        "Cek harga/kg ayam yang dipakai.",
        "Bandingkan dengan nota DROP ayam lot tersebut.",
        "Pastikan modal/pcs tidak berubah karena harga baru lain."
      ],
      "expected": [
        "Harga/kg produksi mengikuti lot ayam yang dipakai.",
        "Modal/pcs historis terkunci.",
        "Transaksi lama tidak ikut berubah jika harga ayam baru masuk.",
        "Cost layer/detail modal punya source ID lot ayam."
      ]
    },
    {
      "id": "7C-08",
      "title": "Detail Produksi & Rantai ID",
      "risk": "High",
      "steps": [
        "Buka daftar Produksi / Adukan.",
        "Klik detail Production Batch ID.",
        "Cek lot ayam, stock OUT ayam, stock IN produk jadi, cost layer, user, timestamp.",
        "Cari Production Batch ID di Arsip Digital."
      ],
      "expected": [
        "Detail batch tampil jelas.",
        "Related IDs tampil.",
        "Arsip Digital menampilkan timeline produksi.",
        "Tidak ada angka yatim."
      ]
    },
    {
      "id": "7C-09",
      "title": "Papan Pantau Setelah Produksi",
      "risk": "Medium",
      "steps": [
        "Buka Papan Pantau.",
        "Klik Refresh Data.",
        "Cek Stok Ayam, Stok Jadi/Ready, Radar produksi, dan Transaksi Terbaru."
      ],
      "expected": [
        "Sisa ayam berkurang.",
        "Stok jadi bertambah.",
        "Radar produksi berubah sesuai data.",
        "Transaksi terbaru menampilkan ID produksi/stock movement."
      ]
    }
  ],
  "blockers": [
    "Produksi bisa disimpan tanpa lot ayam.",
    "Adukan 0/kosong bisa tersimpan.",
    "Ayam bisa minus.",
    "Stok jadi bertambah tapi ayam tidak berkurang.",
    "Ayam berkurang tapi stok jadi tidak bertambah.",
    "1 adukan tidak sesuai rumus 30 kg / 1.000 pcs tanpa alasan valid.",
    "Stock movement OUT/IN tidak terbentuk.",
    "Modal/pcs tidak punya source lot ayam.",
    "Harga lama berubah saat harga ayam baru masuk.",
    "Arsip Digital tidak menemukan Production Batch / Stock Movement ID."
  ]
};
