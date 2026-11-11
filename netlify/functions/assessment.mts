// POST /api/assessment: stores a completed dry mouth assessment (and the lead, when details were given)
// in Netlify Database. Netlify Forms receives the same submission separately for notifications.
import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

const QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;
const CAUSES = new Set(["Sjogren's or other immune condition", "Cancer treatment", "CPAP or sleep appliance", "Medications",
  "Cannabis", "Other", "I don't know", "Prefer not to answer"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (msg: string) => Response.json({ ok: false, error: msg }, { status: 400 });

export default async (req: Request) => {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad("Invalid JSON"); }
  if (str(body["bot-field"])) return Response.json({ ok: true });   // honeypot: pretend success

  const answers: Record<string, boolean> = {};
  for (const q of QUESTIONS) {
    const v = (body.answers as Record<string, unknown> | undefined)?.[q];
    if (v !== "Yes" && v !== "No") return bad(`Missing answer ${q}`);
    answers[q] = v === "Yes";
  }
  const score = Object.values(answers).filter(Boolean).length;
  const severity = score === 0 ? "none" : score === 1 ? "mild" : score < 4 ? "moderate" : "severe";   // US scoring
  const cause = str(body.xerostomia_cause);
  if (cause && !CAUSES.has(cause)) return bad("Unknown cause");
  const skipped = body.skipped === true;

  const db = getDatabase();
  let leadId: string | null = null;
  if (!skipped) {
    const email = str(body.email, 254).toLowerCase(), first = str(body.firstname, 100), last = str(body.lastname, 100);
    if (!EMAIL.test(email) || !first || !last) return bad("Name and a valid email are required");
    const phone = str(body.phone, 30) || null, optIn = body.marketing_opt_in === true;
    const [lead] = await db.sql<{ id: string }>`
      INSERT INTO leads (email, first_name, last_name, phone, marketing_opt_in, opt_in_at)
      VALUES (${email}, ${first}, ${last}, ${phone}, ${optIn}, ${optIn ? new Date() : null})
      ON CONFLICT (email) DO UPDATE SET
        first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
        phone = COALESCE(EXCLUDED.phone, leads.phone),
        marketing_opt_in = leads.marketing_opt_in OR EXCLUDED.marketing_opt_in,
        opt_in_at = COALESCE(leads.opt_in_at, EXCLUDED.opt_in_at),
        updated_at = NOW()
      RETURNING id`;
    leadId = lead.id;
  }
  await db.sql`
    INSERT INTO assessments (lead_id, cause, cause_other, answers, score, severity, skipped_details, discount_code, page)
    VALUES (${leadId}, ${cause || null}, ${str(body.xerostomia_cause_other, 300) || null}, ${JSON.stringify(answers)}::jsonb,
            ${score}, ${severity}, ${skipped}, ${skipped ? null : "SURVEY"}, ${str(body.page, 300) || null})`;
  return Response.json({ ok: true, score, severity }, { status: 201 });
};

export const config: Config = {
  path: "/api/assessment",
  method: "POST",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 10 },
};
