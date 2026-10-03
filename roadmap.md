# QuickPrint roadmap

## Done
- [x] Backend schema: stations, profiles, user_roles, printers, agent_devices, qr_sessions, print_jobs, pricing_rules, audit_logs
- [x] Private storage bucket `print-files` (10MB, PDF only)
- [x] Security-definer helpers moved to private schema
- [x] Email + Google sign-in enabled
- [x] Design system (Inter, monochrome + restrained blue accent)
- [x] Public print server functions: QR rotation, session validation, signed upload, PDF page count, server-side pricing, idempotent submit, job status

## Next
- [ ] Schema additions for agent integration: DOWNLOADING status, agent heartbeat fields
      (hostname, agent_version, printer_status), printer model/defaults, realtime publication
- [ ] Agent API routes /api/public/print-agent/{heartbeat,jobs,jobs/:id/claim,jobs/:id/status}
      with atomic FIFO claim (no two agents on one job) + signed download URL
- [ ] Owner dashboard server functions (overview, jobs, pricing, settings, agent token, demo agent)
- [ ] Routes: landing /, /login, /station/$stationId/display, /print/session/$token, /print/job/$jobId
- [ ] Premium dashboard: sticky sidebar, overview, jobs, qr, printer, pricing, history, settings
      (Linear/Vercel-grade craft: 12-16px radii, soft shadows, micro-interactions, Lucide)
- [ ] Realtime job status updates on dashboard + student status screen
- [ ] Demo Print Agent simulation (QUEUED → DOWNLOADING → PRINTING → COMPLETED), clearly labelled
- [ ] Agent setup doc in dashboard: SumatraPDF silent print command construction, no browser printing
