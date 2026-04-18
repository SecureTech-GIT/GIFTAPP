# -*- coding: utf-8 -*-
# Copyright (c) 2025, Aman Boora and contributors
# For license information, please see license.txt


import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import validate_email_address
import re

from gift.gift.event_permissions import build_event_permission_query, has_event_access, auto_assign_event_to_record


class GiftRecipient(Document):
    def validate(self):
        """Validate gift recipient document"""
        if not self.is_new() and frappe.conf.get("developer_mode"):
            try:
                old_event = frappe.db.get_value("Gift Recipient", self.name, "event")
                frappe.logger("gift_recipient").info(
                    {
                        "action": "validate",
                        "recipient": self.name,
                        "old_event": old_event,
                        "new_event": getattr(self, "event", None),
                        "user": frappe.session.user,
                    }
                )
            except Exception:
                pass

        # Auto-assign event for coordinators if not set
        if self.is_new():
            auto_assign_event_to_record(self)
        
        self.validate_required_fields()
        self.validate_emails()
        self.validate_mobile_number()
        self.validate_emirates_id()
        self.set_full_name()
        self.validate_coordinator_details()
        # Event is now optional - validate only if provided
        if getattr(self, "event", None):
            self.validate_event_access()

    def validate_required_fields(self):
        """Validate required fields"""
        if not self.guest_first_name or not self.guest_first_name.strip():
            frappe.throw(_("Guest First Name is required"))

        # Coordinator is mandatory for all VIP guests
        if not self.coordinator_full_name or not self.coordinator_full_name.strip():
            frappe.throw(_("Coordinator Full Name is mandatory for VIP guests"))
        
        if not self.coordinator_mobile_no or not self.coordinator_mobile_no.strip():
            frappe.throw(_("Coordinator Mobile Number is mandatory for VIP guests"))
        
        # Coordinator email is optional; validate format only if provided.

    def set_full_name(self):
        """Auto-set owner_full_name from guest first and last name"""
        if self.guest_first_name:
            name_parts = [self.salutation] if self.salutation else []
            name_parts.append(self.guest_first_name.strip().title())
            if self.guest_last_name:
                name_parts.append(self.guest_last_name.strip().title())
            self.owner_full_name = " ".join(name_parts)
            

    def validate_emails(self):
        """Validate email addresses"""
        if self.coordinator_email:
            try:
                validate_email_address(self.coordinator_email, throw=True)
            except Exception as e:
                frappe.throw(_("Invalid Coordinator Email: {0}").format(str(e)))

    def validate_mobile_number(self):
        """Enhanced mobile number validation with formatting"""
        mobile_fields = {
            'coordinator_mobile_no': 'Coordinator Mobile Number'
        }

        for field, label in mobile_fields.items():
            mobile = self.get(field)
            if mobile:
                # Clean and validate
                cleaned = self.clean_phone_number(mobile, label)
                self.set(field, cleaned)

    def clean_phone_number(self, phone, label="Phone"):
        """Clean and validate phone number"""
        if not phone:
            return phone

        # Remove spaces and special characters except +
        cleaned = re.sub(r'[^0-9+]', '', phone)

        # Basic validation: should start with + or digit and be 7-15 chars
        if not re.match(r'^[+]?[0-9]{7,15}$', cleaned):
            frappe.throw(_("{0} format is invalid. Expected format: +971501234567 or 0501234567").format(label))

        # Ensure minimum length
        digits_only = cleaned.replace('+', '')
        if len(digits_only) < 10:
            frappe.throw(_("{0} should be at least 10 digits").format(label))

        return cleaned

    def validate_emirates_id(self):
        """Validate Emirates ID format and uniqueness"""
        for field_name, label in [
            ('emirates_id', 'Emirates ID'),
            ('coordinator_emirates_id', 'Coordinator Emirates ID')
        ]:
            eid = self.get(field_name)
            if eid:
                # Remove dashes and spaces for validation
                eid_clean = eid.replace('-', '').replace(' ', '').upper()

                # Emirates ID should be 15 digits starting with 784
                if not re.match(r'^784[0-9]{12}$', eid_clean):
                    frappe.throw(
                        _("Invalid {0} format. Expected: 784-YYYY-NNNNNNN-N (15 digits starting with 784)").format(label)
                    )

                # Format it properly: 784-YYYY-NNNNNNN-N
                formatted_eid = f"{eid_clean[0:3]}-{eid_clean[3:7]}-{eid_clean[7:14]}-{eid_clean[14]}"
                self.set(field_name, formatted_eid)

                # Check uniqueness only for main Emirates ID
                if field_name == 'emirates_id':
                    existing = frappe.db.get_value(
                        "Gift Recipient",
                        {"emirates_id": formatted_eid, "name": ["!=", self.name]},
                        "name"
                    )
                    if existing:
                        frappe.throw(_("Emirates ID {0} already exists for recipient: {1}").format(
                            formatted_eid, existing
                        ))


    @staticmethod
    def get_permission_query_conditions(user):
        # Event Manager has global visibility
        roles = frappe.get_roles(user)
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return None
        
        return build_event_permission_query("Gift Recipient", user)

    def has_permission(self, ptype=None, user=None):
        if not user:
            user = frappe.session.user

        roles = frappe.get_roles(user)
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return True

        if ptype == "delete" and "Event Coordinator" in roles:
            return False

        return has_event_access(getattr(self, "event", None), user)

    def validate_event_access(self):
        """Validate user has access to the event (only if event is set)"""
        if not has_event_access(self.event, frappe.session.user):
            frappe.throw(f"You don't have access to event {self.event}")
        
        assigned_coordinator = getattr(self, "assigned_coordinator", None)
        if assigned_coordinator:
            is_team_member = frappe.db.exists(
                "Event Team Member",
                {
                    "parent": self.event,
                    "parenttype": "Gift Event",
                    "user": assigned_coordinator,
                },
            )
            if not is_team_member:
                frappe.throw(
                    f"User {assigned_coordinator} is not assigned to event {self.event}"
                )

    def validate_coordinator_details(self):
        """Ensure coordinator details are complete"""
        # All coordinator fields are now mandatory, validation done in validate_required_fields
        pass

    def before_save(self):
        """Format names and set defaults before saving"""
        if not self.is_new() and frappe.conf.get("developer_mode"):
            try:
                old_event = frappe.db.get_value("Gift Recipient", self.name, "event")
                frappe.logger("gift_recipient").info(
                    {
                        "action": "before_save",
                        "recipient": self.name,
                        "old_event": old_event,
                        "new_event": getattr(self, "event", None),
                        "user": frappe.session.user,
                    }
                )
            except Exception:
                pass

        # Backfill coordinator name parts for legacy records.
        # coordinator_first_name is mandatory in the DocType, but older records may
        # only have coordinator_full_name populated.
        coordinator_full = (self.coordinator_full_name or "").strip()
        coordinator_first = (getattr(self, "coordinator_first_name", None) or "").strip()
        coordinator_last = (getattr(self, "coordinator_last_name", None) or "").strip()

        if coordinator_full and not coordinator_first:
            parts = [p for p in coordinator_full.split() if p]
            if parts:
                self.coordinator_first_name = parts[0]
                if not coordinator_last and len(parts) > 1:
                    self.coordinator_last_name = " ".join(parts[1:])

        # Last-resort backfill for very old/partial records:
        # coordinator_first_name is mandatory in DocType, so ensure it's populated.
        if not (getattr(self, "coordinator_first_name", None) or "").strip():
            if (getattr(self, "guest_first_name", None) or "").strip():
                self.coordinator_first_name = self.guest_first_name

        # Legacy mobile support: some records may still have mobile stored in mobile_number.
        if not (getattr(self, "coordinator_mobile_no", None) or "").strip():
            legacy_mobile = (getattr(self, "mobile_number", None) or "").strip()
            if legacy_mobile:
                self.coordinator_mobile_no = legacy_mobile

        # If full name is missing but parts exist, compose it.
        coordinator_first = (getattr(self, "coordinator_first_name", None) or "").strip()
        coordinator_last = (getattr(self, "coordinator_last_name", None) or "").strip()
        if not coordinator_full and coordinator_first:
            self.coordinator_full_name = f"{coordinator_first} {coordinator_last}".strip()

        # Format coordinator name
        if self.coordinator_full_name:
            self.coordinator_full_name = self.coordinator_full_name.strip().title()
        if getattr(self, "coordinator_first_name", None):
            self.coordinator_first_name = self.coordinator_first_name.strip().title()
        if getattr(self, "coordinator_last_name", None):
            self.coordinator_last_name = self.coordinator_last_name.strip().title()

        # Set default is_active if not set
        if self.is_active is None:
            self.is_active = 1

    def on_update(self):
        """Actions after update"""
        self.sync_to_event_participants()

    def after_insert(self):
        self.sync_to_event_participants()

    def sync_to_event_participants(self):
        """Ensure this recipient is present in the parent event's participant list."""
        event = getattr(self, "event", None)
        if not event:
            return

        try:
            ev = frappe.get_doc("Gift Event", event)
        except Exception:
            return

        existing = any((row.gift_recipient == self.name) for row in (ev.event_participants or []))
        if existing:
            return

        try:
            ev.append(
                "event_participants",
                {
                    "gift_recipient": self.name,
                    "doctype": "Event Participants",
                    "parenttype": "Gift Event",
                    "parentfield": "event_participants",
                },
            )
            ev.save(ignore_permissions=True)
        except Exception:
            frappe.log_error(frappe.get_traceback(), "Gift Recipient: Failed syncing to event_participants")

    def on_trash(self):
        """Cancel related issues (reverting gift status), delete interests, then nullify
        all link fields so Frappe's post-on_trash link check passes cleanly."""
        from gift.gift.api import _recompute_gift_status_from_issues

        # --- Step 1: Collect all related records while links still exist ---
        issue_rows = frappe.db.sql(
            """SELECT name, gift, status, from_gift_interest
               FROM `tabGift Issue` WHERE gift_recipient = %s""",
            (self.name,),
            as_dict=True,
        )
        interest_rows = frappe.db.sql(
            "SELECT name FROM `tabGift Interest` WHERE gift_recipient = %s",
            (self.name,),
            as_dict=True,
        )

        touched_gifts = set()

        # --- Step 2: Cancel non-terminal issues and revert linked interests ---
        for row in issue_rows:
            try:
                if row.status not in {"Cancelled", "Returned", "Delivered"}:
                    frappe.db.set_value(
                        "Gift Issue", row.name,
                        {"status": "Cancelled", "rejection_reason": "Guest record deleted"},
                        update_modified=False,
                    )
                if row.gift:
                    touched_gifts.add(row.gift)
                if row.from_gift_interest and frappe.db.exists("Gift Interest", row.from_gift_interest):
                    frappe.db.set_value(
                        "Gift Interest", row.from_gift_interest,
                        {
                            "converted_to_issue": None,
                            "conversion_date": None,
                            "follow_up_status": "New",
                            "approval_status": "Pending",
                            "approved_by": None,
                            "approved_on": None,
                        },
                        update_modified=False,
                    )
            except Exception as e:
                frappe.log_error(f"on_trash GiftRecipient: cancel issue {row.name} failed: {e}")

        # --- Step 3: Delete Gift Interests (nullify their back-links first) ---
        for row in interest_rows:
            try:
                frappe.db.sql(
                    "UPDATE `tabGift Issue` SET from_gift_interest = NULL WHERE from_gift_interest = %s",
                    (row.name,)
                )
                frappe.delete_doc("Gift Interest", row.name, ignore_permissions=True, force=True)
            except Exception as e:
                frappe.log_error(f"on_trash GiftRecipient: delete interest {row.name} failed: {e}")

        # --- Step 4: Recompute gift statuses so gifts become Available again ---
        for gift_name in touched_gifts:
            try:
                _recompute_gift_status_from_issues(gift_name)
            except Exception as e:
                frappe.log_error(f"on_trash GiftRecipient: recompute status {gift_name} failed: {e}")

        # --- Step 5: Remove from event participants child table ---
        try:
            frappe.db.sql(
                "DELETE FROM `tabEvent Participants` WHERE gift_recipient = %s",
                (self.name,)
            )
        except Exception as e:
            frappe.log_error(f"on_trash GiftRecipient: remove event participants failed: {e}")

        # --- Step 6: Nullify all remaining link fields so Frappe's link check passes ---
        frappe.db.sql(
            "UPDATE `tabGift Issue` SET gift_recipient = NULL WHERE gift_recipient = %s",
            (self.name,)
        )
        frappe.db.sql(
            "UPDATE `tabGift Interest` SET gift_recipient = NULL WHERE gift_recipient = %s",
            (self.name,)
        )
        frappe.db.sql(
            "UPDATE `tabGift Dispatch` SET gift_recipient = NULL WHERE gift_recipient = %s",
            (self.name,)
        )
        frappe.db.sql(
            "UPDATE `tabGift Timeline Entry` SET gift_recipient = NULL WHERE gift_recipient = %s",
            (self.name,)
        )

    @frappe.whitelist(allow_guest=False)
    def get_recipient_summary(self):
        """Get formatted summary of recipient details"""
        summary = {
            "full_name": self.owner_full_name,
            "first_name": self.guest_first_name,
            "last_name": self.guest_last_name,
            "salutation": self.salutation,
            "contact": {
                "email": self.coordinator_email,
                "phone": self.coordinator_mobile_no
            },
            "location": {
                "nationality": self.guest_nationality,
                "country": self.guest_country,
                "address": self.address
            },
            "coordinator": {
                "name": self.coordinator_full_name,
                "email": self.coordinator_email,
                "phone": self.coordinator_mobile_no,
                "emirates_id": self.coordinator_emirates_id
            } if self.coordinator_full_name else None,
            "recipient_type": self.recipient_type,
            "is_active": self.is_active
        }
        return summary


@frappe.whitelist(allow_guest=False)
def search_recipients(query=None, limit=20):
    """Search gift recipients for autocomplete"""
    filters = {}
    or_filters = []

    if query:
        or_filters = [
            ["owner_full_name", "like", f"%{query}%"],
            ["guest_first_name", "like", f"%{query}%"],
            ["guest_last_name", "like", f"%{query}%"],
            ["coordinator_full_name", "like", f"%{query}%"],
            ["coordinator_mobile_no", "like", f"%{query}%"],
            ["coordinator_email", "like", f"%{query}%"],
            ["coordinator_emirates_id", "like", f"%{query}%"]
        ]

    recipients = frappe.get_list(
        "Gift Recipient",
        fields=[
            "name", 
            "owner_full_name",
            "guest_first_name",
            "guest_last_name",
            "coordinator_full_name", 
            "coordinator_mobile_no",
            "coordinator_email",
            "coordinator_emirates_id",
            "address",
            "guest_nationality"
        ],
        filters=filters,
        or_filters=or_filters if or_filters else None,
        limit=limit,
        order_by="modified desc"
    )

    return recipients


@frappe.whitelist(allow_guest=False)
def get_recipient_details(name):
    """Get complete recipient details including documents"""
    try:
        recipient = frappe.get_doc("Gift Recipient", name)

        # Get documents
        documents = []
        if hasattr(recipient, 'recipient_documents'):
            for doc in recipient.recipient_documents:
                documents.append({
                    'document_type': doc.document_type,
                    'document_attachment': doc.document_attachment,
                    'description': doc.description if hasattr(doc, 'description') else None
                })

        return {
            "name": recipient.name,
            "owner_full_name": recipient.owner_full_name,
            "guest_first_name": recipient.guest_first_name,
            "guest_last_name": recipient.guest_last_name,
            "salutation": recipient.salutation,
            "preferred_contact_method": getattr(recipient, "preferred_contact_method", None),
            "coordinator_full_name": recipient.coordinator_full_name,
            "coordinator_mobile_no": recipient.coordinator_mobile_no,
            "coordinator_email": recipient.coordinator_email,
            "coordinator_emirates_id": recipient.coordinator_emirates_id,
            "guest_nationality": recipient.guest_nationality,
            "guest_country": recipient.guest_country,
            "address": recipient.address,
            "person_photo": recipient.person_photo,
            "is_active": recipient.is_active,
            "blocked": recipient.blocked,
            "documents": documents
        }
    except frappe.DoesNotExistError:
        frappe.throw(_("Gift Recipient not found"))


@frappe.whitelist(allow_guest=False)
def get_recipient_gift_history(recipient_name):
    """Get all gifts issued to this recipient"""

    # Get interests
    interests = frappe.get_all(
        "Gift Interest",
        filters={"gift_recipient": recipient_name},
        fields=["name", "gift", "gift_name", "date", "interest_level", "follow_up_status"],
        order_by="date desc"
    )

    # Get issues
    issues = frappe.get_all(
        "Gift Issue",
        filters={"gift_recipient": recipient_name},
        fields=["name", "gift", "gift_name", "date", "status", "event"],
        order_by="date desc"
    )

    return {
        "interests": interests,
        "issues": issues,
        "total_interests": len(interests),
        "total_issued": len(issues)
    }


@frappe.whitelist(allow_guest=False)
def get_recipient_by_email(email):
    """Utility function to get recipient by coordinator email"""
    return frappe.get_all(
        "Gift Recipient",
        filters={"coordinator_email": email, "is_active": 1},
        fields=["name", "owner_full_name", "coordinator_email"]
    )


@frappe.whitelist(allow_guest=False)
def get_recipient_by_phone(phone):
    """Utility function to get recipient by coordinator phone"""
    return frappe.get_all(
        "Gift Recipient",
        filters={"coordinator_mobile_no": phone, "is_active": 1},
        fields=["name", "owner_full_name", "coordinator_mobile_no"]
    )


@frappe.whitelist(allow_guest=False)
def get_active_recipients(recipient_type=None, nationality=None):
    """Get active recipients with optional filters"""
    filters = {"is_active": 1}

    if recipient_type:
        filters["recipient_type"] = recipient_type

    if nationality:
        filters["guest_nationality"] = nationality

    return frappe.get_all(
        "Gift Recipient",
        filters=filters,
        fields=[
            "name", "owner_full_name", "guest_nationality",
            "coordinator_full_name", "coordinator_email", "coordinator_mobile_no"
        ],
        order_by="owner_full_name asc"
    )


@frappe.whitelist(allow_guest=False)
def check_duplicate_recipient(coordinator_email=None, coordinator_mobile_no=None, coordinator_emirates_id=None):
    """Check if recipient already exists with same coordinator contact details"""
    filters = {"is_active": 1}

    if coordinator_email:
        filters["coordinator_email"] = coordinator_email
    elif coordinator_mobile_no:
        filters["coordinator_mobile_no"] = coordinator_mobile_no
    elif coordinator_emirates_id:
        filters["coordinator_emirates_id"] = coordinator_emirates_id
    else:
        return []

    existing = frappe.get_all(
        "Gift Recipient",
        filters=filters,
        fields=["name", "owner_full_name", "coordinator_email", "coordinator_mobile_no"],
        limit=1
    )

    return existing[0] if existing else None