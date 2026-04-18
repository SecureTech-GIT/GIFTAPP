import frappe
from frappe.utils.oauth import get_oauth2_authorize_url

@frappe.whitelist(allow_guest=True)
def microsoft_login():
    url = get_oauth2_authorize_url("office_365", "/gift")
    frappe.local.response["type"] = "redirect"
    frappe.local.response["location"] = url