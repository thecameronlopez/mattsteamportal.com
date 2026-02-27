import toast from "react-hot-toast";
import styles from "./TimeOffStatus.module.css";
import React, { useEffect, useState } from "react";
import { convertDateFromStr } from "../../../utils/Helpers";

const TimeOffStatus = () => {
  const [ro, setRo] = useState({
    pending: [],
    approved: [],
    denied: [],
  });
  const [statusChanges, setStatusChanges] = useState(0);

  useEffect(() => {
    const getRequestOffs = async () => {
      const response = await fetch("/api/read/time_off_requests");
      const data = await response.json();
      if (!data.success) {
        // toast.error(data.message);
        return;
      }
      setRo({
        pending: [...data.time_off_requests.pending],
        approved: [...data.time_off_requests.approved],
        denied: [...data.time_off_requests.denied],
      });
    };

    getRequestOffs();
  }, [statusChanges]);

  const deleteTimeOffRequest = async (id) => {
    if (!confirm("Delete time off request?")) return;
    try {
      const response = await fetch(`/api/delete/time_off_request/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      setStatusChanges((prev) => prev + 1);
      toast.success(data.message);
    } catch (error) {
      console.error("[TIME OFF DELETE ERROR]: ", error);
      toast.error(error.message);
    }
  };

  const handleUpdate = async (requestID, newStatus) => {
    const response = await fetch(
      `/api/update/time_off_request/${requestID}/${newStatus}`,
      {
        method: "PATCH",
        credentials: "include",
      }
    );
    const data = await response.json();
    if (!data.success) {
      toast.error(data.message);
      return;
    }
    setStatusChanges((prev) => prev + 1);
    toast.success(data.message);
  };

  return (
    <div className={styles.timeOffStatusMasterBlock}>
      <h2>Time Off Requests</h2>
      {/* ---------------- PENDING ---------------- */}
      <div>
        <p>Pending Requests</p>
        <ul className={styles.pendingList}>
          {ro.pending.length !== 0 ? (
            ro.pending.map(
              ({ id, user, reason, start_date, end_date, is_pto }) => (
                <li key={id}>
                  <div>
                    <h4>
                      {user.first_name} {user.last_name}
                    </h4>
                    <p>
                      <strong>Start Date:</strong>{" "}
                      {convertDateFromStr(start_date)}
                    </p>
                    <p>
                      <strong>End Date:</strong> {convertDateFromStr(end_date)}
                    </p>
                    <p>
                      <strong>Reason:</strong> {reason}
                    </p>
                    <p>
                      <strong>PTO:</strong> {is_pto ? "Yes" : "No"}
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() =>
                        handleUpdate(
                          id,
                          "approved",
                          user.id,
                          start_date,
                          end_date
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      className={styles.denyRequest}
                      onClick={() =>
                        handleUpdate(
                          id,
                          "denied",
                          user.id,
                          start_date,
                          end_date
                        )
                      }
                    >
                      Deny
                    </button>
                  </div>
                </li>
              )
            )
          ) : (
            <li className={styles.noRequests}>
              <p>No Pending Requests</p>
            </li>
          )}
        </ul>
      </div>
      {/* ---------------- APPROVED ---------------- */}
      <div>
        <p>Approved Requests</p>
        <ul className={styles.approvedList}>
          {ro.approved.length !== 0 ? (
            ro.approved.map(
              ({ id, user, reason, start_date, end_date, is_pto }) => (
                <li key={id}>
                  <div>
                    <h4>
                      {user.first_name} {user.last_name}
                    </h4>
                    <p>
                      <strong>Start Date:</strong>{" "}
                      {convertDateFromStr(start_date)}
                    </p>
                    <p>
                      <strong>End Date:</strong> {convertDateFromStr(end_date)}
                    </p>
                    <p>
                      <strong>Reason:</strong> {reason}
                    </p>
                    <p>
                      <strong>PTO:</strong> {is_pto ? "Yes" : "No"}
                    </p>
                  </div>
                  <div>
                    <button
                      className={styles.denyRequest}
                      onClick={() =>
                        handleUpdate(
                          id,
                          "denied",
                          user.id,
                          start_date,
                          end_date
                        )
                      }
                    >
                      Deny
                    </button>
                  </div>
                </li>
              )
            )
          ) : (
            <li className={styles.noRequests}>
              <p>No Approved Requests</p>
            </li>
          )}
        </ul>
      </div>
      {/* ---------------- DENIED ---------------- */}
      <div>
        <p>Denied Requests</p>
        <ul className={styles.deniedList}>
          {ro.denied.length !== 0 ? (
            ro.denied.map(
              ({ id, user, reason, start_date, end_date, is_pto }) => (
                <li key={id}>
                  <div>
                    <h4>
                      {user.first_name} {user.last_name}
                    </h4>
                    <p>
                      <strong>Start Date:</strong>{" "}
                      {convertDateFromStr(start_date)}
                    </p>
                    <p>
                      <strong>End Date:</strong> {convertDateFromStr(end_date)}
                    </p>
                    <p>
                      <strong>Reason:</strong> {reason}
                    </p>
                    <p>
                      <strong>PTO:</strong> {is_pto ? "Yes" : "No"}
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() =>
                        handleUpdate(
                          id,
                          "approved",
                          user.id,
                          start_date,
                          end_date
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => deleteTimeOffRequest(id)}
                      className={styles.denyRequest}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            )
          ) : (
            <li className={styles.noRequests}>
              <p>No Denied Requests</p>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default TimeOffStatus;
