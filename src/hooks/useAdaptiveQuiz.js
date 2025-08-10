import { useEffect, useState } from 'react'
import { initLearningState, updateLearningState, fetchNextQuestion } from '../services/adaptiveEngine'

export function useAdaptiveQuiz(){
  const [state, setState] = useState(()=>{
    const raw = localStorage.getItem('learningState')
    return raw ? JSON.parse(raw) : initLearningState()
  })
  const [currentQ, setCurrentQ] = useState(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  async function loadNext(){
    setLoading(true)
    try{
      const q = await fetchNextQuestion(state)
      setCurrentQ(q)
      setFeedback(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{
    loadNext()
  }, [])

  useEffect(()=>{
    localStorage.setItem('learningState', JSON.stringify(state))
  }, [state])

  async function submitAnswer(ans){
    if (!currentQ) return
    const correct = String(ans).trim() === String(currentQ.correct_answer).trim()
    const nextState = updateLearningState(state, { id: currentQ.id, skill: currentQ.skill, difficulty: currentQ.difficulty, correct })
    setState(nextState)
    setFeedback({ correct, explanation: currentQ.explanation })
    if (correct){
      await new Promise(r=>setTimeout(r, 900))
      await loadNext()
    }
  }

  return { state, currentQ, loading, feedback, loadNext, submitAnswer }
}