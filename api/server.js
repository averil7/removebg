// File ini HANYA untuk development lokal: npm run dev
// Di Vercel, file ini tidak dipakai — Vercel langsung pakai api/index.js

const app = require("./index");

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📁 File sementara disimpan selama 20 menit`);
});
