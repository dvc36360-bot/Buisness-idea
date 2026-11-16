
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  const date = document.getElementById("date");

  // Prevent booking dates in the past
  if (date) {
    const d = new Date();
    date.min = new Date(
      d.getTime() - d.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);
  }

  // Support service links with a preset service
  const preset = new URLSearchParams(location.search).get("service");

  if (preset) {
    document.getElementById("service").value = preset;
  }

  if (form) {
    form.addEventListener("submit", submitBooking);
  }
});


async function submitBooking(ev) {
  ev.preventDefault();

  const form = document.getElementById("bookingForm");
  const status = document.getElementById("bookingStatus");

  const get = id => {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
  };

  // Motorcycle details
  const make = get("bike");
  const model = get("model");

  // Booking information
  const booking = {
    customer_name: get("name"),
    phone: get("phone"),
    email: get("email") || null,

    motorcycle: [make, model]
      .filter(Boolean)
      .join(" "),

    service: get("service"),

    preferred_date: get("date"),
    preferred_time: get("time") || null,

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
    showStatus(
      status,
      "Please complete all required fields.",
      "error"
    );
    return;
  }

  try {
    const sb = await getSupabase();

    // Check for an existing active booking
    const {
      data: existing,
      error: checkError
    } = await sb
      .from("bookings")
      .select("id")
      .eq("phone", booking.phone)
      .eq("preferred_date", booking.preferred_date)
      .in("status", ["pending", "confirmed"])
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (existing && existing.length > 0) {
      showStatus(
        status,
        "There is already an active booking request for this phone number on that date. Please contact JACT.",
        "error"
      );
      return;
    }

    // Save booking to Supabase
    const { error } = await sb
      .from("bookings")
      .insert(booking);

    if (error) {
      throw error;
    }

    // Success
    showStatus(
      status,
      "Your booking request has been submitted successfully. JACT will contact you to confirm the appointment.",
      "success"
    );

    form.reset();

  } catch (error) {
    console.error("Booking submission error:", error);

    showStatus(
      status,
      error.message || "Something went wrong. Please try again.",
      "error"
    );
  }
}
