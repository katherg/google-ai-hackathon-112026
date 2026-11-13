import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ONBOARDING_GOALS } from '../data/demoData';
import { OnboardingGoal, PrivacySettings } from '../types';

export interface PersistedUserProfile {
  uid: string;
  firstName: string;
  babyName: string;
  babyDateInput: string;
  babyDateLabel: string;
  selectedGoals: OnboardingGoal[];
  suggestedGroupIds: string[];
  privacy: PrivacySettings;
  niaInsights?: string[];
  completed: boolean;
}

const VALID_EXPIRY_OPTIONS: PrivacySettings['expiryOption'][] = [
  '30 days',
  '90 days',
  'Until revoked',
];

function clampString(value: string, maxLen: number, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function sanitizeDateInput(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return '2026-08-13';
}

function sanitizeGoals(goals: OnboardingGoal[]): OnboardingGoal[] {
  const filtered = goals.filter((g) => ONBOARDING_GOALS.includes(g)).slice(0, 2);
  return filtered.length > 0 ? filtered : ['Sleep'];
}

function sanitizeGroupIds(groupIds: string[]): string[] {
  return groupIds
    .map((id) => id.trim().slice(0, 64))
    .filter(Boolean)
    .slice(0, 5);
}

export function sanitizeNiaInsights(insights: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of insights) {
    const trimmed = String(item ?? '').trim().slice(0, 140);
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      cleaned.push(trimmed);
    }
    if (cleaned.length >= 6) break;
  }
  return cleaned;
}

export function sanitizePrivacySettings(raw: Partial<PrivacySettings>): PrivacySettings {
  const expiryOption = VALID_EXPIRY_OPTIONS.includes(raw.expiryOption as PrivacySettings['expiryOption'])
    ? (raw.expiryOption as PrivacySettings['expiryOption'])
    : '90 days';

  return {
    shareCheckIns: Boolean(raw.shareCheckIns),
    shareAppointments: Boolean(raw.shareAppointments),
    shareWithOB: Boolean(raw.shareWithOB),
    shareWithTherapist: Boolean(raw.shareWithTherapist),
    shareWithPartner: Boolean(raw.shareWithPartner),
    expiryOption,
    anonymousInCommunity: raw.anonymousInCommunity ?? true,
  };
}

export async function loadUserProfile(uid: string): Promise<PersistedUserProfile | null> {
  const profilePath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as Partial<PersistedUserProfile>;
    return {
      uid,
      firstName: clampString(data.firstName ?? 'Maya', 80, 'Maya'),
      babyName: clampString(data.babyName ?? 'Leo', 80, 'Leo'),
      babyDateInput: sanitizeDateInput(data.babyDateInput ?? '2026-08-13'),
      babyDateLabel: clampString(data.babyDateLabel ?? 'Leo · 3 months old', 120, 'Leo · 3 months old'),
      selectedGoals: sanitizeGoals((data.selectedGoals as OnboardingGoal[]) ?? ['Sleep']),
      suggestedGroupIds: sanitizeGroupIds(data.suggestedGroupIds ?? []),
      privacy: sanitizePrivacySettings(data.privacy ?? {}),
      ...(Array.isArray(data.niaInsights)
        ? { niaInsights: sanitizeNiaInsights(data.niaInsights) }
        : {}),
      completed: Boolean(data.completed),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }
}

export async function saveUserAccountAndProfile(params: {
  uid: string;
  email: string;
  firstName: string;
  babyName: string;
  babyDateInput: string;
  babyDateLabel: string;
  selectedGoals: OnboardingGoal[];
  suggestedGroupIds: string[];
  privacy: PrivacySettings;
}): Promise<PersistedUserProfile> {
  const { uid } = params;
  const profilePath = `users/${uid}`;
  const privatePath = `users/${uid}/private/account`;

  const sanitized: PersistedUserProfile = {
    uid,
    firstName: clampString(params.firstName, 80, 'Maya'),
    babyName: clampString(params.babyName, 80, 'Baby'),
    babyDateInput: sanitizeDateInput(params.babyDateInput),
    babyDateLabel: clampString(params.babyDateLabel, 120, 'Baby'),
    selectedGoals: sanitizeGoals(params.selectedGoals),
    suggestedGroupIds: sanitizeGroupIds(params.suggestedGroupIds),
    privacy: sanitizePrivacySettings(params.privacy),
    completed: true,
  };

  const cleanEmail = clampString(params.email, 254, '');

  const profileRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'account');

  let profileExists = false;
  let privateExists = false;

  try {
    const [profileSnap, privateSnap] = await Promise.all([
      getDoc(profileRef),
      cleanEmail ? getDoc(privateRef) : Promise.resolve(null),
    ]);
    profileExists = profileSnap.exists();
    privateExists = Boolean(privateSnap?.exists());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  try {
    const batch = writeBatch(db);
    if (profileExists) {
      batch.update(profileRef, {
        firstName: sanitized.firstName,
        babyName: sanitized.babyName,
        babyDateInput: sanitized.babyDateInput,
        babyDateLabel: sanitized.babyDateLabel,
        selectedGoals: sanitized.selectedGoals,
        suggestedGroupIds: sanitized.suggestedGroupIds,
        privacy: sanitized.privacy,
        completed: sanitized.completed,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(profileRef, {
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (cleanEmail) {
      if (privateExists) {
        batch.update(privateRef, {
          email: cleanEmail,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(privateRef, {
          uid,
          email: cleanEmail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, cleanEmail ? `${profilePath} + ${privatePath}` : profilePath);
  }
}

export async function savePrivacyPreferences(
  uid: string,
  privacy: PrivacySettings
): Promise<void> {
  const profilePath = `users/${uid}`;
  const profileRef = doc(db, 'users', uid);

  let snapExists = false;
  try {
    const snap = await getDoc(profileRef);
    snapExists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  if (!snapExists) {
    return;
  }

  try {
    const batch = writeBatch(db);
    batch.update(profileRef, {
      privacy: sanitizePrivacySettings(privacy),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}

export async function saveNiaInsights(
  uid: string,
  insights: string[]
): Promise<void> {
  const profilePath = `users/${uid}`;
  const profileRef = doc(db, 'users', uid);

  let snapExists = false;
  try {
    const snap = await getDoc(profileRef);
    snapExists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  if (!snapExists) {
    return;
  }

  try {
    const batch = writeBatch(db);
    batch.update(profileRef, {
      niaInsights: sanitizeNiaInsights(insights),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}
