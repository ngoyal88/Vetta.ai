import React from 'react';

import { ClaimsInbox } from '../components/ClaimsInbox';
import { ProfileMemoryPanel } from '../components/ProfileMemoryPanel';
import { ReadinessPanel } from '../components/ReadinessPanel';
import { useSignalIntelligence } from '../hooks/useSignalIntelligence';

const SignalIntelligencePage: React.FC = () => {
  const {
    sectionFilter,
    setSectionFilter,
    claims,
    selected,
    memory,
    loading,
    error,
    actingId,
    bulkBusy,
    targetRole,
    jobDescription,
    readiness,
    readinessHistory,
    readinessLoading,
    setTargetRole,
    setJobDescription,
    toggleSelected,
    acceptOne,
    rejectOne,
    bulkUpdate,
    computeReadiness,
  } = useSignalIntelligence();

  return (
    <div className="min-h-screen bg-base px-5 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
          Signal Intelligence
        </p>

        <ReadinessPanel
          targetRole={targetRole}
          jobDescription={jobDescription}
          readiness={readiness}
          readinessHistory={readinessHistory}
          loading={readinessLoading}
          onTargetRoleChange={setTargetRole}
          onJobDescriptionChange={setJobDescription}
          onCompute={() => void computeReadiness()}
        />

        <ClaimsInbox
          sectionFilter={sectionFilter}
          claims={claims}
          selected={selected}
          loading={loading}
          error={error}
          actingId={actingId}
          bulkBusy={bulkBusy}
          onSectionFilterChange={setSectionFilter}
          onToggleSelected={toggleSelected}
          onAccept={acceptOne}
          onReject={rejectOne}
          onBulkAccept={() => void bulkUpdate('accepted')}
          onBulkReject={() => void bulkUpdate('rejected')}
        />

        <ProfileMemoryPanel memory={memory} />
      </div>
    </div>
  );
};

export default SignalIntelligencePage;
