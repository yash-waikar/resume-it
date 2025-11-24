function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function callGeminiJSON({ apiKey, model = "openai/gpt-oss-20b:free", system, user, responseSchema, maxRetries = 3 }) {
  if (!apiKey) throw new Error("Missing OpenRouter API key")

  const url = "https://openrouter.ai/api/v1/chat/completions"
  let attempt = 0
  while (true) {
    attempt += 1
    
    const messages = []
    if (system) {
      messages.push({ role: "system", content: system })
    }
    messages.push({ role: "user", content: user })
    
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "Resume Editor"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    })

    if (!res.ok) {
      const shouldRetry = [429, 500, 502, 503, 504].includes(res.status)
      const text = await res.text()
      if (shouldRetry && attempt < maxRetries) {
        await sleep(400 * attempt)
        continue
      }
      throw new Error(`OpenRouter error: ${res.status} ${text}`)
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? "{}"
    try {
      return JSON.parse(content)
    } catch (e) {
      throw new Error("Failed to parse AI response as JSON (OpenRouter)")
    }
  }
}


async function callAIJSON({ apiKey, system, user, responseSchema }) {
  return callGeminiJSON({ apiKey, system, user, responseSchema })
}

export async function getResumeSuggestions(resume, apiKey) {
  try {
    const json = await callAIJSON({
      apiKey,
      system:
        "You are an expert resume coach specializing in tech resumes. Analyze resumes deeply and provide specific, actionable feedback. Reference exact sections, bullet points, and content from the resume. Identify concrete issues and give precise recommendations. IMPORTANT: Return plain strings in arrays, NOT objects.",
      user: `Analyze this resume in detail and provide specific, personalized feedback.

Resume Data:
${JSON.stringify(resume, null, 2)}

Provide a thorough analysis with:
1. SPECIFIC suggestions that reference actual content in this resume (e.g., "In your Experience section at Company X, the second bullet...")
2. CONCRETE risks or weaknesses found in this specific resume (e.g., "Your Projects section lacks quantifiable metrics...")
3. A personalized summary that addresses this candidate's unique profile

Focus on:
- Missing or weak quantifiable achievements (numbers, percentages, scale)
- Vague language or passive voice in specific bullets
- Inconsistent formatting or date ranges
- Missing technical skills that should be highlighted
- Bullet points that are too long (>1-2 lines) or too short
- Action verbs that could be stronger
- Content that doesn't demonstrate impact

CRITICAL: Return JSON in EXACTLY this format (with plain strings, not objects):
{
  "suggestions": [
    "First specific suggestion as a plain string",
    "Second specific suggestion as a plain string"
  ],
  "risks": [
    "First specific risk as a plain string",
    "Second specific risk as a plain string"
  ],
  "summary": "Overall summary as a plain string"
}

DO NOT use objects inside arrays. Each suggestion and risk MUST be a plain text string.`,
      responseSchema: {
        type: "object",
        properties: {
          suggestions: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        },
        required: ["suggestions", "risks", "summary"],
      },
    })
    const suggestions = Array.isArray(json.suggestions) 
      ? json.suggestions.map(s => {
          if (typeof s === 'string') return s;
          if (typeof s === 'object' && s !== null) {
            return s.text || s.suggestion || s.content || s.description || JSON.stringify(s);
          }
          return String(s);
        }).filter(s => s && s.trim())
      : []
    
    const risks = Array.isArray(json.risks) 
      ? json.risks.map(r => {
          if (typeof r === 'string') return r;
          if (typeof r === 'object' && r !== null) {
           
            return r.text || r.risk || r.content || r.description || JSON.stringify(r);
          }
          return String(r);
        }).filter(r => r && r.trim())
      : []
    
    const summary = typeof json.summary === "string" ? json.summary : (json.summary?.text || "")
    
    console.log("Normalized suggestions:", suggestions);
    console.log("Normalized risks:", risks);
    
    return { suggestions, risks, summary }
  } catch (e) {
    return {
      suggestions: [
        "Ensure each bullet starts with an action verb and ends with measurable impact (numbers, %, time).",
        "Keep bullets to one line; trim filler words (successfully, responsible for, helped).",
        "Group tools and tech into 'Technical Skills' to save space.",
      ],
      risks: [],
      summary: "Basic heuristics provided because AI was unavailable.",
      error: e.message,
    }
  }
}

export async function rewriteAllBullets(resume, apiKey) {
  try {
    const json = await callAIJSON({
      apiKey,
      system:
        "You are an expert resume writer. Rewrite resume bullets to be compelling, concise (max 20-22 words), and impact-focused. Use strong action verbs, quantify achievements, and emphasize results. Use past tense except for current roles.",
      user:
        `Rewrite ALL bullets in this resume to be more impactful and achievement-oriented.

Resume to improve:
${JSON.stringify(resume, null, 2)}

Guidelines for rewriting:
- Start with strong action verbs (Led, Developed, Implemented, Architected, Optimized, etc.)
- Add or enhance quantifiable metrics where possible (%, $, time saved, scale)
- Show IMPACT and RESULTS, not just responsibilities
- Keep technical terms, product names, and company names exact
- Keep each bullet to 1-2 lines maximum (~20-22 words)
- Remove filler words: "responsible for", "helped to", "worked on", "successfully"
- Use past tense for previous roles, present tense for current role
- Maintain professional tone

Return a JSON mapping of the rewritten bullets. Format:
{ sections: [{ id: string, items: [{ index: number, bullets: string[] }] }] }`,
    })

    const map = json?.sections
    if (!Array.isArray(map)) return { resume: structuredClone(resume), changed: 0 }

    const copy = structuredClone(resume)
    let changed = 0
    for (const section of map) {
      const target = copy.sections.find((s) => s.id === section.id)
      if (!target) continue
      for (const item of section.items ?? []) {
        if (
          typeof item.index === "number" &&
          Array.isArray(item.bullets) &&
          target.items[item.index]
        ) {
          target.items[item.index].bullets = item.bullets
          changed += 1
        }
      }
    }
    return { resume: copy, changed }
  } catch (e) {
    return { resume: structuredClone(resume), changed: 0, error: e.message }
  }
}