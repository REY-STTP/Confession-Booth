export default function GuidelinesPage() {
  const forbidden = [
    'Ancaman kredibel', 'Pelecehan tertarget', 'Doxxing', 'Kredensial/milik orang lain',
    'Konten seksual melibatkan anak', 'Instruksi pelanggaran serius', 'Malware/phishing', 'Spam & manipulasi otomatis',
  ];
  return (
    <div className="booth-card space-y-4 p-6 text-sm leading-relaxed">
      <h1 className="text-xl font-bold">Community Guidelines <span className="text-xs font-normal text-booth-dim">v1.0</span></h1>
      <p>Anonim bukan berarti tanpa konsekuensi. Batas konten: confession 500 karakter, whisper 300 karakter, satu kategori, tanpa link/HTML di MVP.</p>
      <ul className="list-disc pl-5">
        {forbidden.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <p>Pelanggaran diproses: report → triage → quarantine prioritas untuk konten kritis → keputusan moderator → audit log.</p>
    </div>
  );
}
