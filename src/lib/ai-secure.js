export async function getResumeSuggestions(resume, apiKey) {
  try {
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

    const json = await response.json();
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

export async function rewriteAllBullets(resume, apiKey) {
  try {
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

    const json = await response.json();
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
