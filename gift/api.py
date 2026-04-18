# -*- coding: utf-8 -*-
# Copyright (c) 2026, Gift Management
# API methods for Gift app

import frappe
from frappe import _
from frappe.utils.oauth import get_oauth2_authorize_url
from gift.gift.event_permissions import has_event_access


# ---------------------------------------------------------------------------
# DocType allowlists for generic schema / link-option endpoints.
# Only app-owned DocTypes are permitted — prevents enumeration of system tables.
# ---------------------------------------------------------------------------
_ALLOWED_LINK_DOCTYPES = frozenset({
    "User",
    "Gift", "Gift Category", "Gift Event", "Gift Recipient",
    "Gift Issue", "Gift Interest", "Gift Dispatch", "Gift Received",
    "Gift Maintenance", "Entity Master", "Warehouse",
})

_ALLOWED_SCHEMA_DOCTYPES = frozenset({
    "Gift", "Gift Category", "Gift Category Details",
    "Gift Event", "Gift Recipient",
    "Gift Issue", "Gift Interest", "Gift Dispatch", "Gift Received",
    "Gift Maintenance", "Gift Store", "Gift Timeline Entry",
    "Gift Event History", "Gift Images", "Gift Details",
    "Gift Issue Documents", "Gift Allocation History",
    "Event Category Selection", "Event Gifts", "Event Participants",
    "Event Team Member", "Entity Master", "Gift Maintenance Medication",
})



@frappe.whitelist(allow_guest=True)
def microsoft_login():
    url = get_oauth2_authorize_url("office_365")
    frappe.local.response["type"] = "redirect"
    frappe.local.response["location"] = url



@frappe.whitelist(allow_guest=False)  
def get_field_options(doctype, fieldname):
    """
    Get select field options for any doctype field
    Returns the options as a list
    """
    try:
        if doctype not in _ALLOWED_SCHEMA_DOCTYPES:
            frappe.throw(_("DocType not permitted"), frappe.PermissionError)
        # Get the doctype meta
        meta = frappe.get_meta(doctype)
        
        # Find the field
        field = meta.get_field(fieldname)
        
        if not field:
            frappe.throw(_("Field {0} not found in {1}").format(fieldname, doctype))
        
        if field.fieldtype not in ['Select', 'Autocomplete']:
            frappe.throw(_("Field {0} is not a Select field").format(fieldname))
        
        # Get options (they're newline-separated in Frappe)
        if field.options:
            options = [opt.strip() for opt in field.options.split('\n') if opt.strip()]
            return options
        
        return []
        
    except Exception as e:
        frappe.log_error(message=str(e), title=f"Get Field Options Error: {doctype}.{fieldname}")
        return []


@frappe.whitelist(allow_guest=False)  # 
def get_doctype_fields(doctype):
    """
    Get all fields metadata for a doctype
    Useful for building dynamic forms
    """
    try:
        if doctype not in _ALLOWED_SCHEMA_DOCTYPES:
            frappe.throw(_("DocType not permitted"), frappe.PermissionError)
        meta = frappe.get_meta(doctype)
        
        fields = []
        for field in meta.fields:
            if field.fieldtype in ['Section Break', 'Column Break', 'Tab Break', 'HTML']:
                continue
            
            field_data = {
                'fieldname': field.fieldname,
                'fieldtype': field.fieldtype,
                'label': field.label,
                'reqd': field.reqd,
                'read_only': field.read_only,
                'hidden': field.hidden,
                'default': field.default,
            }
            
            # Add options for Select/Link fields
            if field.fieldtype == 'Select' and field.options:
                field_data['options'] = [opt.strip() for opt in field.options.split('\n') if opt.strip()]
            elif field.fieldtype == 'Link':
                field_data['link_doctype'] = field.options
            
            fields.append(field_data)
        
        return fields
        
    except Exception as e:
        frappe.log_error(message=str(e), title=f"Get DocType Fields Error: {doctype}")
        return []


@frappe.whitelist(allow_guest=False)  # ✅ ADDED
def get_multiple_field_options(doctype, fields):
    """
    Get options for multiple fields at once
    Args:
        doctype: DocType name
        fields: JSON array of field names
    Returns:
        Dict with fieldname as key and options array as value
    """
    try:
        import json
        if isinstance(fields, str):
            fields = json.loads(fields)
        if doctype not in _ALLOWED_SCHEMA_DOCTYPES:
            frappe.throw(_("DocType not permitted"), frappe.PermissionError)
        meta = frappe.get_meta(doctype)
        result = {}
        
        for fieldname in fields:
            field = meta.get_field(fieldname)
            if field and field.fieldtype == 'Select' and field.options:
                result[fieldname] = [opt.strip() for opt in field.options.split('\n') if opt.strip()]
            else:
                result[fieldname] = []
        
        return result
        
    except Exception as e:
        frappe.log_error(message=str(e), title=f"Get Multiple Field Options Error: {doctype}")
        return {}


@frappe.whitelist(allow_guest=False)  # ✅ ADDED
def get_link_options(doctype, txt='', filters=None, limit=20):
    """
    Get options for Link fields (autocomplete)
    Used for searching linked doctypes
    """
    try:
        import json
        if isinstance(filters, str):
            filters = json.loads(filters) if filters else {}
        if doctype not in _ALLOWED_LINK_DOCTYPES:
            frappe.throw(_("DocType not permitted"), frappe.PermissionError)
        limit = min(int(limit or 20), 100)
        # Build search filters
        or_filters = []
        if txt:
            # Search in name field
            or_filters.append(['name', 'like', f'%{txt}%'])
            
            # Try to find title field and search there too
            meta = frappe.get_meta(doctype)
            if meta.title_field:
                or_filters.append([meta.title_field, 'like', f'%{txt}%'])
        
        # Fetch records
        records = frappe.get_all(
            doctype,
            filters=filters,
            or_filters=or_filters if or_filters else None,
            fields=['name', 'owner', 'creation'],
            limit=limit,
            order_by='modified desc'
        )
        
        # Format for autocomplete
        results = []
        for rec in records:
            results.append({
                'value': rec.name,
                'description': rec.name
            })
        
        return results
        
    except Exception as e:
        frappe.log_error(message=str(e), title=f"Get Link Options Error: {doctype}")
        return []


@frappe.whitelist(allow_guest=False)  # ✅ ADDED
def get_warehouses(txt=''):
    """
    Get list of warehouses for autocomplete
    """
    try:
        if not frappe.db.exists("DocType", "Warehouse"):
            return []

        filters = {}
        or_filters = []
        
        if txt:
            or_filters = [
                ['name', 'like', f'%{txt}%'],
                ['warehouse_name', 'like', f'%{txt}%']
            ]
        
        warehouses = frappe.get_all(
            'Warehouse',
            filters=filters,
            or_filters=or_filters if or_filters else None,
            fields=['name', 'warehouse_name', 'is_group'],
            limit=50,
            order_by='name asc'
        )
        
        return warehouses
        
    except Exception as e:
        frappe.log_error(message=str(e), title="Get Warehouses Error")
        return []


@frappe.whitelist(allow_guest=False)  # ✅ ADDED
def get_gift_categories(category_type=None):
    """
    Get gift categories with optional filter by type
    """
    try:
        filters = {}
        if category_type:
            filters['category_type'] = category_type
        
        categories = frappe.get_all(
            'Gift Category',
            filters=filters,
            fields=['name', 'category_name', 'category_type'],
            order_by='category_name asc'
        )
        
        return categories
        
    except Exception as e:
        frappe.log_error(message=str(e), title="Get Gift Categories Error")
        return []


@frappe.whitelist(allow_guest=False)  # ✅ ADDED
def get_category_attributes(category):
    """
    Get attributes (Gift Category Details) for a specific category
    Returns list of attributes with their settings
    """
    try:
        if not category:
            return []
        
        category_doc = frappe.get_doc('Gift Category', category)
        
        attributes = []
        if hasattr(category_doc, 'category_attributes'):
            for attr in category_doc.category_attributes:
                attributes.append({
                    'attribute_label': attr.attribute_label,
                    'attribute_type': attr.attribute_type,
                    'is_mandatory': attr.is_mandatory,
                    'options': attr.options if hasattr(attr, 'options') else None
                })
        
        return attributes
        
    except Exception as e:
        frappe.log_error(message=str(e), title=f"Get Category Attributes Error: {category}")
        return []


@frappe.whitelist(allow_guest=False)
def remove_gift_from_event(gift, event):
    """Remove a gift from an event by clearing its event field.
    
    This properly syncs gift removal by:
    1. Clearing gift's event field
    2. Removing gift from event's child table
    3. Adding history record
    4. Final verification
    """
    user = frappe.session.user
    if not has_event_access(event, user):
        frappe.throw(_("You do not have access to this event"), frappe.PermissionError)
    try:
        # Debug logging
        frappe.logger().info(f"remove_gift_from_event called with gift={gift}, event={event}")
        
        # Get the gift document
        gift_doc = frappe.get_doc('Gift', gift)
        
        # Debug: Log gift status
        frappe.logger().info(f"Gift {gift} status: {gift_doc.status}")
        
        # IMPORTANT: Check if gift is delivered - delivered gifts cannot be unassigned
        if gift_doc.status == 'Delivered':
            error_msg = _("Cannot unassign delivered gifts from events. Gift status: {0}").format(gift_doc.status)
            frappe.logger().error(f"Blocking unassignment: {error_msg}")
            frappe.throw(error_msg)
        
        frappe.logger().info(f"Before removal - Gift {gift} current event: {gift_doc.event}, event_name: {gift_doc.event_name}")
        
        # Check if gift is assigned to any event (not necessarily the specific event)
        # This allows unassignment from event detail page even if gift was moved to different event
        if not gift_doc.event:
            # If gift is not assigned to any event, just try to remove it from the specified event's child table
            pass
        else:
            # Remove gift from the specified event's child table
            try:
                event_doc = frappe.get_doc('Gift Event', event)
                original_count = len(event_doc.event_gifts or [])
                
                # Remove from child table
                event_doc.event_gifts = [
                    eg for eg in event_doc.event_gifts or [] 
                    if eg.gift != gift
                ]
                
                new_count = len(event_doc.event_gifts or [])
                
                # Only save if something was actually removed
                if new_count < original_count:
                    event_doc.save(ignore_permissions=True)
                    frappe.logger().info(f"Successfully removed gift {gift} from event {event}. Child table entries: {original_count} -> {new_count}")
                else:
                    frappe.logger().warning(f"Gift {gift} was not found in event {event} child table")
            except Exception:
                frappe.log_error(frappe.get_traceback(), f"Remove Gift: Failed removing from event_gifts for {event}")

        # Add history record for gift unassignment
        try:
            frappe.get_doc({
                "doctype": "Gift Event History",
                "gift": gift,
                "event": event,
                "action": "unassigned",
                "action_date": frappe.utils.now(),
                "remarks": "Gift unassigned from event"
            })
        except Exception:
            frappe.log_error(frappe.get_traceback(), f"Remove Gift: Failed adding unassignment history for {gift}")

        gift_doc.event = None
        gift_doc.event_name = None  # Explicitly clear the event_name field
        
        # Skip timeline logging during event unassignment to avoid duplicate entries
        gift_doc.flags.skip_gift_modified_timeline = True
        
        # Save the gift document
        gift_doc.save()
        
        # Clear the flag after save
        gift_doc.flags.skip_gift_modified_timeline = False
        
        frappe.logger().info(f"Successfully completed unassignment for gift {gift}")
        
        return {
            "gift": gift,
            "event": None,
            "removed_from": event
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Remove Gift from Event Error: {str(e)}")
        frappe.throw(str(e))
