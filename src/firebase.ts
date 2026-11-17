import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Single designated administrator email (enforced both in UI and in firestore.rules)
export const ADMIN_EMAIL = 'jaelove363@gmail.com';

export function isUserAdmin(user: User | null): boolean {
  return Boolean(user && user.emailVerified && user.email === ADMIN_EMAIL);
}

// Startup connection validation per Firebase integration guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type GameModeKey = 'match_board' | 'quick_quiz';

export interface PlayedGamesMap {
  match_board: boolean;
  quick_quiz: boolean;
}

export interface EmployeeSession {
  playerKey: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface GameResultRecord {
  id: string;
  playerKey: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mode: GameModeKey;
  timerMode: 'chill' | 'sprint';
  score: number;
  accuracy: number;
  maxCombo: number;
  mistakes: number;
  wrongAnswers?: string[];
  matchedCount: number;
  elapsedSeconds: number;
  reason: 'completed' | 'timeout';
  rank: 'S' | 'A' | 'B';
  createdAt?: Timestamp;
}

export interface PlayerReceipt {
  playerKey: string;
  fullName: string;
  mode: GameModeKey;
  score: number;
  accuracy: number;
  matchedCount: number;
  elapsedSeconds: number;
  rank: 'S' | 'A' | 'B';
  completedAtIso: string;
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function sanitizeNamePart(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 60);
}

// Deterministic ASCII-safe playerKey from First Name + Last Name
export async function buildPlayerKey(firstName: string, lastName: string): Promise<string> {
  const normalized = `${sanitizeNamePart(firstName).toLowerCase()}|${sanitizeNamePart(lastName).toLowerCase()}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `emp_${hex.slice(0, 32)}`;
  }
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `emp_${part1}${part2}`;
}

export function buildGameLockKey(playerKey: string, mode: GameModeKey): string {
  return `${playerKey}__${mode}`;
}

export async function checkPlayerPlayedGames(playerKey: string): Promise<PlayedGamesMap> {
  const lock1Key = buildGameLockKey(playerKey, 'match_board');
  const lock2Key = buildGameLockKey(playerKey, 'quick_quiz');
  try {
    const readLock = async (lockKey: string) => {
      const ref = doc(db, 'playerLocks', lockKey);
      try {
        return await getDocFromServer(ref);
      } catch {
        return await getDoc(ref);
      }
    };
    const [snap1, snap2] = await Promise.all([readLock(lock1Key), readLock(lock2Key)]);
    return {
      match_board: snap1.exists(),
      quick_quiz: snap2.exists(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `playerLocks/${lock1Key}`);
  }
}

export async function saveSinglePlayResultAtomic(params: {
  player: EmployeeSession;
  mode: GameModeKey;
  timerMode: 'chill' | 'sprint';
  score: number;
  accuracy: number;
  maxCombo: number;
  mistakes: number;
  wrongAnswers: string[];
  matchedCount: number;
  elapsedSeconds: number;
  reason: 'completed' | 'timeout';
  rank: 'S' | 'A' | 'B';
}): Promise<PlayerReceipt> {
  const { player } = params;
  const clampedScore = Math.max(0, Math.min(10000, Math.round(params.score)));
  const clampedAccuracy = Math.max(0, Math.min(100, Math.round(params.accuracy)));
  const clampedCombo = Math.max(1, Math.min(20, Math.round(params.maxCombo)));
  const clampedMistakes = Math.max(0, Math.min(100, Math.round(params.mistakes)));
  const clampedMatched = Math.max(0, Math.min(4, Math.round(params.matchedCount)));
  const clampedElapsed = Math.max(0, Math.min(3600, Math.round(params.elapsedSeconds)));
  const sanitizedWrongAnswers = (params.wrongAnswers ?? [])
    .map((item) => item.trim().slice(0, 220))
    .filter((item) => item.length > 0)
    .slice(0, 30);

  const lockKey = buildGameLockKey(player.playerKey, params.mode);
  const resultId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const resultPath = `gameResults/${resultId}`;
  const lockRef = doc(db, 'playerLocks', lockKey);
  const resultRef = doc(db, 'gameResults', resultId);

  try {
    const batch = writeBatch(db);
    batch.set(lockRef, {
      lockKey,
      playerKey: player.playerKey,
      mode: params.mode,
      hasPlayed: true,
      createdAt: serverTimestamp(),
    });
    batch.set(resultRef, {
      playerKey: player.playerKey,
      firstName: player.firstName,
      lastName: player.lastName,
      fullName: player.fullName,
      mode: params.mode,
      timerMode: params.timerMode,
      score: clampedScore,
      accuracy: clampedAccuracy,
      maxCombo: clampedCombo,
      mistakes: clampedMistakes,
      wrongAnswers: sanitizedWrongAnswers,
      matchedCount: clampedMatched,
      elapsedSeconds: clampedElapsed,
      reason: params.reason,
      rank: params.rank,
      createdAt: serverTimestamp(),
    });
    await batch.commit();

    return {
      playerKey: player.playerKey,
      fullName: player.fullName,
      mode: params.mode,
      score: clampedScore,
      accuracy: clampedAccuracy,
      matchedCount: clampedMatched,
      elapsedSeconds: clampedElapsed,
      rank: params.rank,
      completedAtIso: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, resultPath);
  }
}

export function subscribeAllResultsAdmin(
  onData: (results: GameResultRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'gameResults';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(500));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: GameResultRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<GameResultRecord, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function deleteGameResultAdmin(
  resultId: string,
  playerKey?: string,
  mode?: GameModeKey
): Promise<void> {
  const path = `gameResults/${resultId}`;
  try {
    await deleteDoc(doc(db, 'gameResults', resultId));
    if (playerKey && mode) {
      await deleteDoc(doc(db, 'playerLocks', buildGameLockKey(playerKey, mode)));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
