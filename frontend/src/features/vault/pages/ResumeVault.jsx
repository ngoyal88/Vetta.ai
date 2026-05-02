import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useVaultLibrary } from '../hooks/useVaultLibrary';

const MAX_RESUMES = 5;
const MAX_VERSIONS = 5;

const ResumeVault = () => {
  const {
    entries,
    meta,
    loading,
    error,
    uploadResume,
    deleteEntry,
    setActive,
    updateMeta,
    reanalyze,
    compare,
    getVersions,
    restoreVersion,
  } = useVaultLibrary();

  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const [newName, setNewName] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newFile, setNewFile] = useState(null);

  const [versionFile, setVersionFile] = useState(null);
  const [versionNote, setVersionNote] = useState('');

  const [compareSelection, setCompareSelection] = useState([]);
  const [compareRole, setCompareRole] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [comparing, setComparing] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedResumeId) || null,
    [entries, selectedResumeId],
  );

  const compareA = useMemo(
    () => entries.find((entry) => entry.id === compareSelection[0]) || null,
    [entries, compareSelection],
  );

  const compareB = useMemo(
    () => entries.find((entry) => entry.id === compareSelection[1]) || null,
    [entries, compareSelection],
  );

  useEffect(() => {
    const load = async () => {
      if (!selectedResumeId) {
        setVersions([]);
        return;
      }
      try {
        setLoadingVersions(true);
        const list = await getVersions(selectedResumeId);
        setVersions(list);
      } catch (err) {
        toast.error(err?.message || 'Failed to load versions');
      } finally {
        setLoadingVersions(false);
      }
    };
    load();
  }, [selectedResumeId, getVersions]);

  const handleUploadNew = async () => {
    if (!newFile) {
      toast.error('Select a file first');
      return;
    }
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await uploadResume({
        file: newFile,
        name: newName.trim(),
        tags: newTags,
      });
      setNewFile(null);
      setNewName('');
      setNewTags('');
      toast.success('Resume uploaded');
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    }
  };

  const handleAddVersion = async () => {
    if (!selectedEntry) {
      toast.error('Select a resume first');
      return;
    }
    if (!versionFile) {
      toast.error('Select a file first');
      return;
    }
    try {
      await uploadResume({
        file: versionFile,
        name: selectedEntry.name,
        tags: (selectedEntry.tags || []).join(', '),
        resumeId: selectedEntry.id,
        userNote: versionNote,
      });
      setVersionFile(null);
      setVersionNote('');
      const list = await getVersions(selectedEntry.id);
      setVersions(list);
      toast.success('Version added');
    } catch (err) {
      toast.error(err?.message || 'Version upload failed');
    }
  };

  const toggleCompare = (resumeId) => {
    setCompareResult(null);
    setCompareSelection((prev) => {
      if (prev.includes(resumeId)) {
        return prev.filter((id) => id !== resumeId);
      }
      if (prev.length >= 2) {
        return [prev[1], resumeId];
      }
      return [...prev, resumeId];
    });
  };

  const handleCompare = async () => {
    if (compareSelection.length !== 2) {
      toast.error('Select two resumes to compare');
      return;
    }
    try {
      setComparing(true);
      const result = await compare(compareSelection[0], compareSelection[1], compareRole);
      setCompareResult(result);
    } catch (err) {
      toast.error(err?.message || 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  const handleUpdateMeta = async () => {
    if (!editId) return;
    try {
      await updateMeta(editId, {
        name: editName.trim(),
        tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setEditId(null);
      toast.success('Resume updated');
    } catch (err) {
      toast.error(err?.message || 'Update failed');
    }
  };

  return (
    <div className="min-h-screen bg-base px-5 py-6 pt-16 text-[#e2e1eb]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Resume Vault</p>
          <Link to="/dashboard" className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
            Back to Dashboard
          </Link>
        </div>

        {error && <div className="mb-4 text-xs text-red-400">{error}</div>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">New Resume</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Resume name"
                  className="w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2 text-xs"
                />
                <input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="Tags (comma separated)"
                  className="w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2 text-xs"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                  className="text-xs"
                />
                <button
                  type="button"
                  onClick={handleUploadNew}
                  disabled={loading || entries.length >= MAX_RESUMES}
                  className="btn-primary text-xs h-8 disabled:opacity-40"
                >
                  Upload Resume
                </button>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {entries.length}/{MAX_RESUMES} resumes
                </span>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Library</p>
                {loading && <span className="text-[10px] text-[var(--text-tertiary)]">Loading...</span>}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-sm border p-3 transition-colors ${
                      selectedResumeId === entry.id
                        ? 'border-cyan-400/60 bg-[#101418]'
                        : 'border-[var(--border)] bg-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-medium text-white">{entry.name}</div>
                        <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
                          Versions: {entry.version_count || 0} / {MAX_VERSIONS}
                        </div>
                        {entry.tags?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {entry.tags.map((tag) => (
                              <span key={tag} className="border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {entry.is_active && (
                        <span className="text-[10px] text-emerald-400">ACTIVE</span>
                      )}
                    </div>

                    {entry.scorecard && (
                      <div className="mt-3 text-[10px] text-[var(--text-tertiary)]">
                        Score: <span className="text-white">{entry.scorecard.score}</span>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedResumeId(entry.id)}
                        className="btn-ghost text-[10px] h-7"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setActive(entry.id)}
                        className="btn-ghost text-[10px] h-7"
                      >
                        Set Active
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCompare(entry.id)}
                        className="btn-ghost text-[10px] h-7"
                      >
                        {compareSelection.includes(entry.id) ? 'Selected' : 'Compare'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(entry.id);
                          setEditName(entry.name);
                          setEditTags((entry.tags || []).join(', '));
                        }}
                        className="btn-ghost text-[10px] h-7"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEntry(entry.id)}
                        className="btn-ghost text-[10px] h-7 text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {!entries.length && (
                  <div className="text-[10px] text-[var(--text-tertiary)]">
                    No resumes yet. Upload one to get started.
                  </div>
                )}
              </div>
            </div>

            <div className="card p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Compare Resumes</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  value={compareRole}
                  onChange={(e) => setCompareRole(e.target.value)}
                  placeholder="Role for comparison (optional)"
                  className="flex-1 rounded-sm border border-[var(--border)] bg-transparent px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={handleCompare}
                  disabled={comparing}
                  className="btn-primary text-xs h-8 disabled:opacity-40"
                >
                  {comparing ? 'Comparing...' : 'Compare'}
                </button>
              </div>
              {(compareA || compareB) && (
                <div className="mt-3 text-[10px] text-[var(--text-tertiary)]">
                  Resume A: {compareA?.name || 'Not selected'} | Resume B: {compareB?.name || 'Not selected'}
                </div>
              )}
              {compareResult && (
                <div className="mt-4 text-xs text-[var(--text-secondary)] space-y-2">
                  <div>Score delta: {compareResult.score_delta}</div>
                  <div>Recommended: {compareResult.recommended_id === 'a' ? 'Resume A' : 'Resume B'}</div>
                  <div>{compareResult.recommendation_reason}</div>
                  <div>
                    Skills only in A: {(compareResult.skills_only_in_a || []).join(', ') || 'None'}
                  </div>
                  <div>
                    Skills only in B: {(compareResult.skills_only_in_b || []).join(', ') || 'None'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Selected Resume</p>
              {!selectedEntry && (
                <div className="mt-3 text-[10px] text-[var(--text-tertiary)]">Select a resume to view versions.</div>
              )}
              {selectedEntry && (
                <div className="mt-3 space-y-3">
                  <div className="text-xs text-white">{selectedEntry.name}</div>
                  {selectedEntry.scorecard && (
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      Score: {selectedEntry.scorecard.score}
                    </div>
                  )}
                  {selectedEntry.scorecard?.ats_flags?.length > 0 && (
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      ATS flags: {selectedEntry.scorecard.ats_flags.join(', ')}
                    </div>
                  )}
                  {selectedEntry.scorecard?.weak_areas?.length > 0 && (
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      Weak areas: {selectedEntry.scorecard.weak_areas.join(', ')}
                    </div>
                  )}
                  {selectedEntry.scorecard?.suggestions?.length > 0 && (
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      Suggestions: {selectedEntry.scorecard.suggestions.join(' | ')}
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn-ghost text-[10px] h-7"
                    onClick={() => reanalyze(selectedEntry.id, selectedEntry.current_version_id, compareRole)}
                  >
                    Re-analyze
                  </button>
                </div>
              )}
            </div>

            {selectedEntry && (
              <div className="card p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Add Version</p>
                <div className="mt-3 space-y-2">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                    className="text-xs"
                  />
                  <input
                    value={versionNote}
                    onChange={(e) => setVersionNote(e.target.value)}
                    placeholder="Version note (optional)"
                    className="w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddVersion}
                    disabled={(selectedEntry.version_count || 0) >= MAX_VERSIONS}
                    className="btn-primary text-xs h-8 disabled:opacity-40"
                  >
                    Upload Version
                  </button>
                </div>
              </div>
            )}

            {selectedEntry && (
              <div className="card p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Versions</p>
                {loadingVersions && (
                  <div className="mt-2 text-[10px] text-[var(--text-tertiary)]">Loading...</div>
                )}
                {!loadingVersions && (
                  <div className="mt-3 space-y-3">
                    {versions.map((version) => (
                      <div key={version.id} className="border border-[var(--border)] p-3 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span>v{version.version_number}</span>
                          {selectedEntry.current_version_id === version.id && (
                            <span className="text-emerald-400">CURRENT</span>
                          )}
                        </div>
                        <div className="mt-1 text-[var(--text-tertiary)]">
                          Score: {version.score_at_version ?? 'N/A'}
                        </div>
                        {version.diff_summary && (
                          <div className="mt-2 text-[var(--text-secondary)]">{version.diff_summary}</div>
                        )}
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => restoreVersion(version.id, compareRole)}
                            className="btn-ghost text-[10px] h-6"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                    {!versions.length && (
                      <div className="text-[10px] text-[var(--text-tertiary)]">No versions yet.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {editId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="card w-full max-w-md p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Edit Resume</p>
              <div className="mt-3 space-y-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2 text-xs"
                />
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full rounded-sm border border-[var(--border)] bg-transparent px-3 py-2 text-xs"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-ghost text-xs h-7"
                  onClick={() => setEditId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs h-7"
                  onClick={handleUpdateMeta}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeVault;
