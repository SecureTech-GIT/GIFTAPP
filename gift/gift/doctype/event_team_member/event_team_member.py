# Copyright (c) 2026, ABM Tech and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from gift.gift.event_permissions import get_user_event_names, has_event_access


class EventTeamMember(Document):
	def validate(self):
		parent_status = None
		if self.parenttype == "Gift Event" and self.parent:
			parent_status = frappe.db.get_value("Gift Event", self.parent, "status")

		if self.parenttype == "Gift Event" and self.parent and getattr(self, "parentfield", None):
			if self.parentfield == "event_managers":
				self.team_role = "Event Manager"
			elif self.parentfield == "event_coordinators":
				self.team_role = "Event Coordinator"

		# Check for duplicates
		if self.parenttype == "Gift Event" and self.parent:
			duplicate = frappe.db.sql(
				"""
				SELECT name FROM `tabEvent Team Member`
				WHERE parent = %s
				AND user = %s
				AND parentfield = %s
				AND name != %s
				AND parenttype = 'Gift Event'
			""",
				(self.parent, self.user, getattr(self, "parentfield", ""), self.name or ""),
			)

			if duplicate:
				frappe.throw(
					f"User {self.user} is already assigned to event {self.parent}"
				)

		if self.team_role == "Event Manager":
			self.can_approve = 1

	def on_update(self):
		return

	def assign_role_to_user(self):
		"""Assign the appropriate role to the user based on their team role"""
		if not self.user or not self.team_role:
			return

		if not frappe.db.exists("User", self.user):
			return

		# Determine which role to assign
		role_to_assign = None
		if self.team_role == "Event Manager":
			role_to_assign = "Event Manager"
		elif self.team_role == "Event Coordinator":
			role_to_assign = "Event Coordinator"

		if not role_to_assign:
			return

		# Check if user already has the role
		user_roles = set(frappe.get_roles(self.user))
		if role_to_assign in user_roles:
			return

		# Assign the role
		try:
			user_doc = frappe.get_doc("User", self.user)
			user_doc.append("roles", {"doctype": "Has Role", "role": role_to_assign})
			user_doc.save(ignore_permissions=True)
			frappe.logger().info(f"Assigned role '{role_to_assign}' to user '{self.user}'")
		except Exception as e:
			frappe.log_error(frappe.get_traceback(), f"Failed to assign role to user {self.user}")
			# Don't throw error - role assignment is supplementary

	@staticmethod
	def get_permission_query_conditions(user):
		roles = set(frappe.get_roles(user))
		if user in {"Administrator"} or "System Manager" in roles:
			return None

		events = get_user_event_names(user)
		if not events:
			return "1=0"

		esc = "','".join([frappe.db.escape(e)[1:-1] for e in events])
		return f"(`tabEvent Team Member`.parent IN ('{esc}') AND `tabEvent Team Member`.parenttype = 'Gift Event')"

	def has_permission(self, ptype=None, user=None):
		if not user:
			user = frappe.session.user

		roles = set(frappe.get_roles(user))
		if user in {"Administrator"} or "System Manager" in roles:
			return True

		# Access is governed by access to the parent Gift Event
		return has_event_access(getattr(self, "parent", None), user)
