from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from config import Config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app)

    with app.app_context():
        from app.infrastructure import models  # noqa: F401

    from app.interfaces.routes.producto_routes import producto_bp
    from app.interfaces.routes.trabajadora_routes import trabajadora_bp
    from app.interfaces.routes.venta_routes import venta_bp
    from app.interfaces.routes.inventario_routes import inventario_bp
    from app.interfaces.routes.proveedor_routes import proveedor_bp
    from app.interfaces.routes.horario_routes import horario_bp
    from app.interfaces.routes.receta_routes import receta_bp
    from app.interfaces.routes.ingreso_egreso_routes import ingreso_egreso_bp
    from app.interfaces.routes.admin_routes import admin_bp
    from app.interfaces.routes.auth_routes import auth_bp
    from app.interfaces.routes.orden_routes import orden_bp
    from app.interfaces.routes.insumo_routes import insumo_bp

    app.register_blueprint(producto_bp)
    app.register_blueprint(trabajadora_bp)
    app.register_blueprint(venta_bp)
    app.register_blueprint(inventario_bp)
    app.register_blueprint(proveedor_bp)
    app.register_blueprint(horario_bp)
    app.register_blueprint(receta_bp)
    app.register_blueprint(ingreso_egreso_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(orden_bp)
    app.register_blueprint(insumo_bp)

    return app