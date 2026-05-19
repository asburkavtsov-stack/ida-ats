import io
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

from django.http import HttpResponse
from django.conf import settings

logger = logging.getLogger(__name__)

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


class ExportService:
    HEADER_FILL = PatternFill(start_color='7A1A2E', end_color='7A1A2E', fill_type='solid')
    HEADER_FONT = Font(color='FFFFFF', bold=True, size=11)
    SUBHEADER_FILL = PatternFill(start_color='D4A5A5', end_color='D4A5A5', fill_type='solid')
    SUBHEADER_FONT = Font(color='7A1A2E', bold=True, size=10)
    BORDER = Border(
        left=Side(style='thin', color='CCCCCC'),
        right=Side(style='thin', color='CCCCCC'),
        top=Side(style='thin', color='CCCCCC'),
        bottom=Side(style='thin', color='CCCCCC'),
    )
    ALIGN_CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ALIGN_LEFT = Alignment(horizontal='left', vertical='center', wrap_text=True)

    @classmethod
    def export_time_to_hire_excel(
            cls,
            time_data: List[Dict[str, Any]],
            statistics: Dict[str, Any],
            filters: Dict[str, Any] = None
    ) -> HttpResponse:
        if not OPENPYXL_AVAILABLE:
            raise ImportError("openpyxl не встановлено. Використайте: pip install openpyxl")

        wb = openpyxl.Workbook()

        ws_summary = wb.active
        ws_summary.title = "Загальна статистика"

        ws_summary['A1'] = 'Аналітика Time-to-Hire'
        ws_summary['A1'].font = Font(size=16, bold=True, color='7A1A2E')
        ws_summary.merge_cells('A1:D1')
        ws_summary['A1'].alignment = cls.ALIGN_CENTER

        ws_summary['A2'] = f'Звіт сформовано: {datetime.now().strftime("%d.%m.%Y %H:%M")}'
        ws_summary['A2'].font = Font(italic=True, color='666666')
        ws_summary.merge_cells('A2:D2')

        row = 4
        if filters:
            ws_summary[f'A{row}'] = 'Застосовані фільтри:'
            ws_summary[f'A{row}'].font = Font(bold=True)
            row += 1
            for key, value in filters.items():
                if value:
                    ws_summary[f'A{row}'] = f'{key}:'
                    ws_summary[f'B{row}'] = str(value)
                    row += 1
            row += 1

        ws_summary[f'A{row}'] = 'Показник'
        ws_summary[f'B{row}'] = 'Значення'
        for cell in [ws_summary[f'A{row}'], ws_summary[f'B{row}']]:
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.border = cls.BORDER
            cell.alignment = cls.ALIGN_CENTER

        row += 1
        stats_rows = [
            ('Середній час до офферу (днів)', statistics.get('overall_avg', '—')),
            ('Медіана (днів)', statistics.get('median', '—')),
            ('Всього офферів', statistics.get('total_offers', 0)),
        ]
        for label, value in stats_rows:
            ws_summary[f'A{row}'] = label
            ws_summary[f'B{row}'] = value
            ws_summary[f'A{row}'].border = cls.BORDER
            ws_summary[f'B{row}'].border = cls.BORDER
            ws_summary[f'A{row}'].alignment = cls.ALIGN_LEFT
            ws_summary[f'B{row}'].alignment = cls.ALIGN_CENTER
            row += 1

        row += 1
        ws_summary[f'A{row}'] = 'Розподіл за періодами'
        ws_summary.merge_cells(f'A{row}:C{row}')
        ws_summary[f'A{row}'].fill = cls.SUBHEADER_FILL
        ws_summary[f'A{row}'].font = cls.SUBHEADER_FONT
        ws_summary[f'A{row}'].alignment = cls.ALIGN_CENTER

        row += 1
        ws_summary[f'A{row}'] = 'Діапазон (днів)'
        ws_summary[f'B{row}'] = 'Кількість'
        ws_summary[f'C{row}'] = '%'
        for cell in [ws_summary[f'A{row}'], ws_summary[f'B{row}'], ws_summary[f'C{row}']]:
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.border = cls.BORDER
            cell.alignment = cls.ALIGN_CENTER

        row += 1
        for dist in statistics.get('distribution', []):
            ws_summary[f'A{row}'] = dist['range']
            ws_summary[f'B{row}'] = dist['count']
            ws_summary[f'C{row}'] = dist['percentage']
            for col in ['A', 'B', 'C']:
                ws_summary[f'{col}{row}'].border = cls.BORDER
                ws_summary[f'{col}{row}'].alignment = cls.ALIGN_CENTER
            row += 1

        ws_summary.column_dimensions['A'].width = 35
        ws_summary.column_dimensions['B'].width = 20
        ws_summary.column_dimensions['C'].width = 15

        ws_details = wb.create_sheet(title="Детальні дані")

        headers = [
            'ID', "Ім'я", 'Прізвище', 'Email', 'Телефон',
            'Вакансія', 'HR Менеджер', 'Дата створення',
            'Дата офферу', 'Днів до офферу'
        ]

        for col_idx, header in enumerate(headers, 1):
            cell = ws_details.cell(row=1, column=col_idx, value=header)
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.border = cls.BORDER
            cell.alignment = cls.ALIGN_CENTER

        for row_idx, data in enumerate(time_data, 2):
            ws_details.cell(row=row_idx, column=1, value=data.get('candidate_id'))
            ws_details.cell(row=row_idx, column=2,
                            value=data.get('candidate_name', '').split()[0] if data.get('candidate_name') else '')
            ws_details.cell(row=row_idx, column=3,
                            value=' '.join(data.get('candidate_name', '').split()[1:]) if data.get(
                                'candidate_name') else '')
            ws_details.cell(row=row_idx, column=4, value='')  # email не передається в time_data
            ws_details.cell(row=row_idx, column=5, value='')  # phone не передається
            ws_details.cell(row=row_idx, column=6, value=data.get('vacancy_title', '—'))
            ws_details.cell(row=row_idx, column=7, value=data.get('assigned_to_name', '—'))
            ws_details.cell(row=row_idx, column=8,
                            value=data.get('new_date').strftime('%d.%m.%Y') if data.get('new_date') else '—')
            ws_details.cell(row=row_idx, column=9,
                            value=data.get('offer_date').strftime('%d.%m.%Y') if data.get('offer_date') else '—')
            ws_details.cell(row=row_idx, column=10, value=data.get('days', 0))

            for col in range(1, 11):
                cell = ws_details.cell(row=row_idx, column=col)
                cell.border = cls.BORDER
                cell.alignment = cls.ALIGN_CENTER

        col_widths = [8, 15, 15, 25, 15, 25, 20, 15, 15, 15]
        for idx, width in enumerate(col_widths, 1):
            ws_details.column_dimensions[get_column_letter(idx)].width = width

        if statistics.get('by_vacancy'):
            ws_vacancy = wb.create_sheet(title="По вакансіях")

            vac_headers = ['Вакансія', 'Середнє (днів)', 'Медіана', 'Мін', 'Макс', 'Кількість офферів']
            for col_idx, header in enumerate(vac_headers, 1):
                cell = ws_vacancy.cell(row=1, column=col_idx, value=header)
                cell.fill = cls.HEADER_FILL
                cell.font = cls.HEADER_FONT
                cell.border = cls.BORDER
                cell.alignment = cls.ALIGN_CENTER

            for row_idx, vac in enumerate(statistics['by_vacancy'], 2):
                ws_vacancy.cell(row=row_idx, column=1, value=vac.get('vacancy_title', '—'))
                ws_vacancy.cell(row=row_idx, column=2, value=vac.get('avg_days', 0))
                ws_vacancy.cell(row=row_idx, column=3, value=vac.get('median_days', 0))
                ws_vacancy.cell(row=row_idx, column=4, value=vac.get('min_days', 0))
                ws_vacancy.cell(row=row_idx, column=5, value=vac.get('max_days', 0))
                ws_vacancy.cell(row=row_idx, column=6, value=vac.get('offers_count', 0))

                for col in range(1, 7):
                    cell = ws_vacancy.cell(row=row_idx, column=col)
                    cell.border = cls.BORDER
                    cell.alignment = cls.ALIGN_CENTER

            for idx, width in enumerate([30, 15, 15, 10, 10, 18], 1):
                ws_vacancy.column_dimensions[get_column_letter(idx)].width = width

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response[
            'Content-Disposition'] = f'attachment; filename="time_to_hire_{datetime.now().strftime("%Y%m%d_%H%M")}.xlsx"'
        return response

    @classmethod
    def export_hr_effectiveness_excel(
            cls,
            hr_data: List[Dict[str, Any]],
            summary: Dict[str, Any],
            filters: Dict[str, Any] = None
    ) -> HttpResponse:

        if not OPENPYXL_AVAILABLE:
            raise ImportError("openpyxl не встановлено. Використайте: pip install openpyxl")

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Ефективність HR"

        ws['A1'] = 'Аналітика ефективності HR-менеджерів'
        ws['A1'].font = Font(size=16, bold=True, color='7A1A2E')
        ws.merge_cells('A1:H1')
        ws['A1'].alignment = cls.ALIGN_CENTER

        ws['A2'] = f'Звіт сформовано: {datetime.now().strftime("%d.%m.%Y %H:%M")}'
        ws['A2'].font = Font(italic=True, color='666666')
        ws.merge_cells('A2:H2')

        row = 4
        summary_items = [
            ('Всього HR-менеджерів', summary.get('total_hr', 0)),
            ('Всього кандидатів', summary.get('total_candidates', 0)),
            ('Всього офферів', summary.get('total_offers', 0)),
            ('Загальна конверсія', f"{summary.get('overall_conversion', 0)}%"),
        ]
        for label, value in summary_items:
            ws[f'A{row}'] = label
            ws[f'B{row}'] = value
            ws[f'A{row}'].font = Font(bold=True)
            ws[f'A{row}'].border = cls.BORDER
            ws[f'B{row}'].border = cls.BORDER
            row += 1

        row += 1
        headers = [
            "Ім'я HR", 'Username', 'Email', 'Всього кандидатів',
            'Офферів', 'Співбесід', 'Відмов', 'Активних',
            'Конверсія %', 'Співбесід+ %', 'Середній час (днів)',
            'Нові', 'Скринінг', 'Співбесіда', 'Оффер', 'Відмова'
        ]

        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col_idx, value=header)
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.border = cls.BORDER
            cell.alignment = cls.ALIGN_CENTER

        data_start_row = row + 1
        for hr in hr_data:
            row += 1
            ws.cell(row=row, column=1, value=hr.get('hr_name', '—'))
            ws.cell(row=row, column=2, value=hr.get('hr_username', '—'))
            ws.cell(row=row, column=3, value=hr.get('hr_email', '—'))
            ws.cell(row=row, column=4, value=hr.get('total_candidates', 0))
            ws.cell(row=row, column=5, value=hr.get('offers_count', 0))
            ws.cell(row=row, column=6, value=hr.get('interviews_count', 0))
            ws.cell(row=row, column=7, value=hr.get('rejected_count', 0))
            ws.cell(row=row, column=8, value=hr.get('active_candidates', 0))
            ws.cell(row=row, column=9, value=hr.get('conversion_rate', 0))
            ws.cell(row=row, column=10, value=hr.get('interview_rate', 0))
            ws.cell(row=row, column=11,
                    value=hr.get('time_to_hire_avg') if hr.get('time_to_hire_avg') is not None else '—')

            by_status = hr.get('by_status', {})
            ws.cell(row=row, column=12, value=by_status.get('new', 0))
            ws.cell(row=row, column=13, value=by_status.get('screening', 0))
            ws.cell(row=row, column=14, value=by_status.get('interview', 0))
            ws.cell(row=row, column=15, value=by_status.get('offer', 0))
            ws.cell(row=row, column=16, value=by_status.get('rejected', 0))

            for col in range(1, 17):
                cell = ws.cell(row=row, column=col)
                cell.border = cls.BORDER
                cell.alignment = cls.ALIGN_CENTER

        for idx in range(1, 17):
            ws.column_dimensions[get_column_letter(idx)].width = 18

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response[
            'Content-Disposition'] = f'attachment; filename="hr_effectiveness_{datetime.now().strftime("%Y%m%d_%H%M")}.xlsx"'
        return response

    @classmethod
    def export_time_to_hire_pdf(
            cls,
            time_data: List[Dict[str, Any]],
            statistics: Dict[str, Any],
            filters: Dict[str, Any] = None
    ) -> HttpResponse:
        if not REPORTLAB_AVAILABLE:
            raise ImportError("reportlab не встановлено. Використайте: pip install reportlab")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#7A1A2E'),
            spaceAfter=20,
            alignment=1  # center
        )
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#7A1A2E'),
            spaceAfter=10,
            spaceBefore=15
        )
        normal_style = styles['Normal']
        normal_style.fontSize = 9

        elements = []
        elements.append(Paragraph("Аналітика Time-to-Hire", title_style))
        elements.append(Paragraph(
            f"Звіт сформовано: {datetime.now().strftime('%d.%m.%Y %H:%M')}",
            ParagraphStyle('DateStyle', parent=normal_style, alignment=1, textColor=colors.grey)
        ))
        elements.append(Spacer(1, 20))

        if filters:
            filter_text = "Фільтри: " + ", ".join([f"{k}={v}" for k, v in filters.items() if v])
            elements.append(Paragraph(filter_text, normal_style))
            elements.append(Spacer(1, 10))

        elements.append(Paragraph("Загальна статистика", heading_style))

        stats_data = [
            ['Показник', 'Значення'],
            ['Середній час до офферу', f"{statistics.get('overall_avg', '—')} днів"],
            ['Медіана', f"{statistics.get('median', '—')} днів"],
            ['Всього офферів', str(statistics.get('total_offers', 0))],
        ]

        stats_table = Table(stats_data, colWidths=[8 * cm, 6 * cm])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7A1A2E')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F5F5F5')),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
        ]))
        elements.append(stats_table)
        elements.append(Spacer(1, 20))

        # Розподіл
        elements.append(Paragraph("Розподіл за періодами", heading_style))

        dist_data = [['Діапазон (днів)', 'Кількість', '%']]
        for dist in statistics.get('distribution', []):
            dist_data.append([dist['range'], str(dist['count']), f"{dist['percentage']}%"])

        dist_table = Table(dist_data, colWidths=[6 * cm, 4 * cm, 4 * cm])
        dist_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7A1A2E')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
        ]))
        elements.append(dist_table)
        elements.append(PageBreak())

        elements.append(Paragraph("Детальні дані по кандидатах", heading_style))

        detail_data = [['ID', "Ім'я", 'Вакансія', 'HR', 'Дата офферу', 'Днів']]
        for data in time_data[:50]:  # Обмежуємо для PDF
            detail_data.append([
                str(data.get('candidate_id', '')),
                data.get('candidate_name', '—'),
                data.get('vacancy_title', '—'),
                data.get('assigned_to_name', '—') or '—',
                data.get('offer_date').strftime('%d.%m.%Y') if data.get('offer_date') else '—',
                str(data.get('days', 0))
            ])

        detail_table = Table(detail_data, colWidths=[1.5 * cm, 4 * cm, 4 * cm, 3 * cm, 2.5 * cm, 1.5 * cm])
        detail_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7A1A2E')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
        ]))
        elements.append(detail_table)

        doc.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response[
            'Content-Disposition'] = f'attachment; filename="time_to_hire_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'
        return response

    @classmethod
    def export_hr_effectiveness_pdf(
            cls,
            hr_data: List[Dict[str, Any]],
            summary: Dict[str, Any],
            filters: Dict[str, Any] = None
    ) -> HttpResponse:

        if not REPORTLAB_AVAILABLE:
            raise ImportError("reportlab не встановлено. Використайте: pip install reportlab")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=1.5 * cm,
            leftMargin=1.5 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#7A1A2E'),
            spaceAfter=20,
            alignment=1
        )
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#7A1A2E'),
            spaceAfter=10,
            spaceBefore=15
        )

        elements = []

        elements.append(Paragraph("Ефективність HR-менеджерів", title_style))
        elements.append(Paragraph(
            f"Звіт сформовано: {datetime.now().strftime('%d.%m.%Y %H:%M')}",
            ParagraphStyle('DateStyle', parent=styles['Normal'], alignment=1, textColor=colors.grey)
        ))
        elements.append(Spacer(1, 15))

        elements.append(Paragraph("Загальна інформація", heading_style))
        summary_data = [
            ['Показник', 'Значення'],
            ['Всього HR', str(summary.get('total_hr', 0))],
            ['Всього кандидатів', str(summary.get('total_candidates', 0))],
            ['Всього офферів', str(summary.get('total_offers', 0))],
            ['Загальна конверсія', f"{summary.get('overall_conversion', 0)}%"],
        ]
        summary_table = Table(summary_data, colWidths=[8 * cm, 6 * cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7A1A2E')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))

        elements.append(Paragraph("Детальна статистика по HR", heading_style))

        hr_table_data = [[
            "HR", 'Всього', 'Офферів', 'Співбесід', 'Відмов', 'Активних',
            'Конверсія %', 'Співбесід+ %', 'Середній час'
        ]]

        for hr in hr_data:
            hr_table_data.append([
                hr.get('hr_name', '—'),
                str(hr.get('total_candidates', 0)),
                str(hr.get('offers_count', 0)),
                str(hr.get('interviews_count', 0)),
                str(hr.get('rejected_count', 0)),
                str(hr.get('active_candidates', 0)),
                f"{hr.get('conversion_rate', 0)}%",
                f"{hr.get('interview_rate', 0)}%",
                f"{hr.get('time_to_hire_avg', '—')} днів" if hr.get('time_to_hire_avg') else '—'
            ])

        hr_table = Table(hr_table_data,
                         colWidths=[4 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm, 3 * cm, 3 * cm, 3 * cm])
        hr_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7A1A2E')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
        ]))
        elements.append(hr_table)

        doc.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response[
            'Content-Disposition'] = f'attachment; filename="hr_effectiveness_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'
        return response