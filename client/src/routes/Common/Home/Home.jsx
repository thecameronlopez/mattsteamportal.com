import styles from "./Home.module.css";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../Context/AuthContext";
import {
  getWorkWeekFromDate,
  WEEKDAY,
  formatDate,
  parseLocalDate,
  toAMPM,
  MONTH_NAMES,
} from "../../../utils/Helpers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBackwardStep,
  faCalendarWeek,
  faCircleInfo,
  faForwardStep,
  faGears,
  faPeopleGroup,
  faSignsPost,
  faUserClock,
} from "@fortawesome/free-solid-svg-icons";
import { faCalendarDays } from "@fortawesome/free-regular-svg-icons";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [currentWeek, setCurrentWeek] = useState(getWorkWeekFromDate(today));
  const [schedule, setSchedule] = useState([]);
  const [timeOff, setTimeOff] = useState([]);

  useEffect(() => {
    const start = formatDate(currentWeek[0]);
    const end = formatDate(currentWeek[currentWeek.length - 1]);
    const scheduleGet = async () => {
      const res = await fetch(
        `/api/read/user_schedule/${user.id}?start_date=${start}&end_date=${end}`,
      );
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message);
      }
      setSchedule(data.schedule);
      setTimeOff(data.time_off);
    };
    scheduleGet();
  }, [user, currentWeek]);

  const goto = (path) => {
    navigate(path);
  };

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
      d.setDate(d.getDate() + i);
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

  const getTimeOffForDay = (day) => {
    return timeOff.find((t) => {
      const start = parseLocalDate(t.start_date);
      const end = parseLocalDate(t.end_date);
      return day >= start && day <= end;
    });
  };

  return (
    <div className={styles.userHomeContainer}>
      <div className={styles.userHomeHeader}>
        <div className={styles.userNavi}>
          <FontAwesomeIcon icon={faSignsPost} onClick={() => goto("/posts")} />
          <FontAwesomeIcon
            icon={faPeopleGroup}
            onClick={() => goto("/team-schedules")}
          />
          <FontAwesomeIcon
            icon={faUserClock}
            onClick={() => goto("/time-off-request")}
          />
          {user.role === "admin" && (
            <>
              <FontAwesomeIcon
                icon={faGears}
                onClick={() => goto("/settings")}
              />
              <FontAwesomeIcon
                icon={faCalendarDays}
                onClick={() => goto("/scheduler")}
              />
            </>
          )}
        </div>
        <h1>
          {user.first_name} {user.last_name}{" "}
          <span>
            <FontAwesomeIcon
              icon={faCircleInfo}
              onClick={() => navigate(`/edit-user/${user.id}`)}
            />
          </span>
        </h1>
        <div className={styles.switcher}>
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
      <div className={styles.currentWeekSchedule}>
        <p className={styles.dateHeader}>
          <small>{getWeekHeader()}</small>
        </p>

        {currentWeek.map((day, i) => {
          // find schedule for this day
          const scheduleForDay = schedule.find((s) => {
            const sd = parseLocalDate(s.shift_date);
            return (
              sd.getFullYear() === day.getFullYear() &&
              sd.getMonth() === day.getMonth() &&
              sd.getDate() === day.getDate()
            );
          });

          return (
            <div key={i} className={styles.dayOfWeek}>
              <h3>{WEEKDAY[i]}</h3>
              <div>
                {scheduleForDay ? (
                  <>
                    <p>
                      {scheduleForDay.shift_id !== 9999
                        ? `${toAMPM(
                            scheduleForDay.shift.start_time,
                          )} - ${toAMPM(scheduleForDay.shift.end_time)}`
                        : scheduleForDay.shift.title}
                    </p>
                    {scheduleForDay.note && (
                      <p className={styles.shiftNote}>{scheduleForDay.note}</p>
                    )}
                  </>
                ) : getTimeOffForDay(day) ? (
                  <p className={styles.offDay}>
                    R/O {getTimeOffForDay(day).is_pto ? "(PTO)" : ""}
                  </p>
                ) : (
                  <p className={styles.noShift}>-</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
