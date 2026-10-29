export interface CheckinSummary {
  totalCheckedInGuests: number;
  totalCheckedInHouseholds: number;
  walkinGuests: number;
  walkinCount: number;
  confirmedHeadcount: number;
  invitedHeadcount: number;
}

export interface CheckinDetailItem {
  id: string;
  weddingId: string;
  functionId: string;
  householdId: string | null;
  householdName: string | null;
  primaryContactName: string | null;
  phone: string | null;
  guestName: string;
  actualPartySize: number;
  isWalkin: boolean;
  notes: string | null;
  checkedInAt: string;
  rsvpStatus: 'yes' | 'no' | 'maybe' | null;
  rsvpPartySize: number | null;
}

export interface InvitedHouseholdCheckinStatus {
  householdId: string;
  householdName: string;
  primaryContactName: string;
  phone: string | null;
  expectedPartySize: number;
  notes: string | null;
  rsvpStatus: 'yes' | 'no' | 'maybe' | null;
  rsvpPartySize: number | null;
  isCheckedIn: boolean;
  checkinId: string | null;
  actualPartySize: number | null;
  checkedInAt: string | null;
}

export interface FunctionCheckinOverview {
  functionId: string;
  functionName: string;
  functionVenue: string;
  weddingId: string;
  weddingTitle: string;
  summary: CheckinSummary;
  checkins: CheckinDetailItem[];
  invitedHouseholds: InvitedHouseholdCheckinStatus[];
}

export interface RecordCheckinPayload {
  clientGeneratedId?: string;
  householdId?: string | null;
  guestName?: string;
  actualPartySize: number;
  isWalkin?: boolean;
  notes?: string | null;
}

export interface UpdateCheckinPayload {
  actualPartySize?: number;
  guestName?: string;
  notes?: string | null;
}

