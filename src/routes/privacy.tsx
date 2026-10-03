import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · QuickPrint" },
      { name: "description", content: "How QuickPrint handles student documents: used only for printing and deleted automatically." },
      { property: "og:title", content: "Privacy Policy · QuickPrint" },
      { property: "og:description", content: "Student documents are used only for printing and deleted automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Privacy Policy"
      updated="September 2026"
      sections={[
        { heading: "What we collect", body: "Students do not need an account. We only receive the document you upload and the print options you choose. Shop owners provide an email address to sign in." },
        { heading: "How documents are used", body: "Your document is used only to print it at the shop you scanned. It is never sold, shared, read or analysed." },
        { heading: "Automatic deletion", body: "Uploaded documents are stored privately and deleted automatically about one hour after the job finishes, fails or is cancelled." },
        { heading: "Security", body: "Files are sent over encrypted connections and can only be downloaded by the shop's authorised print computer using a short-lived link." },
        { heading: "Contact", body: "For questions about your data, speak to the shop where you printed or contact the QuickPrint team." },
      ]}
    />
  ),
});
