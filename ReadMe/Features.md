# Zero-Day Atlas — Feature Specification

---

## Logical Modules

1. Vulnerability Intake Module
2. Impact Assessment Engine
3. Triage & Prioritization
4. Remediation Tracker
5. Notification & Alerts
6. Reporting & Audit
7. Dashboard Module

---

## 1. Notifications

| Channel | Description |
|---------|-------------|
| Slack | Real-time alerts to configured channels |
| Email | Triggered notifications for key events |
| Microsoft Teams | Team-level alerts and updates |

### Trigger Events
- New zero-day logged
- Task assigned to team/owner
- SLA nearing breach
- Status changes at each lifecycle stage

### Auto-Escalation Rules
- No triage within X hours → escalate to Security Lead
- Fix not completed within SLA → notify leadership

---

## 2. Dashboard

### Views / Filters
- By Product
- By Vulnerability ID
- By Severity
- By Year
- By Status

### Key Widgets
| Widget | Description |
|--------|-------------|
| Open Vulnerabilities | Total count of active issues |
| Critical Issues | Count of critical severity items |
| Remediated | Count of resolved vulnerabilities |
| Pending Verification | Count awaiting sign-off |
| Zero-Day Active Count | Live count of unresolved zero-days |
| SLA Compliance | % resolved within deadline |
| MTTR | Mean Time to Remediate |
| Open vs Closed Trends | Historical trend chart |

### UX Elements
- Filters: team, product, time range
- Drill-down capability from summary cards
- Heatmaps / charts
- Top 5 active vulnerabilities table preview

---

## 3. Reports

### Report Types
- Executive Summary
- Zero-Day Incident Report
- SLA Compliance Report
- Trend Analysis

### Export Options
- PDF
- CSV
- API export

### UX Elements
- Custom report builder
- Scheduled reports (weekly / monthly)
- Shareable links
- Chart segments drill down to Vulnerability List

---

## 4. Integration Layer

| Integration | Purpose |
|-------------|---------|
| CVE / NVD feeds | Automated vulnerability ingestion |
| Jira | Task sync and ticket creation |
| ServiceNow | Ticketing system connector |
| Agileplace | Task linking and sync |
| GitHub / GitLab | Code fix tracking |
| SIEM tools (Splunk, etc.) | Security event correlation |
| Threat intelligence feeds | Contextual threat data |
| Product inventory | Affected product mapping |

---

## 5. Workflow

### Lifecycle Flow

```
Log Vulnerability
↓
Impact Assessment
↓
Triage Decision
↓
Task Creation
↓
Remediation
↓
Verification
↓
Closure
↓
Dashboard Updates + Reports
```

---

### 5.1 Log Vulnerability

**Actor:** Security Analyst

#### Data Fields
| Field | Type / Values |
|-------|---------------|
| Vulnerability ID | Auto-generated unique identifier |
| Zero-Day | Boolean (True / False) |
| CVE ID | String (if applicable) |
| Vulnerability Type | Enum |
| Title / Name | String |
| Description | Text |
| Date Discovered | Date |
| Exploit Availability | Enum (Yes / No / Unknown) |
| Source | Enum (internal report, CVE feed, vendor advisory) |
| Attachments | PoC screenshots, documents |

#### UX Elements
- Smart form with auto-suggestions and templates
- Severity pre-estimation (optional AI assist)
- Save Draft + Submit actions

#### System Behavior
- Assigns unique Vulnerability ID
- Auto-tags as "Zero-Day" and "Unverified"
- Triggers notifications to Security Team, Product Teams, PM Teams

---

### 5.2 Impact Assessment

**Actor:** Product Owner / Engineer

#### Data Fields
| Field | Type / Values |
|-------|---------------|
| Affected Products | Multi-select from product catalog |
| Impact Status | Enum (Impacted, Not-Impacted, Unknown) |
| Affected Components | OS, library, language, runtime, infra, tech stack |
| Sub-Components | Nested component selection |
| Version(s) Impacted | Multi-select |
| Business Impact | Enum (High / Medium / Low) |
| Data Sensitivity | Text / Enum |
| Exposure Level | Enum (Internet-facing, Internal, External) |
| External Link | URL |

#### UX Elements
- Sliders or guided scoring inputs
- Visual risk meter
- "What-if" simulation (optional advanced feature)

#### System Behavior
- Calculates Risk Score (CVSS-like)
- Suggests severity: Critical / High / Medium / Low

---

### 5.3 Triage

**Actor:** Security Analyst

#### Data Fields
| Field | Type / Values |
|-------|---------------|
| Severity | Enum (Critical / High / Medium / Low) |
| CVSS Score | Numeric |
| Priority | Enum (P1 – P4) |
| Risk Score | Calculated |
| Decision | Enum (Fix Now, Monitor, Accept Risk) |
| Assigned Team / Owner | User/Team reference |
| Status | Enum (Open, In Progress, Remediated, Verified, Closed) |

#### Decision Paths
- **Accept** → Move to remediation
- **Reject** → Close with reason
- **Needs More Info** → Send back to reporter

#### UX Elements
- Kanban-style triage board
- Filters: severity, system, team

#### System Behavior
- Assigns owner / team
- Sets SLA deadlines based on severity

---

### 5.4 Task Creation

**Actor:** Product Owner / Engineer

#### Task Types
- Patch development
- Config fix
- Monitoring rule

#### UX Elements
- Task checklist
- Dependency mapping
- Auto-assignment rules

#### System Behavior
- Creates linked tickets per product
- Syncs with external tools (Jira, Agileplace)
- Sends notifications to assigned teams

---

### 5.5 Remediation

**Actor:** Assigned Engineer

#### Data Fields
| Field | Type / Values |
|-------|---------------|
| Remediation Plan | Enum (patch, config change, workaround) |
| Patch Available | Boolean |
| ETA for Fix | Date |
| Remediation Owner | User reference |
| Verification Method | Test case, scan, manual validation |
| Completed Date | Date |
| Fix Version | String |
| Verification Date | Date |
| Verification Status | Enum (Pending, Verified, Failed) |

#### User Actions
- Update status: In Progress / Blocked / Ready for Review
- Upload evidence (logs, screenshots)

#### System Behavior
- Tracks time-to-fix
- Sends SLA alerts if delayed

---

### 5.6 Verification

**Actor:** Security Analyst

#### User Actions
- Re-test vulnerability
- Validate fix / attempt exploit again
- Add closure notes (root cause, lessons learned)

#### Outcomes
- **Fixed** → Move to Closure
- **Not Fixed** → Reopen task

#### UX Elements
- Test case checklist
- Evidence upload
- Pass / Fail toggle

#### System Behavior
- Logs verification evidence
- Updates risk status

---

### 5.7 Closure

**Actor:** Compliance Officer

#### User Actions
- Review audit notes and regulatory impact
- Add references and attachments
- Approve closure

#### System Behavior
- Status changes to Closed
- Record archived for audit
- Available in reports

---

## 6. Audit & Compliance

| Field | Type / Values |
|-------|---------------|
| Log ID | UUID |
| Regulatory Impact | Enum (PCI, HIPAA, GDPR, etc.) |
| Mitigation Notes | Text |
| References / Links | Vendor advisories, CVE details |
| Attachments | Logs, screenshots, reports |

---

## 7. User Roles & Permissions (RBAC)

| Role | Responsibilities |
|------|-----------------|
| Security Analyst | Logs vulnerabilities, performs triage, runs verification |
| Product Owner / Engineer | Assesses impact, creates remediation tasks |
| Compliance Officer | Reviews audit, approves closure |
| Executive / Manager | Views reports and dashboard (read-only) |
| Admin | Full system control, user management |

---

## 8. UI Screens

### 8.1 Dashboard
- Top Nav: Logo, search bar, notifications, user profile dropdown
- Sidebar: Dashboard, Vulnerabilities, Products, Reports, Settings
- Summary cards (Open, Critical, Remediated, Pending Verification)
- Trend graph (vulnerabilities over time)
- Top 5 active vulnerabilities table with severity badges

### 8.2 Vulnerability List
- Filters: Severity, Status, Product, Date range
- Table columns: ID, CVE ID, Title, Severity (color-coded badge), Status, Assigned Team, Last Updated
- Row click → Vulnerability Detail
- "+ New Vulnerability" button

### 8.3 Vulnerability Detail
- Header: ID + Title + Severity badge
- Tabs:
  - **Overview**: Description, CVE ID, Source, Discovery Date
  - **Impact**: Affected Products, Components, Versions
  - **Triage**: Severity, CVSS Score, Priority, Assigned Team
  - **Remediation**: Plan, ETA, Owner, Verification Method
  - **Audit**: Regulatory Impact, References, Attachments
- Action buttons: Edit, Assign, Change Status
- Attachments open in modal

### 8.4 New Vulnerability Form (Step-by-Step Wizard)
| Step | Section |
|------|---------|
| 1 | General Metadata |
| 2 | Impact & Scope |
| 3 | Triage |
| 4 | Remediation Plan |
| 5 | Audit & Compliance |

- Controls: text fields, dropdowns, multi-select, date pickers, file upload
- Actions: Save Draft, Submit, Cancel

### 8.5 Reports Screen
- Filters: date range, severity, product
- Charts:
  - Vulnerabilities by Severity (pie chart)
  - Vulnerabilities by Product (bar chart)
  - Remediation SLA compliance (line chart)
- Export: PDF, CSV
- Chart segments drill down to Vulnerability List

### 8.6 Settings
- User Management (roles, permissions)
- Product Catalog (add/edit products)
- Integration Settings (ticketing, feeds)
- Notification Preferences

### Navigation Flow
```
Dashboard → Vulnerability List → Vulnerability Detail → Edit / Remediate
Dashboard → Reports → Drill Down → Vulnerability List
Sidebar → Settings → Manage Products / Users
```

---

## 9. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Performance | < 2 sec page load (8 products × 100 vulns) |
| Scalability | 500+ vulnerabilities over time |
| Security | SSO (Azure AD), RBAC, data encryption at rest |
| Availability | 99.5% uptime (internal tool) |
| Tech Constraints | Deployable on AWS / Azure / GCP or on-prem |

---

## 10. Advanced Features

- AI-based impact prediction
- Risk scoring engine
- Knowledge base (past vulnerabilities & fixes)
- "What-if" simulation for risk assessment
- Severity pre-estimation via AI assist
- Auto-escalation rules based on SLA breach
- Scheduled and shareable reports
