import styles from "./TeamSchedule.module.css";
import React, { useEffect, useState } from "react";
import { DEPARTMENTS } from "../../../../utils/Enums";
import {
  getWorkWeekFromDate,
  renderObjects,
  MONTH_NAMES,
  formatDate,
  parseLocalDate,
  WEEKDAY,
  toAMPM,
} from "../../../../utils/Helpers";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../Context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBackwardStep,
  faCalendarWeek,
  faChevronLeft,
  faForwardStep,
  faNotesMedical,
} from "@fortawesome/free-solid-svg-icons";

const TeamSchedule = () => {
  const today = new Date();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentWeek, setCurrentWeek] = useState(getWorkWeekFromDate(today));
  const [selectedDpt, setSelectedDpt] = useState(user.department);
  const [schedules, setSchedules] = useState([]);

  // Track which user/day note input is open
  const [addingNoteTo, setAddingNoteTo] = useState({
    userIndex: null,
    dayIndex: null,
  });
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    const fetchSchedules = async () => {
      const start = formatDate(currentWeek[0]);
      const end = formatDate(currentWeek[currentWeek.length - 1]);
      try {
        const res = await fetch(
          `/api/read/team_schedules/${selectedDpt}?start_date=${start}&end_date=${end}`,
        );
        const data = await res.json();
        if (!data.success) toast.error(data.message);
        else setSchedules(data.schedules);
      } catch (err) {
        console.log("[ERROR]: ", err);
        toast.error("Failed to fetch schedules");
      }
    };
    fetchSchedules();
  }, [currentWeek, selectedDpt, user]);

  const getWeekHeader = () => {
    const start = currentWeek[0];
    const end = currentWeek[currentWeek.length - 1];
    const startMonth = MONTH_NAMES[start.getMonth()];
    const endMonth = MONTH_NAMES[end.getMonth()];
    return startMonth === endMonth
      ? `${startMonth} ${start.getDate()} - ${end.getDate()}`
      : `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  };

  const buildWeekFromMonday = (monday) => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const goPrev = () =>
    setCurrentWeek(
      buildWeekFromMonday(
        new Date(currentWeek[0]).setDate(currentWeek[0].getDate() - 7),
      ),
    );
  const goToday = () => setCurrentWeek(getWorkWeekFromDate(today));
  const goNext = () =>
    setCurrentWeek(
      buildWeekFromMonday(
        new Date(currentWeek[0]).setDate(currentWeek[0].getDate() + 7),
      ),
    );

  const submitNote = async (scheduleId) => {
    if (!newNote.trim()) return;
    if (!confirm("Add schedule note?")) return;

    try {
      const res = await fetch(`/api/create/schedule_note`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: scheduleId, note: newNote }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message);
        return;
      }
      toast.success("Note added");
      setAddingNoteTo({ userIndex: null, dayIndex: null });
      setNewNote("");
      // Refresh schedules
      const start = formatDate(currentWeek[0]);
      const end = formatDate(currentWeek[currentWeek.length - 1]);
      const refreshRes = await fetch(
        `/api/read/team_schedules/${selectedDpt}?start_date=${start}&end_date=${end}`,
      );
      const newData = await refreshRes.json();
      if (newData.success) setSchedules(newData.schedules);
    } catch (err) {
      console.log("[ERROR]: ", err);
      toast.error("Failed to add note");
    }
  };

  return (
    <div className={styles.teamScheduleContainer}>
      <FontAwesomeIcon
        icon={faChevronLeft}
        onClick={() => navigate(-1)}
        className={styles.goBack}
      />
      <select
        name="selectedDpt"
        value={selectedDpt}
        onChange={(e) => setSelectedDpt(e.target.value)}
      >
        {renderObjects(DEPARTMENTS)}
      </select>

      <p className={styles.teamWeekHeader}>{getWeekHeader()}</p>
      <div className={styles.teamWeekNavi}>
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

      <div className={styles.scheduleList}>
        {schedules.map(({ user, schedules: userSchedules }, userIndex) => (
          <div className={styles.scheduleItem} key={user.id}>
            <h4>{user.first_name}</h4>
            <div className={styles.userWeek}>
              {currentWeek.map((day, dayIndex) => {
                const scheduleForDay = userSchedules.find((s) => {
                  const sd = parseLocalDate(s.shift_date);
                  return (
                    sd.getFullYear() === day.getFullYear() &&
                    sd.getMonth() === day.getMonth() &&
                    sd.getDate() === day.getDate()
                  );
                });

                const isAddingNote =
                  addingNoteTo.userIndex === userIndex &&
                  addingNoteTo.dayIndex === dayIndex;

                return (
                  <div key={dayIndex} className={styles.userDay}>
                    <div className={styles.dayHeader}>
                      <p>{WEEKDAY[dayIndex]}</p>
                      {scheduleForDay && (
                        <FontAwesomeIcon
                          icon={faNotesMedical}
                          onClick={() =>
                            setAddingNoteTo(
                              isAddingNote
                                ? { userIndex: null, dayIndex: null }
                                : { userIndex, dayIndex },
                            )
                          }
                        />
                      )}
                    </div>

                    {scheduleForDay ? (
                      <p>
                        {toAMPM(scheduleForDay.shift.start_time)}-
                        {toAMPM(scheduleForDay.shift.end_time)}
                      </p>
                    ) : (
                      <p className={styles.offDay}>R/O</p>
                    )}

                    {isAddingNote && (
                      <div className={styles.noteInput}>
                        <input
                          type="text"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add a note..."
                          autoFocus
                        />
                        <button onClick={() => submitNote(scheduleForDay.id)}>
                          Add
                        </button>
                      </div>
                    )}

                    <p
                      className={styles.dayNote}
                      title={scheduleForDay?.note || ""}
                    >
                      {scheduleForDay?.note ? "Note attached" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamSchedule;
