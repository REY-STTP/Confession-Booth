export default function PrivacyPage() {
  return (
    <div className="booth-card space-y-4 p-6 text-sm leading-relaxed">
      <h1 className="text-xl font-bold">Privacy Notice</h1>
      <p><strong>Your confession is public. Your profile doesn&rsquo;t have to be.</strong></p>
      <p>
        Confession Booth dirancang agar kamu bisa berekspresi tanpa profil publik. Feed tidak
        menampilkan alamat wallet, ID internal, IP, atau catatan moderasi.
      </p>
      <p>
        Namun kami <strong>tidak menjanjikan anonimitas sempurna</strong>. Riwayat transaksi
        blockchain, metadata RPC/jaringan, dan perilakumu sendiri masih bisa menjadi sumber
        korelasi. Jangan tulis nama, alamat, nomor telepon, atau detail unik yang mudah
        mengidentifikasimu.
      </p>
      <p>
        Referensi blockchain bersifat publik dan historis: menyembunyikan konten di aplikasi
        tidak menghapus transaksi yang sudah terbit.
      </p>
    </div>
  );
}
