export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { message, history, currentSchedule } = req.body || {};
  if (!message) return res.status(400).json({ error: 'missing message' });

  const SYSTEM = `You are a schedule assistant for Evelyn's summer learning tracker (she's 7, rising 2nd grader).
You help Lisa-Anne (LA) make changes to Evelyn's daily task schedule.

TASK TYPES (use exactly these keys):
- piano     🎹 Piano practice (35 min) — Mon/Thu/Sat
- coding    💻 Coding (45 min) — Tue/Thu
- math      📚 IXL / Math (30 min) — Mon/Tue/Fri/Sat
- violin    🎻 Violin via Trala (20 min) — Wed only, 1x/week
- reading   📕 English Fiction (25 min) — daily
- chinese   📖 Chinese Reading (25 min) — daily
- nonfiction 📰 Nonfiction (20 min) — Wed/Fri/Sat

DATE FORMAT: "Jun 22", "Jul 4" (always month abbrev + day, no year)

SUMMER: Jun 15 – Jul 29, 2026

DEFAULT WEEKLY PATTERN:
Mon: piano, math, reading, chinese
Tue: lesson (piano lesson), coding, math, reading, chinese
Wed: violin, reading, chinese, nonfiction
Thu: piano, coding, reading, chinese
Fri: math, reading, chinese, nonfiction
Sat: piano, math, reading, chinese, nonfiction
Sun: makeup day

OVERRIDE FIELDS you can set per date:
- tasks: string[] — full replacement task list for that day
- lesson: boolean — show "piano lesson" pill
- camp: "swim" | "tennis" | null
- campTime: "9–12p" | "all day" | etc.
- free: boolean — makes it a free day (no tasks)
- makeup: boolean — makes it a makeup/catch-up day

RULES:
- Avoid duplicate tasks when moving between days
- "reading" and "chinese" should stay on most days
- Only change dates that were asked about — leave others as-is
- When making a day camp/light, reduce tasks to just reading or reading+chinese
- If moving tasks from day A to day B, remove from A and add to B (deduped)

ALWAYS respond with valid JSON (no markdown, no code blocks, raw JSON only):
{
  "reply": "Warm 1–2 sentence confirmation of what changed.",
  "overrides": {
    "Jun 22": { "tasks": ["piano","coding","math","reading","chinese"] },
    "Jun 23": { "camp": "swim", "campTime": "all day", "tasks": ["reading"], "lesson": false }
  }
}

If no schedule changes are needed (just a question), omit the "overrides" key entirely.
The "reply" should be warm, short, and parent-friendly (LA is the one chatting, not Evelyn).`;

  const messages = [
    ...(history || []),
    { role: 'user', content: message }
  ];

  if (currentSchedule) {
    messages[messages.length - 1].content =
      `Current schedule overrides in effect: ${JSON.stringify(currentSchedule)}\n\nUser request: ${message}`;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM,
      messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: err });
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';

  let parsed;
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'').trim();
    parsed = JSON.parse(cleaned);
  } catch { parsed = { reply: text }; }

  res.json(parsed);
}
