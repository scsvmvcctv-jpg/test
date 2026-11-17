# SCSVMV Log Book — POC Documentation

This folder contains the **Proof of Concept (POC) user guide** and screenshots for the faculty logbook application.

## Files

| File | Description |
|------|-------------|
| [POC_USER_GUIDE.md](./POC_USER_GUIDE.md) | Complete user manual for all modules (with screenshots) |
| [POC_USER_GUIDE.pdf](./POC_USER_GUIDE.pdf) | PDF export of the user guide (for distribution) |
| [screenshots/](./screenshots/) | 16 application screenshots (01–16) |
| [capture-log.txt](./capture-log.txt) | Last screenshot capture run log |

## Screenshot index

| File | Module |
|------|--------|
| 01-login-staff.png | Staff login |
| 02-login-supervisor.png | Supervisor login |
| 03-officer-login.png | Officer (HOD/Dean) login |
| 04-admin-login.png | Admin portal login |
| 05-forgot-password.png | Forgot password |
| 06-dashboard.png | Faculty dashboard |
| 07-workload.png | Workload |
| 08-lecture-plan.png | Lecture plan |
| 09-tests.png | Tests |
| 10-assignments.png | Assignments |
| 11-extra-classes.png | Extra classes |
| 12-theory-assessment.png | Theory assessment |
| 13-practical-assessment.png | Practical assessment |
| 14-inspections.png | Inspections |
| 15-profile.png | Profile |
| 16-admin-dashboard.png | Admin / HOD dashboard |

## Regenerating screenshots

### Local (automated)

1. Start the app: `npm run dev`
2. Run:

```bash
npm run poc:screenshots
```

This uses **mock login** (`demo` / `mock-password-123`) for staff module screenshots. For the admin dashboard screenshot, set officer credentials:

```bash
POC_ADMIN_USER=your_officer_id POC_ADMIN_PASSWORD=your_password npm run poc:screenshots
```

### Production site

Use real staff credentials:

```bash
POC_BASE_URL=https://logbook.kanchiuniv.ac.in \
POC_USER=your_staff_id \
POC_PASSWORD=your_password \
POC_ADMIN_USER=your_officer_id \
POC_ADMIN_PASSWORD=your_officer_password \
npm run poc:screenshots
```

### Manual login

If automated login fails, open a visible browser and sign in yourself:

```bash
POC_HEADLESS=0 POC_MANUAL_LOGIN=1 POC_LOGIN_WAIT_MS=180000 npm run poc:screenshots
```

## Production URL

- **Live app:** https://logbook.kanchiuniv.ac.in
- **GitHub:** https://github.com/scsvmvcctv-jpg/test

## Export to PDF

A ready-made PDF is included: **[POC_USER_GUIDE.pdf](./POC_USER_GUIDE.pdf)**

To regenerate after editing the guide:

```bash
cd docs/poc && npx md-to-pdf POC_USER_GUIDE.md
```
