export interface InvitedFunctionRsvp {
  id: string;
  name: string;
  dateTime: string;
  venue: string;
  rsvpStatus: 'yes' | 'no' | 'maybe' | 'no_response';
  partySize: number;
  vegCount: number;
  nonvegCount: number;
  dietaryNotes: string | null;
  respondedAt: string | null;
}

export interface PublicRsvpLookupResponse {
  household: {
    name: string;
    expectedPartySize: number;
  };
  wedding: {
    title: string;
    coupleNames: string;
    timezone: string;
  };
  functions: InvitedFunctionRsvp[];
}

export interface RsvpSubmissionItem {
  functionId: string;
  status: 'yes' | 'no' | 'maybe';
  partySize: number;
  vegCount: number;
  nonvegCount: number;
  dietaryNotes?: string | null;
}

export interface SubmitRsvpPayload {
  responses: RsvpSubmissionItem[];
}

