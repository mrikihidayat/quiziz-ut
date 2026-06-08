import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import pdf from 'pdf-parse';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── Sanitization Layer: Anti-Watermark UT ───────────────────────────────────
// Menghapus semua pecahan/sisa watermark sebelum dikirim ke AI
function sanitizeWatermark(text: string): string {
  return text
    // Urutan dari kata terpanjang ke terpendek agar tidak ada sisa fragmen
    .replace(/banksoalut/gi, '')
    .replace(/banksoal/gi, '')
    .replace(/soalut/gi, '')
    .replace(/banlut/gi, '')
    .replace(/alut/gi, '')
    // "ban" standalone (dikelilingi spasi/awal-akhir baris) agar tidak memotong kata normal seperti "bantal"
    .replace(/\bban\b/gi, '')
    // Bersihkan spasi ganda yang tersisa setelah penghapusan
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const matkulId = formData.get('matkul_id') as string;
    const mode = (formData.get('mode') as string) || 'pdf';

    if (!matkulId) {
      return NextResponse.json(
        { error: 'Mata Kuliah belum dipilih.' },
        { status: 400 }
      );
    }

    let teksMentah = '';

    // ─── Handler Mode ──────────────────────────────────────────────────────────
    if (mode === 'text') {
      // Mode: Tempel Teks Langsung
      const rawText = formData.get('raw_text') as string;
      if (!rawText || rawText.trim().length < 20) {
        return NextResponse.json(
          { error: 'Teks yang ditempel terlalu pendek atau kosong.' },
          { status: 400 }
        );
      }
      teksMentah = rawText;

    } else {
      // Mode: Upload PDF (default)
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json(
          { error: 'File PDF belum dipilih.' },
          { status: 400 }
        );
      }
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const pdfData = await pdf(buffer);
      teksMentah = pdfData.text;

      if (!teksMentah || teksMentah.trim().length < 50) {
        return NextResponse.json(
          { error: 'Teks dari PDF terlalu pendek atau tidak berhasil diekstrak. Pastikan PDF bukan hasil scan gambar.' },
          { status: 422 }
        );
      }
    }

    // ─── Terapkan Sanitization Layer sebelum dikirim ke AI ────────────────────
    teksMentah = sanitizeWatermark(teksMentah);

    // ─── Prompt Gemini: Doktrin Perbaikan Typo + Anti-Watermark + Tanpa Batas Soal ──
    const promptText = `
Kamu adalah dosen dan editor bahasa akademik ahli. Di bawah ini adalah teks kumpulan soal ujian pilihan ganda yang mengandung banyak TYPO akibat kesalahan ketik atau ekstraksi OCR (contoh: "prsototyping" harusnya "prototyping", "mudsah" harusnya "mudah", "akusrat" harusnya "akurat", "saistem" harusnya "sistem", dll).

Tugas UTAMAMU:
1. Perbaiki semua kata yang typo/salah ketik tersebut menjadi kalimat Bahasa Indonesia yang baku, rapi, dan benar secara ilmiah/akademik.
2. Pastikan tidak ada sisa kata pengganggu atau pecahan watermark seperti "banksoalut" yang terselip di dalam teks pertanyaan maupun pilihan jawaban.
3. Analisis semua pertanyaan yang diberikan di bawah ini untuk menentukan Kunci Jawaban yang paling tepat (A, B, C, atau D).
4. Proses SELURUH soal dalam teks tanpa terkecuali — jangan batasi jumlah soal yang dihasilkan.
5. Hasilkan output HANYA berupa JSON array murni tanpa format markdown petik tiga (\`\`\`json).

ATURAN PENOMORAN (SANGAT PENTING):
- Perhatikan angka nomor soal yang tertera pada teks input (misalnya angka 75, 74, 73, atau Soal 1, Soal 2).
- Tangkap angka tersebut dan masukkan ke dalam field "nomor_soal_asli" di dalam JSON.
- Jangan mengubah atau mengurutkan ulang nomor tersebut! Pertahankan urutan persis seperti yang ada di teks input.
- Jika nomor soal tidak ditemukan, gunakan urutan kemunculan di teks (1, 2, 3, dst).

Format JSON wajib presisi seperti ini:
[
  {
    "nomor_soal_asli": 75,
    "pertanyaan": "Kelebihan dari teknik pengembangan prototyping adalah implementasi akan menjadi mudah, hal ini dikarenakan...",
    "pilihan_a": "perusahaan mempunyai dana yang sangat besar bagi pengembangan sistem tersebut",
    "pilihan_b": "pengguna atau pemilik sistem sudah mempunyai gambaran tentang sistem",
    "pilihan_c": "pengguna atau pemilik sistem ikut terlibat dalam pengembangan sistem",
    "pilihan_d": "tim pengembangan sistem dapat memprediksi dan memperkirakan pengembangan sistem selanjutnya",
    "jawaban_benar": "B"
  }
]

Berikut adalah teks acak-acakan yang harus kamu perbaiki dan susun seluruhnya:
${teksMentah}
`;

    // ─── Panggil Gemini 2.5 Flash ──────────────────────────────────────────────
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
    });

    let rawText = response.text ?? '';

    // Bersihkan jika AI tetap menambahkan markdown fence
    rawText = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    // ─── Parse JSON hasil Gemini ───────────────────────────────────────────────
    let jsonSoalParsed: any[];
    try {
      jsonSoalParsed = JSON.parse(rawText);
    } catch {
      console.error('Gagal parse JSON dari Gemini. Raw output:', rawText);
      return NextResponse.json(
        { error: 'Gemini AI mengembalikan format yang tidak valid. Coba lagi atau periksa isi teks.' },
        { status: 502 }
      );
    }

    if (!Array.isArray(jsonSoalParsed) || jsonSoalParsed.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ditemukan soal pilihan ganda yang valid di dalam teks ini.' },
        { status: 422 }
      );
    }

    // ─── Validasi & Mapping sebelum insert ke Supabase ────────────────────────
    const validJawaban = ['A', 'B', 'C', 'D'];
    const dataSiapInsert = jsonSoalParsed
      .filter((soal: any) =>
        soal.pertanyaan &&
        soal.pilihan_a &&
        soal.pilihan_b &&
        soal.pilihan_c &&
        soal.pilihan_d &&
        validJawaban.includes(soal.jawaban_benar)
      )
      // Urutkan dari nomor soal terkecil ke terbesar agar urutan tampilan konsisten
      .sort((a: any, b: any) => (Number(a.nomor_soal_asli) || 0) - (Number(b.nomor_soal_asli) || 0))
      .map((soal: any) => ({
        matkul_id: matkulId,
        // Terapkan sanitize sekali lagi pada output AI sebagai lapisan kedua
        pertanyaan: sanitizeWatermark(String(soal.pertanyaan).trim()),
        pilihan_a: sanitizeWatermark(String(soal.pilihan_a).trim()),
        pilihan_b: sanitizeWatermark(String(soal.pilihan_b).trim()),
        pilihan_c: sanitizeWatermark(String(soal.pilihan_c).trim()),
        pilihan_d: sanitizeWatermark(String(soal.pilihan_d).trim()),
        jawaban_benar: soal.jawaban_benar as string,
      }));

    if (dataSiapInsert.length === 0) {
      return NextResponse.json(
        { error: 'Semua soal gagal validasi (format tidak lengkap atau jawaban tidak valid A/B/C/D).' },
        { status: 422 }
      );
    }

    // ─── Bulk Insert ke Supabase ───────────────────────────────────────────────
    const { error: supabaseError } = await supabase
      .from('soal')
      .insert(dataSiapInsert);

    if (supabaseError) throw supabaseError;

    return NextResponse.json({
      success: true,
      count: dataSiapInsert.length,
      skipped: jsonSoalParsed.length - dataSiapInsert.length,
      mode,
    });

  } catch (error: any) {
    console.error('Error Server upload-pdf:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan sistem internal.' },
      { status: 500 }
    );
  }
}
