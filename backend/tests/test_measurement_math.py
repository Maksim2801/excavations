import pytest

from app.utils.measurement import calculate_measurement


def test_known_scale_gives_expected_millimetres():
    result = calculate_measurement(
        [{"x": 0, "y": 0}, {"x": 100, "y": 0}],
        [{"x": 0, "y": 10}, {"x": 40, "y": 10}],
        50,
    )
    assert result["scale_pixel_distance"] == 100
    assert result["object_pixel_distance"] == 40
    assert result["mm_per_pixel"] == 0.5
    assert result["result_mm"] == 20


def test_negative_scale_is_rejected():
    with pytest.raises(ValueError):
        calculate_measurement([{"x": 0, "y": 0}, {"x": 10, "y": 0}], [{"x": 0, "y": 0}, {"x": 5, "y": 0}], -5)
