import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { Tournament, TournamentParticipant } from '../../types';
import {
  Trophy,
  Plus,
  Users,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Trash2,
  Link,
  Copy,
  Check,
  ExternalLink,
  Gift,
  CreditCard,
  Banknote,
  Sparkles,
  Globe,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { sounds } from '../../lib/audio';

export const TournamentsView: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Tournament Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [tName, setTName] = useState('');
  const [tGame, setTGame] = useState('EA FC 25');
  const [tDate, setTDate] = useState(new Date().toISOString().split('T')[0]);
  const [tFee, setTFee] = useState(20);
  const [tPrize, setTPrize] = useState(200);
  const [tMax, setTMax] = useState(16);
  const [tStartTime, setTStartTime] = useState('14:00');
  const [tDesc, setTDesc] = useState('');

  // Register Participant Modal
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pPaid, setPPaid] = useState<boolean>(true);
  const [pMethod, setPMethod] = useState('CASH');
  const [pVoucher, setPVoucher] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(0);

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ tournaments: Tournament[] }>('/tournaments').catch(() => ({ tournaments: [] }));
      const list = data?.tournaments || [];
      setTournaments(list);
      if (list.length > 0) {
        // If nothing selected or selected tournament no longer in list, select first
        const curId = selectedTournament?.tournament?.id || selectedTournament?.id || list[0].id;
        fetchDetails(curId);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id: string) => {
    try {
      const data = await apiRequest<any>(`/tournaments/${id}`);
      if (data && (data.tournament || data.id)) {
        setSelectedTournament(data);
      } else {
        const found = tournaments.find(t => t.id === id);
        if (found) {
          setSelectedTournament({ tournament: found, participants: [] });
        }
      }
    } catch {
      const found = tournaments.find(t => t.id === id);
      if (found) {
        setSelectedTournament({ tournament: found, participants: [] });
      }
    }
  };

  // ონლაინ (საჯარო ბმულით) რეგისტრაციები — ჩანს ადმინთანაც და ოპერატორთანაც
  const fetchRegistrations = async () => {
    try {
      const data = await apiRequest<{ registrations: any[]; onlineCount: number }>('/tournaments/registrations/all');
      setRegistrations(data.registrations || []);
      setOnlineCount(data.onlineCount || 0);
    } catch {
      setRegistrations([]);
    }
  };

  useEffect(() => {
    fetchTournaments();
    fetchRegistrations();

    // ახალი ონლაინ რეგისტრაციები ავტომატურად ჩნდება
    const interval = setInterval(() => {
      fetchRegistrations();
      setSelectedTournament(prev => {
        const id = prev?.tournament?.id || prev?.id;
        if (id) fetchDetails(id);
        return prev;
      });
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteParticipant = async (participantId: string) => {
    if (!window.confirm('მონაწილე წაიშლება ტურნირიდან. გავაგრძელოთ?')) return;
    try {
      await apiRequest(`/tournaments/participants/${participantId}`, { method: 'DELETE' });
      sounds.playSuccessTone();
      if (currentTourneyId) fetchDetails(currentTourneyId);
      fetchTournaments();
      fetchRegistrations();
    } catch (err: any) {
      window.alert(err.message || 'წაშლა ვერ მოხერხდა.');
    }
  };

  const currentTourney = selectedTournament?.tournament || (selectedTournament?.id ? selectedTournament : null);
  const currentTourneyId = currentTourney?.id;
  const currentParticipants = selectedTournament?.participants || [];

  const handleCopyLink = (tId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = `${window.location.origin}/?tournamentReg=${tId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(tId);
      sounds.playSuccessTone();
      setTimeout(() => setCopiedId(null), 2500);
    }).catch(() => {
      // Fallback
      prompt('დააკოპირეთ სარეგისტრაციო ლინკი:', url);
    });
  };

  const handleOpenPublicForm = (tId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    window.open(`/?tournamentReg=${tId}`, '_blank');
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest<{ tournamentId: string }>('/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          name: tName.trim(),
          gameName: tGame.trim(),
          game: tGame.trim(),
          date: tDate,
          tournamentDate: tDate,
          startTime: tStartTime || '14:00',
          entryFee: tFee,
          prizePool: tPrize,
          maxParticipants: tMax,
          description: tDesc.trim() || undefined
        })
      });

      sounds.playSuccessTone();
      setShowCreateModal(false);
      setTName('');
      setTDesc('');
      await fetchTournaments();
      if (res?.tournamentId) {
        fetchDetails(res.tournamentId);
      }
    } catch (err: any) {
      setError(err.message || 'ტურნირის შექმნა ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTournament = async (tId: string) => {
    if (!confirm('ნამდვილად გსურთ ტურნირის წაშლა? წაიშლება ყველა მონაწილეც.')) return;
    try {
      await apiRequest(`/tournaments/${tId}`, { method: 'DELETE' });
      sounds.playSuccessTone();
      setSelectedTournament(null);
      fetchTournaments();
    } catch (err: any) {
      alert(err.message || 'ტურნირის წაშლა ვერ მოხერხდა.');
    }
  };

  const handleRegisterParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTourney?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/tournaments/${currentTourney.id}/register`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: pName.trim(),
          nickname: pName.trim(),
          phone: pPhone.trim() || undefined,
          isPaid: pPaid,
          paymentMethod: pPaid ? pMethod : undefined,
          voucherCode: pVoucher.trim() || undefined
        })
      });

      sounds.playSuccessTone();
      setShowRegisterModal(false);
      setPName('');
      setPPhone('');
      setPVoucher('');
      fetchDetails(currentTourney.id);
      fetchTournaments();
    } catch (err: any) {
      setError(err.message || 'მონაწილის რეგისტრაცია ვერ მოხერხდა.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkParticipantPaid = async (participantId: string) => {
    try {
      await apiRequest(`/tournaments/participants/${participantId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'CASH' })
      });
      sounds.playSuccessTone();
      if (currentTourney?.id) {
        fetchDetails(currentTourney.id);
        fetchTournaments();
      }
    } catch (err: any) {
      alert(err.message || 'სტატუსის განახლება ვერ მოხერხდა.');
    }
  };

  return (
    <div id="tournaments-view-container" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>ტურნირების მოდული (Esports & Tournaments)</span>
          </h2>
          <p className="text-xs text-slate-400">
            ტურნირების ორგანიზება, გაზიარებადი სარეგისტრაციო ლინკები, ვაუჩერები და მონაწილეები
          </p>
        </div>

        <button
          id="btn-create-new-tournament"
          onClick={() => { setError(null); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ახალი ტურნირის შექმნა</span>
        </button>
      </div>

      {/* Main Grid: Tournaments List + Selected Tournament Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tournaments List */}
        <div className="space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              ტურნირების სია ({tournaments.length})
            </h3>
            <span className="text-[11px] text-slate-500">დააკოპირეთ ლინკი</span>
          </div>

          {tournaments.length === 0 && !loading && (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-500 text-xs">
              ტურნირები არ არის დამატებული. შექმენით ახალი ტურნირი ღილაკით ზემოთ.
            </div>
          )}

          {tournaments.map(t => {
            const isSel = selectedTournament?.tournament?.id === t.id || selectedTournament?.id === t.id;
            const isCopied = copiedId === t.id;

            return (
              <div
                key={t.id}
                id={`tourney-card-${t.id}`}
                onClick={() => fetchDetails(t.id)}
                className={`p-4 rounded-2xl border transition cursor-pointer relative group ${
                  isSel
                    ? 'bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-950/20'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <h4 className="font-bold text-white text-sm">{t.name}</h4>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-indigo-300">{t.game || (t as any).gameName}</span>
                      <span>•</span>
                      <span>{t.tournamentDate || t.date}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    t.status === 'REGISTRATION_OPEN'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {t.status === 'REGISTRATION_OPEN' ? 'რეგისტრაცია ღიაა' : t.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs py-2 border-t border-slate-800/80 text-slate-300">
                  <span>შესატანი: <strong className="font-mono text-emerald-400">{t.entryFee} ₾</strong></span>
                  <span>საპრიზო: <strong className="font-mono text-amber-400">{t.prizePool} ₾</strong></span>
                  <span>მონაწილე: <strong className="font-mono text-indigo-400">{t.participantsCount || 0}/{t.maxParticipants || 16}</strong></span>
                </div>

                {/* Shareable Link Button */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                  <button
                    id={`btn-copy-link-${t.id}`}
                    type="button"
                    onClick={(e) => handleCopyLink(t.id, e)}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>ლინკი დაკოპირდა!</span>
                      </>
                    ) : (
                      <>
                        <Link className="w-3.5 h-3.5" />
                        <span>სარეგისტრაციო ლინკი</span>
                      </>
                    )}
                  </button>

                  <button
                    id={`btn-open-form-${t.id}`}
                    type="button"
                    title="სარეგისტრაციო ფორმის გახსნა"
                    onClick={(e) => handleOpenPublicForm(t.id, e)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Tournament Detail View */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 lg:col-span-2">
          {currentTourney ? (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{currentTourney.name || 'ტურნირი'}</h3>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                      {currentTourney.gameName || currentTourney.game || 'Game'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    თარიღი: <strong className="text-slate-200">{currentTourney.date || currentTourney.tournamentDate || '—'}</strong>
                    {currentTourney.startTime && ` • დაწყება: ${currentTourney.startTime}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Copy Public Link Button */}
                  <button
                    id="btn-detail-copy-link"
                    onClick={(e) => handleCopyLink(currentTourney.id, e)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                      copiedId === currentTourney.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {copiedId === currentTourney.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>ლინკი დაკოპირდა!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>სარეგისტრაციო ლინკის კოპირება</span>
                      </>
                    )}
                  </button>

                  <button
                    id="btn-detail-register-participant"
                    onClick={() => { setError(null); setShowRegisterModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>მონაწილის დამატება</span>
                  </button>

                  <button
                    id="btn-detail-delete-tourney"
                    title="ტურნირის წაშლა"
                    onClick={() => handleDeleteTournament(currentTourney.id)}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Shareable Link Banner */}
              <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5" /> საჯარო სარეგისტრაციო ბმული:
                  </span>
                  <p className="text-xs text-slate-400 font-mono break-all select-all">
                    {window.location.origin}/?tournamentReg={currentTourney.id}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="btn-share-banner-copy"
                    onClick={() => handleCopyLink(currentTourney.id)}
                    className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Copy className="w-3.5 h-3.5" /> კოპირება
                  </button>
                  <button
                    id="btn-share-banner-open"
                    onClick={() => handleOpenPublicForm(currentTourney.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> გახსნა
                  </button>
                </div>
              </div>

              {/* Financial & Status Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px] font-medium">მონაწილეები</span>
                  <span className="text-base font-bold text-white font-mono">
                    {currentParticipants?.length || currentTourney.participantsCount || 0} / {currentTourney.maxParticipants || 16}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px] font-medium">შესატანი თანხა</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {currentTourney.entryFee ?? 0} ₾
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px] font-medium">საპრიზო ფონდი</span>
                  <span className="text-base font-bold text-amber-400 font-mono">
                    {currentTourney.prizePool ?? '0 ₾'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px] font-medium">შეგროვებული თანხა</span>
                  <span className="text-base font-bold text-indigo-400 font-mono">
                    {currentParticipants?.reduce((acc: number, p: any) => acc + (p.is_paid || p.payment_status === 'PAID' ? (p.entry_fee || p.entryFee || 0) : 0), 0)} ₾
                  </span>
                </div>
              </div>

              {/* Participants Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    დარეგისტრირებული მოთამაშეები ({currentParticipants?.length || 0})
                  </h4>
                </div>

                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">მოთამაშე / Nickname</th>
                        <th className="p-3">ტელეფონი</th>
                        <th className="p-3">შესატანი</th>
                        <th className="p-3">სტატუსი</th>
                        <th className="p-3">რეგისტრაციის დრო</th>
                        <th className="p-3 text-right">მოქმედება</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {currentParticipants && currentParticipants.length > 0 ? (
                        currentParticipants.map((p: any, i: number) => {
                          const isPaid = p.is_paid || p.payment_status === 'PAID' || p.paymentStatus === 'PAID';
                          const hasVoucher = p.voucher_code || p.voucherCode;

                          return (
                            <tr key={p.id || i} className="hover:bg-slate-800/40 transition">
                              <td className="p-3 font-bold text-slate-400">{i + 1}</td>
                              <td className="p-3">
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{p.participant_name || p.name || p.nickname}</span>
                                  {p.isPublicRegistration && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                      <Globe className="w-2.5 h-2.5" /> ონლაინ
                                    </span>
                                  )}
                                </div>
                                {p.nickname && p.name && p.nickname !== p.name && (
                                  <div className="text-[11px] text-slate-400 font-mono">Tag: {p.nickname}</div>
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-400">{p.phone || '—'}</td>
                              <td className="p-3 font-mono font-semibold text-emerald-400">
                                {hasVoucher ? (
                                  <span className="flex items-center gap-1 text-purple-400 text-xs">
                                    <Gift className="w-3.5 h-3.5" /> 0 ₾ (ვაუჩერი)
                                  </span>
                                ) : (
                                  `${p.entry_fee ?? p.entryFee ?? currentTourney.entryFee} ₾`
                                )}
                              </td>
                              <td className="p-3">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    <Check className="w-3 h-3" /> გადახდილი ({p.payment_method || p.paymentMethod || 'CASH'})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    <AlertCircle className="w-3 h-3" /> გადასახდელი
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-500">
                                {p.created_at || p.registered_at ? new Date(p.created_at || p.registered_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isPaid && (
                                    <button
                                      id={`btn-mark-paid-${p.id}`}
                                      type="button"
                                      onClick={() => handleMarkParticipantPaid(p.id)}
                                      className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                                    >
                                      გადახდა
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParticipant(p.id)}
                                    title="მონაწილის წაშლა"
                                    className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">
                            მონაწილეები ჯერ არ დარეგისტრირებულან. გაუგზავნეთ სარეგისტრაციო ლინკი მოთამაშეებს!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              აირჩიეთ ტურნირი მარცხენა სიიდან
            </div>
          )}
        </div>
      </div>

      {/* ონლაინ რეგისტრაციების ნაკადი */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>ბმულით რეგისტრაციები</span>
            {onlineCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                {onlineCount} ონლაინ
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={fetchRegistrations}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="განახლება"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 min-w-[680px]">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">ტურნირი</th>
                <th className="p-3">მოთამაშე</th>
                <th className="p-3">ტელეფონი</th>
                <th className="p-3 text-center">წყარო</th>
                <th className="p-3 text-center">გადახდა</th>
                <th className="p-3">რეგისტრაცია</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {registrations.length > 0 ? registrations.slice(0, 25).map(r => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <td className="p-3">
                    <div className="font-semibold text-white">{r.tournamentName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{r.tournamentDate} • {r.startTime}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-100">{r.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{r.nickname}</div>
                  </td>
                  <td className="p-3 font-mono text-slate-400">{r.phone || '—'}</td>
                  <td className="p-3 text-center">
                    {r.isPublicRegistration ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Globe className="w-2.5 h-2.5" /> ბმული
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">ადგილზე</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      r.paymentStatus === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {r.paymentStatus === 'PAID' ? 'გადახდილი' : 'გადასახდელი'}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-500">
                    {new Date(r.registeredAt).toLocaleString('ka-GE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    რეგისტრაციები ჯერ არ არის — გააზიარეთ ტურნირის სარეგისტრაციო ბმული.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Tournament Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" /> ახალი ტურნირის შექმნა
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTournament} className="p-5 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">ტურნირის სახელი *</label>
                <input
                  type="text"
                  required
                  placeholder="მაგ: EA FC 25 Weekend Championship"
                  value={tName}
                  onChange={e => setTName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">თამაში *</label>
                  <input
                    type="text"
                    required
                    value={tGame}
                    onChange={e => setTGame(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">თარიღი *</label>
                  <input
                    type="date"
                    required
                    value={tDate}
                    onChange={e => setTDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">შესატანი (₾)</label>
                  <input
                    type="number"
                    min="0"
                    value={tFee}
                    onChange={e => setTFee(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">საპრიზო (₾)</label>
                  <input
                    type="number"
                    min="0"
                    value={tPrize}
                    onChange={e => setTPrize(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">მაქს. სლოტი</label>
                  <input
                    type="number"
                    min="2"
                    value={tMax}
                    onChange={e => setTMax(parseInt(e.target.value, 10) || 16)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">დაწყების დრო</label>
                <input
                  type="time"
                  value={tStartTime}
                  onChange={e => setTStartTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">აღწერა / წესები (არასავალდებულო)</label>
                <textarea
                  rows={2}
                  value={tDesc}
                  onChange={e => setTDesc(e.target.value)}
                  placeholder="მაგ: 1v1 ფორმატი, ჯგუფური ეტაპი + პლეიოფი..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  id="btn-submit-create-tourney"
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'იქმნება...' : 'ტურნირის შექმნა'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Participant Modal (Admin Manual Add) */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <h3 className="font-bold text-white text-base">მოთამაშის რეგისტრაცია</h3>
              <button onClick={() => setShowRegisterModal(false)} className="p-2 text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterParticipant} className="p-5 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">მოთამაშის სახელი / Nickname *</label>
                <input
                  type="text"
                  required
                  placeholder="მაგ: დავითი (Davit_7)"
                  value={pName}
                  onChange={e => setPName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">ტელეფონის ნომერი</label>
                <input
                  type="tel"
                  placeholder="5XX XX XX XX"
                  value={pPhone}
                  onChange={e => setPPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">ვაუჩერის კოდი (არასავალდებულო)</label>
                <input
                  type="text"
                  placeholder="მაგ: PR-ABC123"
                  value={pVoucher}
                  onChange={e => setPVoucher(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">შესატანი გადახდილია ({currentTourney?.entryFee ?? 0} ₾)</div>
                  <div className="text-[10px] text-slate-400">თანხა ავტომატურად შევა დღევანდელ სალაროში</div>
                </div>
                <input
                  type="checkbox"
                  checked={pPaid}
                  onChange={e => setPPaid(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
                />
              </div>

              {pPaid && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">გადახდის მეთოდი</label>
                  <select
                    value={pMethod}
                    onChange={e => setPMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="CASH">ნაღდი (CASH)</option>
                    <option value="CARD">ბარათი (CARD)</option>
                    <option value="TRANSFER">გადმორიცხვა (TRANSFER)</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  id="btn-submit-reg-participant"
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'რეგისტრირდება...' : 'დარეგისტრირება'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
