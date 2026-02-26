# ✂️ Hapus Background Gambar

Aplikasi web untuk menghapus background gambar menggunakan AI, dengan penyimpanan sementara **20 menit**.

## Fitur
- Upload gambar JPG, PNG, WebP (maks 10MB)
- Hapus background otomatis menggunakan AI (`@imgly/background-removal-node`)
- File hasil disimpan sementara selama **20 menit**, lalu otomatis dihapus
- Countdown timer di UI
- Bisa di-deploy di Vercel

---

## Cara Deploy ke Vercel

### 1. Clone & Install
```bash
git clone <repo-url>
cd bg-remover
npm install
```

### 2. Jalankan Lokal
```bash
npm run dev
# Buka http://localhost:3000
```

### 3. Deploy ke Vercel
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## Struktur Proyek
```
bg-remover/
├── api/
│   ├── index.js      # Express app (handler Vercel)
│   └── server.js     # Entry point lokal
├── public/
│   └── index.html    # Frontend UI
├── vercel.json       # Konfigurasi Vercel
├── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/api/remove-bg` | Upload gambar & hapus background |
| GET | `/api/download/:id` | Download hasil |
| GET | `/api/status/:id` | Cek status / sisa waktu file |

### POST `/api/remove-bg`
**Request:** `multipart/form-data` dengan field `image`

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "downloadUrl": "/api/download/uuid",
  "expiresIn": 1200,
  "expiresAt": "2024-01-01T00:20:00.000Z"
}
```

---

## Catatan untuk Vercel
- Vercel menggunakan `/tmp` untuk penyimpanan file sementara
- Cleanup otomatis berjalan setiap 1 menit
- Untuk skala besar, disarankan gunakan penyimpanan eksternal (S3, Cloudflare R2, dll.)
