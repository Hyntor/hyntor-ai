# Hyntor - Business Plan

*Working draft, June 2026. Companion document: [COMPETITOR_RESEARCH.md](COMPETITOR_RESEARCH.md)
(all market claims sourced there).*

---

## 1. One-page summary

**Hyntor is the responsible-AI study platform.** Students upload their course materials
into a shared per-course library; an AI tutor grounded in those materials explains concepts
generously but guides graded work with **server-enforced, escalating hints** instead of
answers; auto-generated quizzes in the professor's style close the loop. Web + native mobile.

- **Problem:** 64% of students already study with AI weekly, but the tools they use are
  answer machines - 67% of students themselves say AI is eroding their critical thinking,
  and universities have no tool they can endorse.
- **Insight:** you can't out-answer ChatGPT. The durable position is the one frontier
  chatbots structurally won't take: *course-grounded, integrity-first, classmate-networked.*
- **Why we win:** (1) the class graph - every upload makes the tutor smarter for the whole
  class, compounding course by course; (2) integrity by *architecture* (tier system enforced
  server-side, visible as badges), not by a toggleable filter; (3) the only posture
  universities can officially endorse -> a B2B2C channel closed to answer-vendors.
- **Model:** free core + Pro subscription (~$5.99/mo student pricing) + university licenses.
- **Status:** Phase 1 product is built and working (web + mobile skeleton, full data model
  for all four phases).

## 2. The problem

Students live in three broken worlds:
1. **Answer machines** (ChatGPT default, Chegg): instant answers, zero retention, integrity
   risk - and student anxiety about both. Study Mode-style filters fold the moment a student
   says "just give me the answer."
2. **Generic study tools** (Quizlet): content not tied to *their* course or *their*
   professor's emphases; paywalls creeping over what used to be free.
3. **Fragmented class community** (Discord, GroupMe, Piazza): where real studying-together
   happens, but unstructured, ephemeral, and AI-free.

Meanwhile faculty/administrators are stuck between "ban AI" (unenforceable - only 20% of
universities even have a formal AI policy) and "allow AI" (no tool they trust).

## 3. The product (and its moats)

**Core loop (live today):** join course -> upload materials (text extracted server-side) ->
ask the grounded tutor -> generate & take quizzes in the prof's style -> pre-submit code
review -> XP/streaks accrue.

| Moat | Mechanism | Why competitors can't copy it easily |
|---|---|---|
| Class network effect | Shared per-course library; upvoting surfaces the best materials | Solo-tool competitors (StudyFetch et al.) would need to rebuild their product around courses, cannibalizing their individual-subscription model |
| Integrity by architecture | Tier ceiling computed server-side from engagement; `[TIER:n]` audit trail per session | ChatGPT/Claude sell general assistants; a hard "won't give answers" product limits their broader use cases. Chegg-style players have the opposite brand |
| University-endorsable | Tier audit data + grounded-in-course-materials design | Answer-vendors are radioactive to administrations; we're the tool a syllabus can recommend |
| CS wedge | Code review that never rewrites; Socratic debugging | No direct competitor; high-pain, high-density early adopters |

**Tagline:** *Don't just get the answer. Actually learn it.*
**Positioning sentence:** Quizlet knows flashcards, ChatGPT knows everything, Hyntor
knows *your course* - and makes sure it's still *you* doing the learning.

## 4. Market

- **TAM:** AI-in-education ~$11.4B (2026) -> ~$57B (2033); ~235M tertiary students globally.
- **SAM:** US + EU higher-ed students with AI study habits - ~30M students; at a blended
  $25/student/yr (consumer + institutional mix) approx **$750M/yr**.
- **SOM (36 months):** 40 campuses x ~4,000 active students = ~160k MAU; at 6% paid
  conversion x $50/yr approx **$480k ARR** consumer + early university pilots. (Deliberately
  conservative; ambassador-led growth could outperform.)

## 5. Business model & pricing

| Tier | Price | Gets |
|---|---|---|
| **Free** | $0 | Join/create courses, shared library, take quizzes, limited tutor messages/day, limited quiz generations/week, code review (limited) |
| **Pro** | **$5.99/mo or $39/yr** (launch pricing) | Unlimited tutor + generation, mock exams (P3), study plans (P3), advanced weak-spot analytics |
| **Class Pass** (later) | ~$49/course/semester, instructor-paid or department-paid | Pro for every enrolled student + instructor dashboard (aggregate weak topics - never per-student surveillance) |
| **University license** (later) | ~$10-15/student/yr | SSO, LMS (Canvas) integration, admin analytics, integrity reporting |

Pricing logic: under Quizlet Plus ($7.99/mo), ~one-third of Chegg ($15.95/mo), above Khanmigo ($4/mo)
with far more product. Free tier limits are set so AI COGS stay bounded (see Section 8 unit economics).

**AI cost note (the key unit-economics lever):** grounding + chat on `claude-sonnet-4-6`
costs cents per session; a capped free tier (~15 tutor messages/day) keeps free-user COGS
< $0.50/mo, while a Pro user at heavy usage costs $2-4/mo against $5.99 revenue. Prompt
caching on course materials (same grounding context reused across a class!) cuts input
token costs dramatically - a structural cost advantage of the shared-library design.

## 6. Go-to-market

**Phase A - One course at a time (months 0-6).** Pick 10 large CS courses across 2-3
campuses. Recruit one **Course Founder** (ambassador) per course: they upload the first
materials, invite the class group chat, get free Pro + swag. Success metric: >=30% of a
course's enrollment active by midterms. The product's empty state is designed for this
("Be the hero: upload the first lecture notes").
**Phase B - Campus density (6-18).** Word-of-mouth across courses; exam-week virality
(mock exams, countdown dashboards); referral = free Pro weeks. Add Greek-life/clubs style
leaderboards per course (anonymous).
**Phase C - Institutional (18+).** With usage + integrity data in hand, approach teaching &
learning centers: pilot Class Pass with sympathetic instructors first (the Piazza adoption
path), then university licenses. Anthropic's Claude-for-Education campus momentum is a
tailwind here - we're the student-native complement, not a rival bid.

**Channels:** course ambassadors, TikTok/IG study-tok (the Turbolearn playbook - demo the
tier system refusing to do homework, which is *inherently* viral content), exam-season SEO
("CS201 hash table practice exam"), instructor referrals.

## 7. Competition (summary - full analysis in COMPETITOR_RESEARCH.md)

- **ChatGPT Study Mode / Claude Learning Mode:** free & ubiquitous, but guardrails are
  opt-in filters, no course grounding, no class network. We must be 10x better *for coursework
  specifically*, not generally smarter.
- **Quizlet:** owns memorization; weak on understanding, course context, and integrity.
- **Chegg/Course Hero:** structurally dying; their document-library moat is what our shared
  course library rebuilds - free, organized, AI-powered.
- **StudyFetch/Knowunity/Turbolearn/Mindgrasp:** funded fast-followers on "materials -> study
  aids," but all solo-productivity tools without the class graph or integrity architecture.
- **Khanmigo:** validates paid Socratic tutoring; K-12, leaves higher-ed open.

## 8. Financial sketch (36 months)

Assumptions: ambassador-led growth, 6% free->paid, $50 effective ARPU/paid/yr, AI COGS ~22%
of revenue at scale (with prompt caching), team of 2-4 until month 18.

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| Registered students | 25k | 90k | 250k |
| MAU | 10k | 45k | 140k |
| Paid subs | 600 | 3,600 | 12,000 |
| Consumer ARR | $30k | $180k | $600k |
| Institutional ARR | - | $50k (pilots) | $300k |
| **Total ARR** | **$30k** | **$230k** | **$900k** |

Costs Y1 approx $40-60k (infra + AI + marketing snacks) if founder-built - i.e., ramen-profitable
is plausible by Y2 without funding; a pre-seed ($500k) buys the Phase 2/3 build-out and
10x'es the ambassador program.

## 9. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| OpenAI/Anthropic ship course-grounded study products | High | Move fast on the class graph + university relationships (their structural blind spots); stay model-agnostic at the API layer |
| Copyright complaints on uploaded materials | Medium | DMCA takedown flow; per-course (not public) sharing; instructor opt-out registry; TOS placing upload responsibility on uploader |
| Students route around tiers (paste assignment as "concept") | Medium | Mode detection in prompts (already detects answer-seeking); tier audit per session; accept imperfection - the *median* outcome still beats answer-vending, and the brand depends on posture, not perfection |
| Free-tier AI costs blow up | Medium | Hard caps + prompt caching + per-course grounding reuse; raise caps as conversion proves out |
| Cold-start: empty course libraries | High | Course Founder program; seed quizzes from any first upload in <60s (already built); cross-university course sharing (P2) pools sparse courses |
| FERPA/GDPR (institutional sales) | Medium | We never sell student data (contrast: Piazza); minimal PII; data-processing agreements before pilots |

## 10. Roadmap -> business milestones

| Product phase | Business milestone it unlocks |
|---|---|
| **P1 (done)**: core loop | Ambassador pilots can start now |
| **P2**: workspaces, chat, discussion boards + AI-in-thread | Replaces course Discords -> daily-active habit; cross-university courses pool thin markets |
| **P3**: mock exams, spaced repetition, study plans, syllabus import | The "exam week" conversion spike - Pro's reason-to-pay |
| **P4**: streaks/XP UI, leaderboards, sandbox, visualizer | Retention engine; TikTok-able moments |

## 11. The ask (if/when raising)

Pre-seed **$500k** for 18 months: 1 founding engineer + 1 growth/campus lead, AI costs for
~50k MAU free tier, 30-campus ambassador program. Milestones: 3 campuses >25% penetration,
2 paid university pilots, $15k MRR. (Bootstrap path is viable at smaller scale - see Section 8.)
