from flask import Blueprint, jsonify, request, current_app
from app.models import User, Post, Comment, Shift, Schedule, TimeOffRequest, RoleEnum
from app.extensions import db
from flask_login import current_user, login_required
from datetime import date, time


delete_bp = Blueprint("delete", __name__)

@delete_bp.route("/user/<int:id>", methods=["DELETE"])
@login_required
def delete_user(id):
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    user = User.query.get(id)
    if not user:
        return jsonify(success=False, message="User not found"), 404
    try:
        schedules = Schedule.query.filter_by(user_id=user.id).all()
        for s in schedules:
            db.session.delete(s)
        db.session.delete(user)
        db.session.commit()
        return jsonify(success=True, message="User has been deleted"), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[USER DELETION ERROR]: {e}")
        return jsonify(success=False, message="There was an error when deleting user"), 500

@delete_bp.route("/post/<int:id>", methods=["DELETE"])
@login_required
def delete_post(id):
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    post = Post.query.get(id)
    if not post:
        return jsonify(success=False, message="Could not query post, please try again."), 400
    db.session.delete(post)
    db.session.commit()
    
    current_app.logger.info(f"{current_user.first_name} {current_user.last_name} has deleted post #{id}")
    return jsonify(success=True, message="Post has been deleted"), 200


@delete_bp.route("/comment/<int:id>", methods=["DELETE"])
@login_required
def delete_comment(id):
    comment = Comment.query.get(id)
    if not comment:
        return jsonify(success=False, message="Something went wrong when finding comment"), 400
    if current_user.role != RoleEnum.ADMIN:
        if comment.user_id != current_user.id:
            return jsonify(success=False, message="Sorry, you cant delete a comment that wasnt yours."), 403
    db.session.delete(comment)
    db.session.commit()
    
    current_app.logger.info(f"{current_user.first_name} {current_user.last_name} has deleted comment #{id}")
    return jsonify(success=True, message="Comment has been removed."), 200


@delete_bp.route("/shift/<int:id>", methods=["DELETE"])
@login_required
def delete_shift(id):
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    shift = Shift.query.get(id)
    if not shift:
        return jsonify(success=False, message="Shift not found."), 404
    try:
        db.session.delete(shift)
        db.session.commit()
        return jsonify(success=True, message="Shift has bee deleted"), 200  
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[SHIFT DELETION ERROR]: {e}")
        return jsonify(success=False, message="There was an error when deleting shift"), 500
    
    
@delete_bp.route("/schedule/<int:id>/<date>", methods=["DELETE"])
@login_required
def delete_schedule(id, date):
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    schedule_item = Schedule.query.filter(
        Schedule.user_id == id,
        Schedule.shift_date == date
    ).first()
    if not schedule_item:
        return jsonify(success=False, message="Schedule not found."), 400
    
    db.session.delete(schedule_item)
    db.session.commit()
    return jsonify(success=True, message="Schedule has been deleted."), 200

@delete_bp.route("/scheduled_week", methods=["DELETE"])
@login_required
def clear_week():
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    data = request.get_json()
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    
    if not start_date or not end_date:
        return jsonify(success=False, message="Missing date range"), 400
    
    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
        
        deleted = Schedule.query.filter(
            Schedule.shift_date >= start,
            Schedule.shift_date <= end
        ).delete(synchronize_session=False)
        
        db.session.commit()
        
        return jsonify(success=True, message=f"Deleted {deleted} schedules from {start_date} to {end_date}"), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[BULK SCHEDULE DELETE ERROR]: {e}")
        return jsonify(success=False, message="There was an error when deleting schedule week"), 500
    
    
@delete_bp.route("/time_off_request/<int:id>", methods=["DELETE"])
@login_required
def delete_time_off_request(id):
    if current_user.role != RoleEnum.ADMIN:
        return jsonify(success=False, message="Unauthorized"), 403
    time_off = TimeOffRequest.query.get(id)
    if not time_off:
        return jsonify(success=False, message="Request not found."), 400
    
    db.session.delete(time_off)
    db.session.commit()
    return jsonify(success=True, message="Request has been deleted."), 200
