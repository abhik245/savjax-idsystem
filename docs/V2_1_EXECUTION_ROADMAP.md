# SAVJAX ID Systems - V2.1 Execution Roadmap

## Goal
Translate the unified product model into build-ready modules with implementation order, acceptance criteria, and technical ownership.

## Phase 0 - Foundation Lock
Scope:
- lock product taxonomy: school, college, company
- finalize role matrix and permission matrix
- finalize common status state machine and transition rules
- define tenant isolation rules for all new entities

Acceptance:
- approved schema contract
- approved permission matrix
- approved workflow transition table

## Phase 1 - Multi-Track Intake Engine
Scope:
- campaign engine supports `institutionType`
- intake form schema per flow type
- sibling logic only for school flow
- self-submission defaults for college/company tracks
- draft save and final submission parity

Acceptance:
- one active campaign per sample school, college, company
- OTP + submission success for all three tracks
- school sibling flow operational

## Phase 2 - AI Photo Intelligence Pipeline
Scope:
- guided live capture checks
- upload fallback validation checks
- post-capture normalization pipeline
- async processing hooks for heavy operations

Acceptance:
- invalid image quality rejected with guidance
- normalized image artifact generated
- production-safe dimension output available

## Phase 3 - Review and Correction Console
Scope:
- sales/ops queue for correction
- duplicate detection merge flow
- field validation and correction trail
- photo replace/recrop path

Acceptance:
- corrected records tracked with audit metadata
- correction-to-approval handoff tested

## Phase 4 - Template Studio and Auto-Binding
Scope:
- tokenized template editor
- front/back layouts and placeholder controls
- version snapshots and approval lock
- one-to-many data auto-binding

Acceptance:
- template edit propagates to mapped records
- snapshot freeze works post approval

## Phase 5 - Configurable Approval Chains
Scope:
- flow-specific approval chain configuration
- bulk and partial approvals
- reject/send-back comments and history

Acceptance:
- school, college, company all run different approval chains successfully

## Phase 6 - Print Production Engine
Scope:
- production-ready queue only
- print batch controls
- print-safe exports
- reprint and reissue loop

Acceptance:
- batch creation and print status progression completed end-to-end

## Phase 7 - Billing and Reconciliation
Scope:
- campaign-level payment toggles
- invoice and partial payment reconciliation
- offline payment marking and audit

Acceptance:
- paid, unpaid, partial scenarios reconciled correctly

## Phase 8 - Security and Governance Hardening
Scope:
- field-level masking policies
- signed URL and secure artifact access
- elevated admin audit visibility
- anomaly and session controls

Acceptance:
- security checklist pass against role and tenant attack scenarios

## Phase 9 - Scale Readiness
Scope:
- move heavy photo/render jobs to queue workers
- object storage for media
- distributed rate limiting/session controls
- baseline load tests and SLO reporting

Acceptance:
- validated concurrency envelope
- no critical bottleneck in intake and approval paths

## Build Priorities (Immediate)
1. Entity-aware intake campaign engine
2. Photo capture intelligence and upload fallback validation
3. Sibling and add-another-person logic
4. Review and correction console
5. Template auto-binding
6. Approval engine
7. Print production queue
8. Field-level security controls
9. Optional payment
10. Digital ID and QR scan

## Suggested Technical Workstreams
- `Domain`: models, schema, migration, validation contracts
- `Workflow`: status engine and approval orchestration
- `Capture`: AI checks and image normalization pipeline
- `Template`: editor and token rendering engine
- `Production`: batching and print export
- `Billing`: invoices, reconciliation, reporting
- `Security`: masking, audit, signed access, governance
- `Scale`: queueing, caching, load testing, observability

## Delivery Discipline
- every phase requires:
  - API contract
  - role and tenant access tests
  - audit coverage checks
  - regression checklist entry
  - deployment note

