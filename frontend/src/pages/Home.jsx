import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Mic, Code, Brain, Zap, Star, ArrowRight,
  Award, Shield, Menu, X
} from 'lucide-react';

// Navbar Component
const HomeNavbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-cyan-600/20">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 text-white hover:text-cyan-400 transition">
            <img
              src="/vettalogo-removebg-preview.png"
              alt="Vetta.ai logo"
              className="h-12 w-auto"
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-300 hover:text-cyan-400 transition">Features</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-cyan-400 transition">How It Works</a>
            <a href="#testimonials" className="text-gray-300 hover:text-cyan-400 transition">Testimonials</a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/signin" className="text-gray-300 hover:text-cyan-400 transition">
              Sign In
            </Link>
            <Link to="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-cyan"
              >
                Get Started
              </motion.button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden mt-4 pb-4 border-t border-cyan-600/20 pt-4 space-y-4"
          >
            <a href="#features" className="block text-gray-300 hover:text-cyan-400 transition">Features</a>
            <a href="#how-it-works" className="block text-gray-300 hover:text-cyan-400 transition">How It Works</a>
            <a href="#testimonials" className="block text-gray-300 hover:text-cyan-400 transition">Testimonials</a>
            <Link to="/signin" className="block text-gray-300 hover:text-cyan-400 transition">Sign In</Link>
            <Link to="/signup" className="block">
              <button className="w-full btn-cyan">Get Started</button>
            </Link>
          </motion.div>
        )}
      </div>
    </nav>
  );
};

// Hero Section
const Hero = () => (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-black">
    <div className="absolute inset-0 opacity-10">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#06b6d4" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>

    <div className="relative max-w-7xl mx-auto px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full mb-6">
          <span className="text-cyan-400 text-sm font-medium">🚀 Powered by AI & Real-Time Voice</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-white">
          Master Interviews
          <br />
          <span className="text-cyan-400">with AI Intelligence</span>
        </h1>

        <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto leading-relaxed">
          Experience real-time voice-powered mock interviews with intelligent AI feedback. 
          Practice coding challenges, behavioral questions, and system design—all in one platform.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to="/signup">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-cyan flex items-center gap-2 text-lg"
            >
              Start Practicing Free
              <ArrowRight size={20} />
            </motion.button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-4xl mx-auto">
          {[
            { label: 'Active Users', value: '50K+' },
            { label: 'Interviews', value: '1M+' },
            { label: 'Success Rate', value: '94%' },
            { label: 'Avg Rating', value: '4.9/5' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="text-center"
            >
              <div className="text-3xl font-bold text-cyan-400 mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

// Features Section
const Features = () => {
  const features = [
    {
      icon: <Mic className="w-8 h-8" />,
      title: 'Real-Time Voice AI',
      description: 'Natural voice conversations with our AI interviewer powered by advanced speech recognition'
    },
    {
      icon: <Code className="w-8 h-8" />,
      title: 'Live Coding Challenges',
      description: 'Solve DSA problems with real-time code execution and instant feedback on multiple test cases'
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: 'Smart Feedback',
      description: 'Get detailed analysis of your responses with actionable improvement suggestions'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Instant Evaluation',
      description: 'Receive comprehensive feedback immediately after your interview session'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Resume-Based Questions',
      description: 'Upload your resume and get personalized questions based on your experience'
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: 'Multiple Interview Types',
      description: 'Practice DSA, System Design, Behavioral, Frontend, Backend, and custom roles'
    }
  ];

  return (
    <section id="features" className="py-24 bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Everything You Need to <span className="text-cyan-400">Excel</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Comprehensive tools designed to help you succeed in technical interviews
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="p-6 bg-gray-900/50 border border-cyan-600/20 rounded-2xl hover:border-cyan-500/50 transition-all group"
            >
              <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-cyan-400">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// How It Works
const HowItWorks = () => {
  const steps = [
    { number: '01', title: 'Upload Resume', description: 'Share your background for personalized questions' },
    { number: '02', title: 'Choose Interview Type', description: 'Select from DSA, behavioral, or custom roles' },
    { number: '03', title: 'Practice Live', description: 'Speak naturally with our AI interviewer' },
    { number: '04', title: 'Get Feedback', description: 'Receive instant analysis and improvement tips' }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-gray-950">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Get Started in <span className="text-cyan-400">4 Simple Steps</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative"
            >
              <div className="text-6xl font-bold text-cyan-400/20 mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">{step.title}</h3>
              <p className="text-gray-400">{step.description}</p>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 -right-4 w-8 h-0.5 bg-cyan-600/30" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Testimonials
const Testimonials = () => {
  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Software Engineer at Google',
      avatar: '👩‍💻',
      content: 'Vetta.ai helped me land my dream job! The real-time voice practice made me so much more confident in actual interviews.',
      rating: 5
    },
    {
      name: 'Michael Park',
      role: 'Senior Developer at Meta',
      avatar: '👨‍💼',
      content: 'The coding challenges with instant feedback are game-changing. I improved my DSA skills significantly in just 2 weeks.',
      rating: 5
    },
    {
      name: 'Priya Sharma',
      role: 'Full Stack Developer at Amazon',
      avatar: '👩‍🎓',
      content: 'Best interview prep tool out there. The AI interviewer feels incredibly realistic and the feedback is spot-on.',
      rating: 5
    }
  ];

  return (
    <section id="testimonials" className="py-24 bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Loved by <span className="text-cyan-400">Thousands</span>
          </h2>
          <p className="text-xl text-gray-400">See what our users are saying</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -10 }}
              className="p-6 bg-gray-900/50 border border-cyan-600/20 rounded-2xl"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={18} fill="#06b6d4" stroke="#06b6d4" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 italic">"{testimonial.content}"</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-2xl">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-bold text-white">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// CTA Section
const CTA = () => (
  <section className="py-24 bg-cyan-600/10 border-y border-cyan-600/20 relative overflow-hidden">
    <div className="absolute inset-0 opacity-5">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="cta-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#06b6d4" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cta-grid)" />
      </svg>
    </div>
    
    <div className="relative max-w-4xl mx-auto px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
          Ready to Ace Your Next Interview?
        </h2>
        <p className="text-xl text-gray-300 mb-8">
          Join 50,000+ developers who are mastering their interview skills with Vetta.ai
        </p>
        <Link to="/signup">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-cyan text-xl flex items-center gap-3 mx-auto"
          >
            Get Started for Free
            <ArrowRight size={24} />
          </motion.button>
        </Link>
        <p className="text-gray-400 mt-4 text-sm">No credit card required • Start in 2 minutes</p>
      </motion.div>
    </div>
  </section>
);

// Footer
const Footer = () => (
  <footer className="bg-black border-t border-cyan-600/20 py-12">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-4 gap-12 mb-12">
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="text-2xl font-bold text-white mb-4">
            Vetta.ai
          </div>
          <p className="text-gray-400 text-sm mb-4">
            AI-powered interview preparation platform helping developers succeed.
          </p>
        </div>

        {/* Product */}
        <div>
          <h4 className="font-bold text-white mb-4">Product</h4>
          <ul className="space-y-2">
            <li><a href="#features" className="text-gray-400 hover:text-cyan-400 transition text-sm">Features</a></li>
            <li><button type="button" className="text-gray-400 hover:text-cyan-400 transition text-sm">Pricing</button></li>
            <li><button type="button" className="text-gray-400 hover:text-cyan-400 transition text-sm">Documentation</button></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="font-bold text-white mb-4">Company</h4>
          <ul className="space-y-2">
            <li><button type="button" className="text-gray-400 hover:text-cyan-400 transition text-sm">About</button></li>
            <li><button type="button" className="text-gray-400 hover:text-cyan-400 transition text-sm">Blog</button></li>
            <li><button type="button" className="text-gray-400 hover:text-cyan-400 transition text-sm">Contact</button></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="font-bold text-white mb-4">Legal</h4>
          <ul className="space-y-2">
            <li><button type="button" className="text-gray-400 hover:text-cyan-400 transition text-sm">Privacy</button></li>
            <li><button type="button" className="text-gray-400 hover:text-cyan-400 transition text-sm">Terms</button></li>
            <li><button type="button" className="text-gray-400 hover:text-cyan-400 transition text-sm">Security</button></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-cyan-600/20 pt-8 text-center">
        <p className="text-gray-500 text-sm">
          © 2026 Vetta.ai. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

// Main Home Component
const Home = () => {
  return (
    <div className="bg-black text-white min-h-screen">
      <HomeNavbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
};

export default Home;