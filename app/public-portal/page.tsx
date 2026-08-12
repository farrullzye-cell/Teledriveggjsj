'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cloud, ArrowLeft, Download, ExternalLink, Code, Server, CheckCircle2, Copy, Check } from 'lucide-react';

export default function PublicPortalPreviewPage() {
  const [originUrl, setOriginUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOriginUrl(window.location.origin);
  }, []);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`${originUrl}/api/v1/public/media`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070A13] text-slate-100 flex flex-col font-sans">
      {/* Top Banner Bar */}
      <header className="bg-slate-900 border-b border-slate-800 py-3 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Kembali ke Dashboard Privat
          </Link>
          <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400 border-l border-slate-800 pl-4 font-mono">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Render Backend API: <strong className="text-slate-200">https://teledriveggjsj.onrender.com</strong></span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href="/netlify-site/index.html"
            target="_blank"
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border border-slate-700"
            title="Buka Website Netlify di Tab Baru"
          >
            <span>Preview Netlify Site</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </a>
        </div>
      </header>

      {/* Embedded Netlify Public Site iFrame */}
      <div className="flex-1 w-full relative">
        <iframe
          src="/netlify-site/index.html"
          className="w-full h-full border-0 absolute inset-0 bg-[#030712]"
          title="RULLZYE CLOUD Netlify Public Portal Preview"
        />
      </div>
    </div>
  );
}
