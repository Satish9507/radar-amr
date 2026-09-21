# Risk Quotient (RQ) — Methodology

## Overview

The Risk Quotient module estimates the ecological and antimicrobial resistance risk posed by chemical contaminants measured in environmental water samples. Each compound is assessed against two regulatory benchmarks: an ecological toxicity threshold (PNEC_Eco) and an antimicrobial resistance selection threshold (PNEC_AMR).

---

## Core Formula

For each measured compound at each sampling site:

```
RQ = MEC / PNEC
```

Where:
- **MEC** — Measured Environmental Concentration (from the uploaded file, in ng/L)
- **PNEC** — Predicted No-Effect Concentration (from the RADAR compound reference database)

Two RQ values are calculated per compound per sample:

| Output | Formula | Interpretation |
|--------|---------|----------------|
| **RQ_Eco** | MEC / PNEC_Eco | Risk of ecological toxicity to aquatic organisms |
| **RQ_AMR** | MEC / PNEC_AMR | Risk of selecting for antimicrobial resistance in the environment |

---

## Risk Classification

| RQ Value | Risk Level | Interpretation |
|----------|-----------|----------------|
| < 0.1 | **Low Risk** | MEC well below threshold; negligible risk |
| 0.1 – 1 | **Moderate Risk** | MEC approaching threshold; monitor closely |
| 1 – 10 | **High Risk** | MEC exceeds threshold; risk present, action advised |
| ≥ 10 | **Very High Risk** | MEC substantially exceeds threshold; immediate attention required |

---

## PNEC Reference Values

PNEC values are sourced from peer-reviewed literature and stored in the RADAR compound database. Values are compound-specific and cover two risk dimensions:

- **PNEC_Eco** — derived from ecotoxicological studies (LC50, NOEC) on aquatic organisms, applying appropriate assessment factors
- **PNEC_AMR** — derived from the minimum antibiotic concentration that selects for resistance in environmental microbial communities (EUCAST/EMEA thresholds where available)

The database currently contains **34 compounds** across 7 classes:

| Class | Compounds |
|-------|-----------|
| Antibiotics | Lincomycin, Clindamycin, Ciprofloxacin, Enrofloxacin, Erythromycin-H2O, Azithromycin, Clarithromycin |
| Antimicrobial Personal Care | Triclocarban, Triclosan |
| UV Filters / Industrial | Benzophenone-3, Bisphenol A |
| Pharmaceuticals | Atenolol, Sulpiride, Carbamazepine, Salicylic Acid, Lopinavir, Gemfibrozil |
| Food Additives | Caffeine, Cyclamate, Saccharin |
| Insect Repellents / Pesticides | DEET, Fipronil, Fipronil Desulfinyl, Fipronil Sulfide, Fipronil Sulfone |
| Quaternary Ammonium Compounds | BDDACI, Benzethonium Chloride, DDACI |
| Heavy Metals | Arsenic, Chromium, Cadmium, Copper, Lead, Zinc |

---

## Unit Handling

The tool accepts input concentrations in **ng/L**, **μg/L**, or **mg/L**. All values are converted to a common unit (μg/L) before the RQ calculation to ensure consistency when the PNEC is expressed in a different unit.

Conversion factors:
- ng/L × 0.001 = μg/L
- mg/L × 1000 = μg/L

---

## Input Template Structure

| Row | Content |
|-----|---------|
| Row 1 | Units row — blank for fixed columns, `ng/L` for compound columns |
| Row 2 | Headers — fixed columns + `Compound Name (CODE)` format |
| Row 3+ | Data rows |

Fixed columns (required): `Sample_ID`, `Site`, `Month`, `Date`, `Category`, `Sub_category`

Compound columns: one column per compound, header format must be `Name (CODE)` e.g. `Ciprofloxacin (CIPX)`. The tool identifies the compound by the code in parentheses — name mismatches are tolerated.

---

## Calculation Steps (per sample row, per compound column)

1. Read MEC from the uploaded file; read unit from row 1
2. Convert MEC to the compound's preferred calculation unit (μg/L)
3. Look up PNEC_Eco and PNEC_AMR from the compound reference database by compound code
4. Calculate RQ_Eco = MEC_converted / PNEC_Eco
5. Calculate RQ_AMR = MEC_converted / PNEC_AMR
6. Assign risk label (Low / Moderate / High) based on the thresholds above
7. If PNEC is missing for a compound code, flag as "No PNEC" rather than fail the row

Rows with blank MEC are silently skipped (not all samples need all compounds measured).

---

## Limitations

- RQ is a screening-level tool; it does not account for mixture toxicity, bioavailability, or seasonal variation
- PNEC values for AMR endpoints are less established than ecological PNECs; they carry higher uncertainty
- Heavy metals assessed against aquatic toxicity thresholds only; no AMR-specific PNEC available for all metals
- The tool does not account for background concentrations or cumulative loading across sites

---

## Primary Reference

Tran, N.H., Reinhard, M., & Gin, K.Y.H. (2018). Occurrence and fate of emerging contaminants in municipal wastewater treatment plants from different geographical regions — a review. *Water Research*, 133, 182–207.

Additional PNEC sources: EUCAST clinical breakpoints; EMEA/CHMP/SWP/4447/00 guideline on environmental risk assessment of medicinal products; Bengtsson-Palme & Larsson (2016), *Environment International* 86, 140–149.
