// Where the payment company sends people / answers back to
const FRONTEND_URL = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const BACKEND_URL = () => (process.env.BACKEND_PUBLIC_URL || "http://localhost:3002").replace(/\/$/, "");

module.exports = { FRONTEND_URL, BACKEND_URL };
