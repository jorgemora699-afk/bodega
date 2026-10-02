from datetime import datetime

from flask import Blueprint, request, jsonify
from app.application.admin_service import AdminService
from app.interfaces.auth_helpers import exigir_rol
from app.interfaces.date_helpers import parsear_fecha

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.before_request
def _proteger_admin():
    return exigir_rol("jefe")


@admin_bp.route("/resumen-ventas", methods=["GET"])
def resumen_ventas():
    periodo = request.args.get("periodo", default="dia")
    anio = request.args.get("anio", type=int)
    mes = request.args.get("mes", type=int)
    try:
        resumen = AdminService.resumen_ventas(periodo, anio=anio, mes=mes)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(resumen), 200


@admin_bp.route("/productos-mas-vendidos", methods=["GET"])
def productos_mas_vendidos():
    periodo = request.args.get("periodo", default="dia")
    limite = request.args.get("limite", default=10, type=int)
    anio = request.args.get("anio", type=int)
    mes = request.args.get("mes", type=int)
    try:
        productos = AdminService.productos_mas_vendidos(periodo, limite, anio=anio, mes=mes)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(productos), 200


@admin_bp.route("/balance", methods=["GET"])
def balance():
    periodo = request.args.get("periodo", default="mes")
    try:
        resultado = AdminService.balance(periodo)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(resultado), 200

@admin_bp.route("/ventas-por-trabajadora", methods=["GET"])
def ventas_por_trabajadora():
    periodo = request.args.get("periodo", default="dia")
    anio = request.args.get("anio", type=int)
    mes = request.args.get("mes", type=int)
    try:
        resultado = AdminService.ventas_por_trabajadora(periodo, anio=anio, mes=mes)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(resultado), 200


@admin_bp.route("/ventas-por-dia", methods=["GET"])
def ventas_por_dia():
    periodo = request.args.get("periodo", default="semana")
    anio = request.args.get("anio", type=int)
    mes = request.args.get("mes", type=int)
    try:
        resultado = AdminService.ventas_por_dia(periodo, anio=anio, mes=mes)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(resultado), 200


@admin_bp.route("/tendencia-mensual", methods=["GET"])
def tendencia_mensual():
    meses = request.args.get("meses", default=6, type=int)
    resultado = AdminService.tendencia_mensual(meses)
    return jsonify(resultado), 200

@admin_bp.route("/salarios", methods=["GET"])
def calcular_salarios():
    desde_str = request.args.get("desde")
    hasta_str = request.args.get("hasta")

    if not desde_str or not hasta_str:
        return jsonify({"error": "desde y hasta son obligatorios"}), 400

    desde = datetime.strptime(desde_str, "%Y-%m-%d").date()
    hasta = datetime.strptime(hasta_str, "%Y-%m-%d").date()

    resultado = AdminService.calcular_salarios(desde, hasta)
    return jsonify(resultado), 200


@admin_bp.route("/salario", methods=["GET"])
def calcular_salario():
    trabajadora_id = request.args.get("trabajadora_id", type=int)
    desde_str = request.args.get("desde")
    hasta_str = request.args.get("hasta")

    if not trabajadora_id or not desde_str or not hasta_str:
        return jsonify({"error": "trabajadora_id, desde y hasta son obligatorios"}), 400

    try:
        desde = parsear_fecha(desde_str, "desde")
        hasta = parsear_fecha(hasta_str, "hasta")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    resultado, error = AdminService.calcular_salario(trabajadora_id, desde, hasta)
    if error:
        return jsonify({"error": error}), 404
    return jsonify(resultado), 200

from flask import send_file
from app.application.horario_service import HorarioService
from app.application.trabajadora_service import TrabajadoraService
from app.application.pdf_service import generar_pdf_salario, generar_pdf_reporte_general

@admin_bp.route("/trabajadoras/<int:trabajadora_id>/pdf", methods=["GET"])
def generar_pdf_trabajadora(trabajadora_id):
    desde_str = request.args.get("desde")
    hasta_str = request.args.get("hasta")

    if not desde_str or not hasta_str:
        return jsonify({"error": "desde y hasta son obligatorios"}), 400

    try:
        desde = parsear_fecha(desde_str, "desde")
        hasta = parsear_fecha(hasta_str, "hasta")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    trabajadora = TrabajadoraService.obtener_por_id(trabajadora_id)
    if not trabajadora:
        return jsonify({"error": "Trabajadora no encontrada"}), 404

    resultado, error = AdminService.calcular_salario(trabajadora_id, desde, hasta)
    if error:
        return jsonify({"error": error}), 404

    turnos = [h for h in HorarioService.listar(trabajadora_id) if desde <= h.fecha <= hasta]
    turnos.sort(key=lambda h: h.fecha)

    pdf_buffer = generar_pdf_salario(
        trabajadora_nombre=trabajadora.nombre,
        tipo_pago=trabajadora.tipo_pago,
        desde=desde,
        hasta=hasta,
        turnos=turnos,
        total_horas=resultado["total_horas"],
        salario_calculado=resultado["salario_calculado"] or 0,
        valor_hora=resultado["valor_hora"],
        salario_mensual=resultado["salario_mensual"],
    )

    nombre_archivo = f"salario_{trabajadora.nombre.replace(' ', '_')}_{desde.isoformat()}_{hasta.isoformat()}.pdf"
    return send_file(pdf_buffer, mimetype="application/pdf", as_attachment=True, download_name=nombre_archivo)


@admin_bp.route("/reporte-general/pdf", methods=["GET"])
def generar_pdf_reporte_general_endpoint():
    desde_str = request.args.get("desde")
    hasta_str = request.args.get("hasta")

    if not desde_str or not hasta_str:
        return jsonify({"error": "desde y hasta son obligatorios"}), 400

    try:
        desde = parsear_fecha(desde_str, "desde")
        hasta = parsear_fecha(hasta_str, "hasta")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    resultados = AdminService.calcular_salarios(desde, hasta)
    total_general = round(sum(r["salario_calculado"] or 0 for r in resultados), 2)

    pdf_buffer = generar_pdf_reporte_general(desde, hasta, resultados, total_general)
    nombre_archivo = f"reporte_nomina_{desde.isoformat()}_{hasta.isoformat()}.pdf"
    return send_file(pdf_buffer, mimetype="application/pdf", as_attachment=True, download_name=nombre_archivo)

@admin_bp.route("/dashboard-resumen", methods=["GET"])
def dashboard_resumen():
    periodo = request.args.get("periodo", default="dia")
    try:
        resumen = AdminService.dashboard_resumen(periodo)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(resumen), 200


@admin_bp.route("/metodos-pago", methods=["GET"])
def metodos_pago():
    periodo = request.args.get("periodo", default="dia")
    try:
        resultado = AdminService.metodos_pago(periodo)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(resultado), 200
@admin_bp.route("/salarios/marcar-pagado", methods=["POST"])
def marcar_salario_pagado():
    data = request.get_json()

    trabajadora_id = data.get("trabajadora_id")
    desde_str = data.get("desde")
    hasta_str = data.get("hasta")
    monto = data.get("monto")

    if not trabajadora_id or not desde_str or not hasta_str or monto is None:
        return jsonify({"error": "trabajadora_id, desde, hasta y monto son obligatorios"}), 400

    try:
        desde = parsear_fecha(desde_str, "desde")
        hasta = parsear_fecha(hasta_str, "hasta")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    pago, error = AdminService.marcar_salario_pagado(trabajadora_id, desde, hasta, monto)
    if error:
        status = 404 if error == "Trabajadora no encontrada" else 400
        return jsonify({"error": error}), status

    return jsonify(pago.to_dict()), 201


@admin_bp.route("/salarios/pagos", methods=["GET"])
def listar_pagos_trabajadora():
    trabajadora_id = request.args.get("trabajadora_id", type=int)
    desde_str = request.args.get("desde")
    hasta_str = request.args.get("hasta")

    if not trabajadora_id or not desde_str or not hasta_str:
        return jsonify({"error": "trabajadora_id, desde y hasta son obligatorios"}), 400

    try:
        desde = parsear_fecha(desde_str, "desde")
        hasta = parsear_fecha(hasta_str, "hasta")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    pagos = AdminService.listar_pagos_de_trabajadora(trabajadora_id, desde, hasta)
    return jsonify([p.to_dict() for p in pagos]), 200


@admin_bp.route("/salarios/pagos/<int:pago_id>", methods=["DELETE"])
def eliminar_pago(pago_id):
    exito, error = AdminService.eliminar_pago(pago_id)
    if not exito:
        return jsonify({"error": error}), 404
    return jsonify({"mensaje": "Pago eliminado"}), 200