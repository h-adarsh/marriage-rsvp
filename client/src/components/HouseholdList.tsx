import React, { useState, useMemo } from 'react';
import { Household } from '../types/household';
import { deleteHouseholdApi, regenerateTokenApi } from '../api/households';
import {
  Search,
  Users,
  User,
  Phone,
  Link as LinkIcon,
  Check,
  Trash2,
  Plus,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface HouseholdListProps {
  weddingId: string;
  households: Household[];
  onHouseholdDeleted: (id: string) => void;
  onHouseholdUpdated?: (household: Household) => void;
  onOpenAddModal: () => void;
  onOpenImportModal?: () => void;
}

export const HouseholdList: React.FC<HouseholdListProps> = ({
  households,
  onHouseholdDeleted,
  onHouseholdUpdated,
  onOpenAddModal,
  onOpenImportModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const filteredHouseholds = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return households;
    return households.filter(
      (h) =>
        h.name.toLowerCase().includes(term) ||
        h.primaryContactName.toLowerCase().includes(term) ||
        h.phone.includes(term)
    );
  }, [households, searchTerm]);

  const totalExpectedGuests = useMemo(() => {
    return households.reduce((sum, h) => sum + (h.expectedPartySize || 0), 0);
  }, [households]);

  const handleCopyLink = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/rsvp/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => {
      setCopiedToken(null);
    }, 2000);
  };

  const handleRegenerateToken = async (household: Household) => {
    const confirmed = window.confirm(
      `Regenerate private RSVP link for "${household.name}"?\n\nThis will immediately invalidate and revoke the existing link. Any guest using the old link will get an Invitation Not Found error.`
    );
    if (!confirmed) return;

    setRegeneratingId(household.id);
    try {
      const res = await regenerateTokenApi(household.id);
      if (onHouseholdUpdated) {
        onHouseholdUpdated({
          ...household,
          inviteToken: res.inviteToken,
        });
      }
      const url = `${window.location.origin}/rsvp/${res.inviteToken}`;
      await navigator.clipboard.writeText(url);
      setCopiedToken(res.inviteToken);
      setTimeout(() => setCopiedToken(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate invite link');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = async (household: Household) => {
    const confirmed = window.confirm(
      `Remove "${household.name}"? This will delete all invitation links and RSVPs for this household.`
    );
    if (!confirmed) return;

    try {
      await deleteHouseholdApi(household.id);
      onHouseholdDeleted(household.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete household');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Summary Stats & Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Households</p>
            <p className="text-xl font-extrabold text-slate-900">{households.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Expected Guests</p>
            <p className="text-xl font-extrabold text-slate-900">{totalExpectedGuests}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm flex items-center justify-end gap-2">
          {onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              Import CSV
            </button>
          )}
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Household</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by household name, contact person, or phone number..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-sm"
        />
      </div>

      {/* Household Table / List */}
      {households.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No guest households added yet</h3>
          <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto mt-1 mb-5">
            Add households individually or import a CSV list to start managing invitations and RSVP links.
          </p>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Household</span>
          </button>
        </div>
      ) : filteredHouseholds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
          No households match your search query "{searchTerm}".
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Household Name</th>
                  <th className="py-3 px-4">Primary Contact</th>
                  <th className="py-3 px-4 text-center">Party Size</th>
                  <th className="py-3 px-4">Private Invite Link</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredHouseholds.map((household) => {
                  const isCopied = copiedToken === household.inviteToken;
                  return (
                    <tr key={household.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{household.name}</div>
                        {household.notes && (
                          <div className="text-[11px] font-normal text-slate-400 truncate max-w-xs">
                            {household.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{household.primaryContactName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{household.phone}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {household.expectedPartySize}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopyLink(household.inviteToken)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                              isCopied
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                            title="Copy unique RSVP link for this household"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Copied Link!</span>
                              </>
                            ) : (
                              <>
                                <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleRegenerateToken(household)}
                            disabled={regeneratingId === household.id}
                            className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors border border-transparent hover:border-amber-200"
                            title="Revoke and regenerate new private invite link"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${regeneratingId === household.id ? 'animate-spin text-amber-600' : ''}`} />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDelete(household)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete household"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
