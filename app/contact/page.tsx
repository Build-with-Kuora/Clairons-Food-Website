import type { Metadata } from "next";
import { PublicFrame } from "@/components/landing/PublicFrame";
import { WholesaleForm } from "@/components/landing/WholesaleForm";

export const metadata: Metadata = {
  title: "Contact | Clairon's Food",
  description: "Get in touch with Clairon's Food, or set up a wholesale account for your carinderia, food cart, canteen or store.",
};

export default function ContactPage() {
  return (
    <PublicFrame page="contact">
      <section className="lp-flutes">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-5">
            <h1 className="lp-display lp-h2">Talk to us</h1>
            <dl className="lp-label mt-8">
              <div className="lp-label-head px-5 py-3">
                <dt className="lp-display text-[1.5rem]">Clairon&rsquo;s Food</dt>
                <dd className="sr-only">Contact details</dd>
              </div>
              <Row label="Address" value="Street, barangay, city" />
              <Row label="Mobile" value="0900 000 0000" />
              <Row label="Messenger" value="facebook.com/your-page" />
              <Row label="E-mail" value="orders@your-domain.ph" />
              <div className="lp-rule-t px-5 py-4">
                <dt className="text-[0.85rem] font-semibold text-[var(--lp-ink-2)]">Deliveries</dt>
                <dd className="font-semibold">Monday to Saturday, 8 am to 5 pm</dd>
              </div>
            </dl>
            <p className="mt-3 text-[0.9rem] text-[var(--lp-ink-2)]">Address, mobile, Messenger and e-mail are placeholders until the real ones are in.</p>
          </div>

          <div id="wholesale" className="scroll-mt-24 lg:col-span-7">
            <h2 className="lp-display lp-h2">Order wholesale</h2>
            <p className="lp-body mt-4 mb-8">Tell us about your business and what you need. We set up your account, prices and delivery day.</p>
            <WholesaleForm />
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="lp-field flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-[0.85rem] font-semibold text-[var(--lp-ink-2)]">{label}</dt>
      <dd className="lp-todo-inline text-right">{value}</dd>
    </div>
  );
}
