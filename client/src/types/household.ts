export interface Household {
  id: string;
  weddingId: string;
  name: string;
  primaryContactName: string;
  phone: string;
  expectedPartySize: number;
  inviteToken: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHouseholdInput {
  name: string;
  primaryContactName: string;
  phone: string;
  expectedPartySize: number;
  notes?: string;
}
