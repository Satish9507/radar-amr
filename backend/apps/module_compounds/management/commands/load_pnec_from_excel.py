from django.core.management.base import BaseCommand
from apps.module_compounds.models import CompoundReference
from decimal import Decimal, InvalidOperation
import openpyxl
import re


def parse_pnec(val):
    if val is None:
        return None
    s = str(val).strip()
    if s in ('—', '-', '', 'N/A'):
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def extract_year(text):
    """Return the last 4-digit year found in a reference string, or None."""
    if not text:
        return None
    years = re.findall(r'\b((?:19|20)\d{2})\b', text)
    return int(years[-1]) if years else None


class Command(BaseCommand):
    help = 'Load compounds from pnec_reference_table.xlsx — skips compound_codes already in the DB'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to pnec_reference_table.xlsx')

    def handle(self, *args, **options):
        path = options['file_path']

        try:
            wb = openpyxl.load_workbook(path)
        except FileNotFoundError:
            self.stderr.write(f'File not found: {path}')
            return

        ws = wb.active
        created = skipped = errors = 0

        # Row 3 = headers, data starts at row 4
        for row in ws.iter_rows(min_row=4, values_only=True):
            code = row[0]
            if not code:
                continue
            code = str(code).strip()

            pnec_eco = parse_pnec(row[3])
            eco_ref  = str(row[5] or '').strip()
            eco_url  = str(row[6] or '').strip()
            pnec_amr = parse_pnec(row[7])
            amr_ref  = str(row[9] or '').strip()
            amr_url  = str(row[10] or '').strip()

            sources = []
            if eco_ref:
                sources.append(f'Eco: {eco_ref}')
            if amr_ref:
                sources.append(f'AMR: {amr_ref}')

            citations = []
            if eco_url.startswith('http'):
                citations.append(f'Eco: {eco_url}')
            if amr_url.startswith('http'):
                citations.append(f'AMR: {amr_url}')

            pnec_source       = '; '.join(sources)
            reference_citation = '\n'.join(citations)
            pnec_source_year  = extract_year(eco_ref) or extract_year(amr_ref)

            existing = CompoundReference.objects.filter(compound_code=code).first()
            if existing:
                existing.pnec_eco_value      = pnec_eco
                existing.pnec_amr_value      = pnec_amr
                existing.pnec_source         = pnec_source
                existing.pnec_source_year    = pnec_source_year
                existing.reference_citation  = reference_citation
                try:
                    existing.save(update_fields=[
                        'pnec_eco_value', 'pnec_amr_value',
                        'pnec_source', 'pnec_source_year', 'reference_citation',
                        'updated_at',
                    ])
                    self.stdout.write(
                        f'  UPDATE {code} — eco={pnec_eco}, amr={pnec_amr}, year={pnec_source_year}'
                    )
                    skipped += 1
                except Exception as e:
                    self.stderr.write(f'  ERROR  {code}: {e}')
                    errors += 1
                continue

            name     = str(row[1] or '').strip()
            category = str(row[2] or '').strip()
            comments = str(row[11] or '').strip()

            try:
                CompoundReference.objects.create(
                    compound_code=code,
                    compound_name=name,
                    compound_class=category,
                    pnec_eco_value=pnec_eco,
                    pnec_amr_value=pnec_amr,
                    pnec_unit='ng/L',
                    preferred_calc_unit='ng/L',
                    pnec_source=pnec_source,
                    pnec_source_year=pnec_source_year,
                    reference_citation=reference_citation,
                    notes=comments,
                    is_active=True,
                )
                self.stdout.write(f'  CREATE {code} — {name}')
                created += 1
            except Exception as e:
                self.stderr.write(f'  ERROR  {code}: {e}')
                errors += 1

        updated = skipped
        self.stdout.write(
            f'\nDone: {self.style.SUCCESS(str(created)+" created")}, '
            f'{self.style.SUCCESS(str(updated)+" updated")}, '
            f'{self.style.ERROR(str(errors)+" errors") if errors else "0 errors"}'
        )
