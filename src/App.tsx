import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  Play,
  Volume2,
  VolumeX,
  Lightbulb,
  Pause,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Layers,
  Zap,
  UserCheck,
  ShieldCheck,
  Lock,
  Trophy,
  LogOut,
} from 'lucide-react';
import {
  GAME2_CHALLENGES,
  Game2Challenge,
  SCENARIO_QUESTIONS,
  SOLUTION_CARDS,
  ScenarioQuestion,
  SolutionCard,
} from './data/scenarios';
import { GameCard, CardVisualState } from './components/GameCard';
import { PromptKitModal } from './components/PromptKitModal';
import { VictoryModal } from './components/VictoryModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { soundEngine } from './utils/sound';
import {
  auth,
  buildPlayerKey,
  checkPlayerPlayedGames,
  EmployeeSession,
  GameModeKey,
  isUserAdmin,
  PlayedGamesMap,
  PlayerReceipt,
  sanitizeNamePart,
  saveSinglePlayResultAtomic,
  signInWithGooglePopup,
  signOutUser,
} from './firebase';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type GameMode = GameModeKey;
type TimerMode = 'chill' | 'sprint';

interface FeedbackBanner {
  type: 'success' | 'trap' | 'error' | 'hint';
  title: string;
  detail: string;
}

interface TetherLine {
  qId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SPRINT_SECONDS = 60;
const RECEIPTS_STORAGE_KEY = 'imex_completed_games_v2';
const ACTIVE_EMPLOYEE_STORAGE_KEY = 'imex_active_employee_v2';

type PlayerReceiptsMap = Record<string, Partial<Record<GameModeKey, PlayerReceipt>>>;

function loadPlayerReceiptsMap(): PlayerReceiptsMap {
  try {
    const raw = localStorage.getItem(RECEIPTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PlayerReceiptsMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadActiveEmployee(): EmployeeSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_EMPLOYEE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmployeeSession;
    if (parsed && parsed.playerKey && parsed.firstName && parsed.lastName && parsed.fullName) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveActiveEmployee(emp: EmployeeSession | null): void {
  try {
    if (emp) {
      localStorage.setItem(ACTIVE_EMPLOYEE_STORAGE_KEY, JSON.stringify(emp));
    } else {
      localStorage.removeItem(ACTIVE_EMPLOYEE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export default function App() {
  // Employee First/Last Name Session (NO Google click required!)
  const [receiptsMap, setReceiptsMap] = useState<PlayerReceiptsMap>(() =>
    loadPlayerReceiptsMap()
  );
  const [employee, setEmployee] = useState<EmployeeSession | null>(() => loadActiveEmployee());
  const [playedGames, setPlayedGames] = useState<PlayedGamesMap>(() => {
    const initialEmp = loadActiveEmployee();
    const initialReceipts = loadPlayerReceiptsMap();
    const rec = initialEmp ? initialReceipts[initialEmp.playerKey] : undefined;
    return {
      match_board: Boolean(rec?.match_board),
      quick_quiz: Boolean(rec?.quick_quiz),
    };
  });
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin-only Auth State (used strictly when Admin clicks Admin Dashboard)
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  // Modals
  const [showPromptKit, setShowPromptKit] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // Game Shell State
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [gameMode, setGameMode] = useState<GameMode>('match_board');
  const [timerMode, setTimerMode] = useState<TimerMode>('chill');
  const [isMuted, setIsMuted] = useState(false);

  // Game 1: Match Board state
  const [boardQuestions, setBoardQuestions] = useState<ScenarioQuestion[]>(SCENARIO_QUESTIONS);
  const [boardSolutions, setBoardSolutions] = useState<SolutionCard[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [wrongPairCardId, setWrongPairCardId] = useState<string | null>(null);
  const [revealedTraps, setRevealedTraps] = useState<Record<string, boolean>>({});
  const [hintPair, setHintPair] = useState<{ qId: string; sId: string } | null>(null);

  // Game 2: Distinct Anti-Pattern & Urgent Risk Challenges (4 stages, 60s)
  const [game2List, setGame2List] = useState<Game2Challenge[]>(GAME2_CHALLENGES);
  const [quizRoundIndex, setQuizRoundIndex] = useState(0);
  const [quizChoices, setQuizChoices] = useState<SolutionCard[]>([]);
  const [quizResolvedCorrect, setQuizResolvedCorrect] = useState(false);
  const [game2CompletedIds, setGame2CompletedIds] = useState<Record<string, boolean>>({});

  // Score & Timing
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SPRINT_SECONDS);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [endReason, setEndReason] = useState<'completed' | 'timeout'>('completed');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const wrongAnswersRef = useRef<string[]>([]);

  // Title preview active index
  const [previewIdx, setPreviewIdx] = useState(0);

  // SVG Connector refs for Game 1 Match Board
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const solutionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [tetherLines, setTetherLines] = useState<TetherLine[]>([]);

  const isAdmin = useMemo(() => isUserAdmin(adminUser), [adminUser]);

  // Keep track of Admin Firebase Auth session if signed in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
    });
    return () => unsub();
  }, []);

  // Re-verify persisted active employee's server lock status on mount / player change
  const activePlayerKey = employee?.playerKey ?? null;
  useEffect(() => {
    if (!activePlayerKey) return;
    let cancelled = false;
    checkPlayerPlayedGames(activePlayerKey)
      .then((serverPlayed) => {
        if (cancelled) return;
        const localRec = loadPlayerReceiptsMap()[activePlayerKey];
        const merged: PlayedGamesMap = {
          match_board: serverPlayed.match_board || Boolean(localRec?.match_board),
          quick_quiz: serverPlayed.quick_quiz || Boolean(localRec?.quick_quiz),
        };
        setPlayedGames(merged);
        if (merged.match_board && !merged.quick_quiz) {
          setGameMode('quick_quiz');
          setTimerMode('sprint');
        }
      })
      .catch(() => {
        // Keep local lock status if offline
      });
    return () => {
      cancelled = true;
    };
  }, [activePlayerKey]);

  // Employee Login with First Name + Last Name ONLY (No Google popup!)
  const handleEmployeeLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fName = sanitizeNamePart(firstNameInput);
    const lName = sanitizeNamePart(lastNameInput);

    if (!fName || !lName) {
      setLoginError('กรุณากรอกทั้งชื่อและนามสกุลก่อนเข้าสู่ระบบ');
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      const playerKey = await buildPlayerKey(fName, lName);
      const serverPlayed = await checkPlayerPlayedGames(playerKey);
      const localRec = receiptsMap[playerKey];
      const mergedPlayed: PlayedGamesMap = {
        match_board: serverPlayed.match_board || Boolean(localRec?.match_board),
        quick_quiz: serverPlayed.quick_quiz || Boolean(localRec?.quick_quiz),
      };

      setPlayedGames(mergedPlayed);

      // Default to an unplayed game if one is already finished
      if (mergedPlayed.match_board && !mergedPlayed.quick_quiz) {
        setGameMode('quick_quiz');
        setTimerMode('sprint');
      } else {
        setGameMode('match_board');
        setTimerMode('chill');
      }

      const nextEmployee: EmployeeSession = {
        playerKey,
        firstName: fName,
        lastName: lName,
        fullName: `${fName} ${lName}`,
      };
      saveActiveEmployee(nextEmployee);
      setEmployee(nextEmployee);
      soundEngine.playSelect();
    } catch {
      setLoginError('ไม่สามารถตรวจสอบข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoginLoading(false);
    }
  };

  // Single-Admin Login (Google popup ONLY for Admin button)
  const handleAdminDirectLogin = async () => {
    setAdminLoading(true);
    setLoginError(null);
    try {
      const user = adminUser ?? (await signInWithGooglePopup());
      if (!isUserAdmin(user)) {
        await signOutUser();
        setLoginError(
          'บัญชีนี้ไม่มีสิทธิ์เข้าถึงส่วน Admin (ดูผลคะแนนผู้เล่นทั้งหมดได้เฉพาะผู้ดูแลระบบเพียงคนเดียวเท่านั้น)'
        );
        return;
      }
      setShowAdminDashboard(true);
    } catch {
      setLoginError('ไม่สามารถยืนยันสิทธิ์ผู้ดูแลระบบได้');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminSignOut = async () => {
    await signOutUser();
    setShowAdminDashboard(false);
  };

  const handleReturnToLogin = useCallback(() => {
    saveActiveEmployee(null);
    setEmployee(null);
    setPlayedGames({ match_board: false, quick_quiz: false });
    setFirstNameInput('');
    setLastNameInput('');
    setLoginError(null);
    setGameState('TITLE_MENU');
    soundEngine.playSelect();
  }, []);

  const buildChoicesForGame2 = useCallback((challenge: Game2Challenge) => {
    const cards = challenge.choiceIds
      .map((id) => SOLUTION_CARDS.find((s) => s.id === id))
      .filter((c): c is SolutionCard => Boolean(c));
    return shuffleArray(cards);
  }, []);

  const startGame = useCallback(
    async (overrideMode?: GameMode) => {
      if (startingGame) return;
      if (!employee) {
        setLoginError('กรุณากรอกชื่อ-นามสกุลเพื่อเข้าสู่ระบบก่อนเริ่มเล่นเกม');
        return;
      }

      const activeMode = overrideMode ?? gameMode;
      if (playedGames[activeMode]) {
        setLoginError('คุณได้เล่นเกมนี้ครบสิทธิ์แล้ว ไม่สามารถเล่นซ้ำได้อีก');
        return;
      }

      setStartingGame(true);
      setLoginError(null);
      try {
        // Re-verify lock directly with Firestore server before starting (blocks multi-tab replay)
        const serverPlayed = await checkPlayerPlayedGames(employee.playerKey);
        const localRec = receiptsMap[employee.playerKey];
        const mergedPlayed: PlayedGamesMap = {
          match_board: serverPlayed.match_board || Boolean(localRec?.match_board),
          quick_quiz: serverPlayed.quick_quiz || Boolean(localRec?.quick_quiz),
        };
        setPlayedGames(mergedPlayed);

        if (mergedPlayed[activeMode]) {
          setGameState('TITLE_MENU');
          setLoginError('คุณได้เล่นเกมนี้ไปแล้ว ไม่สามารถเล่นซ้ำได้อีก');
          return;
        }
      } catch {
        // Fallback to local lock check if offline
        if (playedGames[activeMode]) {
          setLoginError('คุณได้เล่นเกมนี้ไปแล้ว ไม่สามารถเล่นซ้ำได้อีก');
          return;
        }
      } finally {
        setStartingGame(false);
      }

      const activeTimerMode: TimerMode = activeMode === 'quick_quiz' ? 'sprint' : 'chill';
      setGameMode(activeMode);
      setTimerMode(activeTimerMode);

      // Setup Game 1
      const shuffledQs = shuffleArray(SCENARIO_QUESTIONS);
      const correctCards = SOLUTION_CARDS.filter((s) => !s.isDecoy);
      const twoDecoys = shuffleArray(SOLUTION_CARDS.filter((s) => s.isDecoy)).slice(0, 2);
      const shuffledBoardSolutions = shuffleArray([...correctCards, ...twoDecoys]);

      setBoardQuestions(shuffledQs);
      setBoardSolutions(shuffledBoardSolutions);
      setSelectedQuestionId(activeMode === 'match_board' ? shuffledQs[0].id : null);
      setMatchedPairs({});
      setWrongPairCardId(null);
      setRevealedTraps({});
      setHintPair(null);

      // Setup Game 2 (distinct challenges!)
      const shuffledG2 = shuffleArray(GAME2_CHALLENGES);
      setGame2List(shuffledG2);
      setQuizRoundIndex(0);
      setQuizChoices(buildChoicesForGame2(shuffledG2[0]));
      setQuizResolvedCorrect(false);
      setGame2CompletedIds({});

      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      setMistakes(0);
      setHintsUsed(0);
      wrongAnswersRef.current = [];
      setTimeLeft(SPRINT_SECONDS);
      setElapsedSeconds(0);
      setEndReason('completed');
      setSaveStatus('idle');
      setFeedback(null);
      setGameState('PLAYING');
      soundEngine.playSelect();
    },
    [buildChoicesForGame2, employee, gameMode, playedGames, receiptsMap, startingGame]
  );

  const recordWrongChoice = useCallback(
    (questionLabel: string, questionTitle: string, chosenTitle: string) => {
      const entry = `${questionLabel}: ${questionTitle} → เลือกผิด "${chosenTitle}"`.slice(0, 210);
      if (
        wrongAnswersRef.current.length < 30 &&
        !wrongAnswersRef.current.includes(entry)
      ) {
        wrongAnswersRef.current = [...wrongAnswersRef.current, entry];
      }
    },
    []
  );

  // Finish game, lock ONLY this finished game mode, and save atomically to Firestore
  const finishGame = useCallback(
    async (
      reason: 'completed' | 'timeout',
      finalScore: number,
      finalMaxCombo: number,
      finalMistakes: number,
      finalMatchedCount: number,
      finalElapsed: number
    ) => {
      if (reason === 'completed') {
        soundEngine.playVictory();
      } else {
        soundEngine.playTrap();
      }
      setEndReason(reason);
      setGameState('GAME_OVER');

      if (!employee) return;

      const totalAttempts = finalMatchedCount + finalMistakes;
      const accuracy =
        totalAttempts > 0 ? Math.round((finalMatchedCount / totalAttempts) * 100) : 100;
      let rank: 'S' | 'A' | 'B' = 'A';
      if (reason === 'completed' && finalMistakes === 0) rank = 'S';
      else if (reason === 'timeout' || accuracy < 65) rank = 'B';

      const localReceipt: PlayerReceipt = {
        playerKey: employee.playerKey,
        fullName: employee.fullName,
        mode: gameMode,
        score: finalScore,
        accuracy,
        matchedCount: finalMatchedCount,
        elapsedSeconds: finalElapsed,
        rank,
        completedAtIso: new Date().toISOString(),
      };

      // Strictly lock this game mode for this player locally & permanently across reloads
      const updatedPlayed: PlayedGamesMap = {
        ...playedGames,
        [gameMode]: true,
      };
      setPlayedGames(updatedPlayed);

      setReceiptsMap((prev) => {
        const next: PlayerReceiptsMap = {
          ...prev,
          [employee.playerKey]: {
            ...(prev[employee.playerKey] ?? {}),
            [gameMode]: localReceipt,
          },
        };
        try {
          localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });

      // Automatically pre-select the remaining unplayed game for the home menu
      const nextUnplayed: GameMode = gameMode === 'match_board' ? 'quick_quiz' : 'match_board';
      if (!updatedPlayed[nextUnplayed]) {
        setGameMode(nextUnplayed);
        setTimerMode(nextUnplayed === 'quick_quiz' ? 'sprint' : 'chill');
      }

      setSaveStatus('saving');
      try {
        await saveSinglePlayResultAtomic({
          player: employee,
          mode: gameMode,
          timerMode,
          score: finalScore,
          accuracy,
          maxCombo: Math.max(1, finalMaxCombo),
          mistakes: finalMistakes,
          wrongAnswers: wrongAnswersRef.current,
          matchedCount: finalMatchedCount,
          elapsedSeconds: finalElapsed,
          reason,
          rank,
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    [employee, gameMode, playedGames, timerMode]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  // Timer loop
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prevElapsed) => {
        const nextElapsed = prevElapsed + 1;
        if (timerMode === 'sprint') {
          setTimeLeft((prevLeft) => {
            if (prevLeft <= 1) {
              finishGame(
                'timeout',
                score,
                maxCombo,
                mistakes,
                Object.keys(game2CompletedIds).length,
                nextElapsed
              );
              return 0;
            }
            return prevLeft - 1;
          });
        }
        return nextElapsed;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finishGame, game2CompletedIds, gameState, maxCombo, mistakes, score, timerMode]);

  // Compute SVG tether lines between matched cards on desktop Game 1 Board
  const updateTetherLines = useCallback(() => {
    if (gameState !== 'PLAYING' || gameMode !== 'match_board') {
      setTetherLines([]);
      return;
    }
    const container = boardContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const lines: TetherLine[] = [];
    Object.entries(matchedPairs).forEach(([qId, sId]) => {
      const qEl = questionRefs.current[qId];
      const sEl = solutionRefs.current[sId];
      if (!qEl || !sEl) return;
      const qRect = qEl.getBoundingClientRect();
      const sRect = sEl.getBoundingClientRect();
      if (sRect.left > qRect.right - 20) {
        lines.push({
          qId,
          x1: qRect.right - containerRect.left,
          y1: qRect.top + qRect.height / 2 - containerRect.top,
          x2: sRect.left - containerRect.left,
          y2: sRect.top + sRect.height / 2 - containerRect.top,
        });
      }
    });
    setTetherLines(lines);
  }, [gameMode, gameState, matchedPairs]);

  useLayoutEffect(() => {
    updateTetherLines();
    window.addEventListener('resize', updateTetherLines);
    return () => window.removeEventListener('resize', updateTetherLines);
  }, [updateTetherLines, boardQuestions, boardSolutions]);

  const handleUseHint = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    soundEngine.playHint();
    setHintsUsed((h) => h + 1);

    if (gameMode === 'match_board') {
      const targetQ =
        (selectedQuestionId && !matchedPairs[selectedQuestionId]
          ? boardQuestions.find((q) => q.id === selectedQuestionId)
          : boardQuestions.find((q) => !matchedPairs[q.id])) ?? null;

      if (targetQ) {
        setSelectedQuestionId(targetQ.id);
        setHintPair({ qId: targetQ.id, sId: targetQ.correctSolutionId });
        setFeedback({
          type: 'hint',
          title: `คำใบ้สำหรับ "${targetQ.title}"`,
          detail: targetQ.hintText,
        });
      }
    } else {
      const currentChallenge = game2List[quizRoundIndex];
      if (currentChallenge && !quizResolvedCorrect) {
        setHintPair({ qId: currentChallenge.id, sId: currentChallenge.correctChoiceId });
        setFeedback({
          type: 'hint',
          title: 'คำใบ้ช่วยคิด',
          detail: currentChallenge.hintText,
        });
      }
    }
  }, [
    boardQuestions,
    game2List,
    gameMode,
    gameState,
    matchedPairs,
    quizResolvedCorrect,
    quizRoundIndex,
    selectedQuestionId,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (showPromptKit || showAdminDashboard) {
        if (e.key === 'Escape') {
          setShowPromptKit(false);
          setShowAdminDashboard(false);
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
        return;
      }

      if (gameState === 'TITLE_MENU') {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          employee &&
          !(playedGames.match_board && playedGames.quick_quiz)
        ) {
          e.preventDefault();
          startGame();
        }
      } else if (gameState === 'PLAYING') {
        if (e.key === 'Escape') {
          setGameState('PAUSED');
        } else if (e.key === 'h' || e.key === 'H') {
          handleUseHint();
        }
      } else if (gameState === 'PAUSED') {
        if (e.key === 'Escape') {
          setGameState('PLAYING');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    employee,
    gameState,
    handleUseHint,
    playedGames.match_board,
    playedGames.quick_quiz,
    showAdminDashboard,
    showPromptKit,
    startGame,
    toggleMute,
  ]);

  // Game 1 handlers
  const handleSelectQuestion = (qId: string) => {
    if (gameState !== 'PLAYING' || matchedPairs[qId]) return;
    soundEngine.playSelect();
    setSelectedQuestionId((prev) => (prev === qId ? null : qId));
  };

  const handleSelectBoardSolution = (sol: SolutionCard) => {
    if (gameState !== 'PLAYING') return;
    const isAlreadyMatched = Object.values(matchedPairs).includes(sol.id);
    if (isAlreadyMatched) return;

    if (!selectedQuestionId) {
      setFeedback({
        type: 'hint',
        title: 'เลือกภาพสถานการณ์ฝั่งซ้ายก่อนนะ!',
        detail: 'แตะการ์ดสถานการณ์ที่ต้องการตอบ แล้วค่อยแตะภาพวิธีแก้ไขฝั่งขวา',
      });
      return;
    }

    const activeQ = boardQuestions.find((q) => q.id === selectedQuestionId);
    if (!activeQ) return;

    if (sol.id === activeQ.correctSolutionId) {
      const nextCombo = combo + 1;
      const earned = 100 + (nextCombo - 1) * 50;
      const nextScore = score + earned;
      const nextMaxCombo = Math.max(maxCombo, nextCombo);
      const nextMatched = { ...matchedPairs, [activeQ.id]: sol.id };
      const nextMatchedCount = Object.keys(nextMatched).length;

      setMatchedPairs(nextMatched);
      setCombo(nextCombo);
      setMaxCombo(nextMaxCombo);
      setScore(nextScore);
      setHintPair(null);
      setFeedback({
        type: 'success',
        title: `${sol.feedbackTitle} (+${earned} คะแนน)`,
        detail: sol.feedbackDetail,
      });

      soundEngine.playMatch(nextCombo);

      const remainingQ = boardQuestions.find((q) => !nextMatched[q.id]);
      if (remainingQ) {
        setSelectedQuestionId(remainingQ.id);
      } else {
        setSelectedQuestionId(null);
        setTimeout(() => {
          finishGame(
            'completed',
            nextScore,
            nextMaxCombo,
            mistakes,
            nextMatchedCount,
            elapsedSeconds
          );
        }, 600);
      }
    } else if (sol.isDecoy) {
      soundEngine.playTrap();
      setCombo(0);
      setMistakes((m) => m + 1);
      recordWrongChoice(activeQ.indexLabel, activeQ.title, sol.title);
      setRevealedTraps((prev) => ({ ...prev, [sol.id]: true }));
      setWrongPairCardId(sol.id);
      setTimeout(() => setWrongPairCardId(null), 350);
      setFeedback({
        type: 'trap',
        title: sol.feedbackTitle,
        detail: sol.feedbackDetail,
      });
    } else {
      soundEngine.playTrap();
      setCombo(0);
      setMistakes((m) => m + 1);
      recordWrongChoice(activeQ.indexLabel, activeQ.title, sol.title);
      setWrongPairCardId(sol.id);
      setTimeout(() => setWrongPairCardId(null), 350);
      setFeedback({
        type: 'error',
        title: 'วิธีนี้ถูกต้องนะ แต่ยังไม่ตรงกับสถานการณ์ที่เลือก!',
        detail: 'ลองอ่านสถานการณ์ฝั่งซ้ายอีกครั้ง แล้วเลือกวิธีแก้ให้ตรงจุด',
      });
    }
  };

  // Game 2 handlers (Distinct Anti-Pattern & Urgent Risk Challenges)
  const handleSelectQuizAnswer = (sol: SolutionCard) => {
    if (gameState !== 'PLAYING' || quizResolvedCorrect) return;
    const currentChallenge = game2List[quizRoundIndex];
    if (!currentChallenge) return;

    if (sol.id === currentChallenge.correctChoiceId) {
      const nextCombo = combo + 1;
      const speedBonus = timeLeft >= 35 ? 50 : timeLeft >= 20 ? 30 : 10;
      const earned = 120 + (nextCombo - 1) * 40 + speedBonus;
      setCombo(nextCombo);
      setMaxCombo((m) => Math.max(m, nextCombo));
      setScore((s) => s + earned);
      setQuizResolvedCorrect(true);
      setGame2CompletedIds((prev) => ({ ...prev, [currentChallenge.id]: true }));
      setHintPair(null);
      setFeedback({
        type: 'success',
        title: `${currentChallenge.successTitle} (+${earned} คะแนน · โบนัสความไว +${speedBonus})`,
        detail: currentChallenge.successDetail,
      });
      soundEngine.playMatch(nextCombo);
    } else {
      soundEngine.playTrap();
      setCombo(0);
      setMistakes((m) => m + 1);
      recordWrongChoice(currentChallenge.indexLabel, currentChallenge.title, sol.title);
      setWrongPairCardId(sol.id);
      setTimeout(() => setWrongPairCardId(null), 350);
      setFeedback({
        type: 'error',
        title: 'ยังไม่ตรงกับคำถามในด่านนี้!',
        detail: currentChallenge.wrongExplanation,
      });
    }
  };

  const handleNextQuizRound = () => {
    const nextIdx = quizRoundIndex + 1;
    if (nextIdx >= game2List.length) {
      finishGame(
        'completed',
        score,
        maxCombo,
        mistakes,
        Object.keys(game2CompletedIds).length,
        elapsedSeconds
      );
      return;
    }
    soundEngine.playSelect();
    setQuizRoundIndex(nextIdx);
    setQuizChoices(buildChoicesForGame2(game2List[nextIdx]));
    setQuizResolvedCorrect(false);
    setWrongPairCardId(null);
    setHintPair(null);
    setFeedback(null);
  };

  const matchedCount =
    gameMode === 'match_board'
      ? Object.keys(matchedPairs).length
      : Object.keys(game2CompletedIds).length;

  const activeQuestion = useMemo(
    () => boardQuestions.find((q) => q.id === selectedQuestionId) ?? null,
    [boardQuestions, selectedQuestionId]
  );

  const titlePreviewItems = useMemo(
    () => [
      {
        label: 'คำถามหน้างานจริง',
        title: SCENARIO_QUESTIONS[0].title,
        img: SCENARIO_QUESTIONS[0].imageUrl,
      },
      {
        label: 'ภาพคำตอบที่ถูกต้อง',
        title: SOLUTION_CARDS[0].title,
        img: SOLUTION_CARDS[0].imageUrl,
      },
      {
        label: 'ภาพคำตอบหลอกสุดแสบ',
        title: SOLUTION_CARDS[4].title,
        img: SOLUTION_CARDS[4].imageUrl,
      },
    ],
    []
  );

  const bothGamesCompleted = Boolean(
    employee && playedGames.match_board && playedGames.quick_quiz
  );
  const activePlayerReceipts = employee ? receiptsMap[employee.playerKey] : undefined;
  const completedGameCount = Number(playedGames.match_board) + Number(playedGames.quick_quiz);
  const otherGameMode: GameModeKey = gameMode === 'match_board' ? 'quick_quiz' : 'match_board';
  const otherModeAvailable = !playedGames[otherGameMode];

  return (
    <div className="min-h-screen w-full bg-[#0B1530] text-slate-100 flex flex-col selection:bg-sky-400 selection:text-slate-950">
      <div
        className="fixed inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.16), transparent 45%), radial-gradient(circle at 80% 80%, rgba(14, 165, 233, 0.12), transparent 45%), radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 28px 28px',
        }}
      />

      {/* ================= TITLE SCREEN ================= */}
      {gameState === 'TITLE_MENU' && (
        <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-8 lg:px-12">
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Title Lockup + No-Google Login OR Both-Games Complete OR Mode Select */}
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-3">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 44 44"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    className="shrink-0"
                  >
                    <rect width="44" height="44" rx="12" fill="#14244B" stroke="#38BDF8" strokeWidth="1.5" />
                    <path d="M12 15H24V29H12V15Z" fill="#FFFFFF" />
                    <path d="M20 12H32V26H20V12Z" fill="#38BDF8" fillOpacity="0.25" stroke="#7DD3FC" strokeWidth="1.5" />
                    <path d="M23.5 19L25.5 21L29 17" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm font-medium text-sky-300 tracking-wide">
                    imex Workplace Card Arena
                  </span>
                </div>

                <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white leading-[1.15] text-balance">
                  imex Frontline Match
                  <span className="block text-xl sm:text-2xl font-bold text-sky-300 mt-1.5">
                    เกมจับคู่ภารกิจหน้างานจริง
                  </span>
                </h1>
              </div>

              {!employee ? (
                /* 1) No-Google Login Form (First Name + Last Name ONLY) */
                <form
                  onSubmit={handleEmployeeLoginSubmit}
                  className="p-5 sm:p-6 rounded-2xl bg-[#122046] border border-white/15 shadow-xl space-y-4 max-w-lg"
                >
                  <div>
                    <h2 className="text-base font-bold text-white">
                      เข้าสู่ระบบพนักงานด้วย ชื่อ - นามสกุล
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      กรอกชื่อ-นามสกุลจริง แล้วเล่นได้ครบทั้ง 2 เกม (เกมละ 1 ครั้งต่อท่าน)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="firstName" className="block text-xs font-medium text-sky-200">
                        ชื่อ (First Name)
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        required
                        maxLength={60}
                        value={firstNameInput}
                        onChange={(e) => setFirstNameInput(e.target.value)}
                        placeholder="เช่น สมชาย"
                        className="w-full px-3.5 py-2.5 text-sm bg-white text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="lastName" className="block text-xs font-medium text-sky-200">
                        นามสกุล (Last Name)
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        required
                        maxLength={60}
                        value={lastNameInput}
                        onChange={(e) => setLastNameInput(e.target.value)}
                        placeholder="เช่น ใจดี"
                        className="w-full px-3.5 py-2.5 text-sm bg-white text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>

                  {loginError && (
                    <p className="text-xs text-amber-300 bg-amber-950/60 border border-amber-500/30 rounded-lg px-3 py-2">
                      {loginError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    {loginLoading ? 'กำลังตรวจสอบชื่อผู้เล่น...' : 'เข้าสู่ระบบด้วย ชื่อ - นามสกุล'}
                  </button>

                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                    {isAdmin ? (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowAdminDashboard(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 underline underline-offset-4 cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          เปิดหน้า Admin ดูผลคะแนนทั้งหมด
                        </button>
                        <button
                          type="button"
                          onClick={handleAdminSignOut}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                        >
                          <LogOut className="w-3 h-3" />
                          ออก Admin
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAdminDirectLogin}
                        disabled={adminLoading}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200 underline underline-offset-4 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        สำหรับผู้ดูแลระบบ (ดูคะแนนผู้เล่นทั้งหมด)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowPromptKit(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      ดู Prompt สร้างภาพ
                    </button>
                  </div>
                </form>
              ) : bothGamesCompleted ? (
                /* 2) Locked Thank-You View after completing BOTH Game 1 and Game 2 */
                <div className="p-6 rounded-2xl bg-[#122046] border border-emerald-400/30 shadow-xl space-y-4 max-w-lg animate-card-enter">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                      <Trophy className="w-6 h-6 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-white">
                        ขอบคุณที่ร่วมสนุกครบทั้ง 2 เกม!
                      </h2>
                      <p className="text-xs text-sky-200 mt-0.5 truncate">
                        ผู้เล่น: {employee.fullName}
                      </p>
                    </div>
                  </div>

                  {(activePlayerReceipts?.match_board || activePlayerReceipts?.quick_quiz) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activePlayerReceipts?.match_board && (
                        <div className="p-3 rounded-xl bg-[#0B1530]/75 border border-white/10">
                          <p className="text-[11px] text-sky-300 font-semibold">
                            เกมที่ 1: จับคู่กระดาน 4×6
                          </p>
                          <p className="text-lg font-bold font-mono-num text-white mt-0.5">
                            {activePlayerReceipts.match_board.score} คะแนน
                          </p>
                          <p className="text-[11px] text-emerald-300 font-mono-num">
                            แม่นยำ {activePlayerReceipts.match_board.accuracy}% · ระดับ{' '}
                            {activePlayerReceipts.match_board.rank}
                          </p>
                        </div>
                      )}
                      {activePlayerReceipts?.quick_quiz && (
                        <div className="p-3 rounded-xl bg-[#0B1530]/75 border border-white/10">
                          <p className="text-[11px] text-amber-300 font-semibold">
                            เกมที่ 2: ดวลการ์ดจับผิด 60 วิ
                          </p>
                          <p className="text-lg font-bold font-mono-num text-white mt-0.5">
                            {activePlayerReceipts.quick_quiz.score} คะแนน
                          </p>
                          <p className="text-[11px] text-emerald-300 font-mono-num">
                            แม่นยำ {activePlayerReceipts.quick_quiz.accuracy}% · ระดับ{' '}
                            {activePlayerReceipts.quick_quiz.rank}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-amber-200 bg-amber-950/50 border border-amber-500/30 rounded-xl px-3.5 py-2.5">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>
                      ระบบได้บันทึกผลคะแนนทั้ง 2 เกมของคุณเรียบร้อยแล้ว (ไม่สามารถเล่นซ้ำได้อีก)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleReturnToLogin}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    กลับหน้าจอเข้าสู่ระบบเกม
                  </button>

                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                    {isAdmin ? (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowAdminDashboard(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 underline underline-offset-4 cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          เปิดหน้า Admin ดูผลคะแนนทั้งหมด
                        </button>
                        <button
                          type="button"
                          onClick={handleAdminSignOut}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                        >
                          <LogOut className="w-3 h-3" />
                          ออก Admin
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAdminDirectLogin}
                        disabled={adminLoading}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200 underline underline-offset-4 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        สำหรับผู้ดูแลระบบ (ดูคะแนนผู้เล่นทั้งหมด)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowPromptKit(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      ดู Prompt สร้างภาพ
                    </button>
                  </div>
                </div>
              ) : (
                /* 3) Logged-In Employee: Choose Either or Both of the 2 Distinct Game Formats */
                <div className="space-y-5 max-w-lg">
                  <div className="p-4 rounded-2xl bg-[#122046] border border-white/15 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-sky-300">
                        เล่นได้ทั้ง 2 เกม (เกมละ 1 ครั้ง) · เล่นแล้ว{' '}
                        <span className="font-mono-num font-bold text-white">
                          {completedGameCount}/2
                        </span>{' '}
                        เกม
                      </p>
                      <p className="text-base font-bold text-white truncate">
                        ผู้เล่น: {employee.fullName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleReturnToLogin}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {completedGameCount === 0 ? 'เปลี่ยนชื่อ' : 'กลับหน้าเข้าสู่ระบบ'}
                    </button>
                  </div>

                  {/* Exactly 2 Distinct Game Formats — Each playable strictly once per player */}
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-slate-400">
                      เลือกเกมที่ต้องการเล่น (ตั้งโจทย์แตกต่างกัน 2 รูปแบบ)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={playedGames.match_board}
                        onClick={() => {
                          setGameMode('match_board');
                          setTimerMode('chill');
                        }}
                        className={`text-left p-3.5 rounded-xl border transition-all ${
                          playedGames.match_board
                            ? 'bg-[#0F1B3D] text-slate-400 border-emerald-500/30 opacity-80 cursor-not-allowed'
                            : gameMode === 'match_board'
                            ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-md cursor-pointer'
                            : 'bg-[#13224A] text-slate-200 border-white/10 hover:border-sky-400/50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-bold text-sm">
                          <span className="flex items-center gap-2">
                            <Layers className="w-4 h-4 shrink-0" />
                            <span>เกมที่ 1: จับคู่กระดาน 4×6</span>
                          </span>
                          {playedGames.match_board && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <p
                          className={`text-xs mt-1 leading-snug ${
                            playedGames.match_board
                              ? 'text-emerald-300 font-medium'
                              : gameMode === 'match_board'
                              ? 'text-slate-900/90'
                              : 'text-slate-400'
                          }`}
                        >
                          {playedGames.match_board
                            ? activePlayerReceipts?.match_board
                              ? `เล่นจบแล้ว · ${activePlayerReceipts.match_board.score} คะแนน`
                              : 'เล่นจบและบันทึกคะแนนแล้ว'
                            : 'จับคู่ปัญหาหน้างานกับวิธีแก้ไขที่ถูกต้อง · ไม่จับเวลา'}
                        </p>
                      </button>

                      <button
                        type="button"
                        disabled={playedGames.quick_quiz}
                        onClick={() => {
                          setGameMode('quick_quiz');
                          setTimerMode('sprint');
                        }}
                        className={`text-left p-3.5 rounded-xl border transition-all ${
                          playedGames.quick_quiz
                            ? 'bg-[#0F1B3D] text-slate-400 border-emerald-500/30 opacity-80 cursor-not-allowed'
                            : gameMode === 'quick_quiz'
                            ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-md cursor-pointer'
                            : 'bg-[#13224A] text-slate-200 border-white/10 hover:border-amber-400/50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-bold text-sm">
                          <span className="flex items-center gap-2">
                            <Zap className="w-4 h-4 shrink-0" />
                            <span>เกมที่ 2: ดวลการ์ดจับผิด 60 วิ</span>
                          </span>
                          {playedGames.quick_quiz && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <p
                          className={`text-xs mt-1 leading-snug ${
                            playedGames.quick_quiz
                              ? 'text-emerald-300 font-medium'
                              : gameMode === 'quick_quiz'
                              ? 'text-slate-900/90'
                              : 'text-slate-400'
                          }`}
                        >
                          {playedGames.quick_quiz
                            ? activePlayerReceipts?.quick_quiz
                              ? `เล่นจบแล้ว · ${activePlayerReceipts.quick_quiz.score} คะแนน`
                              : 'เล่นจบและบันทึกคะแนนแล้ว'
                            : 'วิเคราะห์จับผิดพฤติกรรมเสี่ยง & ทางลัดต้องห้าม · แข่ง 60 วิ'}
                        </p>
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <p className="text-xs text-amber-300 bg-amber-950/60 border border-amber-500/30 rounded-lg px-3 py-2">
                      {loginError}
                    </p>
                  )}

                  {/* Primary CTA & Utility Buttons */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={startingGame || playedGames[gameMode]}
                        onClick={() => startGame()}
                        className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-base font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 disabled:opacity-60 rounded-xl shadow-lg shadow-sky-500/20 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        {startingGame
                          ? 'กำลังตรวจสอบสิทธิ์...'
                          : gameMode === 'match_board'
                          ? 'เริ่มเล่นเกมที่ 1'
                          : 'เริ่มเล่นเกมที่ 2'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPromptKit(true)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-white bg-[#152856] hover:bg-[#1C346E] border border-white/15 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-sky-300" />
                        คลัง Prompt
                      </button>

                      <button
                        type="button"
                        onClick={toggleMute}
                        aria-label={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
                        className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#152856] hover:bg-[#1C346E] border border-white/15 text-slate-200 transition-colors cursor-pointer shrink-0"
                      >
                        {isMuted ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {isAdmin && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowAdminDashboard(true)}
                          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-amber-950 bg-amber-300 hover:bg-amber-200 rounded-xl shadow-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Admin: ดูสรุปผลคะแนนผู้เล่นทั้งหมด (สิทธิ์เฉพาะผู้ดูแลระบบคนเดียว)
                        </button>
                      </div>
                    )}

                    <p className="text-xs text-slate-400">
                      Enter เริ่มเกม · H ขอคำใบ้ · M ปิด/เปิดเสียง · เล่นได้ครบทั้ง 2 เกม (เกมละ 1 ครั้ง)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live Interactive Card Deck Showcase */}
            <div className="lg:col-span-6">
              <div className="bg-[#122046] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-medium text-sky-300">
                    ตัวอย่างการ์ดจริงในสำรับ · ชุดพนักงาน imex
                  </span>
                  <div className="flex items-center gap-1.5">
                    {titlePreviewItems.map((item, idx) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setPreviewIdx(idx)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          previewIdx === idx
                            ? 'bg-sky-400 text-slate-950'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {idx === 0 ? 'คำถาม' : idx === 1 ? 'คำตอบถูก' : 'คำตอบหลอก'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white text-slate-900 rounded-xl p-3.5 shadow-xl">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>{titlePreviewItems[previewIdx].label}</span>
                    <span className="font-semibold text-[#14244B]">imex Frontline Deck</span>
                  </div>
                  <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-slate-100 mb-3">
                    <img
                      src={titlePreviewItems[previewIdx].img}
                      alt={titlePreviewItems[previewIdx].title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-base font-bold text-slate-900">
                    {titlePreviewItems[previewIdx].title}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {titlePreviewItems.map((item, idx) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setPreviewIdx(idx)}
                      className={`text-left rounded-lg overflow-hidden border transition-all cursor-pointer ${
                        previewIdx === idx
                          ? 'border-sky-400 ring-2 ring-sky-400/50'
                          : 'border-white/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={item.img}
                        alt={item.label}
                        referrerPolicy="no-referrer"
                        className="w-full aspect-[4/3] object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ================= PLAYING VIEW ================= */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAME_OVER') && (
        <div className="relative z-10 flex-1 flex flex-col max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-3 sm:py-4 gap-3">
          {/* Compact Unobtrusive HUD Bar */}
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#122046]/95 border border-white/10 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-bold text-white whitespace-nowrap shrink-0">
                imex Match
              </span>
              {employee && (
                <>
                  <span className="text-slate-500 hidden sm:inline">·</span>
                  <span className="text-xs text-sky-200 truncate max-w-[200px] hidden sm:inline">
                    {employee.fullName}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 sm:gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">สำเร็จ</span>
                <span className="font-mono-num font-bold text-emerald-300">
                  {matchedCount}/4
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">คะแนน</span>
                <span className="font-mono-num font-bold text-white">{score}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">คอมโบ</span>
                <span className="font-mono-num font-bold text-sky-300">x{Math.max(1, combo)}</span>
              </div>

              {timerMode === 'sprint' && (
                <div className="flex items-center gap-1.5">
                  <Clock
                    className={`w-4 h-4 ${timeLeft <= 15 ? 'text-rose-400' : 'text-amber-300'}`}
                  />
                  <span
                    className={`font-mono-num font-bold ${
                      timeLeft <= 15 ? 'text-rose-300' : 'text-amber-300'
                    }`}
                  >
                    {timeLeft}s
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseHint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                คำใบ้ {hintsUsed > 0 ? `(${hintsUsed})` : ''}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer shrink-0"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setGameState('PAUSED')}
                aria-label="พักเกม"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer shrink-0"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Compact Feedback Strip */}
          <div className="min-h-[48px] flex items-center">
            {feedback ? (
              <div
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-sm transition-all animate-card-enter ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-100'
                    : feedback.type === 'trap'
                    ? 'bg-amber-950/70 border-amber-500/40 text-amber-100'
                    : feedback.type === 'error'
                    ? 'bg-rose-950/70 border-rose-500/40 text-rose-100'
                    : 'bg-sky-950/70 border-sky-500/40 text-sky-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {feedback.type === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  {(feedback.type === 'trap' || feedback.type === 'error') && (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  {feedback.type === 'hint' && (
                    <Lightbulb className="w-4 h-4 text-sky-300 shrink-0" />
                  )}
                  <p className="text-xs sm:text-sm truncate">
                    <span className="font-bold mr-2">{feedback.title}</span>
                    <span className="opacity-90">{feedback.detail}</span>
                  </p>
                </div>

                {gameMode === 'quick_quiz' && quizResolvedCorrect && (
                  <button
                    type="button"
                    onClick={handleNextQuizRound}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {quizRoundIndex + 1 >= game2List.length ? 'ดูสรุปคะแนน' : 'ด่านถัดไป'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full px-4 py-2.5 rounded-xl bg-[#122046]/60 border border-white/5 text-xs sm:text-sm text-slate-300 flex items-center justify-between gap-2">
                <span>
                  {gameMode === 'match_board'
                    ? activeQuestion
                      ? `กำลังเลือก "${activeQuestion.title}" — แตะภาพวิธีแก้ไขฝั่งขวาที่เหมาะสมที่สุด (ระวังคำตอบหลอก 2 ใบ!)`
                      : 'แตะเลือกการ์ดสถานการณ์ฝั่งซ้าย แล้วจับคู่กับภาพวิธีแก้ฝั่งขวา'
                    : `เกมที่ 2 ด่าน ${quizRoundIndex + 1}/${game2List.length}: อ่านโจทย์วิเคราะห์จุดเสี่ยงด้านซ้าย แล้วเลือกภาพคำตอบให้ตรงคำถาม!`}
                </span>
              </div>
            )}
          </div>

          {/* ================= GAME 1: MATCH BOARD (4x6) ================= */}
          {gameMode === 'match_board' && (
            <div
              ref={boardContainerRef}
              className="relative flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-4"
            >
              <svg
                className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none z-20"
                aria-hidden="true"
              >
                {tetherLines.map((line) => {
                  const midX = (line.x1 + line.x2) / 2;
                  return (
                    <g key={line.qId}>
                      <path
                        d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeOpacity="0.85"
                      />
                      <circle cx={line.x1} cy={line.y1} r="5" fill="#10B981" />
                      <circle cx={line.x2} cy={line.y2} r="5" fill="#10B981" />
                    </g>
                  );
                })}
              </svg>

              <section className="lg:col-span-5 space-y-2.5 relative z-10">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold text-sky-200">
                    1. ภาพสถานการณ์หน้างาน (4 ข้อ)
                  </h2>
                  <span className="text-xs text-slate-400">คลิกเลือก 1 ข้อ</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {boardQuestions.map((q) => {
                    const isMatched = Boolean(matchedPairs[q.id]);
                    let cardState: CardVisualState = 'default';
                    if (isMatched) cardState = 'matched';
                    else if (selectedQuestionId === q.id) cardState = 'selected';
                    else if (hintPair?.qId === q.id) cardState = 'hinted';

                    return (
                      <div
                        key={q.id}
                        ref={(el) => {
                          questionRefs.current[q.id] = el;
                        }}
                      >
                        <GameCard
                          kicker={`${q.indexLabel} · ${q.category}`}
                          title={q.title}
                          caption={q.caption}
                          imageUrl={q.imageUrl}
                          state={cardState}
                          compact
                          disabled={isMatched}
                          onClick={() => handleSelectQuestion(q.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="lg:col-span-7 space-y-2.5 relative z-10">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold text-emerald-300">
                    2. เลือกภาพวิธีแก้ไข (4 คำตอบถูก + 2 คำตอบหลอก)
                  </h2>
                  <span className="text-xs text-slate-400">จับคู่ให้ครบ 4 คู่</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {boardSolutions.map((sol) => {
                    const matchedQId = Object.keys(matchedPairs).find(
                      (qId) => matchedPairs[qId] === sol.id
                    );
                    const matchedQ = matchedQId
                      ? boardQuestions.find((q) => q.id === matchedQId)
                      : null;

                    let cardState: CardVisualState = 'default';
                    if (matchedQ) cardState = 'matched';
                    else if (wrongPairCardId === sol.id) cardState = 'wrong';
                    else if (revealedTraps[sol.id]) cardState = 'trap';
                    else if (hintPair?.sId === sol.id) cardState = 'hinted';

                    return (
                      <div
                        key={sol.id}
                        ref={(el) => {
                          solutionRefs.current[sol.id] = el;
                        }}
                      >
                        <GameCard
                          kicker={
                            revealedTraps[sol.id]
                              ? 'ระวังกับดัก'
                              : matchedQ
                              ? `คู่กับ ${matchedQ.indexLabel}`
                              : 'เลือกวิธีรับมือ'
                          }
                          title={sol.title}
                          caption={sol.caption}
                          imageUrl={sol.imageUrl}
                          state={cardState}
                          matchTag={matchedQ?.indexLabel}
                          compact
                          disabled={Boolean(matchedQ)}
                          onClick={() => handleSelectBoardSolution(sol)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ================= GAME 2: DISTINCT RISK & ANTI-PATTERN 60s ================= */}
          {gameMode === 'quick_quiz' && game2List[quizRoundIndex] && (
            <div className="flex-1 flex flex-col gap-4 pb-4">
              {/* 4-Stage Stepper + Live 60s Countdown Bar */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center px-4 py-3 bg-[#122046]/80 border border-white/10 rounded-xl">
                <div className="md:col-span-6 flex items-center gap-2">
                  {game2List.map((ch, idx) => {
                    const done = Boolean(game2CompletedIds[ch.id]);
                    const current = idx === quizRoundIndex;
                    return (
                      <div
                        key={ch.id}
                        className={`flex-1 h-2 rounded-full transition-all ${
                          done ? 'bg-emerald-400' : current ? 'bg-sky-400' : 'bg-white/15'
                        }`}
                      />
                    );
                  })}
                  <span className="text-xs font-mono-num font-bold text-sky-200 ml-2 whitespace-nowrap">
                    ภารกิจ {quizRoundIndex + 1}/{game2List.length}
                  </span>
                </div>

                <div className="md:col-span-6 flex items-center gap-3">
                  <Clock
                    className={`w-4 h-4 shrink-0 ${
                      timeLeft <= 15 ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  />
                  <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        timeLeft <= 15 ? 'bg-rose-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.max(0, (timeLeft / SPRINT_SECONDS) * 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs font-mono-num font-bold whitespace-nowrap ${
                      timeLeft <= 15 ? 'text-rose-300' : 'text-amber-300'
                    }`}
                  >
                    เหลือ {timeLeft} วิ
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold text-amber-300">
                      โจทย์วิเคราะห์ด่านที่ {quizRoundIndex + 1} / {game2List.length}
                    </h2>
                    <span className="text-xs text-slate-400">
                      {game2List[quizRoundIndex].category}
                    </span>
                  </div>
                  <GameCard
                    kicker={`${game2List[quizRoundIndex].indexLabel} · ${game2List[quizRoundIndex].category}`}
                    title={game2List[quizRoundIndex].title}
                    caption={game2List[quizRoundIndex].caption}
                    imageUrl={game2List[quizRoundIndex].imageUrl}
                    state={quizResolvedCorrect ? 'matched' : 'selected'}
                    disabled
                  />
                </div>

                <div className="lg:col-span-7 space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold text-sky-200">
                      เลือกภาพที่ตรงกับโจทย์คำถามด้านซ้าย
                    </h2>
                    <span className="text-xs text-slate-400">แตะการ์ดเพื่อตอบ</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {quizChoices.map((sol, idx) => {
                      const currentChallenge = game2List[quizRoundIndex];
                      const isRight =
                        quizResolvedCorrect && sol.id === currentChallenge.correctChoiceId;
                      let cardState: CardVisualState = 'default';

                      if (isRight) cardState = 'matched';
                      else if (quizResolvedCorrect) cardState = 'dimmed';
                      else if (wrongPairCardId === sol.id) cardState = 'wrong';
                      else if (hintPair?.sId === sol.id) cardState = 'hinted';

                      return (
                        <GameCard
                          key={sol.id}
                          kicker={`ตัวเลือก ${String.fromCharCode(65 + idx)}`}
                          title={sol.title}
                          caption={sol.caption}
                          imageUrl={sol.imageUrl}
                          state={cardState}
                          disabled={quizResolvedCorrect}
                          onClick={() => handleSelectQuizAnswer(sol)}
                        />
                      );
                    })}
                  </div>

                  {quizResolvedCorrect && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleNextQuizRound}
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {quizRoundIndex + 1 >= game2List.length
                          ? 'ดูสรุปคะแนนทั้งหมด'
                          : 'ลุยภารกิจถัดไป'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= PAUSE MODAL ================= */}
      {gameState === 'PAUSED' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-white text-slate-900 rounded-2xl p-6 shadow-2xl space-y-5 text-center animate-card-enter">
            <div>
              <p className="text-xs font-medium text-slate-500">พักภารกิจชั่วคราว</p>
              <h2 className="text-xl font-bold text-slate-900 mt-1">หยุดเกมชั่วคราว</h2>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGameState('PLAYING')}
                className="w-full py-2.5 px-4 text-sm font-bold text-white bg-[#0F214D] hover:bg-[#16306e] rounded-xl transition-colors cursor-pointer"
              >
                เล่นต่อ
              </button>
              <button
                type="button"
                onClick={handleReturnToLogin}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                กลับหน้าจอเข้าสู่ระบบเกม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= VICTORY / THANK-YOU MODAL ================= */}
      <VictoryModal
        isOpen={gameState === 'GAME_OVER'}
        reason={endReason}
        gameMode={gameMode}
        otherModeAvailable={otherModeAvailable}
        playerName={employee?.fullName}
        saveStatus={saveStatus}
        score={score}
        maxCombo={Math.max(1, maxCombo)}
        mistakes={mistakes}
        matchedCount={matchedCount}
        elapsedSeconds={elapsedSeconds}
        onPlayOtherGame={() => startGame(otherGameMode)}
        onFinishToLockedHome={() => setGameState('TITLE_MENU')}
        onReturnToLogin={handleReturnToLogin}
      />

      {/* ================= ADMIN ALL-PLAYERS SCORE MODAL ================= */}
      <AdminDashboardModal
        isOpen={showAdminDashboard}
        isAdminVerified={isAdmin}
        onClose={() => setShowAdminDashboard(false)}
        onResultDeleted={(deletedPlayerKey, deletedMode) => {
          setReceiptsMap((prev) => {
            const playerRec = prev[deletedPlayerKey];
            if (!playerRec) return prev;
            const updatedPlayerRec = { ...playerRec };
            delete updatedPlayerRec[deletedMode];
            const next: PlayerReceiptsMap = {
              ...prev,
              [deletedPlayerKey]: updatedPlayerRec,
            };
            try {
              localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(next));
            } catch {
              // Ignore storage quota errors
            }
            return next;
          });
          if (employee?.playerKey === deletedPlayerKey) {
            setPlayedGames((prev) => {
              const updated = { ...prev, [deletedMode]: false };
              if (!updated.match_board && !updated.quick_quiz) {
                saveActiveEmployee(null);
              }
              return updated;
            });
            setGameMode(deletedMode);
            setTimerMode(deletedMode === 'quick_quiz' ? 'sprint' : 'chill');
          }
        }}
      />

      {/* ================= PROMPT KIT MODAL ================= */}
      <PromptKitModal isOpen={showPromptKit} onClose={() => setShowPromptKit(false)} />
    </div>
  );
}
