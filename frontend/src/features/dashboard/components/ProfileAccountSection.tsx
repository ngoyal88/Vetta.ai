import React from "react";
import { AlertTriangle, Image, Mail, ShieldCheck, User2 } from "lucide-react";
import toast from "react-hot-toast";

import { useConfirmDialog } from "shared/context/ConfirmDialogContext";
import type { AccountPanelProps } from "features/dashboard/types/panels";

const ProfileAccountSection = ({
  currentUser,
  profileName,
  setProfileName,
  profilePhoto,
  setProfilePhoto,
  savingProfile,
  setSavingProfile,
  sendVerification,
  resetPassword,
  updateProfileInfo,
  refreshUser,
  deletingAccountState,
  setDeletingAccountState,
  api,
  deleteAccount,
  navigate,
}: AccountPanelProps) => {
  const { confirmDialog } = useConfirmDialog();

  return (
    <section className="mt-6 rounded-md border border-[var(--border)] bg-[var(--bg-1)] p-4 md:p-5">
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 shrink-0 text-[var(--teal-1)]" aria-hidden />
        <h2 className="text-lg font-medium tracking-tight text-[var(--cream-0)]">Account & Profile</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--cream-3)]">
              Email
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cream-3)]"
                aria-hidden
              />
              <input
                type="email"
                value={currentUser?.email || ""}
                readOnly
                className="input-base w-full cursor-not-allowed pl-10 opacity-90"
                placeholder="email"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--cream-3)]">
              Display Name
            </label>
            <div className="relative">
              <User2
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cream-3)]"
                aria-hidden
              />
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="input-base w-full pl-10 transition-[border-color,box-shadow] duration-[120ms] ease-out"
                placeholder="Your name"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--cream-3)]">
              Photo URL
            </label>
            <div className="relative">
              <Image
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cream-3)]"
                aria-hidden
              />
              <input
                type="url"
                value={profilePhoto}
                onChange={(e) => setProfilePhoto(e.target.value)}
                className="input-base w-full pl-10 transition-[border-color,box-shadow] duration-[120ms] ease-out"
                placeholder="https://..."
              />
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                setSavingProfile(true);
                await updateProfileInfo({
                  displayName: profileName || undefined,
                  photoURL: profilePhoto || undefined,
                });
                await refreshUser();
                toast.success("Profile updated");
              } catch (err) {
                console.error(err);
                toast.error("Failed to update profile");
              } finally {
                setSavingProfile(false);
              }
            }}
            disabled={savingProfile}
            className="btn-cyan h-10 w-full text-sm transition-opacity duration-[120ms] ease-out disabled:opacity-50"
          >
            {savingProfile ? "Saving..." : "Save profile"}
          </button>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  await sendVerification();
                  toast.success("Verification email sent");
                } catch (err) {
                  console.error(err);
                  toast.error("Failed to send verification");
                }
              }}
              className="btn-ghost h-9 px-4 text-sm transition-[border-color,color,background-color] duration-[120ms] ease-out"
            >
              Send verification
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!currentUser?.email) {
                  toast.error("No email on account");
                  return;
                }
                try {
                  await resetPassword(currentUser.email);
                  toast.success("Password reset email sent");
                } catch (err) {
                  console.error(err);
                  toast.error("Failed to send reset email");
                }
              }}
              className="btn-ghost h-9 px-4 text-sm transition-[border-color,color,background-color] duration-[120ms] ease-out"
            >
              Reset password
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-[var(--red-1)]/35 bg-[var(--bg-0)] p-4">
            <div className="mb-2 flex items-center gap-2 text-[var(--red-1)]">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-sm font-semibold text-[var(--cream-0)]">Danger zone</span>
            </div>
            <p className="mb-3 text-sm text-[var(--cream-2)]">
              Delete your account and all interview history. This action cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => {
                confirmDialog({
                  title: "Delete account",
                  message: "Delete your account and all interview data? This cannot be undone.",
                  destructive: true,
                  onConfirm: async () => {
                    try {
                      setDeletingAccountState(true);
                      await api.deleteAccountData();
                      await deleteAccount();
                      toast.success("Account deleted");
                      navigate("/");
                    } catch (err) {
                      console.error(err);
                      toast.error("Failed to delete account");
                    } finally {
                      setDeletingAccountState(false);
                    }
                  },
                });
              }}
              disabled={deletingAccountState}
              className="h-10 w-full rounded border border-[var(--red-1)] bg-transparent px-4 text-sm font-medium text-[var(--red-1)] transition-[border-color,background-color] duration-[120ms] ease-out hover:bg-[var(--bg-2)] disabled:opacity-60"
            >
              {deletingAccountState ? "Deleting..." : "Delete account"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProfileAccountSection;
