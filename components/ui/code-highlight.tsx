"use client";

import { Highlight, themes } from "prism-react-renderer";
import { useState } from "react";

interface CodeHighlightProps {
  code: string;
  language: string;
  maxHeight?: string;
}

export function CodeHighlight({
  code,
  language,
  maxHeight = "200px",
}: CodeHighlightProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determine language by file extension if not provided
  const getLanguage = (lang: string) => {
    // Map file extensions to Prism language names
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "tsx",
      js: "javascript",
      jsx: "jsx",
      json: "json",
      css: "css",
      html: "html",
      md: "markdown",
    };

    return langMap[lang] || "typescript"; // Default to typescript
  };

  const displayLanguage = getLanguage(language);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div
        style={{ maxHeight: expanded ? "none" : maxHeight }}
        className="overflow-auto transition-all"
      >
        <Highlight theme={themes.github} code={code} language={displayLanguage}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} p-4 rounded-md text-sm`}
              style={style}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line, key: i })}>
                  <span className="text-gray-400 w-10 inline-block text-right mr-4 select-none">
                    {i + 1}
                  </span>
                  {line.map((token, key) => (
                    <span
                      key={`line-${i}`}
                      {...getTokenProps({ token, key })}
                    />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
      {code.split("\n").length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute bottom-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      )}
      <button
        onClick={copyCode}
        className="absolute top-2 right-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
