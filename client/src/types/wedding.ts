export interface Wedding {
  id: string;
  plannerId: string;
  title: string;
  coupleNames: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeddingFunction {
  id: string;
  weddingId: string;
  name: string;
  dateTime: string;
  venue: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWeddingInput {
  title: string;
  coupleNames: string;
  startDate: string;
  endDate: string;
}

export interface CreateFunctionInput {
  name: string;
  dateTime: string;
  venue: string;
}

export interface FunctionInvitationHousehold {
  id: string;
  name: string;
  primaryContactName: string;
  phone: string;
  expectedPartySize: number;
  notes: string | null;
  invited: boolean;
  rsvpStatus: 'yes' | 'no' | 'maybe' | null;
  rsvpPartySize: number | null;
}

