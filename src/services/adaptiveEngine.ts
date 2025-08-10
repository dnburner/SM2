
import type { LearningState, GeneratedQuestion } from "../../netlify/functions/generateQuestion";

export type AnswerRecord = {
  id: string;
  skill: string;
  difficulty: number;
  correct: boolean;
};

const START_MASTERY = 0.45;

export function initLearningState(existing?: Partial<LearningState>): LearningState {
  const skills = [
    "counting_within_120",
    "place_value_tens_ones",
    "add_within_20",
    "subtract_within_20",
    "word_problems_add_sub",
    "time_to_half_hour",
    "measurement_length",
    "shapes_attributes",
    "fractions_halves_quarters",
  ] as const;

  const mastery = Object.fromEntries(
    skills.map(s => [s, existing?.mastery?.[s] ?? START_MASTERY])
  ) as LearningState["mastery"];

  return {
    mastery,
    recent_accuracy: existing?.recent_accuracy ?? 0.6,
    target_difficulty: existing?.target_difficulty ?? 4,
    history: existing?.history ?? [],
    focus: existing?.focus ?? []
  };
}

export function updateLearningState(
  state: LearningState,
  answer: AnswerRecord
): LearningState {
  const copy = structuredClone(state);
  const k = 0.18;
  const delta = answer.correct ? +k : -k;
  const cur = copy.mastery[answer.skill as keyof typeof copy.mastery] ?? 0.4;
  copy.mastery[answer.skill as keyof typeof copy.mastery] = clamp01(cur + delta);

  copy.history.push({
    skill: answer.skill as any,
    difficulty: answer.difficulty,
    correct: answer.correct
  });
  if (copy.history.length > 20) copy.history.shift();

  const recent = copy.history.slice(-10);
  const acc = recent.length ? recent.filter(r => r.correct).length / recent.length : 0.6;
  copy.recent_accuracy = acc;

  if (acc >= 0.85) copy.target_difficulty = Math.min(10, copy.target_difficulty + 1);
  if (acc <= 0.55) copy.target_difficulty = Math.max(1, copy.target_difficulty - 1);

  return copy;
}

export async function fetchNextQuestion(state: LearningState): Promise<GeneratedQuestion> {
  const r = await fetch('/.netlify/functions/generateQuestion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ learningState: state })
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
