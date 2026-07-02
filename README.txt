# Easycash Lending Company Inc.

# Enterprise Digital Lending Platform

# README

---

## PROJECT OVERVIEW

This workspace contains the complete development project for the Easycash Lending Company Inc. Enterprise Digital Lending Platform.

The objective of this project is to replace the company's legacy lending systems with a modern, secure, scalable, and maintainable web-based platform while preserving verified business rules from the existing production system.

This project is being developed incrementally using Claude Code following professional software engineering practices.

---

## PRIMARY GOALS

• Replace Excel and Google Sheets workflows
• Replace the existing SDevTech lending platform
• Preserve validated business rules
• Migrate data from the legacy MongoDB database
• Build a configurable and versioned Loan Management System
• Support future online loan applications
• Support remote work with secure web access
• Minimize infrastructure and operating costs
• Produce complete technical documentation

---

## TECHNOLOGY STACK

Frontend

* React
* TypeScript
* Tailwind CSS
* Shadcn UI
* React Hook Form
* Zod
* TanStack Query

Backend

* Node.js
* Express.js
* TypeScript

Database

* PostgreSQL

ORM

* Prisma

Authentication

* JWT
* Refresh Tokens

Deployment

* Docker
* Docker Compose

Version Control

* Git

---

## PROJECT STRUCTURE

CLAUDE.md
Primary instruction file for Claude Code.

docs/
Project documentation including:

* Software Requirements Specification
* Architecture
* Database Design
* API Documentation
* Financial Rules Specification
* Deployment Guide
* Developer Guide
* Change Log

legacy/
Legacy system resources including:

* MongoDB exports
* SDevTech application files
* Reverse engineering reports
* Migration references

backend/
Backend source code.

frontend/
Frontend source code.

database/
Database schema, migrations, and seed data.

scripts/
Migration and utility scripts.

tests/
Unit, integration, and end-to-end tests.

deployment/
Docker configuration and deployment resources.

---

## DEVELOPMENT PRINCIPLES

The project follows these principles:

• Analyze before coding
• Never guess financial calculations
• Validate business rules against production data
• Use configurable financial rules
• Preserve historical loan behavior
• Keep documentation synchronized with implementation
• Build incrementally
• Wait for approval before major milestones

---

## CURRENT PROJECT STATUS

The project is currently in the architecture and migration planning stage.

Legacy system analysis includes:

• MongoDB database analysis
• SDevTech application analysis
• Loan product analysis
• Loan account analysis
• Repayment analysis
• Financial rule verification
• Database migration planning

Future implementation will be based only on verified production data.

---

## FINANCIAL RULES

Financial calculations must never be hard-coded.

Support configurable:

• Interest methods
• Loan products
• Penalties
• Collection fees
• Payment allocation rules
• Holiday handling
• Grace periods
• Restructuring
• Renewals
• Write-offs

Every approved loan must store an immutable snapshot of its financial rules.

---

## DEPLOYMENT GOALS

Primary deployment:

• Self-hosted office server or mini PC
• Docker
• PostgreSQL
• Local document storage

Future expansion:

• Cloud deployment
• AWS S3
• Mobile applications
• Customer self-service portal
• Online loan application portal

---

## IMPORTANT NOTES

Claude Code should always read CLAUDE.md before making architectural or implementation decisions.

Do not remove legacy files until migration has been completed and validated.

Do not modify verified business rules without approval.

Every significant change should include:

• Updated documentation
• Tests
• Migration notes
• Git commit recommendation

---

## PROJECT VISION

Build a reliable, secure, low-cost, and enterprise-grade Digital Lending Platform that will support Easycash Lending Company Inc. for many years while remaining easy to maintain, easy to extend, and suitable for future growth.
