import csv
import io
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass
from django.http import HttpResponse
from django.db.models import QuerySet


@dataclass
class CSVImportResult:
    created: int = 0
    duplicates: List[Dict] = None
    errors: List[Dict] = None

    def __post_init__(self):
        if self.duplicates is None:
            self.duplicates = []
        if self.errors is None:
            self.errors = []

    def to_dict(self) -> Dict:
        return {
            'created': self.created,
            'duplicates_found': len(self.duplicates),
            'duplicates': self.duplicates[:10],
            'errors_count': len(self.errors),
            'errors': self.errors[:10],
        }


class CSVHandler:
    DEFAULT_COLUMN_MAPPING = {
        'first_name': ['first_name', "ім'я", 'имя', 'name', 'first name', 'імя'],
        'last_name': ['last_name', 'прізвище', 'фамилия', 'last name', 'прізвище'],
        'email': ['email', 'пошта', 'email address', 'e-mail'],
        'phone': ['phone', 'телефон', 'phone number', 'мобільний'],
        'vacancy': ['vacancy', 'вакансія', 'vacancy_id', 'position'],
        'status': ['status', 'статус'],
        'source': ['source', 'джерело'],
        'notes': ['notes', 'нотатки', 'коментар', 'comments'],
    }

    @classmethod
    def detect_column_mapping(cls, fieldnames: List[str]) -> Dict[str, str]:
        mapping = {}
        fieldnames_lower = [f.strip().lower() for f in fieldnames]

        for target, possible_names in cls.DEFAULT_COLUMN_MAPPING.items():
            for name in possible_names:
                if name in fieldnames_lower:
                    mapping[target] = name
                    break

        return mapping

    @classmethod
    def read_csv_file(cls, csv_file) -> Tuple[List[Dict], List[str], str]:
        try:
            decoded = csv_file.read().decode('utf-8-sig')
            io_string = io.StringIO(decoded)
            reader = csv.DictReader(io_string)

            rows = list(reader)
            fieldnames = reader.fieldnames or []

            return rows, [f.strip().lower() for f in fieldnames], None

        except Exception as e:
            return [], [], f'Помилка читання CSV: {str(e)}'

    @classmethod
    def export_queryset_to_csv(
            cls,
            queryset: QuerySet,
            filename: str,
            headers: List[str],
            data_extractor: callable
    ) -> HttpResponse:
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.write('\ufeff')

        writer = csv.writer(response)
        writer.writerow(headers)

        for obj in queryset:
            row = data_extractor(obj)
            writer.writerow(row)

        return response