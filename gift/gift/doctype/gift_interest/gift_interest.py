import frappe
from frappe import _
from frappe.model.document import Document

from gift.gift.event_permissions import (
	build_event_permission_query,
	can_user_approve,
	has_event_access,
	auto_assign_event_to_record,
)


class GiftInterest(Document):
    def validate(self):
        # Auto-assign event for coordinators if not set
        if self.is_new():
            auto_assign_event_to_record(self)
        
        self.validate_recipient_not_blocked()
        self.validate_no_duplicate_active_interest()
        self.validate_event_scope()
        self.validate_approval_workflow()
        self.validate_conversion_reference()

    def validate_no_duplicate_active_interest(self):
        if not getattr(self, "gift", None) or not getattr(self, "gift_recipient", None):
            return

        filters = {
            "gift": self.gift,
            "gift_recipient": self.gift_recipient,
            "name": ["!=", self.name],
            "approval_status": ["in", ["Pending", "Approved"]],
            "follow_up_status": ["!=", "Closed"],
        }

        try:
            interest_cols = set(frappe.db.get_table_columns("tabGift Interest") or [])
        except Exception:
            interest_cols = set()
        if "is_deleted" in interest_cols:
            filters["is_deleted"] = 0

        duplicate = frappe.get_all(
            "Gift Interest",
            filters=filters,
            fields=["name"],
            page_length=1,
        )

        if duplicate:
            frappe.throw(
                _("Interest already exists for this guest on this gift: {0}").format(
                    duplicate[0].get("name")
                )
            )

    def validate_event_scope(self):
        if not getattr(self, "event", None) and getattr(self, "gift_recipient", None):
            self.event = frappe.db.get_value("Gift Recipient", self.gift_recipient, "event")

        # Always prioritize gift's event over recipient's event to maintain consistency
        if getattr(self, "gift", None):
            gift_event = frappe.db.get_value("Gift", self.gift, "event")
            if gift_event:
                # Update interest's event to match gift's event if different
                if not self.event or self.event != gift_event:
                    self.event = gift_event

        if not getattr(self, "event", None):
            return

        if not has_event_access(self.event, frappe.session.user):
            frappe.throw(f"You don't have access to event {self.event}")

        # Final validation - gift should belong to the same event
        if getattr(self, "gift", None):
            gift_event = frappe.db.get_value("Gift", self.gift, "event")
            if gift_event and gift_event != self.event:
                frappe.throw(f"Gift {self.gift} belongs to different event")

    @staticmethod
    def get_permission_query_conditions(user):
        # Event Manager has global visibility
        roles = frappe.get_roles(user)
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return None
        
        return build_event_permission_query("Gift Interest", user)

    def has_permission(self, ptype=None, user=None):
        if not user:
            user = frappe.session.user

        roles = frappe.get_roles(user)
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return True

        if ptype == "delete" and "Event Coordinator" in roles:
            return False

        return has_event_access(getattr(self, "event", None), user)

    @frappe.whitelist(allow_guest=False)
    def approve_interest(self):
        event = getattr(self, "event", None)
        if not event and getattr(self, "gift", None):
            event = frappe.db.get_value("Gift", self.gift, "event")
        if not event and getattr(self, "gift_recipient", None):
            event = frappe.db.get_value("Gift Recipient", self.gift_recipient, "event")
        if event and not getattr(self, "event", None):
            self.event = event

        if not can_user_approve(event, frappe.session.user):
            frappe.throw("Only Event Managers can approve interests")

        self.approval_status = "Approved"
        self.approved_by = frappe.session.user
        self.approved_on = frappe.utils.now()
        self.save()

        # Create issue - will be auto-approved since Event Manager is creating it
        issue = frappe.new_doc("Gift Issue")
        issue.gift = self.gift
        issue.gift_recipient = self.gift_recipient
        issue.event = self.event
        issue.from_gift_interest = self.name
        issue.status = "Pending"
        issue.date = frappe.utils.today()
        issue.delivery_method = "Direct Handover"
        # approval_status will be set automatically based on user role in validate
        issue.insert(ignore_permissions=True)

        return issue.name

    def validate_recipient_not_blocked(self):
        if not self.gift_recipient:
            return

        blocked = frappe.db.get_value('Gift Recipient', self.gift_recipient, 'blocked')
        if blocked:
            frappe.throw(_("This recipient is blocked and cannot register interest"))

    def validate_approval_workflow(self):
        # Use can_user_approve for consistent approval permission check
        if not self.has_value_changed('approval_status'):
            return

        if self.approval_status in ['Approved', 'Rejected']:
            event = getattr(self, "event", None)
            if not event and getattr(self, "gift", None):
                event = frappe.db.get_value("Gift", self.gift, "event")
            if not event and getattr(self, "gift_recipient", None):
                event = frappe.db.get_value("Gift Recipient", self.gift_recipient, "event")
            if event and not getattr(self, "event", None):
                self.event = event
            
            # Check if user can approve (event-scoped when event exists; role-scoped when absent)
            if not can_user_approve(event, frappe.session.user):
                frappe.throw(_("You are not allowed to approve/reject interests for this event"))

            self.approved_by = frappe.session.user
            self.approved_on = frappe.utils.now()

        if self.approval_status == 'Pending':
            self.approved_by = None
            self.approved_on = None

    def validate_conversion_reference(self):
        if self.follow_up_status == "Converted to Issue" and not self.converted_to_issue:
            frappe.throw(_("Converted to Issue status requires Issue reference"))

    def on_trash(self):
        """Nullify back-links from Gift Issue so Frappe's post-on_trash link check passes."""
        frappe.db.sql(
            "UPDATE `tabGift Issue` SET from_gift_interest = NULL WHERE from_gift_interest = %s",
            (self.name,)
        )

    def after_insert(self):
        try:
            gift_doc = frappe.get_doc("Gift", self.gift)
            gift_doc.add_timeline_entry(
                kind="interest_created",
                doctype="Gift Interest",
                docname=self.name,
                user=self.owner or frappe.session.user,
                gift_recipient=self.gift_recipient,
                notes=f"Interest registered via {self.interest_source}",
            )
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                f"Gift Interest after_insert: Failed creating interest_created timeline for {self.name}",
            )

