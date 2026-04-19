# -*- coding: utf-8 -*-
import frappe
from frappe.model.document import Document
from frappe import _

from gift.gift.event_permissions import build_event_permission_query, has_event_access, can_user_approve, auto_assign_event_to_record



class GiftIssue(Document):
    def _get_approval_event(self):
        event_name = getattr(self, "event", None)
        if event_name:
            return event_name

        if getattr(self, "gift", None):
            event_name = frappe.db.get_value("Gift", self.gift, "event")
            if event_name:
                self.event = event_name
                return event_name

        if getattr(self, "from_gift_interest", None):
            event_name = frappe.db.get_value("Gift Interest", self.from_gift_interest, "event")
            if event_name:
                self.event = event_name
                return event_name

        if getattr(self, "gift_recipient", None):
            event_name = frappe.db.get_value("Gift Recipient", self.gift_recipient, "event")
            if event_name:
                self.event = event_name
                return event_name

        return None

    def validate(self):
        """Validate before save"""
        # Auto-assign event for coordinators if not set
        if self.is_new():
            auto_assign_event_to_record(self)

            # Delivery method is optional for approval requests, but some system
            # validations (DocType reqd) may still enforce it. Default it to a
            # sensible value when creating a new Issue.
            if not getattr(self, "delivery_method", None):
                self.delivery_method = "Direct Handover"
        
        self.validate_recipient_not_blocked()
        self.validate_interest_approved_if_linked()
        self.validate_event_scope()
        self.validate_gift_availability()
        self.validate_duplicate_issue()  # ✅ NEW: Prevent multiple issues
        self.set_default_status()
        self.set_default_approval_status()
        self.validate_approval_workflow()
        self.validate_delivery_method()
        self.validate_delivery_confirmation()
        self.validate_return_logic()

    def validate_event_scope(self):
        if not getattr(self, "event", None):
            if getattr(self, "gift_recipient", None):
                self.event = frappe.db.get_value("Gift Recipient", self.gift_recipient, "event")
            elif getattr(self, "from_gift_interest", None):
                self.event = frappe.db.get_value("Gift Interest", self.from_gift_interest, "event")
            elif getattr(self, "gift", None):
                self.event = frappe.db.get_value("Gift", self.gift, "event")

        if not getattr(self, "event", None):
            return

        if not has_event_access(self.event, frappe.session.user):
            frappe.throw(f"You don't have access to event {self.event}")

    @staticmethod
    def get_permission_query_conditions(user):
        # Event Manager has global visibility
        roles = frappe.get_roles(user)
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return None
        
        return build_event_permission_query("Gift Issue", user)

    def has_permission(self, ptype=None, user=None):
        if not user:
            user = frappe.session.user

        roles = frappe.get_roles(user)
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return True

        if ptype == "delete" and "Event Coordinator" in roles:
            return False

        return has_event_access(getattr(self, "event", None), user)
    
    def set_default_status(self):
        """Set default status if not set"""
        if not self.status:
            self.status = "Pending"
    
    def set_default_approval_status(self):
        """Set default approval status based on user role"""
        if not self.is_new():
            return

        user = frappe.session.user
        can_approve = can_user_approve(self._get_approval_event(), user)

        # Enforce auto-approval for admins/system managers and event managers assigned to the event
        if can_approve:
            if not self.approval_status or self.approval_status == "Awaiting Approval":
                self.approval_status = "Approved"
                self.approved_by = user
                self.approved_on = frappe.utils.now()
            return

        # Non-approvers must not create pre-approved issues
        if self.approval_status in {"Approved", "Rejected"}:
            frappe.throw(_("Only Event Managers assigned to the event or Admins can approve/reject issues"))

        # Default for coordinators / unassigned managers: Awaiting Approval
        if not self.approval_status:
            self.approval_status = "Awaiting Approval"
    
    def validate_approval_workflow(self):
        """Validate approval status changes"""
        if not self.has_value_changed('approval_status'):
            return
        
        # Only Event Managers/Admins can approve or reject
        if self.approval_status in ['Approved', 'Rejected']:
            if not can_user_approve(self._get_approval_event(), frappe.session.user):
                frappe.throw(_("Only Event Managers or Admins can approve/reject issues"))
            
            self.approved_by = frappe.session.user
            self.approved_on = frappe.utils.now()
            
            if self.approval_status == 'Rejected' and not self.rejection_reason:
                frappe.throw(_("Rejection reason is required when rejecting an issue"))
        
        if self.approval_status == 'Awaiting Approval':
            self.approved_by = None
            self.approved_on = None
            self.rejection_reason = None
    
    def validate_delivery_method(self):
        """Validate delivery method specific fields"""
        # Delivery method is not required at creation time for allocation requests.
        # We only validate method-specific details when a delivery method is selected
        # AND dispatch/delivery lifecycle details are being captured.
        if not self.delivery_method:
            return

        requires_dispatch_details = self.status in ["In Transit", "Delivered"]
        if not requires_dispatch_details:
            return

        if not self.dispatch_date:
            frappe.msgprint(
                _("Dispatch date is recommended when capturing dispatch details"),
                indicator="blue"
            )

        # Validate Direct Handover
        if self.delivery_method == "Direct Handover":
            if not self.received_by_name:
                frappe.throw(_("Receiver full name is required for Direct Handover"))

            if not self.receiver_contact:
                frappe.throw(_("Receiver contact number is required for Direct Handover"))

            if not self.delivery_person_name:
                frappe.throw(_("Please specify who handed over the gift for Direct Handover"))

            if not self.delivery_person_contact:
                frappe.throw(_("Handover person contact is required for Direct Handover"))
        
        # Validate Transport
        elif self.delivery_method == "Transport":
            if not self.received_by_name:
                frappe.throw(_("Receiver full name is required for Transport delivery"))

            if not self.receiver_contact:
                frappe.throw(_("Receiver contact number is required for Transport delivery"))

            if not self.receiver_id:
                frappe.throw(_("Receiver Emirates ID is required for Transport delivery"))

            if not self.transport_mode:
                frappe.throw(_("Transport Mode is required for Transport delivery"))

            if not self.transport_company:
                frappe.throw(_("Transport Company is required for Transport delivery"))

            if not self.delivery_person_name:
                frappe.throw(_("Please specify who handed over the gift for Transport delivery"))

            if not self.delivery_person_contact:
                frappe.throw(_("Handover person contact is required for Transport delivery"))

            if not self.delivery_person_id:
                frappe.throw(_("Handover person Emirates ID is required for Transport delivery"))

            if not self.delivery_address:
                frappe.msgprint(
                    _("Delivery address is recommended for Transport delivery"),
                    indicator="orange"
                )
        
        # Validate Courier
        elif self.delivery_method == "Courier":
            if not self.tracking_number:
                frappe.throw(_("Tracking number is required for Courier delivery"))

            if not self.delivery_address:
                frappe.throw(_("Delivery address is required for Courier delivery"))
    
    def validate_delivery_confirmation(self):
        """Validate delivery confirmation details when status is Delivered"""
        if self.status == "Delivered":
            # Require recipient information
            
            
            if not self.received_by_name:
                frappe.throw(_("Receiver's full name is required when marking as Delivered"))
            
            # If not received by VIP guest directly, require relationship info
            if self.received_by_type != "Guest (VIP)" and not self.receiver_relationship:
                frappe.msgprint(
                    _("Please specify the receiver's relationship to the guest for audit purposes"),
                    indicator="orange"
                )
            
            # Recommend ID capture
            if not self.receiver_id:
                frappe.msgprint(
                    _("Capturing receiver's Emirates ID/Passport is recommended for verification"),
                    indicator="blue"
                )
            
            # Auto-set delivery date if not set
            if not self.delivery_date:
                self.delivery_date = frappe.utils.today()
    
    def validate_return_logic(self):
        """Validate return information"""
        if self.is_returned:
            if not self.return_date:
                self.return_date = frappe.utils.now()
            if not self.return_handled_by:
                self.return_handled_by = frappe.session.user
            if not self.return_reason:
                frappe.throw(_("Return reason is required when marking as returned"))
            
            # Auto-set status to Returned
            if self.status != "Returned":
                self.status = "Returned"
    
    def validate_gift_availability(self):
        """Check if gift is available for issuing"""
        if self.gift and self.is_new():
            gift_doc = frappe.get_doc("Gift", self.gift)
            if gift_doc.status not in ["Available", "Reserved"]:
                frappe.throw(_("Gift {0} is not available (Current status: {1})").format(
                    self.gift, gift_doc.status
                ))

    def validate_recipient_not_blocked(self):
        if not self.gift_recipient:
            return

        blocked = frappe.db.get_value('Gift Recipient', self.gift_recipient, 'blocked')
        if blocked:
            frappe.throw(_("This recipient is blocked and cannot receive gifts"))

    def validate_interest_approved_if_linked(self):
        if not self.from_gift_interest:
            return

        interest = frappe.get_doc('Gift Interest', self.from_gift_interest)
        # Interest status must not block creating an Issue request.
        # The Issue approval workflow is the authoritative gate.
        return
    
    def validate_duplicate_issue(self):
        """Allow multiple issues (approval requests), but only one Approved issue per gift."""
        if self.gift and self.is_new():
            existing_approved_issue = frappe.db.exists(
                "Gift Issue",
                {
                    "gift": self.gift,
                    "approval_status": "Approved",
                    "status": ["not in", ["Cancelled", "Returned"]],
                    "name": ["!=", self.name],
                },
            )

            if existing_approved_issue:
                frappe.throw(
                    _("Gift {0} already has an approved issue: {1}").format(
                        self.gift, existing_approved_issue
                    )
                )
    
    def after_insert(self):
        """Update gift status and link to interest after inserting"""
        # Only update gift status if approved
        if self.approval_status == "Approved":
            self.update_gift_status("Issued")
        else:
            # For awaiting approval, mark gift as Reserved
            self.update_gift_status("Reserved")
        self.link_to_interest()

        try:
            gift_doc = frappe.get_doc("Gift", self.gift)
            gift_doc.add_timeline_entry(
                kind="issue_created",
                doctype="Gift Issue",
                docname=self.name,
                user=self.owner or frappe.session.user,
                gift_recipient=getattr(self, "gift_recipient", None),
                notes=f"Issue request created with approval status: {self.approval_status}",
            )
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                f"Gift Issue after_insert: Failed creating issue_created timeline for {self.name}",
            )

        # Ensure gift status reflects all issues for this gift (not just this one)
        self.recompute_gift_status_from_issues()
    
    def link_to_interest(self):
        """Link this issue to any matching Gift Interest records"""
        if not self.gift or not self.gift_recipient:
            return
        
        # If already linked via from_gift_interest, update that specific interest
        if self.from_gift_interest:
            try:
                interest_doc = frappe.get_doc("Gift Interest", self.from_gift_interest)
                # Only mark the interest as converted if it is approved.
                # Otherwise this is an Issue Request and the authoritative link
                # remains on Gift Issue.from_gift_interest.
                if getattr(interest_doc, "approval_status", None) == "Approved":
                    interest_doc.converted_to_issue = self.name
                    interest_doc.conversion_date = frappe.utils.now()
                    interest_doc.follow_up_status = "Converted to Issue"
                    interest_doc.save(ignore_permissions=True)
                frappe.msgprint(
                    _("Linked to Gift Interest: {0}").format(self.from_gift_interest),
                    alert=True,
                    indicator="green"
                )
            except Exception as e:
                frappe.log_error(f"Failed to link interest: {str(e)}")
            return
        
        # Otherwise, find matching interests that are not yet converted
        interests = frappe.get_all(
            "Gift Interest",
            filters={
                "gift": self.gift,
                "gift_recipient": self.gift_recipient,
                "follow_up_status": ["!=", "Converted to Issue"]
            },
            order_by="creation desc",
            pluck="name"
        )
        
        # Update the most recent matching interest
        if interests:
            try:
                interest_doc = frappe.get_doc("Gift Interest", interests[0])
                interest_doc.converted_to_issue = self.name
                interest_doc.conversion_date = frappe.utils.now()
                interest_doc.follow_up_status = "Converted to Issue"
                interest_doc.save(ignore_permissions=True)
                
                # Update the issue to reference the interest
                self.from_gift_interest = interests[0]
                
                frappe.msgprint(
                    _("Automatically linked to Gift Interest: {0}").format(interests[0]),
                    alert=True,
                    indicator="green"
                )
            except Exception as e:
                frappe.log_error(f"Failed to link interest: {str(e)}")
    
    def on_update(self):
        """Sync status changes and handle approval/return"""
        if self.has_value_changed('status'):
            self.sync_gift_status()
        
        if self.has_value_changed('approval_status'):
            self.handle_approval_status_change()
        
        if self.has_value_changed('is_returned') and self.is_returned:
            self.handle_return()
    
    def handle_approval_status_change(self):
        """Handle approval status changes"""
        if not getattr(self.flags, "skip_timeline_log", False):
            try:
                gift_doc = frappe.get_doc("Gift", self.gift)
                if self.approval_status == "Approved":
                    gift_doc.add_timeline_entry(
                        kind="issue_approved",
                        doctype="Gift Issue",
                        docname=self.name,
                        user=frappe.session.user,
                        gift_recipient=getattr(self, "gift_recipient", None),
                        notes="Issue approved via document update",
                    )
                elif self.approval_status == "Rejected":
                    reason = getattr(self, "rejection_reason", None)
                    gift_doc.add_timeline_entry(
                        kind="allocation_rejected",
                        doctype="Gift Issue",
                        docname=self.name,
                        user=frappe.session.user,
                        gift_recipient=getattr(self, "gift_recipient", None),
                        notes=f"Reason: {reason}" if reason else "Reason: -",
                    )
            except Exception:
                frappe.log_error(
                    frappe.get_traceback(),
                    f"Gift Issue handle_approval_status_change: Failed timeline logging for {self.name}",
                )

        if self.approval_status == "Approved":
            frappe.msgprint(_("Issue has been approved"), indicator="green")

        elif self.approval_status == "Rejected":
            frappe.msgprint(
                _("Issue has been rejected."),
                indicator="orange",
            )

        # Always recompute gift status based on all issue requests for this gift.
        self.recompute_gift_status_from_issues()
    
    def handle_return(self):
        """Handle gift return - mark gift as Available again"""
        if not self.gift:
            return
        
        gift_doc = frappe.get_doc("Gift", self.gift)
        gift_doc.status = "Available"
        gift_doc.gift_recipient = None
        gift_doc.issued_date = None
        gift_doc.delivery_date = None
        gift_doc.save(ignore_permissions=True)
        
        frappe.msgprint(
            _("Gift {0} has been returned and is now available for re-issue").format(self.gift),
            indicator="blue",
            alert=True
        )
    
    def update_gift_status(self, status):
        """Update the gift status"""
        if self.gift:
            gift_doc = frappe.get_doc("Gift", self.gift)
            gift_doc.status = status
            # Only assign recipient and issued date when the issue is approved/active.
            if status != "Reserved":
                gift_doc.gift_recipient = self.gift_recipient
                gift_doc.issued_date = self.date or frappe.utils.today()
            gift_doc.save(ignore_permissions=True)
    
    def sync_gift_status(self):
        """Sync gift status based on issue status"""
        if not self.gift:
            return
        
        # Only sync if issue is approved
        if self.approval_status != "Approved" and self.status not in ["Cancelled", "Returned"]:
            return

        status_map = {
            "Pending": "Issued",
            "In Transit": "In Transit",
            "Delivered": "Delivered",
            "Returned": "Available",
            "Cancelled": "Available"
        }
        
        gift_status = status_map.get(self.status, "Issued")
        
        gift_doc = frappe.get_doc("Gift", self.gift)
        gift_doc.status = gift_status
        
        # For active issue states, ensure the gift is assigned to the recipient
        # and has an issued date.
        if self.status not in ["Cancelled", "Returned"]:
            gift_doc.gift_recipient = self.gift_recipient
            gift_doc.issued_date = self.date or frappe.utils.today()
        
        if self.status == "Delivered" and self.delivery_date:
            gift_doc.delivery_date = self.delivery_date
        elif self.status in ["Cancelled", "Returned"]:
            # Clear recipient info if cancelled or returned
            gift_doc.gift_recipient = None
            gift_doc.issued_date = None
            gift_doc.delivery_date = None
        
        gift_doc.save(ignore_permissions=True)

        # Keep Gift.status authoritative when multiple issues exist for the same gift
        self.recompute_gift_status_from_issues()

    def recompute_gift_status_from_issues(self):
        """Recompute Gift.status based on all related Gift Issue records.

        Rules:
        - If any active Approved issue exists, Gift status follows that issue's delivery lifecycle.
        - Else if any active Awaiting Approval issue exists, Gift status is Reserved.
        - Else (all requests rejected/cancelled/returned), Gift is Available.
        """
        if not self.gift:
            return

        try:
            gift_doc = frappe.get_doc("Gift", self.gift)
        except Exception:
            return

        issues = frappe.get_all(
            "Gift Issue",
            filters={
                "gift": self.gift,
                "status": ["not in", ["Cancelled", "Returned"]],
            },
            fields=["name", "approval_status", "status", "gift_recipient", "date", "delivery_date"],
            order_by="modified desc",
        )

        approved_issue = next(
            (i for i in (issues or []) if i.get("approval_status") == "Approved"),
            None,
        )

        if approved_issue:
            status_map = {
                "Pending": "Issued",
                "In Transit": "In Transit",
                "Delivered": "Delivered",
            }
            gift_doc.status = status_map.get(approved_issue.get("status") or "Pending", "Issued")
            gift_doc.gift_recipient = approved_issue.get("gift_recipient")
            gift_doc.issued_date = approved_issue.get("date") or frappe.utils.today()
            if approved_issue.get("status") == "Delivered" and approved_issue.get("delivery_date"):
                gift_doc.delivery_date = approved_issue.get("delivery_date")
            gift_doc.save(ignore_permissions=True)
            return

        awaiting = any(
            (i.get("approval_status") == "Awaiting Approval") for i in (issues or [])
        )
        if awaiting:
            gift_doc.status = "Reserved"
            gift_doc.gift_recipient = None
            gift_doc.issued_date = None
            gift_doc.delivery_date = None
            gift_doc.save(ignore_permissions=True)
            return

        gift_doc.status = "Available"
        gift_doc.gift_recipient = None
        gift_doc.issued_date = None
        gift_doc.delivery_date = None
        gift_doc.save(ignore_permissions=True)

    def on_trash(self):
        """Revert gift status and interest status when deleted"""
        
        # Clear interest link FIRST (before everything else)
        if self.from_gift_interest:
            try:
                interest_doc = frappe.get_doc("Gift Interest", self.from_gift_interest)
                interest_doc.converted_to_issue = None  # Clear the link
                interest_doc.conversion_date = None
                interest_doc.flags.ignore_validate = True  # Skip validation
                interest_doc.save(ignore_permissions=True)
                frappe.msgprint(
                    _("Gift Interest {0} has been reverted").format(self.from_gift_interest),
                    alert=True,
                    indicator="orange"
                )
            except Exception as e:
                frappe.log_error(f"Failed to revert interest: {str(e)}")
                # Don't stop deletion even if this fails
        
        # Revert gift status
        if self.gift:
            # Do not blindly revert to Available; the gift may have other
            # pending/approved issue requests.
            self.recompute_gift_status_from_issues()

    @frappe.whitelist(allow_guest=False)
    def approve_issue(self):
        """Approve the issue - only Event Managers/Admins can do this"""
        if not can_user_approve(self._get_approval_event(), frappe.session.user):
            frappe.throw(_("Only Event Managers or Admins can approve issues"))
        
        if self.approval_status == "Approved":
            frappe.throw(_("Issue is already approved"))

        # Enforce: only one active approved issue per gift.
        if self.gift:
            other_approved = frappe.db.exists(
                "Gift Issue",
                {
                    "gift": self.gift,
                    "approval_status": "Approved",
                    "status": ["not in", ["Cancelled", "Returned"]],
                    "name": ["!=", self.name],
                },
            )
            if other_approved:
                frappe.throw(
                    _("Another approved issue already exists for this gift: {0}").format(
                        other_approved
                    )
                )
        
        self.approval_status = "Approved"
        self.approved_by = frappe.session.user
        self.approved_on = frappe.utils.now()

        try:
            gift_doc = frappe.get_doc("Gift", self.gift)
            gift_doc.add_timeline_entry(
                kind="issue_approved",
                doctype="Gift Issue",
                docname=self.name,
                user=frappe.session.user,
                gift_recipient=getattr(self, "gift_recipient", None),
                notes=f"Allocation approved for {getattr(self, 'gift_recipient', 'guest')}",
            )
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                f"Gift Issue approve_issue: Failed creating issue_approved timeline for {self.name}",
            )

        self.flags.skip_timeline_log = True
        try:
            self.save()
        finally:
            self.flags.skip_timeline_log = False

        # Once approved, this should behave like an issued gift.
        self.update_gift_status("Issued")
        self.recompute_gift_status_from_issues()
        return True
    
    @frappe.whitelist(allow_guest=False)
    def reject_issue(self, reason=None):
        """Reject the issue - only Event Managers/Admins can do this"""
        if not can_user_approve(self._get_approval_event(), frappe.session.user):
            frappe.throw(_("Only Event Managers or Admins can reject issues"))
        
        if not reason:
            frappe.throw(_("Rejection reason is required"))
        
        self.approval_status = "Rejected"
        self.rejection_reason = reason
        self.approved_by = frappe.session.user
        self.approved_on = frappe.utils.now()

        self.flags.skip_timeline_log = True
        try:
            self.save()
        finally:
            self.flags.skip_timeline_log = False

        # Add log entry for gift history
        try:
            gift_doc = frappe.get_doc("Gift", self.gift)
            recipient_name = frappe.db.get_value(
                "Gift Recipient",
                self.gift_recipient,
                "owner_full_name",
            ) if self.gift_recipient else None
            gift_doc.add_timeline_entry(
                kind="allocation_rejected",
                doctype="Gift Issue",
                docname=self.name,
                user=frappe.session.user,
                gift_recipient=getattr(self, 'gift_recipient', None),
                guest_full_name=recipient_name,
                notes=f"Reason: {reason}",
            )
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                f"Gift Issue reject_issue: Failed creating allocation_rejected timeline for {self.name}",
            )

        # Ensure gift status reflects all issues for this gift (not just this one)
        self.recompute_gift_status_from_issues()
        
        frappe.msgprint(_("Issue {0} has been rejected").format(self.name), indicator="orange")
        return True

    @frappe.whitelist(allow_guest=False)
    def send_for_approval_again(self):
        """Move a rejected issue back to Awaiting Approval.

        Only Event Managers/Admins can do this.
        """
        if not can_user_approve(self._get_approval_event(), frappe.session.user):
            frappe.throw(_("Only Event Managers or Admins can re-open issues for approval"))

        if self.approval_status != "Rejected":
            frappe.throw(_("Only rejected issues can be sent for approval again"))

        self.approval_status = "Awaiting Approval"
        self.approved_by = None
        self.approved_on = None
        self.rejection_reason = None
        self.save(ignore_permissions=True)

        self.recompute_gift_status_from_issues()
        return True
    
    @frappe.whitelist(allow_guest=False)
    def mark_as_returned(self, return_reason=None):
        """Mark the issue as returned and make gift available again"""
        if not return_reason:
            frappe.throw(_("Return reason is required"))
        
        self.is_returned = 1
        self.return_date = frappe.utils.now()
        self.return_reason = return_reason
        self.return_handled_by = frappe.session.user
        self.status = "Returned"
        self.save()
        
        frappe.msgprint(
            _("Issue {0} marked as returned. Gift is now available.").format(self.name),
            indicator="blue"
        )
        return True

    @frappe.whitelist(allow_guest=False)
    def unissue(self, reason=None):
        """
        Unallocate/Un-issue a gift — reverses the issued state.
        Only Event Managers/Admins can do this.
        Allowed only when approval_status is Approved and
        status is Pending or In Transit (not yet Delivered).
        """
        if not can_user_approve(self._get_approval_event(), frappe.session.user):
            frappe.throw(_("Only Event Managers or Admins can un-issue gifts"))

        if self.status == "Delivered":
            frappe.throw(_("Cannot un-issue a gift that has already been Delivered"))

        if self.status in ["Cancelled", "Returned"]:
            frappe.throw(_("Gift Issue is already {0}").format(self.status))

        if self.approval_status not in ["Approved", "Awaiting Approval"]:
            frappe.throw(_("Only Approved or Awaiting Approval issues can be un-issued"))

        if not reason:
            frappe.throw(_("A reason is required to un-issue a gift"))

        # Cancel the issue
        self.status = "Cancelled"
        self.approval_status = "Rejected"
        self.rejection_reason = reason
        self.approved_by = frappe.session.user
        self.approved_on = frappe.utils.now()

        self.flags.skip_timeline_log = True
        try:
            self.save(ignore_permissions=True)
        finally:
            self.flags.skip_timeline_log = False

        # Revert interest link if present
        if self.from_gift_interest:
            try:
                interest_doc = frappe.get_doc("Gift Interest", self.from_gift_interest)
                interest_doc.converted_to_issue = None
                interest_doc.conversion_date = None
                interest_doc.follow_up_status = "New"
                interest_doc.approval_status = "Pending"
                interest_doc.approved_by = None
                interest_doc.approved_on = None
                interest_doc.flags.ignore_validate = True
                interest_doc.save(ignore_permissions=True)
            except Exception as e:
                frappe.log_error(f"Failed to revert interest on un-issue: {str(e)}")

        # Recompute gift status — this will flip it back to Available or Reserved
        self.recompute_gift_status_from_issues()

        # Add log entry for gift history
        try:
            gift_doc = frappe.get_doc("Gift", self.gift)
            gift_doc.add_timeline_entry(
                kind="allocation_removed",
                doctype="Gift Issue",
                docname=self.name,
                user=frappe.session.user,
                gift_recipient=getattr(self, 'gift_recipient', None),
                notes=f"Allocation removed. Reason: {reason}",
            )
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                f"Gift Issue unissue: Failed creating allocation_removed timeline for {self.name}",
            )

        frappe.msgprint(
            _("Gift Issue {0} has been un-issued. Gift is now available.").format(self.name),
            indicator="orange",
            alert=True,
        )
        return True

