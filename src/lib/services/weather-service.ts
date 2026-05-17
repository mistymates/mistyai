import axios from "axios";

export const weatherService = {
  async getLocation() {
    try {
      const res = await axios.get("https://ipapi.co/json/", { timeout: 2500 });
      return {
        city: res.data.city || "Unknown",
        lat: Number(res.data.latitude),
        lon: Number(res.data.longitude),
      };
    } catch {
      // Fast fallback so dashboard widgets render even when geolocation endpoints are slow/blocked.
      return {
        city: "Jakarta",
        lat: -6.2,
        lon: 106.816666,
      };
    }
  },
  async getWeather(lat: number, lon: number) {
    const res = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
      { timeout: 2500 },
    );
    return res.data.current_weather;
  },
};
