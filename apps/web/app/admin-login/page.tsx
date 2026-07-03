import { PinForm } from './PinForm';
import { ShieldCheck } from 'lucide-react';
import Image from 'next/image';

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-5">
            <Image src="/kotha-logo.png" alt="KothaBot" width={44} height={44} className="rounded-xl" />
            <span className="text-xl font-bold text-white">KothaBot</span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-red-600/20 border-2 border-red-600/40 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={24} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Master Admin</h1>
          <p className="text-sm text-gray-400 mt-1">Enter your admin PIN to continue</p>
        </div>

        <PinForm />

        {/* Security notice */}
        <p className="text-center text-[11px] text-gray-600 mt-6">
          This area is restricted. All access is logged.
        </p>
      </div>
    </div>
  );
}
