# EtOH WD — Bedside Tool

A mobile-first, offline-capable **Progressive Web App** that takes a clinician
from suspicion of unhealthy alcohol use through screening, prediction of severe
withdrawal, active-withdrawal monitoring, sedation depth, treatment dosing, and
discharge / long-term AUD management.

- **Mobile-first.** Designed for one-thumb use at the bedside.
- **Suggests the next best score / action** based on entered context.
- **All scores in-app**, with explicit interpretations and citations.
- **Medication dosing built-in** (ASAM 2020 with side-by-side alternatives:
  phenobarbital, dexmedetomidine, ketamine, propofol, MAT options).
- **Patient-specific modifiers** — cirrhosis, age ≥65, pregnancy, opioid/benzo
  co-use change the dosing display.
- **ASCII chart-note builder** with a one-tap **Copy** button for pasting into
  any EMR. Trend sparkline included.
- **Don't-forget panel** organized by admission / pharm / co-morbidity /
  discharge.
- **Works offline.** Manifest + service worker cache the full shell.

## Live

If GitHub Pages is enabled for this repo, the app is served from the repo's
Pages URL (e.g. `https://<owner>.github.io/<repo>/`).

To install on a phone, open the page in mobile Safari (iOS) or Chrome
(Android), then **Add to Home Screen**. The icon launches into a full-screen
standalone PWA that continues to work without network.

## Scores included

| Category | Scores |
| --- | --- |
| Screening / longitudinal | AUDIT, AUDIT-C, CAGE, DSM-5 AUD |
| Hospitalized risk prediction | PAWSS |
| Active withdrawal | CIWA-Ar, GMAWS, MINDS |
| Sedation / agitation | RASS, SAS |
| Delirium / mental status | CAM-ICU, GCS |

## Evidence sources

Every score links out to its primary citation in-app. Highlights:

- **AUDIT** — Saunders 1993; WHO 2nd edition, 2001
- **AUDIT-C** — Bush, *Arch Intern Med* 1998
- **CAGE** — Ewing, *JAMA* 1984
- **DSM-5 AUD** — NIAAA / American Psychiatric Association
- **PAWSS** — Maldonado, *Alcohol* 2014; *Alcohol Alcohol* 2015
- **CIWA-Ar** — Sullivan, *Br J Addict* 1989
- **GMAWS** — McPherson 2012; NHS GG&C protocol
- **MINDS** — DeCarolis, *Pharmacotherapy* 2007
- **RASS** — Sessler, *Am J Respir Crit Care Med* 2002
- **SAS** — Riker, *Crit Care Med* 1999
- **CAM-ICU** — Ely, *JAMA* 2001; icudelirium.org
- **GCS** — Teasdale & Jennett, *Lancet* 1974

Treatment dosing draws from the **ASAM 2020 Clinical Practice Guideline on
Alcohol Withdrawal Management** with alternatives from Rosenson (*J Emerg Med*
2013), Mueller (*Crit Care Med* 2014), and the **VA/DoD SUD CPG (2021)** and
**SAMHSA TIP 49** for long-term pharmacotherapy.

## Privacy

- No analytics. No network calls. No user accounts.
- A single in-progress patient's entries are kept in `localStorage` and cleared
  with the **New pt** button or by uninstalling the PWA.
- The tool is decision-support — not a substitute for clinical judgement, and
  not a regulated medical device.

## Local development

This is a static site — no build step.

```
python3 -m http.server 8080
# then visit http://localhost:8080/
```

To verify changes without a browser:

```
node --check app.js
```

## Deployment

A workflow at `.github/workflows/pages.yml` publishes the repo root to GitHub
Pages on every push to the default branch (and to the feature branch where it
is being developed). After the first run, enable Pages in repo settings →
*Pages* → *Source: GitHub Actions*.

## License

MIT — see `LICENSE`.
