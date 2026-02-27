import styles from "./Settings.module.css";
import React, { useEffect, useState } from "react";
import ShiftForm from "../../../components/Forms/Shift/ShiftForm";
import {
  deleteShift,
  deleteUser,
  getShifts,
  getAllUsers,
} from "../../../utils/API";
import toast from "react-hot-toast";
import { toAMPM } from "../../../utils/Helpers";
import UserForm from "../../../components/Forms/User/UserForm";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCirclePlus,
  faCircleXmark,
  faDeleteLeft,
} from "@fortawesome/free-solid-svg-icons";

const Settings = () => {
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState({
    shift: false,
    user: false,
  });

  useEffect(() => {
    const get = async () => {
      const got = await getShifts();
      if (!got.success) {
        toast.error(got.message);
        return;
      }
      setShifts(got.shifts);
    };
    get();
  }, []);
  useEffect(() => {
    const get = async () => {
      const got = await getAllUsers();
      if (!got.success) {
        toast.error(got.message);
        return;
      }
      setUsers(got.users);
    };
    get();
  }, []);

  const handleUpdateShift = (newShift) => {
    setShifts((prev) => [...prev, newShift]);
  };
  const handleUpdateUser = (newUser) => {
    setUsers((prev) => [...prev, newUser]);
  };

  const handleDelete = async (id, item) => {
    if (!confirm(`Delete ${item}?`)) return;
    const del = item === "shift" ? await deleteShift(id) : await deleteUser(id);
    if (!del.success) {
      toast.error(del.message);
      return;
    }
    toast.success(del.message);

    if (item === "shift") {
      setShifts((prev) => prev.filter((s) => s.id !== id));
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  };

  return (
    <div className={styles.settingsContainer}>
      <div className={`${styles.settingsPanel} ${styles.shiftSettings}`}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Shifts</h3>
          <button
            type="button"
            className={styles.toggleAddBtn}
            onClick={() => setAdding((prev) => ({ ...prev, shift: !prev.shift }))}
          >
            <FontAwesomeIcon
              icon={adding.shift ? faCircleXmark : faCirclePlus}
              className={adding.shift ? styles.naw : styles.yaw}
            />
            <span>{adding.shift ? "Close" : "Add Shift"}</span>
          </button>
        </div>
        <FontAwesomeIcon
          icon={adding.shift ? faCircleXmark : faCirclePlus}
          className={styles.hiddenToggle}
        />
        {adding.shift && (
          <div className={styles.addShiftContainer}>
            <ShiftForm onCreateShift={handleUpdateShift} />
          </div>
        )}
        <div className={styles.shiftItems}>
          {shifts
            .filter((s) => s.id !== 9999 && s.id !== 9998)
            .map((shift, index) => (
              <div key={index} className={styles.itemCard}>
                <p className={styles.itemTitle}>{shift.title}</p>
                <p className={styles.itemMeta}>
                  Start Time: <span>{toAMPM(shift.start_time)}</span>
                </p>
                <p className={styles.itemMeta}>
                  End Time: <span>{toAMPM(shift.end_time)}</span>
                </p>
                <FontAwesomeIcon
                  icon={faDeleteLeft}
                  className={styles.deleteButton}
                  onClick={() => handleDelete(shift.id, "shift")}
                />
              </div>
            ))}
          {shifts.filter((s) => s.id !== 9999 && s.id !== 9998).length === 0 && (
            <p className={styles.emptyState}>No shifts found.</p>
          )}
        </div>
      </div>
      <div className={`${styles.settingsPanel} ${styles.userSettings}`}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Users</h3>
          <button
            type="button"
            className={styles.toggleAddBtn}
            onClick={() => setAdding((prev) => ({ ...prev, user: !prev.user }))}
          >
            <FontAwesomeIcon
              icon={adding.user ? faCircleXmark : faCirclePlus}
              className={adding.user ? styles.naw : styles.yaw}
            />
            <span>{adding.user ? "Close" : "Add User"}</span>
          </button>
        </div>
        <FontAwesomeIcon
          icon={adding.user ? faCircleXmark : faCirclePlus}
          className={styles.hiddenToggle}
        />
        {adding.user && (
          <div className={styles.addUserContainer}>
            <UserForm onNewUser={handleUpdateUser} />
          </div>
        )}
        <div className={styles.userItems}>
          {users.map((user, index) => (
            <div key={index} className={styles.itemCard}>
              <p className={styles.itemTitle}>{user.first_name}</p>
              <p className={styles.itemMeta}>{user.email}</p>
              <FontAwesomeIcon
                icon={faDeleteLeft}
                className={styles.deleteButton}
                onClick={() => handleDelete(user.id, "user")}
              />
            </div>
          ))}
          {users.length === 0 && <p className={styles.emptyState}>No users found.</p>}
        </div>
      </div>
    </div>
  );
};

export default Settings;
