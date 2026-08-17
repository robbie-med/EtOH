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

## Intended use

**For use by licensed healthcare professionals.** This tool is not intended for
patient self-assessment, and not for patients or caregivers to make treatment
decisions.

It is intended to provide decision support: to display published scoring
instruments, compute their scores from clinician-entered observations, and
surface the associated guideline recommendations together with the citation
each one rests on. It is **not** intended to replace clinical judgement,
examination, or local protocol, and it is not intended to be relied on as the
primary basis for any treatment decision. Every dose must be verified against
local formulary and institutional guideline before administration.

### Provenance of the content

Scoring instruments are reproduced from the published sources listed below.
Where a severity band, treatment threshold, or dosing tier comes from a named
treatment protocol rather than from the instrument itself, that is stated at
the point of use — for example, MINDS defines no severity categories, so the
bands shown are the associated high-dose diazepam protocol's treatment tiers.

The "next best action" sequencing logic and the patient-specific dosing
modifiers are authored clinical logic, not reproductions of a validated
instrument.

### Review status

The version and content-review status are shown in-app under **About**. Until a
named, credentialed clinician has reviewed the content end to end, the app
states plainly that it is unreviewed. Guidelines change; confirm the version in
use is current.

### Regulatory status

No regulatory determination has been made for this software, and none is
asserted here. The design intent is to fall within the clinical decision
support provisions of section 520(o)(1)(E) of the US Federal Food, Drug, and
Cosmetic Act — in particular by displaying the basis for every recommendation
so that a clinician can independently review it rather than rely primarily on
the tool. Whether that intent is met is a question for regulatory counsel, and
the analysis differs outside the US (under EU/UK MDR Rule 11 software of this
kind is more likely to be classified as a medical device). Anyone deploying
this in a care setting should obtain their own regulatory and institutional
review first.

## Privacy

- No analytics. No network calls. No user accounts.
- The tool collects no name, date of birth, or other patient identifier, and
  has no free-text field. Entries are categorical (setting, age band,
  cooperation, comorbidity flags) plus computed scores.
- Nothing entered leaves the device. A single in-progress patient's entries are
  kept in `localStorage` and cleared with the **New pt** button or by
  uninstalling the PWA.

## Local development

This is a static site — no build step.

```
python3 -m http.server 3108 --bind 127.0.0.1
# then visit http://127.0.0.1:3108/
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
