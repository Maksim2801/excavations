from app.services.photo_analysis import analyze_image, detect_in_image
from app.utils.demo_image import render_scale_photo

import cv2
import numpy as np


def test_scale_bar_is_detected(tmp_path):
    path = tmp_path / "scale.png"
    render_scale_photo(path)
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    detected = detect_in_image(image)
    assert detected["status"] == "detected"
    assert len(detected["points"]) == 2
    distance = abs(detected["points"][1]["x"] - detected["points"][0]["x"])
    assert 370 <= distance <= 430
    assert "автоматически" in detected["message"]


def test_demo_photo_proposes_length_and_width(tmp_path):
    path = tmp_path / "scale.png"
    render_scale_photo(path)
    data = np.fromfile(path, dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    proposal = analyze_image(image, 100)
    assert proposal["status"] == "detected"
    assert proposal["object_status"] == "detected"
    assert 280 <= proposal["length_px"] <= 320
    assert 100 <= proposal["width_px"] <= 140
    assert 70 <= proposal["length_mm"] <= 80
    assert 28 <= proposal["width_mm"] <= 32
