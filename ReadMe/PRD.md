# Product Requirements Document (PRD)

**Product Name:** Zero-Day Atlas

---

## 1. Objective

Build a centralized platform to:
- Log and track zero-day vulnerabilities
- Assess risk and prioritize remediation
- Enable cross-team collaboration (Security + Dev + Ops + PMs)
- Provide real-time visibility via dashboards and reports

---

## 2. Problem Statement

Organizations lack a unified system to:
- Track zero-day vulnerabilities in real time
- See the status for a Zero-Day across multiple products within Planview
- Standardize assessment and triage
- Ensure timely remediation (SLA adherence)
- Maintain audit trails and reporting

This leads to:
- Delayed response times
- Poor visibility into risk
- Inefficient communication across teams

---

## 3. Target Users

### Primary Users
- Security Engineers
- Developers
- DevOps Engineers
- CloudOps Engineers

### Secondary Users
- Security Managers
- Development Managers
- Product Managers
- Compliance / Audit Teams
- Executives (read-only dashboards)

---

## 4. Goals & Success Metrics

### Goals
- Reduce Mean Time to Remediate (MTTR)
- Improve SLA compliance
- Increase visibility of active zero-days
- Standardize vulnerability lifecycle

### KPIs
| KPI | Description |
|-----|-------------|
| MTTR reduction (%) | Percentage reduction in mean time to remediate |
| SLA compliance rate | % vulnerabilities resolved within SLA |
| Active zero-days | Number of active zero-days at any given time |
| Detection → triage time | Time elapsed from detection to triage |
| Reopen rate | Rate of issues reopened after verification |

---

## 5. User Workflow (Lifecycle)

```
1. Log Vulnerability
2. Impact Assessment
3. Triage
4. Task Creation
5. Remediation
6. Verification
7. Closure
8. Dashboard & Reporting
```

---

## 6. Functional Requirements

### 6.1 Log Vulnerability
- Create vulnerability entry with the following fields:
  - Title, description
  - Affected systems
  - Attachments
  - Zero-day flag
- Auto-generate unique ID
- Save draft & submit
- Wizard-based entry flow

### 6.2 Impact Assessment
- Input factors:
  - Exploitability
  - Business impact
  - Data sensitivity
- Auto-calculate risk score
- Suggest severity level

### 6.3 Triage
- Review and validate vulnerability
- Assign priority & owner
- Status options: New, Accepted, Rejected, Needs Info
- SLA auto-assignment

### 6.4 Task Creation
- Create remediation tasks
- Provision to attach files, snapshots in task
- Assign to developers, Cloud Ops, or Dev Ops
- Link external tools (Jira, GitHub)
- Track dependencies

### 6.5 Remediation
- Update task status
- Track progress
- SLA alerts for delays
- Activity logs

### 6.6 Verification
- Retest vulnerability
- Upload evidence
- Mark Pass / Fail
- Reopen if necessary

### 6.7 Closure
- Final approval
- Root cause documentation
- Lessons learned
- Archive audit trail

### 6.8 Dashboard
Real-time metrics:
- Active vulnerabilities
- Severity breakdown
- SLA compliance
- MTTR
- Filters (team, time, product)

### 6.9 Reports
- Predefined reports:
  - Executive summary
  - Incident reports
  - SLA compliance
- Custom report builder
- Export (PDF, CSV)
- Scheduled reports

---

## 7. Non-Functional Requirements

### Performance
- Page load < 2 seconds
- Real-time updates (< 5 sec delay)

### Scalability
- Support 100k+ vulnerabilities
- Multi-team / multi-product support

### Security
- Role-based access control (RBAC)
- Data encryption (in transit & at rest)
- Audit logs

### Availability
- 99.9% uptime

---

## 8. Roles & Permissions

| Role | Permissions |
|------|-------------|
| Security Engineers | Full lifecycle access |
| Developer | Task + remediation only |
| Manager | Dashboard + approvals |
| Admin | Full system control |

---

## 9. User Experience Requirements

- Intuitive navigation (dashboard-first)
- Kanban-style triage board
- Minimal clicks per workflow stage
- Real-time notifications
- Mobile responsiveness

---

## 10. Notifications & Alerts

### Trigger Events
- New vulnerability logged
- Task assigned
- SLA nearing breach
- Status changes

### Channels
- In-app
- Email
- Slack

---

## 11. Integrations

- Jira (task sync)
- GitHub / GitLab (code fixes)
- SIEM tools (Splunk, etc.)
- Threat intelligence feeds

---

## 12. Data Model (High-Level)

### Entities
- Vulnerability
- Assessment
- Task
- User
- Activity Log
- Report

### Key Relationships
- Vulnerability → Tasks (1:N)
- Vulnerability → Assessment (1:1)
- Task → User (N:1)

---

## 13. Assumptions

- Users have basic security knowledge
- Organizations follow SLA policies
- External tools (Jira, GitHub) are available

---

## 14. Constraints

- Must comply with security standards
- Integration dependencies may vary
- Data privacy regulations (GDPR, etc.)

---

## 15. Roadmap (Phased Delivery)

### Phase 1 (MVP)
- Vulnerability logging
- Impact assessment
- Triage
- Basic dashboard

### Phase 2
- Task management
- Remediation tracking
- Verification & closure

### Phase 3
- Reports & analytics
- Integrations
- AI-assisted insights

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Poor adoption | UX simplicity, training |
| Data inconsistency | Validation rules |
| SLA breaches | Alerts & automation |
| Integration failures | Fallback manual workflows |

---

## 17. Acceptance Criteria

### Log Vulnerability
- User can create vulnerability with required fields
- System generates unique ID

### Triage
- User can assign severity & owner
- Status updates reflect in dashboard

### Verification
- User can mark Pass/Fail
- Failed verification reopens issue

---

## 18. Future Enhancements

- AI-based vulnerability prioritization
- Automated remediation suggestions
- Predictive risk analytics
- Threat intelligence correlation
