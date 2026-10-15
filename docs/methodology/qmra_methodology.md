# QMRA — Quantitative Microbial Risk Assessment Methodology

## Overview

The QMRA module estimates the human health risk from exposure to pathogenic microorganisms in environmental water. It outputs probability of infection, probability of illness, and Disability-Adjusted Life Years (DALYs) per person per year. When antibiotic-resistant bacteria (ARB) concentrations are also provided, the module calculates the additional DALY burden attributable to antimicrobial resistance (dDALY).

The framework follows the WHO four-step QMRA paradigm: hazard identification → exposure assessment → dose-response → risk characterisation.

---

## Step 1 — Hazard Identification

The user specifies the **Pathogen** in each row of the input file. The tool looks up the pathogen in the RADAR pathogen database. Each pathogen has a fixed dose-response model, dose-response parameters, illness ratio, and endpoint-specific DALY parameters.

Active pathogens:

| Pathogen | Strain / Surrogate | Model | Parameters |
|----------|-------------------|-------|-----------|
| *Escherichia coli* | Pathogenic fraction 0.08 | Beta-Poisson | α = 0.155, β = 2.42 × 10⁴ |
| *Klebsiella pneumoniae* | Clinical isolates | Exponential | k = 1.62 × 10⁻⁶ |
| *Enterococcus faecium* | E. faecalis surrogate | Exponential | k = 2.19 × 10⁻¹¹ |

> **Note on E. coli pathogenic fraction:** Not all environmental E. coli are pathogenic. A fraction of 0.08 (8%) is applied to the measured concentration before dose calculation, reflecting the proportion of pathogenic strains in environmental samples (Goh et al. 2023).

> **Note on E. faecium surrogate:** No validated human dose-response model exists for E. faecium. The E. faecalis exponential model (k = 2.19 × 10⁻¹¹) is used as the closest phylogenetic surrogate (Haas et al. 1999).

---

## Step 2 — Exposure Assessment

### Dose Calculation (Water)

```
Dose = C × PF × f_unit × V × 10^(−LR)
```

Where:
- **C** — measured concentration (in the unit given in the input file)
- **PF** — pathogenic fraction (pathogen-specific; 1.0 for resistant organisms)
- **f_unit** — unit conversion factor to organisms/L
  - CFU/100mL or MPN/100mL → × 0.01
  - oocysts/L, copies/L, FFU/L, PFU/L → × 1.0 (already per litre)
- **V** — volume of water ingested per exposure event (litres)
- **LR** — log reduction (treatment or barrier effectiveness; default = 0 if not provided)

### Volume and Exposure Frequency

The **Exposure_Type** column in the input file determines default ingestion volumes and exposure frequencies if not overridden by the user:

| Exposure Type | Volume per event (L) | Default events/year |
|--------------|---------------------|-------------------|
| Drinking Water | 1.0 | 365 |
| Primary Contact (Swimming) | 0.1 | 50 |
| Secondary Contact (Kayaking/Wading) | 0.01 | 20 |

The user may override the volume by entering a value in the `Volume_L` column. `Events_Per_Year` is always required.

---

## Step 3 — Dose-Response

### Single-Event Probability of Infection

**Exponential model** (used for K. pneumoniae, E. faecium):

```
P(infection | dose) = 1 − exp(−k × dose)
```

**Beta-Poisson model** (used for E. coli):

```
P(infection | dose) = 1 − (1 + dose/β)^(−α)
```

### Annual Probability

Assuming independent daily exposures:

```
P(annual) = 1 − (1 − P(single))^N
```

Where **N** = Events_Per_Year.

---

## Step 4 — Risk Characterisation

### DALY Calculation (YLL + YLD)

DALYs are calculated using the disability-adjusted life years framework (Cassini et al. 2019):

```
DALY = YLL + YLD
```

Where:
- **YLL** (Years of Life Lost) = P_illness × CFR × L
- **YLD** (Years Lived with Disability) = P_illness × (1 − CFR) × DW × (duration / 365)
- **P_illness** = annual probability of illness = 1 − (1 − P_infection × illness_ratio)^N
- **CFR** = case fatality rate (endpoint and resistance-track specific)
- **L** = remaining life expectancy at age of death
- **DW** = disability weight (endpoint specific)
- **duration** = illness duration in days (endpoint specific)

### Endpoint DALY Parameters

The `Endpoint` column selects which clinical syndrome parameters to use. Each pathogen has endpoint-specific CFR, duration, and disability weight values:

**E. coli endpoints:**

| Endpoint | CFR (baseline) | CFR (resistant) | Duration baseline (days) | Duration resistant (days) | DW |
|----------|---------------|----------------|-------------------------|--------------------------|-----|
| Gastroenteritis | 0.001 | 0.001 | 7.0 | 7.0 | 0.067 |
| Watery Diarrhea | 0.001 | 0.001 | 3.6 | 3.6 | 0.131 |
| UTI | 0.000 | 0.000 | 7.17 | 7.5 | 0.095 |
| BSI | 0.137 | 0.178 | 8.69 | 12.25 | 0.128 |
| RESP | 0.036 | 0.036 | 10.5 | 15.85 | 0.128 |

**K. pneumoniae endpoints:**

| Endpoint | CFR (baseline) | CFR (resistant) | Duration baseline (days) | Duration resistant (days) | DW |
|----------|---------------|----------------|-------------------------|--------------------------|-----|
| Gastroenteritis | 0.001 | 0.001 | 7.0 | 7.0 | 0.067 |
| UTI | 0.000 | 0.000 | 8.5 | 8.5 | 0.095 |
| BSI | 0.167 | 0.178 | 9.28 | 12.25 | 0.128 |

**E. faecium endpoints:**

| Endpoint | CFR (baseline) | CFR (resistant) | Duration baseline (days) | Duration resistant (days) | DW |
|----------|---------------|----------------|-------------------------|--------------------------|-----|
| UTI | 0.000 | 0.000 | 10.0 | 14.0 | 0.095 |
| BSI | 0.340 | 0.380 | 14.0 | 21.0 | 0.128 |

---

## AMR Track — dDALY

When `ARB_Concentration` is provided, the module runs a parallel calculation for antibiotic-resistant organisms:

1. The ARB concentration is treated as a separate input; all resistant organisms are assumed pathogenic (PF = 1.0)
2. The same dose-response model is applied to the ARB dose
3. DALYs are recalculated using the **resistant** CFR and duration for the selected endpoint

Two resistance-burden metrics are reported:

### Naive dDALY

```
Naive dDALY = DALY_ARB − DALY_baseline
```

The net difference between the ARB-track DALY and the baseline DALY for the same row. Can be negative when the ARB concentration is lower than the total baseline concentration (e.g. the resistant sub-population contributes less total burden than the full pathogen pool).

### Attributable dDALY

```
Attributable dDALY = P(ill | ARB dose) × (dpc_resistant − dpc_susceptible)
```

Where **dpc** (disability-per-case) = CFR × L + (1 − CFR) × DW × (duration / 365).

This isolates the **resistance penalty** — the extra burden per case caused by resistance (longer illness, higher CFR) — applied only to individuals actually exposed to the resistant sub-population. Always ≥ 0.

> Use Attributable dDALY as the primary resistance-burden metric. Naive dDALY is reported for completeness but conflates exposure magnitude with resistance severity.

---

## Risk Benchmarks

Two independent benchmarks are applied to each result:

### Infection Risk — P(annual) benchmark

```
Benchmark: 1 × 10⁻⁴ annual probability of infection (EPA/WHO)
```

| P(annual) | Infection Risk |
|-----------|---------------|
| < 10⁻⁴ | Below Threshold |
| ≥ 10⁻⁴ | Above Threshold |

This benchmark reflects the maximum tolerable probability of infection per person per year for waterborne pathogens, as referenced in EPA microbial risk guidance and WHO GDWQ frameworks.

### DALY Risk — disease burden benchmark

```
Benchmark: 1 × 10⁻⁶ DALYs per person per year (WHO GDWQ 2022)
```

| DALYs/yr | DALY Risk |
|----------|----------|
| < 10⁻⁶ | Below Threshold |
| ≥ 10⁻⁶ | Above Threshold |

This is the WHO tolerable risk level for waterborne disease burden. It accounts for illness severity (CFR, duration, disability weight) in addition to probability of infection, making it a more complete measure of public health impact.

> A result may be Below Threshold for Infection Risk but Above Threshold for DALY Risk (or vice versa) depending on the pathogen's case fatality rate and illness duration. Both benchmarks should be considered together.

---

## Input Template Structure

| Row | Content |
|-----|---------|
| Row 1 | Notes / title row |
| Row 2 | Units row |
| Row 3 | Headers |
| Row 4+ | Data rows |

Required columns: `Site`, `Date`, `Sample_Type`, `Exposure_Type`, `Pathogen`, `Endpoint`, `Concentration`, `Unit`, `Events_Per_Year`

Optional columns: `Volume_L` (defaults from Exposure_Type), `ARB_Concentration` (enables dDALY), `Log_Reduction` (default 0)

Only `Sample_Type = Water` is currently supported. Food and aerosol pathways are planned.

---

## Sensitivity Analysis

The sensitivity module runs a Monte Carlo Spearman rank correlation analysis to identify which uncertain input parameters most strongly drive annual infection probability and DALY burden. It applies to **E. coli only**, using Swimming and Kayaking/Wading exposure types.

### Structure — Three panels

| Panel | Pathotype | Outcome tracked |
|-------|-----------|----------------|
| DEC | Diarrhoeagenic E. coli (ETEC + EPEC + EIEC) | Diarrhoeal illness — resistance-independent |
| UPEC susceptible | Uropathogenic E. coli, susceptible strain | UTI — susceptible sub-population |
| UPEC ESBL/ARB | Uropathogenic E. coli, ESBL-resistant strain | UTI — resistant sub-population |

Each panel produces a 4-column Spearman matrix: **Swim: P(ill)**, **Swim: DALY**, **Kayak: P(ill)**, **Kayak: DALY**.

### DEC pathway

The DEC fraction of total E. coli is drawn from a logit-normal random-effects meta-analysis (DerSimonian-Laird; Jarocki 2024, Hamilton 2010, Hamelin 2006):

```
logit(p_DEC) ~ N(−3.65, 0.86²)
```

Dose-response uses the beta-Poisson model (α = 0.1778, N₅₀ = 8.6 × 10⁷).

### UPEC pathway

UPEC fractions are drawn from literature-pooled Beta priors:

| Fraction | Prior | Sources |
|----------|-------|---------|
| p_UPEC_susceptible | Beta(34.5, 662.5) | Johnson 2017 + Diallo 2013 (34/696 isolates) |
| p_UPEC_ESBL | Beta(23.5, 316.5) | Franz 2015 + Hussain 2026 (23/339 isolates) |

UTI illness durations are drawn from coupled PERT distributions sharing the same uniform quantile (to preserve the resistance penalty across draws):

- Susceptible: PERT(4, 7, 11) → mean 7.17 days
- ESBL/resistant: PERT(5, 7, 12) → mean 7.50 days

### Ingestion volumes

| Activity | Distribution | Mean |
|----------|-------------|------|
| Swimming | Gamma(shape=0.45, scale=60) mL/hr | 27 mL/hr |
| Kayaking | Log-normal(ln 2.2, σ=0.94) mL/hr | 2.2 mL/hr |

Swimming volumes follow Schets et al.; the Gamma parameterisation corrects an error in earlier versions that used a rate rather than scale parameter.

### Events per year

Both swim and kayak session frequencies are drawn independently from Uniform(12, 52.18) — a monthly minimum to an approximately weekly maximum.

### Output

Spearman ρ values close to ±1 indicate strong monotonic influence of the input on the output. Stars indicate statistical significance (*, **, ***). At n = 10,000, nearly all p-values reach significance; **|ρ| > 0.3** is the practical threshold for meaningful influence.

---

## Limitations

- Dose-response parameters are derived from challenge studies (human volunteer or animal); environmental strains may differ in virulence
- Pathogenic fraction for E. coli (0.08) is an average estimate; actual fractions vary by source water type and season
- E. faecium uses an E. faecalis surrogate model — this may underestimate risk given the higher intrinsic vancomycin resistance in E. faecium
- The model assumes a single exposure scenario per row; mixed or sequential exposure pathways are not modelled
- Sensitivity analysis (Monte Carlo) is available for parameter uncertainty but not for model structural uncertainty

---

## References

- Haas, C.N., Rose, J.B., & Gerba, C.P. (1999). *Quantitative Microbial Risk Assessment*. Wiley.
- Harb, C., & Hong, P.Y. (2017). Molecular-based detection of clinically relevant antibiotic-resistant bacteria in a drinking water treatment plant. *International Journal of Environmental Research and Public Health*, 14(12), 1540.
- Goh, S.G., et al. (2023). Quantitative microbial risk assessment of antibiotic-resistant E. coli in Singapore waterways. *Journal of Hazardous Materials*, 458, 132058.
- Cassini, A., et al. (2019). Attributable deaths and DALYs caused by infections with antibiotic-resistant bacteria in the EU and EEA. *The Lancet Infectious Diseases*, 19(1), 56–66.
- Bergmark, L., et al. (2024). Excess mortality and hospital stay attributable to VRE bloodstream infections. *Emerging Microbes & Infections*.
- Jarocki, V.M., et al. (2024). Prevalence of diarrhoeagenic E. coli in recreational waters: systematic review and meta-analysis. *(DEC logit-normal prior — DerSimonian-Laird pooled estimate: logit mean −3.65, SD 0.86)*
- Hamilton, A.J., et al. (2010). Quantitative microbial risk assessment models for consumption of raw vegetables irrigated with reclaimed water. *Applied and Environmental Microbiology*, 76(9), 3074–3083.
- Hamelin, K., et al. (2006). A virulence and antimicrobial resistance DNA microarray detects a high frequency of virulence genes in Escherichia coli isolates from Great Lakes recreational waters. *Applied and Environmental Microbiology*, 72(6), 4200–4206.
- Franz, E., et al. (2015). Risk factors and control of ESBL-producing *E. coli* in Dutch livestock. *(UPEC ESBL fraction prior — Franz 2015 + Hussain 2026: Beta(23.5, 316.5))*
- Johnson, J.R., & Russo, T.A. (2017). Uropathogenic *Escherichia coli* as agents of diverse non-urinary tract extraintestinal infections. *Journal of Infectious Diseases*. *(UPEC susceptible fraction prior — Johnson 2017 + Diallo 2013: Beta(34.5, 662.5))*
- WHO (2022). *Guidelines for Drinking-Water Quality*, 4th ed. incorporating 1st addendum.
