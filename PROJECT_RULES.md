# PROJECT_RULES.md

# Easycash Lending Company Inc.

## Business Rules & Functional Requirements

Version: 1.0 (Living Document)

---

# Purpose

This document defines the official business rules, operational policies, and functional requirements for the Easycash Lending Company Inc. Digital Lending Platform.

This is a living document and must be updated whenever business rules are verified or changed.

**Priority Order:**

1. Verified production data
2. Official company policy
3. Approved management decisions
4. Historical legacy behavior
5. Assumptions (clearly marked)

If conflicts arise, verified production data and approved company policy take precedence.

---

# Business Objectives

The new Digital Lending Platform must:

* Replace Excel and Google Sheets workflows.
* Replace the existing SDevTech Lending Platform.
* Centralize all lending operations.
* Improve operational efficiency.
* Reduce manual work.
* Reduce operational costs.
* Support remote work.
* Maintain complete audit trails.
* Preserve historical loan accuracy.
* Support future expansion without major redesign.

---

# Lending Principles

The system must prioritize:

* Accuracy
* Transparency
* Auditability
* Security
* Maintainability
* Configurability

Financial calculations must never rely on hard-coded values.

---

# Loan Products

Loan Products must be configurable.

Each product may define:

* Product Name
* Product Code
* Description
* Interest Method
* Interest Rate
* Loan Term
* Payment Frequency
* Grace Period
* Processing Fee
* Service Fee
* Insurance Fee
* Collection Fee
* Penalty Rules
* Holiday Rules
* Renewal Rules
* Restructuring Rules
* Write-Off Rules
* Early Settlement Rules

Every product must support versioning.

---

# Loan Product Versioning

A Loan Product may have multiple versions.

Only one version may be Active at a time.

Each loan must permanently reference the product version used when it was approved.

Editing a product must never affect existing loans.

Historical loans must always calculate using their original financial rules.

---

# Interest Calculation

The system must support multiple interest methods.

Verified production methods include:

* Flat Rate
* Declining Balance
* Declining Balance Discounted

Future methods may be added without changing the database structure.

Interest calculations must be configurable.

---

# Loan Approval

Every loan must follow an approval workflow.

Typical stages:

* Draft
* Submitted
* Under Review
* Approved
* Released
* Active
* Closed
* Cancelled
* Written Off

Approval levels must be configurable.

Future support for maker-checker approval must remain available.

---

# Borrowers

Borrowers may have:

* Multiple Loans
* Multiple Addresses
* Multiple Contact Numbers
* Multiple Documents
* Multiple Co-Borrowers
* Multiple Guarantors

Borrowers must never be duplicated unnecessarily.

Duplicate detection should use configurable matching rules.

---

# Payments

Every payment must be recorded permanently.

Support:

* Partial Payments
* Full Payments
* Advance Payments
* Overpayments
* Reversals
* Refunds
* Adjustments

Payment allocation rules must be configurable.

If legacy behavior is uncertain, require explicit confirmation before implementation.

---

# Penalties

Penalty calculations must be configurable.

Do not assume formulas.

Implement only verified business rules.

Historical penalties must remain unchanged after rule updates.

---

# Collection Fees

Collection fee rules must be configurable.

Support:

* Percentage
* Fixed Amount
* Conditional Rules

Collection fees must be versioned with loan products.

---

# Documents

Borrowers and loans may include uploaded documents.

Supported file types:

* PDF
* JPG
* JPEG
* PNG

Future support may include:

* DOCX
* XLSX

Document storage must use an abstraction layer.

Default storage:

Local server.

Future migration:

AWS S3 or compatible object storage.

---

# Audit Trail

Every important action must be logged.

Include:

* User
* Timestamp
* IP Address
* Browser
* Action
* Previous Value
* New Value

Audit records must never be deleted.

---

# Notifications

Support notifications for:

* Loan Approval
* Loan Release
* Payment Received
* Overdue Loans
* Upcoming Due Dates
* System Alerts

Future support:

* Email
* SMS
* Push Notifications

---

# Reports

Reports must be generated dynamically.

Support:

* PDF
* Excel
* CSV

Include:

* Portfolio Report
* Collection Report
* Delinquency Report
* Aging Report
* Loan Officer Performance
* Interest Income
* Outstanding Loans
* CIC Reporting

Reports should be configurable whenever possible.

---

# Search

Provide global search.

Support searching by:

* Borrower Name
* Loan Number
* Phone Number
* Government ID
* Reference Number
* Product
* Branch
* Status

---

# Branch Operations

The system must support multiple branches.

Branch-specific configuration should include:

* Cashiers
* Loan Officers
* Managers
* Collections
* Reports

Future support should allow branch comparison dashboards.

---

# User Roles

Minimum roles:

* Administrator
* Manager
* Loan Officer
* Cashier
* Collection Officer
* Viewer

Permissions must be configurable.

Avoid hard-coded role checks.

---

# Data Migration

Legacy MongoDB data must be migrated safely.

Migration must be:

* Repeatable
* Auditable
* Idempotent

Original legacy data must remain unchanged.

---

# Offline-Friendly Behavior

The application should continue functioning during temporary internet interruptions.

Support:

* Cached recently viewed information
* Automatic reconnection
* User notifications
* Safe retry mechanisms

Do not implement full offline transaction processing unless specifically approved.

---

# Remote Work

The platform must be securely accessible outside the office.

Support:

* HTTPS
* VPN or secure remote access
* Multi-user concurrency
* Low-bandwidth environments

---

# Future Modules

Planned future modules include:

* Online Loan Application Portal
* Customer Self-Service Portal
* Mobile API
* Mobile Applications
* SMS Integration
* Email Integration
* Electronic Signatures
* OCR Document Processing
* AI-Assisted Loan Review
* Business Intelligence Dashboard

The system architecture should accommodate these additions without major redesign.

---

# Decision Log

Whenever a business rule changes:

Record:

* Date
* Reason
* Approved By
* Affected Modules
* Migration Impact

Maintain a complete history of business decisions.

---

# Guiding Principle

When there is uncertainty, prioritize correctness over speed.

Never invent business rules.

Always verify financial behavior using production data or approved company policy before implementation.
