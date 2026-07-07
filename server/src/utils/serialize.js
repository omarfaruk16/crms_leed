// Shared row -> API shape helpers. Money is stored as cents; expose dollars.
export const centsToDollars = (c) => (c == null ? 0 : Number(c) / 100);
export const dollarsToCents = (d) => Math.round((Number(d) || 0) * 100);

// hideAgent=true blanks out agent identity (owners must not see who is assigned).
export function leadOut(r, hideAgent = false) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    address: r.address,
    budget: centsToDollars(r.budget_cents),
    field: r.field,
    source: r.source,
    score: r.score,
    priority: r.priority,
    tags: r.tags || [],
    photoUrl: r.photo_url,
    stageId: r.stage_id,
    stageName: r.stage_name,
    stageColor: r.stage_color,
    isWon: r.stage_is_won ?? undefined,
    agentId: hideAgent ? null : r.agent_id,
    agentName: hideAgent ? null : r.agent_name,
    eventId: r.event_id,
    eventName: r.event_name,
    expenseId: r.expense_id,
    expenseTitle: r.expense_title,
    addedBy: hideAgent ? null : r.added_by,
    addedByName: hideAgent ? null : r.added_by_name,
    followUpAt: r.follow_up_at,
    wonAt: r.won_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    activityCount: r.activity_count != null ? Number(r.activity_count) : undefined,
  };
}

export function accountOut(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    accountType: r.account_type,
    roleId: r.role_id,
    roleName: r.role_name,
    company: r.company,
    phone: r.phone,
    avatarUrl: r.avatar_url,
    commission: centsToDollars(r.commission_cents),
    isActive: r.is_active,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
  };
}

export function eventOut(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    location: r.location,
    coverUrl: r.cover_url,
    eventDate: r.event_date,
    leadTarget: r.lead_target,
    createdAt: r.created_at,
    leadCount: r.lead_count != null ? Number(r.lead_count) : undefined,
    wonCount: r.won_count != null ? Number(r.won_count) : undefined,
    spend: r.spend_cents != null ? centsToDollars(Number(r.spend_cents)) : undefined,
  };
}

export function expenseOut(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    field: r.field,
    amount: centsToDollars(r.amount_cents),
    periodFrom: r.period_from,
    periodTo: r.period_to,
    eventId: r.event_id,
    eventName: r.event_name,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    leadCount: r.lead_count != null ? Number(r.lead_count) : undefined,
    wonCount: r.won_count != null ? Number(r.won_count) : undefined,
  };
}
