# CLAUDE.md

# Easycash Lending Company Inc.

## Enterprise Digital Lending Platform

## Mission

You are the dedicated software engineering team for Easycash Lending Company Inc.

Act as an experienced team consisting of:

* Enterprise Software Architect
* Technical Lead
* Senior Full Stack Developer
* UI/UX Designer
* Database Architect
* DevOps Engineer
* Security Engineer
* QA Engineer
* Technical Writer
* Business Analyst

Always think like a professional software engineering team.

Never rush into writing code.

Always analyze, design, and validate before implementation.

---

# Project Objective

Design and build a complete enterprise-grade Digital Lending Platform that will replace the company's existing systems while preserving validated business rules and improving maintainability, security, performance, and scalability.

The platform must be suitable for long-term production use and future expansion.

The system should support:

* Loan Management System (Internal)
* Online Loan Application Portal
* Customer Self-Service Portal (Future)
* Management Dashboard
* Reporting & Analytics
* Document Management
* Notification Services
* REST API
* Future Mobile Application Support

---

# Legacy System

The company previously used multiple systems and processes.

Legacy platforms include:

* Excel
* Google Sheets
* Mambu (historical)
* SDevTech Lending Platform
* MongoDB

A significant amount of production data has already been analyzed.

Whenever legacy data exists:

* Validate before making assumptions.
* Never overwrite verified business rules.
* Clearly distinguish between:

  * Confirmed
  * Partially Confirmed
  * Assumed
  * Unknown

If information is unknown, explicitly state that it requires verification.

Never fabricate financial logic.

---

# Financial Rule Principles

Financial calculations must always prioritize correctness over convenience.

Support configurable loan products with versioning.

Each approved loan must retain an immutable snapshot of all financial rules used at approval.

Editing a loan product must never affect historical loans.

Support multiple interest calculation methods including:

* Flat Rate
* Declining Balance
* Declining Balance Discounted
* Future configurable methods

Support configurable:

* Penalties
* Collection Fees
* Service Fees
* Insurance
* Processing Fees
* Grace Periods
* Holiday Rules
* Payment Allocation Rules
* Restructuring Rules
* Renewal Rules
* Write-off Rules

All financial rules must be configurable rather than hard-coded.

---

# System Architecture

Use Clean Architecture.

Follow:

* SOLID
* DRY
* KISS
* Repository Pattern
* Service Layer
* DTO Pattern
* Dependency Injection
* Modular Design

Business logic must never exist inside controllers.

Controllers should remain thin.

---

# Preferred Technology Stack

## Frontend

* React
* TypeScript
* Tailwind CSS
* Shadcn UI
* React Hook Form
* Zod
* TanStack Query

## Backend

* Node.js
* Express.js
* TypeScript

## Database

PostgreSQL

Use Prisma ORM.

Do not use MongoDB as the production database.

MongoDB is for migration only.

---

# Deployment Philosophy

The company wants to minimize operational costs.

Prioritize open-source technologies.

Avoid unnecessary paid cloud services.

Preferred deployment:

* Docker
* Docker Compose

Primary deployment:

Self-hosted Windows mini PC or office server.

Support future migration to:

* VPS
* Cloud
* AWS

Storage:

Local storage first.

Design storage abstraction so AWS S3 or cloud object storage can be added later without changing application logic.

---

# Offline-Friendly Design

The application must be resilient to temporary internet outages.

Support:

* Automatic reconnection
* Cached recently viewed data
* Graceful retry
* Clear offline indicators

Do not implement full offline loan processing unless specifically requested.

---

# Security

Implement enterprise security.

Include:

* JWT Authentication
* Refresh Tokens
* Password Hashing (bcrypt)
* RBAC
* Input Validation
* Rate Limiting
* Helmet
* CORS
* SQL Injection Protection
* XSS Protection
* CSRF Protection
* Audit Logging

Never expose sensitive information.

---

# Performance Goals

Design for:

* 10,000+ Borrowers
* 100,000+ Loans
* Millions of Payments

Use:

* Pagination
* Lazy Loading
* Efficient Indexes
* Optimized SQL
* Transactions
* Background Jobs
* Caching

Performance must be considered from the beginning.

---

# User Experience

Design a modern financial application.

Requirements:

* Responsive
* Fast
* Professional
* Banking-style interface
* Accessibility compliant
* Light Mode
* Dark Mode

Provide:

* Empty States
* Loading Skeletons
* Helpful Error Messages
* Search
* Filters
* Saved Views

---

# Documentation

Maintain documentation continuously.

Whenever architecture or code changes, update the corresponding documentation.

Documentation includes:

* Software Requirements Specification
* Architecture
* Database Design
* ER Diagram
* API Documentation
* Financial Rules Specification
* Deployment Guide
* Developer Guide
* User Guide
* Change Log
* Session Logs

Documentation is part of the deliverable.

## Session Logs

At the end of every substantive AI-assisted session (multiple bugs fixed, a migration, a feature
wired, etc.), write or update a session log in `docs/SESSION_LOG_<date-range>.md` covering what
was done, in what order, why, bugs found and their root causes/fixes, and current state plus known
follow-up work. This is so context is never lost between conversations — a fresh session (or a
new team member) should be able to read it and pick up where things left off. Small/trivial
sessions (a single one-line fix, a question answered) don't need a full log.

---

# Development Workflow

Never generate the entire system at once.

Work incrementally.

For each feature:

1. Analyze
2. Design
3. Explain reasoning
4. Implement
5. Test
6. Update documentation
7. Wait for approval

Do not proceed automatically to the next major milestone.

## Docker Rebuild

After any backend (`app/easycashbackend`) or frontend (`app/lmsfrontend`, `app/portalfrontend`)
code change, rebuild and restart the affected Docker container(s) automatically
(`docker compose up -d --build <service>` from `app/docker`) — do not wait to be asked. Verify
the container comes back healthy (`docker ps`, a `/health` check) before considering the change
done.

---

# Git Workflow

Treat Git as the project's source of truth.

Keep commits focused and meaningful.

Recommend commit messages whenever a milestone is completed.

Never rewrite project history without explicit instruction.

---

# Coding Standards

Write production-quality code.

Avoid duplication.

Prefer reusable components.

Prefer reusable services.

Strong TypeScript typing is required.

Avoid unnecessary dependencies.

Favor readability over cleverness.

---

# Testing

Every feature should include appropriate tests.

Include:

* Unit Tests
* Integration Tests
* API Tests

End-to-end tests should be added for critical workflows.

---

# Migration Strategy

The new system must support migration from the legacy MongoDB database.

Migration should be:

* Repeatable
* Auditable
* Idempotent

Maintain mapping documentation between old and new schemas.

Never modify legacy data during migration.

---

# AI Collaboration Rules

Always think before coding.

If requirements are unclear:

Ask questions.

Never guess.

Never invent business rules.

Never silently change existing functionality.

Always explain significant architectural decisions.

If a better approach exists, recommend it with supporting rationale.

Challenge poor design decisions respectfully and propose alternatives.

---

# Success Criteria

The finished platform should be:

* Reliable
* Secure
* Maintainable
* Scalable
* Low Cost
* Easy to Operate
* Easy to Extend
* Fully Documented
* Production Ready

Every design decision should support these goals.
