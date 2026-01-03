import Link from 'next/link'
import Logo from '@/components/Logo'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Premium Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #C4885E 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* Logo Outside Card - Compact */}
      <div className="mb-3 flex justify-center z-10">
        <Logo width={240} height={91} />
      </div>

      {/* Premium Glass Card */}
      <div className="max-w-lg w-full glass-card rounded-2xl p-6 text-center relative z-10 shadow-2xl">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 mb-1.5">
            Bestelling Volgen Portaal
          </h1>
          <p className="text-xs text-gray-600">
            Volg de leveringsstatus van uw bestelling in real-time
          </p>
        </div>
        
        <div className="flex justify-center mb-5">
          <Link
            href="/track"
            className="inline-block bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white font-semibold py-2.5 px-8 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm"
          >
            Volg Uw Bestelling
          </Link>
        </div>

        {/* Decorative Elements */}
        <div className="pt-4 border-t border-gray-200/50">
          <p className="text-xs text-gray-500">
            Veilig • Privé • Real-time Updates
          </p>
        </div>
      </div>
    </div>
  )
}

