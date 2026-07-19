import type { Monaco } from "@monaco-editor/react";

export const VETTA_MONACO_THEME = "vetta-dark";

let themeReady = false;

export function defineVettaMonacoTheme(monaco: Monaco): void {
  if (themeReady) return;
  monaco.editor.defineTheme(VETTA_MONACO_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a7388", fontStyle: "italic" },
      { token: "keyword", foreground: "adc6ff" },
      { token: "string", foreground: "4edea3" },
      { token: "number", foreground: "e8a941" },
      { token: "type", foreground: "4fdbc8" },
      { token: "function", foreground: "d8e2ff" },
      { token: "delimiter", foreground: "8c909f" },
    ],
    colors: {
      "editor.background": "#060e20",
      "editor.foreground": "#dae2fd",
      "editorLineNumber.foreground": "#424754",
      "editorLineNumber.activeForeground": "#adc6ff",
      "editor.lineHighlightBackground": "#131b2e88",
      "editor.selectionBackground": "#4d8eff55",
      "editor.inactiveSelectionBackground": "#4d8eff28",
      "editorCursor.foreground": "#adc6ff",
      "editorIndentGuide.background": "#222a3d",
      "editorIndentGuide.activeBackground": "#424754",
      "editorGutter.background": "#060e20",
      "scrollbarSlider.background": "#42475466",
      "scrollbarSlider.hoverBackground": "#424754aa",
      "scrollbarSlider.activeBackground": "#adc6ff44",
    },
  });
  themeReady = true;
}
