import React from 'react';
import { CheckCircle2, Trophy, Lock, ArrowRight, LogOut } from 'lucide-react';
import {
  GAME2_CHALLENGES,
  SCENARIO_QUESTIONS,
  SOLUTION_CARDS,
} from '../data/scenarios';
import { GameModeKey } from '../firebase';

interface VictoryModalProps {
  isOpen: boolean;
  reason: 'completed' | 'timeout';
  gameMode: GameModeKey;
  otherModeAvailable: boolean;
  playerName?: string;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  score: number;
  maxCombo: number;
  mistakes: number;
  matchedCount: number;
  elapsedSeconds: number;
  onPlayOtherGame: () => void;
  onFinishToLockedHome: () => void;
  onReturnToLogin: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  isOpen,
  reason,
  gameMode,
  otherModeAvailable,
  playerName,
  saveStatus = 'idle',
  score,
  maxCombo,
  mistakes,
  matchedCount,
  elapsedSeconds,
  onPlayOtherGame,
  onFinishToLockedHome,
  onReturnToLogin,
}) => {
  if (!isOpen) return null;

  const totalAttempts = matchedCount + mistakes;
  const accuracy = totalAttempts > 0 ? Math.round((matchedCount / totalAttempts) * 100) : 100;

  let rankLabel = 'ระดับ A · มือโปรหน้างาน';
  if (reason === 'completed' && mistakes === 0) {
    rankLabel = 'ระดับ S · ตัวท็อป imex';
  } else if (reason === 'timeout' || accuracy < 65) {
    rankLabel = 'ระดับ B · พร้อมลุยต่อ';
  }

  const otherGameLabel =
    gameMode === 'match_board'
      ? 'เล่นเกมที่ 2 ต่อเลย (ดวลการ์ดจับผิด 60 วิ)'
      : 'เล่นเกมที่ 1 ต่อเลย (จับคู่กระดาน 4×6)';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-card-enter">
        {/* Top Thank-You Header */}
        <div className="px-6 py-5 bg-[#0F214D] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <p className="text-xs text-sky-200 font-medium">
                {playerName ? `ผู้เล่น: ${playerName} · ` : ''}
                {rankLabel}
              </p>
              <h2 id="victory-modal-title" className="text-xl font-bold font-display">
                {otherModeAvailable
                  ? 'ขอบคุณที่ร่วมสนุกในเกมนี้!'
                  : 'ขอบคุณที่ร่วมสนุกครบทั้ง 2 เกม!'}
              </h2>
              <p className="text-xs text-sky-100 mt-0.5">
                {reason === 'completed'
                  ? 'คุณทำภารกิจครบทุกข้อเรียบร้อยแล้ว'
                  : 'หมดเวลาการแข่งขัน ระบบได้สรุปคะแนนของคุณแล้ว'}
              </p>
              {saveStatus === 'saving' && (
                <p className="text-[11px] text-sky-300 mt-1">กำลังบันทึกผลคะแนนเข้าระบบ...</p>
              )}
              {saveStatus === 'saved' && (
                <p className="text-[11px] text-emerald-300 mt-1">
                  บันทึกผลคะแนนเข้าระบบเรียบร้อยแล้ว
                </p>
              )}
              {saveStatus === 'error' && (
                <p className="text-[11px] text-amber-300 mt-1">
                  บันทึกคะแนนบนเครื่องแล้ว (การเชื่อมต่อฐานข้อมูลขัดข้องชั่วคราว)
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <div>
              <p className="text-[11px] text-sky-200">คะแนนรวม</p>
              <p className="text-2xl font-bold font-mono-num text-white">{score}</p>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div>
              <p className="text-[11px] text-sky-200">ความแม่นยำ</p>
              <p className="text-2xl font-bold font-mono-num text-emerald-300">{accuracy}%</p>
            </div>
          </div>
        </div>

        {/* Sub-metrics strip */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-center py-3 px-4">
          <div>
            <p className="text-xs text-slate-500">ตอบถูกสำเร็จ</p>
            <p className="text-base font-bold font-mono-num text-slate-900">
              {matchedCount} / 4
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">คอมโบสูงสุด</p>
            <p className="text-base font-bold font-mono-num text-sky-700">x{maxCombo}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">เวลาที่ใช้</p>
            <p className="text-base font-bold font-mono-num text-slate-900">{elapsedSeconds}s</p>
          </div>
        </div>

        {/* Solution Breakdown matching the played Game Mode */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-800 mb-2">
            {gameMode === 'match_board'
              ? 'สรุปเฉลยเกมที่ 1: จับคู่แนวทางแก้ปัญหาหน้างาน'
              : 'สรุปเฉลยเกมที่ 2: จับผิดจุดเสี่ยงและพฤติกรรมหน้างาน'}
          </h3>

          {gameMode === 'match_board'
            ? SCENARIO_QUESTIONS.map((q) => {
                const sol = SOLUTION_CARDS.find((s) => s.id === q.correctSolutionId);
                if (!sol) return null;
                return (
                  <div
                    key={q.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2.5 shrink-0">
                      <img
                        src={q.imageUrl}
                        alt={q.title}
                        referrerPolicy="no-referrer"
                        className="w-20 aspect-[4/3] object-cover rounded-lg bg-slate-200"
                      />
                      <span className="text-xs font-bold text-slate-400">→</span>
                      <img
                        src={sol.imageUrl}
                        alt={sol.title}
                        referrerPolicy="no-referrer"
                        className="w-20 aspect-[4/3] object-cover rounded-lg bg-slate-200 ring-2 ring-emerald-500"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{q.title}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900">{sol.title}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{sol.feedbackDetail}</p>
                    </div>
                  </div>
                );
              })
            : GAME2_CHALLENGES.map((ch) => {
                const sol = SOLUTION_CARDS.find((s) => s.id === ch.correctChoiceId);
                if (!sol) return null;
                return (
                  <div
                    key={ch.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70"
                  >
                    <div className="flex items-center gap-2.5 shrink-0">
                      <img
                        src={ch.imageUrl}
                        alt={ch.title}
                        referrerPolicy="no-referrer"
                        className="w-20 aspect-[4/3] object-cover rounded-lg bg-slate-200"
                      />
                      <span className="text-xs font-bold text-slate-400">→</span>
                      <img
                        src={sol.imageUrl}
                        alt={sol.title}
                        referrerPolicy="no-referrer"
                        className="w-20 aspect-[4/3] object-cover rounded-lg bg-slate-200 ring-2 ring-emerald-500"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{ch.title}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900">{sol.title}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{ch.successDetail}</p>
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Footer: Either proceed to remaining game OR complete both games */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              {otherModeAvailable
                ? 'บันทึกคะแนนเกมนี้แล้ว · ยังเล่นอีกเกมที่เหลือได้อีก 1 เกม'
                : 'คุณได้ร่วมสนุกครบทั้ง 2 เกมแล้ว (ไม่สามารถเล่นซ้ำได้อีก)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onFinishToLockedHome}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              กลับหน้าหลัก
            </button>

            <button
              type="button"
              onClick={onReturnToLogin}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                otherModeAvailable
                  ? 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-100'
                  : 'text-white bg-[#0F214D] hover:bg-[#16306e]'
              }`}
            >
              <LogOut className="w-4 h-4" />
              กลับหน้าเข้าสู่ระบบเกม
            </button>

            {otherModeAvailable && (
              <button
                type="button"
                onClick={onPlayOtherGame}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-[#0F214D] hover:bg-[#16306e] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{otherGameLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
