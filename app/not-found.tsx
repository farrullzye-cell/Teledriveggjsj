import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-extrabold text-cyan-400 font-mono">404</h1>
        <h2 className="text-2xl font-bold">Halaman Tidak Ditemukan</h2>
        <p className="text-slate-400 text-sm">
          Halaman atau berkas yang Anda cari tidak ditemukan di server RULLZYE CLOUD.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition shadow-lg shadow-cyan-500/20"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
