import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, CONTACT_EMAIL, LegalTitle, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy - Hyntor",
  description: "What Hyntor collects, how it's used, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <div>
      <LegalTitle updated="July 5, 2026">Privacy Policy</LegalTitle>

      <Section n={1} title="Overview">
        <p>
          This policy explains what information Hyntor (&quot;we&quot;, &quot;us&quot;) collects when you use
          hyntor.vercel.app (the &quot;Service&quot;), how we use it, who can see it, and the choices you have.
          The short version: we collect what&apos;s needed to run a shared class library and study tools,
          your course Content is visible to your classmates by design, and{" "}
          <strong className="text-ink">we do not sell your data and we do not run ads</strong>.
        </p>
      </Section>

      <Section n={2} title="Information we collect">
        <Bullets
          items={[
            <><strong className="text-ink">Account information</strong> - your name, email address, hashed password (we store only a bcrypt hash, never the password itself), and the school associated with your email domain.</>,
            <><strong className="text-ink">Google sign-in</strong> - if you sign in with Google, we receive your name, email address, and Google&apos;s confirmation that the email is verified. We do not receive your Google password or contacts.</>,
            <><strong className="text-ink">Content you create</strong> - materials you upload (files and text extracted from them), chat messages, discussion posts, annotations, quiz answers, flashcard reviews, and study plans.</>,
            <><strong className="text-ink">Activity data</strong> - XP, streaks, upvotes, quiz scores, and which courses you join. This powers progress tracking and leaderboards.</>,
            <><strong className="text-ink">Technical data</strong> - standard server logs (IP address, browser type, timestamps) kept by our hosting provider for security and reliability.</>,
          ]}
        />
      </Section>

      <Section n={3} title="Cookies">
        <p>
          Hyntor uses only essential cookies: a session cookie that keeps you signed in and related
          security cookies (for example, CSRF protection). We do not use advertising or cross-site
          tracking cookies.
        </p>
      </Section>

      <Section n={4} title="How we use your information">
        <Bullets
          items={[
            "To operate the Service: your account, course enrollment, the shared library, chats, and study tools.",
            "To ground AI features in your class's materials when you use them (see Section 6).",
            "To show progress and leaderboards (your name, XP, and streak are visible to classmates and schoolmates).",
            "To secure the Service: verifying email domains, preventing abuse, and debugging problems.",
            "To contact you about the Service (for example, email verification codes when enabled). We do not send marketing email.",
          ]}
        />
      </Section>

      <Section n={5} title="What your classmates can see">
        <p>Sharing is the core of Hyntor, so be aware of what is visible to others:</p>
        <Bullets
          items={[
            "Materials, chat messages, discussion posts, and annotations you post in a course are visible to everyone enrolled in that course - including students who join in future semesters.",
            "Your name, XP, streak, and rank appear on leaderboards visible to your school and courses.",
            "Your private tutor sessions, quiz attempts, flashcard reviews, and study plans are NOT visible to other students.",
          ]}
        />
      </Section>

      <Section n={6} title="AI processing">
        <p>
          Some features (the tutor, quiz and flashcard generation, grading, study plans, concept maps, and
          the Pro group-chat assistant) send data to Anthropic, our AI provider, to generate a response.
          That data can include your question, relevant course materials, and - for the group-chat
          assistant - recent chat messages. Under Anthropic&apos;s API terms, this data is not used to train
          their models. AI features run only when you (or a classmate, in shared spaces) actively invoke
          them.
        </p>
      </Section>

      <Section n={7} title="Service providers">
        <p>
          We use a small set of processors to run Hyntor, each receiving only what it needs: Vercel
          (hosting and file storage), Neon (database), Google (optional sign-in), Anthropic (AI features),
          Resend (verification emails, when enabled), and Stripe (payments, when paid plans launch; card
          details go directly to Stripe and never touch our servers). Data is processed on servers that
          may be located in the United States or other countries.
        </p>
      </Section>

      <Section n={8} title="What we don't do">
        <Bullets
          items={[
            "We do not sell or rent your personal information.",
            "We do not run advertising or share your data with advertisers.",
            "We do not read your private study activity to profile you.",
            "We do not use your Content to train AI models.",
          ]}
        />
      </Section>

      <Section n={9} title="Data retention and deletion">
        <Bullets
          items={[
            "Your account data is kept while your account exists.",
            "Content shared to a course library stays available to that course (that's the product's promise to your classmates) unless you delete it or we remove it.",
            <>To delete your account and personal data, email{" "}
              <a className="font-semibold text-brand-600 hover:text-brand-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
              from the account&apos;s email address. We will delete or de-identify your personal data within 30 days, except where we must keep it for legal reasons. Materials you shared to a course may remain available to the class in de-identified form (no longer attributed to you) or be removed at your request.</>,
            "Backups are retained for a limited period before being overwritten.",
          ]}
        />
      </Section>

      <Section n={10} title="Security">
        <p>
          All traffic is encrypted in transit (HTTPS). Passwords are stored only as bcrypt hashes.
          Database access is restricted and credentials are managed through our hosting provider&apos;s
          secret storage. No system is perfectly secure - if we learn of a breach affecting your data, we
          will notify you as required by law.
        </p>
      </Section>

      <Section n={11} title="Your rights">
        <p>
          Depending on where you live (for example, under the GDPR or similar laws), you may have rights
          to access, correct, export, restrict, or delete your personal data, and to object to certain
          processing. You can exercise any of these by emailing{" "}
          <a className="font-semibold text-brand-600 hover:text-brand-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          You also have the right to complain to your local data-protection authority.
        </p>
      </Section>

      <Section n={12} title="Children">
        <p>
          Hyntor is for university and older students and is not directed to children under 13 (or the
          higher minimum age in your country). We do not knowingly collect data from children under that
          age; if you believe a child has created an account, contact us and we will delete it.
        </p>
      </Section>

      <Section n={13} title="Changes to this policy">
        <p>
          We may update this policy as the Service evolves. For material changes we will give notice on
          the site or by email before they take effect. The &quot;Last updated&quot; date at the top always
          reflects the current version.
        </p>
      </Section>

      <Section n={14} title="Contact">
        <p>
          Privacy questions or requests:{" "}
          <a className="font-semibold text-brand-600 hover:text-brand-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          See also our <Link href="/terms" className="font-semibold text-brand-600 hover:text-brand-700">Terms of Service</Link>.
        </p>
      </Section>
    </div>
  );
}
