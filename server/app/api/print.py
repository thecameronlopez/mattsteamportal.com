from flask import Blueprint, render_template, make_response, request, abort
from flask_login import login_required
from app.models import Schedule, TimeOffRequest, DepartmentEnum, User, TimeOffStatusEnum
from app.extensions import db
from datetime import datetime, timedelta
import pdfkit
import os

print_bp = Blueprint("print", __name__)

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

@print_bp.route("/schedule", methods=["GET"])
@login_required
def print_schedule():
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    
    department = request.args.get("department", "all").lower()

    if not start_date or not end_date:
        abort(400, "start date and end date are required")

    start = datetime.fromisoformat(start_date).date()
    end = datetime.fromisoformat(end_date).date()


    # -----------------------------
    # SCHEDULE QUERY
    # -----------------------------
    schedule_query = (
        db.session.query(Schedule)
        .join(Schedule.user)
        .join(Schedule.shift)
        .filter(Schedule.shift_date.between(start, end))
    )
    
    
    if department != "all":
        try:
            dept_enum = DepartmentEnum(department)
        except ValueError:
            abort(400, "Invalid department value")
        schedule_query = schedule_query.filter(Schedule.user.has(department=dept_enum))
        
    schedules = (
        schedule_query
        .order_by(
            Schedule.user_id,
            Schedule.shift_date
        )
        .all()
    )
    
    # -----------------------------
    # TIME OFF QUERY
    # -----------------------------
    time_off_query = (
        db.session.query(TimeOffRequest)
        .join(TimeOffRequest.user)
        .filter(
            TimeOffRequest.status == TimeOffStatusEnum.APPROVED,
            TimeOffRequest.start_date <= end,
            TimeOffRequest.end_date >= start
        )
    )
    
    if department != "all":
        time_off_query = time_off_query.filter(TimeOffRequest.user.has(department=dept_enum))
    time_off = time_off_query.all()

    grouped = {}
    
    for t in time_off:
        name = f"{t.user.first_name} {t.user.last_name}"
        if name not in grouped:
            grouped[name] = {day: None for day in DAYS}
        for single_date in (t.start_date + timedelta(days=n) for n in range((t.end_date - t.start_date).days + 1)):
            if start <= single_date <= end:
                day_key = single_date.strftime("%a")
                grouped[name][day_key] = {
                    "time": "R/O",
                    "location": "none"
                }

    for s in schedules:
        name = s.user.full_name

        # Ensure employee always has Mon–Sat slots
        if name not in grouped:
            grouped[name] = {day: None for day in DAYS}

        is_time_off = any(
            t.user_id == s.user_id and t.start_date <= s.shift_date <= t.end_date
            for t in time_off
        )
        # ---- TIME STRING LOGIC ----
        if is_time_off:
            time_str = "R/O"
        elif s.shift_id == 9999:
            time_str = "OFF"

        elif s.shift_id == 9998:
            start_str = s.custom_start_time.strftime("%I:%M %p") if s.custom_start_time else "--:--"
            end_str = s.custom_end_time.strftime("%I:%M %p") if s.custom_end_time else "--:--"
            time_str = f"{start_str} - {end_str}"

        else:
            start_time = s.custom_start_time or s.shift.start_time
            end_time = s.custom_end_time or s.shift.end_time

            start_str = start_time.strftime("%I:%M %p") if start_time else "--:--"
            end_str = end_time.strftime("%I:%M %p") if end_time else "--:--"
            time_str = f"{start_str} - {end_str}"

        day_key = s.shift_date.strftime("%a")

        grouped[name][day_key] = {
            "time": time_str,
            "location": s.location.name.lower()  # for CSS
        }


    # -----------------------------
    # PDF RENDER
    # -----------------------------
    html = render_template(
        "print_schedules.html",
        grouped=grouped,
        start=start.strftime("%B %d"),
        end=end.strftime("%B %d"),
        days=DAYS
    )
    
    WKTHMLTOPDF_PATH = (
        r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe"
        if os.name == "nt"
        else "/usr/bin/wkhtmltopdf"
    )

    config = pdfkit.configuration(
        wkhtmltopdf=WKTHMLTOPDF_PATH
    )

    pdf = pdfkit.from_string(html, False, configuration=config)

    response = make_response(pdf)
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = "attachment; filename=weekly_schedule.pdf"

    return response
