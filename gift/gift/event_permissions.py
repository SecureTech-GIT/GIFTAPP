import frappe


def get_user_event_names(user: str) -> list[str]:
	rows = frappe.db.sql(
		"""
		SELECT DISTINCT parent
		FROM `tabEvent Team Member`
		WHERE user = %s AND parenttype = 'Gift Event'
		""",
		(user,),
		as_dict=True,
	)
	return [r.parent for r in rows] if rows else []


def get_user_visible_event_names(user: str | None = None) -> list[str]:
	if not user:
		user = frappe.session.user

	roles = set(frappe.get_roles(user))
	if (
		user not in {"Administrator"}
		and "System Manager" not in roles
		and "Event Manager" not in roles
		and "Event Coordinator" not in roles
	):
		return []

	events = get_user_event_names(user)
	if not events:
		return []

	# Coordinators should not see draft events unless they also have manager/admin visibility.
	if (
		"Event Coordinator" in roles
		and "Event Manager" not in roles
		and "System Manager" not in roles
		and user not in {"Administrator"}
	):
		return frappe.get_all(
			"Gift Event",
			filters={
				"name": ["in", events],
				"status": ["!=", "Draft"],
			},
			pluck="name",
		)

	return events


def has_event_access(event_name: str, user: str | None = None) -> bool:
	if not user:
		user = frappe.session.user
	if not event_name:
		# Coordinators cannot access records with no event
		roles = set(frappe.get_roles(user))
		if "Event Coordinator" in roles and "Event Manager" not in roles and user not in {"Administrator"} and "System Manager" not in roles:
			return False
		return True

	roles = set(frappe.get_roles(user))
	if user in {"Administrator"} or "System Manager" in roles:
		return True

	# Event Manager has global access to all events
	if "Event Manager" in roles:
		return True

	if "Event Coordinator" not in roles:
		return False

	is_assigned = bool(
		frappe.db.exists(
			"Event Team Member",
			{"parent": event_name, "parenttype": "Gift Event", "user": user},
		)
	)
	if not is_assigned:
		return False

	# Coordinators must not access draft events unless they also have manager/admin visibility.
	if "Event Coordinator" in roles and "Event Manager" not in roles:
		status = frappe.db.get_value("Gift Event", event_name, "status")
		if status == "Draft":
			return False

	return True


def build_event_permission_query(doctype: str, user: str) -> str | None:
	roles = set(frappe.get_roles(user))
	if user in {"Administrator"} or "System Manager" in roles:
		return None

	# Event Manager has global visibility
	if "Event Manager" in roles:
		return None

	if "Event Coordinator" not in roles:
		return f"(`tab{doctype}`.event IS NULL OR `tab{doctype}`.event = '')"

	# Coordinators: only see gifts from assigned NON-DRAFT events (no unassigned gifts)
	visible_events = get_user_visible_event_names(user)
	if not visible_events:
		# No visible (non-draft) events assigned - return empty result
		return f"(1=0)"  # False condition - no records

	esc = "','".join([frappe.db.escape(e)[1:-1] for e in visible_events])
	# Only assigned events (no OR for unassigned records)
	return f"(`tab{doctype}`.event IN ('{esc}'))"


def can_user_approve(event_name: str, user: str | None = None) -> bool:
    if not user:
        user = frappe.session.user

    roles = set(frappe.get_roles(user))

    if (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Admin" in roles
    ):
        return True

    if not event_name:
        return "Event Manager" in roles

    if "Event Manager" not in roles:
        return False

    # ✅ Only users in event_managers parentfield can approve
    return bool(
        frappe.db.exists(
            "Event Team Member",
            {
                "parent": event_name,
                "parenttype": "Gift Event",
                "parentfield": "event_managers",  # ← not event_coordinators
                "user": user,
            },
        )
    )

def get_user_default_event(user: str | None = None) -> str | None:
	"""Get the default event for a user (first assigned event)"""
	if not user:
		user = frappe.session.user

	roles = set(frappe.get_roles(user))
	if user in {"Administrator"} or "System Manager" in roles:
		return None  # Admins don't have a default event

	events = get_user_event_names(user)
	return events[0] if events else None


def auto_assign_event_to_record(doc, user: str | None = None) -> None:
	"""Auto-assign event to a record if user is a coordinator with only one event"""
	if not user:
		user = frappe.session.user

	# Skip if event is already set
	if getattr(doc, "event", None):
		return

	roles = set(frappe.get_roles(user))
	# Skip for System Managers, Administrators, and Event Managers
	if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
		return

	# Get user's assigned events
	events = get_user_event_names(user)

	# Filter out draft events - only consider active/published events
	active_events = []
	for event_name in events:
		event_status = frappe.db.get_value("Gift Event", event_name, "status")
		if event_status and event_status.lower() != "draft":
			active_events.append(event_name)

	# DISABLED: No longer auto-assign events even if user has exactly one active event
	# Users must manually select events to prevent unwanted auto-assignment
	if len(active_events) == 1:
		# User has one active event, but don't auto-assign - let them choose manually
		frappe.msgprint(
			frappe._("Please select an event. Manual selection is required for all records."),
			indicator="orange",
			alert=True
		)
	elif len(active_events) > 1:
		# User has multiple active events, they need to choose
		frappe.msgprint(
			frappe._("Please select an event. You are assigned to multiple active events."),
			indicator="orange",
			alert=True
		)
	elif len(events) > 1 and len(active_events) == 0:
		# User has multiple events but all are draft
		frappe.msgprint(
			frappe._("Please select an event. All assigned events are currently in draft status."),
			indicator="orange",
			alert=True
		)
	elif len(events) == 0:
		# User has no events assigned. Allow records to be created without event linkage.
		return


# ---------------------------------------------------------------------------
# Standalone functions registered in hooks.py permission_query_conditions.
# Frappe desk calls these to build WHERE clauses for list views.
# ---------------------------------------------------------------------------

def _perm_query(doctype, user):
	"""Return SQL WHERE clause fragment for coordinator-level visibility.
	Must never return None — None means 'no restriction' to Frappe hooks.
	Return empty string for admins/managers (Frappe skips empty conditions).
	"""
	roles = set(frappe.get_roles(user))
	# Global access — return empty string so Frappe adds no restriction
	if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
		return ""

	if "Event Coordinator" not in roles:
		# Non-privileged user — no records
		return "(1=0)"

	visible_events = get_user_visible_event_names(user)
	if not visible_events:
		return "(1=0)"

	esc = "','".join([frappe.db.escape(e)[1:-1] for e in visible_events])
	return f"(`tab{doctype}`.event IN ('{esc}'))"


def perm_query_gift(user):
	return _perm_query("Gift", user)

def perm_query_gift_issue(user):
	return _perm_query("Gift Issue", user)

def perm_query_gift_interest(user):
	return _perm_query("Gift Interest", user)

def perm_query_gift_recipient(user):
	return _perm_query("Gift Recipient", user)

def perm_query_gift_dispatch(user):
	return _perm_query("Gift Dispatch", user)


def perm_query_gift_event(user):
	"""Permission query for Gift Event list view.
	Filters on `name` (the event itself) rather than an `event` field.
	"""
	roles = set(frappe.get_roles(user))
	if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
		return ""

	if "Event Coordinator" not in roles:
		return "(1=0)"

	visible_events = get_user_visible_event_names(user)
	if not visible_events:
		return "(1=0)"

	esc = "','".join([frappe.db.escape(e)[1:-1] for e in visible_events])
	return f"(`tabGift Event`.name IN ('{esc}'))"
