
import { useEffect, useState } from "react";
import { initLearningState, updateLearningState, fetchNextQuestion } from "../services/adaptiveEngine";
import type { LearningState } from "../../netlify/functions/generateQuestion";

export function useAdaptiveQuiz() {
  const [state, setState] = useState<LearningState>(() => {
    const raw = localStorage.getItem('learningState');
    return raw ? JSON.parse(raw) : initLearningState();
  });
  const [currentQ, setCurrentQ] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function loadNext() {
    setLoading(true);
    try {
      const q = await fetchNextQuestion(state);
      setCurrentQ(q);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.setItem('learningState', JSON.stringify(state));
  }, [state]);

  function recordAnswer(answer: string) {
    if (!currentQ) return;
    const correct = String(answer).trim() === String(currentQ.correct_answer).trim();
    const nextState = updateLearningState(state, {
      id: currentQ.id,
      skill: currentQ.skill,
      difficulty: currentQ.difficulty,
      correct
    });
    setState(nextState);
    return { correct, explanation: currentQ.explanation };
  }

  return { state, currentQ, loading, loadNext, recordAnswer };
}
