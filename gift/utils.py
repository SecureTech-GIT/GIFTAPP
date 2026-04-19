import frappe


def before_request():
    req = getattr(frappe.local, "request", None)
    if not req:
        return

    path = getattr(req, "path", "") or "/"
    method = getattr(req, "method", "GET")

    if path == "/" and method in {"GET", "HEAD"}:
        frappe.local.response["type"] = "redirect"
        frappe.local.response["location"] = "/gift"
        frappe.local.response["http_status_code"] = 302
