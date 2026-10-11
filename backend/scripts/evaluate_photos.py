"""Measure accuracy and speed on the user's labelled photographs, without a database.

CSV columns: image,scale_mm,length_mm,width_mm. Image paths are relative to CSV.
python scripts/evaluate_photos.py samples.csv --out measurements.csv
"""
import argparse
import csv
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.photo_analysis import analyze_photo_file


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("samples", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--max-error-mm", type=float, default=2.0)
    parser.add_argument("--max-seconds", type=float, default=3.0)
    args = parser.parse_args()
    rows = []
    with args.samples.open(encoding="utf-8-sig", newline="") as source:
        samples = list(csv.DictReader(source))
    if not samples:
        parser.error("CSV не содержит контрольных снимков")
    for sample in samples:
        row = {"image": sample["image"]}
        start = time.perf_counter()
        try:
            reference_length = float(sample["length_mm"])
            reference_width = float(sample["width_mm"])
            if not 0 < reference_width <= reference_length <= 100:
                raise ValueError("Контрольные размеры должны удовлетворять 0 < ширина <= длина <= 100 мм")
            result = analyze_photo_file(str(args.samples.parent / sample["image"]), float(sample["scale_mm"]))
            row.update(status=result["status"], length_mm=result["length_mm"], width_mm=result["width_mm"])
            row["length_error_mm"] = None if result["length_mm"] is None else abs(result["length_mm"] - reference_length)
            row["width_error_mm"] = None if result["width_mm"] is None else abs(result["width_mm"] - reference_width)
        except (ValueError, KeyError, OSError) as error:
            row.update(status="error", error=str(error))
        row["seconds"] = round(time.perf_counter() - start, 4)
        row["passed"] = row.get("status") == "detected" and all(row.get(key) is not None and row[key] <= args.max_error_mm for key in ("length_error_mm", "width_error_mm")) and row["seconds"] <= args.max_seconds
        rows.append(row)
    fields = ["image", "status", "length_mm", "width_mm", "length_error_mm", "width_error_mm", "seconds", "passed", "error"]
    with args.out.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
    passed = sum(row["passed"] for row in rows)
    print(f"Прошли пороги: {passed}/{len(rows)}. Ошибка <= {args.max_error_mm} мм; время <= {args.max_seconds} с.")
    print("Вывод относится только к указанным снимкам и этому компьютеру. Не определяет толщину по виду сверху.")
    return 0 if passed == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
