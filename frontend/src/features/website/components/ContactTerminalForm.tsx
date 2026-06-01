import React, { useState, type FormEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

import type { ContactIntent } from './ContactIntentPanel';
import { submitContactRequest } from '../services/contactService';

type ContactTerminalFormProps = {
  intent: ContactIntent;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const INTENT_LABELS: Record<ContactIntent, string> = {
  candidate: 'Candidate',
  enterprise: 'Enterprise / Coach',
  press: 'Press',
};

function validateForm(values: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!values.firstName.trim()) errors.firstName = 'Required';
  if (!values.lastName.trim()) errors.lastName = 'Required';

  const email = values.email.trim();
  if (!email) {
    errors.email = 'Required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email address';
  }

  if (!values.message.trim()) errors.message = 'Required';
  else if (values.message.trim().length < 12) {
    errors.message = 'Message must be at least 12 characters';
  }

  return errors;
}

function buildMailtoUrl(intent: ContactIntent, values: FormState): string {
  const subject = encodeURIComponent(`[${INTENT_LABELS[intent]}] Contact — Vetta.ai`);
  const body = encodeURIComponent(
    [
      `Intent: ${INTENT_LABELS[intent]}`,
      `Name: ${values.firstName.trim()} ${values.lastName.trim()}`,
      `Email: ${values.email.trim()}`,
      '',
      'Message:',
      values.message.trim(),
    ].join('\n'),
  );

  return `mailto:hello@vetta.ai?subject=${subject}&body=${body}`;
}

function ContactField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="contact-field">
      <label htmlFor={id} className="contact-field__label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="contact-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContactTerminalForm({ intent }: ContactTerminalFormProps) {
  const [values, setValues] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof FormState, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setSubmitting(true);
    try {
      await submitContactRequest({
        intent,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        userMessage: values.message.trim(),
      });
      setValues({ firstName: '', lastName: '', email: '', message: '' });
      setErrors({});
      toast.success('Thanks! We will be in touch soon.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not submit your message';
      toast.error(message);
      toast('Opening your email app as a fallback…', { icon: '✉️' });
      try {
        window.location.href = buildMailtoUrl(intent, values);
      } catch {
        toast.error('Unable to open mail client. Email hello@vetta.ai directly.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lg:col-span-7 lg:pl-0 xl:pl-12">
      <div className="contact-form-card">
        <header className="contact-form-header">
          <p className="contact-form-header__eyebrow">Contact us</p>
          <h2 className="contact-form-header__title">Send a message</h2>
          <p className="contact-form-header__desc">
            We&apos;ll route your request to the right team and respond within 24 hours.
          </p>
          <span className="contact-form-intent-badge" aria-live="polite">
            Intent: {INTENT_LABELS[intent]}
          </span>
        </header>

        <form className="contact-form-fields" onSubmit={handleSubmit} noValidate>
          <div className="contact-form-row">
            <ContactField id="contact-first-name" label="First name" error={errors.firstName}>
              <input
                id="contact-first-name"
                type="text"
                name="firstName"
                autoComplete="given-name"
                value={values.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                placeholder="Jane"
                className="contact-terminal-input"
                aria-invalid={Boolean(errors.firstName)}
                aria-describedby={errors.firstName ? 'contact-first-name-error' : undefined}
                disabled={submitting}
              />
            </ContactField>

            <ContactField id="contact-last-name" label="Last name" error={errors.lastName}>
              <input
                id="contact-last-name"
                type="text"
                name="lastName"
                autoComplete="family-name"
                value={values.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                placeholder="Doe"
                className="contact-terminal-input"
                aria-invalid={Boolean(errors.lastName)}
                aria-describedby={errors.lastName ? 'contact-last-name-error' : undefined}
                disabled={submitting}
              />
            </ContactField>
          </div>

          <ContactField id="contact-email" label="Email" error={errors.email}>
            <input
              id="contact-email"
              type="email"
              name="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="jane@company.com"
              className="contact-terminal-input"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'contact-email-error' : undefined}
              disabled={submitting}
            />
          </ContactField>

          <ContactField id="contact-message" label="Message" error={errors.message}>
            <textarea
              id="contact-message"
              name="message"
              rows={6}
              value={values.message}
              onChange={(e) => updateField('message', e.target.value)}
              placeholder="Tell us how we can help..."
              className="contact-terminal-input contact-terminal-input--textarea"
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? 'contact-message-error' : undefined}
              disabled={submitting}
            />
          </ContactField>

          <div className="contact-form-actions">
            <button type="submit" disabled={submitting} className="contact-transmit-btn">
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 shrink-0" aria-hidden />
                  Send message
                </>
              )}
            </button>
            <p className="contact-form-footnote">
              Or email us directly at{' '}
              <a
                href="mailto:hello@vetta.ai"
                className="text-[var(--color-secondary)] underline-offset-2 hover:underline"
              >
                hello@vetta.ai
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
