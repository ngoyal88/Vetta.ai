import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "firebaseConfig";
import { useAuth } from "shared/context/AuthContext";

export type UserProfile = {
  name?: string;
  [key: string]: unknown;
};

type UseUserProfileResult = {
  profile: UserProfile | null;
  loading: boolean;
};

const useUserProfile = (): UseUserProfileResult => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", currentUser.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile(null);
        }
      } catch (err: unknown) {
        const code = err instanceof Error ? err.message : err;
        console.warn("Failed to load user profile:", code, err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchProfile();
  }, [currentUser]);

  return { profile, loading };
};

export default useUserProfile;
