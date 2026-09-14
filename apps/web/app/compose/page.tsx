import { ComposerForm } from '@/app/components/composer';

export default function ComposePage() {
  return (
    <div className="space-y-4">
      <ComposerForm />
      <p className="text-xs leading-relaxed text-booth-dim">
        Dengan menekan Confess kamu memahami: konten bersifat publik, moderasi dapat menyembunyikan
        konten yang melanggar, dan referensi blockchain bersifat historis. Lihat{' '}
        <a className="underline" href="/guidelines">Guidelines</a>.
      </p>
    </div>
  );
}
