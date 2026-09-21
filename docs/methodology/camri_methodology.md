# CAMRI — Combined AMR Relative Index Methodology

## Overview

CAMRI (Combined AMR Relative Index) is a 6-step relative burden pipeline that integrates antibiotic-resistant bacteria (ARB) concentrations and antibiotic resistance genes (ARG) abundance into a single normalised score (ℜ_AMR) per sample. The score represents the relative AMR burden at a site compared to all other sites in the same dataset.

The method is based on Goh et al. (2022), *Journal of Hazardous Materials* 424:127621, with ARB burden coefficients from Cassini et al. (2019) and ARG priority ranks from Zhang et al. (2019).

---

## Calculation Modes

CAMRI supports three modes depending on the files uploaded:

| Mode | Input | Output score |
|------|-------|-------------|
| **ARB only** | ARB file only | ℜ_ARB per sample |
| **ARG only** | ARG file only | ℜ_ARG per sample |
| **Combined** | Both ARB and ARG files | ℜ_ARB, ℜ_ARG, and ℜ_AMR per sample |

In combined mode, samples are matched by `Sample_ID` across both files. Only matched samples are included in the final output.

---

## Step-by-Step Pipeline

### Step 1 — Input Concentrations

Each sample provides measured concentrations for:

**ARB (Antibiotic-Resistant Bacteria)** — in CFU/mL:

| Column | Organism × Antibiotic | DALY Coefficient |
|--------|----------------------|-----------------|
| `Ec_CAZ` | *E. coli* × ceftazidime | 37.2 |
| `Pseu_MEM` | *P. aeruginosa* × meropenem | 27.2 |
| `Kleb_CAZ` | *K. pneumoniae* × ceftazidime | 22.5 |
| `Kleb_MEM` | *K. pneumoniae* × meropenem | 11.5 |
| `Ent_VAN` | *Enterococcus* × vancomycin | 5.49 |
| `Ec_MEM` | *E. coli* × meropenem | 0.80 |

ARB coefficients represent the disease burden weight of each pathogen–antibiotic combination, derived from DALY estimates in Cassini et al. (2019).

**ARG (Antibiotic Resistance Genes)** — in copies/mL:

| Column | Gene | Priority Rank | Coefficient |
|--------|------|--------------|------------|
| `blaKPC` | β-lactamase KPC | 1 | 5 |
| `blaCTX_M` | β-lactamase CTX-M | 1 | 5 |
| `vanA` | Vancomycin resistance | 2 | 4 |
| `blaNDM` | β-lactamase NDM | 3 | 3 |
| `blaSHV` | β-lactamase SHV | 3 | 3 |
| `tetO` | Tetracycline O | 3 | 3 |
| `tetM` | Tetracycline M | 4 | 2 |
| `qnrA` | Quinolone A | 5 | 1 |

ARG coefficients are priority ranks from the ARG Ranker database (Zhang et al. 2019), reflecting clinical importance and mobility of each gene.

---

### Step 2 — Column-wise Min-Max Normalisation

Each concentration column is independently normalised across all samples in the dataset:

```
N_ij = (C_ij − min_j) / (max_j − min_j)
```

Where:
- **C_ij** — raw concentration of analyte j at sample i
- **min_j**, **max_j** — minimum and maximum across all samples for analyte j
- **N_ij** — normalised value ∈ [0, 1]

If all samples have the same concentration for a given analyte (max = min), that column is set to 0 for all samples to avoid division by zero.

> This step removes the effect of concentration scale differences between analytes, putting CFU/mL (ARB) and copies/mL (ARG) on a common relative scale.

---

### Step 3 — Weighted Scoring

Each normalised value is multiplied by the analyte's burden coefficient:

```
S_ij = N_ij × w_j
```

Where **w_j** is the DALY coefficient (ARB) or priority rank (ARG) for analyte j.

---

### Step 4 — Row Summation

Weighted scores are summed across all analytes for each sample:

```
T_i = Σ_j S_ij
```

**T_i** is the total weighted burden score for sample i.

---

### Step 5 — Dataset-level Normalisation

The total scores are normalised again across all samples:

```
ℜ_ARB_i  or  ℜ_ARG_i = (T_i − min(T)) / (max(T) − min(T))
```

This produces a final score ∈ [0, 1] where 0 = lowest relative burden in the dataset and 1 = highest.

---

### Step 6 — Combined Score (Combined mode only)

When both ARB and ARG files are provided, the final combined score is a weighted average:

```
ℜ_AMR = α × ℜ_ARB + (1 − α) × ℜ_ARG
```

Where **α** is the ARB weighting factor (default = 0.6, range 0.5–1.0).

ARBs always carry more weight (α ≥ 0.5) because measurable resistant organisms represent a more direct and immediate health risk than resistance genes, which may reside in non-pathogenic or non-culturable organisms (Manaia 2017).

A sensitivity analysis is automatically run for α ∈ {0.6, 0.7, 0.8, 0.9} to show how the combined score changes under different weighting assumptions.

---

## Risk Classification

| ℜ_AMR (or ℜ_ARB / ℜ_ARG) | Risk Level |
|--------------------------|-----------|
| < 0.40 | **Low** |
| 0.40 – 0.65 | **Medium** |
| ≥ 0.65 | **High** |

---

## Important Interpretation Notes

**CAMRI scores are relative, not absolute.** A score of 0.8 means that sample has the highest AMR burden within this dataset — it does not indicate a specific absolute risk level. Adding or removing samples changes the normalisation and therefore all scores.

**Scores should be compared within a dataset, not across datasets.** To compare two time points or two regions, they must be analysed together in a single run.

**Missing analytes are treated as 0.** If a column is present in the template but left blank, it is read as 0 concentration. If a column is entirely absent from the file, it is simply excluded from the weighted sum.

---

## Input Template Structure

Both ARB and ARG templates share the same layout:

| Row | Content |
|-----|---------|
| Row 1 | Units row (`CFU/mL` or `copies/mL` for data columns) |
| Row 2 | Headers (`Sample_ID`, `Site`, `Month`, `Date`, `Category`, `Sub_category`, then data columns) |
| Row 3+ | Data rows |

Sample matching in combined mode uses the `Sample_ID` column exactly. `Sample_ID` values must match between ARB and ARG files; unmatched samples are excluded from the combined score but reported in the validation output.

---

## Validation Step

Before calculation, CAMRI runs a validation pass that reports:
- Which analyte columns were recognised and matched to known coefficients
- Which columns were unrecognised (excluded from calculation, not an error)
- How many samples are in each file
- Which Sample_IDs are matched, ARB-only, or ARG-only (combined mode)

Unrecognised columns do not fail the upload — they are simply excluded. This allows users to include additional metadata columns without modifying the template.

---

## Limitations

- The min-max normalisation means scores are dataset-relative; a pristine environment added to a polluted dataset will score near 0 even if its absolute concentrations are non-trivial
- ARB coefficients are based on EU DALY estimates (Cassini et al. 2019); they may not reflect the true burden distribution in other regions where different pathogen–antibiotic combinations dominate
- ARG priority ranks (Zhang et al. 2019) are based on gene mobility and clinical relevance, not direct DALY estimates; the two coefficient systems are therefore not directly comparable in magnitude
- The model does not account for horizontal gene transfer rates, gene–host associations, or environmental persistence

---

## References

- Goh, S.G., et al. (2022). A relative AMR burden index for environmental monitoring of antibiotic resistance in surface water. *Journal of Hazardous Materials*, 424, 127621.
- Cassini, A., et al. (2019). Attributable deaths and DALYs caused by infections with antibiotic-resistant bacteria in the EU and EEA. *The Lancet Infectious Diseases*, 19(1), 56–66.
- Zhang, A.N., et al. (2019). An omics-based framework for assessing the health risk of antimicrobial resistance genes. *Nature Communications*, 10, 4765.
- Manaia, C.M. (2017). Assessing the risk of antibiotic resistance transmission from the environment to humans: non-direct proportionality between abundance and risk. *Trends in Microbiology*, 25(3), 173–181.
