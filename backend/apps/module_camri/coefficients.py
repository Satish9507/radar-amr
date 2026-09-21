# Burden coefficients from Goh et al. (2022), J. Hazardous Materials 424:127621
# ARB: DALY-based coefficients from Cassini et al. (2019) — Table 2
# ARG: rank-based coefficients from ARG Ranker, Zhang et al. (2019) — Table 3

ARB_COEFFICIENTS = {
    "Ec_CAZ":   37.2,   # E. coli × ceftazidime          — priority rank 1
    "Pseu_MEM": 27.2,   # P. aeruginosa × meropenem      — priority rank 2
    "Kleb_CAZ": 22.5,   # K. pneumoniae × ceftazidime    — priority rank 3
    "Kleb_MEM": 11.5,   # K. pneumoniae × meropenem      — priority rank 4
    "Ent_VAN":  5.49,   # Enterococcus × vancomycin      — priority rank 5
    "Ec_MEM":   0.80,   # E. coli × meropenem            — priority rank 6
}

ARG_COEFFICIENTS = {
    "blaKPC":   5,   # β-lactamase KPC    — priority rank 1
    "blaCTX_M": 5,   # β-lactamase CTX-M  — priority rank 1
    "vanA":     4,   # Vancomycin resist. — priority rank 2
    "blaNDM":   3,   # β-lactamase NDM    — priority rank 3
    "blaSHV":   3,   # β-lactamase SHV    — priority rank 3
    "tetO":     3,   # Tetracycline O     — priority rank 3
    "tetM":     2,   # Tetracycline M     — priority rank 4
    "qnrA":     1,   # Quinolone A        — priority rank 5
}

ARB_LABELS = {
    "Ec_CAZ":   "E. coli (ceftazidime)",
    "Pseu_MEM": "P. aeruginosa (meropenem)",
    "Kleb_CAZ": "K. pneumoniae (ceftazidime)",
    "Kleb_MEM": "K. pneumoniae (meropenem)",
    "Ent_VAN":  "Enterococcus (vancomycin)",
    "Ec_MEM":   "E. coli (meropenem)",
}

ARG_LABELS = {
    "blaKPC":   "blaKPC",
    "blaCTX_M": "blaCTX-M",
    "vanA":     "vanA",
    "blaNDM":   "blaNDM",
    "blaSHV":   "blaSHV",
    "tetO":     "tetO",
    "tetM":     "tetM",
    "qnrA":     "qnrA",
}

# Metadata columns common to both ARB and ARG templates
FIXED_META_COLS = {"Sample_ID", "Site", "Month", "Date", "Category", "Sub_category"}
