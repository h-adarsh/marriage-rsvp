import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  UserCheck,
  UserPlus,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Minus,
  Clock,
  Phone,
  AlertCircle,
  Loader2,
  Calendar,
  MapPin,
  Sparkles,
  X,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { WeddingFunction } from '../types/wedding';
import {
  FunctionCheckinOverview,
} from '../types/checkin';
import {
  getFunctionCheckinOverviewApi,
  recordCheckinApi,
  undoCheckinApi,
  updateCheckinApi,
} from '../api/checkin';

interface VenueCheckInProps {
  functions: WeddingFunction[];
  initialFunctionId?: string;
  onNavigateToFunctions?: () => void;
}

type CheckinFilter = 'all' | 'pending' | 'arrived' | 'walkin';

export const VenueCheckIn: React.FC<VenueCheckInProps> = ({
  functions,
  initialFunctionId,
  onNavigateToFunctions,
}) => {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>(
    initialFunctionId || (functions.length > 0 ? functions[0].id : '')
  );

  const [overview, setOverview] = useState<FunctionCheckinOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<CheckinFilter>('all');

  // Adjust / Stepper Modal State
  const [adjustModalData, setAdjustModalData] = useState<{
    householdId?: string | null;
    checkinId?: string | null;
    name: string;
    contactName?: string | null;
    currentPartySize: number;
    expectedPartySize: number;
    notes: string;
    isAlreadyCheckedIn: boolean;
  } | null>(null);

  // Walk-in Modal State
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState<boolean>(false);
  const [walkinName, setWalkinName] = useState<string>('');
  const [walkinPartySize, setWalkinPartySize] = useState<number>(1);
  const [walkinNotes, setWalkinNotes] = useState<string>('');

  // Undo Confirmation State
  const [undoTarget, setUndoTarget] = useState<{
    checkinId: string;
    name: string;
  } | null>(null);

  // Fetch check-in overview whenever selected function changes
  const loadOverview = useCallback(async (functionId: string) => {
    if (!functionId) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await getFunctionCheckinOverviewApi(functionId);
      setOverview(data);
    } catch (err: any) {
      console.error('Failed to load check-in overview:', err);
      setErrorMessage(err.message || 'Could not load venue check-in data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFunctionId) {
      loadOverview(selectedFunctionId);
    }
  }, [selectedFunctionId, loadOverview]);

  // Auto-polling for multi-device live sync across gate volunteers (every 15s)
  useEffect(() => {
    if (!selectedFunctionId) return;

    const interval = setInterval(() => {
      getFunctionCheckinOverviewApi(selectedFunctionId)
        .then((data) => setOverview(data))
        .catch((err) => console.warn('[checkin] Background poll error:', err));
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedFunctionId]);

  // Keep selectedFunctionId valid when functions array changes
  useEffect(() => {
    if (functions.length > 0 && !functions.some((f) => f.id === selectedFunctionId)) {
      setSelectedFunctionId(functions[0].id);
    }
  }, [functions, selectedFunctionId]);

  // Dismiss auto-disappearing success notifications
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // Find currently selected function metadata
  const selectedFunction = useMemo(
    () => functions.find((f) => f.id === selectedFunctionId),
    [functions, selectedFunctionId]
  );

  // Combined and filtered guest items for attendance list
  // 1. Invited Households
  // 2. Walk-in Check-ins (not linked to an invited household)
  const combinedGuestList = useMemo(() => {
    if (!overview) return [];

    const invited = overview.invitedHouseholds.map((hh) => ({
      type: 'invited' as const,
      id: hh.householdId,
      name: hh.householdName,
      contact: hh.primaryContactName,
      phone: hh.phone,
      expectedPartySize: hh.expectedPartySize,
      rsvpStatus: hh.rsvpStatus,
      rsvpPartySize: hh.rsvpPartySize,
      isCheckedIn: hh.isCheckedIn,
      checkinId: hh.checkinId,
      actualPartySize: hh.actualPartySize,
      checkedInAt: hh.checkedInAt,
      notes: hh.notes,
    }));

    // Walk-ins only (isWalkin === true or householdId === null)
    const walkins = overview.checkins
      .filter((c) => c.isWalkin || !c.householdId)
      .map((c) => ({
        type: 'walkin' as const,
        id: c.id,
        name: c.guestName,
        contact: c.primaryContactName || c.guestName,
        phone: c.phone,
        expectedPartySize: c.actualPartySize,
        rsvpStatus: null,
        rsvpPartySize: null,
        isCheckedIn: true,
        checkinId: c.id,
        actualPartySize: c.actualPartySize,
        checkedInAt: c.checkedInAt,
        notes: c.notes,
      }));

    return [...invited, ...walkins];
  }, [overview]);

  // Apply search query and active filter tab
  const filteredList = useMemo(() => {
    let list = combinedGuestList;

    // Filter tab
    if (activeFilter === 'pending') {
      list = list.filter((item) => item.type === 'invited' && !item.isCheckedIn);
    } else if (activeFilter === 'arrived') {
      list = list.filter((item) => item.isCheckedIn);
    } else if (activeFilter === 'walkin') {
      list = list.filter((item) => item.type === 'walkin');
    }

    // Search query
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.contact?.toLowerCase().includes(query) ||
          item.phone?.toLowerCase().includes(query) ||
          item.notes?.toLowerCase().includes(query)
      );
    }

    return list;
  }, [combinedGuestList, activeFilter, searchQuery]);

  // Counts for filter tabs
  const tabCounts = useMemo(() => {
    const total = combinedGuestList.length;
    const pending = combinedGuestList.filter((item) => item.type === 'invited' && !item.isCheckedIn).length;
    const arrived = combinedGuestList.filter((item) => item.isCheckedIn).length;
    const walkin = combinedGuestList.filter((item) => item.type === 'walkin').length;
    return { total, pending, arrived, walkin };
  }, [combinedGuestList]);

  // Handle direct 1-tap check-in with expected/RSVP party size
  const handleDirectCheckin = async (item: (typeof combinedGuestList)[0]) => {
    if (item.type !== 'invited' || item.isCheckedIn) return;

    // Use RSVP party size if confirmed, otherwise expected party size
    const defaultSize =
      item.rsvpStatus === 'yes' && item.rsvpPartySize && item.rsvpPartySize > 0
        ? item.rsvpPartySize
        : item.expectedPartySize || 1;

    try {
      setActionLoadingId(item.id);
      setErrorMessage(null);
      await recordCheckinApi(selectedFunctionId, {
        householdId: item.id,
        actualPartySize: defaultSize,
        notes: null,
      });

      setSuccessBanner(`Checked in ${item.name} (${defaultSize} guests)`);
      await loadOverview(selectedFunctionId);
    } catch (err: any) {
      console.error('Check-in error:', err);
      setErrorMessage(err.message || 'Failed to check in guest.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Adjust / Stepper Modal
  const openAdjustModal = (item: (typeof combinedGuestList)[0]) => {
    const defaultSize = item.isCheckedIn
      ? item.actualPartySize || 1
      : item.rsvpStatus === 'yes' && item.rsvpPartySize && item.rsvpPartySize > 0
      ? item.rsvpPartySize
      : item.expectedPartySize || 1;

    setAdjustModalData({
      householdId: item.type === 'invited' ? item.id : null,
      checkinId: item.checkinId,
      name: item.name,
      contactName: item.contact,
      currentPartySize: defaultSize,
      expectedPartySize: item.expectedPartySize,
      notes: item.notes || '',
      isAlreadyCheckedIn: item.isCheckedIn,
    });
  };

  // Save changes from Adjust Modal
  const handleSaveAdjustModal = async () => {
    if (!adjustModalData) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      if (adjustModalData.isAlreadyCheckedIn && adjustModalData.checkinId) {
        // Update existing check-in
        await updateCheckinApi(selectedFunctionId, adjustModalData.checkinId, {
          actualPartySize: adjustModalData.currentPartySize,
          notes: adjustModalData.notes.trim() || null,
        });
        setSuccessBanner(`Updated ${adjustModalData.name} arrival details`);
      } else {
        // Record new check-in with custom party size
        await recordCheckinApi(selectedFunctionId, {
          householdId: adjustModalData.householdId,
          actualPartySize: adjustModalData.currentPartySize,
          notes: adjustModalData.notes.trim() || null,
        });
        setSuccessBanner(
          `Checked in ${adjustModalData.name} (${adjustModalData.currentPartySize} guests)`
        );
      }

      setAdjustModalData(null);
      await loadOverview(selectedFunctionId);
    } catch (err: any) {
      console.error('Adjust check-in error:', err);
      setErrorMessage(err.message || 'Failed to save check-in adjustments.');
    } finally {
      setIsLoading(false);
    }
  };

  // Open Walk-in Modal
  const openWalkinModal = () => {
    setWalkinName('');
    setWalkinPartySize(1);
    setWalkinNotes('');
    setIsWalkinModalOpen(true);
  };

  // Submit Walk-in
  const handleSaveWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = walkinName.trim();
    if (!trimmed) {
      setErrorMessage('Please enter guest or group name for walk-in.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await recordCheckinApi(selectedFunctionId, {
        guestName: trimmed,
        actualPartySize: walkinPartySize,
        isWalkin: true,
        notes: walkinNotes.trim() || null,
      });

      setSuccessBanner(`Walk-in recorded: ${trimmed} (${walkinPartySize} guests)`);
      setIsWalkinModalOpen(false);
      await loadOverview(selectedFunctionId);
    } catch (err: any) {
      console.error('Walk-in error:', err);
      setErrorMessage(err.message || 'Failed to record walk-in arrival.');
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm and execute Undo
  const handleConfirmUndo = async () => {
    if (!undoTarget) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await undoCheckinApi(selectedFunctionId, undoTarget.checkinId);
      setSuccessBanner(`Check-in undone for ${undoTarget.name}`);
      setUndoTarget(null);
      await loadOverview(selectedFunctionId);
    } catch (err: any) {
      console.error('Undo check-in error:', err);
      setErrorMessage(err.message || 'Failed to undo check-in.');
    } finally {
      setIsLoading(false);
    }
  };

  // Format timestamp helper
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  if (functions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto">
        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">No Wedding Functions Configured</h3>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          Venue check-in requires at least one wedding function to record arrivals.
        </p>
        {onNavigateToFunctions && (
          <button
            onClick={onNavigateToFunctions}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Function</span>
          </button>
        )}
      </div>
    );
  }

  const summary = overview?.summary;
  const confirmedTarget = summary?.confirmedHeadcount || summary?.invitedHeadcount || 1;
  const checkedInTotal = summary?.totalCheckedInGuests || 0;
  const progressPercent = Math.min(
    100,
    Math.round((checkedInTotal / (confirmedTarget > 0 ? confirmedTarget : 1)) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Function Selector & Top Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Function Dropdown */}
        <div className="flex-1 max-w-md">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Active Function Venue
          </label>
          <div className="relative">
            <select
              value={selectedFunctionId}
              onChange={(e) => setSelectedFunctionId(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-200 text-slate-900 font-bold text-sm sm:text-base rounded-2xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-sm"
            >
              {functions.map((fn) => (
                <option key={fn.id} value={fn.id}>
                  {fn.name} {fn.venue ? `(${fn.venue})` : ''}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {selectedFunction?.venue && (
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{selectedFunction.venue}</span>
            </p>
          )}
        </div>

        {/* Action Buttons: Refresh & Add Walk-In */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadOverview(selectedFunctionId)}
            disabled={isLoading}
            className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs shadow-sm transition-all min-h-[48px] min-w-[48px] flex items-center justify-center"
            title="Refresh check-in overview"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-600' : 'text-slate-500'}`} />
          </button>

          <button
            onClick={openWalkinModal}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/15 transition-all min-h-[48px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Walk-In Guest</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 text-xs sm:text-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 text-xs sm:text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="font-semibold flex-1">{successBanner}</p>
        </div>
      )}

      {/* Attendance Summary Dashboard Hero */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
              Live Attendance Tally
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Gate Check-In Dashboard
            </h3>
          </div>
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">
              {progressPercent}%
            </span>
            <p className="text-[11px] text-slate-400 font-medium">Arrival Rate</p>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-1">
          {/* 1. Arrived Guests */}
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-semibold mb-1">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Arrived Guests</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-950">
                {summary?.totalCheckedInGuests ?? 0}
              </span>
              <span className="text-xs text-emerald-700 font-medium">
                / {summary?.confirmedHeadcount ?? 0} confirmed
              </span>
            </div>
          </div>

          {/* 2. Households Arrived */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-semibold mb-1">
              <Users className="w-4 h-4 text-slate-500" />
              <span>Households</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">
                {summary?.totalCheckedInHouseholds ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                / {overview?.invitedHouseholds.length ?? 0} invited
              </span>
            </div>
          </div>

          {/* 3. Walk-Ins Recorded */}
          <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-semibold mb-1">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Walk-Ins</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-950">
                {summary?.walkinGuests ?? 0}
              </span>
              <span className="text-xs text-amber-700 font-medium">
                across {summary?.walkinCount ?? 0} groups
              </span>
            </div>
          </div>

          {/* 4. Pending Expected */}
          <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5 sm:p-4">
            <div className="flex items-center gap-1.5 text-rose-800 text-xs font-semibold mb-1">
              <Clock className="w-4 h-4 text-rose-600" />
              <span>Pending Arrival</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-950">
                {tabCounts.pending}
              </span>
              <span className="text-xs text-rose-700 font-medium">households</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fast Name Search & Filter Chips Bar */}
      <div className="space-y-3">
        {/* Large Touch Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guest by household name, contact, or phone..."
            className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-sm sm:text-base rounded-2xl pl-12 pr-10 py-3.5 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-sm min-h-[48px]"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all min-h-[38px] ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Guests ({tabCounts.total})
          </button>

          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all min-h-[38px] ${
              activeFilter === 'pending'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Pending Arrival ({tabCounts.pending})
          </button>

          <button
            onClick={() => setActiveFilter('arrived')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all min-h-[38px] ${
              activeFilter === 'arrived'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Checked In ({tabCounts.arrived})
          </button>

          <button
            onClick={() => setActiveFilter('walkin')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all min-h-[38px] ${
              activeFilter === 'walkin'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Walk-ins ({tabCounts.walkin})
          </button>
        </div>
      </div>

      {/* Guest Check-In Cards List */}
      <div className="space-y-3">
        {isLoading && !overview ? (
          <div className="py-16 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-rose-600" />
            <p className="text-xs font-semibold">Loading venue check-in list...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800">No Guests Found</h4>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery
                ? `No guests matched "${searchQuery}".`
                : 'No guests match the selected filter.'}
            </p>
          </div>
        ) : (
          filteredList.map((item) => {
            const isActing = actionLoadingId === item.id;
            const isCheckedIn = item.isCheckedIn;

            // Suggested party size for direct check-in button
            const directPartySize =
              item.rsvpStatus === 'yes' && item.rsvpPartySize && item.rsvpPartySize > 0
                ? item.rsvpPartySize
                : item.expectedPartySize || 1;

            return (
              <div
                key={`${item.type}-${item.id}`}
                className={`rounded-2xl border transition-all p-4 sm:p-5 ${
                  isCheckedIn
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Guest Details & Status Badges */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-slate-900 text-base tracking-tight truncate">
                        {item.name}
                      </h4>

                      {/* Walkin Tag */}
                      {item.type === 'walkin' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Walk-in
                        </span>
                      )}

                      {/* RSVP Badge */}
                      {item.type === 'invited' && (
                        <>
                          {item.rsvpStatus === 'yes' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              RSVP Attending ({item.rsvpPartySize || item.expectedPartySize})
                            </span>
                          ) : item.rsvpStatus === 'maybe' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                              RSVP Maybe ({item.rsvpPartySize || item.expectedPartySize})
                            </span>
                          ) : item.rsvpStatus === 'no' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                              RSVP Declined
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700">
                              RSVP Pending
                            </span>
                          )}
                        </>
                      )}

                      {/* Checked In Tag */}
                      {isCheckedIn && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Checked In ({item.actualPartySize} arrived)</span>
                        </span>
                      )}
                    </div>

                    {/* Contact & Meta Subtext */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      {item.contact && item.contact !== item.name && (
                        <span>Contact: <strong className="text-slate-700">{item.contact}</strong></span>
                      )}
                      {item.phone && (
                        <a
                          href={`tel:${item.phone}`}
                          className="flex items-center gap-1 text-slate-600 hover:text-rose-600"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{item.phone}</span>
                        </a>
                      )}
                      <span>
                        Expected: <strong className="text-slate-700">{item.expectedPartySize} guests</strong>
                      </span>
                      {isCheckedIn && item.checkedInAt && (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <Clock className="w-3 h-3" />
                          <span>Arrived at {formatTime(item.checkedInAt)}</span>
                        </span>
                      )}
                    </div>

                    {/* Notes preview if any */}
                    {item.notes && (
                      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1 border border-slate-100 flex items-center gap-1.5 mt-1 max-w-xl truncate">
                        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{item.notes}</span>
                      </p>
                    )}
                  </div>

                  {/* Right: Touch Actions (≥48px min height) */}
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0">
                    {!isCheckedIn ? (
                      /* Not Checked In: Fast 1-Tap & Adjust Buttons */
                      <>
                        <button
                          onClick={() => handleDirectCheckin(item)}
                          disabled={isActing}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all min-h-[48px] disabled:opacity-50"
                        >
                          {isActing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Check In ({directPartySize})</span>
                        </button>

                        <button
                          onClick={() => openAdjustModal(item)}
                          title="Adjust headcount or add arrival notes"
                          className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-slate-50 font-bold text-xs sm:text-sm transition-colors min-h-[48px] flex items-center justify-center gap-1"
                        >
                          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                          <span>Adjust</span>
                        </button>
                      </>
                    ) : (
                      /* Already Checked In: Adjust & Undo Buttons */
                      <>
                        <button
                          onClick={() => openAdjustModal(item)}
                          className="px-3.5 py-2.5 rounded-xl border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-bold text-xs sm:text-sm transition-colors min-h-[48px] flex items-center justify-center gap-1.5"
                        >
                          <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                          <span>Edit Count</span>
                        </button>

                        <button
                          onClick={() =>
                            setUndoTarget({
                              checkinId: item.checkinId!,
                              name: item.name,
                            })
                          }
                          title="Undo check-in for this guest"
                          className="px-3 py-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[48px] flex items-center justify-center"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="text-xs font-semibold ml-1 hidden sm:inline">Undo</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Adjust Party Size & Notes Modal */}
      {adjustModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                  {adjustModalData.isAlreadyCheckedIn ? 'Edit Arrival' : 'Venue Gate Check-In'}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">
                  {adjustModalData.name}
                </h3>
                {adjustModalData.contactName && (
                  <p className="text-xs text-slate-500">Contact: {adjustModalData.contactName}</p>
                )}
              </div>
              <button
                onClick={() => setAdjustModalData(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Input (party size) */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Actual Arrived Headcount:
              </label>

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setAdjustModalData((prev) =>
                      prev
                        ? {
                            ...prev,
                            currentPartySize: Math.max(1, prev.currentPartySize - 1),
                          }
                        : null
                    )
                  }
                  disabled={adjustModalData.currentPartySize <= 1}
                  className="w-14 h-14 rounded-2xl bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-black text-xl flex items-center justify-center shadow-xs transition-all active:scale-95 disabled:opacity-40 min-h-[48px] min-w-[48px]"
                >
                  <Minus className="w-6 h-6 text-slate-700" />
                </button>

                <div className="w-24 text-center">
                  <span className="text-4xl font-black text-slate-950">
                    {adjustModalData.currentPartySize}
                  </span>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {adjustModalData.currentPartySize === 1 ? 'Guest' : 'Guests'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setAdjustModalData((prev) =>
                      prev
                        ? {
                            ...prev,
                            currentPartySize: Math.min(50, prev.currentPartySize + 1),
                          }
                        : null
                    )
                  }
                  className="w-14 h-14 rounded-2xl bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-black text-xl flex items-center justify-center shadow-xs transition-all active:scale-95 min-h-[48px] min-w-[48px]"
                >
                  <Plus className="w-6 h-6 text-slate-700" />
                </button>
              </div>

              {/* Quick Preset Buttons */}
              {adjustModalData.expectedPartySize &&
                adjustModalData.expectedPartySize !== adjustModalData.currentPartySize && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setAdjustModalData((prev) =>
                          prev
                            ? {
                                ...prev,
                                currentPartySize: prev.expectedPartySize,
                              }
                            : null
                        )
                      }
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold underline"
                    >
                      Reset to expected headcount ({adjustModalData.expectedPartySize})
                    </button>
                  </div>
                )}
            </div>

            {/* Optional Arrival Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Gate Notes (Optional):
              </label>
              <textarea
                value={adjustModalData.notes}
                onChange={(e) =>
                  setAdjustModalData((prev) =>
                    prev ? { ...prev, notes: e.target.value } : null
                  )
                }
                maxLength={500}
                placeholder="e.g. Arrived late, extra driver seated outside, special seating request..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalData(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 transition-colors min-h-[48px]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveAdjustModal}
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/15 transition-all min-h-[48px] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {adjustModalData.isAlreadyCheckedIn ? 'Update Check-In' : 'Confirm Check-In'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Walk-in Guest Modal */}
      {isWalkinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveWalkin}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                  Unregistered Arrival
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">
                  Record Walk-In Guest
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkinModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guest / Group Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Guest or Group Name: <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={150}
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                placeholder="e.g. Ramesh Uncle & Family, Dr. Roy (VIP Walk-in)"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 min-h-[48px]"
              />
            </div>

            {/* Party Size Stepper */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Number of Arriving Guests:
              </label>

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setWalkinPartySize((prev) => Math.max(1, prev - 1))}
                  disabled={walkinPartySize <= 1}
                  className="w-14 h-14 rounded-2xl bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-black text-xl flex items-center justify-center shadow-xs transition-all active:scale-95 disabled:opacity-40 min-h-[48px] min-w-[48px]"
                >
                  <Minus className="w-6 h-6 text-slate-700" />
                </button>

                <div className="w-24 text-center">
                  <span className="text-4xl font-black text-slate-950">
                    {walkinPartySize}
                  </span>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {walkinPartySize === 1 ? 'Guest' : 'Guests'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setWalkinPartySize((prev) => Math.min(50, prev + 1))}
                  className="w-14 h-14 rounded-2xl bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-black text-xl flex items-center justify-center shadow-xs transition-all active:scale-95 min-h-[48px] min-w-[48px]"
                >
                  <Plus className="w-6 h-6 text-slate-700" />
                </button>
              </div>
            </div>

            {/* Walk-in Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Notes (Optional):
              </label>
              <textarea
                value={walkinNotes}
                onChange={(e) => setWalkinNotes(e.target.value)}
                maxLength={500}
                placeholder="e.g. Accompanied groom's college friends..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsWalkinModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 transition-colors min-h-[48px]"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isLoading || !walkinName.trim()}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-600/15 transition-all min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>Record Walk-In</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Undo Check-In Confirmation Dialog */}
      {undoTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                Undo Check-In?
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to revert check-in for{' '}
                <strong className="text-slate-700">{undoTarget.name}</strong>?
                Their status will return to pending.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUndoTarget(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 min-h-[44px]"
              >
                Keep Checked In
              </button>

              <button
                type="button"
                onClick={handleConfirmUndo}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all min-h-[44px] flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Yes, Undo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
