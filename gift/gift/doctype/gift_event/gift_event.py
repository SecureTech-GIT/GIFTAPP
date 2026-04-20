import frappe
from frappe import _
from frappe.model.document import Document

from gift.gift.event_permissions import get_user_event_names, has_event_access


class GiftEvent(Document):
    def before_validate(self):
        self.apply_creation_defaults()

        if self.is_new():
            self.ensure_creator_is_manager()

        if self.is_new():
            return

    def before_save(self):
        """Capture previous team state from DB before Frappe overwrites child tables"""
        if self.is_new():
            self._previous_managers = set()
            self._previous_coordinators = set()
            return

        self._previous_managers = set(
            frappe.db.get_all(
                "Event Team Member",
                filters={
                    "parenttype": "Gift Event",
                    "parent": self.name,
                    "parentfield": "event_managers",
                },
                pluck="user",
            )
        )
        self._previous_coordinators = set(
            frappe.db.get_all(
                "Event Team Member",
                filters={
                    "parenttype": "Gift Event",
                    "parent": self.name,
                    "parentfield": "event_coordinators",
                },
                pluck="user",
            )
        )

    def validate(self):
        self.apply_creation_defaults()
        self.validate_participants_not_blocked()
        self.apply_status_automation()
        self.calculate_team_stats()
        self.validate_team_requirements()
        self.update_category_counts()
        self.update_participant_counts()

    def apply_creation_defaults(self):
        if not getattr(self, "event_category", None):
            self.event_category = "Event"

        if not getattr(self, "event_type", None):
            self.event_type = "Public"

    def ensure_creator_is_manager(self):
        user = frappe.session.user
        if not user or user == "Guest":
            return

        roles = set(frappe.get_roles(user))
        if user not in {"Administrator"} and "System Manager" not in roles:
            if "Event Manager" not in roles:
                return

        existing = [tm.user for tm in (self.event_managers or []) if tm.user]
        if user in existing:
            return

        self.append("event_managers", {"user": user})

    def calculate_team_stats(self):
        managers = self.event_managers or []
        coordinators = self.event_coordinators or []

        self.manager_count = len(managers)
        self.coordinator_count = len(coordinators)
        self.total_team_count = self.manager_count + self.coordinator_count

    def validate_team_requirements(self):
        if self.status in ["Active"]:
            if (self.manager_count or 0) == 0:
                frappe.throw("Active events must have at least one Event Manager assigned")

    def update_category_counts(self):
        for cat in (self.event_categories or []):
            count = frappe.db.count(
                "Gift",
                {
                    "event": self.name,
                    "category": cat.category,
                    "status": ["in", ["Available", "Reserved"]],
                },
            )
            cat.available_count = count

    def validate_participants_not_blocked(self):
        if not self.event_participants:
            return

        for participant in self.event_participants:
            if not participant.gift_recipient:
                continue
            blocked = frappe.db.get_value("Gift Recipient", participant.gift_recipient, "blocked")
            if blocked:
                frappe.throw(_("Blocked recipients cannot be added to events"))

    def apply_status_automation(self):
        if self.status == "Draft":
            return

        if self.status == "Cancelled":
            return

        if not self.starts_on:
            return

        now = frappe.utils.now_datetime()
        starts = frappe.utils.get_datetime(self.starts_on)
        ends = frappe.utils.get_datetime(self.ends_on) if self.ends_on else None

        if ends and now > ends:
            self.status = "Completed"
            return

        if now >= starts and (not ends or now <= ends):
            self.status = "Active"
            return

        self.status = "Planned"

    def update_participant_counts(self):
        if not self.event_participants:
            return

        for participant in self.event_participants:
            if not participant.gift_recipient:
                continue

            interested_count = frappe.db.count(
                "Gift Interest",
                {"gift_recipient": participant.gift_recipient, "event": self.name},
            )
            participant.interested_gifts_count = interested_count

            issued_count = frappe.db.count(
                "Gift Issue",
                {"gift_recipient": participant.gift_recipient, "event": self.name},
            )
            participant.issued_gifts_count = issued_count

    # def on_update(self):
    #     self.sync_user_permissions()
    #     self.sync_team_roles()

    def sync_user_permissions(self):
        assigned_users = [tm.user for tm in (self.event_managers or []) if tm.user]
        assigned_users += [tm.user for tm in (self.event_coordinators or []) if tm.user]

        for user in assigned_users:
            if not frappe.db.exists(
                "User Permission",
                {"user": user, "allow": "Gift Event", "for_value": self.name},
            ):
                perm = frappe.new_doc("User Permission")
                perm.user = user
                perm.allow = "Gift Event"
                perm.for_value = self.name
                perm.apply_to_all_doctypes = 0
                perm.insert(ignore_permissions=True)

        existing_perms = frappe.get_all(
            "User Permission",
            filters={"allow": "Gift Event", "for_value": self.name},
            fields=["name", "user"],
        )

        for perm in existing_perms:
            if perm.user not in assigned_users and perm.user != "Administrator":
                frappe.delete_doc("User Permission", perm.name, ignore_permissions=True)

    def sync_team_roles(self):
        """
        Reconcile Event Manager / Event Coordinator roles.

        Uses _previous_managers/_previous_coordinators (captured in before_save
        from DB) combined with current in-memory state to ensure removed users
        are always included in reconciliation — even though DB already reflects
        the new state at on_update time.
        """
        current_managers = {tm.user for tm in (self.event_managers or []) if tm.user}
        current_coordinators = {tm.user for tm in (self.event_coordinators or []) if tm.user}

        previous_managers = getattr(self, "_previous_managers", set())
        previous_coordinators = getattr(self, "_previous_coordinators", set())

        # Union ensures removed users are always reconciled
        users_to_reconcile = (
            current_managers | current_coordinators |
            previous_managers | previous_coordinators
        )

        for user in users_to_reconcile:
            if user == "Administrator":
                continue
            self._reconcile_role_for_user(user, "Event Manager", "event_managers")
            self._reconcile_role_for_user(user, "Event Coordinator", "event_coordinators")

    def _reconcile_role_for_user(self, user, role, parentfield):
        """
        Ensure the Frappe role exists when user is assigned in any Gift Event.

        Roles are intentionally not auto-removed so manual/admin role grants
        remain stable even when event team assignments change.
        """
        if not frappe.db.exists("User", user):
            return

        still_assigned = frappe.db.exists(
            "Event Team Member",
            {
                "user": user,
                "parenttype": "Gift Event",
                "parentfield": parentfield,
            },
        )

        has_role = frappe.db.exists("Has Role", {"parent": user, "role": role})

        if still_assigned and not has_role:
            user_doc = frappe.get_doc("User", user)
            user_doc.append("roles", {"role": role})
            user_doc.save(ignore_permissions=True)
            frappe.msgprint(
                f"Role '{role}' assigned to {user}",
                indicator="green",
                alert=True,
            )

    @staticmethod
    def get_permission_query_conditions(user):
        roles = set(frappe.get_roles(user))
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return None

        if "Event Coordinator" not in roles:
            return "1=0"

        events = get_user_event_names(user)
        if not events:
            return "1=0"

        esc = "','".join([frappe.db.escape(e)[1:-1] for e in events])
        return f"(`tabGift Event`.name IN ('{esc}') AND IFNULL(`tabGift Event`.status, '') != 'Draft')"

    def has_permission(self, ptype=None, user=None):
        if not user:
            user = frappe.session.user

        roles = set(frappe.get_roles(user))
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return True

        if "Event Coordinator" not in roles:
            return False

        if ptype == "delete" and "Event Coordinator" in roles:
            return False

        if (
            "Event Coordinator" in roles
            and "Event Manager" not in roles
            and getattr(self, "status", None) == "Draft"
        ):
            return False

        return has_event_access(getattr(self, "name", None), user)

    def before_trash(self):
        """Unlink all related records before Frappe's link checking"""
        gifts = frappe.get_all("Gift", filters={"event": self.name}, pluck="name")
        for gift_name in gifts:
            try:
                frappe.db.set_value("Gift", gift_name, "event", None, update_modified=False)
            except Exception as e:
                frappe.log_error(f"Failed to unlink Gift {gift_name}: {str(e)}")

        recipients = frappe.get_all("Gift Recipient", filters={"event": self.name}, pluck="name")
        for recipient_name in recipients:
            try:
                frappe.db.set_value(
                    "Gift Recipient", recipient_name, "event", None, update_modified=False
                )
            except Exception as e:
                frappe.log_error(f"Failed to unlink Gift Recipient {recipient_name}: {str(e)}")

    def on_trash(self):
        """Reconcile roles for all team members, then cascade delete"""
        # Capture all users before deletion and reconcile roles
        all_users = set(
            frappe.db.get_all(
                "Event Team Member",
                filters={"parenttype": "Gift Event", "parent": self.name},
                pluck="user",
            )
        )
        for user in all_users:
            if user == "Administrator":
                continue
            # After this event is deleted, check if user still exists in other events
            self._reconcile_role_after_trash(user, "Event Manager", "event_managers")
            self._reconcile_role_after_trash(user, "Event Coordinator", "event_coordinators")

        # Clean up gift event history records that link to this event
        try:
            # Clear from_event links in gift history
            history_records = frappe.db.get_all("Gift Event History", 
                filters={"from_event": self.name}, 
                pluck="name")
            for record_name in history_records:
                frappe.db.set_value("Gift Event History", record_name, "from_event", None)
                frappe.logger().info(f"Cleared from_event link for history record {record_name}")
            
            # Clear to_event links in gift history  
            history_records = frappe.db.get_all("Gift Event History", 
                filters={"to_event": self.name}, 
                pluck="name")
            for record_name in history_records:
                frappe.db.set_value("Gift Event History", record_name, "to_event", None)
                frappe.logger().info(f"Cleared to_event link for history record {record_name}")
                
        except Exception as e:
            frappe.log_error(f"Failed to clean up gift event history: {str(e)}")

        # Clear event field from gifts that are still assigned to this event
        try:
            gifts = frappe.db.get_all("Gift", filters={"event": self.name}, pluck="name")
            for gift_name in gifts:
                frappe.db.set_value("Gift", gift_name, "event", None)
                frappe.db.set_value("Gift", gift_name, "event_name", None)
                frappe.logger().info(f"Cleared event assignment for gift {gift_name}")
        except Exception as e:
            frappe.log_error(f"Failed to clear event from gifts: {str(e)}")

        # Delete all Gift Issues
        issues = frappe.get_all("Gift Issue", filters={"event": self.name}, pluck="name")
        for issue_name in issues:
            try:
                frappe.delete_doc("Gift Issue", issue_name, ignore_permissions=True, force=True)
            except Exception as e:
                frappe.log_error(f"Failed to delete Gift Issue {issue_name}: {str(e)}")

        # Delete all Gift Interests
        interests = frappe.get_all("Gift Interest", filters={"event": self.name}, pluck="name")
        for interest_name in interests:
            try:
                frappe.delete_doc("Gift Interest", interest_name, ignore_permissions=True, force=True)
            except Exception as e:
                frappe.log_error(f"Failed to delete Gift Interest {interest_name}: {str(e)}")

        # Delete user permissions
        try:
            perms = frappe.get_all(
                "User Permission",
                filters={"allow": "Gift Event", "for_value": self.name},
                pluck="name",
            )
            for perm_name in perms:
                frappe.delete_doc(
                    "User Permission", perm_name, ignore_permissions=True, force=True
                )
        except Exception as e:
            frappe.log_error(f"Failed to delete user permissions: {str(e)}")

    def _reconcile_role_after_trash(self, user, role, parentfield):
        """
        Like _reconcile_role_for_user but excludes the current event
        since it's mid-deletion (child rows still exist in DB at on_trash time).

        Roles are not auto-removed here to preserve explicit/manual role grants.
        """
        if not frappe.db.exists("User", user):
            return

        still_assigned = frappe.db.exists(
            "Event Team Member",
            {
                "user": user,
                "parenttype": "Gift Event",
                "parentfield": parentfield,
                "parent": ["!=", self.name],  # exclude current event being deleted
            },
        )

        has_role = frappe.db.exists("Has Role", {"parent": user, "role": role})

        if still_assigned and not has_role:
            user_doc = frappe.get_doc("User", user)
            user_doc.append("roles", {"role": role})
            user_doc.save(ignore_permissions=True)
            frappe.msgprint(
                f"Role '{role}' assigned to {user}",
                indicator="green",
                alert=True,
            )


@frappe.whitelist(allow_guest=False)
def get_participant_gifts(gift_recipient, event):
    """Get all gifts (interested + issued) for a participant in an event"""

    interests = frappe.get_all(
        "Gift Interest",
        filters={"gift_recipient": gift_recipient, "event": event},
        fields=["name", "gift", "gift_name", "category", "interest_level", "follow_up_status"],
    )

    issues = frappe.get_all(
        "Gift Issue",
        filters={"gift_recipient": gift_recipient, "event": event},
        fields=["name", "gift", "gift_name", "category", "status", "date"],
    )

    return {
        "interests": interests,
        "issues": issues,
        "total_interested": len(interests),
        "total_issued": len(issues),
    }
