//
//  GET
//
export const getShifts = async () => {
  try {
    const response = await fetch("/api/read/shifts");
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    return { success: true, shifts: data.shifts };
  } catch (error) {
    console.error("[SHIFT GET ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

export const getUsers = async () => {
  try {
    const response = await fetch("/api/read/users");
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    return { success: true, users: data.users };
  } catch (error) {
    console.error("[SHIFT GET ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

export const getAllUsers = async () => {
  try {
    const response = await fetch("/api/read/all_users");
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    return { success: true, users: data.users };
  } catch (error) {
    console.error("[SHIFT GET ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

export const getSchedules = async () => {
  try {
    const response = await fetch("/api/read/schedules");
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message);
    }
    return { success: true, schedules: data.schedules };
  } catch (error) {
    console.error("[SCHEDULE QUERY ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

//
//  DELETE
//
const DELETE_HEADERS = {
  method: "DELETE",
  credentials: "include",
};

export const deleteShift = async (id) => {
  try {
    const response = await fetch(`/api/delete/shift/${id}`, DELETE_HEADERS);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message);
    }
    return { success: true, message: data.message };
  } catch (error) {
    console.error("[SHIFT DELETION ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

export const deleteUser = async (id) => {
  try {
    const response = await fetch(`/api/delete/user/${id}`, DELETE_HEADERS);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message);
    }
    return { success: true, message: data.message };
  } catch (error) {
    console.error("[USER DELETION ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

//
//  UPDATE
//

//
//  CREATE
//
const parseJsonResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const rawText = await response.text();

    throw new Error(
      rawText?.trim() ||
        "The server returned an unexpected response. Please try again.",
    );
  }

  return response.json();
};

export const submitReceipt = async (formData) => {
  try {
    const response = await fetch("/api/receipts/submit", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        data.message || "There was an error when submitting the receipt.",
      );
    }

    if (!data.success) {
      throw new Error(data.message);
    }

    return {
      success: true,
      message: data.message,
      receiptId: data.receipt_id,
      warning: data.warning || null,
      emailDeliveryStatus: data.email_delivery_status || null,
    };
  } catch (error) {
    console.error("[RECEIPT SUBMIT ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

export const getReceipts = async ({
  page = 1,
  limit = 20,
  status = "",
  search = "",
} = {}) => {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (status) {
      params.set("status", status);
    }

    if (search) {
      params.set("search", search);
    }

    const response = await fetch(`/api/receipts?${params.toString()}`, {
      credentials: "include",
    });
    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load receipts.");
    }

    return {
      success: true,
      receipts: data.receipts || [],
      pagination: data.pagination || null,
    };
  } catch (error) {
    console.error("[RECEIPT LIST ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

export const getReceipt = async (id) => {
  try {
    const response = await fetch(`/api/receipts/${id}`, {
      credentials: "include",
    });
    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load receipt.");
    }

    return { success: true, receipt: data.receipt };
  } catch (error) {
    console.error("[RECEIPT DETAIL ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

export const updateReceipt = async (id, payload) => {
  try {
    const response = await fetch(`/api/receipts/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to update receipt.");
    }

    return {
      success: true,
      message: data.message,
      receipt: data.receipt,
    };
  } catch (error) {
    console.error("[RECEIPT UPDATE ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

export const deleteReceipt = async (id) => {
  try {
    const response = await fetch(`/api/receipts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await parseJsonResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to delete receipt.");
    }

    return {
      success: true,
      message: data.message,
      cleanup: data.cleanup || null,
    };
  } catch (error) {
    console.error("[RECEIPT DELETE ERROR]: ", error);
    return { success: false, message: error.message };
  }
};

//
//  PRINT
//
export const printSchedule = async (startDate, endDate, department) => {
  try {
    const response = await fetch(
      `/api/print/schedule?start_date=${startDate}&end_date=${endDate}&department=${department}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch PDF");
    }

    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "weekly_schedule.pdf";
    document.body.appendChild(link);
    link.click();

    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("[USER DELETION ERROR]: ", error);
  }
};
