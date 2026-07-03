# KothaBot v2.0 — Architecture Documentation

> Version 1.0.0 · Build 146 · Last updated: 2026-06-15

KothaBot is a **multi-tenant Voice AI SaaS platform** for small businesses. Customers visit a merchant's website, click a floating phone widget, and an AI assistant answers in Bangla or English — taking orders, booking appointments, answering questions — 24/7.

---

## Documents

| Document | Description |
|---|---|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | High-level architecture, deployment topology, tech stack |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | All Supabase tables, columns, RLS policies, indexes |
| [FILE_STRUCTURE.md](FILE_STRUCTURE.md) | Monorepo layout, all major files and their roles |
| [MODULES.md](MODULES.md) | Feature modules — auth, dashboard, AI, admin, payments |
| [CATEGORY_SYSTEM.md](CATEGORY_SYSTEM.md) | 11 business categories, category-aware UI, label mappings |
| [AI_SYSTEM.md](AI_SYSTEM.md) | 4-layer prompt system, Gemini Live, session lifecycle, cost protection |
| [BILLING_SYSTEM.md](BILLING_SYSTEM.md) | Plans, subscriptions, payment methods, BD/INTL regions |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Google Calendar, SIP telephony, WordPress plugin, Public API v1 |
| [API_REFERENCE.md](API_REFERENCE.md) | All API routes (89+), request/response formats |
| [CHANGELOG.md](CHANGELOG.md) | Build history from v1 to build 146 |

---

## Quick Reference

**Live URLs**
- Dashboard: https://my.kothabot.ai.bd
- Landing page: https://kothabot.ai.bd
- Voice links: https://call.kothabot.ai.bd
- Admin: https://my.kothabot.ai.bd/admin-login

**Repository**
- GitHub: https://github.com/rajonu/kothabot-2.0.git
- Local: `/Users/rajrio/Desktop/dev/Claude-project/Kothabot-2.0/`

**VPS**
- IP: `163.128.144.171`
- SSH: `sshpass -p 'Allah7570#' ssh root@163.128.144.171`

**Railway (INTL staging)**
- Web: https://web-production-64818.up.railway.app
- Project: soothing-hope
