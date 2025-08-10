"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Question, QuestionSet } from "@/lib/types";

export const dynamic = "force-dynamic";

function download(filename: string, data: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(questions: Question[]): string {
  const headers = [
    "id",
    "type",
    "prompt",
    "difficulty",
    "bloom",
    "competencyTags",
    "options",
    "answerExplanation",
  ];
  const rows = questions.map((q) => [
    q.id,
    q.type,
    q.prompt.replace(/\n/g, " "),
    q.difficulty,
    q.bloom,
    q.competencyTags.join(";"),
    q.options ? q.options.map((o) => `${o.text}${o.isCorrect ? "*" : ""}`).join(" | ") : "",
    q.answerExplanation ?? "",
  ]);
  return [headers, ...rows]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function ResultsContent() {
  const params = useSearchParams();
  const id = params.get("id");
  const [setData, setSetData] = useState<QuestionSet | null>(null);

  useEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem(`sqg:set:${id}`);
      if (raw) setSetData(JSON.parse(raw));
    } catch {}
  }, [id]);

  const title = useMemo(() => setData ? new Date(setData.createdAt).toLocaleString() : "", [setData]);

  if (!id) return <p className="text-sm">No result id specified.</p>;
  if (!setData) return <p className="text-sm">Loading...</p>;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Generated Questions</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{title} • {setData.params.totalQuestions} questions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => download(`questions-${id}.json`, JSON.stringify(setData, null, 2), "application/json")}
            className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700"
          >
            Export JSON
          </button>
          <button
            onClick={() => download(`questions-${id}.csv`, toCsv(setData.questions), "text/csv")}
            className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
        <div className="text-sm text-slate-700 dark:text-slate-300">Source: {setData.sourceTextSummary}</div>
      </div>

      <ul className="grid gap-4">
        {setData.questions.map((q) => (
          <li key={q.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">{q.type} • {q.difficulty} • {q.bloom}</div>
                <textarea
                  value={q.prompt}
                  onChange={(e) => {
                    const next: QuestionSet = {
                      ...setData!,
                      questions: setData!.questions.map((x) => x.id === q.id ? { ...x, prompt: e.target.value } : x),
                    };
                    setSetData(next);
                    try { localStorage.setItem(`sqg:set:${id}`, JSON.stringify(next)); } catch {}
                  }}
                  className="mt-2 w-full text-base rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2"
                />
              </div>
            </div>

            {q.options && (
              <div className="mt-3 grid gap-2">
                {q.options.map((opt, idx) => (
                  <label key={opt.id} className={`flex items-start gap-2 rounded-md border p-2 ${opt.isCorrect ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800" : "border-slate-200 dark:border-slate-800"}`}>
                    <span className="text-xs mt-1">{String.fromCharCode(65 + idx)}.</span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        const next: QuestionSet = {
                          ...setData!,
                          questions: setData!.questions.map((x) => x.id === q.id ? {
                            ...x,
                            options: x.options?.map((o) => o.id === opt.id ? { ...o, text: e.target.value } : o)
                          } : x)
                        };
                        setSetData(next);
                        try { localStorage.setItem(`sqg:set:${id}`, JSON.stringify(next)); } catch {}
                      }}
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2"
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="mt-3">
              <label className="block text-sm font-medium">Answer explanation</label>
              <textarea
                value={q.answerExplanation ?? ""}
                onChange={(e) => {
                  const next: QuestionSet = {
                    ...setData!,
                    questions: setData!.questions.map((x) => x.id === q.id ? { ...x, answerExplanation: e.target.value } : x),
                  };
                  setSetData(next);
                  try { localStorage.setItem(`sqg:set:${id}`, JSON.stringify(next)); } catch {}
                }}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading...</p>}>
      <ResultsContent />
    </Suspense>
  );
}