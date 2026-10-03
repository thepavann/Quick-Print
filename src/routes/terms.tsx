import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · QuickPrint" },
      { name: "description", content: "The terms for using QuickPrint as a student or a stationery shop owner." },
      { property: "og:title", content: "Terms of Service · QuickPrint" },
      { property: "og:description", content: "The terms for using QuickPrint as a student or a shop owner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Terms of Service"
      updated="September 2026"
      sections={[
        { heading: "Using QuickPrint", body: "QuickPrint lets students send documents to a stationery shop's printer by scanning a QR code at the counter. You must be at the shop to use it." },
        { heading: "Your content", body: "Only upload documents you have the right to print. Shops may refuse jobs that are unlawful or inappropriate." },
        { heading: "Payment", body: "Prices are calculated automatically from the shop's rates. Payment is made directly to the shop at the counter." },
        { heading: "Shop owners", body: "Shop owners are responsible for their printer, pricing, and keeping their print agent key private." },
        { heading: "Availability", body: "We work to keep the service running, but printing depends on the shop's internet connection, computer and printer." },
      ]}
    />
  ),
});
