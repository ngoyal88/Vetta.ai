import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QuickMode } from '../types';

type DashboardProps = Record<string, never>;

const QUICK_MODES: QuickMode[] = [
  { id: 'role-targeted', label: '[ROLE-TARGETED]' },
  { id: 'pressure-mode', label: '[PRESSURE_MODE]' },
  { id: 'resume-deep-dive', label: '[RESUME_DEEP-DIVE]' },
  { id: 'blind-mode', label: '[BLIND_MODE]' },
  { id: 'pair-programming', label: '[PAIR_PROGRAMMING]' },
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

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to="/history"
            className="group flex flex-col gap-2 border border-zinc-700 bg-[#0c0e14] p-5 transition-colors hover:border-cyan-500/40 hover:bg-[#161616]"
          >
            <span className="font-mono text-[11px] text-zinc-500">SESSION LOG</span>
            <span className="text-lg font-medium text-[#e2e1eb]">View history</span>
            <span className="text-sm text-zinc-400">
              Past sessions, feedback, and full transcripts.
            </span>
          </Link>
          <Link
            to="/analytics"
            className="group flex flex-col gap-2 border border-zinc-700 bg-[#0c0e14] p-5 transition-colors hover:border-cyan-500/40 hover:bg-[#161616]"
          >
            <span className="font-mono text-[11px] text-zinc-500">PROGRESS</span>
            <span className="text-lg font-medium text-[#e2e1eb]">View analytics</span>
            <span className="text-sm text-zinc-400">
              Scores, trends, and practice breakdowns over time.
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
