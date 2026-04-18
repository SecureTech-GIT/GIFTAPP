import frappe
from frappe import _


def _get_enabled_users(users: set[str]) -> list[str]:
	return [
		u
		for u in sorted(users)
		if u and u != "Guest" and frappe.db.get_value("User", u, "enabled")
	]


def _get_users_with_role(role: str) -> set[str]:
	return set(
		frappe.get_all(
			"Has Role",
			filters={"role": role},
			pluck="parent",
		)
		or []
	)


def _get_coordinator_users(gift_issue: str) -> list[str]:
	"""Return coordinators for a gift issue.
	
	Policy:
	- Always include Administrator and System Managers.
	- Include the user who created the gift issue (requester).
	- Include Event Coordinators assigned to the event via Event Team Member.
	"""
	recipients: set[str] = {"Administrator"}
	
	# System Managers (global)
	recipients |= _get_users_with_role("System Manager")
	
	# Get the gift issue to find the requester and event
	gift_issue_doc = frappe.get_doc("Gift Issue", gift_issue)
	
	# Add the requester (user who created the gift issue)
	if gift_issue_doc.owner and gift_issue_doc.owner != "Guest":
		recipients.add(gift_issue_doc.owner)
	
	# Get event coordinators if event is assigned
	event = getattr(gift_issue_doc, "event", None)
	if event:
		team_users = set(
			frappe.get_all(
				"Event Team Member",
				filters={"parent": event, "parenttype": "Gift Event"},
				pluck="user",
			)
			or []
		)
		
		# Only those team members that are actually Event Coordinators
		event_coordinators = _get_users_with_role("Event Coordinator")
		recipients |= (team_users & event_coordinators)
	
	return _get_enabled_users(recipients)


def _get_event_manager_users(event: str | None) -> list[str]:
	"""Return recipients for an event.

	Policy:
	- Always include Administrator and System Managers.
	- Include only Event Managers assigned to the event via Event Team Member.
	"""
	recipients: set[str] = {"Administrator"}

	# System Managers (global)
	recipients |= _get_users_with_role("System Manager")

	if not event:
		return _get_enabled_users(recipients)

	team_users = set(
		frappe.get_all(
			"Event Team Member",
			filters={"parent": event, "parenttype": "Gift Event"},
			pluck="user",
		)
		or []
	)

	if not team_users:
		return _get_enabled_users(recipients)

	# Only those team members that are actually Event Managers
	event_managers = _get_users_with_role("Event Manager")
	recipients |= (team_users & event_managers)

	# Remove duplicates by converting to set and back to list
	return _get_enabled_users(recipients)


def _create_notification_logs(
	*,
	document_type: str,
	document_name: str,
	subject: str,
	email_content: str | None = None,
	notification_type: str = "Alert",
	for_users: list[str],
) -> None:
	for user in for_users:
		if not user or user == "Guest":
			continue

		# Check if notification already exists for this user and document
		existing = frappe.db.exists(
			"Notification Log",
			{
				"for_user": user,
				"document_type": document_type,
				"document_name": document_name,
				"subject": subject,
				"read": 0,  # Only check unread notifications
			}
		)
		
		if existing:
			continue  # Skip creating duplicate notification

		try:
			log = frappe.new_doc("Notification Log")
			log.subject = subject
			log.email_content = email_content or subject
			log.for_user = user
			log.type = notification_type
			log.document_type = document_type
			log.document_name = document_name
			log.insert(ignore_permissions=True)
		except Exception:
			frappe.log_error(
				frappe.get_traceback(),
				"Failed to create Notification Log",
			)


def gift_after_insert(doc, method=None):	# method is provided by Frappe
	display_name = getattr(doc, "gift_name", None) or getattr(doc, "name", None) or ""
	subject = _("New gift added: {0}").format(display_name)
	_create_notification_logs(
		document_type="Gift",
		document_name=doc.name,
		subject=subject,
		notification_type="Alert",
		for_users=_get_event_manager_users(getattr(doc, "event", None)),
	)


def gift_issue_after_insert(doc, method=None):  # method is provided by Frappe
    approval_status = getattr(doc, "approval_status", None)
    if approval_status != "Awaiting Approval":
        return

    gift_name = getattr(doc, "gift", None)
    if not gift_name:
        return

    # Get the actual gift name for better notification
    gift_display_name = frappe.db.get_value("Gift", gift_name, "gift_name") or gift_name
    
    subject = _("Approval requested for gift: {0}").format(gift_display_name)
    _create_notification_logs(
        document_type="Gift",
        document_name=gift_name,
        subject=subject,
        notification_type="Alert",
        for_users=_get_event_manager_users(getattr(doc, "event", None)),
    )


def gift_issue_on_update(doc, method=None):	# method is provided by Frappe
	gift_name = getattr(doc, "gift", None)
	if not gift_name:
		return

	# Delivered
	if getattr(doc, "has_value_changed", None) and doc.has_value_changed("status"):
		if getattr(doc, "status", None) == "Delivered":
			# Get the actual gift name for better notification
			gift_display_name = frappe.db.get_value("Gift", gift_name, "gift_name") or gift_name
			
			subject = _("Gift delivered: {0}").format(gift_display_name)
			_create_notification_logs(
				document_type="Gift",
				document_name=gift_name,
				subject=subject,
				notification_type="Alert",
				for_users=_get_event_manager_users(getattr(doc, "event", None)),
			)

	# Approval requested again
	if getattr(doc, "has_value_changed", None) and doc.has_value_changed("approval_status"):
		approval_status = getattr(doc, "approval_status", None)
		gift_display_name = frappe.db.get_value("Gift", gift_name, "gift_name") or gift_name
		guest_id = getattr(doc, "gift_recipient", None)
		
		# Get the actual guest name for better notification
		guest_name = "Unknown Guest"
		if guest_id:
			recipient = frappe.db.get_value(
				"Gift Recipient",
				guest_id,
				["owner_full_name", "guest_first_name", "guest_last_name"],
				as_dict=True,
			)
			if recipient:
				guest_name = (
					recipient.get("owner_full_name")
					or f"{(recipient.get('guest_first_name') or '').strip()} {(recipient.get('guest_last_name') or '').strip()}".strip()
					or guest_id
				)
			else:
				guest_name = guest_id
		
		if approval_status == "Awaiting Approval":
			subject = _("Approval requested for gift: {0}").format(gift_display_name)
			_create_notification_logs(
				document_type="Gift",
				document_name=gift_name,
				subject=subject,
				notification_type="Alert",
				for_users=_get_event_manager_users(getattr(doc, "event", None)),
			)
		
		elif approval_status == "Approved":
			# Notify coordinators that approval was accepted
			subject = _("Allocation accepted: Gift {0} allocated to {1}").format(gift_display_name, guest_name)
			_create_notification_logs(
				document_type="Gift Issue",
				document_name=doc.name,
				subject=subject,
				notification_type="Alert",
				for_users=_get_coordinator_users(doc.name),
			)
		
		elif approval_status == "Rejected":
			# Notify coordinators that approval was rejected
			subject = _("Allocation rejected: Gift {0} request for {1}").format(gift_display_name, guest_name)
			_create_notification_logs(
				document_type="Gift Issue",
				document_name=doc.name,
				subject=subject,
				notification_type="Alert",
				for_users=_get_coordinator_users(doc.name),
			)
