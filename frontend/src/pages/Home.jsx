import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Mic, Code, Brain, Zap, CheckCircle, Star, ArrowRight, 
  Users, Award, TrendingUp, Shield, Menu, X, Github, Twitter, Linkedin
} from 'lucide-react';

// Logo Component
const InterviewAILogo = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#8B5CF6" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="18" stroke="url(#logoGradient)" strokeWidth="2" />
    <path d="M15 14 L20 20 L15 26" stroke="url(#logoGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 14 L27 20 L22 26" stroke="url(#logoGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Navbar Component
const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <InterviewAILogo className="w-10 h-10 group-hover:scale-110 transition-transform" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              InterviewAI
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-300 hover:text-white transition">Features</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-white transition">How It Works</a>
            <a href="#testimonials" className="text-gray-300 hover:text-white transition">Testimonials</a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition">Pricing</a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/signin" className="text-gray-300 hover:text-white transition">
              Sign In
            </Link>
            <Link to="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/30 transition"
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
            className="md:hidden mt-4 pb-4 border-t border-white/10 pt-4 space-y-4"
          >
            <a href="#features" className="block text-gray-300 hover:text-white transition">Features</a>
            <a href="#how-it-works" className="block text-gray-300 hover:text-white transition">How It Works</a>
            <a href="#testimonials" className="block text-gray-300 hover:text-white transition">Testimonials</a>
            <Link to="/signin" className="block text-gray-300 hover:text-white transition">Sign In</Link>
            <Link to="/signup" className="block">
              <button className="w-full px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium">
                Get Started
              </button>
            </Link>
          </motion.div>
        )}
      </div>
    </nav>
  );
};

// Hero Section
const Hero = () => (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
    {/* Animated Background */}
    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-purple-900/20">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
    </div>

    <div className="relative max-w-7xl mx-auto px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="inline-block px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full mb-6">
          <span className="text-purple-400 text-sm font-medium">🚀 Powered by AI & Real-Time Voice</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Master Interviews
          </span>
          <br />
          <span className="text-white">with AI Intelligence</span>
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
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-bold text-lg flex items-center gap-2 shadow-2xl shadow-purple-500/30"
            >
              Start Practicing Free
              <ArrowRight size={20} />
            </motion.button>
          </Link>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl font-bold text-lg hover:bg-white/10 transition"
          >
            Watch Demo
          </motion.button>
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
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-1">
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
            Everything You Need to <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Excel</span>
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
              className="p-6 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl hover:border-purple-500/50 transition-all group"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
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
    <section id="how-it-works" className="py-24 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Get Started in <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">4 Simple Steps</span>
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
              <div className="text-6xl font-bold text-transparent bg-gradient-to-br from-blue-600/20 to-purple-600/20 bg-clip-text mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">{step.title}</h3>
              <p className="text-gray-400">{step.description}</p>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600" />
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
      content: 'InterviewAI helped me land my dream job! The real-time voice practice made me so much more confident in actual interviews.',
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
            Loved by <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Thousands</span>
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
              className="p-6 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={18} fill="#F59E0B" stroke="#F59E0B" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 italic">"{testimonial.content}"</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl">
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
  <section className="py-24 bg-gradient-to-br from-blue-600 to-purple-600 relative overflow-hidden">
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
    
    <div className="relative max-w-4xl mx-auto px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
          Ready to Ace Your Next Interview?
        </h2>
        <p className="text-xl text-white/80 mb-8">
          Join 50,000+ developers who are mastering their interview skills with InterviewAI
        </p>
        <Link to="/signup">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-10 py-5 bg-white text-purple-600 rounded-xl font-bold text-xl shadow-2xl hover:shadow-white/20 transition flex items-center gap-3 mx-auto"
          >
            Get Started for Free
            <ArrowRight size={24} />
          </motion.button>
        </Link>
        <p className="text-white/60 mt-4 text-sm">No credit card required • Start in 2 minutes</p>
      </motion.div>
    </div>
  </section>
);

// Footer
const Footer = () => (
  <footer className="bg-black border-t border-white/10 py-12">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-4 gap-12 mb-12">
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <InterviewAILogo className="w-10 h-10" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              InterviewAI
            </span>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            AI-powered interview preparation platform helping developers succeed.
          </p>
          <div className="flex gap-4">
            <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
              <Twitter size={18} className="text-gray-400" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
              <Github size={18} className="text-gray-400" />
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
              <Linkedin size={18} className="text-gray-400" />
            </a>
          </div>
        </div>

        {/* Product */}
        <div>
          <h4 className="font-bold text-white mb-4">Product</h4>
          <ul className="space-y-2">
            <li><a href="#features" className="text-gray-400 hover:text-white transition text-sm">Features</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Pricing</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">API</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Documentation</a></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="font-bold text-white mb-4">Company</h4>
          <ul className="space-y-2">
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">About</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Blog</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Careers</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Contact</a></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="font-bold text-white mb-4">Legal</h4>
          <ul className="space-y-2">
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Privacy</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Terms</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Security</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition text-sm">Compliance</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-gray-500 text-sm">
          © 2024 InterviewAI. All rights reserved.
        </p>
        <div className="flex gap-6 text-sm text-gray-500">
          <a href="#" className="hover:text-white transition">Status</a>
          <a href="#" className="hover:text-white transition">Changelog</a>
          <a href="#" className="hover:text-white transition">Community</a>
        </div>
      </div>
    </div>
  </footer>
);

// Main Home Component
const Home = () => {
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />
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