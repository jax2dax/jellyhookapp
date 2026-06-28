// import React from 'react'
// import { SignInButton, SignUpButton, Show , UserButton, SignOutButton, UserProfile } from '@clerk/nextjs'
// import Link from 'next/link'

// const page = () => {
//   return (
//     <div>
//       <div className='flex items-center gap-8 '>
//           <Show when="signed-out">
//             <SignInButton />
//           </Show>

//           <Show when="signed-in">
//             <SignOutButton redirectUrl="/">
//               <button>Sign out</button>
//             </SignOutButton>
//             <UserButton />
//             <Link href="/test" className='p-4 rounded-2xl border-green-500 border-2 border-solid'>test-</Link>
//           </Show>
//       </div>
//     </div>
//   )
// }

// export default page
"use client"
import React from 'react'
import {
    SignInButton,
    SignUpButton,
    Show,
    UserButton,
    SignOutButton,
} from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowRight, Zap, Shield, Rocket, Menu, X } from 'lucide-react'

const LandingPage = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

    return (
        <div className="min-h-screen bg-black text-white overflow-x-hidden">
            {/* ===== NAVBAR ===== */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-green-500/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 md:h-20">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            
                            <span className="text-xl font-bold tracking-tight">
                                <span className="text-green-400">Jelly</span>
                                <span className="text-white">hook</span>
                            </span>
                        </div>

                        {/* Desktop Nav Links */}
                        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
                            <Link href="#features" className="text-gray-300 hover:text-green-400 transition-colors">
                                Features
                            </Link>
                            <Link href="#pricing" className="text-gray-300 hover:text-green-400 transition-colors">
                                Pricing
                            </Link>
                            <Link href="#about" className="text-gray-300 hover:text-green-400 transition-colors">
                                About
                            </Link>
                        </div>

                        {/* Desktop Auth + CTA */}
                        <div className="hidden md:flex items-center gap-4">
                            <Show when="signed-out">
                                <SignInButton mode="modal">
                                    <button className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                                        Sign In
                                    </button>
                                </SignInButton>
                                <SignUpButton mode="modal">
                                    <button className="relative px-5 py-2.5 text-sm font-bold text-black bg-gradient-to-r from-green-400 to-green-500 rounded-xl shadow-[0_0_25px_rgba(57,255,20,0.35)] hover:shadow-[0_0_45px_rgba(57,255,20,0.55)] transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden group">
                                        <span className="relative z-10 flex items-center gap-2">
                                            Get Started
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </span>
                                        <span className="absolute inset-0 bg-gradient-to-r from-green-300 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </button>
                                </SignUpButton>
                            </Show>

                            <Show when="signed-in">
                                <Link href="/dashboard">
                                    <button className="relative px-5 py-2.5 text-sm font-bold text-black bg-gradient-to-r from-green-400 to-green-500 rounded-xl shadow-[0_0_25px_rgba(57,255,20,0.35)] hover:shadow-[0_0_45px_rgba(57,255,20,0.55)] transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden group">
                                        <span className="relative z-10 flex items-center gap-2">
                                            Dashboard
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </span>
                                        <span className="absolute inset-0 bg-gradient-to-r from-green-300 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </button>
                                </Link>
                                <UserButton
                                   // afterSignOutUrl="/"
                                    appearance={{
                                        elements: {
                                            avatarBox: 'w-9 h-9 ring-2 ring-green-500/50 ring-offset-2 ring-offset-black rounded-full',
                                        },
                                    }}
                                />
                            </Show>
                        </div>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden text-white p-2 hover:text-green-400 transition-colors"
                        >
                            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden bg-black/95 backdrop-blur-xl border-b border-green-500/20 py-4 px-4">
                        <div className="flex flex-col gap-3">
                            <Link
                                href="#features"
                                className="text-gray-300 hover:text-green-400 transition-colors py-2 px-3 rounded-lg hover:bg-white/5"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Features
                            </Link>
                            <Link
                                href="#pricing"
                                className="text-gray-300 hover:text-green-400 transition-colors py-2 px-3 rounded-lg hover:bg-white/5"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                Pricing
                            </Link>
                            <Link
                                href="#about"
                                className="text-gray-300 hover:text-green-400 transition-colors py-2 px-3 rounded-lg hover:bg-white/5"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                About
                            </Link>
                            <div className="border-t border-green-500/20 pt-3 mt-1 flex flex-col gap-3">
                                <Show when="signed-out">
                                    <SignInButton mode="modal">
                                        <button className="w-full py-2.5 text-sm font-medium text-gray-300 hover:text-white border border-gray-700 rounded-xl transition-colors">
                                            Sign In
                                        </button>
                                    </SignInButton>
                                    <SignUpButton mode="modal">
                                        <button className="w-full py-2.5 text-sm font-bold text-black bg-gradient-to-r from-green-400 to-green-500 rounded-xl shadow-[0_0_25px_rgba(57,255,20,0.25)] hover:shadow-[0_0_40px_rgba(57,255,20,0.45)] transition-all duration-300">
                                            Get Started
                                        </button>
                                    </SignUpButton>
                                </Show>
                                <Show when="signed-in">
                                    <SignOutButton redirectUrl="/">
                                        <button className="w-full py-2.5 text-sm font-medium text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors">
                                            Sign Out
                                        </button>
                                    </SignOutButton>
                                    <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                                        <button className="w-full py-2.5 text-sm font-bold text-black bg-gradient-to-r from-green-400 to-green-500 rounded-xl shadow-[0_0_25px_rgba(57,255,20,0.25)]">
                                            Dashboard
                                        </button>
                                    </Link>
                                    <div className="flex items-center justify-center py-2">
                                        <UserButton
                                           // afterSignOutUrl="/"
                                            appearance={{
                                                elements: {
                                                    avatarBox: 'w-10 h-10 ring-2 ring-green-500/50 ring-offset-2 ring-offset-black rounded-full',
                                                },
                                            }}
                                        />
                                    </div>
                                </Show>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* ===== HERO SECTION ===== */}
            <section className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-green-400/5 rounded-full blur-3xl pointer-events-none" />

                <div className="max-w-7xl mx-auto relative">
                    <div className="text-center max-w-4xl mx-auto">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-medium mb-6 backdrop-blur-sm">
                            <Zap className="w-4 h-4 fill-green-400" />
                            <span>🚀 Now in Public Beta</span>
                        </div>

                        {/* Heading */}
                        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
                            <span className="text-white">Build the </span>
                            <span className="bg-gradient-to-r from-green-300 via-green-400 to-green-500 bg-clip-text text-transparent">
                                Future
                            </span>
                            <br />
                            <span className="text-white">at </span>
                            <span className="bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent">
                                Jellyhook
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="mt-6 text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                            The Lead tracking platform that will help you close more deals.
                            Blazing fast, ridiculously simple, and{' '}
                            <span className="text-green-400 font-medium">unapologetically green</span>.
                        </p>

                        {/* CTA Buttons - Hero */}
                        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Show when="signed-out">
                                <SignUpButton mode="modal">
                                    <button className="group relative px-8 py-4 text-base font-bold text-black bg-gradient-to-r from-green-400 to-green-500 rounded-2xl shadow-[0_0_40px_rgba(57,255,20,0.35)] hover:shadow-[0_0_60px_rgba(57,255,20,0.55)] transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden w-full sm:w-auto">
                                        <span className="relative z-10 flex items-center justify-center gap-3">
                                            Start and grow your business
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                                        </span>
                                        <span className="absolute inset-0 bg-gradient-to-r from-green-300 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </button>
                                </SignUpButton>
                                <SignInButton mode="modal">
                                    <button className="px-8 py-4 text-base font-medium text-white border border-gray-700 rounded-2xl hover:border-green-500/50 hover:bg-white/5 transition-all duration-300 w-full sm:w-auto">
                                        Sign In
                                    </button>
                                </SignInButton>
                            </Show>

                            <Show when="signed-in">
                                <Link href="/dashboard">
                                    <button className="group relative px-8 py-4 text-base font-bold text-black bg-gradient-to-r from-green-400 to-green-500 rounded-2xl shadow-[0_0_40px_rgba(57,255,20,0.35)] hover:shadow-[0_0_60px_rgba(57,255,20,0.55)] transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden w-full sm:w-auto">
                                        <span className="relative z-10 flex items-center justify-center gap-3">
                                            Go to Dashboard
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                                        </span>
                                        <span className="absolute inset-0 bg-gradient-to-r from-green-300 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </button>
                                </Link>
                                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-green-500/20 bg-white/5">
                                    <UserButton
                                      //  afterSignOutUrl="/"
                                        appearance={{
                                            elements: {
                                                avatarBox: 'w-10 h-10 ring-2 ring-green-500/50 ring-offset-2 ring-offset-black rounded-full',
                                            },
                                        }}
                                    />
                                    <span className="text-sm text-gray-400">Welcome back!</span>
                                </div>
                            </Show>
                        </div>

                        {/* Social proof */}
                        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
                            <span className="flex items-center gap-2">
                                <span className="flex -space-x-2">
                                    {['A', 'B', 'C', 'D'].map((_, i) => (
                                        <div
                                            key={i}
                                            className="w-7 h-7 rounded-full border-2 border-black bg-gradient-to-br from-green-400/60 to-green-600/60"
                                        />
                                    ))}
                                </span>
                                <span className="text-gray-400">
                                    <span className="text-green-400 font-semibold">100+</span> businesses
                                </span>
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="text-yellow-400">★★★★★</span>
                                <span className="text-gray-400">4.2/5</span>
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400"></span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== FEATURES SECTION ===== */}
            <section id="features" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 border-t border-green-500/10">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-bold">
                            <span className="text-white">Built for </span>
                            <span className="bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent">
                                Conversion Tracking
                            </span>
                            <span className="text-white"> &amp; </span>
                            <span className="bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent">
                                Intent discovery
                            </span>
                        </h2>
                        <p className="mt-4 text-gray-400 max-w-xl mx-auto">
                            Understand your business's conversion rate better!
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                        {[
                            {
                                icon: <Zap className="w-6 h-6 text-green-400" />,
                                title: 'Lightning Fast',
                                desc: 'Optimized for performance with sub-millisecond response times.',
                            },
                            {
                                icon: <Shield className="w-6 h-6 text-green-400" />,
                                title: 'Enterprise Grade',
                                desc: 'Bank-level security with end-to-end encryption out of the box.',
                            },
                            {
                                icon: <Rocket className="w-6 h-6 text-green-400" />,
                                title: 'Deploy Instantly',
                                desc: 'One-click deployment to the edge with global CDN distribution.',
                            },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="group relative p-8 rounded-2xl border border-green-500/10 bg-white/5 backdrop-blur-sm hover:border-green-500/30 hover:bg-white/10 transition-all duration-500 hover:-translate-y-2"
                            >
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative z-10">
                                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 group-hover:shadow-[0_0_30px_rgba(57,255,20,0.15)]">
                                        {feature.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== CTA BANNER ===== */}
            <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-green-500/10">
                <div className="max-w-4xl mx-auto">
                    <div className="relative p-8 md:p-12 rounded-3xl bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-500/20 overflow-hidden">
                        <div className="absolute top-[-50%] right-[-20%] w-[400px] h-[400px] bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative z-10 text-center">
                            <h3 className="text-2xl md:text-4xl font-bold text-white">
                                Ready to{' '}
                                <span className="bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent">
                                    hook
                                </span>{' '}
                                your leads?
                            </h3>
                            <p className="mt-3 text-gray-400 max-w-lg mx-auto">
                                Join us building the future at jellyhook insights.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Show when="signed-out">
                                    <SignUpButton mode="modal">
                                        <button className="group relative px-8 py-4 text-base font-bold text-black bg-gradient-to-r from-green-400 to-green-500 rounded-2xl shadow-[0_0_40px_rgba(57,255,20,0.3)] hover:shadow-[0_0_60px_rgba(57,255,20,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden w-full sm:w-auto">
                                            <span className="relative z-10 flex items-center gap-3">
                                                Get Started Free
                                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                                            </span>
                                            <span className="absolute inset-0 bg-gradient-to-r from-green-300 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </button>
                                    </SignUpButton>
                                    <SignInButton mode="modal">
                                        <button className="px-8 py-4 text-base font-medium text-white border border-gray-700 rounded-2xl hover:border-green-500/50 hover:bg-white/5 transition-all duration-300 w-full sm:w-auto">
                                            Sign In
                                        </button>
                                    </SignInButton>
                                </Show>

                                <Show when="signed-in">
                                    <Link href="/dashboard">
                                        <button className="group relative px-8 py-4 text-base font-bold text-black bg-gradient-to-r from-green-400 to-green-500 rounded-2xl shadow-[0_0_40px_rgba(57,255,20,0.3)] hover:shadow-[0_0_60px_rgba(57,255,20,0.5)] transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden w-full sm:w-auto">
                                            <span className="relative z-10 flex items-center gap-3">
                                                Go to Dashboard
                                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                                            </span>
                                            <span className="absolute inset-0 bg-gradient-to-r from-green-300 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </button>
                                    </Link>
                                </Show>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="border-t border-green-500/10 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-green-400 to-green-600 shadow-[0_0_20px_rgba(57,255,20,0.2)]" />
                        <span className="font-medium text-gray-400">Jellyhook</span>
                        <span className="text-gray-600">© 2026</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link href="#" className="hover:text-green-400 transition-colors">Privacy</Link>
                        <Link href="#" className="hover:text-green-400 transition-colors">Terms</Link>
                        <Link href="#" className="hover:text-green-400 transition-colors">Docs</Link>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-green-400/70">All systems go</span>
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default LandingPage