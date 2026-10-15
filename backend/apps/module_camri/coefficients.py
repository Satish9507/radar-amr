# Burden coefficients — Revised Table 2 (Cassini 2019 + GBD 2021 attribution ratios)
# ARB: DALYs per case (EU/EEA 2015 baseline); resistant combinations + susceptible baselines
# ARG: mean ARG_ranker risk coefficient per Resistomap primer set (Resistomap primer_ARG_weightage)

ARB_COEFFICIENTS = {
    # Resistant pathogen × antibiotic combinations (DALYs/case)
    "Ec_CAZ":   0.64,   # E. coli × ceftazidime (3GCRE)
    "Pseu_MEM": 2.26,   # P. aeruginosa × meropenem (CRPseu)
    "Kleb_CAZ": 1.68,   # K. pneumoniae × ceftazidime (3GCRKP)
    "Kleb_MEM": 3.70,   # K. pneumoniae × meropenem (CRKP)
    "Ent_VAN":  1.75,   # Enterococcus × vancomycin (VRE)
    "Ec_MEM":   1.57,   # E. coli × meropenem (CREco)
    # Susceptible baseline totals (DALYs/case)
    "Ec":       0.57,   # E. coli susceptible baseline
    "Ent":      1.27,   # Enterococcus susceptible baseline
    "Kleb":     1.54,   # K. pneumoniae susceptible baseline
    "Pseu":     1.83,   # P. aeruginosa susceptible baseline
}

ARG_COEFFICIENTS = {
    # Resistomap HT-qPCR primer sets — mean ARG_ranker weight (1–5 scale)
    "AY254_tetA_2":      5.000,
    "AY536_lnuB":        5.000,
    "AY533_ermB_2":      5.000,
    "AY419_APH3-Ib":     5.000,
    "AY152_blaNDM":      4.303,
    "AY331_aadA2_3":     4.222,
    "AY10_aadA_1":       4.000,
    "AY461_qnrS2":       4.000,
    "AY125_blaGES":      3.667,
    "AY528_ereA":        3.500,
    "AY145_blaOXA58":    3.375,
    "AY110_blaOXA10_1":  3.242,
    "AY263_tetW":        3.200,
    "AY367_tetL_2":      3.000,
    "AY29_catB3":        3.000,
    "AY114_cfxA":        3.000,
    "AY538_mel":         3.000,
    "AY412_aadA7":       2.857,
    "AY446_blaCARB":     2.786,
    "AY339_blaCMY_2":    2.707,
    "AY32_floR_1":       2.667,
    "AY8_AAC6-Ib_1":     2.652,
    "AY460_qnrS_1":      2.636,
    "AY120_blaOXA1":     2.385,
    "AY105_blaVEB":      2.359,
    "AY98_ampC_1":       2.286,
    "AY96_qnrB":         2.118,
    "AY466_MCR-1":       2.053,
    "AY439_blaTEM":      2.005,
    "AY565_optrA":       2.000,
    "AY413_ANT2-Ia":     2.000,
    "AY267_tetX":        2.000,
    "AY427_armA_1":      2.000,
    "AY133_mecA":        2.000,
    "AY159_vanB_1":      2.000,
    "AY117_blaDHA":      2.000,
    "AY111_cphA_1":      2.000,
    "AY126_blaSFO":      2.000,
    "AY262_tetB_2":      2.000,
    "AY24_APH6-Id":      2.000,
    "AY218_qacEdelta1_1":2.000,
    "AY595_vanA":        2.000,
    "AY603_rmtB":        2.000,
    "AY489_qacH_1":      2.000,
    "AY574_tetM":        2.000,
    "AY94_erm31":        2.000,
    "AY558_catIII":      2.000,
    "AY456_qepA":        2.000,
    "AY480_Staphylococci":2.000,
    "AY130_blaIMP_1":    1.972,
    "AY129_blaVIM":      1.767,
    "AY134_blaCTX-M_5":  1.748,
    "AY601_blaOXA48":    1.698,
    "AY104_blaSHV_1":    1.622,
    "AY448_blaHERA":     1.571,
    "AY153_blaKPC_2":    1.561,
    "AY435_blaOXA51":    1.052,
}

ARB_LABELS = {
    "Ec_CAZ":   "E. coli × ceftazidime (3GCRE)",
    "Pseu_MEM": "P. aeruginosa × meropenem (CRPseu)",
    "Kleb_CAZ": "K. pneumoniae × ceftazidime (3GCRKP)",
    "Kleb_MEM": "K. pneumoniae × meropenem (CRKP)",
    "Ent_VAN":  "Enterococcus × vancomycin (VRE)",
    "Ec_MEM":   "E. coli × meropenem (CREco)",
    "Ec":       "E. coli (susceptible baseline)",
    "Ent":      "Enterococcus (susceptible baseline)",
    "Kleb":     "K. pneumoniae (susceptible baseline)",
    "Pseu":     "P. aeruginosa (susceptible baseline)",
}

ARG_LABELS = {k: k for k in ARG_COEFFICIENTS}

# Metadata columns common to both ARB and ARG templates
FIXED_META_COLS = {"Sample_ID", "Site", "Month", "Date", "Category", "Sub_category"}


def get_coefficients_from_db():
    """
    Load ARB and ARG coefficient dicts from the DB.
    Falls back to the hardcoded values above if the table is empty or unavailable
    (e.g. before the first migration runs).
    Returns: (arb_coeffs, arg_coeffs, arb_labels, arg_labels)
    """
    try:
        from apps.module_camri.models import CAMRICoefficient
        qs = list(CAMRICoefficient.objects.all())
        if not qs:
            raise LookupError('CAMRICoefficient table is empty')
        arb_coeffs = {c.column_name: c.coefficient for c in qs if c.type == 'arb'}
        arg_coeffs = {c.column_name: c.coefficient for c in qs if c.type == 'arg'}
        arb_labels = {c.column_name: c.label        for c in qs if c.type == 'arb'}
        arg_labels = {c.column_name: c.label        for c in qs if c.type == 'arg'}
        if arb_coeffs and arg_coeffs:
            return arb_coeffs, arg_coeffs, arb_labels, arg_labels
    except Exception:
        pass
    return ARB_COEFFICIENTS, ARG_COEFFICIENTS, ARB_LABELS, ARG_LABELS
