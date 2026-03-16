from flask import Flask, send_from_directory
import click
from config import Config
from app.extensions import db, migrate, login_manager, cors, mail, bcrypt
from app.logger import setup_logger

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    #log setup
    logger = setup_logger("team_portal")
    app.logger.handlers = logger.handlers
    app.logger.setLevel(logger.level)
    
    app.logger.info("Team Portal has been intialized")

    # Initialize extensions here (e.g., database, migrations)
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    cors.init_app(app)
    mail.init_app(app)
    bcrypt.init_app(app)
    

    # Register blueprints here
    from app.api import api_bp
    app.register_blueprint(api_bp)
    
    @app.route("/uploads/<path:filename>", methods=["GET"])
    def uploaded_file(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    
    
    # User loader for Flask-Login
    from app.models import User
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    @app.cli.command("seed-reserved-shifts")
    def seed_reserved_shifts():
        from app.models import Shift

        reserved_shifts = [
            {
                "id": 9998,
                "title": "Custom",
                "start_time": None,
                "end_time": None,
            },
            {
                "id": 9999,
                "title": "OFF",
                "start_time": None,
                "end_time": None,
            },
        ]

        created = 0
        updated = 0

        for shift_data in reserved_shifts:
            shift = Shift.query.get(shift_data["id"])
            if shift:
                if (
                    shift.title != shift_data["title"]
                    or shift.start_time != shift_data["start_time"]
                    or shift.end_time != shift_data["end_time"]
                ):
                    shift.title = shift_data["title"]
                    shift.start_time = shift_data["start_time"]
                    shift.end_time = shift_data["end_time"]
                    updated += 1
                continue

            db.session.add(
                Shift(
                    id=shift_data["id"],
                    title=shift_data["title"],
                    start_time=shift_data["start_time"],
                    end_time=shift_data["end_time"],
                )
            )
            created += 1

        db.session.commit()
        click.echo(
            f"Reserved shifts seeded. Created: {created}, updated: {updated}."
        )

    return app
