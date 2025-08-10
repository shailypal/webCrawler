import { NextRequest, NextResponse } from "next/server";
import { type BloomLevel, type Difficulty, type GenerationParams, type MultipleChoiceOption, type Question, type QuestionSet } from "@/lib/types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function summarizeText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 240) return trimmed;
  return trimmed.slice(0, 237) + "...";
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomId(): string {
  return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
}

function naiveSentenceSplit(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function chooseBloomLevel(requested: BloomLevel[]): BloomLevel {
  if (requested.length > 0) return pickOne(requested);
  return pickOne(["remembering", "understanding", "applying", "analyzing", "evaluating", "creating"]);
}

function chooseDifficulty(distribution: GenerationParams["difficulty"]): Difficulty {
  const pool: Difficulty[] = [];
  for (let i = 0; i < distribution.easy; i++) pool.push("easy");
  for (let i = 0; i < distribution.medium; i++) pool.push("medium");
  for (let i = 0; i < distribution.hard; i++) pool.push("hard");
  if (pool.length === 0) return pickOne(["easy", "medium", "hard"]);
  return pickOne(pool);
}

function fabricateDistractors(correct: string, count: number): string[] {
  const base = correct.replace(/\b(is|are|was|were|has|have|had)\b/gi, "").trim();
  const variants = [
    base + " not",
    base.replace(/\b(\w{4,})\b/, "$1 in reverse"),
    "None of the above",
    "All of the above",
    base + " in another context",
  ];
  const result: string[] = [];
  for (let i = 0; i < variants.length && result.length < count; i++) {
    if (variants[i] && variants[i].toLowerCase() !== correct.toLowerCase()) result.push(variants[i]);
  }
  while (result.length < count) result.push(base + "?");
  return result.slice(0, count);
}

function localFallbackGenerator(text: string, params: GenerationParams): QuestionSet {
  const sentences = naiveSentenceSplit(text);
  const allCompetencies = params.competencies.length ? params.competencies : ["general"].concat([]);

  const questions: Question[] = [];
  const total = Math.max(1, params.totalQuestions);
  for (let i = 0; i < total; i++) {
    const source = sentences[i % Math.max(1, sentences.length)] || text.slice(0, 140);
    const difficulty = chooseDifficulty(params.difficulty);
    const bloom = chooseBloomLevel(params.bloomLevels);
    const competencyTags = [pickOne(allCompetencies)];
    const isMcq = i % 2 === 0;

    if (isMcq) {
      const correct = source
        .replace(/^[\-\d\s•]+/, "")
        .replace(/\s+/g, " ")
        .trim();
      const distractors = fabricateDistractors(correct, 3);
      const options: MultipleChoiceOption[] = [
        { id: randomId(), text: correct, isCorrect: true },
        ...distractors.map((d) => ({ id: randomId(), text: d, isCorrect: false })),
      ].sort(() => Math.random() - 0.5);
      questions.push({
        id: randomId(),
        type: "mcq",
        prompt: `Based on the material, which option best completes or reflects: "${correct}"?`,
        difficulty,
        bloom,
        competencyTags,
        options,
        answerExplanation: "The correct option directly reflects the statement drawn from the source text.",
      });
    } else {
      questions.push({
        id: randomId(),
        type: "openEnded",
        prompt: `Explain in your own words: ${source}`,
        difficulty,
        bloom,
        competencyTags,
        answerExplanation: "Responses should capture the essence of the statement and demonstrate understanding.",
      });
    }
  }

  return {
    id: randomId(),
    createdAt: new Date().toISOString(),
    sourceTextSummary: summarizeText(text),
    params,
    questions,
  } satisfies QuestionSet;
}

async function callOpenAI(text: string, params: GenerationParams): Promise<QuestionSet> {
  const system = `You are an expert educational content generator. Create a balanced set of multiple-choice and open-ended questions aligned to Bloom\'s Taxonomy and the requested difficulty distribution. Provide JSON only.`;
  const user = {
    text,
    params,
    responseSchema: {
      id: "string",
      createdAt: "ISO string",
      sourceTextSummary: "string",
      params: "echo input",
      questions: [
        {
          id: "string",
          type: "mcq|openEnded",
          prompt: "string",
          difficulty: "easy|medium|hard",
          bloom: "remembering|understanding|applying|analyzing|evaluating|creating",
          competencyTags: ["string"],
          options: [{ id: "string", text: "string", isCorrect: "boolean" }],
          answerExplanation: "string"
        }
      ]
    }
  };

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const url = "https://api.openai.com/v1/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Generate questions as strict JSON.\nInput: ${JSON.stringify(user)}` },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content as string;

  const firstJsonMatch = content.match(/\{[\s\S]*\}$/);
  const jsonString = firstJsonMatch ? firstJsonMatch[0] : content;
  const parsed = JSON.parse(jsonString);

  const now = new Date().toISOString();
  const withMeta: QuestionSet = {
    id: parsed.id || randomId(),
    createdAt: parsed.createdAt || now,
    sourceTextSummary: parsed.sourceTextSummary || summarizeText(text),
    params,
    questions: parsed.questions,
  };
  return withMeta;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body?.text ?? "";
    const params: GenerationParams = body?.params;
    if (!text || !params) return NextResponse.json({ error: "Missing text or params" }, { status: 400 });

    if (OPENAI_API_KEY) {
      try {
        const ai = await callOpenAI(text, params);
        return NextResponse.json(ai);
      } catch {
        const fallback = localFallbackGenerator(text, params);
        return NextResponse.json(fallback, { status: 200, headers: { "X-Generator": "local-fallback" } });
      }
    }

    const fallback = localFallbackGenerator(text, params);
    return NextResponse.json(fallback, { status: 200, headers: { "X-Generator": "local-fallback" } });
  } catch (e: unknown) {
    const message = typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}