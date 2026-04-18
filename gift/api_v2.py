# API helper functions for Gift Recipient integration
import frappe
from frappe import _


@frappe.whitelist(allow_guest=False)
def create_or_get_recipient(
    owner_full_name=None,
    coordinator_full_name=None,
    mobile_number=None,
    emirates_id=None,
    address=None,
    person_photo=None,
):
    """Create or get existing Gift Recipient"""
    
    # Validate required fields
    if not owner_full_name or not coordinator_full_name or not mobile_number:
        frappe.throw(_("Owner Full Name, Coordinator Full Name, and Mobile Number are required"))
    
    # Normalize mobile number (remove spaces, dashes, plus signs)
    normalized_mobile = mobile_number.replace(" ", "").replace("-", "").replace("+", "")
    
    # Add country code if not present (UAE: 971)
    if not normalized_mobile.startswith("971") and len(normalized_mobile) == 9:
        normalized_mobile = "971" + normalized_mobile
    
    # Validate UAE mobile number format
    import re
    uae_mobile_pattern = r'^971(50|51|52|54|55|56|58)\d{7}$'
    if not re.match(uae_mobile_pattern, normalized_mobile):
        frappe.throw(_("Please enter a valid UAE mobile number (e.g., 971501234567 or 501234567)"))
    
    # Search for existing recipient by exact match (mobile + names)
    existing_exact_match = frappe.get_list(
        "Gift Recipient",
        filters={
            "coordinator_mobile_no": normalized_mobile,
            "owner_full_name": owner_full_name.strip(),
            "coordinator_full_name": coordinator_full_name.strip()
        },
        fields=["name", "owner_full_name", "coordinator_full_name"],
        limit=1
    )
    
    if existing_exact_match:
        # Return existing recipient if exact match found (mobile + names)
        return existing_exact_match[0].name
    
    # Search for existing recipient by names (secondary check)
    existing_by_names = frappe.get_list(
        "Gift Recipient",
        filters={
            "owner_full_name": owner_full_name.strip(),
            "coordinator_full_name": coordinator_full_name.strip()
        },
        fields=["name", "coordinator_mobile_no"],
        limit=1
    )
    
    if existing_by_names:
        existing = existing_by_names[0]
        # Update mobile number if names match but mobile is different
        recipient_doc = frappe.get_doc("Gift Recipient", existing.name)
        recipient_doc.coordinator_mobile_no = normalized_mobile
        if emirates_id:
            recipient_doc.coordinator_emirates_id = emirates_id.strip()
        if address:
            recipient_doc.address = address.strip()
        if person_photo:
            recipient_doc.person_photo = person_photo
        recipient_doc.save()
        frappe.db.commit()
        return existing.name
    
    # Create new recipient
    recipient_doc = frappe.get_doc({
        "doctype": "Gift Recipient",
        "owner_full_name": owner_full_name.strip(),
        "coordinator_full_name": coordinator_full_name.strip(),
        "coordinator_mobile_no": normalized_mobile,
        "coordinator_emirates_id": emirates_id.strip() if emirates_id else "",
        "address": address.strip() if address else "",
        "person_photo": person_photo if person_photo else ""
    })
    
    recipient_doc.insert()
    frappe.db.commit()
    
    return {
        "success": True,
        "data": {
            "name": recipient_doc.name,
            "owner_full_name": recipient_doc.owner_full_name,
            "coordinator_full_name": recipient_doc.coordinator_full_name,
            "coordinator_mobile_no": recipient_doc.coordinator_mobile_no,
            "coordinator_emirates_id": recipient_doc.coordinator_emirates_id,
            "address": recipient_doc.address,
            "person_photo": recipient_doc.person_photo
        }
    }


@frappe.whitelist(allow_guest=False)
def create_gift_issue_v2(
    gift,
    gift_recipient=None,
    owner_full_name=None,
    coordinator_full_name=None,
    mobile_number=None,
    emirates_id=None,
    person_photo=None,
    date=None,
    address=None,
    documents=None,
):
    """Create new gift issue with Gift Recipient support and legacy compatibility"""
    try:
        # Validate required fields
        if not gift:
            frappe.throw(_("Gift is required"))
        
        # If gift_recipient is provided, use it
        if gift_recipient:
            recipient_doc = frappe.get_doc("Gift Recipient", gift_recipient)
            owner_full_name = recipient_doc.owner_full_name
            coordinator_full_name = recipient_doc.coordinator_full_name
            mobile_number = recipient_doc.coordinator_mobile_no
            emirates_id = recipient_doc.coordinator_emirates_id
            address = recipient_doc.address
            person_photo = recipient_doc.person_photo
        else:
            # Create or find recipient
            gift_recipient = create_or_get_recipient(
                owner_full_name=owner_full_name,
                coordinator_full_name=coordinator_full_name,
                mobile_number=mobile_number,
                emirates_id=emirates_id,
                address=address,
                person_photo=person_photo,
            )
            
            # Refresh data from created recipient
            recipient_doc = frappe.get_doc("Gift Recipient", gift_recipient)
            owner_full_name = recipient_doc.owner_full_name
            coordinator_full_name = recipient_doc.coordinator_full_name
            mobile_number = recipient_doc.coordinator_mobile_no
            emirates_id = recipient_doc.coordinator_emirates_id
            address = recipient_doc.address
            person_photo = recipient_doc.person_photo

        # Validate mobile number format (basic validation)
        cleaned_mobile = mobile_number.replace(" ", "").replace("-", "").replace("+", "")
        if not cleaned_mobile.isdigit() or len(cleaned_mobile) < 8:
            frappe.throw(_("Please enter a valid mobile number"))

        # Create new gift issue document
        issue = frappe.new_doc("Gift Issue")
        issue.update({
            "gift": gift,
            "gift_recipient": gift_recipient,
            "date": date or frappe.utils.today(),
        })

        # Add documents if provided
        if documents:
            if isinstance(documents, str):
                import json
                documents = json.loads(documents)

            for doc in documents:
                if doc.get("document_type") and doc.get("document_attachment"):
                    issue.append("documents", {
                        "document_type": doc.get("document_type"),
                        "document_attachment": doc.get("document_attachment"),
                        "description": doc.get("description", ""),
                    })

        issue.insert()
        return {"name": issue.name, "message": _("Gift dispatched successfully")}

    except Exception as e:
        frappe.log_error(
            message=f"Error in create_gift_issue_v2: {str(e)}",
            title="Gift API - Create Gift Issue V2 Error",
        )
        frappe.throw(_("Failed to create gift issue: {0}").format(str(e)))


@frappe.whitelist(allow_guest=False)
def create_gift_interest_v2(
    gift,
    gift_recipient=None,
    owner_full_name=None,
    coordinator_full_name=None,
    mobile_number=None,
    emirates_id=None,
    address=None,
    date=None,
):
    """Create new gift interest with Gift Recipient support"""
    try:
        if not gift:
            frappe.throw(_("Gift is required"))
        
        # If gift_recipient is provided, use it
        if gift_recipient:
            recipient_doc = frappe.get_doc("Gift Recipient", gift_recipient)
            owner_full_name = recipient_doc.owner_full_name
            coordinator_full_name = recipient_doc.coordinator_full_name
            mobile_number = recipient_doc.coordinator_mobile_no
            emirates_id = recipient_doc.coordinator_emirates_id
            address = recipient_doc.address
        else:
            # Create or find recipient
            gift_recipient = create_or_get_recipient(
                owner_full_name=owner_full_name,
                coordinator_full_name=coordinator_full_name,
                mobile_number=mobile_number,
                emirates_id=emirates_id,
                address=address,
            )
            
            # Refresh data from created recipient
            recipient_doc = frappe.get_doc("Gift Recipient", gift_recipient)
            owner_full_name = recipient_doc.owner_full_name
            coordinator_full_name = recipient_doc.coordinator_full_name
            mobile_number = recipient_doc.coordinator_mobile_no
            emirates_id = recipient_doc.coordinator_emirates_id
            address = recipient_doc.address

        # Create gift interest
        interest = frappe.new_doc("Gift Interest")
        interest.update({
            "gift": gift,
            "gift_recipient": gift_recipient,
            "date": date or frappe.utils.today(),
        })

        interest.insert()
        return {"name": interest.name, "message": _("Gift interest created successfully")}

    except Exception as e:
        frappe.log_error(
            message=f"Error in create_gift_interest_v2: {str(e)}",
            title="Gift API - Create Gift Interest V2 Error",
        )
        frappe.throw(_("Failed to create gift interest: {0}").format(str(e)))


def _mask_emirates_id(eid):
    """Return a partially masked Emirates ID. Full ID visible to admins/managers only."""
    if not eid:
        return None
    eid = str(eid)
    return ("***" + eid[-4:]) if len(eid) > 4 else "***"


def _apply_recipient_pii_mask(recipients, user):
    """Mask Emirates ID for Event Coordinators and below."""
    roles = set(frappe.get_roles(user))
    if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
        return recipients
    for r in (recipients or []):
        r["coordinator_emirates_id"] = _mask_emirates_id(r.get("coordinator_emirates_id"))
    return recipients


@frappe.whitelist(allow_guest=False)
def search_recipients(search_term=None, query=None, filters=None):
    """Search for Gift Recipients"""
    try:
        search_filters = {}
        
        if filters:
            search_filters.update(filters)
            
        # Use search_term if provided, fallback to query for backward compatibility
        search_text = search_term or query
        current_user = frappe.session.user
        if search_text:
            # Search in multiple fields with OR condition
            recipients = frappe.db.sql("""
                SELECT name, owner_full_name, coordinator_full_name, 
                       coordinator_mobile_no, coordinator_emirates_id, address
                FROM `tabGift Recipient`
                WHERE (
                    owner_full_name LIKE %(search)s 
                    OR coordinator_full_name LIKE %(search)s 
                    OR coordinator_mobile_no LIKE %(search)s 
                    OR IFNULL(coordinator_emirates_id, '') LIKE %(search)s
                )
                ORDER BY creation DESC
                LIMIT 10
            """, {
                "search": f"%{search_text}%"
            }, as_dict=True)
            recipients = _apply_recipient_pii_mask(recipients, current_user)
            return {
                "success": True,
                "data": recipients
            }
        else:
            # Return recent recipients if no search term
            recipients = frappe.get_list(
                "Gift Recipient",
                filters=search_filters,
                fields=[
                    "name",
                    "owner_full_name",
                    "coordinator_full_name",
                    "coordinator_mobile_no",
                    "coordinator_emirates_id",
                    "address"
                ],
                limit=10,
                order_by="creation desc"
            )
            recipients = _apply_recipient_pii_mask(recipients, current_user)
            return {
                "success": True,
                "data": recipients
            }
        
    except Exception as e:
        frappe.log_error(
            message=frappe.get_traceback(),
            title="Gift API V2 - Search Recipients Error",
        )
        return {
            "success": False,
            "error": str(e)
        }