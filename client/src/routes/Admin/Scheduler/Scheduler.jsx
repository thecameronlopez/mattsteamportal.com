import styles from "./Scheduler.module.css";
import React, { useEffect, useMemo, useState } from "react";
import {
  MONTH_NAMES,
  WEEKDAY,
  toMilitary,
  formatDate,
  getWorkWeekFromDate,
  locationAbbr,
  suffix,
  toAMPM,
} from "../../../utils/Helpers";

import {
  getShifts,
  getUsers,
  getSchedules,
  printSchedule,
} from "../../../utils/API";
import toast from "react-hot-toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSquarePlus, faUser } from "@fortawesome/free-regular-svg-icons";
import {
  faBackwardStep,
  faCalendarWeek,
  faChevronDown,
  faChevronUp,
  faCircleInfo,
  faForwardStep,
  faGears,
  faNotdef,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { clsx } from "clsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../Context/AuthContext";

const Scheduler = () => {
  const { setLoading } = useAuth();
  const today = new Date();
  const navigate = useNavigate();
  const [currentWeek, setCurrentWeek] = useState(getWorkWeekFromDate(today));
  const [departments, setDepartments] = useState({
    sales: [],
    service: [],
    cleaner: [],
    driver: [],
    technician: [],
    office: [],
    all: [],
  });
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedDpt, setSelectedDpt] = useState("all");
  const [selectedShift, setSelectedShift] = useState("");
  const [pendingAssignments, setPendingAssignments] = useState(() => {
    const stored = localStorage.getItem("pendingAssignments");
    return stored ? JSON.parse(stored) : {};
  });
  const [isLC, setIsLC] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState({});
  const currentLocation = isLC ? "lake_charles" : "jennings";

  const hasOverlappingRequest = (req, dateStr) =>
    req.start_date <= dateStr && dateStr <= req.end_date;

  useEffect(() => {
    localStorage.setItem(
      "pendingAssignments",
      JSON.stringify(pendingAssignments),
    );
  }, [pendingAssignments]);

  useEffect(() => {
    const storedAssignments = localStorage.getItem("pendingAssignments");
    if (storedAssignments) {
      setPendingAssignments(JSON.parse(storedAssignments));
    }
  }, []);

  useEffect(() => {
    const shiftGet = async () => {
      const shiftList = await getShifts();
      if (!shiftList.success) {
        toast.error(shiftList.message);
        return;
      }
      setShifts(shiftList.shifts);
    };
    shiftGet();
  }, []);

  useEffect(() => {
    const usersGet = async () => {
      const userList = await getUsers();
      if (!userList.success) {
        toast.error(userList.message);
        return;
      }
      setDepartments((prev) => ({
        ...prev,
        sales: userList.users.filter((u) => u.department === "sales"),
        service: userList.users.filter((u) => u.department === "service"),
        cleaner: userList.users.filter((u) => u.department === "cleaner"),
        driver: userList.users.filter((u) => u.department === "driver"),
        technician: userList.users.filter((u) => u.department === "technician"),
        office: userList.users.filter((u) => u.department === "office"),
        all: userList.users,
      }));
    };

    usersGet();
  }, []);

  useEffect(() => {
    const scheduleGet = async () => {
      const scheduleList = await getSchedules();
      if (!scheduleList.success) {
        // toast.error(scheduleList.message);
        return;
      }
      setSchedules(scheduleList.schedules);
    };
    scheduleGet();
  }, []);

  //GENERATE SCHEDULE ROWS [USER ID, ...WEEKDAYS]
  const scheduleRows = useMemo(() => {
    return departments[selectedDpt].map((user) => {
      return currentWeek.map((day) => {
        const dateStr = formatDate(day);

        const key = `${user.id}|${dateStr}`;
        const pending = pendingAssignments[key];

        const scheduledShift = schedules.find(
          (s) => s.user_id === user.id && s.shift_date === dateStr,
        );

        const state = pending
          ? "staged"
          : scheduledShift
            ? "committed"
            : "empty";

        const approvedTimeOffRequest = user.time_off_requests?.find(
          (req) => hasOverlappingRequest(req, dateStr) && req.status === "approved",
        );
        const pendingTimeOffRequest = user.time_off_requests?.find(
          (req) => hasOverlappingRequest(req, dateStr) && req.status === "pending",
        );

        return {
          user_id: user.id,
          date: day,
          shift_id: pending?.shift_id ?? scheduledShift?.shift_id ?? null,
          schedule_id: scheduledShift?.id ?? null,
          location:
            pending?.location ?? scheduledShift?.location ?? currentLocation,
          is_time_off: !!approvedTimeOffRequest,
          time_off_request: approvedTimeOffRequest || null,
          has_pending_time_off: !!pendingTimeOffRequest,
          pending_time_off_request: pendingTimeOffRequest || null,
          status: state,
          custom_start_time:
            pending?.custom_start_time ??
            scheduledShift?.shift.start_time ??
            null,
          custom_end_time:
            pending?.custom_end_time ?? scheduledShift?.shift.end_time ?? null,
        };
      });
    });
  }, [
    departments,
    selectedDpt,
    currentWeek,
    pendingAssignments,
    schedules,
    currentLocation,
  ]);

  // Week header (handles month boundaries)
  const getWeekHeader = () => {
    const start = currentWeek[0];
    const end = currentWeek[currentWeek.length - 1];
    const startMonth = MONTH_NAMES[start.getMonth()];
    const endMonth = MONTH_NAMES[end.getMonth()];
    return startMonth === endMonth
      ? `${startMonth} ${start.getDate()} - ${end.getDate()}`
      : `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  };

  // Helper: Build Mon-Sat week from a Monday
  const buildWeekFromMonday = (monday) => {
    const week = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(d);
    }
    return week;
  };

  //
  // WEEK CONTROLS
  //
  const goPrev = () => {
    const prevMonday = new Date(currentWeek[0]);
    prevMonday.setDate(prevMonday.getDate() - 7);
    setCurrentWeek(buildWeekFromMonday(prevMonday));
  };

  const goToday = () => {
    setCurrentWeek(getWorkWeekFromDate(today));
  };

  const goNext = () => {
    const nextMonday = new Date(currentWeek[0]);
    nextMonday.setDate(nextMonday.getDate() + 7);
    setCurrentWeek(buildWeekFromMonday(nextMonday));
  };

  const handleCellClick = (cell) => {
    if (!selectedShift) {
      toast.error("Select a shift first");
      return;
    }
    if (cell.is_time_off) {
      toast.error("Employee has approved time off");
      return;
    }

    const key = `${cell.user_id}|${formatDate(cell.date)}`;

    const newAssignment = {
      user_id: cell.user_id,
      shift_id: selectedShift,
      shift_date: formatDate(cell.date),
      location: currentLocation,
    };

    if (selectedShift === 9998) {
      let startTime = prompt("Enter start time [HH:MM] (please specify AM/PM)");
      let endTime = prompt("Enter end time [HH:MM] (please specify AM/PM)");

      startTime = toMilitary(startTime);
      endTime = toMilitary(endTime);

      if (!startTime || !endTime) {
        toast.error("Custom shifts require start and end times");
        return;
      }

      newAssignment.custom_start_time = startTime;
      newAssignment.custom_end_time = endTime;
    }

    setPendingAssignments((prev) => ({
      ...prev,
      [key]: newAssignment,
    }));
  };

  const submitSchedule = async () => {
    if (!confirm("Submit Schedule?")) return;

    const conflicts = [];
    const assignments = [];

    for (const [key, assignment] of Object.entries(pendingAssignments)) {
      const [userIdRaw, dateStr] = key.split("|");
      const userId = Number(userIdRaw);
      const user = departments.all.find((u) => u.id === userId);
      const approvedConflict = user?.time_off_requests?.some(
        (req) => hasOverlappingRequest(req, dateStr) && req.status === "approved",
      );

      if (approvedConflict) {
        conflicts.push(key);
        continue;
      }
      assignments.push(assignment);
    }

    if (conflicts.length > 0) {
      setPendingAssignments((prev) => {
        const next = { ...prev };
        conflicts.forEach((key) => {
          delete next[key];
        });
        return next;
      });
      toast.error(
        `${conflicts.length} staged assignment(s) removed due to newly approved time off.`,
      );
    }

    if (assignments.length === 0) {
      toast.error("No changes to submit");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/create/bulk_schedule", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schedules: assignments }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }

      toast.success(data.message);

      const refreshSchedule = await getSchedules();
      if (refreshSchedule.success) {
        setSchedules(refreshSchedule.schedules);
      }
      setPendingAssignments({});
      localStorage.removeItem("pendingAssignments");
      setLoading(false);
    } catch (error) {
      toast.error(error.message);
      console.error("Error submitting schedule:", error);
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (cell) => {
    const key = `${cell.user_id}|${formatDate(cell.date)}`;

    // If this is a staged (not yet submitted) assignment, clear it locally.
    if (!cell.schedule_id) {
      setPendingAssignments((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    if (!confirm("Delete this scheduled shift?")) return;

    const response = await fetch(
      `/api/delete/schedule/${cell.user_id}/${formatDate(cell.date)}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

    const data = await response.json();
    if (!data.success) {
      toast.error(data.message);
      return;
    }

    toast.success(data.message);

    const res = await getSchedules();
    if (res.success) {
      setSchedules(res.schedules);
    }
  };

  const ClearWeek = async () => {
    if (!confirm("Clear all schedules for this week?")) return;

    const start = formatDate(currentWeek[0]);
    const end = formatDate(currentWeek[currentWeek.length - 1]);

    const response = await fetch("api/delete/scheduled_week", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start_date: start,
        end_date: end,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      toast.error(data.message);
      return;
    }

    toast.success(data.message + " " + "Refresh screen to reflect changes");

    const newSchedules = await getSchedules();
    if (newSchedules.success) {
      setSchedules(newSchedules.schedules);
    }

    setPendingAssignments({});
  };

  const getShiftByID = (id) => shifts.find((s) => s.id === id);

  const toggleUserRow = (userId) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };
  //
  //
  //
  //
  //
  //
  //   START SCHEDULER
  //
  //
  //
  //
  //
  //
  return (
    <div className={styles.schedulerMaster}>
      <div className={styles.controlBar}>
        <div className={styles.cbRow1}>
          <p className={styles.weekLabel}>{getWeekHeader()}</p>
          <div className={styles.weekShift}>
            <button onClick={goPrev}>
              <FontAwesomeIcon icon={faBackwardStep} />
            </button>
            <button onClick={goToday}>
              <FontAwesomeIcon icon={faCalendarWeek} />
            </button>
            <button onClick={goNext}>
              <FontAwesomeIcon icon={faForwardStep} />
            </button>
          </div>
        </div>
        <div className={styles.cbRow2}>
          <div className={styles.controlField}>
            <label htmlFor="scheduler-department">Department</label>
            <select
              id="scheduler-department"
              name="department"
              value={selectedDpt}
              onChange={(e) => setSelectedDpt(e.target.value)}
            >
              {Object.keys(departments).map((dpt, index) => (
                <option value={dpt} key={index}>
                  {dpt}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.shiftControls}>
            <div className={styles.locationToggle}>
              <div
                className={styles.toggleSlider}
                style={{ left: isLC ? "0%" : "50%" }}
              ></div>
              <input
                type="radio"
                name="location"
                id="lc"
                value={"lake_charles"}
                checked={isLC}
                onChange={() => setIsLC(true)}
              />
              <label htmlFor="lc">Lake Charles</label>
              <input
                type="radio"
                name="location"
                id="jennings"
                value={"jennings"}
                checked={!isLC}
                onChange={() => setIsLC(false)}
              />
              <label htmlFor="jennings">Jennings</label>
            </div>
            <div className={styles.controlField}>
              <label htmlFor="scheduler-shift">Shift</label>
              <select
                id="scheduler-shift"
                name="shift"
                value={selectedShift}
                onChange={(e) => setSelectedShift(Number(e.target.value))}
              >
                <option value="">--select shift--</option>
                {shifts?.map(({ id, title }) => (
                  <option value={id} key={id}>
                    {title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.utilityButtons}>
            <button
              className={styles.deleteShiftButton}
              onClick={ClearWeek}
              disabled={schedules.length === 0}
            >
              Clear Schedule
              <FontAwesomeIcon icon={faTrash} />
            </button>
            <button
              className={styles.settingsButton}
              onClick={() => navigate("/settings")}
            >
              <FontAwesomeIcon icon={faGears} />
              <span>Settings</span>
            </button>
          </div>
        </div>
        <div className={styles.legendBar}>
          <span className={styles.legendItem}>
            <span className={clsx(styles.legendSwatch, styles.legendCommitted)} />
            Committed
          </span>
          <span className={styles.legendItem}>
            <span className={clsx(styles.legendSwatch, styles.legendStaged)} />
            Staged
          </span>
          <span className={styles.legendItem}>
            <span className={clsx(styles.legendSwatch, styles.legendPending)} />
            Pending R/O
          </span>
          <span className={styles.legendItem}>
            <span className={clsx(styles.legendSwatch, styles.legendApproved)} />
            Approved R/O
          </span>
        </div>
      </div>
      {/* END CONTROL BAR */}
      {/* START SCHEDULE */}
      <div className={styles.scheduleBlock}>
        <div className={styles.scheduleHeader}>
          <div
            className={clsx(styles.gridCell, [
              styles.employeeHeader,
              styles.gridHeader,
            ])}
          >
            <h3>Employee</h3>
          </div>
          {currentWeek.map((day, i) => (
            <div
              key={i}
              className={clsx(styles.gridCell, [
                styles.dateCellHeader,
                styles.gridHeader,
              ])}
            >
              <span>{WEEKDAY[day.getDay() - 1]}</span>
              <span>
                {MONTH_NAMES[day.getMonth()]}{" "}
                {day.getDate() + suffix(day.getDate())}
              </span>
            </div>
          ))}
        </div>
        {scheduleRows.map((userRow, rowIndex) => (
          <div className={styles.userRow} key={rowIndex}>
            {/* Employee Name */}
            <div
              className={clsx(
                styles.gridCell,
                styles.employeeCell,
                !expandedUsers[userRow[0].user_id] && styles.employeeCellCollapsed,
              )}
            >
              <h4>
                <div className={styles.userNameBlock}>
                  <span>
                    <FontAwesomeIcon icon={faUser} />
                  </span>
                  <span>
                    {departments[selectedDpt].find((u) => u.id === userRow[0].user_id)
                      ?.first_name}{" "}
                    {departments[selectedDpt].find((u) => u.id === userRow[0].user_id)
                      ?.last_name[0]}
                    {"."}
                  </span>
                  <button
                    type="button"
                    className={styles.editInfoBtn}
                    aria-label="Edit user"
                    title="Edit user"
                    onClick={() => navigate(`/edit-user/${userRow[0].user_id}`)}
                  >
                    <FontAwesomeIcon icon={faCircleInfo} />
                  </button>
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.expandUserBtn}
                    onClick={() => toggleUserRow(userRow[0].user_id)}
                  >
                    <FontAwesomeIcon
                      icon={
                        expandedUsers[userRow[0].user_id]
                          ? faChevronUp
                          : faChevronDown
                      }
                        />
                  </button>
                </div>
              </h4>
            </div>
            {/* Day Cells */}
            {expandedUsers[userRow[0].user_id] &&
              userRow.map((cell, cellIndex) => {
              const shift = getShiftByID(cell.shift_id);

              let display = "";
              if (cell.is_time_off) {
                display = null;
              } else if (shift) {
                if (shift.id === 9998) {
                  display = `${
                    (toAMPM(cell.custom_start_time) || "--") +
                    "-" +
                    (toAMPM(cell.custom_end_time) || "--")
                  }`;
                } else if (shift.id === 9999) {
                  display = shift.title;
                } else {
                  display = shift.title;
                }
              }

              const tooltip =
                cell.is_time_off && cell.time_off_request
                  ? cell.time_off_request.reason
                  : cell.has_pending_time_off && cell.pending_time_off_request
                    ? `[PENDING REQUEST] ${cell.pending_time_off_request.reason}`
                  : "";
              return (
                <div
                  className={clsx(
                    styles.gridCell,
                    styles.dateCell,
                    cell.is_time_off && styles.timeOffCell,
                    !cell.is_time_off &&
                      cell.has_pending_time_off &&
                      styles.pendingTimeOffCell,
                    cell.status === "staged" && styles.stagedCell,
                    cell.status === "committed" && styles.committedCell,
                  )}
                  key={cellIndex}
                  title={tooltip}
                  onClick={() => {
                    if (cell.is_time_off) return;
                    if (
                      !cell.shift_id ||
                      (cell.status === "staged" && selectedShift)
                    ) {
                      handleCellClick(cell);
                    } else {
                      toast.error("Select a shift first to change this cell");
                    }
                  }}
                >
                  <small className={styles.mobileDateRead}>
                    {WEEKDAY[cellIndex]}
                  </small>
                  {cell.is_time_off ? (
                    <FontAwesomeIcon icon={faNotdef} />
                  ) : cell.shift_id ? (
                    <span className={styles.shiftAssignedCell}>
                      <span
                        onClick={() => {
                          if (cell.shift_id && !selectedShift) {
                            handleDeleteSchedule(cell);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {display}{" "}
                        <span className={styles.cellLocationBadge}>
                          {locationAbbr(cell.location)}
                        </span>
                      </span>
                    </span>
                  ) : (
                    <FontAwesomeIcon icon={faSquarePlus} />
                  )}
                </div>
              );
              })}
          </div>
        ))}
        <div className={styles.scheduleFooter}>
          <button
            className={styles.printButton}
            // onClick={() => alert("YO MAMA!!")}
            onClick={() => {
              const start = formatDate(currentWeek[0]);
              const end = formatDate(currentWeek[currentWeek.length - 1]);
              printSchedule(start, end, selectedDpt);
            }}
          >
            Print
          </button>
          {currentWeek.map((day, index) => (
            <div key={index} className={styles.footerCell}></div>
          ))}
          <button onClick={submitSchedule} className={styles.submitShiftButton}>
            Submit Shift
          </button>
        </div>
      </div>
      <div className={styles.mobileQuickSchedule}>
        <p className={styles.mobileHint}>
          Mobile quick mode: choose shift/location, then use Assign/Clear per
          day.
        </p>
        {scheduleRows.map((userRow, rowIndex) => {
          const employee = departments[selectedDpt].find(
            (u) => u.id === userRow[0].user_id,
          );
          return (
            <div className={styles.mobileUserCard} key={rowIndex}>
              <div className={styles.mobileUserHeader}>
                <p className={styles.mobileUserName}>
                  {employee?.first_name} {employee?.last_name}
                  <button
                    type="button"
                    className={styles.mobileEditInfoBtn}
                    aria-label="Edit user"
                    title="Edit user"
                    onClick={() => navigate(`/edit-user/${userRow[0].user_id}`)}
                  >
                    <FontAwesomeIcon icon={faCircleInfo} />
                  </button>
                </p>
                <div className={styles.mobileUserHeaderActions}>
                  <button
                    type="button"
                    className={styles.mobileExpandBtn}
                    onClick={() => toggleUserRow(userRow[0].user_id)}
                  >
                    <FontAwesomeIcon
                      icon={
                        expandedUsers[userRow[0].user_id]
                          ? faChevronUp
                          : faChevronDown
                      }
                        />
                  </button>
                </div>
              </div>
              {expandedUsers[userRow[0].user_id] && (
              <div className={styles.mobileDayList}>
                {userRow.map((cell, dayIndex) => {
                  const shift = getShiftByID(cell.shift_id);
                  const day = currentWeek[dayIndex];

                  let display = "Unassigned";
                  if (cell.is_time_off) {
                    display = "R/O";
                  } else if (cell.has_pending_time_off) {
                    display = "Pending R/O";
                  } else if (shift) {
                    if (shift.id === 9998) {
                      display = `${toAMPM(cell.custom_start_time) || "--"}-${toAMPM(cell.custom_end_time) || "--"}`;
                    } else {
                      display = shift.title;
                    }
                  }

                  return (
                    <div
                      key={dayIndex}
                      className={clsx(
                        styles.mobileDayCard,
                        cell.is_time_off && styles.mobileDayCardOff,
                        cell.status === "staged" && styles.mobileDayCardStaged,
                      )}
                    >
                      <div className={styles.mobileDayMeta}>
                        <p>
                          {WEEKDAY[dayIndex]} {MONTH_NAMES[day.getMonth()]}{" "}
                          {day.getDate() + suffix(day.getDate())}
                        </p>
                        <small>{display}</small>
                      </div>
                      <div className={styles.mobileDayActions}>
                        <button
                          type="button"
                          onClick={() => handleCellClick(cell)}
                          disabled={cell.is_time_off}
                        >
                          Assign
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(cell)}
                          disabled={cell.is_time_off || !cell.shift_id}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}

        <div className={styles.mobileFooterActions}>
          <button
            type="button"
            className={styles.printButton}
            onClick={() => {
              const start = formatDate(currentWeek[0]);
              const end = formatDate(currentWeek[currentWeek.length - 1]);
              printSchedule(start, end, selectedDpt);
            }}
          >
            Print
          </button>
          <button
            type="button"
            className={styles.submitShiftButton}
            onClick={submitSchedule}
          >
            Submit Shift
          </button>
        </div>
      </div>
    </div>
  );
};

export default Scheduler;
