import React from 'react'

export default function MultipleChoice({ choices, onChoose, disabled }){
  return (
    <div className="choices">
      {choices.map((c, idx)=>(
        <button key={idx} disabled={disabled} className="ghost" onClick={()=>onChoose(c)}>{c}</button>
      ))}
    </div>
  )
}