function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function callGeminiJSON({ apiKey, model = "gemini-1.5-flash", system, user, responseSchema, maxRetries = 3 }) {
  if (!apiKey) throw new Error("Missing Gemini API key")

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  let attempt = 0
  while (true) {
    attempt += 1
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { role: "system", parts: [{ text: system }] } : undefined,
        contents: [
          {
            role: "user",
            parts: [{ text: user }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: "application/json",
          response_schema: responseSchema ? responseSchema : undefined,
        },
      }),
    })

    if (!res.ok) {
      const shouldRetry = [429, 500, 502, 503, 504].includes(res.status)
      const text = await res.text()
      if (shouldRetry && attempt < maxRetries) {
        await sleep(400 * attempt)
        continue
      }
      throw new Error(`Gemini error: ${res.status} ${text}`)
    }

    const data = await res.json()
    if (data?.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`)
    }
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
    try {
      return JSON.parse(content)
    } catch (e) {
      throw new Error("Failed to parse AI response as JSON (Gemini)")
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
        "You are a resume expert. Return concise, actionable suggestions in JSON. Use US tech resume style. Keep bullets impact-focused and quantified.",
      user: `Analyze the following resume JSON and provide concise advice.\n\nResume JSON:\n${JSON.stringify(
        resume
      )}\n\nReturn ONLY valid JSON.`,
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
    const suggestions = Array.isArray(json.suggestions) ? json.suggestions : []
    const risks = Array.isArray(json.risks) ? json.risks : []
    const summary = typeof json.summary === "string" ? json.summary : ""
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
        "You rewrite resume bullets to be concise (max ~22 words), action-led, quantified, past tense (except current role). Return only JSON mapping.",
      user:
        `Rewrite bullets for this resume. Keep technical nouns and capitalization. Input JSON:\n${JSON.stringify(
          resume
        )}\nReturn JSON: { sections: [{ id: string, items: [{ index: number, bullets: string[] }] }] }`,
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