
// netlify/functions/generateQuestion.js
export async function handler(event){
  if (event.httpMethod !== 'POST'){
    return { statusCode: 405, body: 'Use POST' }
  }

  try{
    const { learningState } = JSON.parse(event.body || '{}') || {}
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    const hasKey = !!OPENAI_API_KEY

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
    ]

    // choose target skill (weakest or focus list)
    const mastery = (learningState && learningState.mastery) || Object.fromEntries(SKILLS.map(s=>[s,0.45]))
    const ranked = SKILLS.map(s=>({ s, m: mastery[s] ?? 0.4 })).sort((a,b)=>a.m - b.m)
    const targetSkill = (learningState && Array.isArray(learningState.focus) && learningState.focus[0]) || ranked[0].s

    let d = Math.max(1, Math.min(10, (learningState && learningState.target_difficulty) || 4))
    const acc = Math.max(0, Math.min(1, (learningState && learningState.recent_accuracy) || 0.6))
    if (acc >= 0.85) d = Math.min(10, d + 1)
    if (acc <= 0.55) d = Math.max(1, d - 1)

    if (!hasKey){
      // fallback when no API key present
      const dummy = fallbackItem(targetSkill, d)
      return { statusCode: 200, body: JSON.stringify(dummy) }
    }

    const system = `You are a Grade 1 math item writer. Generate ONE question as strict JSON only, with keys:
id (string), grade (1), skill, difficulty (1-10), format ("multiple_choice"|"numeric"|"free_response"),
stem (string), choices (array of 4 strings if multiple_choice), correct_answer (string), explanation (string).
Rules: US Grade 1 standards, no negative numbers, no regrouping, friendly explanation 1-3 sentences.
If multiple_choice, include 3 plausible distractors.`

    const user = `Target skill: ${targetSkill}
Target difficulty (1–10): ${d}
Student mastery: ${JSON.stringify(mastery)}
Recent accuracy: ${acc}
Last items: ${(learningState && Array.isArray(learningState.history) ? learningState.history.slice(-8).map(h=>h.skill+'@'+h.difficulty+':' + (h.correct?'T':'F')).join(', ') : '')}

Number ranges:
- <=3: mostly numbers <=20
- 4–6: may include up to ~50
- 7–8: up to ~120 (still Grade 1 friendly)
- 9–10: multi-step reasoning in Grade 1 scope (still no regrouping).`

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    if (!resp.ok){
      const err = await resp.text()
      return { statusCode: 500, body: JSON.stringify({ error: err }) }
    }

    const data = await resp.json()
    let text = data?.choices?.[0]?.message?.content || ""
    // ensure text is valid JSON
    let json
    try{
      json = JSON.parse(text)
    } catch(e){
      // try to extract JSON body if model added prose
      const start = text.indexOf("{")
      const end = text.lastIndexOf("}")
      if (start >= 0 && end > start){
        try{ json = JSON.parse(text.slice(start, end+1)) } catch{}
      }
    }
    if (!json || !json.id){
      json = fallbackItem(targetSkill, d)
    }
    // final sanitization
    json.grade = 1
    json.skill = json.skill || targetSkill
    json.difficulty = Math.max(1, Math.min(10, Number(json.difficulty)||d))
    json.format = json.format || (json.choices ? "multiple_choice" : "numeric")
    json.correct_answer = String(json.correct_answer ?? "")
    json.explanation = String(json.explanation ?? "")

    return { statusCode: 200, body: JSON.stringify(json) }
  } catch (e){
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) }
  }
}

function fallbackItem(skill, d){
  // simple templated items per skill as a backup
  const id = 'q_' + Math.random().toString(36).slice(2,10)
  if (skill === 'add_within_20'){
    return { id, grade:1, skill, difficulty:d, format:'multiple_choice',
      stem:'Lila has 9 stickers. She gets 7 more. How many stickers now?',
      choices:['15','16','17','18'],
      correct_answer:'16',
      explanation:'9 + 7 = 16. You can make 10 by adding 1 to 9, then 6 more => 16.'
    }
  }
  if (skill === 'subtract_within_20'){
    return { id, grade:1, skill, difficulty:d, format:'numeric',
      stem:'What is 14 − 6?',
      correct_answer:'8',
      explanation:'Take away 6 from 14 to get 8.'
    }
  }
  if (skill === 'place_value_tens_ones'){
    return { id, grade:1, skill, difficulty:d, format:'multiple_choice',
      stem:'Which shows the number 34?',
      choices:['3 tens and 4 ones','4 tens and 3 ones','30 ones and 4 tens','34 tens'],
      correct_answer:'3 tens and 4 ones',
      explanation:'34 has 3 tens (30) and 4 ones.'
    }
  }
  return { id, grade:1, skill, difficulty:d, format:'numeric',
    stem:'What number comes after 19?',
    correct_answer:'20',
    explanation:'Counting by ones: 19, then 20.'
  }
}
