# SAVJAX ID Systems - Unified Identity Intake and Production OS

## 1) Product Definition
SAVJAX ID Systems is a unified institutional identity operations platform, not only an ID card generator.

The platform backbone is:
- intake
- validation
- correction
- approval
- template binding
- print production
- billing reconciliation
- dispatch and reissue lifecycle

## 2) Three Onboarding Tracks
The platform uses one shared core engine with three institution-specific tracks:
- School Identity Flow
- College Identity Flow
- Company Identity Flow

Each track must support separate:
- entity model
- intake form schema
- approval chain
- template token set
- payment logic
- lifecycle events

## 3) Master Operating Flow
1. Super Admin or Company Admin configures institution.
2. Sales person creates intake campaign and collection link.
3. Institution receives campaign link.
4. Parent or student or employee opens link.
5. OTP verification.
6. Entity-specific form completion.
7. AI-guided photo capture or validated upload fallback.
8. Data validation and quality checks.
9. Optional add sibling or add another person.
10. Draft or final submission.
11. Sales review and correction.
12. Template auto-mapping.
13. Institution approval.
14. Print production queue.
15. Billing and payment reconciliation.
16. Dispatch, issue, reissue lifecycle.

## 4) Role Model
### Super Admin
- Full platform control
- Global institution visibility
- Sensitive field governance
- Approval and print governance
- Audit and security governance

### Company Admin
- Operational control across assigned company scope
- Team, institution, approval, reporting, escalation management

### Sales Person
- Create institutions and campaigns
- Generate links
- Review and correct submissions
- Map records to templates
- Forward for approvals and print readiness
- Access to sensitive fields should be policy-controlled

### Print Ops
- Access only production-ready records and print batch controls
- No broad visibility of unrelated personal data

### Institution Admin (School/College/Company)
- Institution-side review and approval
- Class/department/team mapping
- Reissue and status tracking

### Teacher/Security/Staff
- Restricted lookup and scan operations
- QR scan, attendance and entry logs

### End Users (Parent/Student/Employee)
- Access only own records and dependent records

## 5) Institution-Specific Data Design
### School
Hierarchy:
- School
- Academic Year
- Class
- Section
- Student
- Parent/Guardian
- Sibling Link

Key fields:
- student details, class/section/roll/admission, DOB, blood group
- parent contacts and emergency contacts
- address and optional transport/house/division
- academic year, photo, optional barcode/RFID/QR ID

Special behavior:
- add sibling
- add another child
- household data reuse

### College
Hierarchy:
- College
- Academic Year/Semester
- Department
- Course/Program
- Year/Division
- Student

Key fields:
- enrollment and academic context
- student contacts and emergency details
- hostel/day scholar and validity/batch
- photo

Capture pattern:
- self-submission by student
- OTP and optional email verification

### Company
Hierarchy:
- Company
- Branch/Location
- Department
- Employee
- optional Contractor/Visitor later

Key fields:
- employee ID, designation, manager, branch, department
- contacts and emergency details
- joining date, validity/access level, badge category
- photo

Workflow pattern:
- self-fill or HR-assisted intake
- optional HR/department approvals

## 6) Intake Campaign Engine
Sales-created campaign links must support:
- institution type
- campaign metadata
- academic year/batch/department/branch context
- expiry and submission limits
- approval owner
- template binding
- payment toggle
- sibling toggle
- draft toggle
- photo rules (mandatory capture, upload fallback)

## 7) AI-Guided Photo System
### Pre-capture checks
- single face detection
- framing and centering
- lighting and blur checks
- glare, tilt, distance checks
- background suitability

### Prompting
- move closer
- increase light
- center face
- remove extra person
- hold still
- retake guidance

### Post-capture
- auto crop and alignment
- brightness/contrast normalization
- background handling
- export to print-safe dimensions

## 8) Submission and State Machine
Required status model:
- Draft
- Submitted
- Validation Failed
- Under Review
- Sales Corrected
- Awaiting Institution Approval
- Approved for Design
- Design Ready
- Approved for Print
- In Print Queue
- Printed
- Dispatched
- Issued
- Reissue Requested
- Reissued
- Rejected
- On Hold

## 9) Template Auto-Binding
Template editing is one-to-many.
- Template edited once
- Records auto-populate using tokens
- Student-level manual editing is exception-only

Template studio requirements:
- drag/drop layers
- front/back layout
- QR and barcode slots
- token mapping and overflow controls
- versioning and approval snapshots

## 10) Approval Engine
Approval chain must be configurable by institution type.

Actions:
- approve
- reject
- send back
- partial approve
- bulk approve
- comments with audit stamp

## 11) Payment Model
Payment is optional and campaign-configurable.

Use cases:
- per-card charge
- reissue fee
- onboarding and institutional settlement
- partial and offline reconciliation

## 12) Print Production Handoff
Print Ops should receive:
- approved records only
- batch context
- front/back preview
- print-safe exports
- queue and reprint controls

Print Ops should not have unrestricted intake editing rights.

## 13) Color Management Policy
System should implement controlled print consistency, not impossible zero-difference promises.

Target capabilities:
- soft-proof preview
- ICC-aware workflow
- print-safe palette warnings
- calibration templates

## 14) Security and Data Sovereignty
Mandatory controls:
- strict tenant isolation
- RBAC and field-level masking
- encryption in transit and at rest
- signed file access
- OTP throttling and session revocation
- audit logging for sensitive access and actions
- export restrictions and watermarking policy when required

Sensitive fields include:
- phone
- email
- address
- emergency contacts
- payment records
- identity proof artifacts

## 15) Scale Path
Immediate target:
- reliable operation for 100k identities

Future path:
- modular monolith + workers
- split heavy services (photo/render/notification/print/billing)
- eventually event-driven service architecture

Scaling principles:
- object storage for assets
- async workers for heavy jobs
- queue-based rendering and print generation
- tenant-aware partition and sharding strategy
- separate transactional and analytics workloads

## 16) Strategic Product Modules
1. Institution Registry
2. Intake Campaign Engine
3. Smart Data Collection App
4. Data Review and Correction Console
5. Template Studio
6. Workflow and Approval Engine
7. Production Engine
8. Reporting and Billing
9. Digital ID and Scan Layer

## 17) Operating Principle
The platform shall be positioned as:

Unified institutional identity intake, approval, design, and production operating system for schools, colleges, and companies.

