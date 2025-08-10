"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BloomLevel, DifficultyDistribution, GenerationParams, QuestionSet } from "@/lib/types";

const BLOOM_LEVELS: BloomLevel[] = [
  "remembering",
  "understanding",
  "applying",
  "analyzing",
  "evaluating",
  "creating",
];

function defaultDifficulty(total: number): DifficultyDistribution {
  const easy = Math.floor(total * 0.4);
  const medium = Math.floor(total * 0.4);
  const hard = Math.max(0, total - easy - medium);
  return { easy, medium, hard };
}

export default function Home() {
  const router = useRouter();
  const [sourceText, setSourceText] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState<DifficultyDistribution>(defaultDifficulty(10));
  const [selectedBloom, setSelectedBloom] = useState<BloomLevel[]>(["remembering", "understanding"]);
  const [competencyInput, setCompetencyInput] = useState("");
  const [competencies, setCompetencies] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDifficulty = useMemo(() => difficulty.easy + difficulty.medium + difficulty.hard, [difficulty]);

  const onUploadFile = useCallback(async (file: File) => {
    const text = await file.text();
    setSourceText((prev) => (prev ? prev + "\n\n" : "") + text);
  }, []);

  const onAddCompetency = useCallback(() => {
    const trimmed = competencyInput.trim();
    if (!trimmed) return;
    if (!competencies.includes(trimmed)) setCompetencies((prev) => [...prev, trimmed]);
    setCompetencyInput("");
  }, [competencyInput, competencies]);

  const onRemoveCompetency = useCallback((tag: string) => {
    setCompetencies((prev) => prev.filter((t) => t !== tag));
  }, []);

  const updateDifficulty = useCallback((key: keyof DifficultyDistribution, val: number) => {
    setDifficulty((prev) => ({ ...prev, [key]: Math.max(0, val) }));
  }, []);

  const toggleBloom = useCallback((level: BloomLevel) => {
    setSelectedBloom((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));
  }, []);

  const onSubmit = useCallback(async () => {
    setError(null);
    if (!sourceText.trim()) {
      setError("Please provide source text.");
      return;
    }
    if (totalDifficulty !== totalQuestions) {
      setError("Difficulty distribution must sum to total questions.");
      return;
    }
    setIsSubmitting(true);
    try {
      const params: GenerationParams = {
        totalQuestions,
        difficulty,
        bloomLevels: selectedBloom,
        competencies,
      };
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, params }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: QuestionSet = await res.json();
      const id = data.id || (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
      const stored = { ...data, id } as QuestionSet;
      try {
        const key = `sqg:set:${id}`;
        localStorage.setItem(key, JSON.stringify(stored));
      } catch {}
      const sp = new URLSearchParams({ id });
      router.push(`/results?${sp.toString()}`);
    } catch (e: unknown) {
      const message = typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Failed to generate questions.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [competencies, difficulty, router, selectedBloom, sourceText, totalDifficulty, totalQuestions]);

  return (
    <div className="grid gap-8">
      <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Source Text</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Paste text or upload a file.</p>
        <div className="mt-4 flex gap-3 items-center">
          <label className="inline-flex items-center px-3 py-2 rounded-md border border-sky-300 text-sky-800 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900 cursor-pointer">
            <input
              type="file"
              accept=".txt,.md,.rtf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadFile(file);
              }}
            />
            Upload file
          </label>
        </div>
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Paste or type your content here..."
          rows={10}
          className="mt-4 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900 grid gap-6">
        <h2 className="text-xl font-semibold">Question Parameters</h2>

        <div className="grid sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium">Total questions</label>
            <input
              type="number"
              min={1}
              value={totalQuestions}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value || 1));
                setTotalQuestions(v);
                setDifficulty(defaultDifficulty(v));
              }}
              className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Bloom&apos;s Taxonomy</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {BLOOM_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleBloom(level)}
                  className={`px-2.5 py-1.5 rounded-md text-sm border ${
                    selectedBloom.includes(level)
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : "bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Competencies</label>
            <div className="mt-1 flex gap-2">
              <input
                value={competencyInput}
                onChange={(e) => setCompetencyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAddCompetency();
                  }
                }}
                placeholder="e.g., critical thinking"
                className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2"
              />
              <button type="button" onClick={onAddCompetency} className="px-3 py-2 rounded-md bg-sky-600 text-white text-sm">Add</button>
            </div>
            {competencies.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {competencies.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800">
                    {tag}
                    <button onClick={() => onRemoveCompetency(tag)} aria-label={`Remove ${tag}`} className="text-sky-700 dark:text-sky-300">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Difficulty distribution</label>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {(["easy", "medium", "hard"] as const).map((key) => (
              <div key={key} className="rounded-md border p-3 border-slate-200 dark:border-slate-800">
                <div className="text-xs uppercase tracking-wide text-slate-500">{key}</div>
                <input
                  type="number"
                  min={0}
                  value={difficulty[key]}
                  onChange={(e) => updateDifficulty(key, Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2"
                />
              </div>
            ))}
          </div>
          <p className={`mt-2 text-xs ${totalDifficulty === totalQuestions ? "text-emerald-600" : "text-rose-600"}`}>
            {totalDifficulty} of {totalQuestions} allocated
          </p>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSubmit}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white"
          >
            {isSubmitting ? "Generating..." : "Generate"}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setSourceText("");
              setTotalQuestions(10);
              setDifficulty(defaultDifficulty(10));
              setSelectedBloom(["remembering", "understanding"]);
              setCompetencies([]);
              setCompetencyInput("");
              setError(null);
            }}
            className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-700"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900">
        <h3 className="font-medium">Tips</h3>
        <ul className="list-disc pl-5 mt-2 text-sm text-slate-600 dark:text-slate-300">
          <li>Provide clear, well-structured source text for best results.</li>
          <li>Match difficulty counts to total questions.</li>
          <li>Use competencies to align questions to outcomes.</li>
        </ul>
      </section>
    </div>
  );
}
