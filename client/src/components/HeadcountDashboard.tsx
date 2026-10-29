import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Utensils,
  Calculator,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Info,
  Download,
  Loader2,
  Phone,
} from 'lucide-react';
import { WeddingFunction } from '../types/wedding';
import { HeadcountData } from '../types/headcount';
import { getFunctionHeadcountApi, exportCatererCsvApi } from '../api/headcount';

interface HeadcountDashboardProps {
  functions: WeddingFunction[];
  onNavigateToFunctions: () => void;
}

export const HeadcountDashboard: React.FC<HeadcountDashboardProps> = ({
  functions,
  onNavigateToFunctions,
}) => {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>(
    functions[0]?.id || ''
  );
  const [headcount, setHeadcount] = useState<HeadcountData | null>(null);
  const [maybePct, setMaybePct] = useState<number>(50);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [showStaleDrawer, setShowStaleDrawer] = useState<boolean>(false);

  // Sync selected function if functions list changes
  useEffect(() => {
    if (functions.length > 0 && (!selectedFunctionId || !functions.some((f) => f.id === selectedFunctionId))) {
      setSelectedFunctionId(functions[0].id);
    }
  }, [functions, selectedFunctionId]);

  const loadHeadcount = useCallback(
    async (funcId: string, pct: number) => {
      if (!funcId) return;
      try {
        setIsLoading(true);
        setError(null);
        const data = await getFunctionHeadcountApi(funcId, { maybePct: pct });
        setHeadcount(data);
        setLastRefreshedAt(new Date());
      } catch (err) {
        console.error('Failed to load headcount:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch headcount');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedFunctionId) {
      loadHeadcount(selectedFunctionId, maybePct);
    }
  }, [selectedFunctionId, maybePct, loadHeadcount]);

  const handleRefresh = () => {
    if (selectedFunctionId) {
      loadHeadcount(selectedFunctionId, maybePct);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedFunctionId) return;
    try {
      setIsExporting(true);
      setError(null);
      const { blob, filename } = await exportCatererCsvApi(selectedFunctionId, maybePct);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export caterer CSV:', err);
      setError(err instanceof Error ? err.message : 'Failed to export caterer CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedFunction = functions.find((f) => f.id === selectedFunctionId);

  if (functions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center my-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-100">
          <Calculator className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">No Functions Created Yet</h3>
        <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto mt-1 mb-5">
          Add wedding functions (Mehendi, Sangeet, Wedding Ceremony, Reception) to begin tracking confirmed headcounts, dietary splits, and planning estimates.
        </p>
        <button
          onClick={onNavigateToFunctions}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <span>Go to Functions & Invites</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar: Function Switcher Tabs & Live-on-Refresh Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Function Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {functions.map((fn) => {
            const isSelected = fn.id === selectedFunctionId;
            return (
              <button
                key={fn.id}
                onClick={() => setSelectedFunctionId(fn.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                {fn.name}
              </button>
            );
          })}
        </div>

        {/* Live on Refresh Status & Refresh Button */}
        <div className="flex items-center gap-3 self-end md:self-auto text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-slate-600">Live on refresh</span>
            <span className="text-slate-400">• {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition-all disabled:opacity-50"
            title="Refresh latest RSVP responses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-rose-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={isExporting || isLoading || !selectedFunctionId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-all disabled:opacity-50"
            title="Download sanitized caterer spreadsheet with dietary details"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Export Caterer CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Stale RSVP Alert Banner & Breakdown Drawer */}
      {headcount && headcount.staleCount > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-sm overflow-hidden">
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold">
                  Attention: {headcount.staleCount} RSVP response(s) are older than {headcount.staleDays} days.
                </span>
                <p className="text-amber-800/90 mt-0.5">
                  Guest plans can shift over time. Consider verifying with early responders before finalizing caterer numbers.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowStaleDrawer(!showStaleDrawer)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-200/70 hover:bg-amber-200 text-amber-900 text-xs font-bold transition-all self-start sm:self-auto shrink-0 flex items-center gap-1.5 border border-amber-300"
            >
              <span>{showStaleDrawer ? 'Hide Stale List' : `View Stale Responses (${headcount.staleCount})`}</span>
              {showStaleDrawer ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showStaleDrawer && headcount.staleHouseholds && headcount.staleHouseholds.length > 0 && (
            <div className="border-t border-amber-200/80 bg-white/80 p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                  Households Awaiting Re-Confirmation ({headcount.staleCount})
                </h5>
                <span className="text-[10px] text-slate-500">
                  Threshold: &gt; {headcount.staleDays} days old
                </span>
              </div>
              <div className="divide-y divide-amber-100 border border-amber-200/60 rounded-xl overflow-hidden bg-white">
                {headcount.staleHouseholds.map((item) => (
                  <div
                    key={item.householdId}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-amber-50/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{item.householdName}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'yes'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.status === 'yes'
                            ? `Confirmed (${item.partySize} guests)`
                            : `Tentative (${item.partySize} guests)`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                        <span>Contact: <strong className="text-slate-700">{item.primaryContactName}</strong></span>
                        {item.phone && (
                          <>
                            <span className="text-slate-300">•</span>
                            <a
                              href={`tel:${item.phone}`}
                              className="text-rose-600 hover:underline font-mono inline-flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{item.phone}</span>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-200">
                        ⚠️ {item.daysAgo} days ago
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {headcount && (
        <>
          {/* Main Numbers: 3 Primary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Confirmed Headcount (Strict Catering Number) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-0 pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    Confirmed Headcount
                  </span>
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                    {headcount.confirmedHeadcount}
                  </span>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Guests (People)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  from <span className="font-bold text-slate-700">{headcount.households.confirmed}</span> confirmed household(s)
                </p>
              </div>

              {/* Dietary Split (Strictly from Confirmed guests) */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-slate-500" />
                  <span>Catering Dietary Breakdown</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800">🥦 Vegetarian</span>
                    <span className="text-sm font-black text-emerald-900">{headcount.vegCount}</span>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800">🍗 Non-Veg</span>
                    <span className="text-sm font-black text-amber-900">{headcount.nonvegCount}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  *Strict rule: Excludes Maybe and No Response guests from food preparation.
                </p>
              </div>
            </div>

            {/* Card 2: Planning Estimate (Catering Buffer) */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden flex flex-col justify-between md:col-span-2">
              <div className="absolute top-0 right-0 w-36 h-36 bg-rose-500/10 rounded-bl-full -z-0 pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-md border border-rose-500/30">
                      Planning Estimate
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Headcount Buffer</span>
                  </div>
                  <Calculator className="w-4 h-4 text-rose-400" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                      {headcount.planningEstimate}
                    </span>
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Guests to cater for
                    </span>
                  </div>
                  <span className="text-xs text-rose-200 font-semibold bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/30 w-fit">
                    Buffer: +{headcount.planningEstimate - headcount.confirmedHeadcount} guests
                  </span>
                </div>

                {/* Explicit Formula Banner on Screen */}
                <div className="mt-4 p-3 rounded-xl bg-white/10 border border-white/15 text-xs text-slate-200">
                  <div className="flex items-center gap-1.5 text-rose-300 font-bold text-[11px] mb-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>Exact Formula:</span>
                  </div>
                  <p className="font-mono text-xs sm:text-sm text-white font-semibold">
                    {headcount.formula}
                  </p>
                </div>
              </div>

              {/* Interactive Maybe % Slider */}
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="maybe-slider" className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>Include Tentative Ratio:</span>
                    <span className="text-rose-300 font-mono font-bold">{maybePct}% of Maybe</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    ({Math.floor((maybePct / 100) * headcount.maybeHeadcount)} of {headcount.maybeHeadcount} tentative people)
                  </span>
                </div>

                <input
                  id="maybe-slider"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={maybePct}
                  onChange={(e) => setMaybePct(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-700 rounded-lg appearance-none"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>0% (Confirmed only)</span>
                  <div className="flex gap-1.5">
                    {[0, 25, 50, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setMaybePct(preset)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          maybePct === preset
                            ? 'bg-rose-500 text-white'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                  <span>100% (All tentative)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Metrics: Tentative, Declined, Pending, and Households */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Maybe / Tentative */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                Tentative (Maybe)
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-slate-900">{headcount.maybeHeadcount}</span>
                <span className="text-xs font-semibold text-slate-500">People</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                from <span className="font-bold text-slate-700">{headcount.households.maybe}</span> household(s)
              </p>
            </div>

            {/* Declined (No) */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Declined (No)
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-slate-900">{headcount.declinedHeadcount}</span>
                <span className="text-xs font-semibold text-slate-500">People</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                from <span className="font-bold text-slate-700">{headcount.households.declined}</span> household(s)
              </p>
            </div>

            {/* Pending / No Response */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                Pending (No Response)
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-slate-900">{headcount.noResponseHeadcount}</span>
                <span className="text-xs font-semibold text-slate-500">People</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                from <span className="font-bold text-slate-700">{headcount.households.noResponse}</span> household(s)
              </p>
            </div>
          </div>

          {/* Household Logistics Breakdown (Unit: Households) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Invitation Logistics Summary (Unit: Households)
                </h4>
                <p className="text-xs text-slate-400">
                  Total invitations sent for {selectedFunction?.name || 'this event'}
                </p>
              </div>
              <span className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
                {headcount.invitedCount} Invited Households ({headcount.totalInvitedHeadcount} Total Expected People)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-lg font-black text-emerald-900">{headcount.households.confirmed}</span>
                <p className="text-[11px] font-semibold text-emerald-700">Confirmed (Yes)</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-lg font-black text-amber-900">{headcount.households.maybe}</span>
                <p className="text-[11px] font-semibold text-amber-700">Tentative (Maybe)</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-lg font-black text-slate-700">{headcount.households.declined}</span>
                <p className="text-[11px] font-semibold text-slate-600">Declined (No)</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                <span className="text-lg font-black text-rose-900">{headcount.households.noResponse}</span>
                <p className="text-[11px] font-semibold text-rose-700">Awaiting Reply</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
