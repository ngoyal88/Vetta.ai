import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ADVANCED_INTERVIEW_TYPES } from 'core/constants/modes';

const MODE_ROUTE_MAP: Record<string, string> = {
  role_targeted: '/modes/role-targeted',
  pressure: '/modes/pressure-mode',
  resume_deep_dive: '/modes/resume-deep-dive',
  blind: '/modes/blind-mode',
  pair_programming: '/modes/pair-programming',
};

const AVAILABLE_MODES = new Set(['role_targeted']);

const ModesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 pb-8 pt-16 text-[#e2e1eb] md:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
        <section>
          <div className="mb-4 flex items-center justify-between border-b border-zinc-800/50 pb-2">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              System // Modes_Launch
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-5">
            {ADVANCED_INTERVIEW_TYPES.map((mode) => {
              const isAvailable = AVAILABLE_MODES.has(mode.value);
              return (
              <button
                key={mode.value}
                type="button"
                onClick={() => isAvailable && navigate(MODE_ROUTE_MAP[mode.value])}
                disabled={!isAvailable}
                className={`flex items-center justify-between border bg-[#0c0e14] px-4 py-3 text-left font-mono text-[11px] text-[#e2e1eb] transition-all ${
                  isAvailable
                    ? 'border-zinc-700 hover:border-cyan-500/50 hover:bg-[#161616]'
                    : 'border-zinc-800/70 opacity-70 cursor-not-allowed'
                }`}
              >
                <span>{mode.label}</span>
                <span className="text-zinc-600">{isAvailable ? '->' : 'Coming Soon'}</span>
              </button>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative col-span-2 flex flex-col gap-6 border border-zinc-700 bg-[#0c0e14] p-5 pt-12">
            <div className="absolute left-0 top-0 flex w-full items-center justify-between border-b border-zinc-800/50 px-5 py-2">
              <span className="font-mono text-[11px] text-zinc-500">MODE.CONTEXT // ACTIVE_SET</span>
              <div className="h-2 w-2 rounded-full border border-cyan-400" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[11px] text-zinc-400">AVAILABLE MODES</span>
              <div className="flex flex-col gap-2 border border-zinc-800/50 bg-[#0a0a0a] p-3">
                {ADVANCED_INTERVIEW_TYPES.map((mode) => {
                  const isAvailable = AVAILABLE_MODES.has(mode.value);
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => isAvailable && navigate(MODE_ROUTE_MAP[mode.value])}
                      disabled={!isAvailable}
                      className={`flex items-start gap-2 font-mono text-[12px] text-left transition-colors ${
                        isAvailable ? 'text-cyan-300 hover:text-cyan-200' : 'text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-red-300">&gt;</span>
                      <span>
                        {mode.icon} {mode.label}: {mode.desc} {!isAvailable ? '(Coming Soon)' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative flex flex-col gap-4 border border-zinc-700 bg-[#0c0e14] p-5 pt-12">
            <div className="absolute left-0 top-0 w-full border-b border-zinc-800/50 px-5 py-2">
              <span className="font-mono text-[11px] text-zinc-500">NAV // QUICK ACCESS</span>
            </div>
            <div className="mt-8 flex flex-1 flex-col gap-3">
              {ADVANCED_INTERVIEW_TYPES.map((mode) => {
                const isAvailable = AVAILABLE_MODES.has(mode.value);
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => isAvailable && navigate(MODE_ROUTE_MAP[mode.value])}
                    disabled={!isAvailable}
                    className={`border px-3 py-2 text-left font-mono text-[11px] transition-colors ${
                      isAvailable
                        ? 'border-zinc-700 text-zinc-300 hover:bg-[#161616]'
                        : 'border-zinc-800/70 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {mode.label} {!isAvailable ? '• Coming Soon' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ModesPage;
