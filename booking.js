
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  const date = document.getElementById("date");

  if (date) {
    const d = new Date();
    date.min = new Date(
      d.getTime() - d.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);
  }

  const preset = new URLSearchParams(location.search).get("service");
  if (preset) {
    document.getElementById("service").value = preset;
  }

  form?.addEventListener("submit", submitBooking);
});

async function submitBooking(ev) {
  ev.preventDefault();

  const status = document.getElementById("bookingStatus");
  const get = id => document.getElementById(id).value.trim();

  const make = get("bike");
  const model = get("model");

  const booking = {
    customer_name: get("name"),
    phone: get("phone"),
    email: get("email") || null,

    // Supabase vereis die kolom "motorcycle"
    motorcycle: [make, model].filter(Boolean).join(" "),

    service: get("service"),
    preferred_date: get("date"),
    preferred_time: get("time") || null,
    location: get("location") || null,
    details: get("details"),
    status: "pending"
  };

  if (
    !booking.customer_name ||
    !booking.phone ||
    !booking.motorcycle ||
    !booking.service_type ||
    !booking.preferred_date ||
    !booking.details
  ) {
    return showStatus(
      status,
      "Please complete all required fields.",
      "error"
    );
  }

  try {
    const sb = await getSupabase();

    const { data: existing, error: checkError } = await sb
      .from("bookings")
      .select("id")
      .eq("phone", booking.phone)
      .eq("preferred_date", booking.preferred_date)
      .in("status", ["pending", "confirmed"])
      .limit(1);

    if (checkError) throw checkError;

    if (existing?.length) {
      return showStatus(
        status,
        "There is already an active booking request for this phone number on that date.",
        "error"
      );
    }

    const { error } = await sb
      .from("bookings")
      .insert(booking);

    if (error) throw error;

    showStatus(
      status,
      "Your request has been submitted. JACT will contact you to confirm the appointment."
    );

    document.getElementById("bookingForm").reset();

  } catch (e) {
    showStatus(status, e.message, "error");
  }
}
