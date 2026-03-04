'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRightIcon,
  ShieldCheckIcon,
  BoltIcon,
  LockClosedIcon,
  SparklesIcon,
  CubeTransparentIcon,
  UserIcon,
  CheckIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';

const UserAvatar = ({ name, color, delay }: { name: string, color: string, delay: string }) => (
  <div className={`flex flex-col items-center gap-2 animate-float`} style={{ animationDelay: delay }}>
    <div className={`w-16 h-16 rounded-full ${color} flex items-center justify-center shadow-lg border-2 border-white/10`}>
      <UserIcon className="w-8 h-8 opacity-80" />
    </div>
    <div className="bg-white/5 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-gray-300 border border-white/5">
      {name}
    </div>
  </div>
);

export default function Home() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden selection:bg-violet-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-900/20">
              <CubeTransparentIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Umbra<span className="text-violet-400">Mix</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Sign In
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-black to-black pointer-events-none" />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className={`space-y-8 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="text-violet-400 font-medium tracking-wide uppercase text-sm">
              Privacy for the modern web
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              Financial Privacy <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                Reimagined.
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-lg leading-relaxed">
              UmbraMix breaks the link between your crypto deposits and withdrawals using Zero-Knowledge proofs and Lightning Network routing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                Launch Dashboard
                <ChevronRightIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => router.push('/docs')}
                className="px-8 py-4 bg-white/5 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-all border border-white/10"
              >
                Documentation
              </button>
            </div>
            <div className="flex items-center gap-8 text-sm font-medium text-gray-500 pt-4 border-t border-white/5 w-fit">
              <span>Non-custodial</span>
              <span className="w-1 h-1 rounded-full bg-gray-700" />
              <span>Lightning Fast</span>
              <span className="w-1 h-1 rounded-full bg-gray-700" />
              <span>Zero-Knowledge</span>
            </div>
          </div>

          {/* Hero Visual - "The Story" */}
          <div className={`relative h-[500px] bg-gradient-to-br from-violet-500/5 to-transparent rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            {/* Background Grid */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-4 opacity-10">
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} className="border border-white/20 rounded-lg" />
              ))}
            </div>

            {/* Interactive Elements */}
            <div className="relative z-20 w-full h-full flex items-center justify-between px-4">
              <UserAvatar name="Alice" color="bg-pink-500/20 text-pink-400" delay="0s" />

              <div className="flex-1 mx-4 relative h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-500 opacity-50 animate-pulse" />
                <div className="absolute top-0 left-0 h-full w-1/3 bg-white blur-sm animate-slide-right" />
              </div>

              <div className="relative">
                <div className="w-24 h-24 bg-black border border-violet-500/50 rounded-2xl flex flex-col items-center justify-center shadow-2xl shadow-violet-500/20 z-10 relative overflow-hidden">
                  <div className="absolute inset-0 bg-violet-500/10 animate-pulse" />
                  <CubeTransparentIcon className="w-10 h-10 text-violet-400 mb-2 relative z-10" />
                  <span className="text-xs font-bold font-mono text-violet-200 relative z-10">MIXER</span>
                </div>
                <div className="absolute -inset-4 bg-violet-600/20 blur-xl rounded-full animate-pulse-slow" />
              </div>

              <div className="flex-1 mx-4 relative h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 opacity-50 animate-pulse delay-75" />
                <div className="absolute top-0 left-0 h-full w-1/3 bg-white blur-sm animate-slide-right" style={{ animationDelay: '1s' }} />
              </div>

              <UserAvatar name="Bob" color="bg-cyan-500/20 text-cyan-400" delay="1s" />
            </div>

            <div className="absolute bottom-8 text-center">
              <p className="text-sm font-mono text-violet-300 bg-violet-900/30 px-4 py-2 rounded-lg border border-violet-500/20">
                100% On-Chain Privacy Preserved
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works / Story */}
      <section id="how-it-works" className="py-24 bg-zinc-900/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How it Works</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              We use advanced cryptography to break the link between your deposit and withdrawal.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "1. Deposit",
                desc: "Alice deposits STRK into the UmbraMix smart contract. She receives a secret note.",
                color: "from-pink-500/20 to-pink-900/5",
                illustration: (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <div className="w-24 h-16 bg-pink-500/20 rounded-lg transform -rotate-6 border border-pink-500/30"></div>
                    <div className="w-24 h-16 bg-pink-500/40 rounded-lg absolute transform rotate-3 border border-pink-500/50 backdrop-blur-sm"></div>
                    <div className="w-8 h-1 bg-pink-200/50 rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                  </div>
                )
              },
              {
                title: "2. Mix",
                desc: "The funds are routed through the Lightning Network using Cashu ecash tokens, breaking the history.",
                color: "from-violet-500/20 to-violet-900/5",
                illustration: (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <div className="w-32 h-32 rounded-full border border-violet-500/20 animate-spin-slow absolute"></div>
                    <div className="w-24 h-24 rounded-full border border-violet-500/40 animate-reverse-spin absolute"></div>
                    <div className="w-4 h-4 bg-violet-400 rounded-sm rotate-45 animate-pulse"></div>
                  </div>
                )
              },
              {
                title: "3. Withdraw",
                desc: "Bob (or Alice's new wallet) withdraws clean STRK using the secret note. No link exists.",
                color: "from-cyan-500/20 to-cyan-900/5",
                illustration: (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <div className="w-20 h-20 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 transform rotate-12"></div>
                    <div className="w-20 h-20 bg-cyan-900/20 rounded-2xl border border-cyan-500/10 transform -rotate-6 absolute backdrop-blur-sm flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-cyan-400/50"></div>
                    </div>
                  </div>
                )
              }
            ].map((step, i) => (
              <div key={i} className="bg-black/40 border border-white/5 rounded-3xl p-6 hover:bg-white/5 transition-colors group overflow-hidden relative">
                <div className={`aspect-square w-full rounded-2xl bg-gradient-to-br ${step.color} border border-white/5 mb-6 relative overflow-hidden flex items-center justify-center group-hover:border-white/10 transition-colors`}>
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('/patterns/grid.svg')" }} />
                  {step.illustration}
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Enterprise-Grade Privacy</h2>
              <div className="space-y-6">
                {[
                  { title: "Zero-Knowledge Proofs", desc: "Cryptographic guarantees that your data remains private." },
                  { title: "Compliance Ready", desc: "Optional view keys for auditing and compliance requirements." },
                  { title: "Non-Custodial", desc: "You maintain control of your funds throughout the entire process." },
                  { title: "Cross-Chain Capable", desc: "Built on Starknet, powered by Bitcoin Lightning Network." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <div className="w-2 h-2 rounded-full bg-violet-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                      <p className="text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-violet-600/20 blur-[100px] rounded-full" />
              <div className="relative bg-black border border-white/10 rounded-2xl p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="font-mono text-sm text-gray-400">Transaction Status</div>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                    <div className="w-3 h-3 rounded-full bg-green-500/20" />
                  </div>
                </div>
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between items-center text-emerald-400">
                    <span className="flex items-center gap-2"><CheckIcon className="w-4 h-4" /> Deposit Confirmed</span>
                    <span>0.05s</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-400">
                    <span className="flex items-center gap-2"><CheckIcon className="w-4 h-4" /> ZK-Proof Generated</span>
                    <span>1.20s</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-400">
                    <span className="flex items-center gap-2"><CheckIcon className="w-4 h-4" /> Cashu Minting</span>
                    <span>0.80s</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-400">
                    <span className="flex items-center gap-2"><CheckIcon className="w-4 h-4" /> Lightning Route</span>
                    <span>0.45s</span>
                  </div>
                  <div className="mt-8 p-4 bg-white/5 rounded-lg text-center text-gray-400">
                    Privacy Score: <span className="text-violet-400 font-bold">100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto bg-gradient-to-b from-violet-900/20 to-black border border-white/10 rounded-3xl p-12 md:p-20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-50" />
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to reclaim your privacy?</h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust UmbraMix for their financial privacy needs.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-10 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-xl shadow-white/10 hover:shadow-white/20"
          >
            Get Started Now
          </button>
          <p className="mt-6 text-sm text-gray-500">No registration required. Open source.</p>
        </div>
      </section>
    </div>
  );
}
