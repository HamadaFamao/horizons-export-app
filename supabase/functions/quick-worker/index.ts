import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Always return 200 so the Supabase client puts the body in `data` (not `error`)
// The caller checks data?.error to detect failures
const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Parse body ──────────────────────────────────────────────────────────
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body', details: 'Could not parse request body' })
    }

    const topic = String(body.topic ?? '').trim()
    console.log('[quick-worker] Topic:', topic)

    if (!topic) {
      return jsonResponse({ error: 'Missing topic', details: 'topic field is required and must be a non-empty string' })
    }

    // ── 2. API key check ───────────────────────────────────────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      console.error('[quick-worker] ANTHROPIC_API_KEY is not set')
      return jsonResponse({ error: 'Server misconfiguration', details: 'ANTHROPIC_API_KEY secret is missing' })
    }

    // ── 3. Call Anthropic ──────────────────────────────────────────────────────
    console.log('[quick-worker] Calling Anthropic API...')

    let anthropicResponse: Response
    try {
      anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: `Generate exactly 5 multiple choice trivia questions about "${topic}".

Return ONLY valid JSON array. No markdown. No backticks. No explanation. No text before or after the array.

Format:
[
  {
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "A"
  }
]

correct_answer must be exactly one of: A, B, C, D.`,
            },
          ],
        }),
      })
    } catch (fetchErr) {
      console.error('[quick-worker] Network error calling Anthropic:', fetchErr)
      return jsonResponse({ error: 'Network error', details: String(fetchErr) })
    }

    // ── 4. Parse Anthropic response ────────────────────────────────────────────
    const rawText = await anthropicResponse.text()
    console.log('[quick-worker] Anthropic HTTP status:', anthropicResponse.status)
    console.log('[quick-worker] Anthropic raw response:', rawText)

    let anthropicData: Record<string, unknown>
    try {
      anthropicData = JSON.parse(rawText)
    } catch {
      return jsonResponse({
        error: 'Anthropic returned non-JSON',
        details: rawText.slice(0, 500),
      })
    }

    if (!anthropicResponse.ok) {
      const errType = (anthropicData?.error as Record<string, unknown>)?.type ?? ''
      const errMsg  = (anthropicData?.error as Record<string, unknown>)?.message ?? anthropicResponse.statusText

      console.error('[quick-worker] Anthropic error:', errType, errMsg)

      if (anthropicResponse.status === 404 || String(errType).includes('not_found')) {
        return jsonResponse({ error: 'Invalid model', details: `Model not found: ${errMsg}` })
      }
      if (anthropicResponse.status === 401) {
        return jsonResponse({ error: 'Invalid API key', details: String(errMsg) })
      }
      return jsonResponse({
        error: 'Anthropic API error',
        details: String(errMsg),
        status: anthropicResponse.status,
      })
    }

    // ── 5. Extract text content ────────────────────────────────────────────────
    const contentText = (anthropicData?.content as Array<{ type: string; text?: string }>)?.[0]?.text ?? ''
    console.log('[quick-worker] Extracted content text:', contentText.slice(0, 300))

    if (!contentText) {
      return jsonResponse({ error: 'Empty response from Anthropic', details: JSON.stringify(anthropicData) })
    }

    // ── 6. Parse JSON array from text ──────────────────────────────────────────
    const match = contentText.match(/\[[\s\S]*\]/)
    if (!match) {
      return jsonResponse({
        error: 'No JSON array found in AI response',
        details: contentText.slice(0, 500),
      })
    }

    let questions: unknown[]
    try {
      questions = JSON.parse(match[0])
    } catch (parseErr) {
      console.error('[quick-worker] JSON parse error:', parseErr)
      return jsonResponse({
        error: 'Failed to parse AI-generated JSON',
        details: match[0].slice(0, 500),
      })
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return jsonResponse({ error: 'Generated result is not a valid non-empty array', details: String(questions) })
    }

    // ── 7. Normalize & validate fields ────────────────────────────────────────
    const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D'])
    const normalized = questions.map((q: unknown) => {
      const item = q as Record<string, unknown>
      return {
        question_text:  String(item.question_text  ?? ''),
        option_a:       String(item.option_a        ?? ''),
        option_b:       String(item.option_b        ?? ''),
        option_c:       String(item.option_c        ?? ''),
        option_d:       String(item.option_d        ?? ''),
        correct_answer: VALID_ANSWERS.has(String(item.correct_answer).toUpperCase())
          ? String(item.correct_answer).toUpperCase()
          : 'A',
      }
    })

    console.log('[quick-worker] Returning', normalized.length, 'questions successfully')
    return jsonResponse({ questions: normalized })

  } catch (err) {
    console.error('[quick-worker] Unhandled error:', err)
    return jsonResponse({
      error: 'Unexpected server error',
      details: (err as Error)?.message ?? String(err),
    })
  }
})