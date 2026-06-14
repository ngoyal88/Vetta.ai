export const transcriptOverlayStyles = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Plus Jakarta Sans", Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: #090f1f;
  color: #dae2fd;
  padding: 0;
}
.wrap {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(86, 156, 255, 0.12), transparent),
    radial-gradient(1200px 600px at 90% -10%, rgba(78, 201, 176, 0.1), transparent),
    #090f1f;
}
.top {
  position: relative;
  z-index: 2;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  background: rgba(11, 19, 38, 0.86);
  backdrop-filter: blur(14px);
  padding: 14px 20px 12px;
}
.title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.meta {
  margin-top: 6px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: rgba(194,198,214,0.92);
}
h1 {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(194,198,214,0.65);
}
.searchbar {
  display: flex;
  gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(19, 27, 46, 0.72);
  padding: 10px 20px;
}
.searchbar input {
  width: 100%;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  background: rgba(45, 52, 73, 0.3);
  color: #dae2fd;
  padding: 10px 12px;
  outline: none;
  font-size: 14px;
}
.searchbar input:focus {
  border-color: rgba(173,198,255,0.55);
  box-shadow: 0 0 0 2px rgba(173,198,255,0.18);
}
.btn {
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  color: #dae2fd;
  padding: 0 14px;
  min-height: 38px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.btn--accent {
  border-color: rgba(78,222,163,0.35);
  background: rgba(78,222,163,0.12);
  color: #6ffbbe;
}
.stream {
  flex: 1;
  overflow-y: auto;
  padding: 14px 20px 18px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.2) transparent;
}
.stream::-webkit-scrollbar { width: 6px; }
.stream::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
.stream::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 4px; }
.session-start {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(194,198,214,0.8);
}
.session-start:before,
.session-start:after {
  content: "";
  height: 1px;
  flex: 1;
  background: rgba(255,255,255,0.08);
}
.row {
  display: flex;
  width: 100%;
  gap: 12px;
  margin-bottom: 16px;
  align-items: flex-start;
  position: relative;
}
.row--you {
  flex-direction: row-reverse;
}
.avatar-col {
  width: 42px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  padding-top: 4px;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255,255,255,0.2);
  box-shadow: inset 0 0 16px rgba(255,255,255,0.05);
}
.avatar svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}
.avatar--ai {
  background: rgba(173,198,255,0.12);
  color: #adc6ff;
  border-color: rgba(173,198,255,0.36);
  position: relative;
}
.avatar--ai::after {
  content: "";
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #4edea3;
  box-shadow: 0 0 0 0 rgba(78, 222, 163, 0.4);
  animation: ai-pulse 2s ease-in-out infinite;
}
.avatar--you {
  background: rgba(78,222,163,0.12);
  color: #6ffbbe;
  border-color: rgba(78,222,163,0.36);
}
.line {
  width: min(80%, 860px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  background: rgba(255,255,255,0.03);
  padding: 14px 16px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.18);
}
.line--ai {
  border-color: rgba(86,156,255,0.35);
  background: linear-gradient(180deg, rgba(86,156,255,0.12), rgba(86,156,255,0.03));
  border-top-left-radius: 6px;
}
.line--you {
  border-color: rgba(77,142,255,0.4);
  background: linear-gradient(180deg, rgba(77,142,255,0.92), rgba(77,142,255,0.88));
  border-top-right-radius: 6px;
}
.time {
  margin-top: 8px;
  display: block;
  text-align: right;
  font-size: 11px;
  color: rgba(229, 235, 255, 0.72);
}
p {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.62;
  font-size: 14px;
  color: #f5f8ff;
}
.line--you p {
  color: #07275a;
  font-weight: 500;
}
.metric-badge {
  margin-top: 10px;
  margin-left: auto;
  width: fit-content;
  border-radius: 8px;
  border: 1px solid rgba(78,222,163,0.35);
  background: rgba(78,222,163,0.12);
  color: #6ffbbe;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
}
.empty {
  font-size: 14px;
  color: rgba(194,198,214,0.9);
  text-align: center;
  padding: 22px;
  border: 1px dashed rgba(255,255,255,0.2);
  border-radius: 12px;
  background: rgba(255,255,255,0.02);
}
.footer {
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(19, 27, 46, 0.72);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.footer-note {
  font-size: 12px;
  color: rgba(194,198,214,0.9);
}
.footer-actions {
  display: flex;
  gap: 8px;
}
@keyframes ai-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(78, 222, 163, 0.4); }
  70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(78, 222, 163, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(78, 222, 163, 0); }
}
@media (max-width: 900px) {
  .top { padding-inline: 14px; }
  h1 { font-size: 26px; }
  .searchbar { padding-inline: 14px; }
  .stream { padding-inline: 14px; }
  .line { width: min(88%, 100%); }
  .footer { padding-inline: 14px; }
}
@media (max-width: 520px) {
  .line { width: 100%; padding: 12px 14px; }
  .avatar-col { display: none; }
}
`;
