import toast from "react-hot-toast";
import styles from "./TimeOffStatus.module.css";
import React, { useEffect, useState } from "react";
import {
  convertDateFromStr,
  MONTH_NAMES,
} from "../../../utils/Helpers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBackwardStep,
  faForwardStep,
} from "@fortawesome/free-solid-svg-icons";

const TimeOffStatus = () => {
  const today = new Date();
  const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [ro, setRo] = useState({
    pending: [],
    approved: [],
    denied: [],
  });
  const [pages, setPages] = useState({
    approved: 1,
    denied: 1,
  });
  const [pagination, setPagination] = useState({
    approved: { page: 1, total_pages: 1, total_items: 0 },
    denied: { page: 1, total_pages: 1, total_items: 0 },
  });
  const [selectedMonths, setSelectedMonths] = useState({
    approved: initialMonth,
    denied: initialMonth,
  });
  const [statusChanges, setStatusChanges] = useState(0);

  const shiftMonth = (monthValue, direction) => {
    const [year, month] = monthValue.split("-").map(Number);
    const shiftedDate = new Date(year, month - 1 + direction, 1);
    return `${shiftedDate.getFullYear()}-${String(shiftedDate.getMonth() + 1).padStart(2, "0")}`;
  };

  const formatMonthLabel = (monthValue) => {
    const [year, month] = monthValue.split("-").map(Number);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  };

  useEffect(() => {
    const getRequestOffs = async () => {
      const params = new URLSearchParams({
        approved_page: String(pages.approved),
        denied_page: String(pages.denied),
        approved_month: selectedMonths.approved,
        denied_month: selectedMonths.denied,
        limit: "25",
      });
      const response = await fetch(`/api/read/time_off_requests?${params}`);
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

      if (data.pagination) {
        setPagination({
          approved: data.pagination.approved,
          denied: data.pagination.denied,
        });
        setPages((prev) => ({
          approved: data.pagination.approved?.page ?? prev.approved,
          denied: data.pagination.denied?.page ?? prev.denied,
        }));
      }
    };

    getRequestOffs();
  }, [statusChanges, pages.approved, pages.denied, selectedMonths]);

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
        <div className={styles.sectionHeader}>
          <p>
            Approved Requests ({pagination.approved.total_items ?? ro.approved.length}
            )
          </p>
          <div className={styles.monthMover}>
            <button
              type="button"
              onClick={() => {
                setSelectedMonths((prev) => ({
                  ...prev,
                  approved: shiftMonth(prev.approved, -1),
                }));
                setPages((prev) => ({ ...prev, approved: 1 }));
              }}
              aria-label="Previous approved month"
            >
              <FontAwesomeIcon icon={faBackwardStep} />
            </button>
            <span>{formatMonthLabel(selectedMonths.approved)}</span>
            <button
              type="button"
              onClick={() => {
                setSelectedMonths((prev) => ({
                  ...prev,
                  approved: shiftMonth(prev.approved, 1),
                }));
                setPages((prev) => ({ ...prev, approved: 1 }));
              }}
              aria-label="Next approved month"
            >
              <FontAwesomeIcon icon={faForwardStep} />
            </button>
          </div>
        </div>
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
        <div className={styles.paginationControls}>
          <button
            type="button"
            onClick={() =>
              setPages((prev) => ({
                ...prev,
                approved: Math.max(prev.approved - 1, 1),
              }))
            }
            disabled={pagination.approved.page <= 1}
          >
            Previous
          </button>
          <span>
            Page {pagination.approved.page} of {pagination.approved.total_pages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPages((prev) => ({
                ...prev,
                approved: Math.min(
                  prev.approved + 1,
                  pagination.approved.total_pages || 1
                ),
              }))
            }
            disabled={pagination.approved.page >= pagination.approved.total_pages}
          >
            Next
          </button>
        </div>
      </div>
      {/* ---------------- DENIED ---------------- */}
      <div>
        <div className={styles.sectionHeader}>
          <p>Denied Requests ({pagination.denied.total_items ?? ro.denied.length})</p>
          <div className={styles.monthMover}>
            <button
              type="button"
              onClick={() => {
                setSelectedMonths((prev) => ({
                  ...prev,
                  denied: shiftMonth(prev.denied, -1),
                }));
                setPages((prev) => ({ ...prev, denied: 1 }));
              }}
              aria-label="Previous denied month"
            >
              <FontAwesomeIcon icon={faBackwardStep} />
            </button>
            <span>{formatMonthLabel(selectedMonths.denied)}</span>
            <button
              type="button"
              onClick={() => {
                setSelectedMonths((prev) => ({
                  ...prev,
                  denied: shiftMonth(prev.denied, 1),
                }));
                setPages((prev) => ({ ...prev, denied: 1 }));
              }}
              aria-label="Next denied month"
            >
              <FontAwesomeIcon icon={faForwardStep} />
            </button>
          </div>
        </div>
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
        <div className={styles.paginationControls}>
          <button
            type="button"
            onClick={() =>
              setPages((prev) => ({
                ...prev,
                denied: Math.max(prev.denied - 1, 1),
              }))
            }
            disabled={pagination.denied.page <= 1}
          >
            Previous
          </button>
          <span>
            Page {pagination.denied.page} of {pagination.denied.total_pages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPages((prev) => ({
                ...prev,
                denied: Math.min(
                  prev.denied + 1,
                  pagination.denied.total_pages || 1
                ),
              }))
            }
            disabled={pagination.denied.page >= pagination.denied.total_pages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeOffStatus;
