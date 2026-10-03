import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  FileUp,
  Images,
  Monitor,
  Printer,
  QrCode,
  ShieldCheck,
  Smartphone,
  Trash2,
  Usb,
  Zap,
} from "lucide-react";

import { Logo, StatusDot } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuickPrint — Print from anywhere. Submit only when you're there." },
      {
        name: "description",
        content:
          "QR-powered printing for stationery stores, colleges, libraries and print centres. Students scan a one-time code, upload PDFs, Word files or photos, and the counter's print agent prints silently.",
      },
      {
        property: "og:title",
        content: "QuickPrint — Print from anywhere. Submit only when you're there.",
      },
      {
        property: "og:description",
        content:
          "QR-powered printing for stationery stores, colleges, libraries and print centres.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const DEMO_STATION = "11111111-1111-4111-8111-111111111111";

const STEPS = [
  {
    number: "01",
    title: "Scan the QR",
    body: "The counter screen shows a one-time QR code. The first phone to scan it gets a private print session; the code is replaced immediately, so nobody can send work from outside the shop.",
    icon: QrCode,
  },
  {
    number: "02",
    title: "Upload & customise",
    body: "PDF, Word file or photos. Photos can be laid out 1, 2, 4, 6 or 9 to a page, or as passport sheets. Copies, colour, sides and paper size are priced instantly from your own rate card.",
    icon: FileUp,
  },
  {
    number: "03",
    title: "Collect your prints",
    body: "The job joins the counter queue with a pickup number, the print agent sends it to your printer, and the student pays on collection.",
    icon: Printer,
  },
];

const BENEFITS = [
  {
    title: "No more USB drives",
    body: "Students stop plugging unknown pen drives into your counter PC. Files arrive over the web and are deleted after printing.",
    icon: Usb,
  },
  {
    title: "No more WhatsApp chaos",
    body: "No forwarding files to your personal number, no scrolling chats to find whose assignment is whose. Every job carries a pickup number.",
    icon: Smartphone,
  },
  {
    title: "Photo sheets, done right",
    body: "Passport photos, ID pictures and 2-up or 4-up notes are arranged automatically before printing. No manual page setup.",
    icon: Images,
  },
  {
    title: "Zero pricing mistakes",
    body: "Copies, duplex, colour and paper size are calculated on our servers from your rate card — never from the phone.",
    icon: Banknote,
  },
  {
    title: "Silent printing",
    body: "The agent on your Windows PC prints without a dialog box. Nobody has to stop serving customers to click Print.",
    icon: Zap,
  },
  {
    title: "Files are not kept",
    body: "Uploaded documents are removed from storage after the job finishes, so student work is never left sitting on a server.",
    icon: Trash2,
  },
];

const FAQS = [
  {
    q: "Do I need a new printer?",
    a: "No. Any printer that already works on your Windows counter PC works with QuickPrint — HP, Canon, Epson, Brother, USB, Wi-Fi or network. The agent simply uses the printer Windows already has.",
  },
  {
    q: "What happens if the internet drops?",
    a: "Jobs stay in the queue. The moment the agent reconnects it picks up where it left off, and a job stuck mid-download returns to the queue automatically.",
  },
  {
    q: "Can students print from home?",
    a: "No, and that's the point. Each QR code works once and is replaced after it is scanned, so a photo of the screen is useless.",
  },
  {
    q: "How do students pay?",
    a: "Cash at the counter. Every job shows the amount before it is submitted, and your dashboard tracks which jobs have been collected and paid.",
  },
  {
    q: "How long are files stored?",
    a: "Only until printing finishes. Completed and failed jobs have their documents deleted from storage automatically.",
  },
];

function PhoneMock() {
  return (
    <div className="mx-auto w-full max-w-[220px] rounded-[1.75rem] border border-border bg-surface p-2 shadow-soft">
      <div className="rounded-[1.4rem] bg-surface-muted p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-tight">QuickPrint</span>
          <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
            <StatusDot tone="online" /> Session active
          </span>
        </div>
        <div className="mt-3 rounded-lg border border-border bg-surface p-2.5">
          <p className="truncate text-[10px] font-medium">unit-3-notes.pdf</p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">8 pages · 1.2 MB</p>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {["B&W", "Colour", "Single", "Double"].map((label, index) => (
            <span
              key={label}
              className={`rounded-md px-2 py-1 text-center text-[9px] ${
                index === 0 || index === 2
                  ? "bg-foreground text-background"
                  : "border border-border bg-surface text-muted-foreground"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-surface px-2.5 py-2">
          <span className="text-[9px] text-muted-foreground">Total</span>
          <span className="text-[11px] font-semibold tabular">₹32</span>
        </div>
        <div className="mt-2 rounded-lg bg-brand px-2 py-2 text-center text-[10px] font-medium text-white">
          Submit print job
        </div>
      </div>
    </div>
  );
}

function CounterMock() {
  return (
    <div className="mx-auto w-full max-w-[260px] rounded-2xl border border-border bg-surface p-3 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-tight">Sharma Stationery</span>
        <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
          <StatusDot tone="online" pulse /> Online
        </span>
      </div>
      <div className="mx-auto mt-3 grid aspect-square w-full max-w-[150px] place-items-center rounded-xl bg-white p-2">
        <div
          className="size-full rounded-md"
          style={{
            backgroundImage:
              "repeating-conic-gradient(#101828 0% 25%, #ffffff 0% 50%)",
            backgroundSize: "14px 14px",
          }}
        />
      </div>
      <p className="mt-3 text-center text-[11px] font-medium">Scan to print</p>
      <p className="mt-1 text-center text-[9px] leading-relaxed text-muted-foreground">
        This code works once. A new one appears after every scan.
      </p>
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="mx-auto w-full rounded-2xl border border-border bg-surface p-3 shadow-soft">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <span className="text-[10px] font-semibold tracking-tight">Overview</span>
        <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
          <StatusDot tone="online" pulse /> Print agent online
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {[
          ["Jobs", "34"],
          ["Pages", "212"],
          ["Revenue", "₹1,480"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface-muted px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-[11px] font-semibold tabular">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-2.5 space-y-1.5">
        {[
          ["QP-10482", "unit-3-notes.pdf", "Printing"],
          ["QP-10483", "passport-photos.jpg", "Queued"],
          ["QP-10484", "project-report.docx", "Queued"],
        ].map(([id, file, status]) => (
          <div
            key={id}
            className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5"
          >
            <span className="text-[9px] tabular text-foreground">{id}</span>
            <span className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground">{file}</span>
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[8px] text-muted-foreground">
              {status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#why" className="transition-colors hover:text-foreground">
              Why shops use it
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/station/$stationId/display" params={{ stationId: DEMO_STATION }}>
                View demo
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="size-3.5 text-brand" />
                One-time QR codes · no remote submissions
              </span>
              <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
                Print from anywhere.
                <br className="hidden sm:block" /> Submit only when you're there.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                QR-powered printing for modern stationery stores, colleges, libraries and print
                centres. Students scan, upload and collect — your printer does the rest, silently.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/login">
                    Get started
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/station/$stationId/display" params={{ stationId: DEMO_STATION }}>
                    <Monitor className="size-4" />
                    View demo
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Works with the printer you already have · Cash collected at your counter
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
              <CounterMock />
              <PhoneMock />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-border bg-surface-muted/60">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-3 md:gap-8">
            {STEPS.map((step) => (
              <div key={step.number} className="md:pr-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-muted-foreground shadow-xs-soft">
                    <step.icon className="size-4" />
                  </span>
                  <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground/70 tabular">
                    {step.number}
                  </span>
                </div>
                <h2 className="mt-5 text-base font-semibold tracking-tight text-foreground">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="why" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Built for the counter, not for a demo
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Everything here removes a job you do by hand today.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((item) => (
              <div key={item.title} className="bg-surface p-5">
                <item.icon className="size-4 text-brand" />
                <h3 className="mt-3 text-sm font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface-muted/60">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                One dashboard for the whole counter
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Live queue, printer health, cash collected, pages printed in black and white versus
                colour, and one-click reprints when a page jams. The browser never touches your
                printer — jobs are queued in the cloud and pulled by the agent on your Windows PC.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Student phone", hint: "Scan & upload" },
                  { label: "One-time QR", hint: "Replaced after each scan" },
                  { label: "Print queue", hint: "Priced on our servers" },
                  { label: "Windows agent", hint: "Silent printing" },
                ].map((node, index) => (
                  <div key={node.label} className="relative rounded-xl bg-surface p-3.5">
                    <p className="text-sm font-medium text-foreground">{node.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{node.hint}</p>
                    {index < 3 ? (
                      <ArrowRight className="absolute -right-[14px] top-1/2 hidden size-3.5 -translate-y-1/2 text-border-strong sm:block" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <DashboardMock />
          </div>
        </section>

        <section id="faq" className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8 sm:py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Questions shop owners ask first
          </h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {FAQS.map((item) => (
              <div key={item.q} className="py-5">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{item.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">
                Set up my counter
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/station/$stationId/display" params={{ stationId: DEMO_STATION }}>
                See the counter screen
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface-muted/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Logo size="sm" />
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted-foreground">
              QR-powered printing for stationery stores, colleges, libraries and print centres.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <StatusDot tone="online" pulse />
              All systems operational
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-xs sm:grid-cols-3">
            <div>
              <p className="font-medium text-foreground">Product</p>
              <ul className="mt-2.5 space-y-2 text-muted-foreground">
                <li>
                  <a href="#how-it-works" className="hover:text-foreground">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#why" className="hover:text-foreground">
                    Why shops use it
                  </a>
                </li>
                <li>
                  <Link to="/login" className="hover:text-foreground">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Support</p>
              <ul className="mt-2.5 space-y-2 text-muted-foreground">
                <li>
                  <a href="#faq" className="hover:text-foreground">
                    FAQ
                  </a>
                </li>
                <li>
                  <Link to="/station/$stationId/display" params={{ stationId: DEMO_STATION }} className="hover:text-foreground">
                    Counter demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Legal</p>
              <ul className="mt-2.5 space-y-2 text-muted-foreground">
                <li>
                  <Link to="/privacy" className="hover:text-foreground">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="hover:text-foreground">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-5 text-xs text-muted-foreground sm:px-8">
            © {new Date().getFullYear()} QuickPrint · Cash collected at the counter
          </div>
        </div>
      </footer>
    </div>
  );
}
