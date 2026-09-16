import Link from 'next/link';
import { ShieldCheck, Lock, AlertTriangle, EyeOff, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto py-2">
      {/* Header */}
      <div className="border-b border-border/40 pb-5 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Privacy Notice
          </h1>
          <Badge variant="outline" className="font-mono text-xs">
            v1.0
          </Badge>
        </div>
        <p className="text-base sm:text-lg font-medium text-foreground">
          &ldquo;Your confession is public. Your profile doesn&rsquo;t have to be.&rdquo;
        </p>
      </div>

      {/* Core Principles */}
      <div className="grid gap-4">
        {/* Principle 1 */}
        <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              1. Tanpa Profil Publik atau Pelacakan Pihak Ketiga
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Confession Booth dirancang secara fundamental agar setiap orang dapat berekspresi tanpa
            keharusan mengekspos profil publik. Feed kami tidak menampilkan alamat dompet (wallet
            address), pengenal internal terpusat, alamat IP pengguna, atau catatan rahasia apa pun.
          </p>
        </section>

        {/* Principle 2 */}
        <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              2. Kriptografi Zero-Knowledge (ZK Stealth)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Pada mode ZK Stealth, bukti keanggotaan digenerate secara lokal di dalam browser Anda
            menggunakan algoritma cryptographic Merkle Proof dan Epoch Nullifier. Paket data
            dikirimkan ke server backend <strong>tanpa header otentikasi atau token sesi</strong>,
            sehingga secara matematis mustahil bagi server untuk mengaitkan pengakuan tersebut
            dengan alamat wallet pengirim.
          </p>
        </section>

        {/* Principle 3 */}
        <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              3. Kejujuran Mengenai Batas Anonimitas
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Kami <strong>tidak pernah menjanjikan anonimitas sempurna</strong>. Riwayat transaksi
            blockchain, metadata RPC/jaringan, dan perilakumu sendiri masih bisa menjadi sumber
            korelasi.
          </p>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <strong>Peringatan Penting:</strong> Jangan tulis nama, alamat, nomor telepon, atau
            detail unik yang mudah mengidentifikasimu.
          </div>
        </section>

        {/* Principle 4 */}
        <section className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              4. Sifat Historis Blockchain
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Setiap pengakuan dicatat dalam bentuk ringkasan kriptografis (SHA-256 Digest) pada
            blockchain Ethereum Sepolia. Meskipun tim moderasi dapat menyembunyikan konten dari feed
            aplikasi atas pelanggaran hukum, referensi transaksi blockchain yang telah diterbitkan
            bersifat historis dan tidak dapat dihapus secara retroaktif.
          </p>
        </section>
      </div>

      <div className="pt-2 flex items-center justify-between">
        <Link href="/feed">
          <Button variant="outline" size="sm" className="rounded-full">
            ← Kembali ke Feed
          </Button>
        </Link>
        <Link href="/guidelines">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Panduan Komunitas (Guidelines) →
          </Button>
        </Link>
      </div>
    </div>
  );
}
