import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const topic = String(body.topic || '').trim()

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Missing topic' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1200,
        messages: [
          {
            role: 'user',
            content: `Generate exactly 5 multiple choice trivia questions about "${topic}".

Return ONLY valid JSON. No markdown. No backticks. No explanation.

The JSON must be an array like this:
[
  {
    "question_text": "Question text",
    "option_a": "Answer A",
    "option_b": "Answer B",
    "option_c": "Answer C",
    "option_d": "Answer D",
    "correct_answer": "A"
  }
]

correct_answer must be exactly one of: A, B, C, D.`,
          },
        ],
      }),
    })

    const anthropicData = await anthropicResponse.json().catch(async () => ({
      raw: await anthropicResponse.text(),
    }))

    if (!anthropicResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'Anthropic request failed',
          status: anthropicResponse.status,
          details: anthropicData,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const text = anthropicData?.content?.[0]?.text || ''
    const match = text.match(/\[[\s\S]*\]/)

    if (!match) {
      return new Response(
        JSON.stringify({
          error: 'No JSON array found in Anthropic response',
          raw: text,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    let questions
    try {
      questions = JSON.parse(match[0])
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to parse generated JSON',
          raw: match[0],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'Generated questions is not a valid array' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ questions }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err?.message || 'Unknown Edge Function error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})