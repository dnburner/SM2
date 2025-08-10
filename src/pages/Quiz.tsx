
import React, { useEffect, useState } from "react";
import { useAdaptiveQuiz } from "../hooks/useAdaptiveQuiz";

export default function Quiz() {
  const { currentQ, loading, loadNext, recordAnswer } = useAdaptiveQuiz();
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    loadNext();
  }, []);

  const submitAnswer = async () => {
    if (!currentQ) return;
    const { correct, explanation } = recordAnswer(userAnswer);
    setFeedback(correct ? `✅ Correct! ${explanation}` : `❌ Incorrect. ${explanation}`);
    if (correct) {
      await new Promise(r => setTimeout(r, 1000));
      setFeedback("");
      setUserAnswer("");
      loadNext();
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!currentQ) return <div>No question loaded</div>;

  return (
    <div>
      <h2>{currentQ.stem}</h2>
      {currentQ.format === "multiple_choice" && currentQ.choices && (
        <ul>
          {currentQ.choices.map((c: string, idx: number) => (
            <li key={idx}>
              <button onClick={() => setUserAnswer(c)}>{c}</button>
            </li>
          ))}
        </ul>
      )}
      {currentQ.format !== "multiple_choice" && (
        <input value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} />
      )}
      <button onClick={submitAnswer}>Submit</button>
      {feedback && <p>{feedback}</p>}
    </div>
  );
}
