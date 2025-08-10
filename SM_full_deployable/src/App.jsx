import React from 'react'
import Quiz from './pages/Quiz.jsx'

export default function App(){
  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between', marginBottom:16}}>
        <div>
          <div className="badge">SM</div>
          <strong>Adaptive Math Quiz — Grade 1</strong>
        </div>
        <a href="https://github.com/dnburner/SM" target="_blank" className="muted">Repo</a>
      </div>
      <Quiz />
    </div>
  )
}