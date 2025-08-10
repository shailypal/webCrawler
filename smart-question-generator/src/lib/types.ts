export type Difficulty = "easy" | "medium" | "hard";

export type BloomLevel =
  | "remembering"
  | "understanding"
  | "applying"
  | "analyzing"
  | "evaluating"
  | "creating";

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export interface GenerationParams {
  totalQuestions: number;
  difficulty: DifficultyDistribution;
  bloomLevels: BloomLevel[];
  competencies: string[];
}

export interface MultipleChoiceOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export type QuestionType = "mcq" | "openEnded";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  difficulty: Difficulty;
  bloom: BloomLevel;
  competencyTags: string[];
  options?: MultipleChoiceOption[];
  answerExplanation?: string;
}

export interface QuestionSet {
  id: string;
  createdAt: string;
  sourceTextSummary: string;
  params: GenerationParams;
  questions: Question[];
}