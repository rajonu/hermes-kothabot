'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, Rocket, MessageSquare, ExternalLink } from 'lucide-react';

const EXTRACTION_PROMPT = `Visit and analyze the following business website and Facebook page.

Website:
[PASTE WEBSITE URL]

Facebook Page:
[PASTE FACEBOOK PAGE URL]

Extract and summarize ONLY important business information.

Include:
- Business Name
- Business Description
- About Company
- Products
- Services
- Categories
- Pricing (if available)
- Packages
- Promotions
- Business Hours
- Contact Numbers
- Email Addresses
- Office Locations
- Branch Locations
- Service Areas
- Delivery Information
- Booking Information
- Refund or Return Policies
- Frequently Asked Questions
- Customer Support Information
- Social Media Links

Create a concise business knowledge summary optimized for an AI voice assistant.

Requirements:
- Use simple and factual language
- Remove duplicate information
- Ignore blog posts and unrelated content
- Prioritize website information over Facebook information
- Keep output under 1000 words
- Organize information into sections
- Include only information useful for customer support

Output Format:

BUSINESS OVERVIEW

PRODUCTS & SERVICES

PRICING & PACKAGES

BUSINESS HOURS

CONTACT INFORMATION

LOCATIONS

POLICIES

CUSTOMER FAQ

VOICE ASSISTANT SUMMARY

The final "VOICE ASSISTANT SUMMARY" should be concise and optimized for AI voice assistants.`;

const STEPS = [
  { n: 1, text: 'Copy the prompt below.' },
  { n: 2, text: 'Open ChatGPT, Gemini, or Claude.' },
  { n: 3, text: 'Paste the prompt.' },
  { n: 4, text: 'Add your Website URL and Facebook Page URL.' },
  { n: 5, text: 'Generate the business summary.' },
  { n: 6, text: 'Copy the generated summary.' },
  { n: 7, text: 'Paste it into the Info tab in AI Training above.' },
];

const AI_TOOLS = [
  { name: 'ChatGPT', href: 'https://chat.openai.com', color: 'text-green-400' },
  { name: 'Gemini',  href: 'https://gemini.google.com', color: 'text-blue-400' },
  { name: 'Claude',  href: 'https://claude.ai', color: 'text-amber-400' },
];

export function ExtractionHelper() {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(EXTRACTION_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-2xl border border-emerald-600/20 bg-gradient-to-br from-emerald-600/5 to-transparent overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-emerald-600/5 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-emerald-600/15 border border-emerald-600/25 flex items-center justify-center shrink-0">
          <Rocket size={16} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Need Better AI Responses?</p>
          <p className="text-xs text-gray-400 mt-0.5">Use ChatGPT, Gemini, or Claude to extract business info — then paste it here.</p>
        </div>
        <div className="shrink-0 text-gray-500">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="px-5 pb-6 space-y-5 border-t border-emerald-600/15">

          {/* Description */}
          <div className="pt-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              For the best results, use a free AI tool to extract and summarize your business information from your website and Facebook page. Then paste the generated summary into your AI Training section.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This helps KothaBot better understand your products, services, pricing, policies, and business information.
            </p>
          </div>

          {/* AI tool links */}
          <div className="flex flex-wrap gap-2">
            {AI_TOOLS.map(({ name, href, color }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors text-xs font-semibold text-gray-300 hover:text-white"
              >
                <span className={`text-[11px] font-bold ${color}`}>↗</span>
                {name}
                <ExternalLink size={10} className="text-gray-600" />
              </a>
            ))}
          </div>

          {/* Steps */}
          <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-4 space-y-2.5">
            <p className="text-xs font-bold text-gray-300 uppercase tracking-wide mb-3">How it works</p>
            {STEPS.map(({ n, text }) => (
              <div key={n} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {n}
                </span>
                <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Prompt box */}
          <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <p className="text-xs font-bold text-gray-300">Extraction Prompt</p>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  copied
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                    : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 hover:text-white'
                }`}
              >
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Prompt</>}
              </button>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
              <pre className="text-[11px] text-gray-400 whitespace-pre-wrap leading-relaxed font-mono">
                {EXTRACTION_PROMPT}
              </pre>
            </div>
          </div>

          {/* Support */}
          <div className="flex items-start gap-3 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3.5">
            <MessageSquare size={14} className="text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">Need help setting up your AI knowledge base?</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Contact{' '}
                <a href="/support" className="text-emerald-400 hover:underline font-medium">
                  KothaBot Support
                </a>
                {' '}and our team can assist you.
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
