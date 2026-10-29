import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Users,
  Utensils,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Edit3,
  Clock,
  X,
  Check,
  HeartHandshake,
} from 'lucide-react';
import { getInvitationByToken, submitRsvpApi } from '../../api/rsvp';
import { PublicRsvpLookupResponse, RsvpSubmissionItem } from '../../types/rsvp';

interface FunctionFormState {
  functionId: string;
  status: 'yes' | 'no' | 'maybe' | '';
  partySize: number;
  vegCount: number;
  nonvegCount: number;
  dietaryNotes: string;
  touched: boolean;
}

export const GuestRsvpPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<PublicRsvpLookupResponse | null>(null);

  // Form states keyed by functionId
  const [formResponses, setFormResponses] = useState<Record<string, FunctionFormState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [hasExistingReplies, setHasExistingReplies] = useState(false);

  // Load invitation details by token
  useEffect(() => {
    if (!token) {
      setErrorMsg('No invitation token provided. Please check your link.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    getInvitationByToken(token)
      .then((data) => {
        if (!isMounted) return;
        setInvitationData(data);

        // Prepopulate form responses
        const initialStates: Record<string, FunctionFormState> = {};
        let anyResponded = false;

        data.functions.forEach((fn) => {
          const defaultStatus: 'yes' | 'no' | 'maybe' | '' =
            fn.rsvpStatus === 'yes' || fn.rsvpStatus === 'no' || fn.rsvpStatus === 'maybe'
              ? fn.rsvpStatus
              : '';
          const hasReplied = defaultStatus !== '';
          if (hasReplied) anyResponded = true;

          const defaultParty = hasReplied
            ? fn.partySize
            : data.household.expectedPartySize || 1;
          const defaultVeg = hasReplied ? fn.vegCount : defaultParty;
          const defaultNonveg = hasReplied ? fn.nonvegCount : 0;

          initialStates[fn.id] = {
            functionId: fn.id,
            status: defaultStatus,
            partySize: defaultStatus === 'no' ? 0 : defaultParty,
            vegCount: defaultStatus === 'no' ? 0 : defaultVeg,
            nonvegCount: defaultStatus === 'no' ? 0 : defaultNonveg,
            dietaryNotes: fn.dietaryNotes || '',
            touched: false,
          };
        });

        setFormResponses(initialStates);
        setHasExistingReplies(anyResponded);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Unable to load invitation details.';
        setErrorMsg(msg);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Update a single field in a function's response state
  const handleUpdate = (
    functionId: string,
    updates: Partial<FunctionFormState>
  ) => {
    setFormResponses((prev) => {
      const current = prev[functionId];
      if (!current) return prev;

      const next = { ...current, ...updates, touched: true };

      // When switching to 'no', partySize and meals automatically become 0
      if (updates.status === 'no') {
        next.partySize = 0;
        next.vegCount = 0;
        next.nonvegCount = 0;
      } else if (updates.status === 'yes' && current.partySize === 0) {
        // Restore party size if it was 0
        const defaultParty = invitationData?.household.expectedPartySize || 1;
        next.partySize = defaultParty;
        next.vegCount = defaultParty;
        next.nonvegCount = 0;
      }

      return {
        ...prev,
        [functionId]: next,
      };
    });
  };

  // Helper: auto-balance non-veg when party size changes
  const handlePartySizeChange = (functionId: string, newPartySize: number) => {
    const clamped = Math.max(0, Math.min(50, newPartySize));
    setFormResponses((prev) => {
      const current = prev[functionId];
      if (!current) return prev;

      // Adjust vegCount and nonvegCount to stay within new party size
      let newVeg = current.vegCount;
      let newNonveg = current.nonvegCount;

      if (newVeg + newNonveg !== clamped) {
        // Default to all veg if mismatch
        newVeg = clamped;
        newNonveg = 0;
      }

      return {
        ...prev,
        [functionId]: {
          ...current,
          partySize: clamped,
          vegCount: newVeg,
          nonvegCount: newNonveg,
          touched: true,
        },
      };
    });
  };

  // Validation checker for the entire form
  const getValidationErrors = (): string[] => {
    if (!invitationData) return ['Invitation details missing'];

    const errors: string[] = [];

    invitationData.functions.forEach((fn) => {
      const resp = formResponses[fn.id];
      if (!resp || !resp.status) {
        errors.push(`Please choose an answer for "${fn.name}"`);
        return;
      }

      if (resp.status === 'yes') {
        if (resp.partySize < 1) {
          errors.push(`Party size for "${fn.name}" must be at least 1`);
        }
        if (resp.vegCount + resp.nonvegCount !== resp.partySize) {
          errors.push(
            `In "${fn.name}", Vegetarian (${resp.vegCount}) + Non-Vegetarian (${resp.nonvegCount}) must equal total attending guests (${resp.partySize})`
          );
        }
      } else if (resp.status === 'maybe') {
        if (resp.partySize > 0 && resp.vegCount + resp.nonvegCount !== resp.partySize) {
          errors.push(
            `In "${fn.name}", estimated meals (${resp.vegCount + resp.nonvegCount}) must equal estimated guests (${resp.partySize})`
          );
        }
      }
    });

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !invitationData) return;

    setSubmitError(null);

    // Mark all as touched to display validation indicators
    setFormResponses((prev) => {
      const next: Record<string, FunctionFormState> = {};
      Object.keys(prev).forEach((k) => {
        next[k] = { ...prev[k], touched: true };
      });
      return next;
    });

    const errors = getValidationErrors();
    if (errors.length > 0) {
      setSubmitError(errors[0]);
      // Scroll to the top or the first error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const payloadResponses: RsvpSubmissionItem[] = invitationData.functions.map((fn) => {
      const resp = formResponses[fn.id];
      return {
        functionId: fn.id,
        status: resp.status as 'yes' | 'no' | 'maybe',
        partySize: resp.status === 'no' ? 0 : resp.partySize,
        vegCount: resp.status === 'no' ? 0 : resp.vegCount,
        nonvegCount: resp.status === 'no' ? 0 : resp.nonvegCount,
        dietaryNotes: resp.dietaryNotes.trim() ? resp.dietaryNotes.trim() : null,
      };
    });

    setIsSubmitting(true);
    try {
      await submitRsvpApi(token, { responses: payloadResponses });
      setIsSubmittedSuccess(true);
      setHasExistingReplies(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit your RSVP. Please try again.';
      setSubmitError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-rose-50/40 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl shadow-rose-900/5 border border-rose-100 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 mb-4 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Loading Invitation...</h2>
          <p className="text-slate-500 text-sm mt-1">Preparing your wedding functions and RSVP details.</p>
        </div>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (errorMsg || !invitationData) {
    return (
      <div className="min-h-screen bg-rose-50/40 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl shadow-rose-900/5 border border-rose-100 p-8 sm:p-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Invitation Unavailable</h2>
          <p className="text-slate-600 text-sm mt-3 leading-relaxed">
            {errorMsg || 'We were unable to locate your invitation. The private link may have expired or been regenerated.'}
          </p>
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-800 mb-1">What can I do?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Make sure you opened the complete link shared via WhatsApp or message.</li>
              <li>Contact the couple or wedding planner to request an updated invite link.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const { household, wedding, functions } = invitationData;

  // 3. Confirmation View (after submission or when user reviews confirmation)
  if (isSubmittedSuccess) {
    return (
      <div className="min-h-screen bg-rose-50/40 py-8 px-4 sm:px-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Success Banner */}
          <div className="bg-white rounded-3xl shadow-xl shadow-rose-900/5 border border-emerald-100 p-6 sm:p-8 text-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 mb-4 shadow-sm border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              RSVP Recorded!
            </h1>
            <p className="text-emerald-800 font-medium text-sm mt-1">
              Thank you, {household.name}!
            </p>
            <p className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed">
              Your response for <span className="font-semibold text-slate-800">{wedding.coupleNames}&apos;s</span> wedding celebrations has been safely saved.
            </p>
          </div>

          {/* Response Summary Cards */}
          <div className="bg-white rounded-3xl shadow-xl shadow-rose-900/5 border border-rose-100 p-6 sm:p-8 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-500" />
              Summary of Your Responses
            </h2>

            <div className="space-y-3 pt-2">
              {functions.map((fn) => {
                const resp = formResponses[fn.id];
                const dateObj = new Date(fn.dateTime);
                const formattedDate = dateObj.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                const formattedTime = dateObj.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={fn.id}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-2 text-xs sm:text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">{fn.name}</h3>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {formattedDate} • {formattedTime}
                        </p>
                        {fn.venue && (
                          <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {fn.venue}
                          </p>
                        )}
                      </div>

                      {resp?.status === 'yes' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3" /> Attending ({resp.partySize})
                        </span>
                      )}
                      {resp?.status === 'no' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                          <X className="w-3 h-3" /> Declined
                        </span>
                      )}
                      {resp?.status === 'maybe' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" /> Maybe ({resp.partySize || '0'})
                        </span>
                      )}
                    </div>

                    {resp?.status === 'yes' && (
                      <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-3 text-xs text-slate-600">
                        <span>🌱 <strong>{resp.vegCount}</strong> Veg</span>
                        <span>🍗 <strong>{resp.nonvegCount}</strong> Non-Veg</span>
                        {resp.dietaryNotes && (
                          <span className="w-full text-slate-500 italic">
                            Note: &ldquo;{resp.dietaryNotes}&rdquo;
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsSubmittedSuccess(false)}
                className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 text-rose-700 font-semibold text-sm hover:bg-rose-100 active:scale-[0.99] transition-all flex items-center justify-center gap-2 border border-rose-200 shadow-sm"
              >
                <Edit3 className="w-4 h-4" />
                Edit or Change Responses
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Main RSVP Form View
  return (
    <div className="min-h-screen bg-rose-50/40 py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Wedding & Household Invitation Header */}
        <header className="bg-white rounded-3xl shadow-xl shadow-rose-900/5 border border-rose-100 p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mb-3 shadow-sm border border-rose-100">
            <HeartHandshake className="w-7 h-7" />
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-rose-600">
            Wedding Invitation
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            {wedding.coupleNames}
          </h1>
          {wedding.title && (
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">{wedding.title}</p>
          )}

          <div className="mt-4 pt-4 border-t border-rose-50 flex flex-col items-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Invited: {household.name}
            </div>
            {household.expectedPartySize > 0 && (
              <p className="text-slate-500 text-xs mt-1">
                Reserved for up to <span className="font-semibold text-slate-700">{household.expectedPartySize} guests</span>
              </p>
            )}
          </div>

          {/* Return-to-edit banner */}
          {hasExistingReplies && (
            <div className="mt-4 p-3 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>You previously submitted an RSVP. You can update your answers below anytime.</span>
            </div>
          )}
        </header>

        {/* Global Error Banner */}
        {submitError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs sm:text-sm flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Please check your responses:</p>
              <p className="mt-0.5">{submitError}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Select Your Attendance ({functions.length} {functions.length === 1 ? 'Event' : 'Events'})
              </h2>
              <span className="text-xs text-slate-500">All events required</span>
            </div>

            {functions.map((fn, idx) => {
              const resp = formResponses[fn.id] || {
                functionId: fn.id,
                status: '',
                partySize: 1,
                vegCount: 1,
                nonvegCount: 0,
                dietaryNotes: '',
                touched: false,
              };

              const dateObj = new Date(fn.dateTime);
              const formattedDate = dateObj.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const formattedTime = dateObj.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              });

              const isMealMatch =
                resp.status === 'yes'
                  ? resp.vegCount + resp.nonvegCount === resp.partySize
                  : true;

              return (
                <div
                  key={fn.id}
                  className={`bg-white rounded-3xl shadow-xl shadow-rose-900/5 border transition-all p-5 sm:p-6 space-y-5 ${
                    resp.status === 'yes'
                      ? 'border-emerald-200'
                      : resp.status === 'no'
                      ? 'border-slate-200'
                      : resp.status === 'maybe'
                      ? 'border-amber-200'
                      : 'border-rose-100'
                  }`}
                >
                  {/* Event Details */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 mb-1">
                        <span className="w-5 h-5 rounded-full bg-rose-50 text-rose-600 inline-flex items-center justify-center text-[11px] font-bold">
                          {idx + 1}
                        </span>
                        <span>Wedding Event</span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                        {fn.name}
                      </h3>
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                        <p className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formattedDate} at {formattedTime}</span>
                        </p>
                        {fn.venue && (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{fn.venue}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Attendance Selector (Yes / No / Maybe) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Will you attend? <span className="text-rose-500">*</span>
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      {/* Yes Button */}
                      <button
                        type="button"
                        onClick={() => handleUpdate(fn.id, { status: 'yes' })}
                        className={`min-h-[48px] py-2.5 px-2 rounded-2xl border text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all ${
                          resp.status === 'yes'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span>Attending</span>
                      </button>

                      {/* No Button */}
                      <button
                        type="button"
                        onClick={() => handleUpdate(fn.id, { status: 'no' })}
                        className={`min-h-[48px] py-2.5 px-2 rounded-2xl border text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all ${
                          resp.status === 'no'
                            ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-900/20'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <X className="w-4 h-4 flex-shrink-0" />
                        <span>Decline</span>
                      </button>

                      {/* Maybe Button */}
                      <button
                        type="button"
                        onClick={() => handleUpdate(fn.id, { status: 'maybe' })}
                        className={`min-h-[48px] py-2.5 px-2 rounded-2xl border text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all ${
                          resp.status === 'maybe'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>Tentative</span>
                      </button>
                    </div>

                    {resp.touched && !resp.status && (
                      <p className="text-xs text-rose-600 font-medium mt-1">
                        Please choose one of the options above.
                      </p>
                    )}
                  </div>

                  {/* Attending Details Section (Shown when status is 'yes') */}
                  {resp.status === 'yes' && (
                    <div className="pt-4 border-t border-slate-100 space-y-4 animate-in fade-in duration-200">
                      {/* Party Size Stepper */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            Attending Party Size
                          </label>
                          <span className="text-xs text-slate-500">
                            (max 50)
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handlePartySizeChange(fn.id, resp.partySize - 1)}
                            disabled={resp.partySize <= 1}
                            className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center border border-slate-200"
                            aria-label="Decrease party size"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            inputMode="numeric"
                            value={resp.partySize}
                            onChange={(e) =>
                              handlePartySizeChange(fn.id, parseInt(e.target.value, 10) || 1)
                            }
                            className="flex-1 h-11 text-center font-bold text-lg rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                            aria-label="Party size number"
                          />
                          <button
                            type="button"
                            onClick={() => handlePartySizeChange(fn.id, resp.partySize + 1)}
                            disabled={resp.partySize >= 50}
                            className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center border border-slate-200"
                            aria-label="Increase party size"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Dietary Preferences (Veg & Non-Veg) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Utensils className="w-3.5 h-3.5 text-slate-500" />
                            Meal Preferences
                          </label>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isMealMatch
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                            }`}
                          >
                            {isMealMatch
                              ? `✓ ${resp.partySize} of ${resp.partySize} accounted for`
                              : `⚠️ Total: ${resp.vegCount + resp.nonvegCount} / ${resp.partySize}`}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Vegetarian Input */}
                          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                            <label className="block text-xs font-semibold text-emerald-900 mb-1">
                              🌱 Vegetarian
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={resp.partySize}
                              inputMode="numeric"
                              value={resp.vegCount}
                              onChange={(e) => {
                                const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                                handleUpdate(fn.id, { vegCount: v });
                              }}
                              className="w-full h-10 px-3 font-bold text-base rounded-xl border border-emerald-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-center"
                            />
                          </div>

                          {/* Non-Vegetarian Input */}
                          <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-100">
                            <label className="block text-xs font-semibold text-amber-900 mb-1">
                              🍗 Non-Vegetarian
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={resp.partySize}
                              inputMode="numeric"
                              value={resp.nonvegCount}
                              onChange={(e) => {
                                const nv = Math.max(0, parseInt(e.target.value, 10) || 0);
                                handleUpdate(fn.id, { nonvegCount: nv });
                              }}
                              className="w-full h-10 px-3 font-bold text-base rounded-xl border border-amber-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-center"
                            />
                          </div>
                        </div>

                        {!isMealMatch && (
                          <p className="text-xs text-rose-600 font-medium">
                            {resp.vegCount + resp.nonvegCount < resp.partySize
                              ? `Please allocate ${resp.partySize - (resp.vegCount + resp.nonvegCount)} more meal(s) between Veg and Non-Veg.`
                              : `Meal count (${resp.vegCount + resp.nonvegCount}) exceeds attending guests (${resp.partySize}) by ${resp.vegCount + resp.nonvegCount - resp.partySize}.`}
                          </p>
                        )}
                      </div>

                      {/* Dietary Notes */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Special Dietary Requests or Notes (Optional)
                          </label>
                          <span className="text-[11px] text-slate-400">
                            {resp.dietaryNotes.length}/500
                          </span>
                        </div>
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={resp.dietaryNotes}
                          onChange={(e) =>
                            handleUpdate(fn.id, { dietaryNotes: e.target.value })
                          }
                          placeholder="e.g. Jain food required, nut allergy, high chair for toddler..."
                          className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Tentative Details Section (Shown when status is 'maybe') */}
                  {resp.status === 'maybe' && (
                    <div className="pt-4 border-t border-slate-100 space-y-3 animate-in fade-in duration-200 text-xs text-slate-600">
                      <p className="leading-relaxed bg-amber-50/70 p-3 rounded-2xl border border-amber-100 text-amber-900">
                        We will hold tentative capacity for you. You can update this response closer to the wedding date.
                      </p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Estimated attending guests (if known):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          inputMode="numeric"
                          value={resp.partySize}
                          onChange={(e) =>
                            handlePartySizeChange(fn.id, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-24 h-10 text-center font-bold text-base rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                      </div>

                      {resp.partySize > 0 && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                              Estimated Veg
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={resp.vegCount}
                              onChange={(e) =>
                                handleUpdate(fn.id, {
                                  vegCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                                })
                              }
                              className="w-full h-9 text-center font-bold text-sm rounded-xl border border-slate-200 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                              Estimated Non-Veg
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={resp.nonvegCount}
                              onChange={(e) =>
                                handleUpdate(fn.id, {
                                  nonvegCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                                })
                              }
                              className="w-full h-9 text-center font-bold text-sm rounded-xl border border-slate-200 bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Declined Section (Shown when status is 'no') */}
                  {resp.status === 'no' && (
                    <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
                      <p>We are sorry you won&apos;t be able to join us for this event!</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit Action Bar */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[52px] py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-base shadow-xl shadow-rose-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting RSVP...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{hasExistingReplies ? 'Update My RSVP' : 'Submit RSVP'}</span>
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              You can return to this same link anytime to update your responses.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
