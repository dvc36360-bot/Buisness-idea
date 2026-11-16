
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  const date = document.getElementById("date");
  const service = document.getElementById("service");
  const time = document.getElementById("time");

  // Prevent dates in the past
  if (date) {
    const today = new Date();

    date.min = new Date(
      today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);
  }

  // Default preferred time
  if (time && !time.value) {
    time.value = "Flexible";
  }

  // Support service links with preset services
  if (service) {
    const preset = new URLSearchParams(location.search).get("service");

    if (preset) {
      const matchingOption = [...service.options].find(option =>
        option.value.toLowerCase() === preset.trim().toLowerCase()
      );

      if (matchingOption) {
        service.value = matchingOption.value;
      }
    }
  }

  if (form) {
    form.addEventListener("submit", submitBooking);
  }
});


async function submitBooking(event) {
  event.preventDefault();

  const form = document.getElementById("bookingForm");
  const status = document.getElementById("bookingStatus");
  const submitButton = form.querySelector('button[type="submit"]');

  const get = id => {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
  };

  // Motorcycle details
  const make = get("bike");
  const model = get("model");

  // Selected service
  const selectedService = get("service");

  const allowedServices = [
    "General repair",
    "Electrical repair",
    "Maintenance / service",
    "Spare parts enquiry",
    "Other"
  ];

  if (!allowedServices.includes(selectedService)) {
    showStatus(status, "Please select a valid service.", "error");
    return;
  }

  // Booking information
  const booking = {
    customer_name: get("name"),
    phone: get("phone"),
    email: get("email") || null,

    motorcycle: [make, model]
      .filter(Boolean)
      .join(" "),

    service: selectedService,

    preferred_date: get("date"),

    // Never send null for preferred_time
    preferred_time: get("time") || "Flexible",

    location: get("location") || null,
    details: get("details"),

    status: "pending"
  };

  // Validate required fields
  if (
    !booking.customer_name ||
    !booking.phone ||
    !booking.motorcycle ||
    !booking.service ||
    !booking.preferred_date ||
    !booking.details
  ) {
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

    // Check for an existing active booking
    const { data: existing, error: checkError } = await sb
      .from("bookings")
      .select("id")
      .eq("phone", booking.phone)
      .eq("preferred_date", booking.preferred_date)
      .in("status", ["pending", "confirmed"])
      .limit(1);

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      showStatus(
        status,
        "You already have an active booking request for this phone number on that date. Please contact JACT.",
        "error"
      );
      return;
    }

    // Save booking to Supabase
    const { error } = await sb
      .from("bookings")
      .insert(booking);

    if (error) throw error;

    showStatus(
      status,
      "Your " + selectedService +
      " booking request was submitted successfully! JACT will contact you to confirm your appointment."
    );

    form.reset();

    // Restore default time after reset
    const timeField = document.getElementById("time");
    if (timeField) {
      timeField.value = "Flexible";
    }

  } catch (error) {
    console.error("Booking error:", error);

    showStatus(
      status,
      error.message || "Something went wrong. Please try again.",
      "error"
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit booking request";
    }
  }
}
