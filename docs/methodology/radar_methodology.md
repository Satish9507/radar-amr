# RADAR Score — Methodology

## Overview

The RADAR Score is a multi-criteria integration framework that combines outputs from three independent AMR risk modules — QMRA, CAMRI, and RQ — into a single normalised composite risk score per water sample. Each module captures a different dimension of AMR risk:

- **QMRA** — direct human health risk from antibiotic-resistant bacteria (ARB), expressed as DALYs/year
- **CAMRI** — environmental AMR genetic load, expressed as the normalised Resistance Index (ℜ_ARG)
- **RQ** — chemical AMR selection pressure from PPCPs, expressed as Risk Quotients relative to PNEC thresholds

Without integration, a site scoring high on one metric but low on others may be misclassified. The RADAR Score resolves this by weighting all three dimensions into one composite value, enabling cross-site and cross-time comparison of overall AMR risk.

---

## Core Formula

```
RADAR Score = (W_A × S_ARB) + (W_B × S_ARG) + (W_C × S_PPCP)
```

Where:

| Variable | Description | Source Module |
|----------|-------------|---------------|
| **S_ARB** | Normalised ARB Score ∈ [0, 1] | QMRA |
| **S_ARG** | Normalised ARG Score ∈ [0, 1] | CAMRI |
| **S_PPCP** | Normalised PPCP Score ∈ [0, 1] | RQ |
| **W_A** | Weight for ARB component | User-adjustable (default 0.50) |
| **W_B** | Weight for ARG component | User-adjustable (default 0.30) |
| **W_C** | Weight for PPCP component | User-adjustable (default 0.20) |

Constraint: **W_A + W_B + W_C = 1.0** at all times.

Default weights are indicative, based on the RADAR framework presentation and team discussion (ARB ~40–50%, ARG ~30–35%, Chemicals ~20%).

---

## Component A — ARB Score (S_ARB)

**Source:** QMRA module → DALYs/year per sample

**Aggregation across pathogens:**

A QMRA file typically contains multiple rows per site+date (one per pathogen × endpoint combination). All DALYs for the same site+date are summed before normalisation:

```
total_DALY(site, date) = Σ DALY_i   for all pathogens i at that site+date
```

**Normalisation:**

The WHO benchmark for acceptable microbial risk is 10⁻⁶ DALYs/person/year. The score maps linearly to this reference:

```
S_ARB = min(total_DALY / 1e-6, 1.0)
```

| total DALYs | S_ARB |
|-------------|-------|
| 1×10⁻⁷ | 0.1 |
| 1×10⁻⁶ | 1.0 (at the threshold) |
| > 1×10⁻⁶ | 1.0 (capped) |

**Scientific basis:** WHO Guidelines for Drinking-water Quality (GDWQ, 4th edition) establish 10⁻⁶ DALYs/person/year as the tolerable burden of disease from waterborne pathogens.

---

## Component B — ARG Score (S_ARG)

**Source:** CAMRI module (ARG file only) → ℜ_ARG per sample

**Why ARG only (not ℜ_AMR):**

CAMRI's combined score ℜ_AMR internally weights both the ARB track (ℜ_ARB) and the ARG track (ℜ_ARG). Using ℜ_AMR in the RADAR formula would double-count the ARB signal — once via W_A (QMRA-DALY) and again partially inside W_B. To avoid this, only the ARG sub-score is used for Component B.

**No additional normalisation required:**

ℜ_ARG is already normalised to [0, 1] by the CAMRI calculator.

```
S_ARG = ℜ_ARG   (used directly)
```

---

## Component C — PPCP Score (S_PPCP)

**Source:** RQ module → per-compound AMR_RQ and ECO_RQ per sample

**Two RQ types per compound:**

| RQ Type | Definition |
|---------|------------|
| **AMR_RQ** | MEC / PNEC_AMR — resistance-based: risk of AMR selection pressure in the environment |
| **ECO_RQ** | MEC / PNEC_Eco — ecological: risk of harm to aquatic organisms |

Both are included because they capture complementary hazards. Either may dominate depending on the compound class (e.g. antibiotics typically drive AMR_RQ; heavy metals typically drive ECO_RQ).

---

## PPCP Aggregation Method

Aggregation is a three-step process, applied per sample:

**Step 1 — Per compound, take the higher of the two RQ types:**

```
RQ_compound = max(AMR_RQ_compound, ECO_RQ_compound)
```

**Step 2 — Sum across all compounds (Mixture Risk Quotient / Hazard Index):**

```
MRQ(site, date) = Σ RQ_compound_i   for all compounds at that site+date
```

**Step 3 — Normalise by capping at 1.0:**

```
S_PPCP = min(MRQ, 1.0)
```

**Why sum (Hazard Index), not max:**

The Concentration Addition principle (Hazard Index method) is the standard approach recommended by the EPA and European Environment Agency. Sub-threshold compounds can collectively exceed the threshold — the "cocktail effect" that a maximum-only approach would miss. Using max RQ is appropriate only for screening-level assessments; the Hazard Index is the correct method for a composite risk score.

> Bengtsson-Palme & Larsson (2016) and Tran et al. (2018) both apply the additive RQ approach for mixture risk in aquatic systems. EPA Cumulative Risk Assessment guidance defines the Hazard Index as the sum of compound-specific hazard quotients.

---

## Weight Handling and Redistribution

**Default weights:**

| Weight | Module | Default |
|--------|--------|---------|
| W_A | QMRA (ARB Score) | 0.50 |
| W_B | CAMRI ARG (ARG Score) | 0.30 |
| W_C | RQ (PPCP Score) | 0.20 |

Weights are user-adjustable on the RADAR page. The UI enforces W_A + W_B + W_C = 1.0 at all times.

**Missing module redistribution:**

If a module file is not uploaded, its weight redistributes proportionally among the provided modules:

```
W_i_adjusted = W_i / (Σ W_present)   for each present module i
```

Example — RQ file absent (W_C = 0.20 missing):

| Weight | Original | Adjusted |
|--------|----------|----------|
| W_A | 0.50 | 0.50 / 0.80 = **0.625** |
| W_B | 0.30 | 0.30 / 0.80 = **0.375** |
| W_C | 0.20 | **0** (module absent) |

The per-sample output reports the actual `w_a_used`, `w_b_used`, `w_c_used` values so results remain auditable.

**Minimum requirement:** At least 2 of the 3 module files must be provided. Fewer than 2 blocks calculation.

---

## Sample Matching Logic

The three modules use **Site + Date** as the common key to match results.

| Module | Input rows | Aggregation to one value per Site+Date |
|--------|-----------|----------------------------------------|
| QMRA | Multiple rows per site+date (one per pathogen × endpoint) | Sum all DALYs |
| CAMRI ARG | One value per sample (column header = sample name) | Direct — ℜ_ARG already per sample |
| RQ | Multiple rows per site+date (one per compound) | Sum of max(AMR_RQ, ECO_RQ) per compound |

The RADAR Score is computed only for site+date combinations present in all uploaded modules. If a site+date is present in one module but absent from another, only the available components contribute, with weights redistributed.

**Note:** CAMRI ARG input file column headers (sample names) must match the Site values used in QMRA and RQ files. Mismatched names produce unmatched samples; these are listed in response warnings.

---

## Output Structure

### Per-Sample Output

For each matched site+date:

| Field | Description |
|-------|-------------|
| `site` | Site name |
| `date` | Sample date |
| `daly_raw` | Total DALYs/yr before normalisation |
| `s_arb` | Normalised ARB Score ∈ [0, 1] |
| `r_arg_raw` | Raw ℜ_ARG from CAMRI |
| `s_arg` | ARG Score (= ℜ_ARG directly) |
| `mixture_rq_raw` | Sum of max RQ per compound before cap |
| `s_ppcp` | Normalised PPCP Score ∈ [0, 1] |
| `w_a_used` | Actual W_A after redistribution |
| `w_b_used` | Actual W_B after redistribution |
| `w_c_used` | Actual W_C after redistribution |
| `radar_score` | Final RADAR Score ∈ [0, 1] |
| `risk_tier` | Negligible / Low / Moderate / High |
| `modules_used` | Which modules contributed, e.g. `["QMRA", "CAMRI"]` |

### Site-Level Rollup

For each unique site, the API returns a summary computed as the mean RADAR Score across all sample dates:

```
RADAR_site = mean(radar_score_i)   for all dates i at that site
```

The site rollup also includes mean S_ARB, S_ARG, S_PPCP values and the site-level risk tier.

---

## Risk Tiers

| Tier | RADAR Score Range | Colour |
|------|-------------------|--------|
| **Negligible** | 0.00 – 0.25 | Green (#059669) |
| **Low** | 0.25 – 0.50 | Blue (#0EA5E9) |
| **Moderate** | 0.50 – 0.75 | Amber (#D97706) |
| **High** | 0.75 – 1.00 | Red (#DC2626) |

Thresholds mirror the QMRA risk tier colour scheme for visual consistency across modules.

---

## Upload Requirements

| Upload Zone | File | Required? |
|-------------|------|-----------|
| QMRA Results | QMRA Excel (.xlsx / .xls) | Optional |
| CAMRI ARG Results | ARG-only Excel (.xlsx / .xls) | Optional |
| RQ Results | RQ Excel (.xlsx / .xls) | Optional |

- At least 2 of the 3 files must be provided to enable calculation.
- The **CAMRI ARB file is not used** on the RADAR page. ARB risk is captured via QMRA-DALY. Users wanting the full ARB+ARG combined ℜ_AMR analysis should use the CAMRI module.
- Each uploaded file is processed internally through its respective calculator. Pre-running the individual modules is not required.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| DALYs = 0 for a sample | S_ARB = 0.0 (valid — no modelled risk) |
| DALYs > 1e-6 | S_ARB capped at 1.0; raw value shown in output |
| All compound RQs < 0.01 | S_PPCP ≈ 0 |
| MRQ (sum) > 1.0 | S_PPCP capped at 1.0; raw MRQ shown in output |
| ℜ_ARG = 0 | S_ARG = 0.0 (no resistance genes detected above threshold) |
| Site present in one module but absent from another | Missing component treated as absent; weights redistributed |
| Only 1 module file uploaded | Blocked at UI — "Upload at least 2 module files" |
| Site name mismatch between modules | That site+date excluded; listed in warnings with the mismatched name |
| CAMRI ARB file uploaded to RADAR page | Ignored; tooltip shown explaining ARB is handled via QMRA |
| A module returns a calculation error | That module treated as absent; weight redistributed; excluded rows listed in a processing errors banner on the results page |

---

## Limitations

- RADAR Score is a screening-level integration tool; it does not replace individual module outputs for detailed interpretation
- S_ARG (ℜ_ARG) uses min-max normalisation within the uploaded dataset, making it dataset-relative; cross-dataset comparison of the ARG component alone should be treated with caution
- S_ARB normalisation against the WHO 10⁻⁶ benchmark assumes DALY estimates from the QMRA module are accurate; QMRA model uncertainty propagates into the RADAR Score
- Weight defaults are indicative; they are not yet derived from a formal sensitivity analysis or expert elicitation
- Chemical mixture toxicity (Component C) assumes concentration addition (linear additivity); synergistic or antagonistic interactions between compounds are not modelled

---

## Primary References

**RADAR Framework:**
Internal team presentation — *Framework for Multicriteria RADAR: Multi-Criteria Integration of AMR Risk Scores* (2026)

**Mixture Risk Quotient (Hazard Index method):**
U.S. EPA (2000). *Supplementary Guidance for Conducting Health Risk Assessment of Chemical Mixtures*. EPA/630/R-00/002.

Bengtsson-Palme, J., & Larsson, D.G.J. (2016). Concentrations of antibiotics predicted to select for resistant bacteria: Proposed limits for environmental regulation. *Environment International*, 86, 140–149.

**QMRA-DALY benchmark:**
WHO (2022). *Guidelines for Drinking-water Quality*, 4th edition incorporating the 1st and 2nd addenda. Geneva.

**MCDA integration framework:**
Burnham, J.P., et al. (2019). A multi-criteria decision analysis-based framework for AMR risk assessment in environmental settings. *JAC-Antimicrobial Resistance*.

**Waterborne AMR Exposure Index:**
Khan, S., et al. (2024). Mapping biological and chemical dimensions of waterborne AMR exposure. *Water Research*.
