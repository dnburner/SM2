import React, { useRef, useState } from 'react'
import { useAdaptiveQuiz } from '../hooks/useAdaptiveQuiz'
import MultipleChoice from '../components/MultipleChoice.jsx'

export default function Quiz(){
  const { state, currentQ, loading, feedback, loadNext, submitAnswer } = useAdaptiveQuiz()
  const inputRef = useRef(null)
  const [typed, setTyped] = useState('')

  return (
    <div>
      <div className="row" style={{gap:8, marginBottom:8}}>
        <span className="pill">Difficulty: {state.target_difficulty}</span>
        <span className="pill">Recent accuracy: {(state.recent_accuracy*100|0)}%</span>
      </div>

      <div className="progress" style={{marginBottom:16}}>
        <div style={{ width: Math.min(100, Math.round(state.recent_accuracy*100))+'%' }} />
      </div>

      <div className="card">
        {loading && <div>Loading next question…</div>}
        {!loading && currentQ && (
          <div>
            <div className="muted" style={{marginBottom:6}}>{currentQ.skill.replaceAll('_',' ')}</div>
            <h2 style={{marginTop:0}}>{currentQ.stem}</h2>

            {currentQ.format === 'multiple_choice' && currentQ.choices ? (
              <MultipleChoice disabled={!!feedback} choices={currentQ.choices} onChoose={submitAnswer} />
            ) : (
              <div className="row" style={{marginTop:10}}>
                <input
                  type="text"
                  value={typed}
                  disabled={!!feedback}
                  placeholder="Type your answer"
                  onChange={e=>setTyped(e.target.value)}
                  ref={inputRef}
                />
                <button className="primary" disabled={!!feedback} onClick={()=>submitAnswer(typed || '')}>Submit</button>
              </div>
            )}

            {feedback && (
              <div style={{marginTop:16}}>
                <div className="explain">
                  <strong>{feedback.correct ? 'Correct!' : 'Not quite.'}</strong>
                  <div style={{marginTop:6}}>{feedback.explanation}</div>
                </div>
                {!feedback.correct && (
                  <div className="row" style={{marginTop:12}}>
                    <button className="primary" onClick={()=>{ setTyped(''); loadNext(); }}>Next question</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{marginTop:16}} className="muted">
        Tip: set <code>OPENAI_API_KEY</code> in Netlify env vars to enable AI-generated questions.
      </div>
    </div>
  )
}