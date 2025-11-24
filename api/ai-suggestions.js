export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { resume, action } = req.body;

    if (!resume || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let systemPrompt, userPrompt;

    if (action === 'suggestions') {
      systemPrompt = "You are an expert resume coach specializing in tech resumes. Analyze resumes deeply and provide specific, actionable feedback. Reference exact sections, bullet points, and content from the resume. Identify concrete issues and give precise recommendations. IMPORTANT: Return plain strings in arrays, NOT objects.";
      
      userPrompt = `Analyze this resume in detail and provide specific, personalized feedback.

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

    } else if (action === 'rewrite') {
      systemPrompt = "You are an expert resume writer. Rewrite resume bullets to be compelling, concise (max 20-22 words), and impact-focused. Use strong action verbs, quantify achievements, and emphasize results. Use past tense except for current roles.";
      
      userPrompt = `Rewrite ALL bullets in this resume to be more impactful and achievement-oriented.

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
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://your-domain.vercel.app',
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
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return res.status(response.status).json({ 
        error: `OpenRouter API error: ${response.status}` 
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    return res.status(200).json(parsedContent);

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}