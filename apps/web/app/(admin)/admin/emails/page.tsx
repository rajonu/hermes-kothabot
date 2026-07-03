'use client';

import { useState, useEffect } from 'react';
import { Mail, Save, Send } from 'lucide-react';
import { emailTemplates as defaultTemplates } from '@/lib/email-templates';

interface Template {
  id: string;
  name: string;
  subject: string;
  html: string;
}

const templatesList: Template[] = [
  {
    id: 'payment-confirmation',
    name: 'Payment Confirmation',
    subject: defaultTemplates.paymentConfirmation({ customerName: 'John', amount: 99, currency: 'USD', planName: 'Professional', invoiceId: 'INV-001' }).subject,
    html: defaultTemplates.paymentConfirmation({ customerName: 'John', amount: 99, currency: 'USD', planName: 'Professional', invoiceId: 'INV-001' }).html,
  },
  {
    id: 'subscription-created',
    name: 'Subscription Created',
    subject: defaultTemplates.subscriptionCreated({ customerName: 'John', planName: 'Professional', billingCycle: 'Monthly', amount: 99, currency: 'USD' }).subject,
    html: defaultTemplates.subscriptionCreated({ customerName: 'John', planName: 'Professional', billingCycle: 'Monthly', amount: 99, currency: 'USD' }).html,
  },
  {
    id: 'subscription-renewed',
    name: 'Subscription Renewed',
    subject: defaultTemplates.subscriptionRenewed({ customerName: 'John', planName: 'Professional', amount: 99, currency: 'USD', nextRenewalDate: '2026-06-24' }).subject,
    html: defaultTemplates.subscriptionRenewed({ customerName: 'John', planName: 'Professional', amount: 99, currency: 'USD', nextRenewalDate: '2026-06-24' }).html,
  },
  {
    id: 'subscription-cancelled',
    name: 'Subscription Cancelled',
    subject: defaultTemplates.subscriptionCancelled({ customerName: 'John', planName: 'Professional', cancellationDate: '2026-05-24' }).subject,
    html: defaultTemplates.subscriptionCancelled({ customerName: 'John', planName: 'Professional', cancellationDate: '2026-05-24' }).html,
  },
  {
    id: 'invoice-sent',
    name: 'Invoice Sent',
    subject: defaultTemplates.invoiceSent({ customerName: 'John', invoiceId: 'INV-001', amount: 99, currency: 'USD', dueDate: '2026-06-07' }).subject,
    html: defaultTemplates.invoiceSent({ customerName: 'John', invoiceId: 'INV-001', amount: 99, currency: 'USD', dueDate: '2026-06-07' }).html,
  },
  {
    id: 'welcome',
    name: 'Welcome Email',
    subject: defaultTemplates.welcomeEmail({ customerName: 'John', shopName: 'My Shop', loginUrl: 'http://localhost:3001/login' }).subject,
    html: defaultTemplates.welcomeEmail({ customerName: 'John', shopName: 'My Shop', loginUrl: 'http://localhost:3001/login' }).html,
  },
  {
    id: 'ticket-confirmation',
    name: 'Support Ticket Confirmation',
    subject: defaultTemplates.ticketCreatedConfirmation({ customerName: 'John', ticketId: 'TICKET-001', subject: 'Help with setup' }).subject,
    html: defaultTemplates.ticketCreatedConfirmation({ customerName: 'John', ticketId: 'TICKET-001', subject: 'Help with setup' }).html,
  },
  {
    id: 'ticket-reply',
    name: 'Support Ticket Reply',
    subject: defaultTemplates.supportTicketReply({ customerName: 'John', ticketId: 'TICKET-001', subject: 'Help with setup', replyMessage: 'Thank you for contacting us...', shopName: 'KothaBot Support' }).subject,
    html: defaultTemplates.supportTicketReply({ customerName: 'John', ticketId: 'TICKET-001', subject: 'Help with setup', replyMessage: 'Thank you for contacting us...', shopName: 'KothaBot Support' }).html,
  },
];

export default function AdminEmailsPage() {
  const [templates, setTemplates] = useState<Template[]>(templatesList);
  const [testEmail, setTestEmail] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/admin/email-templates');
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setTemplates(prev => prev.map(t => data.find((d: Template) => d.id === t.id) || t));
        }
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const updateTemplate = (id: string, field: 'subject' | 'html', value: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const saveTemplates = async () => {
    setLoading(true);
    try {
      for (const template of templates) {
        const response = await fetch('/api/admin/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template),
        });

        if (!response.ok) {
          throw new Error(`Failed to save ${template.name}`);
        }
      }
      setMessage({ type: 'success', text: '✅ All templates saved globally!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: `Error: ${err instanceof Error ? err.message : 'Failed to save'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!selectedTemplate || !testEmail) {
      setMessage({ type: 'error', text: 'Select a template and enter an email' });
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;

    setLoading(true);
    try {
      const response = await fetch('/api/email/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          subject: template.subject,
          html: template.html,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `✅ Test email sent to ${testEmail}!` });
        setTestEmail('');
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: `Failed: ${error.error}` });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: `Error: ${err instanceof Error ? err.message : 'Failed to send'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-8 h-8 text-emerald-500" />
            <h1 className="text-3xl font-bold text-white">Email Templates</h1>
          </div>
          <p className="text-gray-400">Edit and test email templates. Changes save globally for the entire app.</p>
        </div>

        {/* Alert Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-600/20 border border-emerald-600/30 text-emerald-300' : 'bg-red-600/20 border border-red-600/30 text-red-300'}`}>
            {message.text}
          </div>
        )}

        {/* Test Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Test Email</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">Select Template</label>
              <select
                value={selectedTemplate || ''}
                onChange={e => setSelectedTemplate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Choose a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={sendTestEmail}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              <Send size={16} />
              Send Test
            </button>
          </div>
        </div>

        {/* Templates */}
        <div className="space-y-6">
          {templates.map(template => (
            <div key={template.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">{template.name}</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                  <input
                    type="text"
                    value={template.subject}
                    onChange={e => updateTemplate(template.id, 'subject', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">HTML Content</label>
                  <textarea
                    value={template.html}
                    onChange={e => updateTemplate(template.id, 'html', e.target.value)}
                    rows={10}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 resize-none"
                    placeholder="Enter HTML template..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <button
          onClick={saveTemplates}
          disabled={loading}
          className="mt-8 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg"
        >
          <Save size={20} />
          {loading ? 'Saving...' : 'Save All Templates'}
        </button>
      </div>
  );
}
