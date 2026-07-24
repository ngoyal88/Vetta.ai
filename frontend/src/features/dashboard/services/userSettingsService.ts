import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from 'firebaseConfig';
import { isE2EMockAuthEnabled } from 'shared/e2e/e2eMockAuth';
import type { InterviewDefaults, UserSettingsDoc } from '../types/userSettings';

export async function fetchUserSettings(uid: string): Promise<UserSettingsDoc | null> {
  if (isE2EMockAuthEnabled()) {
    return {
      name: 'E2E User',
      email: 'e2e@vetta.test',
    };
  }
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserSettingsDoc) : null;
}

export async function persistUserSettings(
  uid: string,
  payload: {
    name?: string;
    email?: string;
    photoURL?: string;
    defaults?: InterviewDefaults;
  },
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
