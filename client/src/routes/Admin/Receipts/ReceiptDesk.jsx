import styles from "./ReceiptDesk.module.css";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  deleteReceipt,
  exportReceiptsCsv,
  getAllUsers,
  getReceipt,
  getReceipts,
  updateReceipt,
} from "../../../utils/API";
import { useAuth } from "../../../Context/AuthContext";

const PAYMENT_METHODS = [
  "Cash",
  "Check",
  "ACH",
  "Amex-25009",
  "Amex-41005",
  "Amex-24002",
  "Amex-91007",
  "Amex-52006",
  "Amex-41002",
  "JD Bank - 7049",
  "JD Bank - 5092",
  "Personal Card",
  "Fuel Card",
  "Other",
];

const EXPENSE_CATEGORIES = [
  "Appliances",
  "Parts",
  "Supplies",
  "Fuel",
  "Meals",
  "Office",
  "Marketing",
  "Maintenance",
  "Vehicle",
  "Other",
];

const RECEIPT_STATUS_OPTIONS = ["submitted", "reviewed", "matched"];
const EMAIL_DELIVERY_OPTIONS = ["pending", "sent", "failed"];
const DESKTOP_MEDIA_QUERY = "(min-width: 1100px)";
const NOTE_PRESETS = [
  {
    label: "Waiting on clarification",
    value: "Waiting on clarification from employee before review can be completed.",
  },
  {
    label: "Missing receipt accepted",
    value: "Missing receipt explanation reviewed and accepted.",
  },
  {
    label: "Amount/vendor mismatch",
    value: "Amount or vendor details need follow-up against supporting documentation.",
  },
  {
    label: "Matched to statement",
    value: "Matched to statement and ready for archive.",
  },
];

const formatCurrencyFromCents = (amountInCents) => {
  const numericAmount = Number(amountInCents || 0);
  return (numericAmount / 100).toFixed(2);
};

const formatDateLabel = (value) => {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const buildDraftFromReceipt = (receipt) => ({
  employee: receipt.employee || "",
  amount: formatCurrencyFromCents(receipt.amount),
  method_used: receipt.method_used || "",
  submission_date: receipt.submission_date || "",
  purchase_date: receipt.purchase_date || "",
  vendor: receipt.vendor || "",
  business_reason: receipt.business_reason || "",
  expense_category: receipt.expense_category || "",
  po_required: Boolean(receipt.po_required),
  po_number: receipt.po_number || "",
  work_order_number: receipt.work_order_number || "",
  missing_receipt: Boolean(receipt.missing_receipt),
  missing_receipt_reason: receipt.missing_receipt_reason || "",
  receipt_status: receipt.receipt_status || "submitted",
  external_file_url: receipt.external_file_url || "",
  external_file_id: receipt.external_file_id || "",
  email_delivery_status: receipt.email_delivery_status || "pending",
  email_delivery_error: receipt.email_delivery_error || "",
  matched_to_statement: Boolean(receipt.matched_to_statement),
  reviewed_by: receipt.reviewed_by || "",
  reviewed_date: receipt.reviewed_date || "",
  notes: receipt.notes || "",
});

const draftsMatch = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const ReceiptDesk = () => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [draft, setDraft] = useState(null);
  const [initialDraft, setInitialDraft] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  });
  const [filters, setFilters] = useState({
    searchInput: "",
    appliedSearch: "",
    status: "",
    page: 1,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 1,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncLayout = (event) => setIsDesktop(event.matches);

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", syncLayout);

    return () => {
      mediaQuery.removeEventListener("change", syncLayout);
    };
  }, []);

  useEffect(() => {
    const loadAdminUsers = async () => {
      const result = await getAllUsers();

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      setAdminUsers(result.users.filter((candidate) => candidate.role === "admin"));
    };

    loadAdminUsers();
  }, []);

  useEffect(() => {
    const loadReceipts = async () => {
      setLoadingList(true);

      const result = await getReceipts({
        page: filters.page,
        limit: pagination.limit,
        status: filters.status,
        search: filters.appliedSearch,
      });

      if (!result.success) {
        toast.error(result.message);
        setReceipts([]);
        setPagination((current) => ({ ...current, total_items: 0, total_pages: 1 }));
        setLoadingList(false);
        return;
      }

      setReceipts(result.receipts);
      if (result.pagination) {
        setPagination(result.pagination);
      }
      setLoadingList(false);
    };

    loadReceipts();
  }, [filters.page, filters.status, filters.appliedSearch, refreshKey, pagination.limit]);

  useEffect(() => {
    if (!receipts.length) {
      setSelectedReceiptId(null);
      setSelectedReceipt(null);
      setDraft(null);
      setInitialDraft(null);
      return;
    }

    const selectedStillVisible = receipts.some(
      (receipt) => receipt.id === selectedReceiptId,
    );

    if (!selectedReceiptId || !selectedStillVisible) {
      setSelectedReceiptId(receipts[0].id);
    }
  }, [receipts, selectedReceiptId]);

  useEffect(() => {
    if (!selectedReceiptId) {
      return;
    }

    const loadReceiptDetail = async () => {
      setLoadingDetail(true);
      const result = await getReceipt(selectedReceiptId);

      if (!result.success) {
        toast.error(result.message);
        setLoadingDetail(false);
        return;
      }

      const nextDraft = buildDraftFromReceipt(result.receipt);
      setSelectedReceipt(result.receipt);
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
      setLoadingDetail(false);
    };

    loadReceiptDetail();
  }, [selectedReceiptId]);

  const isDirty = useMemo(() => {
    if (!draft || !initialDraft) {
      return false;
    }

    return !draftsMatch(draft, initialDraft);
  }, [draft, initialDraft]);

  const currentReviewerName = useMemo(() => {
    if (!user) {
      return "";
    }

    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }

    return user.username || "";
  }, [user]);

  const reviewerOptions = useMemo(() => {
    const names = adminUsers
      .map((adminUser) =>
        adminUser.first_name && adminUser.last_name
          ? `${adminUser.first_name} ${adminUser.last_name}`
          : adminUser.username || "",
      )
      .filter(Boolean);

    if (currentReviewerName && !names.includes(currentReviewerName)) {
      names.unshift(currentReviewerName);
    }

    return [...new Set(names)];
  }, [adminUsers, currentReviewerName]);

  const effectiveReviewedBy = draft?.reviewed_by || currentReviewerName || "";

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      appliedSearch: current.searchInput.trim(),
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      searchInput: "",
      appliedSearch: "",
      status: "",
      page: 1,
    });
  };

  const handleExport = async () => {
    setExporting(true);
    const result = await exportReceiptsCsv({
      status: filters.status,
      search: filters.appliedSearch,
    });
    setExporting(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success("Receipt CSV export downloaded.");
  };

  const handleDraftFieldChange = (event) => {
    const { name, value } = event.target;

    setDraft((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleDraftToggle = (event) => {
    const { name, checked } = event.target;

    setDraft((current) => {
      const nextDraft = {
        ...current,
        [name]: checked,
      };

      if (name === "missing_receipt" && !checked) {
        nextDraft.missing_receipt_reason = "";
      }

      if (name === "po_required" && !checked) {
        nextDraft.po_number = "";
      }

      return nextDraft;
    });
  };

  const handleApplyNotePreset = (presetText) => {
    if (!isDesktop) {
      return;
    }

    setDraft((current) => {
      if (!current) {
        return current;
      }

      const existingNotes = current.notes.trim();
      if (!existingNotes) {
        return {
          ...current,
          notes: presetText,
        };
      }

      if (existingNotes.includes(presetText)) {
        return current;
      }

      return {
        ...current,
        notes: `${existingNotes}\n${presetText}`,
      };
    });
  };

  const applyQuickReviewAction = async (action) => {
    if (!selectedReceiptId || !draft || !isDesktop) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    let nextDraft = {
      ...draft,
      reviewed_by: draft.reviewed_by || currentReviewerName,
      reviewed_date: draft.reviewed_date || today,
    };

    if (action === "reviewed") {
      nextDraft = {
        ...nextDraft,
        receipt_status: "reviewed",
      };
    }

    if (action === "matched") {
      const existingNotes = nextDraft.notes.trim();
      const matchedNote = NOTE_PRESETS.find(
        (preset) => preset.label === "Matched to statement",
      )?.value;

      nextDraft = {
        ...nextDraft,
        receipt_status: "matched",
        matched_to_statement: true,
        notes:
          matchedNote && existingNotes && !existingNotes.includes(matchedNote)
            ? `${existingNotes}\n${matchedNote}`
            : matchedNote && !existingNotes
              ? matchedNote
              : nextDraft.notes,
      };
    }

    setDraft(nextDraft);
    setSaving(true);
    const result = await updateReceipt(selectedReceiptId, nextDraft);
    setSaving(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    const refreshedDraft = buildDraftFromReceipt(result.receipt);
    setSelectedReceipt(result.receipt);
    setDraft(refreshedDraft);
    setInitialDraft(refreshedDraft);
    setRefreshKey((current) => current + 1);
    toast.success(
      action === "matched"
        ? "Receipt marked as matched."
        : "Receipt marked as reviewed.",
    );
  };

  const handleSave = async () => {
    if (!selectedReceiptId || !draft || !isDesktop) {
      return;
    }

    setSaving(true);
    const payload = {
      ...draft,
      reviewed_by: draft.reviewed_by || currentReviewerName,
    };
    const result = await updateReceipt(selectedReceiptId, payload);
    setSaving(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    const nextDraft = buildDraftFromReceipt(result.receipt);
    setSelectedReceipt(result.receipt);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setRefreshKey((current) => current + 1);
    toast.success(result.message);
  };

  const handleDelete = async () => {
    if (!selectedReceiptId || !isDesktop) {
      return;
    }

    if (
      !confirm(
        "Delete this receipt record and remove its Google sheet row and Drive file if they exist?",
      )
    ) {
      return;
    }

    setDeleting(true);
    const result = await deleteReceipt(selectedReceiptId);
    setDeleting(false);

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    setSelectedReceiptId(null);
    setSelectedReceipt(null);
    setDraft(null);
    setInitialDraft(null);
    setRefreshKey((current) => current + 1);
    if (result.cleanup?.deletedDriveFileId) {
      toast.success(
        `${result.message} Google cleanup completed for Drive file ${result.cleanup.deletedDriveFileId}.`,
      );
      return;
    }

    toast.success(result.message);
  };

  return (
    <div className={styles.receiptDesk}>
      <div className={styles.header}>
        <div>
          <h2>Receipt Desk</h2>
          <p>
            Review and maintain submitted receipts. Desktop keeps full edit and
            delete controls; smaller screens stay read only.
          </p>
        </div>
        <div className={styles.headerStats}>
          <span>{pagination.total_items} receipts</span>
          <span>{filters.status || "all statuses"}</span>
        </div>
      </div>

      <form className={styles.toolbar} onSubmit={handleSearchSubmit}>
        <input
          type="search"
          value={filters.searchInput}
          placeholder="Search by employee, vendor, UUID, or reviewer"
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              searchInput: event.target.value,
            }))
          }
        />
        <select
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: event.target.value,
              page: 1,
            }))
          }
        >
          <option value="">All statuses</option>
          {RECEIPT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button type="submit">Search</button>
        <button type="button" onClick={handleResetFilters}>
          Reset
        </button>
        <button type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </form>

      <div className={styles.workspace}>
        <section className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <h3>Submitted Receipts</h3>
            <p>
              Page {pagination.page} of {pagination.total_pages}
            </p>
          </div>

          {loadingList ? (
            <div className={styles.emptyState}>Loading receipts...</div>
          ) : receipts.length === 0 ? (
            <div className={styles.emptyState}>No receipts matched this view.</div>
          ) : (
            <div className={styles.receiptList}>
              {receipts.map((receipt) => (
                <button
                  key={receipt.id}
                  type="button"
                  className={`${styles.receiptListItem} ${
                    receipt.id === selectedReceiptId ? styles.receiptListItemActive : ""
                  }`}
                  onClick={() => setSelectedReceiptId(receipt.id)}
                >
                  <div className={styles.receiptListTop}>
                    <span className={styles.receiptListTitle}>{receipt.employee}</span>
                    <span className={styles.receiptListAmount}>
                      ${formatCurrencyFromCents(receipt.amount)}
                    </span>
                  </div>
                  <div className={styles.receiptListMeta}>
                    <span>{receipt.vendor}</span>
                    <span>{formatDateLabel(receipt.purchase_date)}</span>
                  </div>
                  <div className={styles.receiptListTags}>
                    <span>{receipt.receipt_status}</span>
                    <span>{receipt.email_delivery_status}</span>
                    {receipt.missing_receipt && <span>missing receipt</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className={styles.paginationRow}>
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: Math.max(current.page - 1, 1),
                }))
              }
              disabled={pagination.page <= 1}
            >
              Previous
            </button>
            <span>
              {pagination.total_items} total
            </span>
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: Math.min(current.page + 1, pagination.total_pages || 1),
                }))
              }
              disabled={pagination.page >= pagination.total_pages}
            >
              Next
            </button>
          </div>
        </section>

        <section className={styles.detailPanel}>
          {!selectedReceiptId ? (
            <div className={styles.emptyState}>Select a receipt to review.</div>
          ) : loadingDetail || !draft || !selectedReceipt ? (
            <div className={styles.emptyState}>Loading receipt details...</div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h3>Receipt #{selectedReceipt.id}</h3>
                  <p>{selectedReceipt.uuid}</p>
                </div>
                {!isDesktop && (
                  <p className={styles.mobileNotice}>
                    Mobile view is read only. Use a desktop-width screen to edit
                    or delete receipts.
                  </p>
                )}
              </div>

              <div className={styles.detailGrid}>
                <label className={styles.field}>
                  <span>Employee</span>
                  <input
                    name="employee"
                    value={draft.employee}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={styles.field}>
                  <span>Amount</span>
                  <input
                    name="amount"
                    value={draft.amount}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={styles.field}>
                  <span>Method Used</span>
                  <select
                    name="method_used"
                    value={draft.method_used}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  >
                    <option value="">Select method</option>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Expense Category</span>
                  <select
                    name="expense_category"
                    value={draft.expense_category}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category || "blank"} value={category}>
                        {category || "None"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Submission Date</span>
                  <input
                    type="date"
                    name="submission_date"
                    value={draft.submission_date}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={styles.field}>
                  <span>Purchase Date</span>
                  <input
                    type="date"
                    name="purchase_date"
                    value={draft.purchase_date}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Vendor</span>
                  <input
                    name="vendor"
                    value={draft.vendor}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Business Reason</span>
                  <textarea
                    name="business_reason"
                    value={draft.business_reason}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={styles.toggleField}>
                  <input
                    type="checkbox"
                    name="po_required"
                    checked={draft.po_required}
                    onChange={handleDraftToggle}
                    disabled={!isDesktop}
                  />
                  <span>PO Required</span>
                </label>

                <label className={styles.toggleField}>
                  <input
                    type="checkbox"
                    name="missing_receipt"
                    checked={draft.missing_receipt}
                    onChange={handleDraftToggle}
                    disabled={!isDesktop}
                  />
                  <span>Missing Receipt</span>
                </label>

                <label className={styles.toggleField}>
                  <input
                    type="checkbox"
                    name="matched_to_statement"
                    checked={draft.matched_to_statement}
                    onChange={handleDraftToggle}
                    disabled={!isDesktop}
                  />
                  <span>Matched to Statement</span>
                </label>

                <label className={styles.field}>
                  <span>PO Number</span>
                  <input
                    name="po_number"
                    value={draft.po_number}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={styles.field}>
                  <span>Work Order Number</span>
                  <input
                    name="work_order_number"
                    value={draft.work_order_number}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={styles.field}>
                  <span>Receipt Status</span>
                  <select
                    name="receipt_status"
                    value={draft.receipt_status}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  >
                    {RECEIPT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Email Delivery Status</span>
                  <select
                    name="email_delivery_status"
                    value={draft.email_delivery_status}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  >
                    {EMAIL_DELIVERY_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Reviewed By</span>
                  <select
                    name="reviewed_by"
                    value={effectiveReviewedBy}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  >
                    <option value="">Select reviewer</option>
                    {reviewerOptions.map((reviewerName) => (
                      <option key={reviewerName} value={reviewerName}>
                        {reviewerName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Reviewed Date</span>
                  <input
                    type="date"
                    name="reviewed_date"
                    value={draft.reviewed_date}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Missing Receipt Reason</span>
                  <textarea
                    name="missing_receipt_reason"
                    value={draft.missing_receipt_reason}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop || !draft.missing_receipt}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>External File URL</span>
                  <input
                    name="external_file_url"
                    value={draft.external_file_url}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>External File ID</span>
                  <input
                    name="external_file_id"
                    value={draft.external_file_id}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Email Delivery Error</span>
                  <textarea
                    name="email_delivery_error"
                    value={draft.email_delivery_error}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>

                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Notes</span>
                  <div className={styles.notePresets}>
                    {NOTE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleApplyNotePreset(preset.value)}
                        disabled={!isDesktop}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    name="notes"
                    value={draft.notes}
                    onChange={handleDraftFieldChange}
                    disabled={!isDesktop}
                  />
                </label>
              </div>

              <div className={styles.metaStrip}>
                <span>Created: {new Date(selectedReceipt.created_at).toLocaleString()}</span>
                <span>Updated: {new Date(selectedReceipt.updated_at).toLocaleString()}</span>
              </div>

              {isDesktop && (
                <div className={styles.quickActionRow}>
                  <button
                    type="button"
                    onClick={() => applyQuickReviewAction("reviewed")}
                    disabled={saving || deleting}
                  >
                    Mark Reviewed
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickReviewAction("matched")}
                    disabled={saving || deleting}
                  >
                    Mark Matched
                  </button>
                </div>
              )}

              <div className={styles.linkRow}>
                {selectedReceipt.external_file_url ? (
                  <a href={selectedReceipt.external_file_url} target="_blank" rel="noreferrer">
                    Open external file
                  </a>
                ) : (
                  <span>No external file linked yet.</span>
                )}
              </div>

              {isDesktop && (
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty || saving || deleting}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={handleDelete}
                    disabled={saving || deleting}
                  >
                    {deleting ? "Deleting..." : "Delete Receipt"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default ReceiptDesk;
