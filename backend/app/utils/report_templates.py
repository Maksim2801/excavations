from html import escape


def build_inventory_html(
    *,
    title: str,
    meta_lines: list[str],
    headers: list[str],
    rows: list[list[str]],
    total: int,
    generated_at: str,
    author: str,
) -> str:
    head = "".join(f"<th>{escape(column)}</th>" for column in headers)
    body = []
    for row in rows:
        cells = "".join(f"<td>{escape(cell)}</td>" for cell in row)
        body.append(f"<tr>{cells}</tr>")
    meta = "".join(f"<p>{escape(line)}</p>" for line in meta_lines)
    table_body = "".join(body) or "<tr><td colspan='99'>Записи не найдены</td></tr>"
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>{escape(title)}</title>
  <style>
    body {{ font-family: "Times New Roman", Times, serif; color: #1c1915; margin: 24px; }}
    h1 {{ font-size: 22px; text-align: center; margin-bottom: 8px; }}
    .meta {{ margin: 8px 0 16px; }}
    .meta p {{ margin: 2px 0; }}
    table {{ border-collapse: collapse; width: 100%; font-size: 12px; }}
    th, td {{ border: 1px solid #333; padding: 4px 6px; vertical-align: top; text-align: left; }}
    th {{ background: #f3efe6; }}
    .units {{ margin-top: 12px; font-size: 12px; }}
    .sign {{ margin-top: 28px; }}
    @media print {{
      body {{ margin: 12mm; }}
      button {{ display: none; }}
    }}
  </style>
</head>
<body>
  <h1>{escape(title)}</h1>
  <div class="meta">{meta}</div>
  <table>
    <thead><tr>{head}</tr></thead>
    <tbody>{table_body}</tbody>
  </table>
  <p class="units">Единицы измерения: координаты North, East и Elev - метры; длина, ширина и толщина - миллиметры. Координаты округлены до 0,001 м, размеры - до 0,1 мм.</p>
  <p>Записей в выборке: {total}. Дата формирования: {escape(generated_at)}. Сформировал: {escape(author)}.</p>
  <div class="sign">
    <p>Полевая опись составлена по данным единого учёта находок.</p>
    <p>Ответственный ______________________ / {escape(author)} /</p>
  </div>
</body>
</html>"""


def build_formal_inventory_html(
    *,
    title: str,
    approver_role: str,
    approver_name: str,
    inventory_date: str,
    requisites: list[tuple[str, str]],
    headers: list[str],
    rows: list[list[str]],
    total: int,
    generated_at: str,
    author: str,
) -> str:
    head = "".join(f"<th>{escape(column)}</th>" for column in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{escape(str(cell or ''))}</td>" for cell in row) + "</tr>"
        for row in rows
    ) or f"<tr><td colspan='{max(len(headers), 1)}'>Записи не найдены</td></tr>"
    req_rows = "".join(
        f"<tr><th>{escape(label)}</th><td>{escape(value).replace(chr(10), '<br>')}</td></tr>"
        for label, value in requisites
    )
    date_line = inventory_date or "«__»_____________ ____ г."
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>{escape(title)}</title>
  <style>
    body {{ font-family: "Times New Roman", Times, serif; color: #1c1915; margin: 20px; }}
    .approve {{ text-align: right; margin-bottom: 20px; line-height: 1.35; }}
    .approve strong {{ display: block; }}
    h1 {{ font-size: 16px; text-align: center; margin: 12px 0 16px; }}
    .reqs {{ width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }}
    .reqs th {{ text-align: left; vertical-align: top; width: 38%; padding: 3px 6px 3px 0; font-weight: bold; }}
    .reqs td {{ vertical-align: top; padding: 3px 0; }}
    table.items {{ border-collapse: collapse; width: 100%; font-size: 11px; }}
    table.items th, table.items td {{ border: 1px solid #333; padding: 3px 4px; vertical-align: top; }}
    table.items th {{ background: #f3efe6; text-align: center; }}
    .footer {{ margin-top: 16px; font-size: 12px; }}
    .sign {{ margin-top: 28px; }}
    @media print {{
      body {{ margin: 12mm; }}
      button {{ display: none; }}
    }}
  </style>
</head>
<body>
  <div class="approve">
    <strong>УТВЕРЖДАЮ</strong>
    <div>{escape(approver_role or "")}</div>
    <div>{escape(approver_name or "")}</div>
    <div>_______________________</div>
    <div>{escape(date_line)}</div>
  </div>
  <h1>{escape(title)}</h1>
  <table class="reqs">{req_rows}</table>
  <table class="items">
    <thead><tr>{head}</tr></thead>
    <tbody>{body}</tbody>
  </table>
  <p class="footer">Предметов в описи: {total}. Размеры — см. Дата формирования: {escape(generated_at)}. Сформировал: {escape(author)}.</p>
  <div class="sign">
    <p>Опись составлена по данным единого учёта находок.</p>
    <p>Ответственный ______________________ / {escape(author)} /</p>
  </div>
</body>
</html>"""


def build_album_html(
    *,
    title: str,
    subtitle: str,
    figures: list[dict],
    generated_at: str,
    author: str,
    meta_lines: list[str] | None = None,
) -> str:
    toc = "".join(f"<li>{escape(figure.get('heading') or figure.get('caption') or '')}</li>" for figure in figures)
    blocks = []
    for figure in figures:
        heading = escape(figure.get("heading") or "")
        caption = escape(figure.get("caption") or "")
        details = "".join(f"<p>{escape(line)}</p>" for line in str(figure.get("details") or "").splitlines() if line.strip())
        data_url = figure.get("data_url") or ""
        img = f'<img src="{data_url}" alt="{heading}" />' if data_url else ""
        blocks.append(
            f"<figure><h2>{heading}</h2>{img}"
            f"<figcaption><strong>{caption}</strong>{details}</figcaption></figure>"
        )
    body = "".join(blocks) or "<p>Нет иллюстраций для выбранной выборки.</p>"
    meta = "".join(f"<p>{escape(line)}</p>" for line in (meta_lines or []) if line)
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>{escape(title)}</title>
  <style>
    body {{ font-family: "Times New Roman", Times, serif; margin: 24px; color: #1c1915; }}
    h1 {{ text-align: center; font-size: 22px; }}
    h2 {{ text-align: center; font-size: 14px; margin: 0 0 10px; }}
    .sub, .meta {{ text-align: left; margin-bottom: 16px; }}
    .meta p {{ margin: 2px 0; }}
    ol {{ margin-bottom: 28px; }}
    figure {{ page-break-after: always; text-align: center; margin: 0 0 24px; }}
    img {{ max-width: 100%; max-height: 55vh; object-fit: contain; }}
    figcaption {{ margin-top: 10px; font-size: 13px; text-align: left; }}
    figcaption p {{ margin: 2px 0; }}
    @media print {{ body {{ margin: 12mm; }} }}
  </style>
</head>
<body>
  <h1>{escape(title)}</h1>
  <p class="sub">{escape(subtitle or "")}</p>
  <div class="meta">{meta}</div>
  <p>Дата формирования: {escape(generated_at)}. Сформировал: {escape(author)}. Иллюстраций: {len(figures)}.</p>
  <h2>Список иллюстраций</h2>
  <ol>{toc}</ol>
  {body}
</body>
</html>"""
