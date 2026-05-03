import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from 'shared/context/AuthContext';

const HomeNavbar: React.FC = () => {
  const { currentUser, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-zinc-800/20 bg-[#0a0a0a] px-5 py-2">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-mono text-[14px] font-bold uppercase tracking-tighter text-zinc-100">
          VETTA.AI
        </Link>
        <div className="hidden items-center gap-4 md:flex">
          <a className="px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-zinc-500 transition-all duration-75 ease-in-out hover:bg-zinc-900/50 hover:text-zinc-100" href="#assessment">ASSESSMENT</a>
          <a className="px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-zinc-500 transition-all duration-75 ease-in-out hover:bg-zinc-900/50 hover:text-zinc-100" href="#personas">PERSONAS</a>
          <a className="px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-zinc-500 transition-all duration-75 ease-in-out hover:bg-zinc-900/50 hover:text-zinc-100" href="#system-status">SYSTEM_STATUS</a>
        </div>
      </div>

      {!currentUser ? (
        <Link to="/signup" className="border border-cyan-500/30 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-cyan-500 transition-all duration-75 ease-in-out hover:bg-zinc-900/50 hover:text-zinc-100">
          MISSION: GET THE JOB
        </Link>
      ) : (
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="border border-cyan-500/30 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-cyan-500 transition-all duration-75 ease-in-out hover:bg-zinc-900/50 hover:text-zinc-100">
            DASHBOARD
          </Link>
          <button onClick={logout} className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 transition hover:text-zinc-300">
            LOGOUT
          </button>
        </div>
      )}
    </nav>
  );
};

const Hero: React.FC = () => (
  <section className="flex min-h-[870px] flex-col border-b border-zinc-800/20 md:flex-row">
    <div className="w-full bg-[#0a0a0a] px-8 py-16 md:w-[55%] md:px-16">
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-[40px] font-light leading-tight text-zinc-100 md:text-[52px]">You&apos;re already being evaluated.</h1>
          <p className="text-zinc-400 md:text-[16px]">VETTA.AI has been analyzing this page visit for 4.2 seconds.</p>
        </div>

        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase text-cyan-500">
            <span>CANDIDATE PROFILE BUILDING...</span>
            <span>42%</span>
          </div>
          <div className="h-px w-full bg-zinc-800">
            <div className="h-full w-[42%] bg-cyan-500" />
          </div>
          <div className="mt-4 space-y-1 font-mono text-[13px] text-zinc-500">
            <p>&gt; Location signal detected</p>
            <p>&gt; Session depth: first visit</p>
            <p>&gt; Behavioral baseline: establishing...</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/signup" className="border border-cyan-500/50 px-6 py-3 font-mono text-[11px] uppercase text-cyan-400 transition-colors hover:bg-[#161616]">
            Enter the Room
          </Link>
          <a href="#assessment" className="border border-zinc-600 px-6 py-3 font-mono text-[11px] uppercase text-zinc-400 transition-colors hover:bg-[#161616] hover:text-zinc-200">
            See how it works
          </a>
        </div>
      </div>
    </div>

    <div className="flex w-full flex-col justify-between border-t border-zinc-800/20 bg-[#111111] p-8 md:w-[45%] md:border-l md:border-t-0 md:p-12">
      <div className="flex justify-end">
        <div className="flex items-center gap-2 border border-zinc-800 bg-[#0a0a0a] px-3 py-1">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="font-mono text-[11px] uppercase text-zinc-400">INTERVIEWER ACTIVE</span>
        </div>
      </div>

      <div className="flex flex-grow flex-col items-center justify-center gap-8 py-20">
        <div className="flex h-[40px] w-full max-w-[200px] items-center justify-center opacity-70">
          <svg width="100%" height="100%" viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 20 Q 25 0, 50 20 T 100 20 T 150 20 T 200 20" fill="none" stroke="#06b6d4" strokeWidth="1" />
          </svg>
        </div>
        <p className="max-w-sm text-center font-mono text-[13px] text-zinc-300">
          &quot;I&apos;ve reviewed 847 engineering interviews this month. I&apos;m not here to be kind. I&apos;m here to make sure you&apos;re ready.&quot;
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <span className="border border-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-500">[ P50 LATENCY: 180MS ]</span>
        <span className="border border-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-500">[ STT: DEEPGRAM NOVA-2 ]</span>
        <span className="border border-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-500">[ VOICE: ACTIVE ]</span>
      </div>
    </div>
  </section>
);

const Differentiators: React.FC = () => (
  <section id="assessment" className="flex w-full flex-col gap-16 border-b border-zinc-800/20 bg-[#0a0a0a] px-8 py-24 md:px-16">
    <h2 className="text-[32px] font-light text-zinc-100 md:text-[40px]">Not a quiz. A conversation.</h2>
    <div id="personas" className="grid grid-cols-1 gap-8 md:grid-cols-3">
      <div className="flex flex-col gap-4 border-t border-cyan-500/50 pt-6">
        <h3 className="text-[18px] text-white">The AI interrupts you</h3>
        <p className="flex-grow text-[14px] text-zinc-400">It detects rambling, challenges weak technical assumptions in real-time, and forces you to justify architectural decisions just like a Senior Engineer would.</p>
        <span className="mt-4 font-mono text-[11px] uppercase text-cyan-500">Avg Interruptions/Session: 4.2</span>
      </div>
      <div className="flex flex-col gap-4 border-t border-cyan-500/50 pt-6">
        <h3 className="text-[18px] text-white">It remembers everything</h3>
        <p className="flex-grow text-[14px] text-zinc-400">Context from minute 2 is brought back in minute 45. If you contradict a previous design choice, the system flags it and asks for reconciliation.</p>
        <span className="mt-4 font-mono text-[11px] uppercase text-cyan-500">Context Window: 128K Tokens</span>
      </div>
      <div className="flex flex-col gap-4 border-t border-cyan-500/50 pt-6">
        <h3 className="text-[18px] text-white">It changes the rules</h3>
        <p className="flex-grow text-[14px] text-zinc-400">Midway through a system design, the constraints will shift. &quot;Now assume the primary DB goes down. How does your cache strategy hold up?&quot;</p>
        <span className="mt-4 font-mono text-[11px] uppercase text-cyan-500">Dynamic Constraint Injection: ON</span>
      </div>
    </div>
  </section>
);

const HiringSignal: React.FC = () => (
  <section id="system-status" className="flex w-full flex-col items-center gap-12 border-b border-zinc-800/20 bg-[#0a0a0a] px-8 py-24 md:px-16">
    <h2 className="max-w-2xl text-center text-[32px] font-light text-zinc-100 md:text-[40px]">Strong Hire. Lean Hire. No Hire.</h2>
    <div className="flex w-full max-w-3xl flex-col border border-white/10 bg-[#111111]">
      <div className="flex items-center justify-between border-b border-zinc-800/50 px-6 py-4">
        <span className="font-mono text-[11px] uppercase text-zinc-400">CANDIDATE SIGNAL ANALYSIS</span>
        <span className="font-mono text-[11px] text-zinc-500">SESSION #2841</span>
      </div>
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex items-center justify-between border-b border-zinc-800/30 pb-4">
          <span className="font-mono text-[13px] text-zinc-300">Distributed Systems Reasoning</span>
          <span className="border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-mono text-[11px] uppercase text-cyan-400">Strong Hire</span>
        </div>
        <div className="flex items-center justify-between border-b border-zinc-800/30 pb-4">
          <span className="font-mono text-[13px] text-zinc-300">Behavioral Narrative Structure</span>
          <span className="border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[11px] uppercase text-amber-500">Lean Hire</span>
        </div>
        <div className="mt-4 border border-zinc-800/50 bg-[#0a0a0a] p-4">
          <span className="mb-2 block border-b border-zinc-800/30 pb-2 font-mono text-[11px] uppercase text-zinc-500">Areas Requiring Calibration</span>
          <ul className="mt-2 list-none space-y-2 font-mono text-[13px] text-zinc-400">
            <li className="flex items-start gap-2"><span className="text-zinc-600">-</span>Over-indexed on specific AWS services rather than generic architectural patterns.</li>
            <li className="flex items-start gap-2"><span className="text-zinc-600">-</span>STAR method implementation degraded during high-pressure follow-up questions.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
);

const Footer: React.FC = () => (
  <footer className="flex w-full flex-col items-center justify-between gap-4 border-t border-zinc-800/20 bg-[#0a0a0a] px-5 py-8 md:flex-row">
    <span className="font-mono text-[10px] uppercase tracking-tight text-zinc-100">© 2025 VETTA.AI — MISSION: GET THE JOB.</span>
    <div className="flex gap-4">
      <a className="font-mono text-[10px] uppercase tracking-tight text-zinc-600 transition-opacity duration-200 hover:text-zinc-400" href="/docs">DOCUMENTATION</a>
      <a className="font-mono text-[10px] uppercase tracking-tight text-zinc-600 transition-opacity duration-200 hover:text-zinc-400" href="/privacy">PRIVACY</a>
      <a className="font-mono text-[10px] uppercase tracking-tight text-zinc-600 transition-opacity duration-200 hover:text-zinc-400" href="/terminal">TERMINAL_ACCESS</a>
    </div>
  </footer>
);

const Home: React.FC = () => (
  <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
    <HomeNavbar />
    <main className="flex w-full flex-col">
      <Hero />
      <Differentiators />
      <HiringSignal />
    </main>
    <Footer />
  </div>
);

export default Home;
