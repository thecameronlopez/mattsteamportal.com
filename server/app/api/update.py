from flask import Blueprint, jsonify, request, current_app
from app.models import User, Post, TimeOffStatusEnum, RoleEnum, TimeOffRequest, DepartmentEnum, Schedule, Shift
from app.extensions import db
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from pdf2image import convert_from_path
from datetime import time
import os
import platform
import re

update_bp = Blueprint("update", __name__)

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@update_bp.route("/update_post/<int:id>", methods=["PATCH"])
@login_required
def update_post(id):
    post = Post.query.get(id)
    if not post:
        return jsonify(success=False, message="Could not edit this post."), 403
    
    if post.author_id != current_user.id:
        return jsonify(success=False, message="You are not authorized to delete this post."), 403
    title = request.form.get("title", "").strip()
    content = request.form.get("content", "").strip()
    category = request.form.get("category", "").strip()
    file = request.files.get("upload")
    
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)
    file_path = post.file_path
    
    if file and allowed_file(file.filename):
        safe_filename = secure_filename(file.filename)
        
        if post.file_path:
            old_file = os.path.join(current_app.root_path, post.file_path.strip("/"))
            if os.path.exists(old_file):
                os.remove(old_file)
        
        if file.filename.lower().endswith(".pdf"):
            pdf_save_path = os.path.join(upload_folder, f"{current_user.id}_{safe_filename}")
            file.save(pdf_save_path)
            
            poppler_path = None
            
            if platform.system() == "Windows":
                poppler_path = r"C:\\Program Files\\poppler-25.07.0\\Library\\bin"
            
            images = convert_from_path(
                pdf_save_path,
                dpi=200,
                fmt="png",
                poppler_path=poppler_path
            )
            
            png_filename = f"{current_user.id}_{safe_filename.rsplit('.',1)[0]}.png"
            png_save_path = os.path.join(upload_folder, png_filename)
            images[0].save(png_save_path, "PNG")
            
            os.remove(pdf_save_path)
            file_path = f"/uploads/{png_filename}"
        else:
            filename = f"{current_user.id}_{safe_filename}"
            save_path = os.path.join(upload_folder, filename)
            file.save(save_path)
            file_path = f"/uploads/{filename}"
    
    post.title = title or post.title
    post.content = content or post.content
    post.category = category or post.category
    post.file_path = file_path
    
    try:
        db.session.commit()
        
        current_app.logger.info(f"{current_user.first_name} {current_user.last_name} has edited post #{post.id}")
        return jsonify(success=True, message="Post updated successfully"), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[POST UPDATE ERROR]: {e}")
        return jsonify(success=False, message="There was an error when updating post"), 500
    
    
@update_bp.route("/time_off_request/<int:id>/<status>", methods=["PATCH"])
@login_required
def update_time_off_status(id, status):
    if current_user.role not in [RoleEnum.ADMIN]:
        return jsonify(success=False, message="Unauthorized"), 403
    
    time_off_request = TimeOffRequest.query.get(id)
    
    if not time_off_request:
        return jsonify(success=False, message="Request not found"), 404
    
    try:
        new_status = TimeOffStatusEnum(status.lower())
    except ValueError:
        return jsonify(success=False, message="Invalid request status"), 400

    if time_off_request.status == new_status:
        return jsonify(success=False, message="Status already set"), 400
    
    if new_status == TimeOffStatusEnum.APPROVED:
        Schedule.query.filter(
            Schedule.user_id == time_off_request.user_id,
            Schedule.shift_date.between(time_off_request.start_date, time_off_request.end_date)
        ).delete(synchronize_session=False)
        
    time_off_request.status = new_status
    
    try:
        db.session.commit()
        current_app.logger.info(f"Time off request {id} updated to {status} by {current_user.id}")
        return jsonify(success=True, message="Request updated successfully"), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[TIME OFF UPDATE ERROR]: {e}")
        return jsonify(success=False, message="There was an error when updating time off request"), 500


@update_bp.route("/shift/<int:id>", methods=["PUT"])
@login_required
def update_shift(id):
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403

    data = request.get_json()
    if not data:
        return jsonify(success=False, message="No input data provided"), 400

    shift = Shift.query.get(id)
    if not shift:
        return jsonify(success=False, message="Shift not found"), 404

    title = (data.get("title") or "").strip()
    start_str = data.get("start_time")
    end_str = data.get("end_time")

    if not title:
        return jsonify(success=False, message="Shift title is required"), 400

    if bool(start_str) != bool(end_str):
        return jsonify(success=False, message="Start and end times must both be provided"), 400

    try:
        shift.title = title
        shift.start_time = time.fromisoformat(start_str) if start_str else None
        shift.end_time = time.fromisoformat(end_str) if end_str else None

        db.session.commit()
        current_app.logger.info(
            f"{current_user.first_name} {current_user.last_name} updated shift #{shift.id}."
        )
        return jsonify(
            success=True,
            message="Shift updated successfully",
            shift=shift.serialize(),
        ), 200
    except ValueError:
        return jsonify(success=False, message="Invalid Time Format"), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[SHIFT UPDATE ERROR]: {e}")
        return jsonify(success=False, message="There was an error when updating shift"), 500


@update_bp.route("/user/<int:id>", methods=["PUT"])
@login_required
def update_user(id):
    data = request.get_json()
    if not data:
        return jsonify(success=False, message="No input data provided"), 400

    user = User.query.get_or_404(id)

    # 🔐 Authorization
    is_admin = current_user.role == RoleEnum.ADMIN
    is_self = current_user.id == user.id

    if not (is_admin or is_self):
        return jsonify(success=False, message="Not authorized"), 403

    # 🚫 Immutable fields
    forbidden_fields = {"id", "password", "password_hash"}
    if forbidden_fields & data.keys():
        return jsonify(success=False, message="Attempted to update restricted fields"), 400

    # 🧾 Editable fields
    if "first_name" in data:
        user.first_name = data["first_name"].title()

    if "last_name" in data:
        user.last_name = data["last_name"].title()
        
    if "username" in data:
        username = data["username"].lower().strip()
        if User.query.filter(User.username == username, User.id != user.id).first():
            return jsonify(success=False, message="Username already in use"), 400
        user.username = username

    if "email" in data:
        email = data["email"].lower().strip()
        if User.query.filter(User.email == email, User.id != user.id).first():
            return jsonify(success=False, message="Email already in use"), 400
        user.email = email

    if "phone_number" in data:
        phone = data["phone_number"]
        if phone:
            digits = re.sub(r"\D", "", phone)
            if len(digits) != 10:
                return jsonify(success=False, message="Invalid phone number"), 400
            user.phone_number = digits
        else:
            user.phone_number = None

    # 🛡️ Admin-only fields
    if is_admin:
        if "role" in data:
            try:
                user.role = RoleEnum(data["role"].lower())
            except ValueError:
                return jsonify(success=False, message="Invalid role"), 400

        if "department" in data:
            try:
                user.department = DepartmentEnum(data["department"].lower())
            except ValueError:
                return jsonify(success=False, message="Invalid department"), 400

    db.session.commit()

    current_app.logger.info(
        f"User {user.id} updated by {current_user.id}"
    )

    return jsonify(success=True, user=user.serialize(), message="User updated successfully"), 200
