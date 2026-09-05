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
    try:
        resumen = AdminService.resumen_ventas(periodo)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(resumen), 200


@admin_bp.route("/productos-mas-vendidos", methods=["GET"])
def productos_mas_vendidos():
    periodo = request.args.get("periodo", default="dia")
    limite = request.args.get("limite", default=10, type=int)
    try:
        productos = AdminService.productos_mas_vendidos(periodo, limite)
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