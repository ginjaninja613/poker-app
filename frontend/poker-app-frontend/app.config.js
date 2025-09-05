export default {
  expo: {
    name: "Poker App",
    slug: "poker-app",
    scheme: "pokerapp",
    extra: {
      // Change this once you deploy the backend (Render/Railway/etc).
      apiBase: process.env.EXPO_PUBLIC_API_BASE || "http://192.168.0.178:5000",
    },
  },
};
