import Link from 'next/link';
import { BookOpen, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const FORBIDDEN_ITEMS = [
  {
    title: 'Ancaman Kredibel',
    desc: 'Ancaman kekerasan atau bahaya fisik terhadap individu atau kelompok.',
  },
  {
    title: 'Pelecehan Tertarget',
    desc: 'Perundungan berulang, intimidasi, atau penghinaan yang ditujukan secara spesifik.',
  },
  {
    title: 'Doxxing & Data Pribadi',
    desc: 'Menyebarkan nama lengkap, nomor telepon, alamat rumah, atau data rahasia orang lain.',
  },
  {
    title: 'Kredensial / Akun',
    desc: 'Membagikan password, private key, token autentikasi, atau akses ilegal.',
  },
  {
    title: 'Eksploitasi Anak',
    desc: 'Segala bentuk konten yang melibatkan bahaya atau eksploitasi anak (Nol toleransi).',
  },
  {
    title: 'Instruksi Kejahatan',
    desc: 'Panduan atau tutorial untuk melakukan tindak kriminal dan kekerasan.',
  },
  { title: 'Malware & Phishing', desc: 'Tautan berbahaya atau manipulasi rekayasa sosial.' },
  {
    title: 'Spam & Otomasi Liar',
    desc: 'Flooding pesan berulang, iklan komersial ilegal, atau bot manipulatif.',
  },
];

export default function GuidelinesPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto py-2">
      {/* Header */}
      <div className="border-b border-border/40 pb-5 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Community Guidelines
          </h1>
          <Badge variant="outline" className="font-mono text-xs">
            v1.0
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Panduan komunitas untuk menjaga kesakralan, ketenangan, dan rasa aman bagi setiap jiwa
          yang berbagi di suaka pengakuan ini.
        </p>
      </div>

      {/* Philosophy */}
      <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          1. Filosofi Suaka Anonim
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Anonimitas sejati diciptakan agar manusia dapat jujur terhadap dirinya sendiri tanpa takut
          dipermalukan atau dihakimi secara sosial. Namun,{' '}
          <strong>anonimitas bukanlah ketiadaan konsekuensi</strong>. Hak bersuara Anda berakhir
          ketika suara tersebut digunakan untuk mencelakakan sesama.
        </p>
      </section>

      {/* Content Limits */}
      <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          2. Batas Teknis Pengakuan
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-1">
            <span className="font-semibold text-foreground block">
              Pengakuan Utama (Confession)
            </span>
            <p className="text-muted-foreground">
              Maksimal 500 karakter, teks biasa (plaintext), satu kategori emosi utama.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-1">
            <span className="font-semibold text-foreground block">Bisikan Rantai (Whisper)</span>
            <p className="text-muted-foreground">
              Maksimal 300 karakter, teks biasa, dapat merespons pengakuan atau whisper lain.
            </p>
          </div>
        </div>
      </section>

      {/* Prohibited Content */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            3. Pelanggaran yang Dilarang Keras
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FORBIDDEN_ITEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-1 hover:border-destructive/40 transition-colors"
            >
              <span className="text-xs font-semibold text-destructive block">✕ {item.title}</span>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Moderation Workflow */}
      <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-4 shadow-sm">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          4. Alur Penegakan Moderasi Transparan
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="rounded-lg border border-border/60 bg-background/60 p-2.5 text-center flex-1">
            <span className="font-semibold text-foreground block">1. Laporan Komunitas</span>
            <span>Pelaporan via tombol Report</span>
          </div>
          <ArrowRight className="h-4 w-4 mx-auto hidden sm:block opacity-40" />
          <div className="rounded-lg border border-border/60 bg-background/60 p-2.5 text-center flex-1">
            <span className="font-semibold text-foreground block">2. Triage & Karantina</span>
            <span>Deteksi prioritas instan</span>
          </div>
          <ArrowRight className="h-4 w-4 mx-auto hidden sm:block opacity-40" />
          <div className="rounded-lg border border-border/60 bg-background/60 p-2.5 text-center flex-1">
            <span className="font-semibold text-foreground block">3. Audit Log Terbuka</span>
            <span>Aksi dicatat tanpa doxxing</span>
          </div>
        </div>
      </section>

      <div className="pt-2 flex items-center justify-between">
        <Link href="/feed">
          <Button variant="outline" size="sm" className="rounded-full">
            ← Kembali ke Feed
          </Button>
        </Link>
        <Link href="/privacy">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Kebijakan Privasi & Kriptografi →
          </Button>
        </Link>
      </div>
    </div>
  );
}
