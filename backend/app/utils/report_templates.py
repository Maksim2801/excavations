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
