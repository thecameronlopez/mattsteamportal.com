from flask import Blueprint, jsonify, request, abort, current_app
from flask_login import login_required, current_user    
from app.extensions import db
from app.models import User, Post, Comment, Shift, Schedule, TimeOffRequest, DepartmentEnum, TimeOffStatusEnum
from sqlalchemy import desc, select
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta, date
import json
import platform


read_bp = Blueprint('read', __name__)


if platform.system() == "Windows": 
    directory_path = "C:\\Users\\matts\\OneDrive\\Documents\\Cameron\\employees.json"
else:
    directory_path = "/home/cameron/employees.json"
    
def load_employee_data():   
    with open(directory_path) as f:
        return json.load(f)


########################
########################
##   GET USER DATA    ##
########################
########################
@read_bp.route('/user/<int:user_id>', methods=['GET'])
@login_required
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify(success=False, message="User not found"), 404
    full = request.args.get("full", "false").lower() == "true"
    if full:
        return jsonify(success=True, user=user.serialize_full()), 200
    return jsonify(success=True, user=user.serialize()), 200


@read_bp.route('/users', methods=['GET'])
@login_required
def get_users():
    users = User.query.all()
    users_data = []
    for u in users:
        if u.email == "ambernicole@mattsappliancesla.net":
            pass
        else:
            users_data.append(u.serialize())
    return jsonify(success=True, users=users_data), 200


@read_bp.route('/all_users', methods=['GET'])
@login_required
def get_all_users():
    users = User.query.all()
    users_data = [user.serialize() for user in users]
    return jsonify(success=True, users=users_data), 200

########################
########################
##   GET POST DATA    ##
########################
########################
@read_bp.route("/post/<int:id>", methods=["GET"])
@login_required
def get_post(id):
    post = Post.query.get(id)
    if not post:
        return jsonify(success=False, message="Could not query post"), 400
    
    current_app.logger.info(f"{current_user.first_name} {current_user.last_name} viewed post '{post.title}'")
    return jsonify(success=True, post=post.serialize_full()), 200


@read_bp.route("/posts/<category>/<int:page>/<int:limit>", methods=["GET"])
@login_required
def get_posts(category, page, limit):
    page = max(page, 1)
    offset = (page - 1) * limit
    limit = int(limit)
    
    query = Post.query
    if category.lower() != "all":
        query = query.filter_by(category=category)
        
    total_posts = query.count()
    total_pages = (total_posts + limit - 1) // limit
    posts = query.order_by(Post.created_at.desc()).offset(offset).limit(limit).all()
    return jsonify(
        success=True, 
        page=page, 
        limit=limit, 
        total_posts=total_posts,
        total_pages=total_pages,
        posts=[p.serialize() for p in posts],
        message="No posts found" if not posts else "Posts retrieved successfully"
        ), 200

########################
########################
## GET SCHEDULE DATA  ##
########################
########################
@read_bp.route("/schedules", methods=["GET"])
@login_required
def get_schedules():
    schedules = Schedule.query.all()
    if not schedules:
        return jsonify(success=False, message="Schedules not found"), 404
    return jsonify(success=True, schedules=[s.serialize() for s in schedules]), 200

@read_bp.route("/user_schedule/<int:id>", methods=["GET"])
@login_required
def get_user_schedule(id):
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    if not start_date or not end_date:
        return jsonify(success=False, message="Start and End dates are required"), 400
    
    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError:
        return jsonify(success=False, message="Invalid date format. Use YYYY-MM-DD"), 400
    
    user = User.query.get(id)
    if not user:
        return jsonify(success=False, message="User not found"), 404
    
    schedule = (
        db.session.query(Schedule)
        .filter(
            Schedule.user_id == id,
            Schedule.shift_date.between(start, end)
        )
        .order_by(Schedule.shift_date.asc())
        .all()
    )
    
    approved_time_off = (
        db.session.query(TimeOffRequest)
        .filter(
            TimeOffRequest.user_id == id,
            TimeOffRequest.status == TimeOffStatusEnum.APPROVED,
            TimeOffRequest.start_date <= end,
            TimeOffRequest.end_date >= start
        )
        .order_by(TimeOffRequest.start_date.asc())
        .all()
    )
    
    return jsonify(
        success=True, 
        user=user.serialize(),
        schedule=[s.serialize() for s in schedule],
        time_off=[t.serialize() for t in approved_time_off]
    ), 200
    
    
@read_bp.route("/team_schedules/<department>", methods=["GET"])
@login_required
def get_team_schedules(department):
    try:
        department_enum = DepartmentEnum[department.upper()]
    except KeyError:
        return jsonify(success=False, message="Invalid department"), 400

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError:
        return jsonify(success=False, message="Invalid date format. Use YYYY-MM-DD"), 400

    try:
        # fetch all users in department
        users = User.query.filter(User.department == department_enum).all()
        user_ids = [u.id for u in users]

        # fetch all approved time-off
        approved_time_off = db.session.query(TimeOffRequest).filter(
            TimeOffRequest.user_id.in_(user_ids),
            TimeOffRequest.status == TimeOffStatusEnum.APPROVED,
            TimeOffRequest.start_date <= end,
            TimeOffRequest.end_date >= start
        ).all()

        # build date lookup
        time_off_map = {}
        for req in approved_time_off:
            if req.user_id not in time_off_map:
                time_off_map[req.user_id] = set()
            d = req.start_date
            while d <= req.end_date:
                time_off_map[req.user_id].add(d)
                d += timedelta(days=1)

        # fetch schedules
        schedules = db.session.query(Schedule).join(User).options(
            joinedload(Schedule.user),
            joinedload(Schedule.shift)
        ).filter(
            User.department == department_enum,
            Schedule.shift_date.between(start, end)
        ).order_by(Schedule.shift_date.asc()).all()

        # filter out approved time-off
        filtered = [
            s for s in schedules
            if s.user_id not in time_off_map or s.shift_date not in time_off_map[s.user_id]
        ]

        # group by user
        grouped = {}
        for s in filtered:
            uid = s.user.id
            if uid not in grouped:
                grouped[uid] = {
                    "user": s.user.serialize(),
                    "schedules": [],
                    "time_off_dates": sorted(
                        [d.isoformat() for d in time_off_map.get(uid, set())]
                    ),
                }
            grouped[uid]["schedules"].append(s.serialize())

        return jsonify(success=True, schedules=list(grouped.values())), 200

    except Exception as e:
        current_app.logger.error(f"[DEPARTMENT SCHEDULE QUERY ERROR]: {e}")
        return jsonify(success=False, message="Error when fetching schedules"), 500





#------------------
#   SHIFTS QUERY
#------------------
@read_bp.route("/shifts", methods=["GET"])
@login_required
def get_shifts():
    shifts = Shift.query.all()
    if not shifts:
        return jsonify(success=False, message="Shifts not found"), 404
    return jsonify(success=True, shifts=[s.serialize() for s in shifts]), 200



#------------------
#   TIME OFF QUERY
#------------------
@read_bp.route("/time_off_request/<int:id>", methods=["GET"])
@login_required
def get_time_off_request(id):
    time_off_request = TimeOffRequest.query.get(id)
    if not time_off_request:
        return jsonify(success=False, message="Request not found"), 404
    return jsonify(success=True, time_off_request=time_off_request.serialize()), 200

@read_bp.route("/time_off_requests", methods=["GET"])
@login_required
def get_time_off_requests():
    try:
        approved_page = max(request.args.get("approved_page", 1, type=int), 1)
        denied_page = max(request.args.get("denied_page", 1, type=int), 1)
        page_size = max(request.args.get("limit", 25, type=int), 1)

        # Pending stays as a full query per product requirement.
        pending_requests = (
            TimeOffRequest.query.options(joinedload(TimeOffRequest.user))
            .filter(TimeOffRequest.status == TimeOffStatusEnum.PENDING)
            .order_by(TimeOffRequest.id.desc())
            .all()
        )

        approved_query = (
            TimeOffRequest.query.options(joinedload(TimeOffRequest.user))
            .filter(TimeOffRequest.status == TimeOffStatusEnum.APPROVED)
            .order_by(TimeOffRequest.id.desc())
        )
        denied_query = (
            TimeOffRequest.query.options(joinedload(TimeOffRequest.user))
            .filter(TimeOffRequest.status == TimeOffStatusEnum.DENIED)
            .order_by(TimeOffRequest.id.desc())
        )

        approved_total = approved_query.count()
        denied_total = denied_query.count()

        approved_total_pages = max((approved_total + page_size - 1) // page_size, 1)
        denied_total_pages = max((denied_total + page_size - 1) // page_size, 1)

        approved_page = min(approved_page, approved_total_pages)
        denied_page = min(denied_page, denied_total_pages)

        approved_offset = (approved_page - 1) * page_size
        denied_offset = (denied_page - 1) * page_size

        approved_requests = approved_query.offset(approved_offset).limit(page_size).all()
        denied_requests = denied_query.offset(denied_offset).limit(page_size).all()

        return jsonify(
            success=True,
            time_off_requests={
                "pending": [to.serialize() for to in pending_requests],
                "approved": [to.serialize() for to in approved_requests],
                "denied": [to.serialize() for to in denied_requests],
            },
            pagination={
                "approved": {
                    "page": approved_page,
                    "limit": page_size,
                    "total_items": approved_total,
                    "total_pages": approved_total_pages,
                },
                "denied": {
                    "page": denied_page,
                    "limit": page_size,
                    "total_items": denied_total,
                    "total_pages": denied_total_pages,
                },
            },
        ), 200
    except Exception as e:
        current_app.logger.error(f"[TIME OFF REQUEST QUERY ERROR]: {e}")
        return jsonify(success=False, message="There was an error when querying time off requests."), 500
