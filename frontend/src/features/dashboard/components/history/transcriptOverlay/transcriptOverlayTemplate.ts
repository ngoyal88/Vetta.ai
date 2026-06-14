import { transcriptOverlayStyles } from './transcriptOverlayStyles';

type TranscriptLineLike = {
  speaker?: string | null;
  text?: string | null;
  timestamp?: string | null;
};

type TranscriptOverlayMeta = {
  roleLabel: string;
  startedAtLabel: string;
  durationLabel: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatTranscriptTimestamp(raw?: string | null): string {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTranscriptDate(raw?: string | null): string {
  if (!raw) return 'Date unavailable';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDurationLabel(durationMinutes?: number | null): string {
  if (typeof durationMinutes !== 'number' || durationMinutes <= 0) return 'Duration unavailable';
  const totalSeconds = Math.round(durationMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function buildTranscriptAvatarMarkup(isCandidate: boolean): string {
  if (isCandidate) {
    return `<div class="avatar avatar--you" aria-label="Candidate avatar">
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.33 0-6 2.02-6 4.5V20h12v-1.5c0-2.48-2.67-4.5-6-4.5z"/>
  </svg>
</div>`;
  }
  return `<div class="avatar avatar--ai" aria-label="AI avatar">
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9 2h6v2h2a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-1v3h-2v-3h-4v3H8v-3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h2zm-2 4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zm2 4a1.5 1.5 0 1 1-1.5 1.5A1.5 1.5 0 0 1 9 10zm6 0a1.5 1.5 0 1 1-1.5 1.5A1.5 1.5 0 0 1 15 10z"/>
  </svg>
</div>`;
}

function buildTranscriptMetricBadge(text: string, isCandidate: boolean): string {
  const hasMetric = /(\d+%|\d+\s*(ms|sec|seconds|minutes|m|h))/i.test(text);
  if (!isCandidate || !hasMetric) return '';
  return `<div class="metric-badge">High Impact Metric Detected</div>`;
}

function buildTranscriptRowMarkup(line: TranscriptLineLike): string {
  const isCandidate = line.speaker === 'candidate';
  const speakerClass = isCandidate ? 'you' : 'ai';
  const text = String(line.text || '');
  const safeText = escapeHtml(text.trim() || '…');
  const safeTimestamp = line.timestamp ? escapeHtml(formatTranscriptTimestamp(line.timestamp)) : '';
  const metricBadge = buildTranscriptMetricBadge(text, isCandidate);

  return `<article class="row row--${speakerClass}" data-speaker="${speakerClass}">
  <div class="avatar-col">
    ${buildTranscriptAvatarMarkup(isCandidate)}
  </div>
  <section class="line line--${speakerClass}">
    <p>${safeText}</p>
    ${metricBadge}
    ${safeTimestamp ? `<div class="time">${safeTimestamp}</div>` : ''}
  </section>
</article>`;
}

export function buildTranscriptDocument(lines: TranscriptLineLike[], meta: TranscriptOverlayMeta): string {
  const firstTimestamp = lines.find((line) => line.timestamp)?.timestamp;
  const sessionStartedLabel = firstTimestamp ? formatTranscriptTimestamp(firstTimestamp) : '—';
  const rows = lines.map((line) => buildTranscriptRowMarkup(line)).join('\n');

  const normalizedRole = escapeHtml(meta.roleLabel || 'Interview Session');
  const normalizedDate = escapeHtml(meta.startedAtLabel);
  const normalizedDuration = escapeHtml(meta.durationLabel);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Interview Transcript</title>
  <style>
    ${transcriptOverlayStyles}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="title">
        <h1>Interview Transcript</h1>
      </div>
      <div class="meta">
        <span>${normalizedRole}</span>
        <span class="dot"></span>
        <span>${normalizedDate}</span>
        <span class="dot"></span>
        <span style="color:#6ffbbe;">${normalizedDuration}</span>
      </div>
    </div>
    <div class="searchbar">
      <input id="search-input" type="text" placeholder="Search transcript..." />
      <button class="btn btn--accent" type="button">Jump to AI Feedback</button>
      <button class="btn" type="button">More</button>
    </div>
    <div id="stream" class="stream">
      <div class="session-start">Session Started · ${escapeHtml(sessionStartedLabel)}</div>
      ${rows || '<div class="empty">Transcript is empty for this session.</div>'}
    </div>
    <div class="footer">
      <div class="footer-note">End-to-End Encrypted Session</div>
      <div class="footer-actions">
        <button class="btn" type="button">Export PDF</button>
        <button class="btn" type="button" style="border-color:rgba(173,198,255,0.45);background:rgba(173,198,255,0.18);">Full Analysis</button>
      </div>
    </div>
  </div>
  <script>
    const input = document.getElementById('search-input');
    const rows = Array.from(document.querySelectorAll('.row'));
    if (input) {
      input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        rows.forEach((row) => {
          const text = row.textContent ? row.textContent.toLowerCase() : '';
          row.style.display = !query || text.includes(query) ? '' : 'none';
        });
      });
    }
  </script>
</body>
</html>`;
}
