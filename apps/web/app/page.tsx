import Link from 'next/link';

export default function Landing() {
  return (
    <div className="space-y-8">
      <section className="booth-card p-10 text-center" aria-label="Hero">
        <p className="text-4xl" aria-hidden="true">🕯️</p>
        <h1 className="mt-4 text-4xl font-bold">Say what you can&rsquo;t say.</h1>
        <p className="mt-3 text-booth-dim">Nobody needs to know who you are.</p>
        <div className="mt-6">
          <Link
            href="/feed"
            className="inline-block rounded-2xl bg-booth-accent px-8 py-4 text-lg font-semibold text-black"
          >
            Enter the Booth
          </Link>
        </div>
        <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-booth-dim">
          Your confession is public. Your profile doesn&rsquo;t have to be. Blockchain and
          network metadata can still create privacy risks — don&rsquo;t include information
          that could identify you. <a className="underline" href="/privacy">Pelajari batas privasi</a>.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Cara kerja">
        {[
          ['① Masuk tanpa identitas', 'Baca feed publik tanpa wallet. Tanpa nama, tanpa profil.'],
          ['② Tulis & pilih kategori', 'Maks 500 karakter, teks biasa, satu kategori.'],
          ['③ Terbit anonim', 'Tampil sebagai Anonymous #NNNN. Bisa di-react & di-whisper.'],
        ].map(([t, s]) => (
          <div key={t} className="booth-card p-5">
            <p className="font-semibold">{t}</p>
            <p className="mt-2 text-sm text-booth-dim">{s}</p>
          </div>
        ))}
      </section>

      <section className="booth-card p-6 text-sm text-booth-dim" aria-label="Reaksi">
        <p className="font-semibold text-booth-ink">Reaksi di booth</p>
        <p className="mt-2">🕯️ I understand · ❤️ Sending love · 😭 I feel this · 💀 That&rsquo;s wild · 😂 I shouldn&rsquo;t laugh</p>
        <p className="mt-3">
          Lihat <a className="underline" href="/midnight">Midnight Confessions</a> — <em>things people only say when nobody is listening.</em>
        </p>
      </section>
    </div>
  );
}
