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
  faChevronDown,
  faChevronUp,
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
  const [showTopPanel, setShowTopPanel] = useState(false);
  const [hasUnreadPosts, setHasUnreadPosts] = useState(false);

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

  useEffect(() => {
    const checkUnreadPosts = async () => {
      try {
        const res = await fetch("/api/read/posts/all/1/1");
        const data = await res.json();
        if (!data.success || !data.posts?.length) {
          setHasUnreadPosts(false);
          return;
        }

        const latestPost = data.posts[0];
        const seenRaw = localStorage.getItem(`posts_last_seen_${user.id}`);
        if (!seenRaw) {
          setHasUnreadPosts(true);
          return;
        }

        const seen = JSON.parse(seenRaw);
        const unreadById = Number(latestPost.id) > Number(seen?.id ?? 0);
        setHasUnreadPosts(unreadById);
      } catch {
        setHasUnreadPosts(false);
      }
    };

    checkUnreadPosts();
  }, [user.id]);

  const goto = (path) => {
    navigate(path);
  };

  const navItems = [
    { label: "Posts", path: "/posts", icon: faSignsPost },
    { label: "Team", path: "/team-schedules", icon: faPeopleGroup },
    {
      label: "Time Off",
      path: "/time-off-request",
      icon: faUserClock,
      fullRow: user.role !== "admin",
    },
    ...(user.role === "admin"
      ? [
          { label: "Settings", path: "/settings", icon: faGears },
          {
            label: "Scheduler",
            path: "/scheduler",
            icon: faCalendarDays,
            fullRow: true,
          },
        ]
      : []),
  ];

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
        <div className={styles.panelHeader}>
          <h1 className={styles.welcomeTitle}>
            {user.first_name} {user.last_name}
            <button
              type="button"
              className={styles.profileInfo}
              onClick={() => navigate(`/edit-user/${user.id}`)}
              aria-label="Edit profile"
              title="Edit profile"
            >
              <FontAwesomeIcon icon={faCircleInfo} />
            </button>
          </h1>
          <div className={styles.panelHeaderActions}>
            <button
              type="button"
              className={styles.caretToggle}
              onClick={() => setShowTopPanel((prev) => !prev)}
              aria-label={
                showTopPanel ? "Hide quick actions" : "Show quick actions"
              }
            >
              <FontAwesomeIcon
                icon={showTopPanel ? faChevronUp : faChevronDown}
              />
            </button>
          </div>
        </div>
        {showTopPanel && (
          <>
            <div
              className={`${styles.userNavi} ${
                user.role === "admin"
                  ? styles.userNaviAdmin
                  : styles.userNaviEmployee
              }`}
            >
              {navItems.map(({ label, path, icon, fullRow }) => (
                <button
                  key={label}
                  type="button"
                  className={`${styles.navAction} ${fullRow ? styles.navActionFullRow : ""}`}
                  onClick={() => goto(path)}
                >
                  <FontAwesomeIcon icon={icon} />
                  <span>{label}</span>
                  {label === "Posts" && hasUnreadPosts && (
                    <span className={styles.unreadDot} aria-label="Unread posts" />
                  )}
                </button>
              ))}
            </div>
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
          </>
        )}
      </div>
      <div className={styles.currentWeekSchedule}>
        <p className={styles.dateHeader}>{getWeekHeader()}</p>
        <div className={styles.weekGrid}>
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

            const timeOffForDay = getTimeOffForDay(day);

            return (
              <div key={i} className={styles.dayOfWeek}>
                <h3>{WEEKDAY[i]}</h3>
                <div>
                  {scheduleForDay ? (
                    <>
                      <p className={styles.shiftTime}>
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
                  ) : timeOffForDay ? (
                    <p className={styles.offDay}>
                      R/O {timeOffForDay.is_pto ? "(PTO)" : ""}
                    </p>
                  ) : (
                    <p className={styles.noShift}>Off</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Home;
