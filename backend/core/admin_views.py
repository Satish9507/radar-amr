from django.shortcuts import render

API_ENDPOINTS = [
    {
        'module': 'Risk Quotient (RQ)',
        'color': '#1E40AF',
        'endpoints': [
            {
                'method': 'POST',
                'url': '/api/v1/rq/calculate/',
                'description': 'Upload an Excel file and calculate RQ_Eco and RQ_AMR for all compounds.',
                'auth': True,
                'request': 'multipart/form-data — field: file (.xlsx / .xls)',
                'response': 'JSON with results[], errors[], warnings[], and meta summary.',
                'notes': (
                    'Template: download from the RQ page (generated dynamically from active compounds). '
                    'Row 1 = units (ng/L), Row 2 = headers, Row 3+ = data. '
                    'Fixed columns: Sample_ID, Site, Month, Date, Category, Sub_category. '
                    'Data columns: compound name with code e.g. "Ciprofloxacin (CIPX)". '
                    'Risk thresholds: RQ < 1 Low, 1–10 Moderate, ≥ 10 High.'
                ),
            },
            {
                'method': 'POST',
                'url': '/api/v1/rq/calculate/single/',
                'description': 'Calculate RQ for a single compound and MEC value.',
                'auth': True,
                'request': '{"compound_code": "CIPX", "mec": 1.42, "mec_unit": "ng/L"}',
                'response': 'JSON with rq_eco, rq_amr, risk_eco, risk_amr.',
                'notes': 'Useful for quick lookups and vendor integrations. compound_code is case-sensitive (uppercase).',
            },
        ],
    },
    {
        'module': 'QMRA — Quantitative Microbial Risk Assessment',
        'color': '#0D9488',
        'endpoints': [
            {
                'method': 'POST',
                'url': '/api/v1/qmra/calculate/',
                'description': 'Upload a QMRA Excel file and calculate P(infection), P(illness), DALYs/yr, and dDALY.',
                'auth': True,
                'request': 'multipart/form-data — field: file (.xlsx / .xls)',
                'response': (
                    'JSON with results[], errors[], warnings[], meta. '
                    'Each result includes: dose, p_infection, p_annual, p_illness, daly, daly_baseline, '
                    'daly_arb, d_daly, cfr_baseline, cfr_resistant, risk_label, risk_label_arb, '
                    'daly_method, pathogenic_fraction, param_source, param_source_amr. '
                    'daly_arb and d_daly are null when ARB_Concentration is not provided.'
                ),
                'notes': (
                    'Template: download from the QMRA page. Headers in row 4, data from row 5. '
                    'Required columns: Site, Date, Sample_Type (must be "Water"), Pathogen, Endpoint, '
                    'Concentration, Unit, Volume_L, Events_Per_Year. '
                    'Optional: ARB_Concentration (enables dDALY output), Log_Reduction (default 0). '
                    'Active pathogens: Escherichia coli (Beta-Poisson, alpha=0.155, beta=2.42e4, pathogenic_fraction=0.08), '
                    'Klebsiella pneumoniae (Exponential, k=1.62e-6), '
                    'Enterococcus faecium (Exponential, k=2.19e-11, E. faecalis surrogate). '
                    'DALY risk thresholds: Below Threshold < 1e-6 DALYs/yr, Above Threshold >= 1e-6 DALYs/yr. '
                    'Infection risk threshold: Below Threshold < 1e-4 annual P(infection), Above Threshold >= 1e-4. '
                    'DALY formula: YLL+YLD (Cassini et al. 2019). '
                    'References: Goh et al. 2023; Haas et al. 1999; Harb & Hong 2017.'
                ),
            },
            {
                'method': 'GET',
                'url': '/api/v1/qmra/pathogens/',
                'description': 'List all active pathogen profiles with dose-response model parameters.',
                'auth': True,
                'request': 'No parameters',
                'response': (
                    'Array of pathogen objects: pathogen_name, display_strain, model_type, alpha, beta, k, '
                    'illness_ratio, pathogenic_fraction, endpoint_daly_params, param_source, param_source_amr.'
                ),
                'notes': (
                    'Model types: exponential (uses k) or beta_poisson (uses alpha, beta). '
                    'Active pathogens: Escherichia coli, Klebsiella pneumoniae, Enterococcus faecium. '
                    'References: Goh et al. 2023; Haas et al. 1999; Harb & Hong 2017; Denissen et al. 2023.'
                ),
            },
            {
                'method': 'POST',
                'url': '/api/v1/qmra/sensitivity/',
                'description': 'Start a Monte Carlo sensitivity analysis for a set of QMRA records.',
                'auth': True,
                'request': '{"records": [...], "n_sim": 10000}',
                'response': 'JSON with task_id to poll for results.',
                'notes': (
                    'Runs asynchronously. Default n_sim = 10000. '
                    'Poll the status endpoint with the returned task_id.'
                ),
            },
            {
                'method': 'GET',
                'url': '/api/v1/qmra/sensitivity/status/<task_id>/',
                'description': 'Poll the result of a running sensitivity analysis.',
                'auth': True,
                'request': 'URL param: task_id (from sensitivity POST)',
                'response': 'JSON with status (pending / complete) and results when complete.',
                'notes': 'Poll every 2–3 seconds until status is "complete".',
            },
        ],
    },
    {
        'module': 'CAMRI — Combined AMR Relative Index',
        'color': '#7C3AED',
        'endpoints': [
            {
                'method': 'POST',
                'url': '/api/v1/camri/validate/',
                'description': 'Validate one or both CAMRI input files before running a calculation.',
                'auth': True,
                'request': 'multipart/form-data — fields: arb_file and/or arg_file (.xlsx / .xls)',
                'response': (
                    'JSON with status, mode (arb_only / arg_only / combined), '
                    'arb_matched_cols, arb_unmatched_cols, arg_matched_cols, arg_unmatched_cols, '
                    'arb_sample_count, arg_sample_count, site_validation.'
                ),
                'notes': (
                    'At least one file is required. '
                    'site_validation is only returned when both files are provided. '
                    'Unmatched columns are excluded from calculation but do not fail validation.'
                ),
            },
            {
                'method': 'POST',
                'url': '/api/v1/camri/calculate/',
                'description': 'Upload ARB and/or ARG files and run the CAMRI 6-step burden pipeline.',
                'auth': True,
                'request': (
                    'multipart/form-data — fields: arb_file (.xlsx/.xls), arg_file (.xlsx/.xls), '
                    'alpha (float, default 0.6, range 0.5–1.0).'
                ),
                'response': (
                    'JSON with status, mode, results[], arb_matrix, arg_matrix, arb_keys, arg_keys, '
                    'sensitivity (combined mode only), alpha, k, warnings[].'
                ),
                'notes': (
                    'Modes: arb_only (only arb_file), arg_only (only arg_file), combined (both files). '
                    'Each result includes: sample_id, site, month, date, category, sub_category, '
                    'r_arb, r_arg, r_amr, risk_level. '
                    'ARB coefficients from Cassini et al. 2019. ARG ranks from Zhang et al. 2019. '
                    'Reference: Goh et al. 2022, J. Hazardous Materials. '
                    'Risk thresholds: < 0.40 Low, 0.40–0.65 Medium, >= 0.65 High.'
                ),
            },
            {
                'method': 'GET',
                'url': '/api/v1/camri/template/arb/',
                'description': 'Download the ARB input Excel template.',
                'auth': True,
                'request': 'No parameters',
                'response': 'Excel file (.xlsx) with ARB coefficient columns pre-populated.',
                'notes': (
                    'Columns: Sample_ID, Site, Month, Date, Category, Sub_category, '
                    'Ec_CAZ, Pseu_MEM, Kleb_CAZ, Kleb_MEM, Ent_VAN, Ec_MEM. '
                    'Units row (row 1): CFU/mL for all data columns.'
                ),
            },
            {
                'method': 'GET',
                'url': '/api/v1/camri/template/arg/',
                'description': 'Download the ARG input Excel template.',
                'auth': True,
                'request': 'No parameters',
                'response': 'Excel file (.xlsx) with ARG gene columns pre-populated.',
                'notes': (
                    'Columns: Sample_ID, Site, Month, Date, Category, Sub_category, '
                    'blaKPC, blaCTX_M, vanA, blaNDM, blaSHV, tetO, tetM, qnrA. '
                    'Units row (row 1): copies/mL for all data columns.'
                ),
            },
        ],
    },
    {
        'module': 'Compound Reference',
        'color': '#0369A1',
        'endpoints': [
            {
                'method': 'GET',
                'url': '/api/v1/compounds/',
                'description': 'List all active compounds with their PNEC values.',
                'auth': True,
                'request': 'Optional query: ?search=<name or code>',
                'response': 'Array of compound objects with PNEC_Eco, PNEC_AMR, units.',
                'notes': 'Supports search by compound_code, compound_name, compound_class. 34 compounds active by default.',
            },
            {
                'method': 'GET',
                'url': '/api/v1/compounds/<compound_code>/',
                'description': 'Retrieve a single compound by its code.',
                'auth': True,
                'request': 'URL param: compound_code e.g. CIPX, TCS, ZN',
                'response': 'Single compound object.',
                'notes': 'Codes are uppercase e.g. CIPX, ERY-H2O, FIP-DESULF.',
            },
        ],
    },
    {
        'module': 'Module Configuration',
        'color': '#475569',
        'endpoints': [
            {
                'method': 'GET',
                'url': '/api/v1/config/',
                'description': 'List all active module configurations and risk thresholds.',
                'auth': True,
                'request': 'No parameters',
                'response': 'Array of module config objects including risk_thresholds JSON.',
                'notes': (
                    'Used by the frontend NavBar to list active modules. '
                    'Active modules: RQ, QMRA, CAMRI.'
                ),
            },
            {
                'method': 'GET',
                'url': '/api/v1/config/<module_code>/',
                'description': 'Retrieve configuration for a specific module.',
                'auth': True,
                'request': 'URL param: module_code — RQ, QMRA, or CAMRI',
                'response': 'Module config with risk_thresholds, calculation_config, input_schema.',
                'notes': (
                    'Used by the frontend to dynamically load thresholds and colours at runtime. '
                    'Thresholds can be updated in the DB without redeploying the frontend.'
                ),
            },
        ],
    },
]

METHOD_COLORS = {
    'GET':    {'bg': '#D1FAE5', 'text': '#065F46'},
    'POST':   {'bg': '#DBEAFE', 'text': '#1E40AF'},
    'PUT':    {'bg': '#FEF3C7', 'text': '#92400E'},
    'PATCH':  {'bg': '#FEF3C7', 'text': '#92400E'},
    'DELETE': {'bg': '#FEE2E2', 'text': '#991B1B'},
}


def api_docs_view(request):
    endpoints_with_colors = []
    for group in API_ENDPOINTS:
        enriched = []
        for ep in group['endpoints']:
            enriched.append({
                **ep,
                'method_color': METHOD_COLORS.get(ep['method'], {'bg': '#F1F5F9', 'text': '#475569'}),
            })
        endpoints_with_colors.append({**group, 'endpoints': enriched})

    context = {
        'title': 'API Documentation',
        'groups': endpoints_with_colors,
        'total': sum(len(g['endpoints']) for g in API_ENDPOINTS),
        'base_url': request.build_absolute_uri('/api/v1'),
    }
    return render(request, 'admin/api_docs.html', context)
