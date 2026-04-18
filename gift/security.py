import frappe


def add_security_headers():
	"""Add HTTP security headers to every response.
	Registered via after_request hook in hooks.py.
	"""
	try:
		headers = frappe.local.response.headers
		headers["X-Content-Type-Options"] = "nosniff"
		headers["X-Frame-Options"] = "SAMEORIGIN"
		headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
		headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
		headers["X-XSS-Protection"] = "1; mode=block"
	except Exception:
		pass
