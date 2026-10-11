from app.utils.demo_image import render_scale_photo


def _excavation(client, headers, code="T-1", year=2026):
    response = client.post(
        "/api/excavations",
        headers=headers,
        json={
            "code": code,
            "year": year,
            "center_north": 1000,
            "center_east": 2000,
            "center_elev": 100,
            "description": "Тестовый раскоп",
        },
    )
    assert response.status_code == 200, response.text
    excavation = response.json()
    users = client.get("/api/users", headers=headers)
    if users.status_code == 200:
        for user in users.json():
            if user["role"] == "field_archaeologist":
                assigned = client.put(f"/api/users/{user['id']}", headers=headers, json={"excavation_ids": user.get("excavation_ids", []) + [excavation["id"]]})
                assert assigned.status_code == 200
    return excavation


def _layer(client, headers, excavation_id, number=1, top=100.4, bottom=100.0):
    response = client.post(
        "/api/layers",
        headers=headers,
        json={
            "excavation_id": excavation_id,
            "number": number,
            "top_elev": top,
            "bottom_elev": bottom,
            "description": "Гумус",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _finding(client, headers, excavation_id, layer_id, number=1, material="керамика", **extra):
    payload = {
        "excavation_id": excavation_id,
        "layer_id": layer_id,
        "code": "K",
        "number": number,
        "north": 1001,
        "east": 2001,
        "elev": 100.2,
        "square": "A1",
        "material": material,
        "description": "Фрагмент",
    }
    payload.update(extra)
    response = client.post("/api/findings", headers=headers, json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def test_health_reports_postgis(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["postgis"]


def test_field_cannot_create_excavation(client, accounts):
    response = client.post(
        "/api/excavations",
        headers=accounts["field"],
        json={"code": "X", "year": 2026, "center_north": 1, "center_east": 2, "center_elev": 3},
    )
    assert response.status_code == 403


def test_layer_elevations_must_be_ordered(client, accounts):
    excavation = _excavation(client, accounts["supervisor"])
    response = client.post(
        "/api/layers",
        headers=accounts["field"],
        json={"excavation_id": excavation["id"], "number": 1, "top_elev": 1, "bottom_elev": 2},
    )
    assert response.status_code == 422


def test_finding_lifecycle_and_delete_protection(client, accounts):
    excavation = _excavation(client, accounts["supervisor"])
    layer = _layer(client, accounts["field"], excavation["id"])
    finding = _finding(client, accounts["field"], excavation["id"], layer["id"])
    assert finding["code"] == "K"
    updated = client.put(
        f"/api/findings/{finding['id']}",
        headers=accounts["field"],
        json={"description": "Уточнённое описание"},
    )
    assert updated.status_code == 200
    assert updated.json()["description"] == "Уточнённое описание"
    denied = client.delete(f"/api/findings/{finding['id']}", headers=accounts["field"])
    assert denied.status_code == 403
    blocked_layer = client.delete(f"/api/layers/{layer['id']}", headers=accounts["camera"])
    assert blocked_layer.status_code == 409
    blocked_excavation = client.delete(f"/api/excavations/{excavation['id']}", headers=accounts["supervisor"])
    assert blocked_excavation.status_code == 409
    removed = client.delete(f"/api/findings/{finding['id']}", headers=accounts["camera"])
    assert removed.status_code == 200


def test_photo_measurement_is_stored(client, accounts, tmp_path):
    excavation = _excavation(client, accounts["supervisor"])
    layer = _layer(client, accounts["field"], excavation["id"])
    finding = _finding(client, accounts["field"], excavation["id"], layer["id"])
    image = tmp_path / "scale.png"
    render_scale_photo(image)
    uploaded = client.post(
        "/api/photos",
        headers=accounts["field"],
        files={"file": ("scale.png", image.read_bytes(), "image/png")},
        data={"finding_id": str(finding["id"]), "photo_type": "finding", "has_scale": "true"},
    )
    assert uploaded.status_code == 200, uploaded.text
    measured = client.post(
        f"/api/findings/{finding['id']}/measure",
        headers=accounts["field"],
        json={
            "photo_id": uploaded.json()["id"],
            "measurement_type": "length",
            "scale_mm": 50,
            "scale_points": [{"x": 0, "y": 0}, {"x": 100, "y": 0}],
            "object_points": [{"x": 0, "y": 0}, {"x": 40, "y": 0}],
            "accept": True,
        },
    )
    assert measured.status_code == 200, measured.text
    body = measured.json()
    assert body["result_mm"] == 20
    assert body["accepted"] is True
    assert body["finding"]["length_mm"] == 20
    assert body["finding"]["measurement_method"] == "photo"
    rejected = client.post(
        f"/api/findings/{finding['id']}/measure",
        headers=accounts["field"],
        json={
            "photo_id": uploaded.json()["id"],
            "measurement_type": "width",
            "scale_mm": -5,
            "object_points": [{"x": 0, "y": 0}, {"x": 10, "y": 0}],
        },
    )
    assert rejected.status_code == 422


def test_gnss_preview_keeps_invalid_rows(client, accounts):
    excavation = _excavation(client, accounts["supervisor"])
    raw = "north,east,elev,point_type,comment\n1000,2000,100,corner,угол\nabc,2000,100,corner,ошибка\n"
    preview = client.post(
        "/api/gnss/preview",
        headers=accounts["field"],
        data={"excavation_id": str(excavation["id"])},
        files={"file": ("points.csv", raw.encode("utf-8"), "text/csv")},
    )
    assert preview.status_code == 200, preview.text
    rows = preview.json()["rows"]
    assert rows[0]["status"] == "ok"
    assert rows[1]["status"] == "error"
    imported = client.post(
        "/api/gnss/import",
        headers=accounts["field"],
        json={"excavation_id": excavation["id"], "source_name": "points.csv", "points": [rows[0]]},
    )
    assert imported.status_code == 200, imported.text
    assert imported.json()["imported"] == 1
    listed = client.get("/api/gnss", params={"excavation_id": excavation["id"]}, headers=accounts["field"])
    assert len(listed.json()) == 1


def test_filters_excel_pdf_and_print(client, accounts):
    excavation = _excavation(client, accounts["supervisor"])
    layer = _layer(client, accounts["field"], excavation["id"])
    _finding(client, accounts["field"], excavation["id"], layer["id"], number=1, material="керамика")
    _finding(client, accounts["field"], excavation["id"], layer["id"], number=2, material="металл")
    listed = client.get(
        "/api/findings",
        params={"excavation_id": excavation["id"], "material": "керамика"},
        headers=accounts["field"],
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    denied = client.post("/api/reports/findings", headers=accounts["field"], json={"excavation_id": excavation["id"]})
    assert denied.status_code == 403
    body = {"excavation_id": excavation["id"], "sort": "number", "order": "asc"}
    preview = client.post("/api/reports/findings", headers=accounts["camera"], json=body)
    assert preview.status_code == 200, preview.text
    assert "Полевая опись" in preview.json()["html"]
    xlsx = client.post("/api/reports/export", headers=accounts["camera"], json={**body, "format": "xlsx"})
    assert xlsx.status_code == 200, xlsx.text
    assert xlsx.content[:2] == b"PK"
    pdf = client.post("/api/reports/export", headers=accounts["camera"], json={**body, "format": "pdf"})
    assert pdf.status_code == 200, pdf.text
    assert pdf.content[:4] == b"%PDF"
    printed = client.post("/api/reports/print", headers=accounts["camera"], json=body)
    assert printed.status_code == 200
    assert "Полевая опись" in printed.text


def test_idempotent_finding_create(client, accounts):
    excavation = _excavation(client, accounts["supervisor"])
    layer = _layer(client, accounts["field"], excavation["id"])
    payload = {
        "excavation_id": excavation["id"],
        "layer_id": layer["id"],
        "code": "K",
        "number": 1,
        "material": "кость",
        "north": 1002,
        "east": 2002,
        "elev": 100.1,
    }
    headers = {**accounts["field"], "Idempotency-Key": "finding-once"}
    first = client.post("/api/findings", headers=headers, json=payload)
    second = client.post("/api/findings", headers=headers, json=payload)
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    listed = client.get("/api/findings", params={"excavation_id": excavation["id"]}, headers=accounts["field"])
    assert listed.json()["total"] == 1


def test_plan_reads_postgis_point(client, accounts):
    excavation = _excavation(client, accounts["supervisor"])
    layer = _layer(client, accounts["field"], excavation["id"])
    _finding(client, accounts["field"], excavation["id"], layer["id"])
    plan = client.get("/api/plan", params={"excavation_id": excavation["id"], "view": "ne"}, headers=accounts["field"])
    assert plan.status_code == 200, plan.text
    point = plan.json()["points"][0]
    assert point["wkt"].startswith("POINT")
    assert point["east"] == 2001
    assert point["north"] == 1001


def test_archived_excavation_is_locked(client, accounts):
    excavation = _excavation(client, accounts["supervisor"])
    archived = client.post(f"/api/excavations/{excavation['id']}/archive", headers=accounts["supervisor"])
    assert archived.status_code == 200
    layer = client.post(
        "/api/layers",
        headers=accounts["field"],
        json={"excavation_id": excavation["id"], "number": 1, "top_elev": 101, "bottom_elev": 100},
    )
    assert layer.status_code == 409
    removed = client.delete(f"/api/excavations/{excavation['id']}", headers=accounts["supervisor"])
    assert removed.status_code == 409


def test_finding_cannot_use_foreign_layer(client, accounts):
    first = _excavation(client, accounts["supervisor"], code="A-1")
    second = _excavation(client, accounts["supervisor"], code="B-1")
    layer = _layer(client, accounts["field"], first["id"])
    response = client.post(
        "/api/findings",
        headers=accounts["field"],
        json={
            "excavation_id": second["id"],
            "layer_id": layer["id"],
            "code": "K",
            "number": 1,
            "material": "керамика",
        },
    )
    assert response.status_code == 400


def test_field_is_limited_to_assigned_excavations(client, accounts):
    own = _excavation(client, accounts["supervisor"], code="OWN")
    other = _excavation(client, accounts["supervisor"], code="OTHER")
    own_layer = _layer(client, accounts["supervisor"], own["id"])
    other_layer = _layer(client, accounts["supervisor"], other["id"])
    hidden = _finding(client, accounts["supervisor"], other["id"], other_layer["id"])
    users = client.get("/api/users", headers=accounts["supervisor"]).json()
    field = next(user for user in users if user["role"] == "field_archaeologist")
    response = client.put(f"/api/users/{field['id']}", headers=accounts["supervisor"], json={"excavation_ids": [own["id"]]})
    assert response.status_code == 200
    assert [row["id"] for row in client.get("/api/excavations", headers=accounts["field"]).json()] == [own["id"]]
    assert client.get("/api/findings", headers=accounts["field"]).json()["total"] == 0
    assert client.get(f"/api/findings/{hidden['id']}", headers=accounts["field"]).status_code == 404
    assert client.put(f"/api/findings/{hidden['id']}", headers=accounts["field"], json={"description": "Forbidden"}).status_code == 404
    assert client.get(f"/api/plan?excavation_id={other['id']}", headers=accounts["field"]).status_code == 404
    assert client.post("/api/findings", headers=accounts["field"], json={"excavation_id":other["id"]}).status_code == 404
    created = client.post("/api/findings", headers=accounts["field"], json={"excavation_id":own["id"], "layer_id":own_layer["id"]})
    assert created.status_code == 200, created.text
    assert created.json()["code"].startswith("OWN-2026-")


def test_export_selection_and_plan_layer_color(client, accounts):
    excavation = _excavation(client, accounts["supervisor"])
    layer = _layer(client, accounts["supervisor"], excavation["id"])
    response = client.put(f"/api/layers/{layer['id']}", headers=accounts["supervisor"], json={"color":"#123456"})
    assert response.status_code == 200
    first = _finding(client, accounts["field"], excavation["id"], layer["id"], number=1)
    _finding(client, accounts["field"], excavation["id"], layer["id"], number=2)
    request = {"excavation_id":excavation["id"], "ids":[first["id"]], "photo_present":False, "q":"Фрагмент", "columns":["number"]}
    response = client.post("/api/reports/findings", headers=accounts["camera"], json=request)
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1
    assert response.json()["rows"] == [["1"]]
    plan = client.get(f"/api/plan?excavation_id={excavation['id']}&color_by=layer", headers=accounts["field"])
    assert plan.status_code == 200, plan.text
    assert {point["color"] for point in plan.json()["points"]} == {"#123456"}
