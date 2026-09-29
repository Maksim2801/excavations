import io
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

_FONTS_READY = False


def _font_files() -> tuple[str, str]:
    candidates = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
        (r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
    ]
    for regular, bold in candidates:
        if Path(regular).exists() and Path(bold).exists():
            return regular, bold
    raise FileNotFoundError("Не найден шрифт с поддержкой кириллицы для PDF")


def _ensure_fonts() -> None:
    global _FONTS_READY
    if _FONTS_READY:
        return
    regular, bold = _font_files()
    pdfmetrics.registerFont(TTFont("AppSans", regular))
    pdfmetrics.registerFont(TTFont("AppSans-Bold", bold))
    _FONTS_READY = True


def build_xlsx(title: str, meta_lines: list[str], headers: list[str], rows: list[list[str]]) -> bytes:
    frame = pd.DataFrame(rows, columns=headers)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Опись"
    sheet["A1"] = title
    sheet["A1"].font = Font(name="Calibri", bold=True, size=16, color="2C2416")
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=max(len(headers), 1))
    row_index = 3
    for line in meta_lines:
        sheet.cell(row_index, 1, line)
        row_index += 1
    sheet.cell(row_index, 1, "Единицы: координаты - м (0,001), размеры - мм (0,1).")
    header_row = row_index + 2
    header_fill = PatternFill("solid", fgColor="E7D7C1")
    thin = Border(
        left=Side(style="thin", color="B7A894"),
        right=Side(style="thin", color="B7A894"),
        top=Side(style="thin", color="B7A894"),
        bottom=Side(style="thin", color="B7A894"),
    )
    for column, header in enumerate(headers, start=1):
        cell = sheet.cell(header_row, column, header)
        cell.font = Font(bold=True)
        cell.fill = header_fill
        cell.border = thin
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    for offset, values in enumerate(frame.itertuples(index=False), start=1):
        for column, value in enumerate(values, start=1):
            cell = sheet.cell(header_row + offset, column, "" if value is None else str(value))
            cell.border = thin
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    for column in range(1, len(headers) + 1):
        sheet.column_dimensions[get_column_letter(column)].width = 18
    sheet.freeze_panes = f"A{header_row + 1}"
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.oddHeader.left.text = title
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def build_pdf(title: str, meta_lines: list[str], headers: list[str], rows: list[list[str]], generated_at: str) -> bytes:
    _ensure_fonts()
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=28,
        bottomMargin=28,
        title=title,
    )
    title_style = ParagraphStyle("TitleRu", fontName="AppSans-Bold", fontSize=14, leading=18, alignment=1)
    meta_style = ParagraphStyle("MetaRu", fontName="AppSans", fontSize=9, leading=12)
    cell_style = ParagraphStyle("CellRu", fontName="AppSans", fontSize=7, leading=9)
    header_style = ParagraphStyle("HeadRu", fontName="AppSans-Bold", fontSize=7, leading=9)
    story = [Paragraph(title, title_style), Spacer(1, 8)]
    for line in meta_lines:
        story.append(Paragraph(line, meta_style))
    story.append(Paragraph("Единицы измерения: координаты - метры, размеры - миллиметры.", meta_style))
    story.append(Paragraph(f"Дата формирования: {generated_at}", meta_style))
    story.append(Spacer(1, 8))
    header = [Paragraph(column, header_style) for column in headers]
    body = [[Paragraph(cell or "", cell_style) for cell in row] for row in rows] or [[Paragraph("Записи не найдены", cell_style)]]
    table = Table([header] + body, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "AppSans-Bold"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.91, 0.84, 0.76)),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.Color(0.35, 0.3, 0.24)),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(table)
    document.build(story)
    return buffer.getvalue()
