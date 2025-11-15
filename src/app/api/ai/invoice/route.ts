import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json();
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY missing' }, { status: 500 });
    }
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const prompt = `You are an assistant that extracts structured invoice data from a short user description. 
Return strict JSON with keys: tenantName, tenantEmail (optional), amount (number), currency (string ISO code), 
dueDate (ISO date), description (string), lineItems (array of {label, quantity, unitPrice}).
If information is missing, infer reasonable defaults and note assumptions in description.
User description: ${description}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: 'You output only valid JSON without markdown fences.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'Groq API error', details: text }, { status: 500 });
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from AI', raw: content }, { status: 500 });
    }
    return NextResponse.json({ invoice: parsed });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}









