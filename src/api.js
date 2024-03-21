const BASE_URL = "https://prenotami.esteri.it";
const DEFAULT_HEADERS = {
    "sec-ch-ua":
        '"Google Chrome";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "upgrade-insecure-requests": "1",
};

function getNextMonth(currentDate) {
    const currentMonth = currentDate.getMonth();

    if (currentMonth == 11) {
        return new Date(currentDate.getFullYear() + 1, 0, 1);
    }

    return new Date(currentDate.getFullYear(), currentMonth + 1, 1);
}

async function pause(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function startBooking(service) {
    let tries = window.START_BOOKING_RETRY;

    for (let i = 0; i < tries; i++) {
        const fd = new window.FormData();

        fd.append("IDServizioErogato", service);
        fd.append("PrivacyCheck", true);
        fd.append("PrivacyCheck", false);

        const resp = await window.fetch(
            `${BASE_URL}/Services/Booking/${service}`,
            {
                headers: {
                    ...DEFAULT_HEADERS,
                },
                body: fd,
                method: "POST",
                redirect: "follow",
                mode: "cors",
                credentials: "include",
            }
        );

        if (resp.ok) {
            if (resp.url === "https://prenotami.esteri.it/Services") {
                await pause(window.WAIT_PER_BOOK_RETRY);
            } else {
                return;
            }
        } else {
            throw Error("Start Booking error");
        }
    }

    throw Error("Sin turnos");
}

async function getServerInfo() {
    const resp = await window.fetch(
        `${BASE_URL}/BookingCalendar/RetrieveServerInfo`,
        {
            headers: {
                ...DEFAULT_HEADERS,
            },
            referrerPolicy: "strict-origin-when-cross-origin",
            body: null,
            method: "POST",
            mode: "cors",
            credentials: "include",
        }
    );

    if (resp.ok) {
        return resp.text();
    }

    throw Error("Server Info error");
}

async function getCalendarAvailability(service, date) {
    const resp = await window.fetch(
        `${BASE_URL}/BookingCalendar/RetrieveCalendarAvailability`,
        {
            headers: {
                ...DEFAULT_HEADERS,
                "content-type": "application/json; charset=UTF-8",
            },
            referrerPolicy: "strict-origin-when-cross-origin",
            body: JSON.stringify({
                _Servizio: service,
                selectedDay: date,
            }),
            method: "POST",
            mode: "cors",
            credentials: "include",
        }
    );

    if (resp.ok) {
        const text = await resp.text();
        return JSON.parse(JSON.parse(text));
    }

    throw Error("Calendar error");
}

async function getTimeSlot(service, dateTime) {
    const [date, time] = dateTime.split(" ");
    const [day, month, year] = date.split("/");

    const selectedDay = `${year}-${month}-${day}`;

    const resp = await window.fetch(
        `${BASE_URL}/BookingCalendar/RetrieveTimeSlots`,
        {
            headers: {
                ...DEFAULT_HEADERS,
                "content-type": "application/json; charset=UTF-8",
            },
            body: JSON.stringify({
                idService: service,
                selectedDay,
            }),
            method: "POST",
            mode: "cors",
            credentials: "include",
        }
    );

    if (resp.ok) {
        const text = await resp.text();
        return JSON.parse(JSON.parse(text));
    }

    throw Error("Time slot error");
}

async function generateOTP() {
    const resp = await fetch(`${BASE_URL}/BookingCalendar/GenerateOTP`, {
        headers: DEFAULT_HEADERS,
        method: "GET",
        mode: "cors",
        credentials: "include",
    });

    if (resp.ok) {
        return resp.json();
    }

    throw Error("OTP generation error");
}

async function book(timeSlot, otp) {
    const idCal = timeSlot.IDCalendarioServizioGiornaliero;
    const [day, month, year] = timeSlot.Data.split(" ")[0].split("/");
    const from = `${timeSlot.OrarioInizioFascia.Hours}:${timeSlot.OrarioInizioFascia.Minutes}`;
    const to = `${timeSlot.OrarioFineFascia.Hours}:${timeSlot.OrarioFineFascia.Minutes}`;

    const body = new FormData();
    body.append("idCalendarioGiornaliero", idCal);
    body.append("selectedDay", `${year}-${month}-${day}`);
    body.append("selectedHour", `${from}+-+${to}\n(1)`);
    body.append("code", otp);

    const resp = await fetch(`${BASE_URL}/BookingCalendar/InsertNewBooking`, {
        headers: DEFAULT_HEADERS,
        body: body,
        method: "POST",
        mode: "cors",
        credentials: "include",
    });

    if (resp.ok) {
        return "reservado";
    }

    throw Error("book error");
}

async function getFreeSlot(service) {
    let freeSlot;
    let today = new Date();

    for (let i = 0; !freeSlot && i < window.MONTHS_TO_SCRAPE; i++) {
        let tries = window.RETRY_PER_MONTH;

        while (!freeSlot && tries > 0) {
            let slots = [];

            try {
                slots = await getCalendarAvailability(service, today);
            } catch (e) {
                throw e;
            }

            freeSlot = slots.find((slot) => {
                return slot.SlotLiberi > 0;
            });

            tries -= 1;

            if (!freeSlot && tries > 0) {
                await pause(window.WAIT_PER_RETRY);
            }
        }

        today = getNextMonth(today);
    }

    if (freeSlot) {
        return getTimeSlot(service, freeSlot.DateLibere);
    }

    return null;
}
