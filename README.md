# QuickPrint

Build a production-quality SaaS web application called "QuickPrint" for a QR-based stationery printing system.

IMPORTANT:

This is NOT just a marketing website. Build the actual functional web application UI, navigation, database-ready architecture, authentication-ready structure, QR session system, print-job workflow, pricing system, and admin dashboard.

The product solves this problem:

A stationery shop has a computer connected to a physical printer. A QR code is displayed physically at the stationery counter. The QR code automatically refreshes every 60 seconds so students cannot take a photo of the QR and repeatedly submit print jobs from classrooms or elsewhere.

A student must physically be at the stationery to scan the currently active QR code.

After scanning:

1. Student opens the mobile print interface.

2. The system validates the temporary QR session.

3. Student uploads a PDF.

4. System detects the PDF page count.

5. Student selects required printing options.

6. System calculates the price.

7. Student submits the print job.

8. The print job enters the stationery printer queue.

9. The Windows Print Agent running on the stationery PC receives the job.

10. The agent downloads the PDF and sends it to the configured physical printer automatically.

11. The job status changes from QUEUED → PRINTING → COMPLETED.

12. Student sees confirmation that the print job has completed.

13. The job is then closed.

The Windows Print Agent is a separate local application and should NOT be implemented as browser printing. Design the web application so the agent can later communicate through a secure API/realtime mechanism.

==================================================

DESIGN DIRECTION

==================================================

Create a minimal, premium, professional SaaS interface.

Visual style:

- Modern SaaS

- Minimal

- Clean

- Professional

- Apple-inspired simplicity

- Lots of whitespace

- Subtle borders

- Soft shadows

- Rounded cards

- Premium typography

- Inter or similar modern font

- Light theme as default

- Very subtle gray/blue accent

- Avoid excessive gradients

- Avoid flashy animations

- Avoid unnecessary illustrations

- Use Lucide icons

- Excellent mobile responsiveness

- Accessibility-focused

- Fast-loading UI

The interface should look like a serious B2B SaaS product, not a college project.

==================================================

APPLICATION STRUCTURE

==================================================

Create these major areas:

1. Public Station QR Display

2. Student Print Interface

3. Print Job Status

4. Stationery Owner Dashboard

5. Printer Management

6. Pricing Management

7. Print Job Management

8. QR Session Management

9. Settings

==================================================

1. STATION QR DISPLAY

==================================================

Create a dedicated fullscreen route:

/station/:stationId/display

This page is intended to be displayed on a monitor/tablet at the stationery counter.

Design:

Top:

QuickPrint logo

Stationery name

Online indicator

Center:

Large dynamically generated QR code

Below QR:

"Scan to Print"

Show:

"QR refreshes in 00:47"

Create a visible circular countdown indicator.

The QR must represent a short-lived print session.

Do NOT use a permanent QR URL.

Every 60 seconds:

- Generate a new secure session token

- Invalidate the previous token

- Generate a new QR

- Reset countdown

Show subtle transition when the QR changes.

Display:

"Only scan the QR displayed at the stationery counter."

Include a small security explanation:

"QR refreshes automatically to prevent remote print submissions."

The page should continue functioning automatically without user interaction.

==================================================

2. QR SESSION LOGIC

==================================================

Create a session model conceptually:

qr_sessions:

- id

- station_id

- token

- created_at

- expires_at

- status

- max_jobs

- jobs_used

A session should:

- Be active for 60 seconds

- Automatically expire

- Be replaced by a new session

- Allow configurable maximum print jobs

- Reject expired tokens

- Reject invalid tokens

Never expose printer credentials or secret keys in the QR.

QR should contain only a public short-lived session URL such as:

/print/session/{temporary-token}

The backend must validate the token.

==================================================

3. STUDENT PRINT PAGE

==================================================

Route:

/print/session/:token

When opened:

First validate the session.

If valid:

Show:

QUICKPRINT

Stationery:

"ABC Stationery"

Status:

"● Session Active"

Countdown:

"Expires in 42 seconds"

Then show upload area.

Upload card:

"Upload your PDF"

Drag and drop area.

Button:

"Choose PDF"

Supported format:

PDF

Maximum file size:

10MB initially.

After upload:

- Show filename

- Show file size

- Detect page count

- Show PDF preview thumbnail if possible

- Allow replacing the PDF

Do not allow submission if the session has expired.

==================================================

4. PRINT OPTIONS

==================================================

After PDF upload show a clean configuration card.

Options:

Copies:

[-] 1 [+]

Color:

○ Black & White

○ Color

Sides:

○ Single-sided

○ Double-sided

Paper:

○ A4

○ A3

Page range:

○ All pages

○ Custom range

If custom range:

Show input:

"Example: 1-5, 8, 10-12"

Validate page ranges.

Only display options configured as available for that station.

==================================================

5. PRICE CALCULATION

==================================================

Create a real-time pricing summary.

Example:

Document

assignment.pdf

Pages

8

Copies

2

Print

Black & White

Sides

Single-sided

Paper

A4

--------------------------------

Subtotal

₹32

Total

₹32

The price MUST be calculated server-side.

Never trust a price sent by the browser.

Create pricing configuration per stationery.

Example pricing:

A4:

B&W single = ₹2/page

B&W double = ₹1.50/page

Color single = ₹10/page

Color double = ₹8/page

A3:

B&W single = ₹5/page

B&W double = ₹4/page

Color single = ₹15/page

Color double = ₹12/page

These are sample defaults only and must be editable by the stationery owner.

==================================================

6. SUBMIT PRINT

==================================================

Large primary button:

"Submit Print Job"

Before submission show:

"You will be charged/asked to pay ₹32 for this print job."

Since V1 is cash/manual collection, use:

"Pay at Counter"

Do NOT integrate online payment yet.

The stationery owner will collect the amount manually.

When submitted:

Create print job:

print_jobs:

- id

- station_id

- session_id

- file_url

- filename

- page_count

- copies

- color_mode

- duplex

- paper_size

- page_range

- amount

- status

- created_at

- started_at

- completed_at

- error_message

Initial status:

QUEUED

==================================================

7. PRINT JOB STATUS

==================================================

After submission show a beautiful status screen.

Example:

Print Job #QP-10482

assignment.pdf

8 pages × 2 copies

₹32

Status timeline:

✓ Submitted

  11:42 AM

● Queued

  Waiting for printer

○ Printing

○ Completed

The status should update automatically.

When the Windows Print Agent starts:

QUEUED → PRINTING

When completed:

PRINTING → COMPLETED

If failed:

→ FAILED

Show a friendly error message.

==================================================

8. PRINT AGENT INTEGRATION

==================================================

The website must be designed around a separate Windows Print Agent.

The agent will run on the stationery PC.

Architecture:

Student

↓

Web App

↓

Backend

↓

Print Job

↓

Windows Print Agent

↓

Physical Printer

The agent should authenticate as a specific printer/station.

Create an API-ready structure:

POST /api/print-agent/heartbeat

GET /api/print-agent/jobs

POST /api/print-agent/jobs/:jobId/claim

POST /api/print-agent/jobs/:jobId/status

The exact implementation can use Supabase Realtime or secure API endpoints.

The agent must only receive jobs belonging to its assigned station/printer.

Never expose the agent secret to the browser.

==================================================

9. ADMIN / STATIONERY OWNER DASHBOARD

==================================================

Create a professional dashboard:

/dashboard

Sidebar:

Overview

Print Jobs

QR Display

Printer

Pricing

History

Settings

Top bar:

Station name

Printer status

Profile

Settings

Overview cards:

Today's Jobs

Today's Pages

Today's Revenue

Current Queue

Printer status card:

🟢 Printer Online

or

🔴 Printer Offline

Current queue:

#10482

assignment.pdf

8 pages

₹32

PRINTING

#10483

notes.pdf

4 pages

₹8

QUEUED

==================================================

10. PRINT JOB MANAGEMENT

==================================================

Create a full jobs table.

Columns:

Job ID

Document

Pages

Copies

Options

Amount

Status

Created

Actions

Filters:

All

Queued

Printing

Completed

Failed

Search by:

Job ID

Filename

Clicking a job opens details.

==================================================

11. PRICING MANAGEMENT

==================================================

Create an elegant pricing configuration page.

Sections:

A4

B&W Single

B&W Double

Color Single

Color Double

A3

B&W Single

B&W Double

Color Single

Color Double

Each has editable price.

Also allow toggling availability:

A4:

✓ Enabled

A3:

✓ Enabled

Color:

✓ Enabled

Double-sided:

✓ Enabled

Changes should be saved per station.

==================================================

12. QR DISPLAY MANAGEMENT

==================================================

Dashboard page:

QR Display

Current session:

Active

Expires in:

00:43

[ Open Fullscreen Display ]

Session duration:

[ 60 seconds ]

Maximum jobs per session:

[ 3 ]

Security:

✓ Expired QR sessions rejected

✓ Previous QR invalidated

✓ Rate limiting enabled

Allow the owner to configure:

- QR refresh duration

- Maximum jobs per session

Default:

60 seconds

3 jobs

==================================================

13. SECURITY

==================================================

Implement the application with security as a first-class concern.

Requirements:

- Short-lived QR tokens

- Server-side session validation

- Expired session rejection

- Rate limiting

- File size limits

- PDF-only uploads initially

- Secure file storage

- Never expose service-role keys

- Printer agent authentication

- Row-level security

- Server-side price calculation

- Prevent duplicate print jobs

- Idempotency key for job submission

- Automatic job expiration

- Audit logs

Do not allow students to access the admin dashboard.

==================================================

14. ADMIN AUTHENTICATION

==================================================

Create authentication-ready owner login.

Routes:

/login

/dashboard

Owner authentication using Supabase Auth.

Roles:

OWNER

STAFF

ADMIN

Students do not need accounts for V1.

Student flow should be:

Scan → Upload → Configure → Submit

No signup.

==================================================

15. DATABASE

==================================================

Prepare Supabase database schema for:

stations

users

printers

qr_sessions

print_jobs

pricing_rules

agent_devices

audit_logs

Relationships:

station

→ printer

→ pricing rules

→ QR sessions

→ print jobs

printer

→ agent device

→ print jobs

==================================================

16. UI STATES

==================================================

Design all important states.

Loading:

"Preparing your print session..."

Uploading:

"Uploading PDF..."

Processing:

"Analyzing document..."

Queued:

"Your document is queued."

Printing:

"Your document is printing."

Completed:

"Print completed. Collect your document at the counter."

Failed:

"Something went wrong while printing."

Expired QR:

"This QR session has expired."

Show:

"Please scan the latest QR displayed at the stationery."

Invalid session:

"This print session is no longer valid."

Printer offline:

"Printer is currently offline. Your job will remain queued."

==================================================

17. MOBILE-FIRST STUDENT EXPERIENCE

==================================================

The student interface is the most important part.

Optimize specifically for:

Android phones

iPhones

Large buttons.

Large upload area.

Minimal typing.

Clear pricing.

Fast loading.

Student should be able to complete:

Scan QR

→ Upload

→ Select options

→ See amount

→ Submit

in under one minute.

==================================================

18. RESPONSIVE ADMIN EXPERIENCE

==================================================

Desktop-first dashboard.

Mobile responsive.

Use:

- Clean sidebar

- Cards

- Tables

- Status badges

- Charts only where useful

- No excessive visual decoration

==================================================

19. LANDING PAGE

==================================================

Also create a minimal SaaS landing page at:

/

Headline:

"Print from anywhere. Submit only when you're there."

Subheadline:

"QR-powered printing for modern stationery stores, colleges, libraries, and print centers."

CTA:

"Get Started"

Secondary CTA:

"View Demo"

Show simple 3-step explanation:

01

Scan the QR

02

Upload & customize

03

Collect your prints

Include a simple architecture visual:

Student

→ QR

→ Print Queue

→ Printer

Do not make the landing page overly marketing-heavy.

==================================================

20. DEMO MODE

==================================================

Because the physical Windows Print Agent will be connected later, create a development/demo mode.

Allow the dashboard to simulate:

QUEUED

→ PRINTING

→ COMPLETED

with realistic timing.

Clearly label this as:

"Demo Print Agent"

Do not pretend a physical print occurred in demo mode.

==================================================

21. IMPORTANT ARCHITECTURE RULE

==================================================

Separate:

Frontend

Backend

Storage

Print Queue

Windows Print Agent

Do NOT attempt browser-based direct printing.

The actual physical printing must eventually happen through:

Windows Print Agent → Windows Printer

The web app only creates and manages print jobs.

==================================================

22. FINAL QUALITY BAR

==================================================

The result should look like a startup-ready SaaS MVP.

Prioritize:

- Excellent spacing

- Strong typography

- Clear hierarchy

- Minimal UI

- Fast workflows

- Professional empty states

- Good error states

- Smooth but subtle transitions

- Consistent component system

- Accessible contrast

- Mobile responsiveness

Do not:

- Use excessive gradients

- Use huge decorative illustrations

- Use unnecessary animations

- Create fake analytics

- Create unnecessary pages

- Make it look like a generic AI-generated dashboard

Make the product feel like a real SaaS product that could be deployed to 100 stationery shops.

Build the complete frontend experience and backend-ready architecture now.

## Repository independence

QuickPrint is intentionally independent of any app builder. The repository contains the web application, Supabase migrations, and the Windows Print Agent source. There are no required proprietary editor/runtime integrations.

For a public GitHub repository:

- Never commit `.env`, Supabase service-role keys, agent tokens, or production credentials.
- Create your own Supabase project and apply the migrations in `supabase/migrations/`.
- Set `VITE_PUBLIC_APP_URL` to the public URL students should use.
- Set server-only Supabase and cron secrets in your hosting provider.
- The Windows Print Agent is installed separately on the stationery PC.

## Development

QuickPrint is a standalone, open-source TanStack Start application. It has no dependency on Lovable or any proprietary editor/runtime. Configure your own Supabase project using `.env.example`, then run:

```sh
npm install
npm run dev
```

For production, deploy the TanStack Start application on a Node-compatible host such as Vercel and configure the same Supabase environment variables. The Windows Print Agent runs independently on the stationery PC. Never commit `.env`, service-role keys, agent tokens, or other secrets to Git.

## License

QuickPrint is released under the MIT License. See `LICENSE`.
