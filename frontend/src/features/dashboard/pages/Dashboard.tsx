import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { QuickMode, ReplayItem } from '../types';

// Types
type DashboardProps = {};

const QUICK_MODES: QuickMode[] = [
  { id: 'role-targeted', label: '[ROLE-TARGETED]' },
  { id: 'pressure-mode', label: '[PRESSURE_MODE]' },
  { id: 'resume-deep-dive', label: '[RESUME_DEEP-DIVE]' },
  { id: 'blind-mode', label: '[BLIND_MODE]' },
  { id: 'pair-programming', label: '[PAIR_PROGRAMMING]' },
];

const REPLAYS: ReplayItem[] = [
  {
    session: 'Resume Deep-Dive • Infrastructure',
    signal: 'LEAN HIRE',
    decisiveFactor: 'Strong explanation of matching engine scaling limits under load.',
  },
  {
    session: 'Blind Mode • Algorithmic Logic',
    signal: 'FLAGGED',
    decisiveFactor: 'Failed to identify edge cases in concurrent data structure modification.',
  },
  {
    session: 'Pair Programming • React/State',
    signal: 'NEUTRAL',
    decisiveFactor: 'Acceptable implementation, but required excessive guidance on dependency arrays.',
  },
];

const Dashboard: React.FC<DashboardProps> = (): React.ReactElement => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 pb-8 pt-16 text-[#e2e1eb] md:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
        <section>
          <div className="mb-4 flex items-center justify-between border-b border-zinc-800/50 pb-2">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              System // Quick_Launch_Command
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-5">
            {QUICK_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  if (mode.id === 'role-targeted') navigate('/modes/role-targeted');
                }}
                disabled={mode.id !== 'role-targeted'}
                className={`flex items-center justify-between border bg-[#0c0e14] px-4 py-3 text-left font-mono text-[11px] text-[#e2e1eb] transition-all ${
                  mode.id === 'role-targeted'
                    ? 'border-zinc-700 hover:border-cyan-500/50 hover:bg-[#161616]'
                    : 'border-zinc-800/70 opacity-70 cursor-not-allowed'
                }`}
              >
                {mode.label}
                <span className="text-zinc-600">{mode.id === 'role-targeted' ? '->' : 'Coming Soon'}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative col-span-2 flex flex-col gap-6 border border-zinc-700 bg-[#0c0e14] p-5 pt-12">
            <div className="absolute left-0 top-0 flex w-full items-center justify-between border-b border-zinc-800/50 px-5 py-2">
              <span className="font-mono text-[11px] text-zinc-500">SYS.MONITOR // COGNITIVE_ENGINE_PULSE</span>
              <div className="h-2 w-2 rounded-full border border-cyan-400" />
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] text-zinc-400">HIRING SIGNAL VELOCITY</span>
              <div className="relative flex h-16 items-end overflow-hidden border border-zinc-800/50 bg-[#0a0a0a] p-1">
                <svg className="h-full w-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <polyline points="0,15 10,18 20,12 30,14 40,5 50,8 60,2 70,10 80,4 90,6 100,1" fill="none" stroke="#4cd7f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#44474820_1px,transparent_1px),linear-gradient(to_bottom,#44474820_1px,transparent_1px)] bg-[size:4px_4px]" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] text-red-300">IDENTIFIED VULNERABILITIES</span>
              <div className="flex flex-col gap-2 border border-zinc-800/50 bg-[#0a0a0a] p-3">
                <div className="flex items-start gap-2 font-mono text-[12px] text-cyan-300">
                  <span className="text-red-300">&gt;</span>
                  System Design: Hesitant on fallback strategies during partition failure scenario.
                </div>
                <div className="flex items-start gap-2 font-mono text-[12px] text-cyan-300">
                  <span className="text-red-300">&gt;</span>
                  Algorithm: Sub-optimal space complexity in graph traversal (O(V^2) vs O(V+E)).
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-2">
              <span className="font-mono text-[11px] text-zinc-400">COMMUNICATION TELEMETRY</span>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                <div className="border border-zinc-800/50 bg-[#0a0a0a] p-3">
                  <div className="mb-1 font-mono text-[10px] text-zinc-500">Avg. Hedge Count</div>
                  <div className="font-mono text-[13px] text-[#e2e1eb]">1.2 / min</div>
                </div>
                <div className="border border-zinc-800/50 bg-[#0a0a0a] p-3">
                  <div className="mb-1 font-mono text-[10px] text-zinc-500">Longest Silence</div>
                  <div className="font-mono text-[13px] text-[#e2e1eb]">4.0s</div>
                </div>
                <div className="border border-zinc-800/50 bg-[#0a0a0a] p-3">
                  <div className="mb-1 font-mono text-[10px] text-zinc-500">Interruption Rate</div>
                  <div className="font-mono text-[13px] text-[#e2e1eb]">8%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex flex-col gap-4 border border-zinc-700 bg-[#0c0e14] p-5 pt-12">
            <div className="absolute left-0 top-0 w-full border-b border-zinc-800/50 px-5 py-2">
              <span className="font-mono text-[11px] text-zinc-500">DATA.SRC // ACTIVE_CONTEXT</span>
            </div>

            <div className="mt-8 flex flex-1 flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] text-zinc-400">TARGET FILE</span>
                <div className="break-words border-b border-zinc-800/60 pb-2 font-mono text-[13px] text-[#e2e1eb]">
                  Nikhil_Goyal_Backend_2026.pdf
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] text-zinc-400">PARSED VECTORS</span>
                <div className="flex flex-wrap gap-2">
                  <span className="border border-zinc-700 px-2 py-1 font-mono text-[11px] text-zinc-300">[Go / Distributed Systems]</span>
                  <span className="border border-zinc-700 px-2 py-1 font-mono text-[11px] text-zinc-300">[C++]</span>
                  <span className="border border-zinc-700 px-2 py-1 font-mono text-[11px] text-zinc-300">[Backend Architecture]</span>
                  <span className="border border-zinc-700 px-2 py-1 font-mono text-[11px] text-zinc-300">[Kubernetes]</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="mt-auto border border-cyan-500/50 p-2 text-center font-mono text-[11px] text-cyan-300 transition-colors hover:bg-[#161616]"
            >
              [ UPDATE_CONTEXT ]
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Log // RECENT_SIGNALS_&_REPLAYS
            </h2>
          </div>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="mb-2 grid grid-cols-12 gap-4 border-b border-zinc-700 pb-2 px-2 font-mono text-[11px] text-zinc-500">
                <div className="col-span-3">SESSION</div>
                <div className="col-span-2">SIGNAL</div>
                <div className="col-span-6">THE DECISIVE FACTOR</div>
                <div className="col-span-1 text-right">ACTION</div>
              </div>

              {REPLAYS.map((row) => (
                <div key={row.session} className="grid grid-cols-12 items-center gap-4 border-b border-zinc-800/40 px-2 py-3 transition-colors hover:bg-[#161616]">
                  <div className="col-span-3 truncate font-mono text-[12px] text-[#e2e1eb]">{row.session}</div>
                  <div className="col-span-2">
                    <span
                      className={`px-2 py-0.5 font-mono text-[10px] border ${
                        row.signal === 'LEAN HIRE'
                          ? 'border-cyan-400 text-cyan-300'
                          : row.signal === 'FLAGGED'
                          ? 'border-red-300 text-red-200'
                          : 'border-zinc-600 text-zinc-400'
                      }`}
                    >
                      {row.signal}
                    </span>
                  </div>
                  <div className="col-span-6 truncate text-[13px] text-zinc-400">{row.decisiveFactor}</div>
                  <div className="col-span-1 text-right font-mono text-[12px] text-zinc-500">PLAY</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
