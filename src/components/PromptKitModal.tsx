import React, { useState } from 'react';
import { X, Copy, Check, BookOpen } from 'lucide-react';
import {
  PROMPT_SYSTEM_GUIDE,
  SCENARIO_QUESTIONS,
  SOLUTION_CARDS,
  UNIFORM_REFERENCE_PATH,
} from '../data/scenarios';

interface PromptKitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PromptTab = 'guide' | 'questions' | 'solutions' | 'decoys';

export const PromptKitModal: React.FC<PromptKitModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<PromptTab>('guide');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const correctSolutions = SOLUTION_CARDS.filter((c) => !c.isDecoy);
  const decoySolutions = SOLUTION_CARDS.filter((c) => c.isDecoy);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-kit-title"
    >
      <div className="relative w-full max-w-4xl max-h-[88vh] flex flex-col bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-5 h-5 text-sky-600 shrink-0" />
            <div className="min-w-0">
              <h2 id="prompt-kit-title" className="text-lg font-bold text-slate-900 truncate">
                แนวคิดการสร้างเกม & คลัง Prompt สร้างภาพ
              </h2>
              <p className="text-xs text-slate-500 truncate">
                โครงสร้าง Prompt มาตรฐานพร้อมเสื้อโปโล imex สำหรับสร้างการ์ดชุดใหม่เพิ่มเติม
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Filter Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-1.5">
          {[
            { id: 'guide', label: 'โครงสร้าง Prompt หลัก' },
            { id: 'questions', label: `ภาพคำถาม (${SCENARIO_QUESTIONS.length})` },
            { id: 'solutions', label: `ภาพคำตอบที่ถูก (${correctSolutions.length})` },
            { id: 'decoys', label: `ภาพคำตอบหลอก (${decoySolutions.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as PromptTab)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'guide' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="aspect-square rounded-lg overflow-hidden bg-white mb-2">
                    <img
                      src={UNIFORM_REFERENCE_PATH}
                      alt="เสื้อโปโล imex ต้นแบบ"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-xs font-semibold text-slate-800 text-center">
                    เสื้อต้นแบบพนักงาน imex
                  </p>
                  <p className="text-[11px] text-slate-500 text-center">
                    ใช้แนบเป็น Image Reference ทุกครั้ง
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      {PROMPT_SYSTEM_GUIDE.conceptTitle}
                    </h3>
                    <p className="text-sm text-slate-600">
                      กลุ่มเป้าหมาย: {PROMPT_SYSTEM_GUIDE.targetAudience}
                    </p>
                  </div>

                  <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
                    {PROMPT_SYSTEM_GUIDE.whyItWorks.map((point, idx) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      1. สูตรลายเส้นตัวละครวัยรุ่นทันสมัย (อ้างอิงคนจริง)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('style', PROMPT_SYSTEM_GUIDE.artStyleFormula)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedId === 'style' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          คัดลอกแล้ว
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          คัดลอก
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-mono text-slate-700 leading-relaxed">
                    {PROMPT_SYSTEM_GUIDE.artStyleFormula}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      2. คีย์เวิร์ดบังคับชุดยูนิฟอร์ม imex (วางต่อท้ายชื่อตัวละคร)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('uniform', PROMPT_SYSTEM_GUIDE.uniformAnchor)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedId === 'uniform' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          คัดลอกแล้ว
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          คัดลอก
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-mono text-slate-700 leading-relaxed">
                    {PROMPT_SYSTEM_GUIDE.uniformAnchor}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-4">
              {SCENARIO_QUESTIONS.map((q) => (
                <div
                  key={q.id}
                  className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70"
                >
                  <img
                    src={q.imageUrl}
                    alt={q.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[4/3] object-cover rounded-lg bg-slate-200"
                  />
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          {q.indexLabel} · {q.category}
                        </p>
                        <h4 className="text-sm font-bold text-slate-900">{q.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(q.id, q.promptEn)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {copiedId === q.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            คัดลอกแล้ว
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            คัดลอก Prompt
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">{q.caption}</p>
                    <p className="text-xs font-mono text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                      {q.promptEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(activeTab === 'solutions' || activeTab === 'decoys') && (
            <div className="space-y-4">
              {(activeTab === 'solutions' ? correctSolutions : decoySolutions).map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70"
                >
                  <img
                    src={s.imageUrl}
                    alt={s.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[4/3] object-cover rounded-lg bg-slate-200"
                  />
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          {s.code} · {s.isDecoy ? 'ภาพคำตอบหลอก' : 'ภาพคำตอบที่ถูกต้อง'}
                        </p>
                        <h4 className="text-sm font-bold text-slate-900">{s.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(s.id, s.promptEn)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {copiedId === s.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            คัดลอกแล้ว
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            คัดลอก Prompt
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">{s.caption}</p>
                    <p className="text-xs font-mono text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                      {s.promptEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
