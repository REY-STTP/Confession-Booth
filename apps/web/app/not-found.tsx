import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="booth-card p-10 text-center" role="status">
      <p className="text-4xl" aria-hidden="true">🕯️</p>
      <h1 className="mt-4 text-xl font-bold">Ruangan ini kosong.</h1>
      <p className="mt-2 text-sm text-booth-dim">Halaman tidak ditemukan atau konten telah dimoderasi.</p>
      <Link href="/feed" className="mt-6 inline-block rounded-xl bg-booth-accent px-6 py-3 font-semibold text-black">
        Kembali ke feed
      </Link>
    </div>
  );
}
