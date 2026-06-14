import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { WebsiteLayout } from '../components/WebsiteLayout';
import { ContactIntentPanel, type ContactIntent } from '../components/ContactIntentPanel';
import { ContactTerminalForm } from '../components/ContactTerminalForm';

export default function ContactPage() {
  const [intent, setIntent] = useState<ContactIntent>('enterprise');
  const reduceMotion = useReducedMotion();

  return (
    <WebsiteLayout footerVariant="full" showDecorations mainClassName="py-16 md:py-24">
      <div className="relative">
        <div
          className="landing-hero-glow pointer-events-none absolute right-0 top-16 h-[min(520px,70vw)] w-[min(520px,70vw)] -translate-y-1/2 translate-x-1/3 rounded-full blur-[120px]"
          aria-hidden="true"
        />
        <motion.div
          className="grid grid-cols-1 gap-gutter lg:grid-cols-12 lg:gap-14"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0, 0, 0.2, 1] }}
        >
          <ContactIntentPanel selected={intent} onSelect={setIntent} />
          <ContactTerminalForm intent={intent} />
        </motion.div>
      </div>
    </WebsiteLayout>
  );
}
