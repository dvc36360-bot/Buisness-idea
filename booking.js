
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  const date = document.getElementById("date");
  const service = document.getElementById("service");

  // Prevent past dates
  if (date) {
    const today = new Date();
    date.min = new Date(
      today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);
  }

  // Support service presets in the URL
  const preset = new URLSearchParams(location.search).get("service");

  if (preset && service) {
    const matchingOption = [...service.options].find(
      option =>
        option.value.toLowerCase() === preset.toLowerCase() ||
        option.textContent.trim().toLowerCase() === preset.toLowerCase()
    );

    if (matchingOption) {
      service.value = matchingOption.value;
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

  const get = id => {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
  };

  // Get motorcycle information
  const make = get("bike");
  const model = get("model");

  // Build booking object using database column names
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

  // Validate required information
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
      "Please complete all required fields, including your motorcycle and service.",
      "error"
    );
    return;
  }

  // Disable button while submitting
  const button = form.querySelector('[type="submit"]');
  const originalText = button ? button.textContent : "";

  if (button) {
    button.disabled = true;
    button.textContent = "Submitting...";
  }

  try {
    const sb = await getSupabase();

    // Check for existing active booking
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
        "There is already an active booking for this phone number on that date. Please contact JACT.",
        "error"
      );
      return;
    }

    // Insert booking into Supabase
    const { data, error } = await sb
      .from("bookings")
      .insert([booking])
      .select();

    if (error) {
      throw error;
    }

    console.log("Booking successfully saved:", data);

    showStatus(
      status,
      "Your booking request has been submitted successfully! JACT will contact you to confirm your appointment.",
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

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}
