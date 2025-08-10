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
];

const START_MASTERY = 0.45;

export function initLearningState(existing = {}){
  const mastery = {};
  SKILLS.forEach(s => {
    mastery[s] = (existing.mastery && typeof existing.mastery[s] === 'number')
      ? existing.mastery[s] : START_MASTERY;
  });
  return {
    mastery,
    recent_accuracy: typeof existing.recent_accuracy === 'number' ? existing.recent_accuracy : 0.6,
    target_difficulty: typeof existing.target_difficulty === 'number' ? existing.target_difficulty : 4,
    history: Array.isArray(existing.history) ? existing.history : [],
    focus: Array.isArray(existing.focus) ? existing.focus : []
  }
}

export function updateLearningState(state, answer){
  const copy = JSON.parse(JSON.stringify(state));
  const k = 0.18;
  const delta = answer.correct ? k : -k;
  const cur = copy.mastery[answer.skill] ?? 0.4;
  copy.mastery[answer.skill] = clamp01(cur + delta);

  copy.history.push({ skill: answer.skill, difficulty: answer.difficulty, correct: answer.correct });
  if (copy.history.length > 20) copy.history.shift();

  const recent = copy.history.slice(-10);
  const acc = recent.length ? recent.filter(r => r.correct).length / recent.length : 0.6;
  copy.recent_accuracy = acc;

  if (acc >= 0.85) copy.target_difficulty = Math.min(10, copy.target_difficulty + 1);
  if (acc <= 0.55) copy.target_difficulty = Math.max(1, copy.target_difficulty - 1);

  return copy;
}

export async function fetchNextQuestion(state){
  const r = await fetch('/.netlify/functions/generateQuestion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ learningState: state })
  });
  if (!r.ok){
    // As a fail-safe, produce a local item so the app still runs
    const fallback = await r.text().catch(()=>'');
    console.warn('Function error; using local fallback', fallback);
    return localFallbackItem(state);
  }
  return r.json();
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function localFallbackItem(state){
  const skill = Object.entries(state.mastery).sort((a,b)=>a[1]-b[1])[0][0];
  return {
    id: 'local_'+Math.random().toString(36).slice(2,8),
    grade: 1,
    skill,
    difficulty: state.target_difficulty,
    format: 'numeric',
    stem: 'What is 8 + 6?',
    correct_answer: '14',
    explanation: 'Add 8 and 6 to make 14.'
  };
}