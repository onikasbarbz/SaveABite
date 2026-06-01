const jwt = require("jsonwebtoken");

/**
 * Verifies the JWT from the Authorization header and attaches `req.user`.
 * Usage: router.get("/protected", authMiddleware, handler)
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const token = header.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not configured");

    const decoded = jwt.verify(token, secret);

    // Attach user info extracted from token to the request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again.",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }
}

/**
 * Role-based access guard. Must be used AFTER authMiddleware.
 * Usage: router.post("/admin-only", authMiddleware, requireRole("admin"), handler)
 *
 * @param  {...string} roles  Allowed roles (e.g. "business", "admin", "ngo")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Normalise to lowercase for comparison
    const userRole = (req.user.role || "").toLowerCase();
    const allowed = roles.map((r) => r.toLowerCase());

    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }

    next();
  };
}

module.exports = { authMiddleware, requireRole };
