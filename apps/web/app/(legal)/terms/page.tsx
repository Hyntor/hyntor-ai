import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, CONTACT_EMAIL, LegalTitle, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of Service - Hyntor",
  description: "The terms that govern your use of Hyntor.",
};

export default function TermsPage() {
  return (
    <div>
      <LegalTitle updated="July 5, 2026">Terms of Service</LegalTitle>

      <Section n={1} title="Who we are, and your agreement with us">
        <p>
          Hyntor (&quot;Hyntor&quot;, &quot;we&quot;, &quot;us&quot;) is a study platform where university classes share course
          materials in one library, talk in a class group chat, and use study tools - plus an optional AI
          study assistant. These Terms of Service (&quot;Terms&quot;) are a binding agreement between you and the
          operator of Hyntor. By creating an account or using hyntor.vercel.app (the &quot;Service&quot;), you agree
          to these Terms and to our <Link href="/privacy" className="font-semibold text-brand-600 hover:text-brand-700">Privacy Policy</Link>.
          If you do not agree, do not use the Service.
        </p>
      </Section>

      <Section n={2} title="Eligibility">
        <Bullets
          items={[
            "You must be at least 13 years old (or the higher minimum age required in your country) to use Hyntor.",
            "You must be able to form a binding contract, or have permission from a parent or guardian who agrees to these Terms on your behalf.",
            "You must comply with the rules of your school or university, including its honor code and academic-integrity policies. Hyntor does not override them.",
          ]}
        />
      </Section>

      <Section n={3} title="Your account">
        <Bullets
          items={[
            "Provide accurate information (a real email address you control, your real name or the name you go by in class).",
            "Keep your password confidential. You are responsible for activity that happens under your account.",
            "One person per account. Do not share, sell, or transfer your account.",
            <>Tell us at <a className="font-semibold text-brand-600 hover:text-brand-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if you believe your account has been compromised.</>,
          ]}
        />
      </Section>

      <Section n={4} title="The Service">
        <p>
          Hyntor lets enrolled students of a course share study materials (notes, slides, homework prompts,
          practice and past exams), discuss them in group chats, discussion boards and shared annotations,
          and generate study aids (quizzes, flashcards, mock exams, study plans, concept maps). Some
          features use artificial intelligence and are only available on paid plans or when an AI provider
          is configured. We may add, change, or remove features at any time.
        </p>
      </Section>

      <Section n={5} title="Your content and how sharing works">
        <p>
          &quot;Content&quot; means anything you upload or post: files, extracted text, messages, posts,
          annotations, quiz answers, and similar material.
        </p>
        <Bullets
          items={[
            "You own your Content. Hyntor does not take ownership of anything you upload.",
            "By posting Content to a course, you grant us a worldwide, non-exclusive, royalty-free license to host, store, process, display, and distribute it - solely to operate the Service (for example: showing your notes to classmates enrolled in the same course, extracting text so study tools and the AI can read it, and keeping it available to future semesters of that course).",
            "Sharing is the point: Content you post to a course is visible to everyone enrolled in that course, now and in future semesters. Do not upload anything you want to keep private.",
            "You are responsible for having the right to share what you upload. Upload your own notes and materials you are permitted to share - not, for example, entire copyrighted textbooks, paid solution manuals, or materials your school or professor prohibits distributing.",
            "You can delete Content you posted. Copies may persist in backups for a limited time.",
          ]}
        />
      </Section>

      <Section n={6} title="Academic integrity">
        <p>
          Hyntor is built for learning, not cheating. The AI assistant is deliberately designed to give
          escalating hints, guiding questions, and analogous examples on graded work - not final submittable
          answers. You agree that:
        </p>
        <Bullets
          items={[
            "You will not use the Service to violate your school's academic-integrity rules (for example, using it during a closed-book exam, or submitting others' shared work as your own).",
            "You will not attempt to manipulate the AI into producing answers to graded work for you to submit.",
            "You remain solely responsible for the work you submit to your school and for complying with its policies. Hyntor is a study aid, not an authorization to use outside help where your school forbids it.",
          ]}
        />
      </Section>

      <Section n={7} title="Acceptable use">
        <p>You agree not to:</p>
        <Bullets
          items={[
            "Upload Content that infringes copyright or other rights, or that is unlawful, harassing, hateful, or sexually explicit.",
            "Impersonate another person, misrepresent your school affiliation, or sign up with an email address you do not control.",
            "Spam, advertise, or solicit in course libraries, chats, or discussion boards.",
            "Probe, scrape, overload, or interfere with the Service, attempt to access other users' accounts or data, or reverse-engineer the Service.",
            "Use the Service to build a competing dataset or product.",
          ]}
        />
        <p>We may remove Content or restrict accounts that violate these rules.</p>
      </Section>

      <Section n={8} title="Copyright complaints">
        <p>
          If you believe Content on Hyntor infringes your copyright, email{" "}
          <a className="font-semibold text-brand-600 hover:text-brand-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
          with: (a) the material you claim is infringed, (b) a link or description of where it appears on
          the Service, (c) your contact information, and (d) a statement that you believe in good faith the
          use is unauthorized. We will review and, where appropriate, remove the material and may terminate
          repeat infringers&apos; accounts.
        </p>
      </Section>

      <Section n={9} title="Plans, payment, and the Pro subscription">
        <Bullets
          items={[
            "The core Service (shared library, group chat, discussions, study tools) is free.",
            "Hyntor Pro is a paid subscription that unlocks the AI assistant. Prices are shown at purchase and may change with notice; changes apply from your next billing period.",
            "Subscriptions renew automatically until cancelled. You can cancel anytime, effective at the end of the current billing period. Except where required by law, payments are non-refundable.",
            "AI usage on paid plans may be subject to fair-use limits to keep the Service sustainable.",
          ]}
        />
      </Section>

      <Section n={10} title="AI-generated content">
        <p>
          Quizzes, explanations, study plans, concept maps, and AI chat replies are generated by artificial
          intelligence and can be wrong, incomplete, or misleading. They are study aids - not professional
          advice and not a guarantee of what will be on your exam. Verify important information against
          your course materials and instructor guidance.
        </p>
      </Section>

      <Section n={11} title="Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
          IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT. WE DO NOT
          WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT CONTENT (INCLUDING
          USER-SHARED MATERIALS) IS ACCURATE OR LAWFULLY SHARED BY ITS UPLOADER.
        </p>
      </Section>

      <Section n={12} title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, HYNTOR AND ITS OPERATOR WILL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES - INCLUDING LOST DATA, LOST
          PROFITS, OR ACADEMIC CONSEQUENCES (SUCH AS GRADES OR DISCIPLINARY OUTCOMES) - ARISING FROM YOUR
          USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM IS LIMITED TO THE GREATER OF (A) THE AMOUNT
          YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM AND (B) US $20. SOME JURISDICTIONS DO NOT ALLOW
          CERTAIN LIMITATIONS, SO PARTS OF THIS SECTION MAY NOT APPLY TO YOU.
        </p>
      </Section>

      <Section n={13} title="Termination">
        <Bullets
          items={[
            "You may stop using Hyntor and request account deletion at any time.",
            "We may suspend or terminate accounts that violate these Terms, create risk for other users, or where required by law. Where reasonable, we will notify you.",
            "Sections that by their nature should survive (content licenses needed to keep course libraries working, disclaimers, limitation of liability) survive termination.",
          ]}
        />
      </Section>

      <Section n={14} title="Changes to these Terms">
        <p>
          We may update these Terms as the Service evolves. For material changes we will give notice (for
          example, on the site or by email) before the changes take effect. Continuing to use the Service
          after changes take effect means you accept the updated Terms.
        </p>
      </Section>

      <Section n={15} title="Governing law">
        <p>
          These Terms are governed by the laws of the jurisdiction in which Hyntor&apos;s operator is
          established, without regard to conflict-of-law rules - except where the mandatory consumer-
          protection law of your country of residence applies. Disputes will be resolved in the courts of
          that jurisdiction unless applicable law gives you the right to sue elsewhere.
        </p>
      </Section>

      <Section n={16} title="Contact">
        <p>
          Questions about these Terms:{" "}
          <a className="font-semibold text-brand-600 hover:text-brand-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </Section>
    </div>
  );
}
