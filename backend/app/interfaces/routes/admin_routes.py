from flask import Blueprint, request, jsonify
from datetime import datetime
from app.application.admin_service import AdminService

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


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

    desde = datetime.strptime(desde_str, "%Y-%m-%d").date()
    hasta = datetime.strptime(hasta_str, "%Y-%m-%d").date()

    resultado, error = AdminService.calcular_salario(trabajadora_id, desde, hasta)
    if error:
        return jsonify({"error": error}), 404
    return jsonify(resultado), 200