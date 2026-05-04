import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "shared/context/AuthContext";
import useUserProfile from "shared/hooks/useUserProfile";
import { api } from "shared/services/api";
import ProfileAccountSection from "features/dashboard/components/ProfileAccountSection";

const Profile: React.FC = () => {
  const { currentUser, sendVerification, resetPassword, updateProfileInfo, deleteAccount, refreshUser } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();

  const [profileName, setProfileName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingAccountState, setDeletingAccountState] = useState(false);

  useEffect(() => {
    setProfileName(profile?.name || currentUser?.displayName || "");
    setProfilePhoto(currentUser?.photoURL || "");
  }, [profile?.name, currentUser]);

  return (
    <div className="min-h-screen bg-base px-6 py-6 pt-16 text-[var(--cream-1)] md:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--teal-1)]">Profile</p>
        <ProfileAccountSection
          currentUser={currentUser}
          profileName={profileName}
          setProfileName={setProfileName}
          profilePhoto={profilePhoto}
          setProfilePhoto={setProfilePhoto}
          savingProfile={savingProfile}
          setSavingProfile={setSavingProfile}
          sendVerification={sendVerification}
          resetPassword={resetPassword}
          updateProfileInfo={updateProfileInfo}
          refreshUser={refreshUser}
          deletingAccountState={deletingAccountState}
          setDeletingAccountState={setDeletingAccountState}
          api={api}
          deleteAccount={deleteAccount}
          navigate={navigate}
        />
      </div>
    </div>
  );
};

export default Profile;
