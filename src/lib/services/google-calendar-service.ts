import axios from "axios";

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink: string;
}

export const INDONESIA_HOLIDAYS_CALENDAR_ID = "id.indonesian#holiday@group.v.calendar.google.com";

type GoogleCalendarRange = {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
};

export const googleCalendarService = {
  async getEvents(token: string, range: GoogleCalendarRange = {}): Promise<GoogleCalendarEvent[]> {
    const {
      calendarId = "primary",
      timeMin = new Date().toISOString(),
      timeMax,
      maxResults = 250,
    } = range;

    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          timeMin,
          ...(timeMax ? { timeMax } : {}),
          maxResults,
          singleEvents: true,
          orderBy: "startTime",
        },
      },
    );
    return response.data.items || [];
  },

  async getIndonesiaHolidays(
    token: string,
    range: Omit<GoogleCalendarRange, "calendarId"> = {},
  ): Promise<GoogleCalendarEvent[]> {
    return this.getEvents(token, {
      ...range,
      calendarId: INDONESIA_HOLIDAYS_CALENDAR_ID,
    });
  },
};
