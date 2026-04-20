import frappe
from frappe.model.document import Document


class GiftEventHistory(Document):
	@staticmethod
	def get_permission_query_conditions(user):
		roles = set(frappe.get_roles(user))
		if user in {"Administrator"} or "System Manager" in roles:
			return None

		# Child tables inherit permission from parent; restrict queries when accessed directly
		return "1=0"

	def has_permission(self, ptype=None, user=None):
		if not user:
			user = frappe.session.user

		roles = set(frappe.get_roles(user))
		if user in {"Administrator"} or "System Manager" in roles:
			return True

		# Child tables inherit permission from parent; disallow direct access
		return False
