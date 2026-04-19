# -*- coding: utf-8 -*-
import frappe
from frappe.model.document import Document
from frappe import _

from gift.gift.event_permissions import build_event_permission_query, has_event_access

# DEPRECATION NOTICE:
# This doctype is being phased out. Dispatch/delivery/return functionality
# has been integrated directly into Gift Issue doctype.
# New implementations should use Gift Issue fields instead of creating separate dispatch records.

class GiftDispatch(Document):
    def validate(self):
        """Validate before save"""
        self.validate_gift_issue()
        self.validate_duplicate_dispatch()
        self.validate_single_gift()  # ✅ NEW: Ensure only one gift per dispatch
        self.validate_dispatch_type()
        self.validate_return_handling()
        self.sync_from_gift_issue()
        self.validate_event_scope()

    def validate_event_scope(self):
        if not getattr(self, "event", None) and getattr(self, "related_gift_issue", None):
            self.event = frappe.db.get_value("Gift Issue", self.related_gift_issue, "event")

        if not getattr(self, "event", None):
            frappe.throw("Event is mandatory")

        if not has_event_access(self.event, frappe.session.user):
            frappe.throw(f"You don't have access to event {self.event}")

    @staticmethod
    def get_permission_query_conditions(user):
        return build_event_permission_query("Gift Dispatch", user)

    def has_permission(self, ptype=None, user=None):
        if not user:
            user = frappe.session.user

        if user in {"Administrator"} or "System Manager" in frappe.get_roles(user):
            return True

        return has_event_access(getattr(self, "event", None), user)

    def validate_dispatch_type(self):
        if self.dispatch_type == 'Courier' and not self.tracking_number:
            frappe.throw(_("Tracking Number is required for Courier dispatch type"))

    def validate_return_handling(self):
        if self.dispatch_status in ['Failed', 'Returned'] and not self.return_reason:
            frappe.throw(_("Return Reason is required when dispatch is Failed/Returned"))

        if self.dispatch_status not in ['Failed', 'Returned']:
            self.return_reason = None
            self.return_handled_on = None
    
    def validate_gift_issue(self):
        """Validate that Gift Issue exists and is valid"""
        if not self.related_gift_issue:
            frappe.throw(_("Gift Issue is required"))
        
        # Check if issue is in valid status for dispatch
        issue = frappe.get_doc("Gift Issue", self.related_gift_issue)
        
        if issue.status in ["Cancelled", "Delivered"]:
            frappe.throw(_("Cannot dispatch a {0} Gift Issue").format(issue.status))
        
        # Validate that gift is actually issued
        if issue.gift:
            gift = frappe.get_doc("Gift", issue.gift)
            if gift.status not in ["Issued", "In Transit"]:
                frappe.throw(_("Gift must be in 'Issued' status to dispatch. Current status: {0}").format(gift.status))
    
    def validate_duplicate_dispatch(self):
        """Prevent multiple active dispatches for same gift issue"""
        if self.is_new():
            existing = frappe.db.exists("Gift Dispatch", {
                "related_gift_issue": self.related_gift_issue,
                "dispatch_status": ["not in", ["Delivered", "Cancelled"]],
                "name": ["!=", self.name]
            })
            
            if existing:
                frappe.throw(_("An active dispatch already exists for this Gift Issue: {0}").format(existing))
    
    def validate_single_gift(self):
        """Ensure dispatch links to only one gift (via Gift Issue)"""
        # ✅ NEW: The gift field should always come from Gift Issue
        if self.related_gift_issue:
            issue = frappe.get_doc("Gift Issue", self.related_gift_issue)
            if self.gift and self.gift != issue.gift:
                frappe.throw(_("Dispatch gift must match Gift Issue gift. Expected: {0}, Got: {1}").format(
                    issue.gift, self.gift
                ))
    
    def sync_from_gift_issue(self):
        """Auto-fetch data from Gift Issue when creating new dispatch"""
        if not self.related_gift_issue:
            return
        
        issue = frappe.get_doc("Gift Issue", self.related_gift_issue)
        
        # Sync gift details (always enforce from issue)
        self.gift = issue.gift
        self.gift_name = issue.gift_name
        self.gift_recipient = issue.gift_recipient
        
        # Sync delivery person details from issue (only if not already set)
        if not self.delivery_person_name and issue.delivery_person_name:
            self.delivery_person_name = issue.delivery_person_name
        if not self.delivery_person_contact and issue.delivery_person_contact:
            self.delivery_person_contact = issue.delivery_person_contact
        if not self.delivery_person_id and issue.delivery_person_id:
            self.delivery_person_id = issue.delivery_person_id
        if not self.delivery_person_company and issue.delivery_person_company:
            self.delivery_person_company = issue.delivery_person_company
        if not self.delivery_address and issue.delivery_address:
            self.delivery_address = issue.delivery_address
    
    def on_update(self):
        """Sync status and delivery details back to Gift Issue"""
        self.sync_to_gift_issue()
    
    def sync_to_gift_issue(self):
        """Sync dispatch data back to Gift Issue"""
        if not self.related_gift_issue:
            return
        
        issue = frappe.get_doc("Gift Issue", self.related_gift_issue)
        
        # Update dispatch reference
        if not issue.dispatch_reference:
            issue.dispatch_reference = self.name
        
        # Sync delivery person details back to issue
        issue.delivery_person_name = self.delivery_person_name or issue.delivery_person_name
        issue.delivery_person_contact = self.delivery_person_contact or issue.delivery_person_contact
        issue.delivery_person_id = self.delivery_person_id or issue.delivery_person_id
        issue.delivery_person_company = self.delivery_person_company or issue.delivery_person_company
        issue.delivery_address = self.delivery_address or issue.delivery_address
        
        # Sync transport details
        if self.transport_mode:
            issue.transport_mode = self.transport_mode
        if self.estimated_arrival:
            issue.estimated_arrival = self.estimated_arrival
        
        # Map dispatch status to issue status
        status_map = {
            "Pending": "Pending",
            "Dispatched": "In Transit",
            "Failed": "Pending",
            "Returned": "Returned",
        }
        
        new_issue_status = status_map.get(self.dispatch_status)
        if new_issue_status and issue.status != new_issue_status:
            issue.status = new_issue_status
        
        issue.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Update Gift status
        if issue.gift:
            self.sync_status_to_gift(issue.gift)
    
    def sync_status_to_gift(self, gift_name):
        """Update Gift status based on dispatch status"""
        gift = frappe.get_doc("Gift", gift_name)
        
        gift_status_map = {
            "Pending": "Issued",
            "Dispatched": "In Transit",
            "Failed": "Issued",
            "Returned": "Available",
        }
        
        new_gift_status = gift_status_map.get(self.dispatch_status)
        if new_gift_status and gift.status != new_gift_status:
            gift.status = new_gift_status
            
            gift.save(ignore_permissions=True)
            frappe.db.commit()
    
    def on_trash(self):
        """Clean up references when dispatch is deleted"""
        # ✅ FIXED: No more circular dependency
        if self.related_gift_issue:
            try:
                issue = frappe.get_doc("Gift Issue", self.related_gift_issue)
                
                # Only clear reference if this is the linked dispatch
                if issue.dispatch_reference == self.name:
                    issue.dispatch_reference = None
                    issue.status = "Pending"
                    
                    # Clear transport details
                    issue.transport_mode = None
                    issue.estimated_arrival = None
                    
                    issue.save(ignore_permissions=True)
                
                # Revert gift status
                if issue.gift:
                    gift = frappe.get_doc("Gift", issue.gift)
                    gift.status = "Issued"
                    gift.delivery_date = None
                    gift.save(ignore_permissions=True)
            except Exception as e:
                # If issue doesn't exist, just log and continue
                frappe.log_error(f"Error cleaning up dispatch references: {str(e)}")
    
    
