export interface HeadcountHouseholdBreakdown {
  total: number;
  confirmed: number;
  maybe: number;
  declined: number;
  noResponse: number;
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
  households: HeadcountHouseholdBreakdown;
  formula: string;
}
