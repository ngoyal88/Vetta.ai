import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Mic, Code, Brain, Zap, ArrowRight, Shield, Award, Menu, X,
} from 'lucide-react';

const TERMINAL_OPTIONS = ['DSA', 'Behavioral', 'System Design', 'Custom Role'];
const CYCLE_MS = 2200;

const HomeNavbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { currentUser, logout } = useAuth();
  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
  };

  const navClass = scrolled
    ? 'bg-base/90 backdrop-blur-xl border-b border-[var(--border-subtle)]'
    : 'bg-transparent border-b border-transparent';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 h-12 transition-all duration-300 ${navClass}`}>
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center text-white hover:text-cyan-400 transition-colors duration-150">
          <img src="/vettalogo-removebg-preview.png" alt="Vetta.ai" className="h-8 w-auto" />
        </Link>

        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-8">
          <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors duration-150">Features</a>
          <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors duration-150">How it works</a>
          <a href="#testimonials" className="text-sm text-zinc-400 hover:text-white transition-colors duration-150">Testimonials</a>
        </div>

        <div className="hidden md:flex items-center gap-4">
          {!currentUser ? (
            <>
              <Link to="/signin" className="text-sm text-zinc-400 hover:text-white transition-colors duration-150">
                Sign In
              </Link>
              <Link to="/signup">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-cyan flex items-center gap-2 text-sm h-10"
                >
                  Get Started
                  <ArrowRight size={16} />
                </motion.button>
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3 text-zinc-300">
              <span className="text-sm text-zinc-500">Hi, {displayName}</span>
              <Link to="/dashboard" className="text-sm hover:text-white transition-colors duration-150">Dashboard</Link>
              <button onClick={handleLogout} className="text-sm hover:text-red-400 transition-colors duration-150">Logout</button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-white p-2"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden border-t border-[var(--border-subtle)] bg-base/95 backdrop-blur-xl px-6 py-4 space-y-3"
        >
          <a href="#features" className="block text-sm text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" className="block text-sm text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>How it works</a>
          <a href="#testimonials" className="block text-sm text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Testimonials</a>
          {!currentUser ? (
            <>
              <Link to="/signin" className="block text-sm text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                <button className="w-full btn-cyan h-10 text-sm">Get Started</button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="block text-sm text-zinc-400 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
              <button onClick={handleLogout} className="w-full text-left text-sm text-zinc-400 hover:text-red-400">Logout</button>
            </>
          )}
        </motion.div>
      )}
    </nav>
  );
};

const TerminalCycle = () => {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % TERMINAL_OPTIONS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const text = TERMINAL_OPTIONS.map((opt, i) => (i === index ? opt : null)).filter(Boolean)[0] || TERMINAL_OPTIONS[0];
  const fullLine = TERMINAL_OPTIONS.join(' → ');
  const display = reducedMotion ? fullLine : `${text} → ...`;

  return (
    <p className="font-mono text-lg md:text-xl text-zinc-500 mt-6">
      {display}
      <span className="terminal-cursor ml-0.5 inline-block w-2 h-5 bg-cyan-500 align-middle" aria-hidden />
    </p>
  );
};

const Hero = () => {
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0.01 : 0.3;
  const stagger = reducedMotion ? 0 : 0.06;

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-base pt-12 hero-dot-pattern">
      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, ease: 'easeOut' }}
          className="space-y-2"
        >
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration, delay: stagger, ease: 'easeOut' }}
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-normal text-white tracking-tight leading-[1.05]"
          >
            Interview like you've
          </motion.h1>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration, delay: stagger * 2, ease: 'easeOut' }}
            className="font-mono text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white tracking-tight"
          >
            already got the job.
          </motion.h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration, delay: stagger * 3 }}
        >
          <TerminalCycle />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, delay: stagger * 4 }}
          className="mt-10"
        >
          <Link to="/signup">
            <motion.button
              whileHover={{ scale: reducedMotion ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-cyan flex items-center gap-2 mx-auto text-base"
            >
              Start Practicing
              <ArrowRight size={18} />
            </motion.button>
          </Link>
        </motion.div>
      </div>

      {/* Proof cards below fold */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="relative w-full max-w-6xl mx-auto px-6 mt-24 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            whileHover={{ y: -4 }}
            className="relative rounded-2xl overflow-hidden bg-raised/80 backdrop-blur-xl border border-[var(--border-subtle)] p-4 shadow-xl"
            style={{
              transform: `rotate(${i === 0 ? -2 : i === 1 ? 0 : 2}deg)`,
            }}
          >
            <div className="aspect-video rounded-lg bg-overlay border border-[var(--border-subtle)] flex items-center justify-center text-zinc-600 text-sm">
              Session preview {i + 1}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};

const MARQUEE_ITEMS = ['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix'];

const SocialProof = () => (
  <section className="py-8 border-y border-[var(--border-subtle)] bg-base overflow-hidden">
    <p className="text-center text-zinc-500 text-sm mb-6">Our users land offers at</p>
    <div className="flex items-center animate-marquee whitespace-nowrap w-max">
      {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((name, i) => (
        <span key={i} className="mx-8 md:mx-12 text-zinc-600 font-medium text-lg">
          {name}
        </span>
      ))}
    </div>
  </section>
);

const WaveformBars = () => (
  <div className="flex items-end justify-center gap-1 h-16" aria-hidden>
    {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8].map((h, i) => (
      <motion.span
        key={i}
        className="w-1.5 rounded-full bg-cyan-500"
        animate={{ height: [`${h * 40}%`, `${(1 - h * 0.3) * 40}%`, `${h * 40}%`] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
        style={{ height: `${h * 40}%` }}
      />
    ))}
  </div>
);

const Features = () => {
  const reducedMotion = useReducedMotion();

  return (
    <section id="features" className="py-24 bg-base">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl md:text-5xl text-white mb-4">
            Everything you need to excel
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Tools built for technical interview prep
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 grid-rows-[auto_auto_auto]">
          {/* Large: Real-Time Voice AI + waveform */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ boxShadow: '0 20px 40px -15px rgba(0,0,0,0.4), 0 0 0 1px rgba(6,182,212,0.15)' }}
            className="md:col-span-2 md:row-span-2 p-8 rounded-2xl bg-raised border border-[var(--border-subtle)] transition-shadow duration-150"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-overlay border border-[var(--border-subtle)] flex items-center justify-center text-cyan-500">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-white">Real-Time Voice AI</h3>
            </div>
            <WaveformBars />
            <p className="mt-6 text-zinc-500 text-sm leading-relaxed">
              Natural voice conversations with our AI interviewer. Speak and get instant feedback.
            </p>
          </motion.div>

          {/* Medium: Live Code Editor */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            whileHover={{ boxShadow: '0 20px 40px -15px rgba(0,0,0,0.4), 0 0 0 1px rgba(6,182,212,0.15)' }}
            className="md:col-span-2 p-6 rounded-2xl bg-raised border border-[var(--border-subtle)] transition-shadow duration-150"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-overlay border border-[var(--border-subtle)] flex items-center justify-center text-cyan-500">
                <Code className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-white">Live Code Editor</h3>
            </div>
            <pre className="text-xs font-mono text-zinc-400 bg-overlay rounded-lg p-3 overflow-x-auto border border-[var(--border-subtle)]">
              <span className="text-cyan-500">def</span> two_sum(nums, target):{'\n'}
              {'    '}seen = {'{}'}{'\n'}
              {'    '}<span className="text-cyan-500">for</span> i, n <span className="text-cyan-500">in</span> enumerate(nums):{'\n'}
              {'        '}diff = target - n{'\n'}
              {'        '}<span className="text-cyan-500">if</span> diff <span className="text-cyan-500">in</span> seen:{'\n'}
              {'            '}<span className="text-cyan-500">return</span> [seen[diff], i]{'\n'}
              {'        '}seen[n] = i
            </pre>
          </motion.div>

          {/* Small cards */}
          {[
            { icon: Brain, title: 'Smart Feedback', desc: 'Actionable improvement suggestions' },
            { icon: Zap, title: 'Instant Evaluation', desc: 'Feedback right after the session' },
            { icon: Shield, title: 'Resume-Based', desc: 'Questions from your experience' },
            { icon: Award, title: 'All interview types', desc: 'DSA, behavioral, system design' },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ boxShadow: '0 12px 24px -10px rgba(0,0,0,0.3), 0 0 0 1px rgba(6,182,212,0.1)' }}
              className="p-5 rounded-xl bg-raised border border-[var(--border-subtle)] transition-shadow duration-150"
            >
              <item.icon className="w-5 h-5 text-cyan-500 mb-2" />
              <h4 className="font-semibold text-white text-sm">{item.title}</h4>
              <p className="text-zinc-500 text-xs mt-1">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    { number: '01', title: 'Upload Resume', description: 'Share your background for personalized questions' },
    { number: '02', title: 'Choose Type', description: 'DSA, behavioral, or custom role' },
    { number: '03', title: 'Practice Live', description: 'Speak naturally with the AI' },
    { number: '04', title: 'Get Feedback', description: 'Instant analysis and tips' },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-raised overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <h2 className="font-display text-4xl md:text-5xl text-white">How it works</h2>
      </motion.div>

      <div className="flex overflow-x-auto gap-8 md:gap-12 px-6 pb-8 custom-scrollbar snap-x snap-mandatory">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="flex-shrink-0 w-72 snap-center relative"
          >
            <div className="text-9xl font-display font-normal text-white/5 absolute -top-4 left-0 select-none" aria-hidden>
              {step.number}
            </div>
            <div className="relative pt-16">
              <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-zinc-500 text-sm">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const Testimonials = () => {
  const testimonials = [
    { name: 'Sarah C.', role: 'SWE', initials: 'SC', ring: 'cyan', content: 'The voice practice felt close to real interviews. I was less nervous when it mattered.' },
    { name: 'Michael P.', role: 'Senior Dev', initials: 'MP', ring: 'emerald', content: 'DSA with instant run and test cases saved me a lot of time. Feedback was specific, not generic.' },
    { name: 'Priya S.', role: 'Full Stack', initials: 'PS', ring: 'violet', content: 'I used it before my onsite. The behavioral prompts and follow-ups were surprisingly on point.' },
  ];

  const ringColors = { cyan: 'border-cyan-500/50', emerald: 'border-emerald-500/50', violet: 'border-violet-500/50' };

  return (
    <section id="testimonials" className="py-24 bg-base">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl md:text-5xl text-white">What people say</h2>
        </motion.div>

        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="break-inside-avoid p-6 rounded-2xl bg-raised border border-[var(--border-subtle)]"
            >
              <p className="text-zinc-300 text-sm leading-relaxed mb-6">"{t.content}"</p>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full border-2 ${ringColors[t.ring]} flex items-center justify-center text-sm font-semibold text-white bg-overlay`}>
                  {t.initials}
                </div>
                <div>
                  <div className="font-medium text-white text-sm">{t.name}</div>
                  <div className="text-zinc-500 text-xs">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="bg-base border-t border-[var(--border-subtle)] py-12">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-2 gap-12 mb-12">
        <div>
          <div className="text-xl font-semibold text-white mb-2">Vetta.ai</div>
          <p className="text-zinc-500 text-sm max-w-sm">
            AI-powered interview prep for engineers.
          </p>
        </div>
        <div className="flex flex-wrap gap-8 justify-end md:justify-start">
          <a href="#features" className="text-sm text-zinc-500 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm text-zinc-500 hover:text-white transition-colors">How it works</a>
          <a href="#testimonials" className="text-sm text-zinc-500 hover:text-white transition-colors">Testimonials</a>
          <Link to="/signin" className="text-sm text-zinc-500 hover:text-white transition-colors">Sign In</Link>
          <Link to="/signup" className="text-sm text-zinc-500 hover:text-white transition-colors">Sign Up</Link>
        </div>
      </div>
      <div className="border-t border-[var(--border-subtle)] pt-8 text-center">
        <p className="text-zinc-600 text-sm">Built for engineers. By engineers.</p>
      </div>
    </div>
  </footer>
);

const Home = () => (
  <div className="min-h-screen bg-base text-white font-sans">
    <HomeNavbar />
    <Hero />
    <SocialProof />
    <Features />
    <HowItWorks />
    <Testimonials />
    <Footer />
  </div>
);

export default Home;
