from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_interface_contains_required_workflow():
    app = read("frontend/app.js")
    inventory = read("frontend/modules/inventory.js")
    plan = read("frontend/modules/plan.js")
    photo = read("frontend/modules/photo.js")
    reports = read("frontend/modules/reports.js")
    gnss = read("frontend/modules/gnss.js")
    index = read("frontend/index.html")
    assert "Опись" in app and "План" in app and "Фотоанализ" in app
    assert "GNSS" in app and "Отчёты" in app
    assert "Новая находка" in inventory
    assert "Перейти к описи" in plan
    assert "Распознать маркер" in photo and "Принять" in photo
    assert "Excel" in reports and "PDF" in reports and "Печать" in reports
    assert "Полевая опись" in reports or "LAYOUTS" in reports
    state = read("frontend/modules/reportState.js")
    assert "layout" in state and "approver_name" in state
    assert "Полевая опись" in state and "Коллекционная опись" in state
    assert "Альбом иллюстраций" in state
    assert 'change("layout", key)' in reports or "layout" in reports
    assert "Подтвердить импорт" in gnss
    assert 'type="module"' in index
