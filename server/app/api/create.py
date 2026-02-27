from flask import Blueprint, jsonify, request, current_app
from app.models import User, Post, Shift, Comment, Schedule, LocationEnum, TimeOffRequest, PostVisibilityEnum, PostCategoryEnum, TimeOffStatusEnum, RoleEnum
from app.extensions import db
from flask_login import current_user, login_required
import os
from werkzeug.utils import secure_filename
from pdf2image import convert_from_path
import platform
from datetime import datetime, time, date
from flask_mailman import EmailMessage
from textwrap import dedent


ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def str_to_time(s):
    if not s:
        return None
    h, m = map(int, s.split(":"))
    return time(hour=h, minute=m)


create_bp = Blueprint("create", __name__)


@create_bp.route("/post", methods=["POST"])
@login_required
def create_post():
    
    title = request.form.get("title", "").strip()
    content = request.form.get("content", "").strip()
    category_str = request.form.get("category", "general").upper()
    visibility_str = request.form.get("visibility", "public").upper()
    
    try:
        category = PostCategoryEnum[category_str]
    except KeyError:
        return jsonify(success=False, message="Invalid category"), 400
    
    try:
        visibility = PostVisibilityEnum[visibility_str]
    except KeyError:
        return jsonify(success=False, message="Invalid visibility status"), 400
    
    file = request.files.get("upload")
    file_path = None

    
    if file and file.filename and allowed_file(file.filename):
        safe_filename = secure_filename(file.filename)
        upload_folder = current_app.config["UPLOAD_FOLDER"]
        os.makedirs(upload_folder, exist_ok=True)
        
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
        
    try:
        post = Post(
        title=title,
        content=content,
        category=category,
        visibility=visibility,
        file_path=file_path,
        author_id=current_user.id,
        )
        db.session.add(post)
        db.session.commit()
        
        current_app.logger.info(f"{current_user.first_name} {current_user.last_name} has created a post '{post.title}'")

        users = User.query.all()
        
        post_url = f"https://mattsteamportal.com/post/{post.id}"
        
        email_body = dedent(f"""\
        {current_user.username} just created a post on mattsteamportal.com,
        
        Title: {post.title}
        Category: {post.category.name if hasattr(post.category, "name") else post.category}
        
        Content:
        {post.content}
        
        
        Link: {post_url}                    
        """)
        
        for user in users:
            EmailMessage(
                subject=f"New Team Portal Post from {current_user.username}!",
                body=dedent(f"""\
            Hey {user.username},
                
            {email_body}
            """),
                to=[user.email],
            ).send()
            
        return jsonify(success=True, message="New post created!", post_id=post.id), 201
    except Exception as e:
        db.session.rollback()
        
        if file_path:
            try:
                os.remove(
                    os.path.join(
                        current_app.config["UPLOAD_FOLDER"],
                        os.path.basename(file_path)
                    )
                )
            except Exception:
                pass
            
        current_app.logger.error(f"[POST ERROR]: {e}")
        return jsonify(success=False, message=f"There was an error when submitting new post"), 500
        
    
    
@create_bp.route("/comment/<int:post_id>", methods=["POST"])
@login_required
def add_comment(post_id):
    data = request.get_json()
    comment = data.get("comment")
    try:
        new_comment = Comment(
            post_id=post_id,
            user_id=current_user.id,
            content=comment
        )
        db.session.add(new_comment)
        db.session.commit()
        
        current_app.logger.info(f"{current_user.first_name} {current_user.last_name} has commented on post {post_id}.")
        return jsonify(
            success=True, 
            message="Posted!", 
            comment=new_comment.serialize()
            ), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[COMMENT ERROR]: {e}")
        return jsonify(success=False, message="There was an error when posting new comment"), 500
    
    
    
#--------------------
#   MAKE A NEW SHIFT
#--------------------
@create_bp.route("/shift", methods=["POST"])
@login_required
def create_shift():
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    data = request.get_json()
    start_str = data.get("start_time")
    end_str = data.get("end_time")
    title = data.get("title")
    
    if not start_str or not end_str:
        off = Shift(title=title)
        db.session.add(off)
        db.session.commit()
        return jsonify(success=True, message="New shift created!"), 201
    
    try:
        start_time = time.fromisoformat(start_str)
        end_time = time.fromisoformat(end_str)
    except ValueError:
        return jsonify(success=False, message="Invalid Time Format"), 400
    try:
        new_shift = Shift(title=title, start_time=start_time, end_time=end_time)
        
        db.session.add(new_shift)
        db.session.commit()
        current_app.logger.info(f"{current_user.first_name} {current_user.last_name} has created a new shift '{title}'.")
        return jsonify(success=True, message="New shift created!", shift=new_shift.serialize()), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[SHIFT CREATION ERROR]: {e}")
        return jsonify(success=False, message="There was an error when adding new shift."), 500
    
    
#--------------------
#   BULK SCHEDULE COMMIT
#--------------------
@create_bp.route("/bulk_schedule", methods=["POST"])
@login_required
def create_bulk_schedule():
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    data = request.get_json()
    schedules = data.get("schedules")
    
    if not schedules:
        return jsonify(success=False, message="No schedules provided"), 400
    
    try:
        for item in schedules:
            user_id = item.get("user_id")
            shift_id = item.get("shift_id")
            shift_date_str = item.get("shift_date")
            location_str = item.get("location")
            
            custom_start = str_to_time(item.get("custom_start_time"))
            custom_end = str_to_time(item.get("custom_end_time"))
            
            if not all([user_id, shift_id, shift_date_str, location_str]):
                raise ValueError("Missing required fields")
            
            shift_date = date.fromisoformat(shift_date_str)
            location = LocationEnum(location_str.lower())
            
            conflict = TimeOffRequest.query.filter(
                TimeOffRequest.user_id == user_id,
                TimeOffRequest.start_date <= shift_date,
                TimeOffRequest.end_date >= shift_date,
                TimeOffRequest.status == TimeOffStatusEnum.APPROVED
            ).first()
            
            if conflict:
                return jsonify(
                    success=False, 
                    message=f"User {user_id} has approved time off on {shift_date}"
                ), 400
            
            exists = Schedule.query.filter_by(
                user_id=user_id,
                shift_date=shift_date
            ).first()
            
            if exists:
                exists.shift_id = shift_id
                exists.location = location              
                exists.custom_start_time = custom_start
                exists.custom_end_time = custom_end
                continue
            
            schedule_item = Schedule(
                user_id=user_id,
                shift_id=shift_id,
                shift_date=shift_date,
                location=location, 
                custom_start_time=custom_start,
                custom_end_time=custom_end
            )
            db.session.add(schedule_item)
        db.session.commit()
        
        try:
            users = User.query.all()
            for user in users:
                EmailMessage(
                    subject=f"New Schedule Posted!",
                    body=f"Hey {user.username}, a new schedule has just been posted on mattsteamportal.com",
                    to=[user.email],
                ).send()
        except Exception as e:
            current_app.logger.error(f"[SCHEDULE EMAIL ERROR]: {e}")

        current_app.logger.info(f"{current_user.first_name} {current_user.last_name} has created/updated bulk schedule items.")
        return jsonify(success=True, message="Shifts have been submitted!"), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[BULK SCHEDULE ERROR]: {e}")
        return jsonify(success=False, message=str(e)), 500
    
    
#--------------------
#   CREATE A NEW SCHEDULE ITEM
#--------------------
@create_bp.route("/schedule", methods=["POST"])
@login_required
def create_schedule_item():
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    data = request.get_json()
    user_id = data.get("user_id")
    shift_id = data.get("shift_id")
    shift_date_str = data.get("shift_date")
    location_str = data.get("location")
    
    if not all([user_id, shift_date_str, shift_id, location_str]):
        return jsonify(success=False, message="Missing required fields"), 400
    
    try:
        location = LocationEnum(location_str.lower())
        shift_date_obj = date.fromisoformat(shift_date_str)
    except ValueError:
        return jsonify(success=False, message="Invalid input"), 400
    
    if not User.query.get(user_id):
        return jsonify(success=False, message="User not found"), 404
    if not Shift.query.get(shift_id):
        return jsonify(success=False, message="Shift not found"), 404
    
    conflict = TimeOffRequest.query.filter(
        TimeOffRequest.user_id == user_id,
        TimeOffRequest.start_date <= shift_date_obj,
        TimeOffRequest.end_date >= shift_date_obj,
        TimeOffRequest.status == TimeOffStatusEnum.APPROVED
    ).first()
    
    if conflict:
        return jsonify(
            success=False,
            message="Cannot schedule employee on approved time off"
        ), 400
    
    existing = Schedule.query.filter_by(user_id=user_id, shift_id=shift_id, shift_date=shift_date_obj).first()
    if existing:
        return jsonify(success=False, message="Schedule conflict."), 400
    
    try:
        schedule_item = Schedule(
            user_id=user_id,
            shift_id=shift_id,
            shift_date=shift_date_obj,
            location=location
        )
        db.session.add(schedule_item)
        db.session.commit()
        return jsonify(success=True, message="Schedule submitted!", schedule=schedule_item.serialize()), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[SCHEDULE ERROR]: {e}")
        return jsonify(success=False, message="There was an error when making new schedule item."), 500
    
    
    
#--------------------
#   CREATE A NEW TIME OFF REQUEST
#--------------------    
@create_bp.route("/time_off_request", methods=["POST"])
@login_required
def time_off_request():
    data = request.get_json()
    start_str = data.get("start_date")
    end_str = data.get("end_date")
    reason = data.get("reason")
    is_pto = data.get("is_pto", False)
    
    try:
        start_date = date.fromisoformat(start_str)
        end_date = date.fromisoformat(end_str)
    except ValueError:
        return jsonify(success=False, message="Invalid date format. Use YYYY-MM-DD"), 400
    
    exists = TimeOffRequest.query.filter(
        TimeOffRequest.user_id == current_user.id,
        TimeOffRequest.start_date <= end_date,
        TimeOffRequest.end_date >= start_date
    ).first()
    if exists:
        return jsonify(success=False, message="This user already has a request off for this date."), 400
    
    try:
        time_off = TimeOffRequest(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            is_pto=is_pto
        )
        db.session.add(time_off)
        db.session.commit()
        current_app.logger.info(f"{current_user.first_name} {current_user.last_name} has submitted a time off request from {start_date} to {end_date}.")

        try:
            admins = User.query.filter(User.role == RoleEnum.ADMIN).all()
            if admins:
                subject = f"New Time Off Request: {current_user.first_name} {current_user.last_name}"
                for admin in admins:
                    EmailMessage(
                        subject=subject,
                        body=dedent(f"""\
                        Hey {admin.username},

                        {current_user.first_name} {current_user.last_name} submitted a new time off request.

                        Start Date: {start_date.isoformat()}
                        End Date: {end_date.isoformat()}
                        PTO: {"Yes" if is_pto else "No"}
                        Reason: {reason}

                        Review requests at: https://mattsteamportal.com/time-off-status-update
                        """),
                        to=[admin.email],
                    ).send()
        except Exception as email_error:
            current_app.logger.error(f"[TIME OFF EMAIL ERROR]: {email_error}")

        return jsonify(success=True, message="Time off has been submitted for approval"), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[TIME OFF REQUEST ERROR]: {e}")
        return jsonify(success=False, message="There was an error when submitting time off request."), 500
        
    
#--------------------
#   CREATE A SCHEDULE NOTE
#--------------------    

@create_bp.route("/schedule_note", methods=["POST"])
@login_required
def create_schedule_note():
    data = request.get_json()
    schedule_id = data.get("schedule_id")
    note = data.get("note", "").strip()
    
    if not schedule_id:
        return jsonify(success=False, message="Schedule ID is required"), 400
    
    schedule_item = Schedule.query.get(schedule_id)
    if not schedule_item:
        return jsonify(success=False, message="Schedule item not found"), 404
    
    try:
        schedule_item.note = note
        db.session.commit()
        return jsonify(success=True, message="Note added to schedule item", schedule=schedule_item.serialize()), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[SCHEDULE NOTE ERROR]: {e}")
        return jsonify(success=False, message="There was an error when adding note to schedule item."), 500
