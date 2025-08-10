
import type { Handler } from '@netlify/functions';
import fetch from 'node-fetch';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

const SKILLS = [
  "counting_within_120",
  "place_value_tens_ones",
  "add_within_20",
  "subtract_within_20",
  "word_problems_add_sub",
  "time_to_half_hour",
  "measurement_length",
  "shapes_attributes",
  "fractions_halves_quarters"
] as const;

type Skill = typeof SKILLS[number];

export type LearningState = {
  mastery: Record<Skill, number>;
  recent_accuracy: number;
  target_difficulty: number;
  history: Array<{ skill: Skill; difficulty: number; correct: boolean }>;
  focus?: Skill[];
};

export type GeneratedQuestion = {
  id: string;
  grade: number;
  skill: Skill;
  difficulty: number;
  format: "multiple_choice" | "numeric" | "free_response";
  stem: string;
  choices?: string[];
  correct_answer: string;
  explanation: string;
};

const model = "gpt-4o-mini";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Use POST" };
    }

    const { learningState }: { learningState: LearningState } = JSON.parse(event.body || "{}");

    const safeState: LearningState = {
      mastery: learningState?.mastery ?? {} as any,
      recent_accuracy: Math.min(Math.max(learningState?.recent_accuracy ?? 0.6, 0), 1),
      target_difficulty: Math.min(Math.max(learningState?.target_difficulty ?? 4, 1), 10),
      history: Array.isArray(learningState?.history) ? learningState!.history.slice(-10) : [],
      focus: learningState?.focus?.filter((s: any) => SKILLS.includes(s)) as any
    };

    const ranked = SKILLS
      .map(s => ({ s, m: safeState.mastery[s] ?? 0.4 }))
      .sort((a, b) => a.m - b.m);
    const candidateSkills = safeState.focus && safeState.focus.length
      ? safeState.focus
      : ranked.slice(0, 3).map(r => r.s);
    const targetSkill = candidateSkills[Math.floor(Math.random() * candidateSkills.length)];

    let d = safeState.target_difficulty;
    if (safeState.recent_accuracy >= 0.85) d = Math.min(d + 1, 10);
    if (safeState.recent_accuracy <= 0.55) d = Math.max(d - 1, 1);

    const system = `
You are a Grade 1 math item writer. Generate a single question that:
- Targets the requested skill and difficulty ladder (1=very easy, 10=challenging for Grade 1).
- Uses US Grade 1 standards (first-grade appropriate language and numbers).
- Is solvable mentally or with minimal scratch work.
- Includes a concise, child-friendly explanation.
- If format is multiple_choice, include 4 choices with 1 correct and 3 plausible distractors.
- Avoid negative numbers and avoid multi-step arithmetic with regrouping.
- Use everyday contexts (apples, pencils, coins, classroom, pets, etc.).
`;

    const jsonSchema = {
      name: "GeneratedQuestion",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          grade: { type: "number", const: 1 },
          skill: { type: "string", enum: SKILLS },
          difficulty: { type: "number", minimum: 1, maximum: 10 },
          format: { type: "string", enum: ["multiple_choice", "numeric", "free_response"] },
          stem: { type: "string" },
          choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correct_answer: { type: "string" },
          explanation: { type: "string" }
        },
        required: ["id","grade","skill","difficulty","format","stem","correct_answer","explanation"]
      },
      strict: true
    };

    const input = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
`Generate ONE question now.

Target skill: ${targetSkill}
Target difficulty (1–10): ${d}

Student state (compact):
- mastery: ${JSON.stringify(safeState.mastery)}
- recent_accuracy: ${safeState.recent_accuracy}
- last_items: ${safeState.history.map(h => `${h.skill}@${h.difficulty}:${h.correct ? '✓' : '✗'}`).join(', ')}

Rules:
- Prefer multiple_choice for word problems; numeric for number facts.
- For difficulty <=3, numbers should be mostly <=20; for 4–6, may go to ~50; for 7–8, limited up to ~120 (no regrouping); for 9–10, multi-step reasoning within Grade 1 scope (no regrouping).
- Keep explanation short and friendly (1–3 sentences).`
          }
        ]
      }
    ];

    const resp = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input,
        system,
        response_format: {
          type: "json_schema",
          json_schema: jsonSchema
        }
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { statusCode: 500, body: JSON.stringify({ error: err }) };
    }

    const data = await resp.json();
    const textPayload = data?.output?.[0]?.content?.[0]?.text ?? data?.text ?? "";

    let parsed: GeneratedQuestion;
    try {
      parsed = JSON.parse(textPayload);
    } catch {
      parsed = {
        id: cryptoRandomId(),
        grade: 1,
        skill: targetSkill,
        difficulty: d,
        format: "free_response",
        stem: "Count to 20 by ones. What number comes after 19?",
        correct_answer: "20",
        explanation: "When you count by ones, 19 is followed by 20."
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(parsed)
    };

  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || "Unknown error" }) };
  }
};

function cryptoRandomId() {
  return 'q_' + Math.random().toString(36).slice(2, 10);
}
