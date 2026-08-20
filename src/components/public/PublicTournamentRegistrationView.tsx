import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Gamepad2,
  Calendar,
  Clock,
  Users,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Flame,
  Gamepad,
  RefreshCw,
  Gift
} from 'lucide-react';

interface PublicTournamentData {
  id: string;
  name: string;
  description: string;
  game: string;
  gameName: string;
  deviceCategory: string;
  tournamentDate: string;
  date: string;
  startTime: string;
  maxParticipants: number;
  entryFee: number;
  prizePool: string;
  status: string;
  notes: string;
  participantsCount: number;
  slotsLeft: number;
  isFull: boolean;
  registrationOpen: boolean;
}

interface Props {
  tournamentId: string;
  onGoToApp?: () => void;
}

export const PublicTournamentRegistrationView: React.FC<Props> = ({ tournamentId, onGoToApp }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<PublicTournamentData | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  
  // Voucher State
  const [voucherCode, setVoucherCode] = useState('');
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
  const [voucherResult, setVoucherResult] = useState<{ valid: boolean; message: string; discountDesc?: string } | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<{
    participantId: string;
    tournamentName: string;
    game: string;
    date: string;
    startTime: string;
    entryFee: number;
    paymentStatus: string;
    voucherApplied: boolean;
  } | null>(null);

  const fetchTournament = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tournaments/public/${tournamentId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ტურნირის მონაცემების ჩატვირთვა ვერ მოხერხდა.');
      }

      setTournament(data.tournament);
    } catch (err: any) {
      setError(err.message || 'შეცდომა სერვერთან კავშირისას');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tournamentId) {
      fetchTournament();
    }
  }, [tournamentId]);

  const handleCheckVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherResult({ valid: false, message: 'შეიყვანეთ ვაუჩერის კოდი' });
      return;
    }

    try {
      setIsCheckingVoucher(true);
      setVoucherResult(null);
      const res = await fetch(`/api/vouchers/check/${encodeURIComponent(voucherCode.trim())}`);
      const data = await res.json();

      if (res.ok && data.valid) {
        setVoucherResult({
          valid: true,
          message: 'ვაუჩერი მოქმედია!',
          discountDesc: 'ტურნირის შესატანი სრულად დაფარულია ვაუჩერით (100% ფასდაკლება)'
        });
      } else {
        setVoucherResult({
          valid: false,
          message: data.error || 'ვაუჩერი არ არის აქტიური ან ვადაგასულია.'
        });
      }
    } catch {
      setVoucherResult({ valid: false, message: 'ვაუჩერის გადამოწმება ვერ მოხერხდა.' });
    } finally {
      setIsCheckingVoucher(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !nickname.trim() || !phone.trim()) {
      setSubmitError('გთხოვთ შეავსოთ ყველა აუცილებელი ველი (*)');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const res = await fetch(`/api/tournaments/public/${tournamentId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: surname.trim() ? `${name.trim()} ${surname.trim()}` : name.trim(),
          name: name.trim(),
          surname: surname.trim(),
          nickname: nickname.trim(),
          phone: phone.trim(),
          voucherCode: voucherCode.trim() || undefined,
          notes: notes.trim() || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'რეგისტრაცია ვერ მოხერხდა.');
      }

      setRegistrationSuccess(data);
      // Refresh tournament slots
      fetchTournament();
    } catch (err: any) {
      setSubmitError(err.message || 'დაფიქსირდა შეცდომა');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div id="public-reg-loading" className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse">ტურნირის მონაცემები იტვირთება...</p>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div id="public-reg-error" className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">ტურნირი ვერ მოიძებნა</h2>
          <p className="text-slate-400 text-sm">{error || 'აღნიშნული ტურნირის ბმული არასწორია ან ტურნირი წაიშალა.'}</p>
          <div className="pt-4 flex flex-col gap-2">
            <button
              id="btn-retry-tournament"
              onClick={fetchTournament}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> ხელახლა ცდა
            </button>
            {onGoToApp && (
              <button
                id="btn-back-to-portal"
                onClick={onGoToApp}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
              >
                მთავარ გვერდზე გადასვლა
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Registration Success Ticket Screen
  if (registrationSuccess) {
    return (
      <div id="public-reg-success" className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">რეგისტრაცია დადასტურებულია!</h2>
            <p className="text-slate-300 text-sm sm:text-base">
              მოთამაშე <span className="text-emerald-400 font-semibold">{nickname}</span> წარმატებით დარეგისტრირდა.
            </p>
          </div>

          {/* Ticket Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-white text-base">{tournament.name}</span>
              </div>
              <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold">
                {tournament.game}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">თარიღი</span>
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" /> {tournament.tournamentDate || tournament.date}
                </span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">დაწყების დრო</span>
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" /> {tournament.startTime}
                </span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">შესატანი თანხა</span>
                <span className="font-semibold text-emerald-400">
                  {registrationSuccess.voucherApplied ? (
                    <span className="flex items-center gap-1">
                      <Gift className="w-3.5 h-3.5" /> 0 ₾ (ვაუჩერი)
                    </span>
                  ) : (
                    `${tournament.entryFee > 0 ? `${tournament.entryFee} ₾` : 'უფასო'}`
                  )}
                </span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">საპრიზო ფონდი</span>
                <span className="font-semibold text-amber-400 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" /> {tournament.prizePool}
                </span>
              </div>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> რეგისტრაციის ID: {registrationSuccess.participantId}
              </div>
              <p className="text-slate-400 text-[11px]">
                გთხოვთ მობრძანდეთ ტურნირის დაწყებამდე 15 წუთით ადრე დარბაზში.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              id="btn-register-another"
              onClick={() => {
                setRegistrationSuccess(null);
                setName('');
                setSurname('');
                setNickname('');
                setPhone('');
                setNotes('');
                setVoucherCode('');
                setVoucherResult(null);
              }}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium text-sm transition-colors text-center"
            >
              სხვა მოთამაშის რეგისტრაცია
            </button>
            {onGoToApp && (
              <button
                id="btn-finish-success"
                onClick={onGoToApp}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition-colors text-center"
              >
                ადმინ პანელში შესვლა
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isFull = tournament.isFull;
  const isClosed = tournament.status !== 'REGISTRATION_OPEN';

  return (
    <div id="public-tournament-registration-page" className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Gamepad className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase block">Play Room Arena Tbilisi</span>
              <h1 className="text-lg font-bold text-white">ტურნირზე რეგისტრაცია</h1>
            </div>
          </div>
          {onGoToApp && (
            <button
              id="btn-header-admin-login"
              onClick={onGoToApp}
              className="text-xs text-slate-400 hover:text-indigo-300 transition-colors py-1.5 px-3 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700"
            >
              ადმინ პორტალი
            </button>
          )}
        </div>

        {/* Tournament Hero Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient light */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                {tournament.game}
              </div>

              <div className="flex items-center gap-2">
                {isClosed ? (
                  <span className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> რეგისტრაცია დახურულია
                  </span>
                ) : isFull ? (
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" /> ადგილები შევსებულია ({tournament.maxParticipants}/{tournament.maxParticipants})
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> რეგისტრაცია ღიაა ({tournament.slotsLeft} ადგილი დარჩა)
                  </span>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">{tournament.name}</h2>
              {tournament.description && (
                <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed max-w-2xl">
                  {tournament.description}
                </p>
              )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
                <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" /> თარიღი
                </span>
                <span className="text-base font-bold text-white">{tournament.tournamentDate || tournament.date}</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
                <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> დაწყება
                </span>
                <span className="text-base font-bold text-white">{tournament.startTime}</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
                <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" /> საპრიზო ფონდი
                </span>
                <span className="text-base font-bold text-amber-400">{tournament.prizePool}</span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
                <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                  <Ticket className="w-3.5 h-3.5 text-emerald-400" /> შესატანი
                </span>
                <span className="text-base font-bold text-emerald-400">
                  {tournament.entryFee > 0 ? `${tournament.entryFee} ₾` : 'უფასო'}
                </span>
              </div>
            </div>

            {/* Slots Progress */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>დარეგისტრირებული მოთამაშეები</span>
                <span className="text-white font-bold">{tournament.participantsCount} / {tournament.maxParticipants}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, (tournament.participantsCount / tournament.maxParticipants) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Registration Form Card */}
        {isClosed || isFull ? (
          <div id="public-reg-closed-notice" className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">
              {isFull ? 'ადგილები შევსებულია' : 'რეგისტრაცია დროებით შეჩერებულია'}
            </h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              {isFull
                ? 'ამ ტურნირზე ყველა სლოტი უკვე დაკავებულია. დაელოდეთ მომდევნო ტურნირების გამოცხადებას.'
                : 'რეგისტრაცია ამ ეტაპზე დახურულია. დეტალებისთვის დაუკავშირდით ადმინისტრაციას.'}
            </p>
          </div>
        ) : (
          <div id="public-reg-form-card" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" /> შეავსეთ სარეგისტრაციო ანკეტა
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                შეიყვანეთ თქვენი საკონტაქტო და სათამაშო მონაცემები ტურნირში მონაწილეობის მისაღებად.
              </p>
            </div>

            {submitError && (
              <div id="reg-submit-error-banner" className="p-4 bg-red-500/15 border border-red-500/30 rounded-2xl text-red-300 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    სახელი <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="input-reg-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="მაგ: გიორგი"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    გვარი (არასავალდებულო)
                  </label>
                  <input
                    id="input-reg-surname"
                    type="text"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    placeholder="მაგ: ბერიძე"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Gamer Tag / ნიკნეიმი <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="input-reg-nickname"
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="მაგ: GeoWarrior99"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    ტელეფონის ნომერი <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="input-reg-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="მაგ: 599 12 34 56"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm outline-none transition-all"
                  />
                </div>
              </div>

              {/* Voucher / Promo Code Section */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Gift className="w-4 h-4 text-indigo-400" /> ვაუჩერის / პრომო კოდის რეგისტრაცია
                  </label>
                  <span className="text-[11px] text-slate-500">თუ გაქვთ კლუბის ვაუჩერი</span>
                </div>

                <div className="flex gap-2">
                  <input
                    id="input-reg-voucher"
                    type="text"
                    value={voucherCode}
                    onChange={(e) => {
                      setVoucherCode(e.target.value.toUpperCase());
                      setVoucherResult(null);
                    }}
                    placeholder="მაგ: PR-ABC123"
                    className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm font-mono tracking-wider outline-none"
                  />
                  <button
                    id="btn-check-voucher"
                    type="button"
                    onClick={handleCheckVoucher}
                    disabled={isCheckingVoucher || !voucherCode.trim()}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5"
                  >
                    {isCheckingVoucher ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    შემოწმება
                  </button>
                </div>

                {voucherResult && (
                  <div
                    id="voucher-check-result"
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                      voucherResult.valid
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/15 border border-red-500/30 text-red-300'
                    }`}
                  >
                    {voucherResult.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold block">{voucherResult.message}</span>
                      {voucherResult.discountDesc && (
                        <span className="text-[11px] text-emerald-400/90 block mt-0.5">{voucherResult.discountDesc}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  შენიშვნა / კომენტარი (არასავალდებულო)
                </label>
                <textarea
                  id="input-reg-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="მაგ: სასურველი სათამაშო მხარე, კონტროლერის პარამეტრები..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm outline-none resize-none transition-all"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  id="btn-submit-registration"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-base transition-all disabled:opacity-50 active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      რეგისტრაცია მუშავდება...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-5 h-5 text-amber-300" />
                      რეგისტრაციის დასრულება
                      <ArrowRight className="w-5 h-5 ml-1" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center">
                <span className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> მონაცემები დაცულია და ინახება Play Room Arena-ს ბაზაში
                </span>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 py-4">
          © {new Date().getFullYear()} Play Room Club Tbilisi. ყველა უფლება დაცულია.
        </div>
      </div>
    </div>
  );
};
