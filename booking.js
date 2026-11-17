/* JACT public booking form. Public visitors only INSERT booking requests. */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  const date = document.getElementById("date");
  const service = document.getElementById("service");
  const time = document.getElementById("time");

  if (date) {
    const today = new Date();
    date.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
  }

  if (time && !time.value) time.value = "Flexible";

  if (service) {
    const preset = new URLSearchParams(location.search).get("service");
    if (preset) {
      const match = [...service.options].find(option =>
        option.value.toLowerCase() === preset.trim().toLowerCase()
      );
      if (match) service.value = match.value;
    }
  }

  if (form) form.addEventListener("submit", submitBooking);
});

async function submitBooking(event) {
  event.preventDefault();

  const form = document.getElementById("bookingForm");
  const status = document.getElementById("bookingStatus");
  const submitButton = form.querySelector('button[type="submit"]');
  const get = id => document.getElementById(id)?.value.trim() || "";

  const booking = {
    customer_name: get("name"),
    phone: get("phone"),
    email: get("email") || null,
    service_type: get("service"),
    bike_make: get("bike"),
    bike_model: get("model") || null,
    preferred_date: get("date"),
    preferred_time: get("time") || "Flexible",
    location: get("location") || null,
    details: get("details"),
    status: "pending"
  };

  const allowedServices = [
    "General repair", "Electrical repair", "Maintenance / service",
    "Spare parts enquiry", "Other"
  ];

  if (!allowedServices.includes(booking.service_type)) {
    showStatus(status, "Please select a valid service.", "error");
    return;
  }

  if (!booking.customer_name || !booking.phone || !booking.bike_make ||
      !booking.preferred_date || !booking.details) {
    showStatus(status, "Please complete all required fields.", "error");
    return;
  }

  if (!form.reportValidity()) return;

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }
    showStatus(status, "Submitting your booking request...");

    const sb = await getSupabase();

    // Do not SELECT bookings from a public page: RLS intentionally blocks that.
    // Duplicate checks are handled by JACT when reviewing the request.
    const { error } = await sb.from("bookings").insert(booking);
    if (error) throw error;

    showStatus(
      status,
      "Your " + booking.service_type +
      " request was submitted successfully. JACT will contact you to confirm availability."
    );

    form.reset();
    const timeField = document.getElementById("time");
    if (timeField) timeField.value = "Flexible";
  } catch (error) {
    console.error("Booking error:", error);
    showStatus(status, error.message || "Something went wrong. Please try again.", "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit booking request";
    }
  }
}
