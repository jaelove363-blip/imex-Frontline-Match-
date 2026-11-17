import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Download, ShieldCheck, Trash2, ArrowUpDown } from 'lucide-react';
import {
  ADMIN_EMAIL,
  deleteGameResultAdmin,
  GameModeKey,
  GameResultRecord,
  subscribeAllResultsAdmin,
} from '../firebase';

interface AdminDashboardModalProps {
  isOpen: boolean;
  isAdminVerified: boolean;
  onClose: () => void;
  onResultDeleted?: (playerKey: string, mode: GameModeKey) => void;
}

type ViewScope = 'both' | 'match_board' | 'quick_quiz' | 'combined';
type SortOption = 'score_desc' | 'accuracy_desc' | 'time_asc' | 'latest';

interface GameSummaryStats {
  count: number;
  avgScore: number;
  topScore: number;
  avgAccuracy: number;
  avgSeconds: number;
  rankSCount: number;
}

interface CombinedPlayerRow {
  playerKey: string;
  fullName: string;
  game1Score: number | null;
  game1Rank: string | null;
  game1WrongAnswers: string[];
  game1Mistakes: number | null;
  game2Score: number | null;
  game2Rank: string | null;
  game2WrongAnswers: string[];
  game2Mistakes: number | null;
  totalScore: number;
  avgAccuracy: number;
  totalSeconds: number;
  gamesPlayedCount: number;
  latestMillis: number;
  latestTimestamp?: { toDate?: () => Date };
}

function formatTimestamp(ts?: { toDate?: () => Date }): string {
  if (!ts?.toDate) return '-';
  const d = ts.toDate();
  return d.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCreatedMillis(ts?: { toDate?: () => Date }): number {
  return ts?.toDate ? ts.toDate().getTime() : 0;
}

function formatWrongAnswersCsv(wrongAnswers?: string[], mistakes?: number | null): string {
  if (wrongAnswers && wrongAnswers.length > 0) {
    return wrongAnswers.join(' | ');
  }
  if (mistakes === null || mistakes === undefined) {
    return '-';
  }
  if (mistakes === 0) {
    return 'ตอบถูกหมด (0 ข้อ)';
  }
  return `ผิด ${mistakes} ครั้ง (ยังไม่มีบันทึกรายข้อ)`;
}

function computeGameStats(rows: GameResultRecord[]): GameSummaryStats {
  const count = rows.length;
  if (count === 0) {
    return {
      count: 0,
      avgScore: 0,
      topScore: 0,
      avgAccuracy: 0,
      avgSeconds: 0,
      rankSCount: 0,
    };
  }

  let totalScore = 0;
  let topScore = 0;
  let totalAccuracy = 0;
  let totalSeconds = 0;
  let rankSCount = 0;

  for (const r of rows) {
    totalScore += r.score;
    if (r.score > topScore) topScore = r.score;
    totalAccuracy += r.accuracy;
    totalSeconds += r.elapsedSeconds;
    if (r.rank === 'S') rankSCount += 1;
  }

  return {
    count,
    avgScore: Math.round(totalScore / count),
    topScore,
    avgAccuracy: Math.round(totalAccuracy / count),
    avgSeconds: Math.round(totalSeconds / count),
    rankSCount,
  };
}

function sortGameResults(rows: GameResultRecord[], sortBy: SortOption): GameResultRecord[] {
  return [...rows].sort((a, b) => {
    if (sortBy === 'score_desc') {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (a.elapsedSeconds !== b.elapsedSeconds) return a.elapsedSeconds - b.elapsedSeconds;
      return getCreatedMillis(b.createdAt) - getCreatedMillis(a.createdAt);
    }
    if (sortBy === 'accuracy_desc') {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (b.score !== a.score) return b.score - a.score;
      if (a.elapsedSeconds !== b.elapsedSeconds) return a.elapsedSeconds - b.elapsedSeconds;
      return getCreatedMillis(b.createdAt) - getCreatedMillis(a.createdAt);
    }
    if (sortBy === 'time_asc') {
      if (a.elapsedSeconds !== b.elapsedSeconds) return a.elapsedSeconds - b.elapsedSeconds;
      if (b.score !== a.score) return b.score - a.score;
      return b.accuracy - a.accuracy;
    }
    return getCreatedMillis(b.createdAt) - getCreatedMillis(a.createdAt);
  });
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  isAdminVerified,
  onClose,
  onResultDeleted,
}) => {
  const [viewScope, setViewScope] = useState<ViewScope>('both');
  const [sortBy, setSortBy] = useState<SortOption>('score_desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<GameResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !isAdminVerified) return;
    setLoading(true);
    setLoadError(null);

    const unsubResults = subscribeAllResultsAdmin(
      (data) => {
        setResults(data);
        setLoading(false);
      },
      (err) => {
        setLoadError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubResults();
    };
  }, [isOpen, isAdminVerified]);

  const rawGame1 = useMemo(
    () => results.filter((r) => r.mode === 'match_board'),
    [results]
  );

  const rawGame2 = useMemo(
    () => results.filter((r) => r.mode === 'quick_quiz'),
    [results]
  );

  const game1Stats = useMemo(() => computeGameStats(rawGame1), [rawGame1]);
  const game2Stats = useMemo(() => computeGameStats(rawGame2), [rawGame2]);

  const uniquePlayerCount = useMemo(() => {
    const keys = new Set(results.map((r) => r.playerKey));
    return keys.size;
  }, [results]);

  const sortedGame1 = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? rawGame1.filter((r) => r.fullName.toLowerCase().includes(q))
      : rawGame1;
    return sortGameResults(filtered, sortBy);
  }, [rawGame1, searchTerm, sortBy]);

  const sortedGame2 = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? rawGame2.filter((r) => r.fullName.toLowerCase().includes(q))
      : rawGame2;
    return sortGameResults(filtered, sortBy);
  }, [rawGame2, searchTerm, sortBy]);

  const sortedCombinedPlayers = useMemo(() => {
    const map = new Map<
      string,
      {
        playerKey: string;
        fullName: string;
        g1?: GameResultRecord;
        g2?: GameResultRecord;
      }
    >();

    for (const r of results) {
      const entry = map.get(r.playerKey) ?? {
        playerKey: r.playerKey,
        fullName: r.fullName,
      };
      if (r.mode === 'match_board' && !entry.g1) {
        entry.g1 = r;
      } else if (r.mode === 'quick_quiz' && !entry.g2) {
        entry.g2 = r;
      }
      map.set(r.playerKey, entry);
    }

    const q = searchTerm.trim().toLowerCase();
    const rows: CombinedPlayerRow[] = [];

    map.forEach((entry) => {
      if (q && !entry.fullName.toLowerCase().includes(q)) return;
      const g1 = entry.g1;
      const g2 = entry.g2;
      const count = (g1 ? 1 : 0) + (g2 ? 1 : 0);
      const totalScore = (g1?.score ?? 0) + (g2?.score ?? 0);
      const avgAccuracy =
        count > 0 ? Math.round(((g1?.accuracy ?? 0) + (g2?.accuracy ?? 0)) / count) : 0;
      const totalSeconds = (g1?.elapsedSeconds ?? 0) + (g2?.elapsedSeconds ?? 0);
      const g1Ms = getCreatedMillis(g1?.createdAt);
      const g2Ms = getCreatedMillis(g2?.createdAt);
      const latestMillis = Math.max(g1Ms, g2Ms);
      const latestTimestamp = g1Ms >= g2Ms ? g1?.createdAt : g2?.createdAt;

      rows.push({
        playerKey: entry.playerKey,
        fullName: entry.fullName,
        game1Score: g1 ? g1.score : null,
        game1Rank: g1 ? g1.rank : null,
        game1WrongAnswers: g1?.wrongAnswers ?? [],
        game1Mistakes: g1 ? g1.mistakes : null,
        game2Score: g2 ? g2.score : null,
        game2Rank: g2 ? g2.rank : null,
        game2WrongAnswers: g2?.wrongAnswers ?? [],
        game2Mistakes: g2 ? g2.mistakes : null,
        totalScore,
        avgAccuracy,
        totalSeconds,
        gamesPlayedCount: count,
        latestMillis,
        latestTimestamp,
      });
    });

    return rows.sort((a, b) => {
      if (sortBy === 'score_desc') {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.avgAccuracy !== a.avgAccuracy) return b.avgAccuracy - a.avgAccuracy;
        return a.totalSeconds - b.totalSeconds;
      }
      if (sortBy === 'accuracy_desc') {
        if (b.avgAccuracy !== a.avgAccuracy) return b.avgAccuracy - a.avgAccuracy;
        return b.totalScore - a.totalScore;
      }
      if (sortBy === 'time_asc') {
        if (a.totalSeconds !== b.totalSeconds) return a.totalSeconds - b.totalSeconds;
        return b.totalScore - a.totalScore;
      }
      return b.latestMillis - a.latestMillis;
    });
  }, [results, searchTerm, sortBy]);

  const visibleCount = useMemo(() => {
    if (viewScope === 'match_board') return sortedGame1.length;
    if (viewScope === 'quick_quiz') return sortedGame2.length;
    if (viewScope === 'combined') return sortedCombinedPlayers.length;
    return sortedGame1.length + sortedGame2.length;
  }, [sortedCombinedPlayers.length, sortedGame1.length, sortedGame2.length, viewScope]);

  const handleDeleteRow = async (row: GameResultRecord) => {
    if (deletingId) return;
    setDeletingId(row.id);
    try {
      await deleteGameResultAdmin(row.id, row.playerKey, row.mode);
      onResultDeleted?.(row.playerKey, row.mode);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => {
    let csvContent = '';

    if (viewScope === 'combined') {
      const headers = [
        'อันดับรวม',
        'ชื่อ-นามสกุล',
        'เล่นครบ',
        'คะแนนเกมที่ 1',
        'คะแนนเกมที่ 2',
        'คะแนนรวม 2 เกม',
        'ความแม่นยำเฉลี่ย (%)',
        'เวลารวม (วินาที)',
        'ข้อที่คลิกตอบผิด (เกม 1)',
        'ข้อที่คลิกตอบผิด (เกม 2)',
        'เล่นล่าสุด',
      ];
      const rows = sortedCombinedPlayers.map((p, idx) => [
        idx + 1,
        `"${p.fullName.replace(/"/g, '""')}"`,
        `${p.gamesPlayedCount}/2`,
        p.game1Score ?? '-',
        p.game2Score ?? '-',
        p.totalScore,
        p.avgAccuracy,
        p.totalSeconds,
        `"${formatWrongAnswersCsv(p.game1WrongAnswers, p.game1Mistakes).replace(/"/g, '""')}"`,
        `"${formatWrongAnswersCsv(p.game2WrongAnswers, p.game2Mistakes).replace(/"/g, '""')}"`,
        `"${formatTimestamp(p.latestTimestamp)}"`,
      ]);
      csvContent =
        '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    } else {
      const headers = [
        'รูปแบบเกม',
        'อันดับในเกม',
        'ชื่อ-นามสกุล',
        'คะแนน',
        'ความแม่นยำ (%)',
        'คอมโบสูงสุด',
        'ตอบถูก',
        'ผิดพลาด',
        'ข้อที่คลิกตอบผิด',
        'เวลา (วินาที)',
        'ระดับ',
        'วัน-เวลา',
      ];

      const toCsvRows = (list: GameResultRecord[], label: string) =>
        list.map((r, idx) => [
          `"${label}"`,
          idx + 1,
          `"${r.fullName.replace(/"/g, '""')}"`,
          r.score,
          r.accuracy,
          r.maxCombo,
          `${r.matchedCount}/4`,
          r.mistakes,
          `"${formatWrongAnswersCsv(r.wrongAnswers, r.mistakes).replace(/"/g, '""')}"`,
          r.elapsedSeconds,
          r.rank,
          `"${formatTimestamp(r.createdAt)}"`,
        ]);

      const rows = [
        ...(viewScope === 'quick_quiz'
          ? []
          : toCsvRows(sortedGame1, 'เกมที่ 1: จับคู่กระดาน 4x6')),
        ...(viewScope === 'match_board'
          ? []
          : toCsvRows(sortedGame2, 'เกมที่ 2: ดวลการ์ดจับผิด 60 วิ')),
      ];

      csvContent =
        '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `imex-frontline-scores-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const renderWrongAnswersDetail = (wrongAnswers?: string[], mistakes?: number | null) => {
    if (wrongAnswers && wrongAnswers.length > 0) {
      return (
        <ul className="space-y-1 text-xs text-rose-700 leading-snug">
          {wrongAnswers.map((item, idx) => (
            <li key={`${idx}-${item}`} className="flex items-start gap-1.5">
              <span className="font-mono-num text-rose-400 shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    }

    if (mistakes === null || mistakes === undefined) {
      return <span className="text-xs text-slate-400">ยังไม่ได้เล่น</span>;
    }

    if (mistakes === 0) {
      return <span className="text-xs font-medium text-emerald-700">ตอบถูกหมด (0 ข้อ)</span>;
    }

    return (
      <span className="text-xs text-amber-700">
        ผิด <span className="font-mono-num font-semibold">{mistakes}</span> ครั้ง (ยังไม่มีบันทึกรายข้อ)
      </span>
    );
  };

  const renderGameTable = (
    title: string,
    subtitle: string,
    rows: GameResultRecord[],
    accentClass: string
  ) => (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={`text-sm font-bold ${accentClass}`}>{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs font-mono-num font-semibold text-slate-700">
          ทั้งหมด {rows.length} คน
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          ยังไม่มีข้อมูลผู้เล่นในเกมนี้
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 bg-white">
                <th className="py-2.5 pl-4 pr-2 font-semibold w-14">อันดับ</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">ชื่อ - นามสกุล</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">คะแนน</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">ความแม่นยำ</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">คอมโบ</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">เวลา</th>
                <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">ระดับ</th>
                <th className="py-2.5 px-3 font-semibold min-w-[230px]">ข้อที่คลิกตอบผิด</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">วันที่เล่น</th>
                <th className="py-2.5 pl-2 pr-4 font-semibold text-right whitespace-nowrap">ปลดล็อก/ลบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, idx) => {
                const rankOrder = idx + 1;
                const rankOrderColor =
                  rankOrder === 1
                    ? 'text-amber-600 font-extrabold'
                    : rankOrder === 2
                    ? 'text-slate-700 font-bold'
                    : rankOrder === 3
                    ? 'text-orange-700 font-bold'
                    : 'text-slate-500';

                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className={`py-2.5 pl-4 pr-2 align-top font-mono-num text-sm ${rankOrderColor}`}>
                      #{rankOrder}
                    </td>
                    <td className="py-2.5 px-3 align-top font-semibold text-slate-900 whitespace-nowrap">
                      {r.fullName}
                    </td>
                    <td className="py-2.5 px-3 align-top text-right font-mono-num font-bold text-sky-700">
                      {r.score}
                    </td>
                    <td className="py-2.5 px-3 align-top text-right font-mono-num font-semibold text-emerald-700">
                      {r.accuracy}%
                    </td>
                    <td className="py-2.5 px-3 align-top text-right font-mono-num text-slate-600">
                      x{r.maxCombo}
                    </td>
                    <td className="py-2.5 px-3 align-top text-right font-mono-num text-slate-600 whitespace-nowrap">
                      {r.elapsedSeconds}s
                    </td>
                    <td className="py-2.5 px-3 align-top text-center font-mono-num font-bold text-slate-900">
                      {r.rank}
                    </td>
                    <td className="py-2.5 px-3 align-top max-w-[340px]">
                      {renderWrongAnswersDetail(r.wrongAnswers, r.mistakes)}
                    </td>
                    <td className="py-2.5 px-3 align-top text-right text-xs text-slate-500 whitespace-nowrap">
                      {formatTimestamp(r.createdAt)}
                    </td>
                    <td className="py-2.5 pl-2 pr-4 align-top text-right">
                      <button
                        type="button"
                        disabled={deletingId === r.id}
                        onClick={() => handleDeleteRow(r)}
                        title="ลบคะแนนและปลดล็อกสิทธิ์เกมนี้ให้ผู้เล่น"
                        aria-label={`ลบผลคะแนนของ ${r.fullName}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-40 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
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
      )}
    </section>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-card-enter">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0F214D] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-sky-300" />
            </div>
            <div className="min-w-0">
              <h2 id="admin-modal-title" className="text-lg font-bold truncate">
                สรุปผลคะแนนแยกตามเกม (Admin Only)
              </h2>
              <p className="text-xs text-sky-200 truncate">
                {ADMIN_EMAIL} · ผู้เล่นทั้งหมด{' '}
                <span className="font-mono-num font-semibold text-white">{uniquePlayerCount}</span> คน ·
                บันทึกผล{' '}
                <span className="font-mono-num font-semibold text-white">{results.length}</span> รายการ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง Admin"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isAdminVerified ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-base font-bold text-rose-600">ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้</p>
            <p className="text-sm text-slate-600">
              รายงานคะแนนพนักงานทั้งหมดสงวนไว้สำหรับบัญชีผู้ดูแลระบบ ({ADMIN_EMAIL}) เพียงคนเดียวเท่านั้น
            </p>
          </div>
        ) : (
          <>
            {/* Split Summary Cards: Game 1 vs Game 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200 bg-slate-50 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Game 1 Summary */}
              <div className="p-4 sm:px-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-sky-700">
                      เกมที่ 1 · จับคู่กระดาน 4×6
                    </p>
                    <p className="text-[11px] text-slate-500">
                      โจทย์จับคู่ภาพวิธีแก้ปัญหาหน้างาน (ไม่จับเวลา)
                    </p>
                  </div>
                  <span className="text-xs font-mono-num font-semibold text-slate-700">
                    ระดับ S: {game1Stats.rankSCount} คน
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <p className="text-[11px] text-slate-500">ผู้เล่น</p>
                    <p className="text-lg font-bold font-mono-num text-slate-900">
                      {game1Stats.count}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">สูงสุด</p>
                    <p className="text-lg font-bold font-mono-num text-sky-700">
                      {game1Stats.topScore}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">เฉลี่ย</p>
                    <p className="text-lg font-bold font-mono-num text-slate-900">
                      {game1Stats.avgScore}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">แม่นยำ / เวลา</p>
                    <p className="text-sm font-bold font-mono-num text-emerald-700 mt-1">
                      {game1Stats.avgAccuracy}% · {game1Stats.avgSeconds}s
                    </p>
                  </div>
                </div>
              </div>

              {/* Game 2 Summary */}
              <div className="p-4 sm:px-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-amber-700">
                      เกมที่ 2 · ดวลการ์ดจับผิด 60 วิ
                    </p>
                    <p className="text-[11px] text-slate-500">
                      โจทย์จับผิดพฤติกรรมเสี่ยงหน้างาน (จับเวลา 60 วินาที)
                    </p>
                  </div>
                  <span className="text-xs font-mono-num font-semibold text-slate-700">
                    ระดับ S: {game2Stats.rankSCount} คน
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <p className="text-[11px] text-slate-500">ผู้เล่น</p>
                    <p className="text-lg font-bold font-mono-num text-slate-900">
                      {game2Stats.count}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">สูงสุด</p>
                    <p className="text-lg font-bold font-mono-num text-amber-700">
                      {game2Stats.topScore}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">เฉลี่ย</p>
                    <p className="text-lg font-bold font-mono-num text-slate-900">
                      {game2Stats.avgScore}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">แม่นยำ / เวลา</p>
                    <p className="text-sm font-bold font-mono-num text-emerald-700 mt-1">
                      {game2Stats.avgAccuracy}% · {game2Stats.avgSeconds}s
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Toolbar: Scope Tabs, Search, Sort, Export */}
            <div className="px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setViewScope('both')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewScope === 'both'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  แยกสรุปทั้ง 2 เกม ({sortedGame1.length + sortedGame2.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope('match_board')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewScope === 'match_board'
                      ? 'bg-white text-sky-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  เกมที่ 1 ({sortedGame1.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope('quick_quiz')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewScope === 'quick_quiz'
                      ? 'bg-white text-amber-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  เกมที่ 2 ({sortedGame2.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope('combined')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewScope === 'combined'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  รวมคะแนนต่อคน ({sortedCombinedPlayers.length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ค้นหาชื่อ-นามสกุล..."
                    className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 w-44"
                  />
                </div>

                <div className="relative flex items-center">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="เรียงลำดับผลคะแนน"
                    className="pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="score_desc">เรียง: คะแนนมาก → น้อย</option>
                    <option value="accuracy_desc">เรียง: ความแม่นยำมาก → น้อย</option>
                    <option value="time_asc">เรียง: ใช้เวลาน้อย → มาก</option>
                    <option value="latest">เรียง: เล่นล่าสุดก่อน</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={visibleCount === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  ส่งออก CSV
                </button>
              </div>
            </div>

            {/* Ranked Tables Area */}
            <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-50/50">
              {loading ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  กำลังโหลดข้อมูลคะแนนทั้งหมด...
                </div>
              ) : loadError ? (
                <div className="py-12 text-center text-sm text-rose-600">
                  ไม่สามารถโหลดข้อมูลได้: {loadError}
                </div>
              ) : viewScope === 'combined' ? (
                <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-800">
                        อันดับคะแนนรวมต่อคน (เกมที่ 1 + เกมที่ 2)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        สรุปผลรวมของพนักงานแต่ละคนจากการเล่นทั้ง 2 เกม
                      </p>
                    </div>
                    <span className="text-xs font-mono-num font-semibold text-slate-700">
                      ทั้งหมด {sortedCombinedPlayers.length} คน
                    </span>
                  </div>

                  {sortedCombinedPlayers.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                      ยังไม่มีข้อมูลผู้เล่นในระบบ
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs text-slate-500 bg-white">
                            <th className="py-2.5 pl-4 pr-2 font-semibold w-14">อันดับ</th>
                            <th className="py-2.5 px-3 font-semibold whitespace-nowrap">ชื่อ - นามสกุล</th>
                            <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">เล่นครบ</th>
                            <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">เกมที่ 1</th>
                            <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">เกมที่ 2</th>
                            <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">คะแนนรวม</th>
                            <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">แม่นยำเฉลี่ย</th>
                            <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">เวลารวม</th>
                            <th className="py-2.5 px-3 font-semibold min-w-[250px]">ข้อที่คลิกตอบผิด</th>
                            <th className="py-2.5 pl-3 pr-4 font-semibold text-right whitespace-nowrap">เล่นล่าสุด</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sortedCombinedPlayers.map((p, idx) => {
                            const rankOrder = idx + 1;
                            const rankOrderColor =
                              rankOrder === 1
                                ? 'text-amber-600 font-extrabold'
                                : rankOrder === 2
                                ? 'text-slate-700 font-bold'
                                : rankOrder === 3
                                ? 'text-orange-700 font-bold'
                                : 'text-slate-500';
                            return (
                              <tr key={p.playerKey} className="hover:bg-slate-50 transition-colors">
                                <td className={`py-2.5 pl-4 pr-2 align-top font-mono-num text-sm ${rankOrderColor}`}>
                                  #{rankOrder}
                                </td>
                                <td className="py-2.5 px-3 align-top font-semibold text-slate-900 whitespace-nowrap">
                                  {p.fullName}
                                </td>
                                <td className="py-2.5 px-3 align-top text-center font-mono-num text-xs font-semibold text-slate-700">
                                  {p.gamesPlayedCount}/2
                                </td>
                                <td className="py-2.5 px-3 align-top text-right font-mono-num text-sky-700 font-semibold whitespace-nowrap">
                                  {p.game1Score !== null ? `${p.game1Score} (${p.game1Rank})` : '-'}
                                </td>
                                <td className="py-2.5 px-3 align-top text-right font-mono-num text-amber-700 font-semibold whitespace-nowrap">
                                  {p.game2Score !== null ? `${p.game2Score} (${p.game2Rank})` : '-'}
                                </td>
                                <td className="py-2.5 px-3 align-top text-right font-mono-num font-bold text-slate-900">
                                  {p.totalScore}
                                </td>
                                <td className="py-2.5 px-3 align-top text-right font-mono-num font-semibold text-emerald-700">
                                  {p.avgAccuracy}%
                                </td>
                                <td className="py-2.5 px-3 align-top text-right font-mono-num text-slate-600 whitespace-nowrap">
                                  {p.totalSeconds}s
                                </td>
                                <td className="py-2.5 px-3 align-top max-w-[360px] space-y-1.5">
                                  {p.game1Score !== null && (
                                    <div>
                                      <p className="text-[11px] font-bold text-sky-800">เกมที่ 1:</p>
                                      {renderWrongAnswersDetail(p.game1WrongAnswers, p.game1Mistakes)}
                                    </div>
                                  )}
                                  {p.game2Score !== null && (
                                    <div>
                                      <p className="text-[11px] font-bold text-amber-800">เกมที่ 2:</p>
                                      {renderWrongAnswersDetail(p.game2WrongAnswers, p.game2Mistakes)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 pl-3 pr-4 align-top text-right text-xs text-slate-500 whitespace-nowrap">
                                  {formatTimestamp(p.latestTimestamp)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : (
                <>
                  {(viewScope === 'both' || viewScope === 'match_board') &&
                    renderGameTable(
                      'เกมที่ 1 : จับคู่กระดาน 4×6',
                      'เรียงลำดับผู้เล่นในเกมจับคู่ภาพแก้ปัญหาหน้างาน',
                      sortedGame1,
                      'text-sky-800'
                    )}

                  {(viewScope === 'both' || viewScope === 'quick_quiz') &&
                    renderGameTable(
                      'เกมที่ 2 : ดวลการ์ดจับผิด 60 วิ',
                      'เรียงลำดับผู้เล่นในเกมจับผิดพฤติกรรมเสี่ยงหน้างาน',
                      sortedGame2,
                      'text-amber-800'
                    )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
