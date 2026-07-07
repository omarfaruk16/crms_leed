// The fixed set of capabilities a role can grant. Mirrored on the client.
export const PERMISSION_KEYS = [
  'canAddLead',        // create leads
  'canEditLead',       // edit existing leads
  'canDeleteLead',     // delete leads
  'canAssignLead',     // assign leads to agents, bulk re-stage
  'canImportExport',   // CSV import / export + uploads
  'canManageEvents',   // create & edit events/campaigns
  'canManageExpenses', // create/edit/delete expenses
  'canManageStages',   // add/edit/delete pipeline stages
  'canManageAccounts', // admin: accounts, password resets, roles
  'canViewAnalytics',  // analytics dashboards
  'canSeeAgents',      // view agent assignments & employee identities
];

export const ALL_PERMISSIONS = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));

export function permissionsFromList(list = []) {
  const set = new Set(list);
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, set.has(k)]));
}

// Lead visibility scope derived from account type (in addition to role perms).
//   all          -> admin / employee: every lead, agent info visible
//   all_no_agent -> owner: every lead, but agent/employee identity hidden
//   own          -> affiliate: only leads they added
export function scopeForAccountType(type) {
  if (type === 'owner') return 'all_no_agent';
  if (type === 'affiliate') return 'own';
  return 'all';
}
