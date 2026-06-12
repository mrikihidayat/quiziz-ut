require("dotenv").config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ ENV tidak ditemukan! Pastikan .env.local punya:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL=...");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=...");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const readline = require("readline");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper: tanya ke terminal, return Promise<string>
function tanya(rl, pertanyaan) {
  return new Promise((resolve) => rl.question(pertanyaan, resolve));
}

// Validasi UUID format
function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Fetch soal berdasarkan matkul_id dan range nomor
async function fetchSoal(matkulId, dari, sampai) {
  const { data, error } = await supabase
    .from("soal")
    .select("id, nomor_soal, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar")
    .eq("matkul_id", matkulId)
    .gte("nomor_soal", dari)
    .lte("nomor_soal", sampai)
    .order("nomor_soal", { ascending: true });

  if (error) throw new Error(`Gagal fetch soal: ${error.message}`);
  return data;
}

// Update jawaban satu soal
async function updateJawaban(soalId, jawaban) {
  const { error } = await supabase
    .from("soal")
    .update({ jawaban_benar: jawaban.toUpperCase() })
    .eq("id", soalId);

  if (error) throw new Error(`Gagal update: ${error.message}`);
}

// Potong teks panjang biar rapi di terminal
function potong(teks, maks = 70) {
  if (!teks) return "-";
  return teks.length > maks ? teks.slice(0, maks) + "..." : teks;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   📝  UPDATE JAWABAN SOAL — Supabase    ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // --- 1. Minta MATKUL_ID ---
  let matkulId = "";
  while (true) {
    matkulId = (await tanya(rl, "🔑 Masukkan MATKUL_ID (UUID): ")).trim();
    if (isValidUUID(matkulId)) {
      console.log("   ✓ Format UUID valid\n");
      break;
    }
    console.log("   ❌ Format UUID tidak valid, coba lagi.\n");
  }

  // --- 2. Verifikasi matkul ada di DB ---
  console.log("🔍 Mengecek matkul di database...");
  const { data: matkulCheck, error: matkulErr } = await supabase
    .from("soal")
    .select("id", { count: "exact" })
    .eq("matkul_id", matkulId)
    .limit(1);

  if (matkulErr) {
    console.log(`\n❌ Error koneksi: ${matkulErr.message}`);
    rl.close();
    return;
  }

  const { count } = await supabase
    .from("soal")
    .select("*", { count: "exact", head: true })
    .eq("matkul_id", matkulId);

  if (!count || count === 0) {
    console.log("\n❌ Matkul ID tidak ditemukan atau belum ada soal.");
    rl.close();
    return;
  }

  console.log(`   ✓ Ditemukan ${count} soal untuk matkul ini\n`);

  // --- 3. Loop sesi update ---
  while (true) {
    // Tanya range nomor soal
    const dariStr   = (await tanya(rl, "📌 Update soal nomor berapa? Dari: ")).trim();
    const sampaiStr = (await tanya(rl, "                               Sampai: ")).trim();

    const dari   = parseInt(dariStr);
    const sampai = parseInt(sampaiStr);

    if (isNaN(dari) || isNaN(sampai) || dari > sampai || dari < 1) {
      console.log("\n   ⚠ Range tidak valid, coba lagi.\n");
      continue;
    }

    // Fetch soal di range tsb
    console.log(`\n📥 Mengambil soal nomor ${dari}–${sampai}...\n`);
    let soalList;
    try {
      soalList = await fetchSoal(matkulId, dari, sampai);
    } catch (e) {
      console.log(`\n❌ ${e.message}\n`);
      continue;
    }

    if (soalList.length === 0) {
      console.log(`   ⚠ Tidak ada soal di range ${dari}–${sampai}.\n`);
      continue;
    }

    console.log(`   ✓ ${soalList.length} soal ditemukan\n`);
    console.log("━".repeat(60));

    // --- 4. Iterasi tiap soal ---
    let diupdate = 0;
    let diskip   = 0;

    for (const soal of soalList) {
      console.log(`\n🔢 Soal #${soal.nomor_soal}`);
      console.log(`   ❓ ${potong(soal.pertanyaan, 80)}`);
      console.log(`   A. ${potong(soal.pilihan_a)}`);
      console.log(`   B. ${potong(soal.pilihan_b)}`);
      if (soal.pilihan_c) console.log(`   C. ${potong(soal.pilihan_c)}`);
      if (soal.pilihan_d) console.log(`   D. ${potong(soal.pilihan_d)}`);
      console.log(`   💾 Jawaban saat ini: [ ${soal.jawaban_benar ?? "belum diset"} ]`);

      let input = "";
      while (true) {
        input = (await tanya(rl, "   ➤ Jawaban baru (A/B/C/D) atau Enter=skip, Q=keluar: "))
          .trim()
          .toUpperCase();

        if (input === "" || input === "Q") break;
        if (["A", "B", "C", "D"].includes(input)) break;
        console.log("   ⚠ Input tidak valid. Masukkan A, B, C, D, Enter, atau Q.");
      }

      if (input === "Q") {
        console.log("\n👋 Keluar dari sesi update.\n");
        break;
      }

      if (input === "") {
        console.log("   ⏭ Di-skip");
        diskip++;
        continue;
      }

      // Update ke Supabase
      try {
        await updateJawaban(soal.id, input);
        console.log(`   ✅ Jawaban diupdate → ${input}`);
        diupdate++;
      } catch (e) {
        console.log(`   ❌ Gagal update: ${e.message}`);
      }
    }

    // Ringkasan sesi
    console.log("\n" + "━".repeat(60));
    console.log(`📊 Sesi selesai: ✅ Diupdate: ${diupdate}  ⏭ Di-skip: ${diskip}`);
    console.log("━".repeat(60) + "\n");

    // Tanya mau lanjut range lain?
    const lanjut = (await tanya(rl, "🔄 Update range lain? (y/n): ")).trim().toLowerCase();
    if (lanjut !== "y") {
      console.log("\n✨ Selesai! Semoga ujiannya lancar ya~ 🎌\n");
      break;
    }
    console.log();
  }

  rl.close();
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
