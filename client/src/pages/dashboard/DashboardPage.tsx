import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  CalendarHeart,
  LogOut,
  Plus,
  Calendar,
  MapPin,
  Clock,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  Users,
  Calculator,
  UserCheck,
} from 'lucide-react';
import { Wedding, WeddingFunction } from '../../types/wedding';
import { Household } from '../../types/household';
import {
  getWeddingsApi,
  getFunctionsApi,
  deleteWeddingApi,
  deleteFunctionApi,
} from '../../api/weddings';
import { getHouseholdsApi } from '../../api/households';
import { CreateWeddingModal } from '../../components/CreateWeddingModal';
import { CreateFunctionModal } from '../../components/CreateFunctionModal';
import { CreateHouseholdModal } from '../../components/CreateHouseholdModal';
import { CsvImportModal } from '../../components/CsvImportModal';
import { FunctionInvitationsModal } from '../../components/FunctionInvitationsModal';
import { HouseholdList } from '../../components/HouseholdList';
import { HeadcountDashboard } from '../../components/HeadcountDashboard';
import { VenueCheckIn } from '../../components/VenueCheckIn';

type DashboardTab = 'headcount' | 'checkin' | 'functions' | 'guests';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [activeWedding, setActiveWedding] = useState<Wedding | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('headcount');

  const [functions, setFunctions] = useState<WeddingFunction[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedFunctionForInvites, setSelectedFunctionForInvites] = useState<WeddingFunction | null>(null);

  const [isLoadingWeddings, setIsLoadingWeddings] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const [isWeddingModalOpen, setIsWeddingModalOpen] = useState(false);
  const [isFunctionModalOpen, setIsFunctionModalOpen] = useState(false);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Load all weddings for the current planner
  const loadWeddings = useCallback(async () => {
    try {
      setIsLoadingWeddings(true);
      const data = await getWeddingsApi();
      setWeddings(data);
      if (data.length > 0) {
        setActiveWedding((prev) => (prev && data.find((w) => w.id === prev.id) ? prev : data[0]));
      } else {
        setActiveWedding(null);
        setFunctions([]);
        setHouseholds([]);
      }
    } catch (err) {
      console.error('Failed to load weddings:', err);
    } finally {
      setIsLoadingWeddings(false);
    }
  }, []);

  // Load functions and households for active wedding
  const loadWeddingData = useCallback(async (weddingId: string) => {
    try {
      setIsLoadingContent(true);
      const [fns, hhs] = await Promise.all([
        getFunctionsApi(weddingId).catch(() => []),
        getHouseholdsApi(weddingId).catch(() => []),
      ]);
      setFunctions(fns);
      setHouseholds(hhs);
    } catch (err) {
      console.error('Failed to load wedding data:', err);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    loadWeddings();
  }, [loadWeddings]);

  useEffect(() => {
    if (activeWedding) {
      loadWeddingData(activeWedding.id);
    }
  }, [activeWedding, loadWeddingData]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleWeddingCreated = (newWedding: Wedding) => {
    setWeddings((prev) => [newWedding, ...prev]);
    setActiveWedding(newWedding);
  };

  const handleDeleteWedding = async () => {
    if (!activeWedding) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${activeWedding.title}"? This will permanently delete all functions, guest lists, and RSVPs.`
    );
    if (!confirmed) return;

    try {
      await deleteWeddingApi(activeWedding.id);
      await loadWeddings();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete wedding');
    }
  };

  const handleFunctionCreated = (newFn: WeddingFunction) => {
    setFunctions((prev) => [...prev, newFn]);
  };

  const handleDeleteFunction = async (fn: WeddingFunction) => {
    const confirmed = window.confirm(`Remove function "${fn.name}"?`);
    if (!confirmed) return;

    try {
      await deleteFunctionApi(fn.id);
      setFunctions((prev) => prev.filter((item) => item.id !== fn.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete function');
    }
  };

  const handleHouseholdCreated = (newHh: Household) => {
    setHouseholds((prev) => [newHh, ...prev]);
  };

  const handleHouseholdDeleted = (id: string) => {
    setHouseholds((prev) => prev.filter((item) => item.id !== id));
  };

  const handleHouseholdUpdated = (updatedHh: Household) => {
    setHouseholds((prev) => prev.map((item) => (item.id === updatedHh.id ? updatedHh : item)));
  };

  const formatEventDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${s} - ${e}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-sm">
              <CalendarHeart className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">Wedding RSVP</span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                Planner Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
              <p className="text-[11px] text-slate-500">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {isLoadingWeddings ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500 mb-3" />
            <p className="text-xs font-medium">Loading your weddings...</p>
          </div>
        ) : weddings.length === 0 ? (
          /* Empty State: No Weddings Created */
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-14 text-center my-6">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">No weddings registered yet</h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto mt-2 mb-6">
              Create your first wedding project to configure functions (Mehendi, Sangeet, Ceremony, Reception), manage guest households, and calculate exact catering headcounts.
            </p>
            <button
              onClick={() => setIsWeddingModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-rose-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Wedding</span>
            </button>
          </div>
        ) : (
          /* Active Wedding Dashboard View */
          <div>
            {/* Top Controls: Wedding Switcher & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={activeWedding?.id || ''}
                    onChange={(e) => {
                      const found = weddings.find((w) => w.id === e.target.value);
                      if (found) setActiveWedding(found);
                    }}
                    className="appearance-none bg-white border border-slate-200 text-slate-900 font-bold text-base sm:text-lg rounded-xl pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-sm"
                  >
                    {weddings.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <button
                  onClick={() => setIsWeddingModalOpen(true)}
                  className="p-2 sm:px-3 sm:py-2 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 bg-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Create another wedding"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Wedding</span>
                </button>
              </div>

              {activeWedding && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formatDateRange(activeWedding.startDate, activeWedding.endDate)}</span>
                  </div>

                  <button
                    onClick={handleDeleteWedding}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete this wedding"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Wedding Overview Card */}
            {activeWedding && (
              <div className="bg-gradient-to-r from-rose-600 to-rose-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg shadow-rose-600/10 mb-6">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-200">
                  Active Wedding Event
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 mb-2">
                  {activeWedding.coupleNames}
                </h2>
                <p className="text-rose-100 text-xs sm:text-sm max-w-xl">
                  {activeWedding.title} • {formatDateRange(activeWedding.startDate, activeWedding.endDate)}
                </p>
              </div>
            )}

            {/* Dashboard Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab('headcount')}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === 'headcount'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Headcount & Catering</span>
              </button>

              <button
                onClick={() => setActiveTab('checkin')}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === 'checkin'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Venue Check-In</span>
              </button>

              <button
                onClick={() => setActiveTab('functions')}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === 'functions'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Functions ({functions.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('guests')}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === 'guests'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Guest Registry ({households.length})</span>
              </button>
            </div>

            {/* Tab: Headcount Dashboard View */}
            {activeTab === 'headcount' && (
              <HeadcountDashboard
                functions={functions}
                onNavigateToFunctions={() => setActiveTab('functions')}
              />
            )}

            {/* Tab: Venue Check-In View */}
            {activeTab === 'checkin' && (
              <VenueCheckIn
                functions={functions}
                onNavigateToFunctions={() => setActiveTab('functions')}
              />
            )}

            {/* Tab: Functions View */}
            {activeTab === 'functions' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Wedding Functions</h3>
                    <p className="text-slate-500 text-xs">
                      Sub-events with individual dates, venues, and RSVP requirements
                    </p>
                  </div>

                  <button
                    onClick={() => setIsFunctionModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Function</span>
                  </button>
                </div>

                {isLoadingContent ? (
                  <div className="py-12 flex justify-center items-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                  </div>
                ) : functions.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
                    <p className="text-slate-600 text-sm font-medium">No functions added to this wedding yet.</p>
                    <p className="text-slate-400 text-xs mt-1 mb-4">
                      Add Haldi, Mehendi, Sangeet, Wedding, or Reception to begin inviting guests.
                    </p>
                    <button
                      onClick={() => setIsFunctionModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add First Function</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {functions.map((fn) => (
                      <div
                        key={fn.id}
                        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                              {fn.name}
                            </span>
                            <button
                              onClick={() => handleDeleteFunction(fn)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete function"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-2 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>{formatEventDateTime(fn.dateTime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{fn.venue}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedFunctionForInvites(fn)}
                          className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-between text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors group"
                        >
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
                            <span>Manage Invitations</span>
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Guest Registry View */}
            {activeTab === 'guests' && activeWedding && (
              <div>
                <HouseholdList
                  weddingId={activeWedding.id}
                  households={households}
                  onHouseholdDeleted={handleHouseholdDeleted}
                  onHouseholdUpdated={handleHouseholdUpdated}
                  onOpenAddModal={() => setIsHouseholdModalOpen(true)}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Creation Modals */}
      <CreateWeddingModal
        isOpen={isWeddingModalOpen}
        onClose={() => setIsWeddingModalOpen(false)}
        onWeddingCreated={handleWeddingCreated}
      />

      {activeWedding && (
        <>
          <CreateFunctionModal
            isOpen={isFunctionModalOpen}
            weddingId={activeWedding.id}
            onClose={() => setIsFunctionModalOpen(false)}
            onFunctionCreated={handleFunctionCreated}
          />

          <CreateHouseholdModal
            isOpen={isHouseholdModalOpen}
            weddingId={activeWedding.id}
            onClose={() => setIsHouseholdModalOpen(false)}
            onHouseholdCreated={handleHouseholdCreated}
          />

          <CsvImportModal
            isOpen={isImportModalOpen}
            weddingId={activeWedding.id}
            onClose={() => setIsImportModalOpen(false)}
            onImportComplete={() => loadWeddingData(activeWedding.id)}
          />

          <FunctionInvitationsModal
            isOpen={Boolean(selectedFunctionForInvites)}
            weddingFunction={selectedFunctionForInvites}
            onClose={() => setSelectedFunctionForInvites(null)}
            onInvitationsUpdated={() => {
              if (activeWedding) loadWeddingData(activeWedding.id);
            }}
          />
        </>
      )}
    </div>
  );
};

