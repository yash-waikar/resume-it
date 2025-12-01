const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_KEY = process.env.REACT_APP_OPENROUTER_API_KEY; 

async function callOpenRouterDirect(systemPrompt, userPrompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Resume Editor'
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(content);
}

export async function getResumeSuggestions(resume) {
  try {
    let json;

    if (isDevelopment && API_KEY) {
    
      const systemPrompt = "You are an expert resume coach specializing in tech resumes. Analyze resumes deeply and provide specific, actionable feedback. Reference exact sections, bullet points, and content from the resume. Identify concrete issues and give precise recommendations. IMPORTANT: Return plain strings in arrays, NOT objects.";
      const userPrompt = `Analyze this resume in detail and provide specific, personalized feedback.

Resume Data:
${JSON.stringify(resume, null, 2)}

Provide a thorough analysis with:
1. SPECIFIC suggestions that reference actual content in this resume
2. CONCRETE risks or weaknesses found in this specific resume
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
  "suggestions": ["suggestion 1", "suggestion 2"],
  "risks": ["risk 1", "risk 2"],
  "summary": "Overall summary"
}`;

      json = await callOpenRouterDirect(systemPrompt, userPrompt);
    } else {
      // Production: Call secure serverless function
      console.log('Production mode: Calling serverless API');
      const response = await fetch('/api/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume,
          action: 'suggestions'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get suggestions');
      }

      json = await response.json();
    }
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
    
    return { suggestions, risks, summary }
  } catch (e) {
    console.error('Error getting suggestions:', e);
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

export async function rewriteAllBullets(resume) {
  try {
    let json;

    if (isDevelopment && API_KEY) {
      const systemPrompt = "You are an expert resume writer. Rewrite resume bullets to be compelling, concise (max 20-22 words), and impact-focused. Use strong action verbs, quantify achievements, and emphasize results. Use past tense except for current roles.";
      const userPrompt = `Rewrite ALL bullets in this resume to be more impactful and achievement-oriented.

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
{ sections: [{ id: string, items: [{ index: number, bullets: string[] }] }] }`;

      json = await callOpenRouterDirect(systemPrompt, userPrompt);
    } else {
      // Production: Call secure serverless function
      console.log('Production mode: Calling serverless API for rewrite');
      const response = await fetch('/api/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume,
          action: 'rewrite'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rewrite bullets');
      }

      json = await response.json();
    }
    const map = json?.sections;
    
    if (!Array.isArray(map)) {
      return { resume: structuredClone(resume), changed: 0 };
    }

    const copy = structuredClone(resume);
    let changed = 0;
    
    for (const section of map) {
      const target = copy.sections.find((s) => s.id === section.id);
      if (!target) continue;
      
      for (const item of section.items ?? []) {
        if (
          typeof item.index === "number" &&
          Array.isArray(item.bullets) &&
          target.items[item.index]
        ) {
          target.items[item.index].bullets = item.bullets;
          changed += 1;
        }
      }
    }
    
    return { resume: copy, changed };
  } catch (e) {
    console.error('Error rewriting bullets:', e);
    return { resume: structuredClone(resume), changed: 0, error: e.message };
  }
}
