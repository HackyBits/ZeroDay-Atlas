import { init, i } from '@instantdb/react';

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || 'ae4ae7dd-e3f2-4201-8486-ba75975c9aba';

const schema = i.schema({
  entities: {
    vulnerabilities: i.entity({
      vulnerabilityId: i.string(),
      title: i.string(),
      cveId: i.string().optional(),
      vulnerabilityType: i.string(),
      description: i.string(),
      dateDiscovered: i.string(),
      exploitAvailability: i.string(),
      source: i.string(),
      isZeroDay: i.boolean(),
      status: i.string(),
      attachments: i.json().optional(),
      remediatedAt: i.number().optional(),
      createdAt: i.number(),
      createdBy: i.string().optional(),
    }),
    assessments: i.entity({
      vulnerabilityRef: i.string(),
      affectedProducts: i.json(),
      affectedComponents: i.json(),
      subComponents: i.json(),
      versionsImpacted: i.json(),
      businessImpact: i.string(),
      dataSensitivity: i.string(),
      exposureLevel: i.string(),
      externalLink: i.string().optional(),
      cvssScore: i.number().optional(),
      riskScore: i.number(),
      suggestedSeverity: i.string(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),
    triages: i.entity({
      vulnerabilityRef: i.string(),
      severity: i.string(),
      cvssScore: i.number(),
      priority: i.string(),
      decision: i.string(),
      assignedTeam: i.string(),
      assignedOwner: i.string(),
      slaDeadline: i.string(),
      slaHours: i.number(),
      rejectionReason: i.string().optional(),
      notes: i.string().optional(),
      status: i.string(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),
    productTriages: i.entity({
      vulnerabilityRef: i.string(),   // InstantDB ID of parent vulnerability
      productName: i.string(),
      severity: i.string(),           // Critical | High | Medium | Low
      cvssScore: i.number(),
      priority: i.string(),           // P1 | P2 | P3 | P4
      decision: i.string(),           // Accept | Reject | Needs More Info
      assignedTeam: i.string(),
      assignedOwner: i.string(),
      slaDeadline: i.string(),
      slaHours: i.number(),
      rejectionReason:      i.string().optional(),
      needsMoreInfoDetails:      i.string().optional(),
      riskAcceptedJustification: i.string().optional(),
      notes: i.string().optional(),
      status: i.string(),             // New | Accepted | Rejected | Needs Info
      createdAt: i.number(),
      updatedAt: i.number(),
    }),
    productAssessments: i.entity({
      vulnerabilityRef: i.string(),     // InstantDB ID of parent vulnerability
      productName: i.string(),
      impactStatus: i.string(),         // Impacted | Not-Impacted | Unknown
      versionsImpacted: i.json(),       // string[]
      businessImpact: i.string(),       // Low | Medium | High
      dataSensitivity: i.string(),      // Public | Internal | Confidential | Restricted
      exposureLevel: i.string(),        // Internal | External | Internet-facing
      cvssScore: i.number().optional(),
      riskScore: i.number(),
      suggestedSeverity: i.string(),
      updatedAt: i.number(),
      createdAt: i.number(),
    }),
    tasks: i.entity({
      vulnerabilityRef: i.string(),   // InstantDB ID of parent vulnerability
      taskNumber: i.string(),         // e.g. TASK-001
      title: i.string(),
      description: i.string(),
      taskType: i.string(),           // Patch Development | Config Fix | Monitoring Rule | Code Review | Documentation | Other
      assignedTeam: i.string(),
      assignedOwner: i.string(),
      priority: i.string(),           // P1 | P2 | P3 | P4
      status: i.string(),             // Open | In Progress | Blocked | Ready for Review | Done
      dueDate: i.string(),
      jiraLink: i.string().optional(),
      githubLink: i.string().optional(),
      agileplacLink: i.string().optional(),
      dependencies: i.json(),         // string[] — other task IDs this depends on
      checklist: i.json(),            // { id: string; text: string; done: boolean }[]
      notes: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number(),
      createdBy: i.string().optional(),
    }),
    remediations: i.entity({
      vulnerabilityRef: i.string(),      // InstantDB ID of parent vulnerability
      productName: i.string(),
      remediationPlan: i.string(),       // Patch | Code Fix | Package Fix | Config Change | Workaround
      patchAvailable: i.boolean(),
      etaForFix: i.string(),             // ISO date string
      remediationOwner: i.string(),
      verificationMethod: i.string(),    // Test Case | Scan | Manual Validation
      fixVersion: i.string().optional(),
      completedDate: i.string().optional(),
      verificationDate: i.string().optional(),
      verificationStatus: i.string(),    // Pending | Verified | Failed
      status: i.string(),                // In Progress | Blocked | Ready for Review | Done
      resolvedAt: i.number().optional(), // Timestamp when status first set to Done (used for MTTR)
      notes: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),
  },
});

const db = init({ appId: APP_ID, schema });

export default db;
