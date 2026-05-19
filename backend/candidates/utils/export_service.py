import io
from datetime import datetime
from typing import Dict, List, Any, Optional
import traceback
import logging

from django.http import HttpResponse, JsonResponse
from django.utils import timezone

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.fonts import addMapping
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

logger = logging.getLogger(__name__)


class ExportService:
    """Сервіс для експорту даних у Excel та PDF"""

    _font_registered = False

    @classmethod
    def _register_cyrillic_font(cls):
        """Реєструє шрифт, що підтримує кирилицю, для PDF"""
        if not REPORTLAB_AVAILABLE:
            return False

        if cls._font_registered:
            return True

        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibri.ttf",
            "/Library/Fonts/Arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]

        for font_path in font_paths:
            try:
                pdfmetrics.registerFont(TTFont('CyrillicFont', font_path))
                addMapping('CyrillicFont', 0, 0, 'CyrillicFont')
                cls._font_registered = True
                logger.info(f"Registered CyrillicFont from {font_path}")
                return True
            except Exception:
                continue

        logger.warning("Could not register any Cyrillic font for PDF")
        return False

    @classmethod
    def _get_pdf_styles(cls):
        """Повертає стилі для PDF з підтримкою кирилиці"""
        has_font = cls._register_cyrillic_font()
        styles = getSampleStyleSheet()
        font_name = 'CyrillicFont' if has_font else 'Helvetica'

        for style_name in styles.byName:
            styles[style_name].fontName = font_name

        styles.add(ParagraphStyle(
            name='CyrillicTitle',
            parent=styles['Title'],
            fontName=font_name,
            fontSize=16,
            alignment=1,
            spaceAfter=12,
        ))
        styles.add(ParagraphStyle(
            name='CyrillicHeading2',
            parent=styles['Heading2'],
            fontName=font_name,
            fontSize=12,
            spaceAfter=8,
        ))
        styles.add(ParagraphStyle(
            name='CyrillicNormal',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=9,
        ))
        styles.add(ParagraphStyle(
            name='CyrillicSmall',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=7,
        ))
        return styles

    @classmethod
    def export_time_to_hire_excel(cls, time_data, statistics, filters):
        """Експорт Time-to-Hire у Excel"""
        wb = openpyxl.Workbook()
        header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
        header_fill = PatternFill(start_color='2c3e50', end_color='2c3e50', fill_type='solid')
        header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
        number_alignment = Alignment(horizontal='right', vertical='center')
        center_alignment = Alignment(horizontal='center', vertical='center')

        ws_summary = wb.active
        ws_summary.title = "Загальна статистика"
        ws_summary.merge_cells('A1:D1')
        ws_summary['A1'] = "Звіт Time-to-Hire"
        ws_summary['A1'].font = Font(name='Arial', size=14, bold=True)
        ws_summary['A1'].alignment = center_alignment
        ws_summary['A3'] = "Дата генерації:"
        ws_summary['B3'] = timezone.now().strftime('%d.%m.%Y %H:%M:%S')
        ws_summary['A4'] = "Період:"
        ws_summary['B4'] = f"{filters.get('Дата від', 'не вказано')} - {filters.get('Дата до', 'не вказано')}"

        row = 6
        ws_summary[f'A{row}'] = "Застосовані фільтри:"
        ws_summary[f'A{row}'].font = Font(bold=True)
        row += 1
        for key, value in filters.items():
            if value:
                ws_summary[f'A{row}'] = f"• {key}:"
                ws_summary[f'B{row}'] = str(value)
                row += 1

        row += 1
        ws_summary[f'A{row}'] = "Основні метрики"
        ws_summary[f'A{row}'].font = Font(bold=True, size=12)
        row += 1
        for key, value in [("Середній час до офферу (дні)", statistics.get('overall_avg', '—')), ("Медіана (дні)", statistics.get('median', '—')), ("Всього офферів", statistics.get('total_offers', 0))]:
            ws_summary[f'A{row}'] = key
            ws_summary[f'B{row}'] = value
            row += 1

        if statistics.get('distribution'):
            row += 1
            ws_summary[f'A{row}'] = "Розподіл по швидкості"
            ws_summary[f'A{row}'].font = Font(bold=True, size=12)
            row += 1
            for dist in statistics['distribution']:
                ws_summary[f'A{row}'] = dist['range']
                ws_summary[f'B{row}'] = f"{dist['count']} ({dist['percentage']}%)"
                row += 1

        # По вакансіях
        ws_vacancies = wb.create_sheet("По вакансіях")
        vacancy_headers = ["Вакансія", "Середній час (дні)", "Медіана (дні)", "Кількість офферів", "Мін. час", "Макс. час"]
        for col, header in enumerate(vacancy_headers, 1):
            cell = ws_vacancies.cell(row=1, column=col, value=header)
            cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
        for row_idx, vacancy in enumerate(statistics.get('by_vacancy', []), 2):
            for col_idx, key in enumerate(['vacancy_title', 'avg_days', 'median_days', 'offers_count', 'min_days', 'max_days'], 1):
                cell = ws_vacancies.cell(row=row_idx, column=col_idx, value=vacancy[key])
                cell.border = thin_border
                if col_idx > 1:
                    cell.alignment = number_alignment
        for col in range(1, 7):
            ws_vacancies.column_dimensions[get_column_letter(col)].width = 18

        # По періодах
        if statistics.get('by_period'):
            ws_periods = wb.create_sheet("По періодах")
            for col, header in enumerate(["Період", "Середній час (дні)", "Кількість офферів"], 1):
                cell = ws_periods.cell(row=1, column=col, value=header)
                cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
            for row_idx, period in enumerate(statistics.get('by_period', []), 2):
                ws_periods.cell(row=row_idx, column=1, value=period['period']).border = thin_border
                ws_periods.cell(row=row_idx, column=2, value=period['avg_days']).border = thin_border
                ws_periods.cell(row=row_idx, column=3, value=period['offers_count']).border = thin_border
                ws_periods.cell(row=row_idx, column=2).alignment = number_alignment
                ws_periods.cell(row=row_idx, column=3).alignment = number_alignment
            for col in range(1, 4):
                ws_periods.column_dimensions[get_column_letter(col)].width = 18

        # Дані кандидатів
        ws_candidates = wb.create_sheet("Дані кандидатів")
        candidate_headers = ["ID", "Ім'я", "Прізвище", "Вакансія", "HR Менеджер", "Дата створення", "Дата офферу", "Днів до офферу"]
        for col, header in enumerate(candidate_headers, 1):
            cell = ws_candidates.cell(row=1, column=col, value=header)
            cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
        for row_idx, candidate in enumerate(time_data, 2):
            name_parts = candidate['candidate_name'].split() if candidate['candidate_name'] else ['', '']
            ws_candidates.cell(row=row_idx, column=1, value=candidate['candidate_id']).border = thin_border
            ws_candidates.cell(row=row_idx, column=2, value=name_parts[0] if name_parts else '').border = thin_border
            ws_candidates.cell(row=row_idx, column=3, value=' '.join(name_parts[1:]) if len(name_parts) > 1 else '').border = thin_border
            ws_candidates.cell(row=row_idx, column=4, value=candidate['vacancy_title']).border = thin_border
            ws_candidates.cell(row=row_idx, column=5, value=candidate.get('assigned_to_name', '—')).border = thin_border
            ws_candidates.cell(row=row_idx, column=6, value=candidate['new_date'].strftime('%d.%m.%Y') if candidate['new_date'] else '—').border = thin_border
            ws_candidates.cell(row=row_idx, column=7, value=candidate['offer_date'].strftime('%d.%m.%Y') if candidate['offer_date'] else '—').border = thin_border
            ws_candidates.cell(row=row_idx, column=8, value=candidate['days']).border = thin_border
            ws_candidates.cell(row=row_idx, column=8).alignment = number_alignment
        for col in range(1, 9):
            ws_candidates.column_dimensions[get_column_letter(col)].width = 15

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="time_to_hire_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        wb.save(response)
        return response

    @classmethod
    def export_time_to_hire_pdf(cls, time_data, statistics, filters):
        """Експорт Time-to-Hire у PDF"""
        if not REPORTLAB_AVAILABLE:
            return cls._export_time_to_hire_csv_fallback(time_data, statistics, filters)

        try:
            cls._register_cyrillic_font()
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="time_to_hire_{datetime.now().strftime("%Y%m%d")}.pdf"'

            doc = SimpleDocTemplate(response, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm, topMargin=20*mm, bottomMargin=20*mm)
            styles = cls._get_pdf_styles()
            story = []

            story.append(Paragraph("Звіт Time-to-Hire", styles['CyrillicTitle']))
            story.append(Spacer(1, 10))
            story.append(Paragraph(f"Дата генерації: {timezone.now().strftime('%d.%m.%Y %H:%M:%S')}", styles['CyrillicSmall']))
            story.append(Spacer(1, 5))
            story.append(Paragraph("Застосовані фільтри:", styles['CyrillicHeading2']))
            for key, value in filters.items():
                if value:
                    story.append(Paragraph(f"• {key}: {value}", styles['CyrillicSmall']))
            story.append(Spacer(1, 10))

            # Метрики
            story.append(Paragraph("Основні метрики", styles['CyrillicHeading2']))
            metrics_data = [["Показник", "Значення"],
                ["Середній час до офферу (дні)", str(statistics.get('overall_avg', '—'))],
                ["Медіана (дні)", str(statistics.get('median', '—'))],
                ["Всього офферів", str(statistics.get('total_offers', 0))]]
            metrics_table = Table(metrics_data, colWidths=[doc.width*0.6, doc.width*0.3])
            metrics_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), styles['CyrillicNormal'].fontName),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#2c3e50')),
                ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (1, 0), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(metrics_table)
            story.append(Spacer(1, 15))

            # По вакансіях
            if statistics.get('by_vacancy'):
                story.append(Paragraph("Статистика по вакансіях", styles['CyrillicHeading2']))
                vacancy_data = [["Вакансія", "Сер. час", "Медіана", "Офферів", "Мін.", "Макс."]]
                for v in statistics['by_vacancy']:
                    vacancy_data.append([Paragraph(v['vacancy_title'][:40], styles['CyrillicSmall']), str(v['avg_days']), str(v['median_days']), str(v['offers_count']), str(v['min_days']), str(v['max_days'])])
                # Автоматичний розподіл ширини
                col_w = doc.width / 6
                vacancy_table = Table(vacancy_data, colWidths=[col_w*2.5, col_w*0.7, col_w*0.7, col_w*0.7, col_w*0.7, col_w*0.7])
                vacancy_table.setStyle(TableStyle([
                    ('FONTNAME', (0, 0), (-1, -1), styles['CyrillicNormal'].fontName),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                story.append(vacancy_table)
                story.append(Spacer(1, 15))

            # Розподіл
            if statistics.get('distribution'):
                story.append(Paragraph("Розподіл по швидкості", styles['CyrillicHeading2']))
                dist_data = [["Діапазон", "Кількість", "Відсоток"]]
                for d in statistics['distribution']:
                    dist_data.append([d['range'], str(d['count']), f"{d['percentage']}%"])
                col_w = doc.width / 3
                dist_table = Table(dist_data, colWidths=[col_w*1.5, col_w*0.75, col_w*0.75])
                dist_table.setStyle(TableStyle([
                    ('FONTNAME', (0, 0), (-1, -1), styles['CyrillicNormal'].fontName),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                story.append(dist_table)

            doc.build(story)
            return response
        except Exception as e:
            logger.error(f"PDF export error (time_to_hire): {str(e)}\n{traceback.format_exc()}")
            return cls._export_time_to_hire_csv_fallback(time_data, statistics, filters)

    @classmethod
    def _export_time_to_hire_csv_fallback(cls, time_data, statistics, filters):
        import csv
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="time_to_hire_{datetime.now().strftime("%Y%m%d")}.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(['Звіт Time-to-Hire'])
        writer.writerow([f'Дата генерації: {timezone.now().strftime("%d.%m.%Y %H:%M:%S")}'])
        writer.writerow([])
        writer.writerow(['Основні метрики'])
        writer.writerow(['Середній час до офферу (дні)', statistics.get('overall_avg', '—')])
        writer.writerow(['Медіана (дні)', statistics.get('median', '—')])
        writer.writerow(['Всього офферів', statistics.get('total_offers', 0)])
        writer.writerow([])
        writer.writerow(['Деталі по кандидатах'])
        writer.writerow(['ID', "Ім'я", 'Прізвище', 'Вакансія', 'HR Менеджер', 'Дата створення', 'Дата офферу', 'Днів до офферу'])
        for candidate in time_data:
            name_parts = candidate['candidate_name'].split() if candidate['candidate_name'] else ['', '']
            writer.writerow([candidate['candidate_id'], name_parts[0] if name_parts else '', ' '.join(name_parts[1:]) if len(name_parts) > 1 else '', candidate['vacancy_title'], candidate.get('assigned_to_name', '—'), candidate['new_date'].strftime('%d.%m.%Y') if candidate['new_date'] else '—', candidate['offer_date'].strftime('%d.%m.%Y') if candidate['offer_date'] else '—', candidate['days']])
        return response

    @classmethod
    def export_hr_effectiveness_excel(cls, hr_data, summary, filters):
        """Експорт HR Effectiveness у Excel"""
        wb = openpyxl.Workbook()
        header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
        header_fill = PatternFill(start_color='2c3e50', end_color='2c3e50', fill_type='solid')
        header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
        number_alignment = Alignment(horizontal='right', vertical='center')
        center_alignment = Alignment(horizontal='center', vertical='center')

        ws_summary = wb.active
        ws_summary.title = "Загальна статистика"
        ws_summary.merge_cells('A1:D1')
        ws_summary['A1'] = "Звіт Ефективність HR"
        ws_summary['A1'].font = Font(name='Arial', size=14, bold=True)
        ws_summary['A1'].alignment = center_alignment
        ws_summary['A3'] = "Дата генерації:"
        ws_summary['B3'] = timezone.now().strftime('%d.%m.%Y %H:%M:%S')

        row = 5
        ws_summary[f'A{row}'] = "Загальні показники"
        ws_summary[f'A{row}'].font = Font(bold=True, size=12)
        row += 1
        for key, value in [("Кількість HR-менеджерів", summary.get('total_hr', 0)), ("Всього кандидатів", summary.get('total_candidates', 0)), ("Всього офферів", summary.get('total_offers', 0)), ("Загальна конверсія", f"{summary.get('overall_conversion', 0)}%")]:
            ws_summary[f'A{row}'] = key
            ws_summary[f'B{row}'] = value
            row += 1

        ws_hr = wb.create_sheet("Деталі по HR")
        hr_headers = ["HR Менеджер", "Email", "Кандидатів", "Офферів", "Співбесід", "Відмов", "Активних", "Конверсія %", "Time-to-Hire"]
        for col, header in enumerate(hr_headers, 1):
            cell = ws_hr.cell(row=1, column=col, value=header)
            cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
        for row_idx, hr in enumerate(hr_data, 2):
            ws_hr.cell(row=row_idx, column=1, value=hr['hr_name']).border = thin_border
            ws_hr.cell(row=row_idx, column=2, value=hr['hr_email']).border = thin_border
            ws_hr.cell(row=row_idx, column=3, value=hr['total_candidates']).border = thin_border
            ws_hr.cell(row=row_idx, column=4, value=hr['offers_count']).border = thin_border
            ws_hr.cell(row=row_idx, column=5, value=hr['interviews_count']).border = thin_border
            ws_hr.cell(row=row_idx, column=6, value=hr['rejected_count']).border = thin_border
            ws_hr.cell(row=row_idx, column=7, value=hr['active_candidates']).border = thin_border
            ws_hr.cell(row=row_idx, column=8, value=hr['conversion_rate']).border = thin_border
            ws_hr.cell(row=row_idx, column=9, value=hr.get('time_to_hire_avg', '—')).border = thin_border
            for col in range(3, 10):
                if col != 9 or isinstance(ws_hr.cell(row=row_idx, column=col).value, (int, float)):
                    ws_hr.cell(row=row_idx, column=col).alignment = number_alignment
        for col in range(1, 10):
            ws_hr.column_dimensions[get_column_letter(col)].width = 15

        ws_status = wb.create_sheet("Статуси по HR")
        for col, header in enumerate(["HR", "Нові", "Скринінг", "Співбесіда", "Оффер", "Відмова"], 1):
            cell = ws_status.cell(row=1, column=col, value=header)
            cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
        for row_idx, hr in enumerate(hr_data, 2):
            ws_status.cell(row=row_idx, column=1, value=hr['hr_name']).border = thin_border
            for col_idx, status in enumerate(['new', 'screening', 'interview', 'offer', 'rejected'], 2):
                ws_status.cell(row=row_idx, column=col_idx, value=hr['by_status'].get(status, 0)).border = thin_border
                ws_status.cell(row=row_idx, column=col_idx).alignment = number_alignment

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="hr_effectiveness_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        wb.save(response)
        return response

    @classmethod
    def export_hr_effectiveness_pdf(cls, hr_data, summary, filters):
        """Експорт HR Effectiveness у PDF"""
        if not REPORTLAB_AVAILABLE:
            return cls._export_hr_effectiveness_csv_fallback(hr_data, summary, filters)

        try:
            cls._register_cyrillic_font()
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="hr_effectiveness_{datetime.now().strftime("%Y%m%d")}.pdf"'

            # ВИПРАВЛЕННЯ: використовуємо A4 з автоматичним розрахунком ширини колонок
            doc = SimpleDocTemplate(response, pagesize=A4, rightMargin=10*mm, leftMargin=10*mm, topMargin=15*mm, bottomMargin=15*mm)
            styles = cls._get_pdf_styles()
            story = []

            story.append(Paragraph("Звіт Ефективність HR", styles['CyrillicTitle']))
            story.append(Spacer(1, 10))
            story.append(Paragraph(f"Дата генерації: {timezone.now().strftime('%d.%m.%Y %H:%M:%S')}", styles['CyrillicSmall']))
            story.append(Spacer(1, 10))

            # Загальні показники
            story.append(Paragraph("Загальні показники", styles['CyrillicHeading2']))
            summary_data = [["Показник", "Значення"],
                ["Кількість HR-менеджерів", str(summary.get('total_hr', 0))],
                ["Всього кандидатів", str(summary.get('total_candidates', 0))],
                ["Всього офферів", str(summary.get('total_offers', 0))],
                ["Загальна конверсія", f"{summary.get('overall_conversion', 0)}%"]]
            summary_table = Table(summary_data, colWidths=[doc.width*0.6, doc.width*0.3])
            summary_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), styles['CyrillicNormal'].fontName),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#2c3e50')),
                ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (1, 0), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(summary_table)
            story.append(Spacer(1, 15))

            # Деталі по HR - ВИПРАВЛЕННЯ: зменшуємо кількість колонок та використовуємо doc.width
            story.append(Paragraph("Детальна статистика по HR-менеджерах", styles['CyrillicHeading2']))
            hr_table_data = [["HR", "Канд.", "Оффер", "Співб.", "Відм.", "Активн.", "Конверс."]]
            for hr in hr_data:
                hr_table_data.append([
                    Paragraph(hr['hr_name'][:25], styles['CyrillicSmall']),
                    str(hr['total_candidates']),
                    str(hr['offers_count']),
                    str(hr['interviews_count']),
                    str(hr['rejected_count']),
                    str(hr['active_candidates']),
                    f"{hr['conversion_rate']}%"
                ])

            # Автоматичний розподіл ширини на основі doc.width
            col_w = doc.width / 7
            hr_table = Table(hr_table_data, colWidths=[col_w*2, col_w, col_w, col_w, col_w, col_w, col_w])
            hr_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), styles['CyrillicNormal'].fontName),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(hr_table)

            doc.build(story)
            return response
        except Exception as e:
            logger.error(f"PDF export error (hr_effectiveness): {str(e)}\n{traceback.format_exc()}")
            return cls._export_hr_effectiveness_csv_fallback(hr_data, summary, filters)

    @classmethod
    def _export_hr_effectiveness_csv_fallback(cls, hr_data, summary, filters):
        import csv
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="hr_effectiveness_{datetime.now().strftime("%Y%m%d")}.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(['Звіт Ефективність HR'])
        writer.writerow([f'Дата генерації: {timezone.now().strftime("%d.%m.%Y %H:%M:%S")}'])
        writer.writerow([])
        writer.writerow(['Загальні показники'])
        writer.writerow(['Кількість HR-менеджерів', summary.get('total_hr', 0)])
        writer.writerow(['Всього кандидатів', summary.get('total_candidates', 0)])
        writer.writerow(['Всього офферів', summary.get('total_offers', 0)])
        writer.writerow(['Загальна конверсія', f"{summary.get('overall_conversion', 0)}%"])
        writer.writerow([])
        writer.writerow(['Деталі по HR'])
        writer.writerow(['HR Менеджер', 'Email', 'Кандидатів', 'Офферів', 'Співбесід', 'Відмов', 'Активних', 'Конверсія %', 'Time-to-Hire'])
        for hr in hr_data:
            writer.writerow([hr['hr_name'], hr['hr_email'], hr['total_candidates'], hr['offers_count'], hr['interviews_count'], hr['rejected_count'], hr['active_candidates'], hr['conversion_rate'], hr.get('time_to_hire_avg', '—')])
        return response


class FullReportExportService:
    """Сервіс для експорту ПОВНОГО звіту з Аналітики"""

    @classmethod
    def export_full_report_excel(cls, analytics_data):
        """Експортує повний звіт у Excel"""
        wb = openpyxl.Workbook()
        header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
        header_fill = PatternFill(start_color='2c3e50', end_color='2c3e50', fill_type='solid')
        header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
        number_alignment = Alignment(horizontal='right', vertical='center')
        center_alignment = Alignment(horizontal='center', vertical='center')

        # Time-to-Hire
        ws_tth = wb.active
        ws_tth.title = "Time-to-Hire"
        tth_statistics = analytics_data.get('time_to_hire', {})
        ws_tth.merge_cells('A1:F1')
        ws_tth['A1'] = "Звіт Time-to-Hire"
        ws_tth['A1'].font = Font(name='Arial', size=14, bold=True)
        ws_tth['A1'].alignment = center_alignment
        ws_tth['A3'] = "Дата генерації:"
        ws_tth['B3'] = timezone.now().strftime('%d.%m.%Y %H:%M:%S')
        row = 5
        ws_tth[f'A{row}'] = "Основні метрики"
        ws_tth[f'A{row}'].font = Font(bold=True, size=12)
        row += 1
        for key, value in [("Середній час до офферу (дні)", tth_statistics.get('overall_avg', '—')), ("Медіана (дні)", tth_statistics.get('median', '—')), ("Всього офферів", tth_statistics.get('total_offers', 0))]:
            ws_tth[f'A{row}'] = key
            ws_tth[f'B{row}'] = value
            row += 1
        if tth_statistics.get('by_vacancy'):
            row += 1
            ws_tth[f'A{row}'] = "Статистика по вакансіях"
            ws_tth[f'A{row}'].font = Font(bold=True, size=12)
            row += 1
            for col, header in enumerate(["Вакансія", "Середній час", "Медіана", "Офферів", "Мін.", "Макс."], 1):
                cell = ws_tth.cell(row=row, column=col, value=header)
                cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
            row += 1
            for vacancy in tth_statistics.get('by_vacancy', []):
                for col_idx, key in enumerate(['vacancy_title', 'avg_days', 'median_days', 'offers_count', 'min_days', 'max_days'], 1):
                    ws_tth.cell(row=row, column=col_idx, value=vacancy[key]).border = thin_border
                row += 1

        # HR Effectiveness
        ws_hr = wb.create_sheet("HR-ефективність")
        hr_data = analytics_data.get('hr_effectiveness', {}).get('hr_managers', [])
        hr_summary = analytics_data.get('hr_effectiveness', {}).get('summary', {})
        ws_hr.merge_cells('A1:I1')
        ws_hr['A1'] = "Звіт Ефективність HR"
        ws_hr['A1'].font = Font(name='Arial', size=14, bold=True)
        ws_hr['A1'].alignment = center_alignment
        ws_hr['A3'] = "Дата генерації:"
        ws_hr['B3'] = timezone.now().strftime('%d.%m.%Y %H:%M:%S')
        row = 5
        ws_hr[f'A{row}'] = "Загальні показники"
        ws_hr[f'A{row}'].font = Font(bold=True, size=12)
        row += 1
        for key, value in [("Кількість HR-менеджерів", hr_summary.get('total_hr', 0)), ("Всього кандидатів", hr_summary.get('total_candidates', 0)), ("Всього офферів", hr_summary.get('total_offers', 0)), ("Загальна конверсія", f"{hr_summary.get('overall_conversion', 0)}%")]:
            ws_hr[f'A{row}'] = key
            ws_hr[f'B{row}'] = value
            row += 1
        row += 1
        ws_hr[f'A{row}'] = "Деталі по HR-менеджерах"
        ws_hr[f'A{row}'].font = Font(bold=True, size=12)
        row += 1
        for col, header in enumerate(["HR Менеджер", "Кандидатів", "Офферів", "Співбесід", "Відмов", "Активних", "Конверсія %", "TTH"], 1):
            cell = ws_hr.cell(row=row, column=col, value=header)
            cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
        row += 1
        for hr in hr_data:
            ws_hr.cell(row=row, column=1, value=hr['hr_name']).border = thin_border
            ws_hr.cell(row=row, column=2, value=hr['total_candidates']).border = thin_border
            ws_hr.cell(row=row, column=3, value=hr['offers_count']).border = thin_border
            ws_hr.cell(row=row, column=4, value=hr['interviews_count']).border = thin_border
            ws_hr.cell(row=row, column=5, value=hr['rejected_count']).border = thin_border
            ws_hr.cell(row=row, column=6, value=hr['active_candidates']).border = thin_border
            ws_hr.cell(row=row, column=7, value=hr['conversion_rate']).border = thin_border
            ws_hr.cell(row=row, column=8, value=hr.get('time_to_hire_avg', '—')).border = thin_border
            row += 1

        # Воронка
        ws_funnel = wb.create_sheet("Воронка кандидатів")
        funnel_data = analytics_data.get('funnel', [])
        total_candidates = analytics_data.get('total_candidates', 1)
        ws_funnel.merge_cells('A1:C1')
        ws_funnel['A1'] = "Воронка кандидатів"
        ws_funnel['A1'].font = Font(name='Arial', size=14, bold=True)
        ws_funnel['A1'].alignment = center_alignment
        ws_funnel['A3'] = "Дата генерації:"
        ws_funnel['B3'] = timezone.now().strftime('%d.%m.%Y %H:%M:%S')
        ws_funnel['A4'] = "Всього кандидатів:"
        ws_funnel['B4'] = total_candidates
        row = 6
        for col, header in enumerate(["Статус", "Кількість", "Відсоток"], 1):
            cell = ws_funnel.cell(row=row, column=col, value=header)
            cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
        row += 1
        for status in funnel_data:
            ws_funnel.cell(row=row, column=1, value=status['label']).border = thin_border
            ws_funnel.cell(row=row, column=2, value=status['count']).border = thin_border
            ws_funnel.cell(row=row, column=3, value=f"{status['percentage']}%").border = thin_border
            ws_funnel.cell(row=row, column=2).alignment = number_alignment
            ws_funnel.cell(row=row, column=3).alignment = number_alignment
            row += 1

        # Джерела
        ws_sources = wb.create_sheet("Джерела кандидатів")
        sources_data = analytics_data.get('sources', [])
        ws_sources.merge_cells('A1:C1')
        ws_sources['A1'] = "Кандидати за джерелами"
        ws_sources['A1'].font = Font(name='Arial', size=14, bold=True)
        ws_sources['A1'].alignment = center_alignment
        ws_sources['A3'] = "Дата генерації:"
        ws_sources['B3'] = timezone.now().strftime('%d.%m.%Y %H:%M:%S')
        row = 5
        for col, header in enumerate(["Джерело", "Кількість", "Відсоток"], 1):
            cell = ws_sources.cell(row=row, column=col, value=header)
            cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
        row += 1
        for source in sources_data:
            ws_sources.cell(row=row, column=1, value=source['label']).border = thin_border
            ws_sources.cell(row=row, column=2, value=source['count']).border = thin_border
            ws_sources.cell(row=row, column=3, value=f"{source['percentage']}%").border = thin_border
            ws_sources.cell(row=row, column=2).alignment = number_alignment
            ws_sources.cell(row=row, column=3).alignment = number_alignment
            row += 1

        conversion_data = analytics_data.get('source_conversion', [])
        if conversion_data:
            row += 2
            ws_sources[f'A{row}'] = "Конверсія за джерелами"
            ws_sources[f'A{row}'].font = Font(bold=True, size=12)
            row += 1
            for col, header in enumerate(["Джерело", "Всього", "Оффер %", "Співбесіда+ %"], 1):
                cell = ws_sources.cell(row=row, column=col, value=header)
                cell.font = Font(bold=True); cell.border = thin_border
            row += 1
            for conv in conversion_data:
                ws_sources.cell(row=row, column=1, value=conv['source']).border = thin_border
                ws_sources.cell(row=row, column=2, value=conv['total']).border = thin_border
                ws_sources.cell(row=row, column=3, value=f"{conv['offerRate']}%").border = thin_border
                ws_sources.cell(row=row, column=4, value=f"{conv['interviewRate']}%").border = thin_border
                ws_sources.cell(row=row, column=2).alignment = number_alignment
                row += 1

        # Вакансії
        ws_vacancies = wb.create_sheet("Вакансії")
        vacancies_data = analytics_data.get('vacancies', [])
        ws_vacancies.merge_cells('A1:B1')
        ws_vacancies['A1'] = "Кандидати по вакансіях"
        ws_vacancies['A1'].font = Font(name='Arial', size=14, bold=True)
        ws_vacancies['A1'].alignment = center_alignment
        ws_vacancies['A3'] = "Дата генерації:"
        ws_vacancies['B3'] = timezone.now().strftime('%d.%m.%Y %H:%M:%S')
        row = 5
        for col, header in enumerate(["Вакансія", "Кількість кандидатів"], 1):
            cell = ws_vacancies.cell(row=row, column=col, value=header)
            cell.font = header_font; cell.fill = header_fill; cell.alignment = header_alignment; cell.border = thin_border
        row += 1
        for vacancy in vacancies_data:
            ws_vacancies.cell(row=row, column=1, value=vacancy['title']).border = thin_border
            ws_vacancies.cell(row=row, column=2, value=vacancy['count']).border = thin_border
            ws_vacancies.cell(row=row, column=2).alignment = number_alignment
            row += 1

        for ws in wb.worksheets:
            for column in ws.columns:
                max_length = 0
                column_letter = get_column_letter(column[0].column)
                for cell in column:
                    try:
                        if cell.value:
                            max_length = max(max_length, len(str(cell.value)))
                    except:
                        pass
                ws.column_dimensions[column_letter].width = min(max_length + 2, 35)

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="full_analytics_report_{datetime.now().strftime("%Y%m%d_%H%M")}.xlsx"'
        wb.save(response)
        return response

    @classmethod
    def export_full_report_pdf(cls, analytics_data):
        """Експортує повний звіт у PDF"""
        if not REPORTLAB_AVAILABLE:
            return cls._export_full_report_csv_fallback(analytics_data)

        try:
            ExportService._register_cyrillic_font()
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="full_analytics_report_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'

            # ВИПРАВЛЕННЯ: A4 portrait з автоматичним розрахунком ширини
            doc = SimpleDocTemplate(response, pagesize=A4, rightMargin=10*mm, leftMargin=10*mm, topMargin=15*mm, bottomMargin=15*mm)
            styles = ExportService._get_pdf_styles()
            story = []

            story.append(Paragraph("Повний аналітичний звіт", styles['CyrillicTitle']))
            story.append(Spacer(1, 10))
            story.append(Paragraph(f"Дата генерації: {timezone.now().strftime('%d.%m.%Y %H:%M:%S')}", styles['CyrillicSmall']))
            story.append(Spacer(1, 20))

            # 1. Time-to-Hire
            story.append(Paragraph("1. Time-to-Hire", styles['CyrillicHeading2']))
            tth_stats = analytics_data.get('time_to_hire', {})
            tth_data = [["Показник", "Значення"],
                ["Середній час до офферу (дні)", str(tth_stats.get('overall_avg', '—'))],
                ["Медіана (дні)", str(tth_stats.get('median', '—'))],
                ["Всього офферів", str(tth_stats.get('total_offers', 0))]]
            tth_table = Table(tth_data, colWidths=[doc.width*0.6, doc.width*0.3])
            tth_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), styles['CyrillicNormal'].fontName),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#2c3e50')),
                ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (1, 0), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            story.append(tth_table)
            story.append(Spacer(1, 15))

            # 2. HR Effectiveness
            story.append(Paragraph("2. Ефективність HR", styles['CyrillicHeading2']))
            hr_summary = analytics_data.get('hr_effectiveness', {}).get('summary', {})
            hr_data = [["Показник", "Значення"],
                ["Кількість HR-менеджерів", str(hr_summary.get('total_hr', 0))],
                ["Всього кандидатів", str(hr_summary.get('total_candidates', 0))],
                ["Всього офферів", str(hr_summary.get('total_offers', 0))],
                ["Загальна конверсія", f"{hr_summary.get('overall_conversion', 0)}%"]]
            hr_table = Table(hr_data, colWidths=[doc.width*0.6, doc.width*0.3])
            hr_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), styles['CyrillicNormal'].fontName),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (1, 0), colors.HexColor('#2c3e50')),
                ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (1, 0), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            story.append(hr_table)
            story.append(Spacer(1, 15))

            # 3. Воронка
            story.append(Paragraph("3. Воронка кандидатів", styles['CyrillicHeading2']))
            funnel_data = analytics_data.get('funnel', [])
            if funnel_data:
                funnel_table_data = [["Статус", "Кількість", "Відсоток"]]
                for f in funnel_data:
                    funnel_table_data.append([f['label'], str(f['count']), f"{f['percentage']}%"])
                col_w = doc.width / 3
                funnel_table = Table(funnel_table_data, colWidths=[col_w*1.5, col_w*0.75, col_w*0.75])
                funnel_table.setStyle(TableStyle([
                    ('FONTNAME', (0, 0), (-1, -1), styles['CyrillicNormal'].fontName),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ]))
                story.append(funnel_table)

            doc.build(story)
            return response
        except Exception as e:
            logger.error(f"PDF export error (full_report): {str(e)}\n{traceback.format_exc()}")
            return cls._export_full_report_csv_fallback(analytics_data)

    @classmethod
    def _export_full_report_csv_fallback(cls, analytics_data):
        import csv
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="full_analytics_report_{datetime.now().strftime("%Y%m%d_%H%M")}.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(['ПОВНИЙ АНАЛІТИЧНИЙ ЗВІТ'])
        writer.writerow([f'Дата генерації: {timezone.now().strftime("%d.%m.%Y %H:%M:%S")}'])
        writer.writerow([])
        writer.writerow(['=== TIME-TO-HIRE ==='])
        tth_stats = analytics_data.get('time_to_hire', {})
        writer.writerow(['Середній час до офферу (дні)', tth_stats.get('overall_avg', '—')])
        writer.writerow(['Медіана (дні)', tth_stats.get('median', '—')])
        writer.writerow(['Всього офферів', tth_stats.get('total_offers', 0)])
        writer.writerow([])
        writer.writerow(['=== ЕФЕКТИВНІСТЬ HR ==='])
        hr_summary = analytics_data.get('hr_effectiveness', {}).get('summary', {})
        writer.writerow(['Кількість HR-менеджерів', hr_summary.get('total_hr', 0)])
        writer.writerow(['Всього кандидатів', hr_summary.get('total_candidates', 0)])
        writer.writerow(['Всього офферів', hr_summary.get('total_offers', 0)])
        writer.writerow(['Загальна конверсія', f"{hr_summary.get('overall_conversion', 0)}%"])
        writer.writerow([])
        writer.writerow(['=== ВОРОНКА КАНДИДАТІВ ==='])
        writer.writerow(['Статус', 'Кількість', 'Відсоток'])
        for f in analytics_data.get('funnel', []):
            writer.writerow([f['label'], f['count'], f"{f['percentage']}%"])
        return response