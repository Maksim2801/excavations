from app.services.gnss_service import parse_gnss_csv


def test_csv_reports_invalid_rows():
    raw = """north,east,elev,point_type,comment
100,200,10,corner,угол
abc,200,10,corner,плохо
101,201,11,контрольная,репер
102,202,12,неизвестно,ошибка типа
""".encode("utf-8")
    rows = parse_gnss_csv(raw)
    assert [row["status"] for row in rows] == ["ok", "error", "ok", "error"]
    assert rows[2]["point_type"] == "control"
    assert rows[1]["errors"]
    assert rows[3]["errors"]
