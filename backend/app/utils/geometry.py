from geoalchemy2.elements import WKTElement


def point_element(east: float, north: float, elev: float) -> WKTElement:
    wkt = f"POINT Z ({float(east):.4f} {float(north):.4f} {float(elev):.4f})"
    return WKTElement(wkt, srid=0)
