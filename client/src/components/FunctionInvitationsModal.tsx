import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from './Modal';
import { WeddingFunction, FunctionInvitationHousehold } from '../types/wedding';
import {
  getFunctionInvitationsApi,
  updateFunctionInvitationsApi,
} from '../api/weddings';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  X,
  HelpCircle,
  Lock,
  UserPlus,
  UserMinus,
  RotateCcw,
} from 'lucide-react';

interface FunctionInvitationsModalProps {
  isOpen: boolean;
  weddingFunction: WeddingFunction | null;
  onClose: () => void;
  onInvitationsUpdated?: () => void;
}

type FilterTab = 'all' | 'invited' | 'not_invited' | 'replied';

export const FunctionInvitationsModal: React.FC<FunctionInvitationsModalProps> = ({
  isOpen,
  weddingFunction,
  onClose,
  onInvitationsUpdated,
}) => {
  const [households, setHouseholds] = useState<FunctionInvitationHousehold[]>([]);
  // Set of currently invited household IDs in UI state
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  // Initial set of invited household IDs when modal fetched data
  const [initialInvitedIds, setInitialInvitedIds] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    if (!weddingFunction) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await getFunctionInvitationsApi(weddingFunction.id);
      setHouseholds(data);

      const invited = new Set(data.filter((h) => h.invited).map((h) => h.id));
      setInvitedIds(invited);
      setInitialInvitedIds(new Set(invited));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load invitations';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [weddingFunction]);

  useEffect(() => {
    if (isOpen && weddingFunction) {
      loadInvitations();
    } else {
      setHouseholds([]);
      setInvitedIds(new Set());
      setInitialInvitedIds(new Set());
      setSearchQuery('');
      setActiveTab('all');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, weddingFunction, loadInvitations]);

  // Compute pending delta changes
  const { toAdd, toRemove, hasChanges } = useMemo(() => {
    const add: string[] = [];
    const remove: string[] = [];

    for (const id of invitedIds) {
      if (!initialInvitedIds.has(id)) {
        add.push(id);
      }
    }

    for (const id of initialInvitedIds) {
      if (!invitedIds.has(id)) {
        remove.push(id);
      }
    }

    return {
      toAdd: add,
      toRemove: remove,
      hasChanges: add.length > 0 || remove.length > 0,
    };
  }, [invitedIds, initialInvitedIds]);

  // Summary counts
  const stats = useMemo(() => {
    let invitedCount = 0;
    let yesCount = 0;
    let yesGuests = 0;
    let noCount = 0;
    let maybeCount = 0;
    let repliedCount = 0;

    for (const h of households) {
      const isInvited = invitedIds.has(h.id);
      if (isInvited) {
        invitedCount++;
      }
      if (h.rsvpStatus === 'yes') {
        yesCount++;
        yesGuests += h.rsvpPartySize || h.expectedPartySize;
        repliedCount++;
      } else if (h.rsvpStatus === 'no') {
        noCount++;
        repliedCount++;
      } else if (h.rsvpStatus === 'maybe') {
        maybeCount++;
        repliedCount++;
      }
    }

    return {
      total: households.length,
      invitedCount,
      notInvitedCount: households.length - invitedCount,
      yesCount,
      yesGuests,
      noCount,
      maybeCount,
      repliedCount,
    };
  }, [households, invitedIds]);

  // Filtered list
  const filteredHouseholds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return households.filter((h) => {
      const isInvited = invitedIds.has(h.id);

      // Tab filter
      if (activeTab === 'invited' && !isInvited) return false;
      if (activeTab === 'not_invited' && isInvited) return false;
      if (activeTab === 'replied' && !h.rsvpStatus) return false;

      // Search filter
      if (!q) return true;
      const matchName = h.name.toLowerCase().includes(q);
      const matchContact = h.primaryContactName.toLowerCase().includes(q);
      const matchPhone = h.phone.toLowerCase().includes(q);
      return matchName || matchContact || matchPhone;
    });
  }, [households, invitedIds, activeTab, searchQuery]);

  // Toggle single household invitation
  const handleToggle = (household: FunctionInvitationHousehold) => {
    // If household already replied, uninviting is forbidden by business rule
    if (household.rsvpStatus) {
      return;
    }

    setInvitedIds((prev) => {
      const next = new Set(prev);
      if (next.has(household.id)) {
        next.delete(household.id);
      } else {
        next.add(household.id);
      }
      return next;
    });
    setErrorMsg(null);
  };

  // Bulk invite visible uninvited
  const handleInviteVisible = () => {
    setInvitedIds((prev) => {
      const next = new Set(prev);
      for (const h of filteredHouseholds) {
        next.add(h.id);
      }
      return next;
    });
  };

  // Bulk uninvite visible (only those with NO reply submitted)
  const handleUninviteVisibleNoReply = () => {
    setInvitedIds((prev) => {
      const next = new Set(prev);
      for (const h of filteredHouseholds) {
        // Only uninvite if no RSVP response has been submitted
        if (!h.rsvpStatus) {
          next.delete(h.id);
        }
      }
      return next;
    });
  };

  // Reset unsaved changes to original state
  const handleReset = () => {
    setInvitedIds(new Set(initialInvitedIds));
    setErrorMsg(null);
  };

  // Save changes via delta endpoint
  const handleSave = async () => {
    if (!weddingFunction || !hasChanges) return;

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await updateFunctionInvitationsApi(weddingFunction.id, {
        add: toAdd,
        remove: toRemove,
      });

      setSuccessMsg(
        `Updated successfully! (+${res.addedCount} invited, -${res.removedCount} uninvited)`
      );
      setInitialInvitedIds(new Set(invitedIds));

      if (onInvitationsUpdated) {
        onInvitationsUpdated();
      }

      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update invitations';
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Invitations: ${weddingFunction?.name || ''}`}
      subtitle={`${weddingFunction?.venue || ''} • Total Registry: ${stats.total} Households`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Metric Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Invited Households
            </span>
            <p className="text-lg font-black text-slate-800 mt-0.5">
              {stats.invitedCount}
              <span className="text-xs font-normal text-slate-400"> / {stats.total}</span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Confirmed (Yes)
            </span>
            <p className="text-lg font-black text-emerald-800 mt-0.5">
              {stats.yesCount}
              <span className="text-xs font-semibold text-emerald-600"> ({stats.yesGuests} guests)</span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
              Declined (No)
            </span>
            <p className="text-lg font-black text-rose-800 mt-0.5">{stats.noCount}</p>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Tentative (Maybe)
            </span>
            <p className="text-lg font-black text-amber-800 mt-0.5">{stats.maybeCount}</p>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by household, contact, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invited')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'invited' ? 'bg-white text-rose-600 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Invited ({stats.invitedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('not_invited')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'not_invited' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Not Invited ({stats.notInvitedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('replied')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === 'replied' ? 'bg-white text-emerald-700 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Replied ({stats.repliedCount})
            </button>
          </div>
        </div>

        {/* Quick Bulk Action Helpers */}
        <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
          <span>
            Showing <strong className="text-slate-800">{filteredHouseholds.length}</strong> households
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInviteVisible}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Visible</span>
            </button>

            <span className="text-slate-300">•</span>

            <button
              type="button"
              onClick={handleUninviteVisibleNoReply}
              className="text-xs text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1 transition-colors"
              title="Only removes households that have not submitted an RSVP"
            >
              <UserMinus className="w-3.5 h-3.5" />
              <span>Uninvite Visible (No RSVP)</span>
            </button>
          </div>
        </div>

        {/* Household Invitation Checklist Table */}
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
            <span className="text-xs">Loading invitation assignments...</span>
          </div>
        ) : filteredHouseholds.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-slate-100">
            No households match your search or filter.
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto rounded-xl border border-slate-200/90 shadow-inner">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">Invite</th>
                  <th className="py-2.5 px-3">Household Name</th>
                  <th className="py-2.5 px-3">Primary Contact</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3 text-center">Party Size</th>
                  <th className="py-2.5 px-3 text-right">Reply Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredHouseholds.map((h) => {
                  const isInvited = invitedIds.has(h.id);
                  const hasReplied = Boolean(h.rsvpStatus);

                  return (
                    <tr
                      key={h.id}
                      className={`transition-colors ${
                        isInvited ? 'bg-rose-50/20 hover:bg-rose-50/40' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Checkbox / Lock indicator */}
                      <td className="py-2.5 px-3 text-center">
                        {hasReplied ? (
                          <div
                            className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-100 text-emerald-700 cursor-not-allowed"
                            title={`Locked: Household has already submitted RSVP ('${h.rsvpStatus}'). Cannot uninvite without resetting RSVP.`}
                          >
                            <Lock className="w-3 h-3" />
                          </div>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isInvited}
                            onChange={() => handleToggle(h)}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                          />
                        )}
                      </td>

                      {/* Household Name */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {h.name}
                        {h.notes && (
                          <span className="block text-[10px] font-normal text-slate-400 truncate max-w-xs">
                            {h.notes}
                          </span>
                        )}
                      </td>

                      {/* Primary Contact */}
                      <td className="py-2.5 px-3 text-slate-700">{h.primaryContactName}</td>

                      {/* Phone */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{h.phone}</td>

                      {/* Expected Party Size */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {h.expectedPartySize}
                      </td>

                      {/* Reply Status Badge */}
                      <td className="py-2.5 px-3 text-right">
                        {h.rsvpStatus === 'yes' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3" />
                            <span>Attending ({h.rsvpPartySize || h.expectedPartySize})</span>
                          </span>
                        ) : h.rsvpStatus === 'no' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <X className="w-3 h-3" />
                            <span>Declined</span>
                          </span>
                        ) : h.rsvpStatus === 'maybe' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <HelpCircle className="w-3 h-3" />
                            <span>Maybe</span>
                          </span>
                        ) : isInvited ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            No Reply Yet
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-medium italic">
                            Not Invited
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer / Save Bar */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            {hasChanges ? (
              <span className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                Unsaved changes: {toAdd.length > 0 && `+${toAdd.length} to invite`}{' '}
                {toRemove.length > 0 && `-${toRemove.length} to uninvite`}
              </span>
            ) : (
              <span className="text-xs text-slate-400">All invitation assignments saved.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSaving}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 disabled:opacity-40"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Invitations</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
