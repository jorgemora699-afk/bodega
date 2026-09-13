"""
Genera reportes en PDF de horario y salario, usando reportlab.
Devuelve un BytesIO listo para enviar con send_file.
"""

import io
from datetime import datetime
from zoneinfo import ZoneInfo

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

BRASS = colors.HexColor("#9c7a3c")
BRASS_SOFT = colors.HexColor("#f3ecda")
INK = colors.HexColor("#1b1812")
MUTED = colors.HexColor("#6b6558")
LINE = colors.HexColor("#e7e1d3")

ZONA_COLOMBIA = ZoneInfo("America/Bogota")
NOMBRE_NEGOCIO = "Bodega línea amarilla"


def _formatear_hora(dt_utc):
    if dt_utc is None:
        return "—"
    local = dt_utc.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZONA_COLOMBIA)
    return local.strftime("%I:%M %p").lstrip("0")


def _formatear_fecha_larga(fecha):
    dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    return f"{dias[fecha.weekday()]} {fecha.day:02d}/{fecha.month:02d}"


def _formatear_moneda(valor):
    if valor is None:
        return "—"
    return f"${valor:,.0f}".replace(",", ".")


def _estilos():
    styles = getSampleStyleSheet()
    return {
        "titulo": ParagraphStyle("Titulo", parent=styles["Title"], fontSize=18, textColor=INK, spaceAfter=2),
        "subtitulo": ParagraphStyle("Subtitulo", parent=styles["Normal"], fontSize=11, textColor=MUTED, spaceAfter=14),
        "normal": ParagraphStyle("NormalInk", parent=styles["Normal"], fontSize=10, textColor=INK),
        "footer": ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=MUTED),
    }


def _tabla_turnos(turnos, style_normal):
    encabezado = ["Día", "Entrada", "Salida", "Horas"]
    datos = [encabezado]
    for t in turnos:
        horas = None
        if t.hora_entrada and t.hora_salida:
            horas = round((t.hora_salida - t.hora_entrada).total_seconds() / 3600, 2)
        datos.append([
            _formatear_fecha_larga(t.fecha),
            _formatear_hora(t.hora_entrada),
            _formatear_hora(t.hora_salida),
            f"{horas:.2f} h" if horas is not None else "en curso",
        ])

    if not turnos:
        return Paragraph("No hay turnos registrados en este período.", style_normal)

    tabla = Table(datos, colWidths=[45 * mm, 30 * mm, 30 * mm, 30 * mm])
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRASS),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BRASS_SOFT]),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return tabla


def generar_pdf_salario(trabajadora_nombre, tipo_pago, desde, hasta, turnos,
                         total_horas, salario_calculado, valor_hora=None, salario_mensual=None):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=22 * mm, bottomMargin=18 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
    )
    s = _estilos()
    story = []

    story.append(Paragraph(NOMBRE_NEGOCIO, s["subtitulo"]))
    story.append(Paragraph(f"Reporte de horario y salario — {trabajadora_nombre}", s["titulo"]))
    story.append(Paragraph(
        f"Período: {desde.strftime('%d/%m/%Y')} al {hasta.strftime('%d/%m/%Y')}", s["subtitulo"],
    ))
    story.append(Spacer(1, 6))

    story.append(_tabla_turnos(turnos, s["normal"]))

    if tipo_pago == "mensual" and turnos:
        story.append(Paragraph(
            "Nota: esta trabajadora tiene sueldo fijo mensual, las horas son solo informativas.",
            ParagraphStyle("Nota", parent=s["normal"], fontSize=8, textColor=MUTED, spaceBefore=6),
        ))

    story.append(Spacer(1, 18))

    if tipo_pago == "mensual":
        dias_periodo = (hasta - desde).days + 1
        resumen_data = [
            ["Salario mensual", _formatear_moneda(salario_mensual)],
            ["Días del período", f"{dias_periodo} día(s)"],
            ["Total a pagar (prorrateado)", _formatear_moneda(salario_calculado)],
        ]
    else:
        resumen_data = [
            ["Total horas trabajadas", f"{total_horas:.2f} h"],
            ["Valor por hora", _formatear_moneda(valor_hora)],
            ["Total a pagar", _formatear_moneda(salario_calculado)],
        ]

    tabla_resumen = Table(resumen_data, colWidths=[70 * mm, 40 * mm])
    tabla_resumen.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(tabla_resumen)

    story.append(Spacer(1, 24))
    story.append(Paragraph(
        f"Generado el {datetime.now(ZONA_COLOMBIA).strftime('%d/%m/%Y %I:%M %p')}", s["footer"],
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer


def generar_pdf_reporte_general(desde, hasta, resultados, total_general):
    """resultados: lista de dicts como los que devuelve AdminService.calcular_salario."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=22 * mm, bottomMargin=18 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
    )
    s = _estilos()
    story = []

    story.append(Paragraph(NOMBRE_NEGOCIO, s["subtitulo"]))
    story.append(Paragraph("Reporte general de nómina", s["titulo"]))
    story.append(Paragraph(
        f"Período: {desde.strftime('%d/%m/%Y')} al {hasta.strftime('%d/%m/%Y')}", s["subtitulo"],
    ))
    story.append(Spacer(1, 6))

    encabezado = ["Trabajadora", "Tipo de pago", "Horas", "A pagar"]
    datos_tabla = [encabezado]

    for r in resultados:
        datos_tabla.append([
            r["trabajadora_nombre"],
            "Sueldo fijo" if r["tipo_pago"] == "mensual" else "Por hora",
            f"{r['total_horas']:.2f} h" if r["tipo_pago"] == "hora" else "—",
            _formatear_moneda(r["salario_calculado"]),
        ])

    if not resultados:
        story.append(Paragraph("No hay trabajadoras activas registradas.", s["normal"]))
    else:
        tabla = Table(datos_tabla, colWidths=[55 * mm, 35 * mm, 25 * mm, 40 * mm])
        tabla.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRASS),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (0, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BRASS_SOFT]),
            ("GRID", (0, 0), (-1, -1), 0.5, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story.append(tabla)

    story.append(Spacer(1, 18))

    tabla_total = Table([["Total general a pagar", _formatear_moneda(total_general)]], colWidths=[70 * mm, 45 * mm])
    tabla_total.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 12),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
        ("LINEABOVE", (0, 0), (-1, 0), 0.75, BRASS),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(tabla_total)

    story.append(Spacer(1, 24))
    story.append(Paragraph(
        f"Generado el {datetime.now(ZONA_COLOMBIA).strftime('%d/%m/%Y %I:%M %p')}", s["footer"],
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer