export interface HeadcountHouseholdBreakdown {
  total: number;
  confirmed: number;
  maybe: number;
  declined: number;
  noResponse: number;
}

export interface StaleHouseholdItem {
  householdId: string;
  householdName: string;
  primaryContactName: string;
  phone: string | null;
  status: 'yes' | 'maybe';
  partySize: number;
  respondedAt: string;
  daysAgo: number;
}

export interface HeadcountData {
  functionId: string;
  functionName: string;
  weddingId: string;
  invitedCount: number; // Unit: Households
  totalInvitedHeadcount: number; // Unit: People
  confirmedHeadcount: number; // Unit: People
  vegCount: number; // Unit: Meals
  nonvegCount: number; // Unit: Meals
  maybeHeadcount: number; // Unit: People
  declinedHeadcount: number; // Unit: People
  noResponseHeadcount: number; // Unit: People
  planningEstimate: number; // Unit: People
  maybePct: number;
  staleCount: number;
  staleDays: number;
  staleHouseholds: StaleHouseholdItem[];
  households: HeadcountHouseholdBreakdown;
  formula: string;
}

