# -*- coding: utf-8 -*-
# Copyright (c) 2026, Gift Management
# API methods for Gift app

import frappe
import json
from frappe import _
import re
from frappe.utils import cint

from gift.gift.event_permissions import get_user_visible_event_names, has_event_access, can_user_approve


# ---------------------------------------------------------------------------
# DocType allowlists for generic schema / link-option endpoints.
# Only app-owned DocTypes are permitted — prevents enumeration of system tables.
# ---------------------------------------------------------------------------
_ALLOWED_LINK_DOCTYPES = frozenset({
	"User",
	"Gift", "Gift Category", "Gift Event", "Gift Recipient",
	"Gift Issue", "Gift Interest", "Gift Dispatch", "Gift Received",
	"Gift Maintenance", "Entity Master", "Warehouse",
	"Country",
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


@frappe.whitelist(allow_guest=False)
def get_user_permission_context():
	"""
	Get current user's permission context including roles and assigned events.
	Used by frontend to determine visibility and approval permissions.
	"""
	user = frappe.session.user
	roles = set(frappe.get_roles(user))

	is_admin = user in {"Administrator"} or "System Manager" in roles
	is_event_manager = "Event Manager" in roles
	
	# Get assigned events (for coordinators and event managers assigned to specific events)
	assigned_events = get_user_visible_event_names(user)
	
	# Event Manager has global visibility
	has_global_visibility = is_admin or is_event_manager
	
	return {
		"user": user,
		"roles": roles,
		"is_admin": is_admin,
		"is_event_manager": is_event_manager,
		"assigned_events": assigned_events,
		"has_global_visibility": has_global_visibility,
	}



def _validate_sql_identifier(value: str, label: str) -> str:
	if not value or not isinstance(value, str):
		raise frappe.ValidationError(_("Invalid {0}").format(label))
	# Only allow simple identifiers (no spaces, commas, quotes, operators)
	if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", value):
		raise frappe.ValidationError(_("Invalid {0}").format(label))
	return value


def _sanitize_order_by(order_by: str) -> str:
	# Accept: "field", "field asc", "field desc"
	if not order_by:
		return "creation desc"
	parts = [p for p in (order_by or "").strip().split() if p]
	if not parts:
		return "creation desc"
	field = _validate_sql_identifier(parts[0], "order_by")
	direction = "desc"
	if len(parts) > 1:
		dir_raw = parts[1].lower()
		if dir_raw in {"asc", "desc"}:
			direction = dir_raw
	return f"`{field}` {direction}"


def _gift_interest_has_soft_delete_column() -> bool:
	try:
		interest_cols = set(frappe.db.get_table_columns("tabGift Interest") or [])
	except Exception:
		interest_cols = set()
	return "is_deleted" in interest_cols


def _gift_interest_active_filters(base_filters=None):
	filters = dict(base_filters or {})
	if _gift_interest_has_soft_delete_column():
		filters["is_deleted"] = 0
	return filters


@frappe.whitelist(allow_guest=False)  # 
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


@frappe.whitelist(allow_guest=False)  # 
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


@frappe.whitelist(allow_guest=False)  # 
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
        limit = min(int(limit or 20), 300 if doctype == "Country" else 100)
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
        user_fields = None
        if doctype == "User":
            user_fields = ["name", "full_name", "email"]

        records = frappe.get_all(
            doctype,
            filters=filters,
            or_filters=or_filters if or_filters else None,
            fields=user_fields or ['name', 'owner', 'creation'],
            limit=limit,
            order_by='name asc' if doctype == 'Country' else 'modified desc'
        )
        
        # Format for autocomplete
        results = []
        for rec in records:
            if doctype == "User":
                results.append({
                    "value": rec.name,
                    "label": rec.full_name or rec.name,
                    "description": rec.email or rec.name,
                })
                continue
            results.append({
                'value': rec.name,
                'description': rec.name
            })
        
        return results
        
    except Exception as e:
        frappe.log_error(message=str(e), title=f"Get Link Options Error: {doctype}")
        return []


@frappe.whitelist(allow_guest=False)  # 
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


@frappe.whitelist(allow_guest=False)  # 
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


@frappe.whitelist(allow_guest=False)
def get_category_attributes(category):
    """
    Get attributes for a category (for gift creation forms)
    Returns attributes with newline-separated select options (Frappe format)
    """
    try:
        if not category:
            return []
        
        if not frappe.db.exists('Gift Category', category):
            return []
        
        category_doc = frappe.get_doc('Gift Category', category)
        attributes = []
        
        if hasattr(category_doc, 'category_attributes'):
            for attr in category_doc.category_attributes:
                attributes.append({
                    'attribute_name': attr.attribute_name,
                    'attribute_type': attr.attribute_type if hasattr(attr, 'attribute_type') else 'Text',
                    'is_mandatory': attr.is_mandatory if hasattr(attr, 'is_mandatory') else 0,
                    'select_options': attr.select_options if hasattr(attr, 'select_options') else '',  
                    'display_order': attr.display_order if hasattr(attr, 'display_order') else 0,  
                })
        
        return attributes
        
    except Exception as e:
        frappe.log_error(message=str(e), title=f"Get Category Attributes Error: {category}")
        return []


@frappe.whitelist(allow_guest=False)
def get_categories_with_comma_options():
    """
    Special API for category management page only
    Returns select_options in comma-separated format for editing
    """
    user = frappe.session.user
    roles = set(frappe.get_roles(user))

    if user not in {"Administrator"} and "System Manager" not in roles and "Event Manager" not in roles:
        frappe.throw(_("You do not have permission to access categories"))

    try:
        categories = frappe.get_all(
            'Gift Category',
            fields=['name', 'category_name', 'category_type', 'description', 'requires_maintenance'],
            order_by='category_name asc'
        )
        
        for category in categories:
            # Get child table attributes
            attrs = frappe.get_all(
                'Gift Category Details',
                filters={'parent': category['name']},
                fields=['name', 'attribute_name', 'attribute_type', 'is_mandatory', 'select_options', 'display_order', 'idx'],
                order_by='idx asc'
            )
            
            # Convert newline to comma ONLY for this API
            for attr in attrs:
                if attr.get('select_options'):
                    # Convert "Gold\nSilver" to "Gold, Silver"
                    attr['select_options'] = attr['select_options'].replace('\n', ', ')
                else:
                    attr['select_options'] = ''
            
            category['category_attributes'] = attrs
        
        return categories
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), 'Get Categories With Comma Options Error')
        return []


@frappe.whitelist(allow_guest=False)
def save_category_with_comma_options(category_data):
    """
    Special API for category management page only
    Accepts comma-separated options, converts to newline for storage
    """
    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    if user not in {"Administrator"} and "System Manager" not in roles and "Event Manager" not in roles:
        frappe.throw(_("You do not have permission to manage categories"))

    try:
        import json
        
        if isinstance(category_data, str):
            category_data = json.loads(category_data)
        
        # For updates, 'name' contains the original document name
        original_name = category_data.get('name')
        new_category_name = category_data.get('category_name')
        
        if original_name and frappe.db.exists('Gift Category', original_name):
            doc = frappe.get_doc('Gift Category', original_name)
        else:
            doc = frappe.new_doc('Gift Category')
        
        # Update main fields
        doc.category_name = new_category_name
        doc.category_type = category_data.get('category_type')
        doc.description = category_data.get('description', '')
        doc.requires_maintenance = int(category_data.get('requires_maintenance', 0))
        
        # Clear and rebuild child table
        doc.category_attributes = []
        
        attributes = category_data.get('category_attributes', [])
        
        for idx, attr in enumerate(attributes):
            select_options = attr.get('select_options', '').strip()
            
            # Convert comma to newline for Frappe storage
            if select_options and ',' in select_options:
                options_list = [opt.strip() for opt in select_options.split(',') if opt.strip()]
                select_options = '\n'.join(options_list)
            
            doc.append('category_attributes', {
                'attribute_name': attr.get('attribute_name'),
                'attribute_type': attr.get('attribute_type', 'Text'),
                'is_mandatory': int(attr.get('is_mandatory', 0)),
                'select_options': select_options,
                'display_order': int(attr.get('display_order', idx))
            })
        
        if doc.is_new():
            doc.insert()
        else:
            # Handle name change if category_name is different from current name
            # and the name is actually different (not just category_name field)
            if original_name and new_category_name and original_name != new_category_name:
                try:
                    # Only attempt rename if the document name differs from the new category name
                    # and the new name doesn't already exist
                    if not frappe.db.exists('Gift Category', new_category_name):
                        # Rename first, then wait a moment for it to complete
                        doc.rename(new_category_name)
                        frappe.db.commit()
                        
                        # Add small delay to ensure rename operation is fully processed
                        import time
                        time.sleep(0.2)  # 200ms delay
                        
                        # Refresh the document after rename to get the updated reference
                        doc = frappe.get_doc('Gift Category', new_category_name)
                        
                        # Now update all fields on the refreshed document
                        doc.category_name = new_category_name
                        doc.category_type = category_data.get('category_type')
                        doc.description = category_data.get('description', '')
                        doc.requires_maintenance = int(category_data.get('requires_maintenance', 0))
                        
                        # Clear and rebuild child table
                        doc.category_attributes = []
                        
                        attributes = category_data.get('category_attributes', [])
                        
                        for idx, attr in enumerate(attributes):
                            select_options = attr.get('select_options', '').strip()
                            
                            # Convert comma to newline for Frappe storage
                            if select_options and ',' in select_options:
                                options_list = [opt.strip() for opt in select_options.split(',') if opt.strip()]
                                select_options = '\n'.join(options_list)
                            
                            doc.append('category_attributes', {
                                'attribute_name': attr.get('attribute_name'),
                                'attribute_type': attr.get('attribute_type', 'Text'),
                                'is_mandatory': int(attr.get('is_mandatory', 0)),
                                'select_options': select_options,
                                'display_order': int(attr.get('display_order', idx))
                            })
                        
                        # Save the refreshed document with all data
                        doc.save()
                    else:
                        # If new name already exists, just save the data without renaming
                        doc.save()
                except Exception as rename_error:
                    # Rename is not critical - the category_name field is already updated
                    # Log the error but don't fail the entire operation
                    frappe.log_error(frappe.get_traceback(), f'Category rename failed for {doc.name}: {str(rename_error)}')
                    # Save the data even if rename failed
                    doc.save()
            else:
                # No name change, just save the data
                doc.save()
        
        frappe.db.commit()
        
        # Return with comma format
        result = doc.as_dict()
        if result.get('category_attributes'):
            for attr in result['category_attributes']:
                if attr.get('select_options'):
                    attr['select_options'] = attr['select_options'].replace('\n', ', ')
                else:
                    attr['select_options'] = ''
        
        return result
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), 'Save Category With Comma Options Error')
        frappe.db.rollback()
        frappe.throw(str(e))
        
@frappe.whitelist(allow_guest=False)
def get_gifts_paginated(filters=None, page=1, limit=20):
    """
    Get gifts with proper pagination and total count
    """
    import json
    
    filters_dict = json.loads(filters) if filters else {}
    page = int(page)
    limit = int(limit)

    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global_visibility = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )

    allowed_events = None
    if not has_global_visibility:
        allowed_events = get_user_visible_event_names(user)
        if not allowed_events:
            return {
                "gifts": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "total_pages": 0,
            }

    # Build filter conditions
    conditions = []
    values = {}

    if allowed_events is not None:
        conditions.append("event in %(allowed_events)s")
        values["allowed_events"] = tuple(allowed_events)

    if filters_dict.get('status') and filters_dict['status'] != 'all':
        conditions.append("status = %(status)s")
        values['status'] = filters_dict['status']
    
    if filters_dict.get('category') and filters_dict['category'] != 'all':
        conditions.append("category = %(category)s")
        values['category'] = filters_dict['category']
    
    # Search across multiple fields
    if filters_dict.get('search'):
        search_term = f"%{filters_dict['search']}%"
        conditions.append("""(
            gift_name LIKE %(search)s OR 
            gift_id LIKE %(search)s OR 
            barcode_value LIKE %(search)s OR 
            qr_code_value LIKE %(search)s
        )""")
        values['search'] = search_term
    
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    
    # Get total count
    total_count = frappe.db.sql(f"""
        SELECT COUNT(*) as count
        FROM `tabGift`
        {where_clause}
    """, values, as_dict=True)[0]['count']
    
    # Get paginated data
    limit_start = (page - 1) * limit
    
    gifts = frappe.db.sql(f"""
        SELECT name, gift_name, gift_id, event, event_name, quantity, description,
               category, status, barcode, barcode_value, received_datetime,
               received_by_name, received_by_contact, qr_code_enabled, qr_code_value,
               qr_code_image, scan_count, donor, uae_ring_number, warehouse,
               storage_location, current_location_type, creation, modified, owner
        FROM `tabGift`
        {where_clause}
        ORDER BY creation DESC
        LIMIT %(limit_start)s, %(limit)s
    """, {**values, "limit_start": limit_start, "limit": limit}, as_dict=True)
    
    return {
        "gifts": gifts,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }
    
def paginate_query(doctype, filters=None, search_fields=None, search_term=None, page=1, limit=20, order_by='creation desc'):
    """
    Generic pagination helper for all list APIs
    
    Args:
        doctype: DocType name
        filters: Dict of field filters
        search_fields: List of fields to search in
        search_term: Search query string
        page: Page number (1-indexed)
        limit: Items per page
        order_by: Sort order
    
    Returns:
        Dict with items, total, page, limit, total_pages
    """
    page = int(page)
    limit = int(limit)
    
    # Validate doctype and order_by
    doctype = _validate_sql_identifier(doctype, "doctype")
    order_by = _sanitize_order_by(order_by)
    
    # Build filter conditions
    conditions = []
    values = {}
    
    # Apply standard filters
    if filters:
        for key, value in filters.items():
            if value:
                _validate_sql_identifier(key, "filter")
                conditions.append(f"`{key}` = %({key})s")
                values[key] = value
    
    # Apply search across multiple fields
    if search_term and search_fields:
        search_pattern = f"%{search_term.strip()}%"
        for field in search_fields:
            _validate_sql_identifier(field, "search_field")
        search_conditions = " OR ".join([f"`{field}` LIKE %(search)s" for field in search_fields])
        conditions.append(f"({search_conditions})")
        values['search'] = search_pattern
    
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    
    # Get total count
    total_count_result = frappe.db.sql(f"""
        SELECT COUNT(*) as count
        FROM `tab{doctype}`
        {where_clause}
    """, values, as_dict=True)
    
    total_count = total_count_result[0]['count'] if total_count_result else 0
    
    # Get paginated data
    limit_start = (page - 1) * limit
    
    items = frappe.db.sql(
        f"""
        SELECT *
        FROM `tab{doctype}`
        {where_clause}
        ORDER BY {order_by}
        LIMIT %(limit_start)s, %(limit)s
        """,
        {**values, "limit_start": limit_start, "limit": limit},
        as_dict=True,
    )
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }


@frappe.whitelist(allow_guest=False)
def get_event_allowed_categories(event):
    if not event:
        frappe.throw(_("Event is required"))

    if not has_event_access(event, frappe.session.user):
        frappe.throw(_("You don't have access to this event"))

    categories = frappe.get_all(
        "Event Category Selection",
        filters={"parenttype": "Gift Event", "parent": event},
        pluck="category",
    )

    return {"event": event, "categories": categories}


@frappe.whitelist(allow_guest=False)
def list_event_gifts_by_allowed_categories(event, search=None, page=1, limit=20):
    """List gifts for an event filtered to categories selected on the event."""
    if not event:
        frappe.throw(_("Event is required"))

    if not has_event_access(event, frappe.session.user):
        frappe.throw(_("You don't have access to this event"))

    categories = frappe.get_all(
        "Event Category Selection",
        filters={"parenttype": "Gift Event", "parent": event},
        pluck="category",
    )

    page = int(page)
    limit = int(limit)
    conditions = ["event = %(event)s"]
    values = {"event": event}

    if categories:
        conditions.append("category in %(categories)s")
        values["categories"] = tuple(categories)

    if search:
        values["search"] = f"%{search}%"
        conditions.append("(gift_name like %(search)s or gift_id like %(search)s or name like %(search)s)")

    where_clause = " AND ".join(conditions)

    total = frappe.db.sql(
        f"SELECT COUNT(*) as count FROM `tabGift` WHERE {where_clause}",
        values,
        as_dict=True,
    )[0]["count"]

    start = (page - 1) * limit
    gifts = frappe.db.sql(
        f"""
        SELECT name, gift_name, gift_id, barcode_value, uae_ring_number, category, status, event
        FROM `tabGift`
        WHERE {where_clause}
        ORDER BY modified desc
        LIMIT %(start)s, %(limit)s
        """,
        {**values, "start": start, "limit": limit},
        as_dict=True,
    )

    return {
        "gifts": gifts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": -(-total // limit) if limit > 0 else 1,
        "categories": categories,
    }


@frappe.whitelist(allow_guest=False)
def list_gifts_by_categories(categories, search=None, page=1, limit=20):
    """List gifts filtered by a provided categories list.

    Used by the event creation wizard before an Event doc exists.
    """
    import json

    if not categories:
        return {"gifts": [], "total": 0, "page": int(page), "limit": int(limit), "total_pages": 0}

    if isinstance(categories, str):
        try:
            categories = json.loads(categories)
        except Exception:
            categories = [c.strip() for c in categories.split(",") if c.strip()]

    categories = [c for c in (categories or []) if c]
    if not categories:
        return {"gifts": [], "total": 0, "page": int(page), "limit": int(limit), "total_pages": 0}

    page = int(page)
    limit = int(limit)

    conditions = ["status = 'Available'"]
    values = {}

    if categories:
        conditions.append("category in %(categories)s")
        values["categories"] = tuple(categories)

    if search:
        values["search"] = f"%{search}%"
        conditions.append("(gift_name like %(search)s or gift_id like %(search)s or name like %(search)s)")

    # If the gift belongs to another event, only show it if that source event is expired.
    # Expired = ends_on < now.
    conditions.append(
        "("
        "IFNULL(event,'') = '' "
        "OR event IN (SELECT name FROM `tabGift Event` WHERE ends_on IS NOT NULL AND ends_on < NOW())"
        ")"
    )

    where_clause = " AND ".join(conditions)

    total = frappe.db.sql(
        f"SELECT COUNT(*) as count FROM `tabGift` WHERE {where_clause}",
        values,
        as_dict=True,
    )[0]["count"]

    start = (page - 1) * limit
    gifts = frappe.db.sql(
        f"""
        SELECT name, gift_name, gift_id, uae_ring_number, category, status, event
        FROM `tabGift`
        WHERE {where_clause}
        ORDER BY modified desc
        LIMIT %(start)s, %(limit)s
        """,
        {**values, "start": start, "limit": limit},
        as_dict=True,
    )

    return {
        "gifts": gifts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": -(-total // limit) if limit > 0 else 1,
        "categories": categories,
    }


@frappe.whitelist(allow_guest=False)
def list_eligible_gifts_for_event(event, search=None, category=None, current_event=None, page=1, limit=20):
    """List available gifts for an event.

    Only shows gifts with status='Available' and either:
    - No event assigned, OR
    - Assigned to an event with status='Completed'
    
    Category filtering is supported - gifts can be filtered by category.
    """
    if not event:
        frappe.throw(_("Event is required"))

    user = frappe.session.user
    if not has_event_access(event, user):
        frappe.throw(_("You don't have access to this event"))

    page = int(page)
    limit = int(limit)
    conditions = ["status = 'Available'"]
    values = {}

    # Only show gifts that are either:
    # 1. Not assigned to any event (event is NULL or empty)
    # 2. Assigned to an event with status='Completed'
    conditions.append(
        "("
        "IFNULL(event,'') = '' "
        "OR event IN (SELECT name FROM `tabGift Event` WHERE status = 'Completed')"
        ")"
    )

    if search:
        values["search"] = f"%{search}%"
        conditions.append("(gift_name like %(search)s or gift_id like %(search)s or name like %(search)s)")

    if category:
        values["category"] = category
        conditions.append("category = %(category)s")

    where_clause = " AND ".join(conditions)

    total = frappe.db.sql(
        f"SELECT COUNT(*) as count FROM `tabGift` WHERE {where_clause}",
        values,
        as_dict=True,
    )[0]["count"]

    start = (page - 1) * limit
    gifts = frappe.db.sql(
        f"""
        SELECT name, gift_name, gift_id, uae_ring_number, category, status, event
        FROM `tabGift`
        WHERE {where_clause}
        ORDER BY modified desc
        LIMIT %(start)s, %(limit)s
        """,
        {**values, "start": start, "limit": limit},
        as_dict=True,
    )

    return {
        "gifts": gifts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": -(-total // limit) if limit > 0 else 1,
    }


@frappe.whitelist(allow_guest=False)
def move_gift_to_event(gift, event, remarks=None):
    """Move (assign) a gift to an event. This is the 'mostly one event, but allow moving' rule."""
    try:
        if not gift or not event:
            frappe.throw(_("Gift and Event are required"))

        # Check if gift exists
        if not frappe.db.exists("Gift", gift):
            frappe.throw(_("Gift {0} does not exist").format(gift))
        
        # Check if event exists
        if not frappe.db.exists("Gift Event", event):
            frappe.throw(_("Event {0} does not exist").format(event))

        user = frappe.session.user
        if user not in {"Administrator"} and not set(frappe.get_roles(user)).intersection(
            {"System Manager", "Event Manager", "Event Coordinator"}
        ):
            frappe.throw(_("You don't have permission to move gifts between events"))

        if not has_event_access(event, user):
            frappe.throw(_("You don't have access to this event"))

        # Draft privacy: coordinators should not move gifts into draft events
        try:
            status = frappe.db.get_value("Gift Event", event, "status")
        except Exception:
            status = None
        if status in {"Draft"}:
            roles = set(frappe.get_roles(user))
            if "Event Coordinator" in roles and "Event Manager" not in roles and "System Manager" not in roles and user != "Administrator":
                frappe.throw(_("Draft event: cannot manage gifts yet"))

        doc = frappe.get_doc("Gift", gift)
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Move Gift Error - Initial checks: {gift} to {event}")
        frappe.throw(str(e))

    source_event = getattr(doc, "event", None)

    # If moving from another event, by default require access to the source event.
    # Exception: Event Managers / System Managers may claim gifts across events.
    if source_event and source_event != event:
        if not has_event_access(source_event, user):
            roles = set(frappe.get_roles(user))
            if user not in {"Administrator"} and "System Manager" not in roles and "Event Manager" not in roles:
                frappe.throw(_("You don't have access to the source event for this gift"))

    if source_event != event:
        try:
            # Get event names for history
            from_event_name = None
            to_event_name = None
            
            if source_event:
                try:
                    from_event_name = frappe.db.get_value("Gift Event", source_event, "subject")
                except Exception:
                    from_event_name = source_event
            
            if event:
                try:
                    to_event_name = frappe.db.get_value("Gift Event", event, "subject")
                except Exception:
                    to_event_name = event
            
            doc.append(
                "gift_event_history",
                {
                    "from_event": source_event,
                    "from_event_name": from_event_name,
                    "to_event": event,
                    "to_event_name": to_event_name,
                    "moved_on": frappe.utils.now(),
                    "moved_by": user,
                    "remarks": remarks,
                },
            )
        except Exception:
            frappe.log_error(frappe.get_traceback(), "Move Gift: Failed appending gift_event_history")

    doc.event = event
    # Skip timeline logging during event move to avoid duplicate entries
    doc.flags.skip_gift_modified_timeline = True
    try:
        doc.save(ignore_permissions=True)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Move Gift: Failed saving Gift with new event")
        raise
    finally:
        # Clear the flag after save
        doc.flags.skip_gift_modified_timeline = False

    # Maintain event gift inventory child table.
    if source_event and source_event != event:
        try:
            src = frappe.get_doc("Gift Event", source_event)
            src.event_gifts = [row for row in (src.event_gifts or []) if row.gift != doc.name]
            src.save(ignore_permissions=True)
        except Exception:
            frappe.log_error(frappe.get_traceback(), "Move Gift: Failed removing from source event_gifts")

    try:
        dest = frappe.get_doc("Gift Event", event)
        exists = any((row.gift == doc.name) for row in (dest.event_gifts or []))
        if not exists:
            dest.append(
                "event_gifts",
                {
                    "gift": doc.name,
                    "doctype": "Event Gifts",
                    "parenttype": "Gift Event",
                    "parentfield": "event_gifts",
                },
            )
            dest.save(ignore_permissions=True)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Move Gift: Failed adding to destination event_gifts")

    return {"gift": doc.name, "event": doc.event}


@frappe.whitelist(allow_guest=False)
def list_all_available_gifts(search=None, category=None, current_event=None, page=1, limit=20):
    """List all gifts with status 'Available' for new event creation.

    Only shows gifts with status='Available' and either:
    - No event assigned, OR
    - Assigned to an event with status='Completed'
    
    Category filtering is supported - gifts can be filtered by category.
    This intentionally does NOT enforce event access checks.
    """
    _user = frappe.session.user
    _roles = set(frappe.get_roles(_user))
    if _user not in {"Administrator"} and "System Manager" not in _roles and "Event Manager" not in _roles:
        frappe.throw(_("You do not have permission to view all available gifts"), frappe.PermissionError)

    page = int(page)
    limit = int(limit)

    conditions = ["status = 'Available'"]
    values = {}

    # Only show gifts that are either:
    # 1. Not assigned to any event (event is NULL or empty)
    # 2. Assigned to an event with status='Completed'
    conditions.append(
        "("
        "IFNULL(event,'') = '' "
        "OR event IN (SELECT name FROM `tabGift Event` WHERE status = 'Completed')"
        ")"
    )

    if search:
        values["search"] = f"%{search}%"
        conditions.append("(gift_name like %(search)s or gift_id like %(search)s or name like %(search)s)")

    if category:
        values["category"] = category
        conditions.append("category = %(category)s")

    where_clause = " AND ".join(conditions)

    total = frappe.db.sql(
        f"SELECT COUNT(*) as count FROM `tabGift` WHERE {where_clause}",
        values,
        as_dict=True,
    )[0]["count"]

    start = (page - 1) * limit
    gifts = frappe.db.sql(
        f"""
        SELECT name, gift_name, gift_id, uae_ring_number, category, status, event
        FROM `tabGift`
        WHERE {where_clause}
        ORDER BY modified desc
        LIMIT %(start)s, %(limit)s
        """,
        {**values, "start": start, "limit": limit},
        as_dict=True,
    )

    return {
        "gifts": gifts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": -(-total // limit) if limit > 0 else 1,
    }


def _ensure_user_role(user: str, role: str) -> None:
    if not user or not role:
        return
    if not frappe.db.exists("User", user):
        return

    try:
        current_roles = set(frappe.get_roles(user))
    except Exception:
        current_roles = set()

    if role in current_roles:
        return

    u = frappe.get_doc("User", user)
    existing = {r.role for r in (u.get("roles") or []) if getattr(r, "role", None)}
    if role in existing:
        return

    u.append("roles", {"doctype": "Has Role", "role": role})
    u.save(ignore_permissions=True)


@frappe.whitelist(allow_guest=False)
def create_event_with_gifts(event_data, gift_names=None, new_gifts=None):
    """Create Gift Event and assign gifts in one atomic operation.

    This prevents errors where gifts are moved before event categories exist.

    Params:
        - event_data: dict/json string of Gift Event fields including child tables
        - gift_names: list/json string of existing Gift names to move to this event
        - new_gifts: list/json string of Gift doc payloads to create and assign to this event
    """

    import json

    if isinstance(event_data, str):
        event_data = json.loads(event_data)

    if isinstance(gift_names, str):
        gift_names = json.loads(gift_names)

    if isinstance(new_gifts, str):
        new_gifts = json.loads(new_gifts)

    gift_names = [g for g in (gift_names or []) if g]
    new_gifts = new_gifts or []

    # Role guard: only Event Managers and above can create events
    _user = frappe.session.user
    _roles = set(frappe.get_roles(_user))
    if _user not in {"Administrator"} and "System Manager" not in _roles and "Event Manager" not in _roles:
        frappe.throw(_("Only Event Managers can create events"), frappe.PermissionError)

    # Basic validation
    categories = [c for c in (event_data.get("event_categories") or []) if (c or {}).get("category")]

    # If categories are not provided but gifts are being assigned, derive categories automatically
    if not categories and (gift_names or new_gifts):
        derived_categories = set()
        if gift_names:
            for gift_name in gift_names:
                try:
                    cat = frappe.db.get_value("Gift", gift_name, "category")
                    if cat:
                        derived_categories.add(cat)
                except Exception:
                    pass

        if new_gifts:
            for g in new_gifts:
                if isinstance(g, dict) and g.get("category"):
                    derived_categories.add(g.get("category"))

        if derived_categories:
            event_data["event_categories"] = [
                {"doctype": "Event Category Selection", "category": c}
                for c in sorted(derived_categories)
            ]
            categories = [c for c in (event_data.get("event_categories") or []) if (c or {}).get("category")]

    # Categories are optional; do not block gift assignment if the category selection
    # workflow is not being used.

    managers = [m for m in (event_data.get("event_managers") or []) if (m or {}).get("user")]
    if not managers:
        user = frappe.session.user
        if user and user != "Guest":
            managers = [{"user": user}]
            event_data["event_managers"] = managers

    coordinators = [m for m in (event_data.get("event_coordinators") or []) if (m or {}).get("user")]

    created_gifts = []
    moved_gifts = []

    ev = frappe.get_doc({"doctype": "Gift Event", **event_data})
    ev.insert(ignore_permissions=True)

    # Create any new gifts and assign to event
    for g in new_gifts:
        if not isinstance(g, dict):
            continue
        payload = {**g}
        payload["doctype"] = "Gift"
        payload["event"] = ev.name
        if not payload.get("status"):
            payload["status"] = "Available"
        gift_doc = frappe.get_doc(payload)
        gift_doc.insert(ignore_permissions=True)
        created_gifts.append(gift_doc.name)

        # Maintain event gift inventory child table for created gifts too.
        try:
            exists = any((row.gift == gift_doc.name) for row in (ev.event_gifts or []))
            if not exists:
                ev.append(
                    "event_gifts",
                    {
                        "gift": gift_doc.name,
                        "doctype": "Event Gifts",
                        "parenttype": "Gift Event",
                        "parentfield": "event_gifts",
                    },
                )
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                "Create Event With Gifts: Failed adding created gift to event_gifts",
            )

    # Move existing selected gifts to the event
    for gift_name in gift_names:
        try:
            move_gift_to_event(gift=gift_name, event=ev.name)
            moved_gifts.append(gift_name)
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                f"Create Event With Gifts: Failed moving gift {gift_name} -> {ev.name}",
            )
            raise

    # Save any pending event_gifts appends.
    try:
        if getattr(ev, "event_gifts", None):
            ev.save(ignore_permissions=True)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Create Event With Gifts: Failed saving event_gifts")

    return {
        "event": ev.name,
        "created_gifts": created_gifts,
        "moved_gifts": moved_gifts,
        "created_gifts_count": len(created_gifts),
        "moved_gifts_count": len(moved_gifts),
    }


@frappe.whitelist(allow_guest=False)
def add_participant_to_event(event, gift_recipient, attending="Invited"):
    if not event or not gift_recipient:
        frappe.throw(_("Event and Gift Recipient are required"))

    user = frappe.session.user
    if not has_event_access(event, user):
        frappe.throw(_("You don't have access to this event"))

    ev = frappe.get_doc("Gift Event", event)

    recipient = frappe.get_doc("Gift Recipient", gift_recipient)

    existing = [r.get("gift_recipient") for r in (ev.get("event_participants") or [])]
    if gift_recipient in existing:
        try:
            if getattr(recipient, "event", None) != event:
                recipient.event = event
                recipient.save(ignore_permissions=True)
                frappe.db.commit()  # Explicit commit for production environments
        except Exception as e:
            frappe.log_error(
                frappe.get_traceback(),
                f"Add Participant: Failed syncing Gift Recipient.event for existing participant {gift_recipient}",
            )
            frappe.throw(_("Failed to sync guest event assignment: {0}").format(str(e)))
        return {
            "event": event,
            "gift_recipient": gift_recipient,
            "already_participant": 1,
        }

    ev.append(
        "event_participants",
        {
            "gift_recipient": gift_recipient,
            "recipient_name": getattr(recipient, "owner_full_name", None) or recipient.name,
            "coordinator_name": getattr(recipient, "coordinator_full_name", None),
            "contact_number": getattr(recipient, "coordinator_mobile_no", None),
            "attending": attending or "Invited",
        },
    )

    ev.save(ignore_permissions=True)
    frappe.db.commit()  # Explicit commit for production environments

    try:
        if getattr(recipient, "event", None) != event:
            recipient.event = event
            # event_name will auto-fetch from event.subject on save
            recipient.save(ignore_permissions=True)
            frappe.db.commit()  # Explicit commit for production environments
    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(),
            f"Add Participant: Failed syncing Gift Recipient.event for {gift_recipient}",
        )
        frappe.throw(_("Failed to update guest event assignment: {0}").format(str(e)))

    return {"event": event, "gift_recipient": gift_recipient}


@frappe.whitelist(allow_guest=False)
def add_gift_to_event(event, gift, remarks=None):
    if not event or not gift:
        frappe.throw(_("Event and Gift are required"))
    return move_gift_to_event(gift=gift, event=event, remarks=remarks)


def _cancel_issue_for_event_unassignment(issue_doc, reason):
    if not issue_doc:
        return None

    if getattr(issue_doc, "status", None) in {"Cancelled", "Returned"}:
        return issue_doc.gift

    if getattr(issue_doc, "status", None) == "Delivered":
        frappe.throw(
            _("Cannot unassign while a delivered allocation exists for gift {0}").format(issue_doc.gift)
        )

    is_allocation = getattr(issue_doc, "approval_status", None) == "Approved"
    kind = "allocation_removed" if is_allocation else "allocation_request_removed"

    try:
        _insert_gift_timeline_entry(
            gift_name=issue_doc.gift,
            kind=kind,
            doctype="Gift Issue",
            docname=issue_doc.name,
            user=frappe.session.user,
            gift_recipient=issue_doc.gift_recipient,
            notes=(
                _("Allocation removed. Reason: {0}").format(reason)
                if is_allocation
                else _("Allocation request removed")
            ),
        )
    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Cancel Issue For Event Unassignment: Failed timeline update for {issue_doc.gift}",
        )

    issue_doc.status = "Cancelled"
    issue_doc.rejection_reason = reason
    if issue_doc.from_gift_interest and not frappe.db.exists("Gift Interest", issue_doc.from_gift_interest):
        issue_doc.from_gift_interest = None
    issue_doc.flags.skip_timeline_log = True
    issue_doc.flags.ignore_validate = True
    try:
        issue_doc.save(ignore_permissions=True)
    finally:
        issue_doc.flags.skip_timeline_log = False

    if issue_doc.from_gift_interest and frappe.db.exists("Gift Interest", issue_doc.from_gift_interest):
        interest_doc = frappe.get_doc("Gift Interest", issue_doc.from_gift_interest)
        interest_doc.converted_to_issue = None
        interest_doc.conversion_date = None
        interest_doc.follow_up_status = "New"
        interest_doc.approval_status = "Pending"
        interest_doc.approved_by = None
        interest_doc.approved_on = None
        interest_doc.flags.ignore_validate = True
        interest_doc.save(ignore_permissions=True)

    return issue_doc.gift


def _cleanup_event_links_for_gift(event, gift, reason):
    touched_gifts = {gift}

    active_issues = frappe.get_all(
        "Gift Issue",
        filters={
            "event": event,
            "gift": gift,
            "status": ["not in", ["Cancelled", "Returned"]],
        },
        fields=["name"],
    )
    for row in active_issues:
        issue_doc = frappe.get_doc("Gift Issue", row.get("name"))
        touched = _cancel_issue_for_event_unassignment(issue_doc, reason)
        if touched:
            touched_gifts.add(touched)

    active_interests = frappe.get_all(
        "Gift Interest",
        filters=_gift_interest_active_filters({"gift": gift}),
        fields=["name", "gift", "event"],
    )
    for row in active_interests:
        interest_event = row.get("event")
        if interest_event and interest_event != event:
            continue
        remove_gift_interest(row.get("name"))
        if row.get("gift"):
            touched_gifts.add(row.get("gift"))

    return touched_gifts


def _coerce_name_list(values):
    if values is None:
        return []

    if isinstance(values, str):
        parsed = None
        try:
            import json

            parsed = json.loads(values)
        except Exception:
            parsed = None

        if isinstance(parsed, list):
            values = parsed
        else:
            values = [v.strip() for v in values.split(",") if v and v.strip()]

    if not isinstance(values, (list, tuple, set)):
        values = [values]

    out = []
    for val in values:
        sval = str(val or "").strip()
        if not sval:
            continue
        out.append(sval)
    return out


def _insert_gift_timeline_entry(
    gift_name,
    kind,
    doctype=None,
    docname=None,
    user=None,
    gift_recipient=None,
    guest_full_name=None,
    notes=None,
    changes=None,
):
    user = user or frappe.session.user

    user_full_name = user
    if user:
        try:
            user_full_name = frappe.db.get_value("User", user, "full_name") or user
        except Exception:
            user_full_name = user

    if not guest_full_name and gift_recipient:
        try:
            recipient = frappe.db.get_value(
                "Gift Recipient",
                gift_recipient,
                ["owner_full_name", "guest_first_name", "guest_last_name"],
                as_dict=True,
            )
            if recipient:
                first = (recipient.get("guest_first_name") or "").strip()
                last = (recipient.get("guest_last_name") or "").strip()
                guest_full_name = (
                    recipient.get("owner_full_name")
                    or " ".join(part for part in [first, last] if part)
                    or gift_recipient
                )
        except Exception:
            guest_full_name = gift_recipient

    payload = {
        "kind": kind,
        "doctype": doctype or "Gift",
        "docname": docname or gift_name,
        "user": user,
        "user_full_name": user_full_name,
        "gift_recipient": gift_recipient,
        "guest_full_name": guest_full_name,
        "notes": notes,
    }
    if kind == "gift_modified" and isinstance(changes, list):
        payload["changes"] = changes

    content = json.dumps(payload, default=str)
    row_payload = {
        "doctype": "Gift Timeline Entry",
        "parent": gift_name,
        "parenttype": "Gift",
        "parentfield": "timeline_history",
        "kind": payload.get("kind"),
        "timestamp": frappe.utils.now_datetime(),
        "entry_doctype": payload.get("doctype"),
        "entry_docname": payload.get("docname"),
        "user": payload.get("user"),
        "user_full_name": payload.get("user_full_name"),
        "gift_recipient": payload.get("gift_recipient"),
        "guest_full_name": payload.get("guest_full_name"),
        "notes": payload.get("notes"),
        "details_json": content,
    }

    try:
        timeline_row = frappe.get_doc(row_payload)
        timeline_row.insert(ignore_permissions=True)
    except Exception:
        try:
            fallback_payload = dict(row_payload)
            fallback_payload["user"] = None
            fallback_payload["gift_recipient"] = None
            timeline_row = frappe.get_doc(fallback_payload)
            timeline_row.insert(ignore_permissions=True, ignore_links=True)
        except Exception:
            row_name = frappe.generate_hash(length=10)
            now_ts = frappe.utils.now_datetime()
            frappe.db.sql(
                """
                INSERT INTO `tabGift Timeline Entry`
                (
                    `name`, `creation`, `modified`, `modified_by`, `owner`, `docstatus`, `idx`,
                    `parent`, `parenttype`, `parentfield`,
                    `kind`, `timestamp`, `entry_doctype`, `entry_docname`,
                    `user`, `user_full_name`, `gift_recipient`, `guest_full_name`, `notes`, `details_json`
                )
                VALUES
                (
                    %(name)s, %(now)s, %(now)s, %(modified_by)s, %(owner)s, 0, 0,
                    %(parent)s, %(parenttype)s, %(parentfield)s,
                    %(kind)s, %(timestamp)s, %(entry_doctype)s, %(entry_docname)s,
                    %(user)s, %(user_full_name)s, %(gift_recipient)s, %(guest_full_name)s, %(notes)s, %(details_json)s
                )
                """,
                {
                    "name": row_name,
                    "now": now_ts,
                    "modified_by": frappe.session.user,
                    "owner": frappe.session.user,
                    "parent": gift_name,
                    "parenttype": "Gift",
                    "parentfield": "timeline_history",
                    "kind": row_payload.get("kind"),
                    "timestamp": row_payload.get("timestamp"),
                    "entry_doctype": row_payload.get("entry_doctype"),
                    "entry_docname": row_payload.get("entry_docname"),
                    "user": row_payload.get("user"),
                    "user_full_name": row_payload.get("user_full_name"),
                    "gift_recipient": row_payload.get("gift_recipient"),
                    "guest_full_name": row_payload.get("guest_full_name"),
                    "notes": row_payload.get("notes"),
                    "details_json": row_payload.get("details_json"),
                },
            )


def _cleanup_event_links_for_recipient(event, gift_recipient, reason):
    touched_gifts = set()

    active_issues = frappe.get_all(
        "Gift Issue",
        filters={
            "event": event,
            "gift_recipient": gift_recipient,
            "status": ["not in", ["Cancelled", "Returned"]],
        },
        fields=["name"],
    )
    for row in active_issues:
        issue_doc = frappe.get_doc("Gift Issue", row.get("name"))
        touched = _cancel_issue_for_event_unassignment(issue_doc, reason)
        if touched:
            touched_gifts.add(touched)

    active_interests = frappe.get_all(
        "Gift Interest",
        filters=_gift_interest_active_filters({"event": event, "gift_recipient": gift_recipient}),
        fields=["name", "gift"],
    )
    for row in active_interests:
        remove_gift_interest(row.get("name"))
        if row.get("gift"):
            touched_gifts.add(row.get("gift"))

    return touched_gifts


@frappe.whitelist(allow_guest=False)
def remove_participant_from_event(event, gift_recipient):
    if not event or not gift_recipient:
        frappe.throw(_("Event and Gift Recipient are required"))

    if not frappe.db.exists("Gift Event", event):
        frappe.throw(_("Event {0} does not exist").format(event))

    if not frappe.db.exists("Gift Recipient", gift_recipient):
        frappe.throw(_("Gift Recipient {0} does not exist").format(gift_recipient))

    user = frappe.session.user
    if not has_event_access(event, user):
        frappe.throw(_("You don't have access to this event"))

    event_doc = frappe.get_doc("Gift Event", event)
    existing = [r.get("gift_recipient") for r in (event_doc.get("event_participants") or [])]
    if gift_recipient not in existing:
        frappe.throw(_("This recipient is not a participant of this event"))

    touched_gifts = _cleanup_event_links_for_recipient(
        event=event,
        gift_recipient=gift_recipient,
        reason=_("Guest unassigned from event"),
    )

    try:
        current_event = frappe.db.get_value("Gift Recipient", gift_recipient, "event")
        if current_event == event:
            frappe.db.set_value(
                "Gift Recipient",
                gift_recipient,
                {
                    "event": None,
                    "event_name": None,
                },
                update_modified=True,
            )
            frappe.db.commit()  # Explicit commit for production environments

            # Verify the update persisted
            persisted_event = frappe.db.get_value("Gift Recipient", gift_recipient, "event")
            if persisted_event is not None:
                frappe.logger().warning(
                    f"Remove Participant: Gift Recipient {gift_recipient} event field not cleared after save"
                )
    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(),
            f"Remove Participant: Failed clearing Gift Recipient.event for {gift_recipient}",
        )
        # Re-raise critical errors so caller knows the operation failed
        frappe.throw(_("Failed to update guest record: {0}").format(str(e)))

    try:
        event_doc.event_participants = [
            row
            for row in (event_doc.event_participants or [])
            if row.gift_recipient != gift_recipient
        ]
        event_doc.save(ignore_permissions=True)
        frappe.db.commit()  # Explicit commit for production environments
    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(),
            f"Remove Participant: Failed removing from event_participants for {event}",
        )
        # Re-raise so the caller knows the operation failed
        frappe.throw(_("Failed to update event participants: {0}").format(str(e)))

    for gift_name in touched_gifts:
        _recompute_gift_status_from_issues(gift_name)

    return {"event": event, "gift_recipient": gift_recipient, "removed_from": event}


@frappe.whitelist(allow_guest=False)
def remove_participants_from_event(event, gift_recipients):
    if not event:
        frappe.throw(_("Event is required"))

    recipient_names = _coerce_name_list(gift_recipients)
    if not recipient_names:
        frappe.throw(_("At least one gift recipient is required"))

    removed = []
    failed = []

    for recipient_name in recipient_names:
        try:
            remove_participant_from_event(event=event, gift_recipient=recipient_name)
            removed.append(recipient_name)
        except Exception as e:
            failed.append({"gift_recipient": recipient_name, "error": str(e)})

    return {
        "event": event,
        "requested": len(recipient_names),
        "removed": removed,
        "failed": failed,
        "success": len(failed) == 0,
    }


@frappe.whitelist(allow_guest=False)
def remove_gift_from_event(gift, event):
    """Remove a gift from an event by clearing its event field.
    
    This properly syncs the gift removal by:
    1. Clearing the gift's event field
    2. Clearing the gift's event_name field  
    3. Removing the gift from the event's event_gifts child table
    4. Adding a history record for the unassignment
    """
    if not gift or not event:
        frappe.throw(_("Gift and Event are required"))

    if not frappe.db.exists("Gift", gift):
        frappe.throw(_("Gift {0} does not exist").format(gift))
    
    if not frappe.db.exists("Gift Event", event):
        frappe.throw(_("Event {0} does not exist").format(event))

    user = frappe.session.user
    if not has_event_access(event, user):
        frappe.throw(_("You don't have access to this event"))

    gift_state = frappe.db.get_value(
        "Gift",
        gift,
        ["status", "event", "event_name"],
        as_dict=True,
    ) or {}

    if gift_state.get("status") == "Delivered":
        frappe.throw(_("Cannot unassign delivered gifts from events"))
    
    # Debug: Log current state
    frappe.logger().info(
        f"Before removal - Gift {gift} current event: {gift_state.get('event')}, event_name: {gift_state.get('event_name')}"
    )
    
    # Check if gift is assigned to any event (not necessarily the specific event)
    # This allows unassignment from event detail page even if gift was moved to different event
    if not gift_state.get("event"):
        # If gift is not assigned to any event, just try to remove it from the specified event's child table
        pass
    elif gift_state.get("event") != event:
        # If gift is assigned to a different event, skip it but don't throw error
        return {"gift": gift, "event": None, "skipped": f"Gift {gift} is assigned to a different event"}

    touched_gifts = _cleanup_event_links_for_gift(
        event=event,
        gift=gift,
        reason=_("Gift unassigned from event"),
    )

    # Add history record for unassignment
    try:
        # Get event name for history
        from_event_name = None
        if event:
            try:
                from_event_name = frappe.db.get_value("Gift Event", event, "subject")
            except Exception:
                from_event_name = event

        history_row = frappe.get_doc(
            {
                "doctype": "Gift Event History",
                "parent": gift,
                "parenttype": "Gift",
                "parentfield": "gift_event_history",
                "from_event": None,
                "from_event_name": from_event_name,
                "to_event": None,
                "to_event_name": None,
                "moved_on": frappe.utils.now(),
                "moved_by": user,
                "remarks": "Gift unassigned from event",
            }
        )
        history_row.insert(ignore_permissions=True)
    except Exception:
        frappe.log_error(frappe.get_traceback(), f"Remove Gift: Failed adding unassignment history for {gift}")

    try:
        _insert_gift_timeline_entry(
            gift_name=gift,
            kind="gift_modified",
            doctype="Gift",
            docname=gift,
            user=user,
            notes=_("Gift unassigned from event"),
            changes=[
                {
                    "field": "event",
                    "from": event,
                    "to": None,
                },
                {
                    "field": "event_name",
                    "from": gift_state.get("event_name"),
                    "to": None,
                },
            ],
        )
    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Remove Gift: Failed adding timeline entry for {gift}",
        )

    frappe.db.set_value(
        "Gift",
        gift,
        {
            "event": None,
            "event_name": None,
        },
        update_modified=True,
    )
    
    # Debug: Log after save
    saved = frappe.db.get_value("Gift", gift, ["event", "event_name"], as_dict=True) or {}
    frappe.logger().info(
        f"After save - Gift {gift} event: {saved.get('event')}, event_name: {saved.get('event_name')}"
    )

    # Remove from event's event_gifts child table
    try:
        event_doc = frappe.get_doc("Gift Event", event)
        original_count = len(event_doc.event_gifts or [])
        event_doc.event_gifts = [row for row in (event_doc.event_gifts or []) if row.gift != gift]
        new_count = len(event_doc.event_gifts or [])
        
        # Only save if something was actually removed
        if new_count < original_count:
            event_doc.save(ignore_permissions=True)
            frappe.logger().info(f"Successfully removed gift {gift} from event {event}. Child table entries: {original_count} -> {new_count}")
        else:
            frappe.logger().warning(f"Gift {gift} was not found in event {event} child table")
    except Exception:
        frappe.log_error(frappe.get_traceback(), f"Remove Gift: Failed removing from event_gifts for {event}")

    # Final verification - check if there are any remaining links
    try:
        # Check if gift still has any reference to the event
        persisted = frappe.db.get_value("Gift", gift, ["event", "event_name"], as_dict=True) or {}
        frappe.logger().info(
            f"Final check - Gift {gift} event: {persisted.get('event')}, event_name: {persisted.get('event_name')}"
        )
        
        # Check if event still has this gift in child table
        event_gifts = frappe.db.get_all("Event Gifts", filters={"parent": event, "gift": gift}, pluck="name")
        if event_gifts:
            frappe.logger().warning(f"Event {event} still has gift {gift} in child table: {event_gifts}")
        else:
            frappe.logger().info(f"Event {event} child table is clean for gift {gift}")
        
        # Check for any remaining gift_event_history links to this event
        history_links = frappe.db.get_all("Gift Event History", 
            filters={"parent": gift, "from_event": event}, 
            pluck="name")
        if history_links:
            frappe.logger().warning(f"Found {len(history_links)} history records still linking to event {event}. Clearing links...")
            # Clear the problematic links
            frappe.db.set_value("Gift Event History", {"parent": gift, "from_event": event}, "from_event", None)
            frappe.logger().info(f"Cleared from_event links for {len(history_links)} history records")
            
    except Exception as e:
        frappe.logger().error(f"Error in final verification: {e}")

    for gift_name in touched_gifts:
        _recompute_gift_status_from_issues(gift_name)

    return {"gift": gift, "event": None, "removed_from": event}


@frappe.whitelist(allow_guest=False)
def move_gifts_to_event(gifts, event, remarks=None):
    if not event:
        frappe.throw(_("Event is required"))

    gift_names = _coerce_name_list(gifts)
    if not gift_names:
        frappe.throw(_("At least one gift is required"))

    moved = []
    failed = []

    for gift_name in gift_names:
        try:
            move_gift_to_event(gift=gift_name, event=event, remarks=remarks)
            moved.append(gift_name)
        except Exception as e:
            failed.append({"gift": gift_name, "error": str(e)})

    return {
        "event": event,
        "requested": len(gift_names),
        "moved": moved,
        "failed": failed,
        "success": len(failed) == 0,
    }


@frappe.whitelist(allow_guest=False)
def remove_gifts_from_event(event, gifts):
    if not event:
        frappe.throw(_("Event is required"))

    gift_names = _coerce_name_list(gifts)
    if not gift_names:
        frappe.throw(_("At least one gift is required"))

    removed = []
    failed = []
    skipped = []

    for gift_name in gift_names:
        try:
            result = remove_gift_from_event(gift=gift_name, event=event) or {}
            if result.get("skipped"):
                skipped.append({"gift": gift_name, "reason": result.get("skipped")})
                continue
            removed.append(gift_name)
        except Exception as e:
            failed.append({"gift": gift_name, "error": str(e)})

    return {
        "event": event,
        "requested": len(gift_names),
        "removed": removed,
        "failed": failed,
        "skipped": skipped,
        "success": len(failed) == 0,
    }
    
@frappe.whitelist(allow_guest=False)
def list_gifts(filters=None, page=1, limit=20):
    """
    Get gifts with proper pagination and total count
    """
    import json
    
    filters_dict = json.loads(filters) if filters else {}
    page = int(page)
    limit = int(limit)
    
    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global_visibility = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )

    allowed_events = None
    if not has_global_visibility:
        allowed_events = get_user_visible_event_names(user)
        if not allowed_events:
            return {
                "gifts": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "total_pages": 0,
            }
    
    # Build filter conditions
    conditions = []
    values = {}

    if allowed_events is not None:
        conditions.append("event in %(allowed_events)s")
        values["allowed_events"] = tuple(allowed_events)

    if filters_dict.get('status'):
        conditions.append("status = %(status)s")
        values['status'] = filters_dict['status']
    
    if filters_dict.get('category'):
        conditions.append("category = %(category)s")
        values['category'] = filters_dict['category']
    
    # Search across multiple fields
    if filters_dict.get('search'):
        search_term = f"%{filters_dict['search']}%"
        conditions.append("""(
            gift_name LIKE %(search)s OR 
            gift_id LIKE %(search)s OR 
            barcode_value LIKE %(search)s OR 
            qr_code_value LIKE %(search)s OR
            name LIKE %(search)s
        )""")
        values['search'] = search_term
    
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    
    # Get total count (IMPORTANT for pagination)
    total_count_result = frappe.db.sql(f"""
        SELECT COUNT(*) as count
        FROM `tabGift`
        {where_clause}
    """, values, as_dict=True)
    
    total_count = total_count_result[0]['count'] if total_count_result else 0
    
    # Get paginated data
    limit_start = (page - 1) * limit
    
    gifts = frappe.db.sql(f"""
        SELECT 
            name,
            gift_id,
            gift_name,
            category,
            status,
            event,
            warehouse,
            barcode,
            barcode_value,
            qr_code_value,
            creation,
            modified
        FROM `tabGift`
        {where_clause}
        ORDER BY creation DESC
        LIMIT %(limit_start)s, %(limit)s
    """, {**values, 'limit_start': limit_start, 'limit': limit}, as_dict=True)
    
    return {
        "gifts": gifts,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1  # Ceiling division
    }

@frappe.whitelist(allow_guest=False)
def list_recipients(search=None, page=1, limit=20):
    """
    Get gift recipients with proper pagination and search
    """
    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global_visibility = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )

    allowed_events = None
    if not has_global_visibility:
        allowed_events = get_user_visible_event_names(user)
        if not allowed_events:
            return {
                "recipients": [],
                "total": 0,
                "page": int(page),
                "limit": int(limit),
                "total_pages": 0,
            }

    page = int(page)
    limit = int(limit)
    search_term = (search or '').strip()
    
    # Build filter conditions
    conditions = []
    values = {}
    
    # Search across multiple fields
    if search_term:
        search_pattern = f'%{search_term}%'
        conditions.append("""(
            owner_full_name LIKE %(search)s OR 
            guest_first_name LIKE %(search)s OR 
            guest_last_name LIKE %(search)s OR
            coordinator_email LIKE %(search)s OR 
            coordinator_mobile_no LIKE %(search)s OR 
            name LIKE %(search)s
        )""")
        values['search'] = search_pattern
    
    if allowed_events is not None:
        conditions.append("event in %(allowed_events)s")
        values["allowed_events"] = tuple(allowed_events)
    
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    
    # Get total count
    total_count_result = frappe.db.sql(f"""
        SELECT COUNT(*) as count
        FROM `tabGift Recipient`
        {where_clause}
    """, values, as_dict=True)
    
    total_count = total_count_result[0]['count'] if total_count_result else 0
    
    # Get paginated data
    limit_start = (page - 1) * limit
    
    recipients = frappe.db.sql(f"""
        SELECT *
        FROM `tabGift Recipient`
        {where_clause}
        ORDER BY creation DESC
        LIMIT %(limit_start)s, %(limit)s
    """, {**values, 'limit_start': limit_start, 'limit': limit}, as_dict=True)
    
    return {
        "recipients": recipients,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }


@frappe.whitelist(allow_guest=False)
def list_recipients_for_gift_interest(gift, search=None, page=1, limit=20):
    """
    Get gift recipients filtered based on gift's event association.
    - If gift belongs to an event: only show recipients from that event
    - If gift doesn't belong to any event: only show recipients not associated with any event
    """
    if not gift:
        frappe.throw(_("Gift is required"))
    
    # Check if gift exists and get its event
    try:
        gift_doc = frappe.get_doc("Gift", gift)
        gift_event = gift_doc.event
    except Exception as e:
        frappe.throw(_("Gift {0} not found").format(gift))
    
    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global_visibility = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )
    
    # Check event access if gift is associated with an event
    if gift_event and not has_global_visibility:
        if not has_event_access(gift_event, user):
            frappe.throw(_("You don't have access to this event"))
    
    page = int(page)
    limit = int(limit)
    search_term = (search or '').strip()
    
    # Build filter conditions
    conditions = []
    values = {}
    
    # Search across multiple fields
    if search_term:
        search_pattern = f'%{search_term}%'
        conditions.append("""(
            owner_full_name LIKE %(search)s OR 
            guest_first_name LIKE %(search)s OR 
            guest_last_name LIKE %(search)s OR
            coordinator_email LIKE %(search)s OR 
            coordinator_mobile_no LIKE %(search)s OR 
            name LIKE %(search)s
        )""")
        values['search'] = search_pattern
    
    # Event-based filtering logic
    if gift_event:
        # Gift belongs to an event - only show recipients from this event
        conditions.append("event = %(gift_event)s")
        values["gift_event"] = gift_event
    else:
        # Gift doesn't belong to any event - only show recipients not associated with any event
        conditions.append("(event IS NULL OR event = '' OR event = 'None')")
    
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    
    # Get total count
    total_count_result = frappe.db.sql(f"""
        SELECT COUNT(*) as count
        FROM `tabGift Recipient`
        {where_clause}
    """, values, as_dict=True)
    
    total_count = total_count_result[0]['count'] if total_count_result else 0
    
    # Get paginated data
    limit_start = (page - 1) * limit
    
    recipients = frappe.db.sql(f"""
        SELECT *
        FROM `tabGift Recipient`
        {where_clause}
        ORDER BY creation DESC
        LIMIT %(limit_start)s, %(limit)s
    """, {**values, 'limit_start': limit_start, 'limit': limit}, as_dict=True)
    
    return {
        "recipients": recipients,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }


@frappe.whitelist(allow_guest=False)
def list_recipients_by_event(event, search=None, page=1, limit=20):
    """Paginated gift recipients filtered by a single event."""
    if not event:
        frappe.throw(_("Event is required"))

    user = frappe.session.user
    if not has_event_access(event, user):
        frappe.throw(_("You don't have access to this event"))

    page = int(page)
    limit = int(limit)
    start = (page - 1) * limit

    conditions = ["event = %(event)s"]
    values = {"event": event}

    if search:
        values["search"] = f"%{search}%"
        conditions.append("(owner_full_name like %(search)s or name like %(search)s or coordinator_mobile_no like %(search)s)")

    where_clause = " AND ".join(conditions)

    total_count = frappe.db.sql(
        f"""
        SELECT COUNT(*) as count
        FROM `tabGift Recipient`
        WHERE {where_clause}
        """,
        values,
        as_dict=True,
    )[0]["count"]

    recipients = frappe.db.sql(
        f"""
        SELECT
            name,
            owner_full_name,
            coordinator_full_name,
            coordinator_mobile_no,
            coordinator_email as email,
            event
        FROM `tabGift Recipient`
        WHERE {where_clause}
        ORDER BY modified desc
        LIMIT %(start)s, %(limit)s
        """,
        {**values, "start": start, "limit": limit},
        as_dict=True,
    )

    return {
        "recipients": recipients,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1,
    }
    
@frappe.whitelist(allow_guest=False)
def list_received_gifts(filters=None, page=1, limit=20):
    """Get received gifts with server-side pagination"""
    filters_dict = json.loads(filters) if filters else {}
    
    # Extract search term
    search_term = filters_dict.pop('search', None)
    
    # Build standard filters
    standard_filters = {}
    if filters_dict.get('status'):
        standard_filters['status'] = filters_dict['status']
    if filters_dict.get('category'):
        standard_filters['category'] = filters_dict['category']
    if filters_dict.get('donor_type'):
        standard_filters['donor_type'] = filters_dict['donor_type']
    
    # Define search fields
    search_fields = ['gift_name', 'donor', 'donor_country', 'name']
    
    result = paginate_query(
        doctype='Gift Received',
        filters=standard_filters,
        search_fields=search_fields,
        search_term=search_term,
        page=page,
        limit=limit,
        order_by='creation desc'
    )
    
    return {
        "received_gifts": result['items'],
        "total": result['total'],
        "page": result['page'],
        "limit": result['limit'],
        "total_pages": result['total_pages']
    }


# ============================================
# GIFT ISSUES API
# ============================================

@frappe.whitelist(allow_guest=False)
def list_gift_issues(filters=None, page=1, limit=20):
    """Get gift issues with server-side pagination"""
    import json
    
    filters_dict = json.loads(filters) if filters else {}
    page = int(page)
    limit = int(limit)
    
    # Extract search term
    search_term = filters_dict.pop('search', None)
    
    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global_visibility = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )

    allowed_events = None
    if not has_global_visibility:
        allowed_events = get_user_visible_event_names(user)
        if not allowed_events:
            return {
                "issues": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "total_pages": 0,
            }

    # Build frappe filters
    frappe_filters = {}
    or_filters = None
    
    if filters_dict.get('status'):
        frappe_filters['status'] = filters_dict['status']
    if filters_dict.get('recipient'):
        frappe_filters['gift_recipient'] = filters_dict['recipient']
    
    # ✅ ADD THESE LINES
    if filters_dict.get('gift'):
        frappe_filters['gift'] = filters_dict['gift']
    if filters_dict.get('gift_recipient'):
        frappe_filters['gift_recipient'] = filters_dict['gift_recipient']
    if filters_dict.get('event'):
        frappe_filters['event'] = filters_dict['event']

    if allowed_events is not None:
        frappe_filters['event'] = ['in', allowed_events]
    
    # Build search filters
    if search_term:
        search_pattern = f'%{search_term}%'
        or_filters = [
            ['name', 'like', search_pattern],
            ['gift', 'like', search_pattern],
            ['gift_recipient', 'like', search_pattern],
            ['issued_by', 'like', search_pattern],
        ]
    
    # Get total count
    if or_filters:
        total_count = len(frappe.get_all(
            'Gift Issue',
            filters=frappe_filters,
            or_filters=or_filters,
            fields=['name']
        ))
    else:
        total_count = frappe.db.count('Gift Issue', filters=frappe_filters)
    
    # Get paginated issues
    issues = frappe.get_all(
        'Gift Issue',
        filters=frappe_filters,
        or_filters=or_filters,
        fields=['*'],
        start=(page - 1) * limit,
        page_length=limit,
        order_by='date desc'
    )
    
    return {
        "issues": issues,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }


@frappe.whitelist(allow_guest=False)
def list_pending_issue_approvals(search=None, page=1, limit=20):
    """List Gift Issue approval requests awaiting approval.

    Each Gift Issue is one approval request (a gift may have multiple issues/requests).
    """

    page = int(page)
    limit = int(limit)
    search_term = (search or "").strip()

    user = frappe.session.user
    roles = set(frappe.get_roles(user))

    if user not in {"Administrator"} and "System Manager" not in roles and "Event Manager" not in roles:
        frappe.throw(_("You don't have permission to access approval requests"))

    allowed_events = None
    # Non-admin users are always scoped to events where they can approve.
    if user not in {"Administrator"} and "System Manager" not in roles:
        candidate_events = get_user_visible_event_names(user)
        if not candidate_events:
            return {"requests": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}

        allowed_events = [ev for ev in candidate_events if can_user_approve(ev, user)]
        if not allowed_events:
            return {"requests": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}

    conditions = [
        "gi.approval_status = 'Awaiting Approval'",
        "gi.status NOT IN ('Cancelled', 'Returned')",
        "COALESCE(gi.event, '') != ''",
        "(g.status in ('Available', 'Reserved') OR g.status IS NULL)",
        "COALESCE(g.event, '') = COALESCE(gi.event, '')",
    ]
    values = {}

    if allowed_events is not None:
        conditions.append("gi.event in %(allowed_events)s")
        values["allowed_events"] = tuple(allowed_events)

    if search_term:
        values["search"] = f"%{search_term}%"
        conditions.append(
            "(gi.name like %(search)s or gi.gift like %(search)s or gi.gift_name like %(search)s "
            "or gi.gift_recipient like %(search)s or gi.guest_name like %(search)s "
            "or gi.event like %(search)s or gi.event_name like %(search)s)"
        )

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    total = frappe.db.sql(
        f"""
        SELECT COUNT(*) as count
        FROM `tabGift Issue` gi
        LEFT JOIN `tabGift` g ON g.name = gi.gift
        WHERE {where_clause}
        """,
        values,
        as_dict=True,
    )[0]["count"]

    start = (page - 1) * limit
    rows = frappe.db.sql(
        f"""
        SELECT
            gi.name,
            gi.gift,
            gi.gift_name,
            gi.category,
            gi.event,
            gi.event_name,
            gi.gift_recipient,
            gi.guest_name,
            gi.owner,
            gi.creation,
            gi.date,
            g.status as gift_status
        FROM `tabGift Issue` gi
        LEFT JOIN `tabGift` g ON g.name = gi.gift
        WHERE {where_clause}
        ORDER BY gi.creation desc
        LIMIT %(start)s, %(limit)s
        """,
        {**values, "start": start, "limit": limit},
        as_dict=True,
    )

    owner_ids = {r.get("owner") for r in (rows or []) if r.get("owner")}
    recipient_ids = {r.get("gift_recipient") for r in (rows or []) if r.get("gift_recipient")}

    owner_name_map = {}
    if owner_ids:
        for u in frappe.get_all(
            "User",
            filters={"name": ["in", list(owner_ids)]},
            fields=["name", "full_name"],
        ):
            owner_name_map[u.get("name")] = u.get("full_name") or u.get("name")

    recipient_data_map = {}
    if recipient_ids:
        for rec in frappe.get_all(
            "Gift Recipient",
            filters={"name": ["in", list(recipient_ids)]},
            fields=[
                "name",
                "owner_full_name",
                "guest_first_name",
                "guest_last_name",
                "coordinator_full_name",
                "coordinator_mobile_no",
            ],
        ):
            first = (rec.get("guest_first_name") or "").strip()
            last = (rec.get("guest_last_name") or "").strip()
            full_from_parts = " ".join(part for part in [first, last] if part)
            recipient_data_map[rec.get("name")] = {
                "name": rec.get("owner_full_name") or full_from_parts or rec.get("name"),
                "coordinator_full_name": rec.get("coordinator_full_name"),
                "mobile_number": rec.get("coordinator_mobile_no"),
            }

    requests = []
    for r in rows or []:
        recipient_data = recipient_data_map.get(r.get("gift_recipient"), {})
        requests.append(
            {
                "issue": r.get("name"),
                "gift": r.get("gift"),
                "gift_name": r.get("gift_name"),
                "category": r.get("category"),
                "gift_status": r.get("gift_status"),
                "event": r.get("event"),
                "event_name": r.get("event_name"),
                "gift_recipient": r.get("gift_recipient"),
                "guest_full_name": r.get("guest_name") or recipient_data.get("name") or r.get("gift_recipient"),
                "coordinator_full_name": recipient_data.get("coordinator_full_name"),
                "mobile_number": recipient_data.get("mobile_number"),
                "requested_by": owner_name_map.get(r.get("owner")) or r.get("owner"),
                "creation": r.get("creation"),
                "date": r.get("date"),
            }
        )

    return {
        "requests": requests,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": -(-total // limit) if limit > 0 else 1,
    }



# ============================================
# GIFT DISPATCHES API
# ============================================

@frappe.whitelist(allow_guest=False)
def list_gift_dispatches(filters=None, page=1, limit=20):
    """Get gift dispatches with server-side pagination"""
    import json
    
    filters_dict = json.loads(filters) if filters else {}
    page = int(page)
    limit = int(limit)

    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global_visibility = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )
    allowed_events = None
    if not has_global_visibility:
        allowed_events = get_user_visible_event_names(user)
        if not allowed_events:
            return {"dispatches": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}
    
    # Extract search term
    search_term = filters_dict.pop('search', None)
    
    # Build frappe filters
    frappe_filters = {}
    or_filters = None
    
    if filters_dict.get('dispatch_status'):
        frappe_filters['dispatch_status'] = filters_dict['dispatch_status']
    if filters_dict.get('carrier'):
        frappe_filters['carrier'] = filters_dict['carrier']
    
    if filters_dict.get('gift'):
        frappe_filters['gift'] = filters_dict['gift']
    if filters_dict.get('related_gift_issue'):
        frappe_filters['related_gift_issue'] = filters_dict['related_gift_issue']

    if allowed_events is not None:
        frappe_filters['event'] = ['in', allowed_events]
    
    # Build search filters
    if search_term:
        search_pattern = f'%{search_term}%'
        or_filters = [
            ['name', 'like', search_pattern],
            ['related_gift_issue', 'like', search_pattern],
            ['tracking_number', 'like', search_pattern],
            ['carrier', 'like', search_pattern],
        ]
    
    # Get total count
    if or_filters:
        total_count = len(frappe.get_all(
            'Gift Dispatch',
            filters=frappe_filters,
            or_filters=or_filters,
            fields=['name']
        ))
    else:
        total_count = frappe.db.count('Gift Dispatch', filters=frappe_filters)
    
    # Determine the correct date field for sorting
    meta = frappe.get_meta('Gift Dispatch')
    date_field = None
    
    # Try to find a date field
    for field in meta.fields:
        if field.fieldname in ['dispatch_date', 'date', 'dispatch_datetime']:
            date_field = field.fieldname
            break
    
    # Fallback to creation if no date field found
    order_by = f'{date_field} desc' if date_field else 'creation desc'
    
    # Get paginated dispatches
    dispatches = frappe.get_all(
        'Gift Dispatch',
        filters=frappe_filters,
        or_filters=or_filters,
        fields=['*'],
        start=(page - 1) * limit,
        page_length=limit,
        order_by=order_by
    )
    
    return {
        "dispatches": dispatches,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }


@frappe.whitelist(allow_guest=False)
def list_gift_categories(search=None, page=1, limit=20):
    """Get gift categories with server-side pagination"""
    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    if user not in {"Administrator"} and "System Manager" not in roles and "Event Manager" not in roles and "Event Coordinator" not in roles:
        frappe.throw(_("You do not have permission to access categories"))

    page = int(page)
    limit = int(limit)
    
    # Build filters
    filters = {}
    or_filters = None
    
    if search:
        search_pattern = f'%{search}%'
        or_filters = [
            ['category_name', 'like', search_pattern],
            ['description', 'like', search_pattern],
            ['category_type', 'like', search_pattern],
        ]
    
    # Get total count
    total_count = frappe.db.count('Gift Category', filters=filters)
    
    # Get paginated data
    categories = frappe.get_all(
        'Gift Category',
        filters=filters,
        or_filters=or_filters,
        fields=['*'],
        start=(page - 1) * limit,
        page_length=limit,
        order_by='category_name asc'
    )
    
    # Find the correct child table name
    meta = frappe.get_meta('Gift Category')
    child_table_field = None
    for field in meta.get_table_fields():
        if 'attribute' in field.fieldname.lower():
            child_table_field = field
            break
    
    # Fetch child table data if exists
    if child_table_field:
        for category in categories:
            try:
                category['category_attributes'] = frappe.get_all(
                    child_table_field.options,  # Use the correct DocType name
                    filters={'parent': category['name']},
                    fields=['*'],
                    order_by='idx asc'
                )
            except Exception as e:
                frappe.log_error(f"Error fetching category attributes: {str(e)}")
                category['category_attributes'] = []
    else:
        # If no child table, set empty array
        for category in categories:
            category['category_attributes'] = []
    
    return {
        "categories": categories,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }


@frappe.whitelist(allow_guest=False)
def list_users():
    """List all system users (admin/system manager only)."""
    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    if user not in {"Administrator"} and "System Manager" not in roles and "Event Manager" not in roles:
        frappe.throw(_("You do not have permission to access users"))

    users = frappe.get_all(
        "User",
        fields=["name", "email", "full_name", "enabled", "user_type"],
        order_by="full_name asc",
        ignore_permissions=True,
    )

    users = [row for row in users if row.get("name") != user]

    managed_roles = {"System Manager", "Event Manager", "Event Coordinator"}
    for row in users:
        user_roles = set(frappe.get_roles(row.get("name")))
        row["roles"] = [{"role": role} for role in sorted(user_roles & managed_roles)]

    return users


@frappe.whitelist(allow_guest=False)
def list_event_team_users():
    """List users eligible for Event Team selection, with role metadata."""
    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    if user not in {"Administrator"} and "System Manager" not in roles and "Event Manager" not in roles:
        frappe.throw(_("You do not have permission to access users"))

    managed_roles = {"System Manager", "Event Manager", "Event Coordinator"}
    users = frappe.get_all(
        "User",
        fields=["name", "email", "full_name", "enabled", "user_type"],
        order_by="full_name asc",
        ignore_permissions=True,
    )

    out = []
    for row in users:
        user_roles = set(frappe.get_roles(row.get("name")))
        role_list = sorted(user_roles & managed_roles)
        if not role_list:
            continue
        row["roles"] = [{"role": role} for role in role_list]
        out.append(row)

    return out


@frappe.whitelist(allow_guest=False)
def list_gift_events(filters=None, page=1, limit=20):
    """Get gift events with server-side pagination"""
    import json
    
    filters_dict = json.loads(filters) if filters else {}
    page = int(page)
    limit = int(limit)
    
    search = (filters_dict.get("search") or "").strip()
    sort_by = (filters_dict.get("sort_by") or "starts_on").strip()
    sort_dir = (filters_dict.get("sort_dir") or "desc").strip().lower()

    allowed_sort_fields = {
        "event_id": "name",
        "name": "name",
        "event_name": "subject",
        "subject": "subject",
        "start_date": "starts_on",
        "starts_on": "starts_on",
    }
    sort_field = allowed_sort_fields.get(sort_by, "starts_on")
    if sort_dir not in {"asc", "desc"}:
        sort_dir = "desc"

    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global_visibility = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )

    allowed_events = None
    if not has_global_visibility:
        allowed_events = get_user_visible_event_names(user)
        if not allowed_events:
            return {
                "events": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "total_pages": 0,
            }

    # Build frappe filters
    frappe_filters = {}
    if filters_dict.get('status'):
        frappe_filters['status'] = filters_dict['status']
    
    # Search + pagination + ordering (SQL for correct total)
    conditions = []
    values = {}
    if allowed_events is not None:
        conditions.append("name in %(allowed_events)s")
        values["allowed_events"] = tuple(allowed_events)
    if frappe_filters.get("status"):
        conditions.append("status = %(status)s")
        values["status"] = frappe_filters["status"]

    if search:
        conditions.append("(subject LIKE %(search)s OR name LIKE %(search)s)")
        values["search"] = f"%{search}%"

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    order_by = f"`{_validate_sql_identifier(sort_field, 'sort_field')}` {sort_dir}"

    total_count_result = frappe.db.sql(
        f"""
        SELECT COUNT(*) as count
        FROM `tabGift Event`
        {where_clause}
        """,
        values,
        as_dict=True,
    )
    total_count = int((total_count_result[0] or {}).get("count") or 0) if total_count_result else 0

    start = (page - 1) * limit
    events = frappe.db.sql(
        f"""
        SELECT *
        FROM `tabGift Event`
        {where_clause}
        ORDER BY {order_by}
        LIMIT %(start)s, %(limit)s
        """,
        {**values, "start": start, "limit": limit},
        as_dict=True,
    )

    # Compute authoritative gift counts from Gift.event (Event Gifts child table can be stale)
    event_names = [e.get('name') for e in events if e.get('name')]
    gift_counts_map = {}
    if event_names:
        gift_counts = frappe.db.sql(
            """
            SELECT event, COUNT(*) AS cnt
            FROM `tabGift`
            WHERE event in %(events)s
            GROUP BY event
            """,
            {"events": tuple(event_names)},
            as_dict=True,
        )
        gift_counts_map = {row.get('event'): int(row.get('cnt') or 0) for row in gift_counts}
    
    # Find the correct child table name for participants
    meta = frappe.get_meta('Gift Event')
    participant_field = None
    for field in meta.get_table_fields():
        if 'participant' in field.fieldname.lower():
            participant_field = field
            break
    
    # Fetch participants if child table exists
    if participant_field:
        for event in events:
            try:
                event['event_participants'] = frappe.get_all(
                    participant_field.options,  # Use the correct DocType name
                    filters={'parent': event['name']},
                    fields=['*'],
                    order_by='idx asc'
                )
            except Exception as e:
                frappe.log_error(f"Error fetching event participants: {str(e)}")
                event['event_participants'] = []
            event['event_gifts_count'] = gift_counts_map.get(event.get('name'), 0)
    else:
        # If no child table, set empty array
        for event in events:
            event['event_participants'] = []
            event['event_gifts_count'] = gift_counts_map.get(event.get('name'), 0)
    
    return {
        "events": events,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }


@frappe.whitelist(allow_guest=False)
def export_gift_event_csv(name):
    """Export Gift Event participants report to CSV (with contact + computed counts)."""
    import csv
    import io

    if not name:
        frappe.throw(_("Event name is required"))

    event = frappe.get_doc('Gift Event', name)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        'Event',
        'Subject',
        'Status',
        'Starts On',
        'Ends On',
        'Recipient ID',
        'Recipient Name',
        'Email',
        'Phone',
        'Coordinator Name',
        'Coordinator Email',
        'Coordinator Phone',
        'Attending',
        'Interested Gifts Count',
        'Issued Gifts Count',
    ])

    participants = event.get('event_participants') or []
    for p in participants:
        recipient = p.get('gift_recipient')
        recipient_doc = frappe.get_doc('Gift Recipient', recipient) if recipient else None

        interested = frappe.db.count(
            'Gift Interest',
            _gift_interest_active_filters(
                {
                    'gift_recipient': recipient,
                    'event': event.name,
                }
            ),
        ) if recipient else 0
        issued = frappe.db.count('Gift Issue', {
            'gift_recipient': recipient,
            'event': event.name,
        }) if recipient else 0

        writer.writerow([
            event.name,
            event.subject,
            event.status,
            event.starts_on,
            event.ends_on,
            recipient or '',
            (recipient_doc.owner_full_name if recipient_doc else '') if recipient else '',
            (recipient_doc.coordinator_email if recipient_doc else '') if recipient else '',
            (recipient_doc.coordinator_mobile_no if recipient_doc else '') if recipient else '',
            (recipient_doc.coordinator_full_name if recipient_doc else '') if recipient else '',
            (recipient_doc.coordinator_email if recipient_doc else '') if recipient else '',
            (recipient_doc.coordinator_mobile_no if recipient_doc else '') if recipient else '',
            p.get('attending') or '',
            interested,
            issued,
        ])

    csv_text = output.getvalue()
    output.close()

    frappe.local.response.filename = f"gift_event_{event.name}.csv"
    frappe.local.response.filecontent = csv_text
    frappe.local.response.type = 'download'


@frappe.whitelist(allow_guest=False)
def get_gift_event_with_counts(name, include_gifts=1):
    """Fetch a single Gift Event along with its participants and computed gift tracking counts.

    This avoids stale `interested_gifts_count` / `issued_gifts_count` values that would otherwise
    only refresh when the Gift Event is saved.
    """
    if not name:
        frappe.throw("Event name is required")

    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global = user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles

    if not has_global and not has_event_access(name, user):
        frappe.throw(_("You do not have access to this event"), frappe.PermissionError)

    event_doc = frappe.get_doc('Gift Event', name)
    event = event_doc.as_dict()

    # Draft privacy: coordinators can view draft event header/team/participants,
    # but not the categories/gifts lists.
    try:
        status = event.get("status")
        user = frappe.session.user
        roles = set(frappe.get_roles(user))
        if status in {"Draft", "Planned"} and ("Event Coordinator" in roles) and ("Event Manager" not in roles) and ("System Manager" not in roles) and user != "Administrator":
            event["event_categories"] = []
            event["event_gifts"] = []
    except Exception:
        pass

    include_gifts = int(cint(include_gifts)) if include_gifts is not None else 1

    # Ensure a stable gifts list for pages that need it.
    # The Event Gifts child table can be stale/empty depending on how data was migrated/created,
    # while `Gift.event` is the authoritative assignment.
    if include_gifts:
        try:
            if event.get("event_gifts") is not None:
                assigned_gifts = frappe.get_all(
                    "Gift",
                    filters={"event": name},
                    fields=["name", "gift_name", "category", "status", "barcode_value", "uae_ring_number"],
                    order_by="modified desc",
                )
                event["event_gifts"] = [
                    {
                        "gift": g.get("name"),
                        "gift_name": g.get("gift_name"),
                        "category": g.get("category"),
                        "display_status": g.get("status"),
                        "barcode_value": g.get("barcode_value"),
                        "uae_ring_number": g.get("uae_ring_number"),
                    }
                    for g in (assigned_gifts or [])
                ]
        except Exception:
            frappe.log_error(frappe.get_traceback(), "Event Details: Failed building event_gifts from Gift")
    else:
        event["event_gifts"] = []

    participants = event.get('event_participants') or []
    for participant in participants:
        gift_recipient = participant.get('gift_recipient')
        if not gift_recipient:
            participant['interested_gifts_count'] = 0
            participant['issued_gifts_count'] = 0
            continue

        participant['interested_gifts_count'] = frappe.db.count(
            'Gift Interest',
            _gift_interest_active_filters(
                {
                    'gift_recipient': gift_recipient,
                    'event': name,
                }
            ),
        )
        participant['issued_gifts_count'] = frappe.db.count('Gift Issue', {
            'gift_recipient': gift_recipient,
            'event': name
        })

    return event


@frappe.whitelist(allow_guest=False)
def list_event_participants(event, search=None, page=1, limit=20):
    """Paginated listing for Event Participants child table."""
    if not event:
        frappe.throw(_("Event is required"))

    user = frappe.session.user
    if not has_event_access(event, user):
        frappe.throw(_("You don't have access to this event"))

    page = int(page)
    limit = int(limit)
    start = (page - 1) * limit

    conditions = ["ep.parenttype = 'Gift Event'", "ep.parent = %(event)s"]
    values = {"event": event}

    if search:
        values["search"] = f"%{search}%"
        # search against recipient display name and recipient id
        conditions.append("(gr.owner_full_name like %(search)s or ep.gift_recipient like %(search)s)")

    where_clause = " AND ".join(conditions)

    total = frappe.db.sql(
        f"""
        SELECT COUNT(*) as count
        FROM `tabEvent Participants` ep
        LEFT JOIN `tabGift Recipient` gr ON gr.name = ep.gift_recipient
        WHERE {where_clause}
        """,
        values,
        as_dict=True,
    )[0]["count"]

    rows = frappe.db.sql(
        f"""
        SELECT
            ep.name,
            ep.idx,
            ep.gift_recipient,
            gr.owner_full_name as recipient_name,
            gr.coordinator_full_name as coordinator_name,
            gr.coordinator_mobile_no as contact_number,
            ep.attending,
            ep.invitation_status,
            ep.remarks
        FROM `tabEvent Participants` ep
        LEFT JOIN `tabGift Recipient` gr ON gr.name = ep.gift_recipient
        WHERE {where_clause}
        ORDER BY ep.idx asc
        LIMIT %(start)s, %(limit)s
        """,
        {**values, "start": start, "limit": limit},
        as_dict=True,
    )

    # compute counts in bulk for current page
    recipient_names = [r.get("gift_recipient") for r in rows if r.get("gift_recipient")]
    interested_map = {}
    issued_map = {}
    soft_delete_sql = " AND COALESCE(is_deleted, 0) = 0" if _gift_interest_has_soft_delete_column() else ""
    if recipient_names:
        interested = frappe.db.sql(
            """
            SELECT gift_recipient, COUNT(*) as cnt
            FROM `tabGift Interest`
            WHERE event = %(event)s AND gift_recipient in %(recipients)s
            {soft_delete_sql}
            GROUP BY gift_recipient
            """.format(soft_delete_sql=soft_delete_sql),
            {"event": event, "recipients": tuple(recipient_names)},
            as_dict=True,
        )
        issued = frappe.db.sql(
                """
                SELECT gift_recipient, COUNT(*) as cnt
                FROM `tabGift Issue`
                WHERE event = %(event)s
                AND gift_recipient IN %(recipients)s
                AND status = 'Delivered'
                AND status NOT IN ('Cancelled', 'Returned')
                GROUP BY gift_recipient
                """,
                {"event": event, "recipients": tuple(recipient_names)},
                as_dict=True,
            )
        interested_map = {r["gift_recipient"]: int(r["cnt"]) for r in interested}
        issued_map = {r["gift_recipient"]: int(r["cnt"]) for r in issued}

    for r in rows:
        gr = r.get("gift_recipient")
        r["interested_gifts_count"] = interested_map.get(gr, 0) if gr else 0
        r["issued_gifts_count"] = issued_map.get(gr, 0) if gr else 0

    return {
        "participants": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": -(-total // limit) if limit > 0 else 1,
    }


@frappe.whitelist(allow_guest=False)
def list_gift_interests(filters=None, page=1, limit=20):
    """Get gift interests with server-side pagination"""
    import json
    
    filters_dict = json.loads(filters) if filters else {}
    page = int(page)
    limit = int(limit)

    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global_visibility = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )
    allowed_events = None
    if not has_global_visibility:
        allowed_events = get_user_visible_event_names(user)
        if not allowed_events:
            return {"interests": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}
    
    # Build frappe filters
    frappe_filters = {}
    
    if filters_dict.get('follow_up_status'):
        frappe_filters['follow_up_status'] = filters_dict['follow_up_status']
    
    if filters_dict.get('gift'):
        frappe_filters['gift'] = filters_dict['gift']
    if filters_dict.get('gift_recipient'):
        frappe_filters['gift_recipient'] = filters_dict['gift_recipient']

    if allowed_events is not None:
        frappe_filters['event'] = ['in', allowed_events]
    
    frappe_filters = _gift_interest_active_filters(frappe_filters)

    # Get total count
    total_count = frappe.db.count('Gift Interest', filters=frappe_filters)
    
    # Get paginated interests
    interests = frappe.get_all(
        'Gift Interest',
        filters=frappe_filters,
        fields=['*'],
        start=(page - 1) * limit,
        page_length=limit,
        order_by='creation desc'
    )
    
    return {
        "interests": interests,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }

@frappe.whitelist(allow_guest=False)
def list_gift_maintenance(filters=None, page=1, limit=20):
    """Get gift maintenance records with server-side pagination"""
    import json
    
    filters_dict = json.loads(filters) if filters else {}
    page = int(page)
    limit = int(limit)

    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global_visibility = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )
    allowed_events = None
    if not has_global_visibility:
        allowed_events = get_user_visible_event_names(user)
        if not allowed_events:
            return {"maintenance": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}
    
    # Extract search term
    search_term = filters_dict.pop('search', None)
    
    # Build frappe filters
    frappe_filters = {}
    or_filters = None
    
    if filters_dict.get('maintenance_type'):
        frappe_filters['maintenance_type'] = filters_dict['maintenance_type']
    if filters_dict.get('payment_status'):
        frappe_filters['payment_status'] = filters_dict['payment_status']
    
    if filters_dict.get('gift'):
        frappe_filters['gift'] = filters_dict['gift']

    if allowed_events is not None:
        frappe_filters['event'] = ['in', allowed_events]
    
    # Build search filters
    if search_term:
        search_pattern = f'%{search_term}%'
        or_filters = [
            ['name', 'like', search_pattern],
            ['gift', 'like', search_pattern],
            ['performed_by', 'like', search_pattern],
        ]
    
    # Get total count
    if or_filters:
        total_count = len(frappe.get_all(
            'Gift Maintenance',
            filters=frappe_filters,
            or_filters=or_filters,
            fields=['name']
        ))
    else:
        total_count = frappe.db.count('Gift Maintenance', filters=frappe_filters)
    
    # Determine the correct date field for sorting
    meta = frappe.get_meta('Gift Maintenance')
    date_field = None
    
    # Try to find a date field
    for field in meta.fields:
        if field.fieldname in ['maintenance_date', 'date', 'service_date']:
            date_field = field.fieldname
            break
    
    # Fallback to creation if no date field found
    order_by = f'{date_field} desc' if date_field else 'creation desc'
    
    # Get paginated maintenance records
    maintenance_records = frappe.get_all(
        'Gift Maintenance',
        filters=frappe_filters,
        or_filters=or_filters,
        fields=['*'],
        start=(page - 1) * limit,
        page_length=limit,
        order_by=order_by
    )
    
    return {
        "maintenance_records": maintenance_records,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": -(-total_count // limit) if limit > 0 else 1
    }


@frappe.whitelist(allow_guest=False)
def get_gift_detail_bundle(gift_name):
    """Consolidated payload for GiftDetailNew page."""
    if not gift_name:
        frappe.throw(_("Gift name is required"))

    if not frappe.db.exists("Gift", gift_name):
        frappe.throw(_("Gift not found"))

    gift_doc = frappe.get_doc("Gift", gift_name)
    event_name = gift_doc.get("event")

    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global = user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles

    if not has_global:
        # Non-global users (including coordinators) may only access gifts that are
        # explicitly assigned to an event they have access to. Unassigned gifts
        # (event IS NULL) are not accessible to coordinators to prevent data leakage
        # when navigating directly to a gift URL.
        if not event_name or not has_event_access(event_name, user):
            frappe.throw(_("You do not have access to this gift"), frappe.PermissionError)

    from gift.gift.doctype.gift.gift import get_gift_details

    details_resp = get_gift_details(gift_name)
    if not details_resp.get("success"):
        frappe.throw(details_resp.get("error") or _("Failed to fetch gift details"))

    gift_data = details_resp.get("data") or {}

    def _get_user_full_name_map(user_ids):
        user_ids = {u for u in (user_ids or []) if u}
        if not user_ids:
            return {}
        out = {}
        for user in frappe.get_all(
            "User",
            filters={"name": ["in", list(user_ids)]},
            fields=["name", "full_name"],
        ):
            out[user.get("name")] = user.get("full_name") or user.get("name")
        return out

    # Enrich Gift created/modified users with full name (avoid showing raw email)
    gift_user_map = _get_user_full_name_map(
        {gift_data.get("owner"), gift_data.get("modified_by")}
    )
    if gift_data.get("owner"):
        gift_data["owner_full_name"] = gift_user_map.get(gift_data.get("owner"))
    if gift_data.get("modified_by"):
        gift_data["modified_by_full_name"] = gift_user_map.get(
            gift_data.get("modified_by")
        )

    # Enrich Gift Event History rows with event subject + status so frontend can
    # render accurate event progression (instead of issue-level statuses).
    raw_event_history = gift_data.get("gift_event_history") or []
    current_event = gift_data.get("event") or event_name

    # Backfill a current-event row for legacy gifts that may not have an initial
    # gift_event_history entry yet.
    if current_event:
        has_current_event_row = any(
            (row.get("to_event") == current_event) for row in raw_event_history
        )
        if not has_current_event_row:
            raw_event_history = [
                *raw_event_history,
                {
                    "from_event": None,
                    "to_event": current_event,
                    "moved_on": gift_data.get("modified") or gift_data.get("creation"),
                    "moved_by": gift_data.get("modified_by") or gift_data.get("owner"),
                    "remarks": _("Current event assignment"),
                },
            ]

    event_names = set()
    for row in raw_event_history:
        from_event = row.get("from_event")
        to_event = row.get("to_event")
        if from_event:
            event_names.add(from_event)
        if to_event:
            event_names.add(to_event)

    event_meta_map = {}
    if event_names:
        for ev in frappe.get_all(
            "Gift Event",
            filters={"name": ["in", list(event_names)]},
            fields=["name", "subject", "status"],
        ):
            event_meta_map[ev.get("name")] = {
                "name": ev.get("subject") or ev.get("name"),
                "status": ev.get("status"),
            }

    enriched_event_history = []
    for row in raw_event_history:
        from_event = row.get("from_event")
        to_event = row.get("to_event")
        from_meta = event_meta_map.get(from_event) or {}
        to_meta = event_meta_map.get(to_event) or {}

        enriched_event_history.append(
            {
                **row,
                "from_event_name": from_meta.get("name") or from_event,
                "from_event_status": from_meta.get("status"),
                "to_event_name": to_meta.get("name") or to_event,
                "to_event_status": to_meta.get("status"),
            }
        )

    gift_data["gift_event_history"] = enriched_event_history

    # Unify all gift-related history into a single timeline.
    # Includes:
    # - Gift created/modified
    # - Gift field changes from Version (Track Changes)
    # - Interests created
    # - Issues created/approved/delivered/etc.
    def _safe_load_json(val):
        if not val:
            return None
        if isinstance(val, (dict, list)):
            return val
        try:
            import json

            return json.loads(val)
        except Exception:
            return None

    timeline = []
    # Created
    if gift_data.get("creation"):
        timeline.append(
            {
                "kind": "gift_created",
                "doctype": "Gift",
                "docname": gift_name,
                "timestamp": gift_data.get("creation"),
                "user": gift_data.get("owner"),
                "user_full_name": gift_data.get("owner_full_name")
                or gift_data.get("owner"),
            }
        )

    # Track changes (Version)
    try:
        versions = frappe.get_all(
            "Version",
            filters={"ref_doctype": "Gift", "docname": gift_name},
            fields=["name", "creation", "owner", "data"],
            order_by="creation desc",
        )
    except Exception:
        versions = []

    version_user_map = _get_user_full_name_map({v.get("owner") for v in versions})
    for v in versions:
        data = _safe_load_json(v.get("data")) or {}
        changed = data.get("changed") or []
        # changed = [[fieldname, old, new], ...]
        changes = []

        # Only show meaningful Gift changes in history.
        # Avoid noisy Track Changes fields / initialization updates.
        excluded_fields = {
            "modified",
            "modified_by",
            "owner",
            "creation",
            "docstatus",
            "idx",
            "barcode",
            "barcode_value",
            "qr_code_image",
            "qr_code_value",
            "scan_count",
        }

        def _normalize_change_val(val):
            if val in ("", " "):
                return None
            return val

        def _is_effectively_empty(val):
            val = _normalize_change_val(val)
            return val is None

        def _is_noise_change(fieldname, old, new):
            if not fieldname:
                return True
            if fieldname in excluded_fields:
                return True

            old_n = _normalize_change_val(old)
            new_n = _normalize_change_val(new)

            # Ignore no-op changes
            if old_n == new_n:
                return True

            # Common noise: 0 -> None / None -> 0 for optional numeric fields
            if (old_n == 0 and _is_effectively_empty(new_n)) or (
                new_n == 0 and _is_effectively_empty(old_n)
            ):
                return True

            # Treat empty-ish transitions as noise for specific fields
            if fieldname in {"estimated_value", "quantity"}:
                if _is_effectively_empty(old_n) and _is_effectively_empty(new_n):
                    return True
            return False
        for row in changed:
            if not isinstance(row, (list, tuple)) or len(row) < 3:
                continue
            fieldname, old, new = row[0], row[1], row[2]

            if _is_noise_change(fieldname, old, new):
                continue

            changes.append({"field": fieldname, "from": old, "to": new})

        # Enhance event changes to include event names
        enhanced_changes = []
        event_change_found = False
        event_name_change_found = False
        
        for change in changes:
            fieldname = change.get("field")
            
            if fieldname == "event":
                event_change_found = True
                # Try to get event names for both old and new values
                old_event_name = None
                new_event_name = None
                
                if change.get("from"):
                    try:
                        old_event_name = frappe.db.get_value("Gift Event", change.get("from"), "subject")
                        frappe.logger().info(f"Backend Debug: Found old event name: {old_event_name} for event {change.get('from')}")
                    except Exception as e:
                        frappe.logger().info(f"Backend Debug: Error getting old event name: {e}")
                
                if change.get("to"):
                    try:
                        new_event_name = frappe.db.get_value("Gift Event", change.get("to"), "subject")
                        frappe.logger().info(f"Backend Debug: Found new event name: {new_event_name} for event {change.get('to')}")
                    except Exception as e:
                        frappe.logger().info(f"Backend Debug: Error getting new event name: {e}")
                
                enhanced_change = change.copy()
                if old_event_name:
                    enhanced_change["from_name"] = old_event_name
                if new_event_name:
                    enhanced_change["to_name"] = new_event_name
                enhanced_changes.append(enhanced_change)
                
            elif fieldname == "event_name":
                event_name_change_found = True
                enhanced_changes.append(change)
            else:
                enhanced_changes.append(change)
        
        # If we found event change but no event_name change, try to enrich it
        if event_change_found and not event_name_change_found:
            # This will be handled in the frontend logic
            pass
        
        changes = enhanced_changes

        if not changes:
            continue

        timeline.append(
            {
                "kind": "gift_modified",
                "doctype": "Gift",
                "docname": gift_name,
                "timestamp": v.get("creation"),
                "user": v.get("owner"),
                "user_full_name": version_user_map.get(v.get("owner"))
                or v.get("owner"),
                "changes": changes,
                "version": v.get("name"),
            }
        )

    category = None
    if gift_data.get("category"):
        category = frappe.db.get_value(
            "Gift Category",
            gift_data.get("category"),
            ["name", "category_name", "category_type"],
            as_dict=True,
        )

    def _safe_get_all(doctype: str, filters=None, fields=None, order_by=None):
        """get_all wrapper that only requests columns that exist in the SQL table.

        This prevents OperationalError when the code references newer fields but the
        site DB schema hasn't been migrated yet.
        """
        try:
            table_cols = set(frappe.db.get_table_columns(f"tab{doctype}") or [])
        except Exception:
            table_cols = set()

        safe_fields = []
        for f in (fields or []):
            # Keep SQL expressions / aliases as-is.
            if not isinstance(f, str) or f.strip() == "":
                continue
            if "(" in f or " " in f or "." in f:
                safe_fields.append(f)
                continue
            if not table_cols or f in table_cols:
                safe_fields.append(f)

        return frappe.get_all(
            doctype,
            filters=filters,
            fields=safe_fields,
            order_by=order_by,
        )

    interests = _safe_get_all(
        "Gift Interest",
        filters=_gift_interest_active_filters({"gift": gift_name}),
        fields=[
            "name",
            "owner",
            "gift",
            "gift_name",
            "gift_recipient",
            "guest_name",
            "interest_datetime",
            "date",
            "interest_level",
            "interest_source",
            "approval_status",
            "approved_by",
            "approved_on",
            "follow_up_status",
            "converted_to_issue",
            "conversion_date",
            "event",
            "remarks",
            "creation",
            "modified",
        ],
        order_by="creation desc",
        )

    all_interests_for_history = _safe_get_all(
        "Gift Interest",
        filters={"gift": gift_name},
        fields=[
            "name",
            "owner",
            "gift_recipient",
            "guest_name",
            "interest_datetime",
            "date",
            "approval_status",
            "creation",
            "modified",
        ],
        order_by="creation desc",
    )

    issues = _safe_get_all(
        "Gift Issue",
        filters={
            "gift": gift_name,
            "status": ["not in", ["Cancelled", "Returned"]],
        },
        fields=[
            "name",
            "owner",
            "modified_by",
            "gift",
            "gift_name",
            "gift_recipient",
            "guest_name",
            "status",
            "approval_status",
            "approved_by",
            "approved_on",
            "rejection_reason",
            "dispatch_date",
            "delivery_method",
            "dispatch_type",
            "tracking_number",
            "delivery_date",
            "actual_delivery_time",
            "delivery_address",
            "received_by_type",
            "received_by_name",
            "receiver_contact",
            "receiver_id",
            "receiver_relationship",
            "delivery_person_name",
            "delivery_person_contact",
            "delivery_person_id",
            "delivery_person_company",
            "transport_mode",
            "transport_company",
            "vehicle_number",
            "driver_name",
            "driver_contact",
            "estimated_arrival",
            "delivery_remarks",
            "event",
            "date",
            "is_returned",
            "return_date",
            "return_reason",
            "return_handled_by",
            "from_gift_interest",
            "creation",
            "modified",
        ],
        order_by="date desc, creation desc",
    )

    all_issues_for_history = _safe_get_all(
        "Gift Issue",
        filters={"gift": gift_name},
        fields=[
            "name",
            "owner",
            "modified_by",
            "gift",
            "gift_name",
            "gift_recipient",
            "guest_name",
            "status",
            "approval_status",
            "approved_by",
            "approved_on",
            "rejection_reason",
            "dispatch_date",
            "delivery_method",
            "dispatch_type",
            "tracking_number",
            "delivery_date",
            "actual_delivery_time",
            "delivery_address",
            "received_by_type",
            "received_by_name",
            "receiver_contact",
            "receiver_id",
            "receiver_relationship",
            "delivery_person_name",
            "delivery_person_contact",
            "delivery_person_id",
            "delivery_person_company",
            "transport_mode",
            "transport_company",
            "vehicle_number",
            "driver_name",
            "driver_contact",
            "estimated_arrival",
            "delivery_remarks",
            "event",
            "date",
            "is_returned",
            "return_date",
            "return_reason",
            "return_handled_by",
            "from_gift_interest",
            "creation",
            "modified",
        ],
        order_by="date desc, creation desc",
    )

    owner_ids = {
        row.get("owner")
        for row in [*interests, *all_interests_for_history, *issues, *all_issues_for_history]
        if row.get("owner")
    }
    owner_ids |= {
        row.get("approved_by")
        for row in [*interests, *issues, *all_issues_for_history]
        if row.get("approved_by")
    }
    owner_ids |= {row.get("modified_by") for row in [*issues, *all_issues_for_history] if row.get("modified_by")}
    recipient_ids = {
        row.get("gift_recipient")
        for row in [*interests, *all_interests_for_history, *issues, *all_issues_for_history]
        if row.get("gift_recipient")
    }

    owner_name_map = {}
    if owner_ids:
        for user in frappe.get_all(
            "User",
            filters={"name": ["in", list(owner_ids)]},
            fields=["name", "full_name"],
        ):
            owner_name_map[user.get("name")] = user.get("full_name") or user.get("name")

    recipient_data_map = {}
    if recipient_ids:
        for recipient in frappe.get_all(
            "Gift Recipient",
            filters={"name": ["in", list(recipient_ids)]},
            fields=[
                "name", 
                "owner_full_name", 
                "guest_first_name", 
                "guest_last_name",
                "coordinator_full_name",
                "coordinator_mobile_no"
            ],
        ):
            first = (recipient.get("guest_first_name") or "").strip()
            last = (recipient.get("guest_last_name") or "").strip()
            full_from_parts = " ".join(part for part in [first, last] if part)
            recipient_data_map[recipient.get("name")] = {
                "name": recipient.get("owner_full_name") or full_from_parts or recipient.get("name"),
                "owner_full_name": recipient.get("owner_full_name"),
                "coordinator_full_name": recipient.get("coordinator_full_name"),
                "mobile_number": recipient.get("coordinator_mobile_no")
            }

    def _enrich_interest_row(row):
        row["created_by_full_name"] = owner_name_map.get(row.get("owner")) or row.get("owner")
        row["approved_by_full_name"] = (
            owner_name_map.get(row.get("approved_by")) or row.get("approved_by")
        )
        recipient_data = recipient_data_map.get(row.get("gift_recipient"), {})
        row["guest_full_name"] = (
            row.get("guest_name")
            or recipient_data.get("name")
            or row.get("gift_recipient")
        )
        row["owner_full_name"] = recipient_data.get("owner_full_name")
        row["coordinator_full_name"] = recipient_data.get("coordinator_full_name")
        row["mobile_number"] = recipient_data.get("mobile_number")

    for row in interests:
        _enrich_interest_row(row)

    for row in all_interests_for_history:
        _enrich_interest_row(row)

    for row in issues:
        row["created_by_full_name"] = owner_name_map.get(row.get("owner")) or row.get("owner")
        row["approved_by_full_name"] = (
            owner_name_map.get(row.get("approved_by")) or row.get("approved_by")
        )
        recipient_data = recipient_data_map.get(row.get("gift_recipient"), {})
        row["guest_full_name"] = (
            row.get("guest_name")
            or recipient_data.get("name")
            or row.get("gift_recipient")
        )
        row["owner_full_name"] = recipient_data.get("owner_full_name")
        row["coordinator_full_name"] = recipient_data.get("coordinator_full_name")
        row["mobile_number"] = recipient_data.get("mobile_number")

    for row in all_issues_for_history:
        row["created_by_full_name"] = owner_name_map.get(row.get("owner")) or row.get("owner")
        row["approved_by_full_name"] = (
            owner_name_map.get(row.get("approved_by")) or row.get("approved_by")
        )
        recipient_data = recipient_data_map.get(row.get("gift_recipient"), {})
        row["guest_full_name"] = (
            row.get("guest_name")
            or recipient_data.get("name")
            or row.get("gift_recipient")
        )
        row["owner_full_name"] = recipient_data.get("owner_full_name")
        row["coordinator_full_name"] = recipient_data.get("coordinator_full_name")
        row["mobile_number"] = recipient_data.get("mobile_number")

    for issue in issues:
        issue["documents"] = frappe.get_all(
            "Gift Issue Documents",
            filters={
                "parent": issue.get("name"),
                "parenttype": "Gift Issue",
                "parentfield": "documents",
            },
            fields=[
                "name",
                "idx",
                "document_type",
                "document_attachment",
                "description",
            ],
            order_by="idx asc",
    )

    dispatches = _safe_get_all(
        "Gift Dispatch",
        filters={"gift": gift_name},
        fields=[
            "name",
            "gift",
            "related_gift_issue",
            "dispatch_date",
            "dispatch_status",
            "dispatch_type",
            "transport_mode",
            "tracking_number",
            "delivery_address",
            "estimated_arrival",
            "actual_delivery_date",
            "received_by_name",
            "receiver_id",
            "delivery_remarks",
            "delivery_person_name",
            "delivery_person_contact",
            "delivery_person_id",
            "delivery_person_company",
            "event",
            "creation",
            "modified",
        ],
        order_by="dispatch_date desc, creation desc",
    )

    pending_interests = [d for d in interests if d.get("approval_status") == "Pending"]
    pending_issues = [d for d in issues if d.get("approval_status") == "Awaiting Approval"]
    returned_issues = [d for d in all_issues_for_history if d.get("is_returned") or d.get("status") == "Returned"]

    # Interest + Issue timeline entries.
    # Keep history resilient by using all interests (including soft-deleted rows)
    # when comment-backed timeline is not available.
    for interest in all_interests_for_history or []:
        timeline.append(
            {
                "kind": "interest_created",
                "doctype": "Gift Interest",
                "docname": interest.get("name"),
                # Always use datetime timestamps to avoid date-only timezone artifacts
                "timestamp": interest.get("creation")
                or interest.get("modified")
                or interest.get("interest_datetime")
                or interest.get("date"),
                "user": interest.get("owner"),
                "user_full_name": interest.get("created_by_full_name")
                or interest.get("owner"),
                "gift_recipient": interest.get("gift_recipient"),
                "guest_full_name": interest.get("guest_full_name"),
                "approval_status": interest.get("approval_status"),
            }
        )

    for issue in all_issues_for_history or []:
        timeline.append(
            {
                "kind": "issue_created",
                "doctype": "Gift Issue",
                "docname": issue.get("name"),
                # Always use datetime timestamps to keep ordering correct
                "timestamp": issue.get("creation")
                or issue.get("modified")
                or issue.get("date"),
                "user": issue.get("owner"),
                "user_full_name": issue.get("created_by_full_name")
                or issue.get("owner"),
                "gift_recipient": issue.get("gift_recipient"),
                "guest_full_name": issue.get("guest_full_name"),
                "status": issue.get("status"),
                "approval_status": issue.get("approval_status"),
            }
        )

    issue_map = {row.get("name"): row for row in (issues or []) if row.get("name")}
    issue_names = list(issue_map.keys())
    issue_versions = []
    if issue_names:
        try:
            issue_versions = frappe.get_all(
                "Version",
                filters={
                    "ref_doctype": "Gift Issue",
                    "docname": ["in", issue_names],
                },
                fields=["docname", "creation", "owner", "data"],
                order_by="creation asc",
            )
        except Exception:
            issue_versions = []

    for version_row in issue_versions:
        version_data = _safe_load_json(version_row.get("data")) or {}
        changed_rows = version_data.get("changed") or []
        if not isinstance(changed_rows, list):
            continue

        changed_map = {}
        for change_row in changed_rows:
            if not isinstance(change_row, (list, tuple)) or len(change_row) < 3:
                continue
            changed_map[str(change_row[0])] = {
                "from": change_row[1],
                "to": change_row[2],
            }

        issue_row = issue_map.get(version_row.get("docname"), {})
        event_user = version_row.get("owner")
        base_event = {
            "doctype": "Gift Issue",
            "docname": version_row.get("docname"),
            "timestamp": version_row.get("creation"),
            "user": event_user,
            "user_full_name": owner_name_map.get(event_user) or event_user,
            "gift_recipient": issue_row.get("gift_recipient"),
            "guest_full_name": issue_row.get("guest_full_name"),
        }

        dispatch_fields = {
            "dispatch_date": _("Dispatch Date"),
            "delivery_method": _("Delivery Method"),
            "dispatch_type": _("Dispatch Type"),
            "tracking_number": _("Tracking Number"),
            "delivery_address": _("Delivery Address"),
            "received_by_type": _("Receiver Type"),
            "received_by_name": _("Receiver Name"),
            "receiver_contact": _("Receiver Contact"),
            "receiver_id": _("Receiver ID"),
            "receiver_relationship": _("Receiver Relationship"),
            "delivery_person_name": _("Delivery Person Name"),
            "delivery_person_contact": _("Delivery Person Contact"),
            "delivery_person_id": _("Delivery Person ID"),
            "delivery_person_company": _("Delivery Person Company"),
            "transport_mode": _("Transport Mode"),
            "transport_company": _("Transport Company"),
            "vehicle_number": _("Vehicle Number"),
            "driver_name": _("Driver Name"),
            "driver_contact": _("Driver Contact"),
            "estimated_arrival": _("Estimated Arrival"),
            "delivery_remarks": _("Delivery Remarks"),
            "actual_delivery_time": _("Actual Delivery Time"),
            "delivery_date": _("Delivery Date"),
        }
        def _is_empty_dispatch_val(val):
            return val in (None, "", " ")

        def _format_change_val(val):
            return "-" if _is_empty_dispatch_val(val) else str(val)

        def _extract_child_doctype(change_row):
            if isinstance(change_row, dict):
                return str(
                    change_row.get("doctype")
                    or change_row.get("child_doctype")
                    or change_row.get("dt")
                    or ""
                ).strip()
            if isinstance(change_row, (list, tuple)) and len(change_row) > 0:
                if len(change_row) > 1 and isinstance(change_row[1], dict):
                    nested = change_row[1]
                    return str(
                        nested.get("doctype")
                        or nested.get("child_doctype")
                        or nested.get("dt")
                        or ""
                    ).strip()
                return str(change_row[0] or "").strip()
            return ""

        def _extract_child_label(change_row):
            if isinstance(change_row, dict):
                return str(
                    change_row.get("document_type")
                    or change_row.get("description")
                    or change_row.get("name")
                    or ""
                ).strip()
            if isinstance(change_row, (list, tuple)) and len(change_row) > 1:
                if isinstance(change_row[1], dict):
                    nested = change_row[1]
                    return str(
                        nested.get("document_type")
                        or nested.get("description")
                        or nested.get("name")
                        or ""
                    ).strip()
                return str(change_row[1] or "").strip()
            return ""

        changed_dispatch_descriptions = []
        for field, values in changed_map.items():
            if field not in dispatch_fields:
                continue
            old_val = values.get("from")
            new_val = values.get("to")
            if old_val == new_val:
                continue
            if _is_empty_dispatch_val(old_val) and not _is_empty_dispatch_val(new_val):
                continue
            label = dispatch_fields.get(field)
            if not label:
                continue
            changed_dispatch_descriptions.append(
                f"{label}: {_format_change_val(old_val)} -> {_format_change_val(new_val)}"
            )

        dispatch_document_doctypes = {"Gift Issue Documents"}

        for added_row in (version_data.get("added") or []):
            if _extract_child_doctype(added_row) not in dispatch_document_doctypes:
                continue
            row_label = _extract_child_label(added_row)
            if row_label:
                changed_dispatch_descriptions.append(
                    _("Dispatch document added ({0})").format(row_label)
                )
            else:
                changed_dispatch_descriptions.append(_("Dispatch document added"))

        for removed_row in (version_data.get("removed") or []):
            if _extract_child_doctype(removed_row) not in dispatch_document_doctypes:
                continue
            row_label = _extract_child_label(removed_row)
            if row_label:
                changed_dispatch_descriptions.append(
                    _("Dispatch document removed ({0})").format(row_label)
                )
            else:
                changed_dispatch_descriptions.append(_("Dispatch document removed"))

        dispatch_document_row_fields = {
            "document_type": _("Document Type"),
            "document_attachment": _("Attachment"),
            "description": _("Description"),
        }

        for changed_row in (version_data.get("row_changed") or []):
            if not isinstance(changed_row, (list, tuple)) or len(changed_row) < 4:
                continue

            parentfield = str(changed_row[0] or "").strip()
            if parentfield != "documents":
                continue

            row_changes = changed_row[3]
            if not isinstance(row_changes, (list, tuple)):
                continue

            row_label_before = ""
            row_label_after = ""
            per_row_changes = []

            for field_change in row_changes:
                if (
                    not isinstance(field_change, (list, tuple))
                    or len(field_change) < 3
                ):
                    continue

                fieldname = str(field_change[0] or "").strip()
                old_val = field_change[1]
                new_val = field_change[2]

                if old_val == new_val:
                    continue

                if fieldname == "document_type":
                    row_label_before = str(old_val or "").strip()
                    row_label_after = str(new_val or "").strip()

                field_label = dispatch_document_row_fields.get(fieldname)
                if not field_label:
                    continue

                per_row_changes.append(
                    f"{field_label}: {_format_change_val(old_val)} -> {_format_change_val(new_val)}"
                )

            if not per_row_changes:
                continue

            row_label = row_label_after or row_label_before
            if row_label:
                changed_dispatch_descriptions.append(
                    _("Document Updated ({0}): {1}").format(
                        row_label,
                        "; ".join(per_row_changes),
                    )
                )
            else:
                changed_dispatch_descriptions.append(
                    _("Dispatch document updated: {0}").format(
                        "; ".join(per_row_changes)
                    )
                )

        if changed_dispatch_descriptions:
            timeline.append(
                {
                    **base_event,
                    "kind": "dispatch_details_updated",
                    "notes": _("Dispatch details updated: {0}").format(
                        "; ".join(changed_dispatch_descriptions)
                    ),
                }
            )

        status_change = changed_map.get("status") or {}
        old_status = status_change.get("from")
        new_status = status_change.get("to")
        if new_status == "Delivered" and old_status != "Delivered":
            timeline.append(
                {
                    **base_event,
                    "kind": "issue_delivered",
                    "notes": "Gift delivered",
                }
            )

        approval_change = changed_map.get("approval_status")
        if not approval_change:
            continue

        new_approval_status = approval_change.get("to")
        if new_approval_status == "Approved":
            timeline.append(
                {
                    **base_event,
                    "kind": "issue_approved",
                    "notes": "Allocation approved",
                }
            )
            continue

        if new_approval_status == "Rejected":
            status_change = changed_map.get("status") or {}
            new_status = status_change.get("to")

            reason_change = changed_map.get("rejection_reason") or {}
            reason_text = reason_change.get("to") or issue_row.get("rejection_reason")
            reason_text = reason_text.strip() if isinstance(reason_text, str) else ""

            is_allocation_removed = (
                new_status == "Cancelled"
                or (reason_text and "allocation removed" in reason_text.lower())
            )

            if is_allocation_removed:
                timeline.append(
                    {
                        **base_event,
                        "kind": "allocation_removed",
                        "notes": (
                            f"Allocation removed. Reason: {reason_text}"
                            if reason_text
                            else "Allocation removed. Reason: -"
                        ),
                    }
                )
            else:
                timeline.append(
                    {
                        **base_event,
                        "kind": "allocation_rejected",
                        "notes": f"Reason: {reason_text}" if reason_text else "Reason: -",
                    }
                )

    # Timeline sort (desc)
    def _timeline_dt(item):
        ts = item.get("timestamp")
        if not ts:
            return None
        try:
            # Handles datetime/date/strings; ensures comparability
            return frappe.utils.get_datetime(ts)
        except Exception:
            return None

    timeline = sorted(
        timeline,
        key=lambda x: (_timeline_dt(x) is not None, _timeline_dt(x)),
        reverse=True,
    )
    computed_timeline = list(timeline)

    # Prefer immutable persisted timeline rows (Gift Timeline Entry).
    # Fallback to computed timeline only for legacy gifts that still have no
    # persisted timeline rows yet.
    persisted_timeline = gift_data.get("timeline") if isinstance(gift_data.get("timeline"), list) else []
    if persisted_timeline:
        timeline = list(persisted_timeline)

        # Ensure creation + edit history always appears, even if older persisted
        # rows are partial/missing due previous logging bugs.
        has_created = any((row.get("kind") == "gift_created") for row in timeline)
        if not has_created:
            fallback_created = next(
                (row for row in (timeline or []) if row.get("kind") == "gift_created"),
                None,
            )
            if not fallback_created:
                fallback_created = next(
                    (row for row in (computed_timeline or []) if row.get("kind") == "gift_created"),
                    None,
                )
            if fallback_created:
                timeline.append(fallback_created)

        existing_modified_keys = {
            f"{str(row.get('timestamp') or '')}|{str(row.get('user') or '')}|{str(row.get('notes') or '')}|{str(row.get('version') or '')}"
            for row in timeline
            if row.get("kind") == "gift_modified"
        }
        for computed_row in (computed_timeline or []):
            if computed_row.get("kind") != "gift_modified":
                continue
            key = (
                f"{str(computed_row.get('timestamp') or '')}|{str(computed_row.get('user') or '')}|"
                f"{str(computed_row.get('notes') or '')}|{str(computed_row.get('version') or '')}"
            )
            if key in existing_modified_keys:
                continue
            timeline.append(computed_row)
            existing_modified_keys.add(key)

        merge_kinds = {
            "issue_created",
            "issue_approved",
            "issue_delivered",
            "allocation_rejected",
            "allocation_removed",
            "allocation_request_removed",
            "dispatch_details_updated",
        }
        single_event_per_issue_kinds = {
            "issue_created",
            "issue_approved",
            "issue_delivered",
            "allocation_rejected",
            "allocation_removed",
            "allocation_request_removed",
        }
        existing_event_keys = {
            f"{str(row.get('kind') or '')}|{str(row.get('docname') or '')}|{str(row.get('timestamp') or '')}|{str(row.get('notes') or '')}"
            for row in timeline
            if row.get("kind") in merge_kinds
        }
        existing_single_event_doc_keys = {
            f"{str(row.get('kind') or '')}|{str(row.get('docname') or '')}"
            for row in timeline
            if row.get("kind") in single_event_per_issue_kinds
        }
        for computed_row in (computed_timeline or []):
            if computed_row.get("kind") not in merge_kinds:
                continue
            single_doc_key = (
                f"{str(computed_row.get('kind') or '')}|{str(computed_row.get('docname') or '')}"
            )
            if (
                computed_row.get("kind") in single_event_per_issue_kinds
                and single_doc_key in existing_single_event_doc_keys
            ):
                continue
            key = (
                f"{str(computed_row.get('kind') or '')}|{str(computed_row.get('docname') or '')}|"
                f"{str(computed_row.get('timestamp') or '')}|{str(computed_row.get('notes') or '')}"
            )
            if key in existing_event_keys:
                continue
            timeline.append(computed_row)
            existing_event_keys.add(key)
            if computed_row.get("kind") in single_event_per_issue_kinds:
                existing_single_event_doc_keys.add(single_doc_key)
    else:
        timeline = timeline

    return {
        "gift": gift_data,
        "event_history": enriched_event_history,
        "category": category,
        "interests": interests,
        "issues": issues,
        "dispatches": dispatches,
        "event": event_name,
        "timeline": timeline,
        "can_approve": can_user_approve(event_name, frappe.session.user) if event_name else False,
        "pending_interest_requests": pending_interests,
        "pending_issue_requests": pending_issues,
        "return_history": returned_issues,
    }


@frappe.whitelist(allow_guest=False)
def record_gift_interest(gift, gift_recipient, interest_source="Manual Entry", remarks=None):
    """Create a gift interest from GiftDetailNew flow."""
    if not gift or not gift_recipient:
        frappe.throw(_("Gift and recipient are required"))

    gift_doc = frappe.get_doc("Gift", gift)
    event_name = gift_doc.get("event")
    if event_name and not has_event_access(event_name, frappe.session.user):
        frappe.throw(_("You do not have access to this event"))

    existing_interest = frappe.db.get_value(
        "Gift Interest",
        _gift_interest_active_filters(
            {
                "gift": gift,
                "gift_recipient": gift_recipient,
                "approval_status": ["in", ["Pending", "Approved"]],
                "follow_up_status": ["!=", "Closed"],
            }
        ),
        "name",
    )
    if existing_interest:
        frappe.throw(
            _("Interest already exists for this guest on this gift: {0}").format(existing_interest)
        )

    interest = frappe.new_doc("Gift Interest")
    interest.gift = gift
    interest.gift_recipient = gift_recipient
    if event_name:
        interest.event = event_name
    interest.interest_source = interest_source or "Manual Entry"
    interest.date = frappe.utils.today()
    if remarks:
        interest.remarks = remarks

    interest.insert(ignore_permissions=True)

    return {
        "name": interest.name,
        "approval_status": interest.approval_status,
        "message": _("Interest recorded successfully"),
    }


@frappe.whitelist(allow_guest=False)
def record_gift_interests_bulk(gift, gift_recipients, interest_source="Manual Entry", remarks=None):
    """
    Record interest for multiple recipients in a single API call.

    ``gift_recipients`` – JSON array of Gift Recipient docnames.

    Returns::
        {
            "results": [
                {"gift_recipient": "GR-001", "success": true, "name": "GI-001", "approval_status": "Pending"},
                {"gift_recipient": "GR-002", "success": false, "error": "Interest already exists ..."},
            ],
            "created": <count of successes>,
            "failed": <count of failures>
        }
    """
    import json as _j

    if not gift:
        frappe.throw(_("Gift is required"))

    if isinstance(gift_recipients, str):
        try:
            gift_recipients = _j.loads(gift_recipients)
        except Exception:
            gift_recipients = [gift_recipients]

    if not isinstance(gift_recipients, list) or not gift_recipients:
        frappe.throw(_("gift_recipients must be a non-empty list"))

    gift_doc = frappe.get_doc("Gift", gift)
    event_name = gift_doc.get("event")
    if event_name and not has_event_access(event_name, frappe.session.user):
        frappe.throw(_("You do not have access to this event"))

    results = []
    for gift_recipient in gift_recipients:
        gift_recipient = str(gift_recipient or "").strip()
        if not gift_recipient:
            continue

        try:
            existing_interest = frappe.db.get_value(
                "Gift Interest",
                _gift_interest_active_filters(
                    {
                        "gift": gift,
                        "gift_recipient": gift_recipient,
                        "approval_status": ["in", ["Pending", "Approved"]],
                        "follow_up_status": ["!=", "Closed"],
                    }
                ),
                "name",
            )
            if existing_interest:
                results.append({
                    "gift_recipient": gift_recipient,
                    "success": False,
                    "error": _("Interest already exists for this guest on this gift: {0}").format(existing_interest),
                })
                continue

            interest = frappe.new_doc("Gift Interest")
            interest.gift = gift
            interest.gift_recipient = gift_recipient
            if event_name:
                interest.event = event_name
            interest.interest_source = interest_source or "Manual Entry"
            interest.date = frappe.utils.today()
            if remarks:
                interest.remarks = remarks

            interest.insert(ignore_permissions=True)

            results.append({
                "gift_recipient": gift_recipient,
                "success": True,
                "name": interest.name,
                "approval_status": interest.approval_status,
            })

        except Exception as e:
            results.append({
                "gift_recipient": gift_recipient,
                "success": False,
                "error": str(e),
            })

    created = sum(1 for r in results if r.get("success"))
    failed = sum(1 for r in results if not r.get("success"))

    return {
        "results": results,
        "created": created,
        "failed": failed,
    }


@frappe.whitelist(allow_guest=False)
def approve_interest_and_issue(interest_name):
    """Approve a pending interest and create issue via doctype workflow."""
    if not interest_name:
        frappe.throw(_("Interest name is required"))

    interest = frappe.get_doc("Gift Interest", interest_name)
    if not getattr(interest, "event", None):
        interest.event = (
            frappe.db.get_value("Gift", interest.get("gift"), "event")
            or frappe.db.get_value("Gift Recipient", interest.get("gift_recipient"), "event")
        )

    active_issue_for_gift = frappe.get_all(
        "Gift Issue",
        filters={
            "gift": interest.get("gift"),
            "approval_status": ["in", ["Awaiting Approval", "Approved"]],
            "status": ["not in", ["Cancelled", "Returned"]],
        },
        fields=["name", "from_gift_interest"],
        page_length=1,
    )
    if active_issue_for_gift:
        active_row = active_issue_for_gift[0]
        if str(active_row.get("from_gift_interest") or "") != str(interest.name):
            frappe.throw(
                _("Only one active allocation request is allowed per gift. Resolve the current request first.")
            )
    issue_name = interest.approve_interest()

    return {
        "interest": interest.name,
        "issue": issue_name,
        "message": _("Interest approved and issue created"),
    }


@frappe.whitelist(allow_guest=False)
def reject_interest(interest_name, reason=None):
    """Reject interest from GiftDetailNew."""
    if not interest_name:
        frappe.throw(_("Interest name is required"))

    interest = frappe.get_doc("Gift Interest", interest_name)

    roles = set(frappe.get_roles(frappe.session.user))
    allowed = {"System Manager", "Administrator", "Gift Approver"}
    if not (roles & allowed):
        frappe.throw(_("You are not allowed to reject interests"))

    interest.approval_status = "Rejected"
    interest.remarks = (interest.remarks or "") + (f"\nRejection Reason: {reason}" if reason else "")
    interest.save(ignore_permissions=True)

    return {
        "interest": interest.name,
        "message": _("Interest rejected"),
    }


@frappe.whitelist(allow_guest=False)
def create_issue_from_interest(interest_name, delivery_method="Direct Handover"):
    """Create issue from an already-approved interest (without using separate Issue page)."""
    if not interest_name:
        frappe.throw(_("Interest name is required"))

    interest = frappe.get_doc("Gift Interest", interest_name)

    active_issue_for_gift = frappe.get_all(
        "Gift Issue",
        filters={
            "gift": interest.get("gift"),
            "approval_status": ["in", ["Awaiting Approval", "Approved"]],
            "status": ["not in", ["Cancelled", "Returned"]],
        },
        fields=["name", "from_gift_interest", "approval_status"],
        page_length=1,
    )
    if active_issue_for_gift:
        active_row = active_issue_for_gift[0]
        if str(active_row.get("from_gift_interest") or "") != str(interest.name):
            frappe.throw(
                _("Only one active allocation request is allowed per gift. Resolve the current request first.")
            )
        return {
            "issue": active_row.get("name"),
            "approval_status": active_row.get("approval_status") or "Awaiting Approval",
            "message": _("Issue already exists for this interest"),
        }

    existing_issue_name = interest.get("converted_to_issue")
    if existing_issue_name:
        try:
            existing_issue = frappe.get_doc("Gift Issue", existing_issue_name)
        except Exception:
            existing_issue = None

        if existing_issue:
            existing_status = getattr(existing_issue, "approval_status", None)
            existing_lifecycle = getattr(existing_issue, "status", None)

            # If an active request already exists, return it.
            if existing_status in {"Awaiting Approval", "Approved"} and existing_lifecycle not in {
                "Cancelled",
                "Returned",
            }:
                return {
                    "issue": existing_issue_name,
                    "approval_status": existing_status,
                    "message": _("Issue already exists for this interest"),
                }

            # If the previous request was rejected/cancelled/returned, allow re-request
            # by creating a new Gift Issue.

    issue = frappe.new_doc("Gift Issue")
    issue.gift = interest.get("gift")
    issue.gift_recipient = interest.get("gift_recipient")
    issue.event = interest.get("event")
    issue.from_gift_interest = interest.name
    issue.status = "Pending"
    issue.delivery_method = delivery_method or "Direct Handover"
    issue.date = frappe.utils.today()
    issue.insert(ignore_permissions=True)

    # Update interest with proper error handling
    try:
        interest.converted_to_issue = issue.name
        interest.conversion_date = frappe.utils.now()
        interest.follow_up_status = "Converted to Issue"
        interest.save(ignore_permissions=True)
    except frappe.TimestampMismatchError:
        # Handle concurrent modification gracefully
        frappe.msgprint(
            _("Interest was modified by another user. Please refresh and try again."),
            indicator="yellow",
            alert=True,
        )
        return {
            "error": "timestamp_mismatch",
            "message": _("Interest was modified by another user. Please refresh and try again."),
        }

    return {
        "issue": issue.name,
        "approval_status": issue.approval_status,
        "message": _("Issue created successfully"),
    }


def _recompute_gift_status_from_issues(gift_name):
    if not gift_name:
        return

    issues = frappe.get_all(
        "Gift Issue",
        filters={
            "gift": gift_name,
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
        frappe.db.set_value(
            "Gift",
            gift_name,
            "status",
            status_map.get(approved_issue.get("status") or "Pending", "Issued"),
            update_modified=True,
        )
        return

    awaiting = any((i.get("approval_status") == "Awaiting Approval") for i in (issues or []))
    if awaiting:
        frappe.db.set_value("Gift", gift_name, "status", "Reserved", update_modified=True)
        return

    frappe.db.set_value("Gift", gift_name, "status", "Available", update_modified=True)


def _can_remove_interest_or_request(event_name, user=None):
    if not user:
        user = frappe.session.user

    roles = set(frappe.get_roles(user))

    if user in {"Administrator"} or "System Manager" in roles:
        return True

    # ✅ Any user with Event Manager role can remove — even if not assigned to this event
    if "Event Manager" in roles:
        return True

    # Event Coordinators need to be assigned to the event
    if "Event Coordinator" in roles:
        return has_event_access(event_name, user)

    return False

@frappe.whitelist(allow_guest=False)
def remove_gift_interest(interest_name):
    if not interest_name:
        frappe.throw(_("Interest name is required"))

    interest = frappe.get_doc("Gift Interest", interest_name)
    if int(getattr(interest, "is_deleted", 0) or 0):
        frappe.throw(_("Interest already removed"))

    event_name = (
        getattr(interest, "event", None)
        or frappe.db.get_value("Gift", interest.get("gift"), "event")
        or frappe.db.get_value("Gift Recipient", interest.get("gift_recipient"), "event")
    )
    if not _can_remove_interest_or_request(event_name):
        frappe.throw(_("You are not allowed to remove this interest"))

    linked_issue_name = interest.get("converted_to_issue")
    if linked_issue_name and frappe.db.exists("Gift Issue", linked_issue_name):
        linked_issue = frappe.get_doc("Gift Issue", linked_issue_name)
        lifecycle_status = getattr(linked_issue, "status", None)
        approval_status = getattr(linked_issue, "approval_status", None)

        # ✅ Allow removal if issue is rejected, cancelled, or returned
        is_terminal = (
            lifecycle_status in {"Cancelled", "Returned"}
            or approval_status == "Rejected"
        )

        if not is_terminal:
            frappe.throw(
                _("Cannot remove interest while an allocation request/allocation exists. Remove request/allocation first.")
            )

    gift_doc = frappe.get_doc("Gift", interest.gift)
    gift_doc.add_timeline_entry(
        kind="interest_removed",
        doctype="Gift Interest",
        docname=interest.name,
        user=frappe.session.user,
        gift_recipient=interest.gift_recipient,
        notes=_("Interest entry removed"),
    )

    try:
        interest_cols = set(frappe.db.get_table_columns("tabGift Interest") or [])
    except Exception:
        interest_cols = set()

    if "is_deleted" in interest_cols:
        interest.is_deleted = 1
        interest.deleted_by = frappe.session.user
        interest.deleted_on = frappe.utils.now()
        interest.follow_up_status = "Closed"
        interest.converted_to_issue = None
        interest.conversion_date = None
        interest.approval_status = "Pending"
        interest.approved_by = None
        interest.approved_on = None
        interest.flags.ignore_validate = True
        interest.save(ignore_permissions=True)
    else:
        frappe.delete_doc("Gift Interest", interest.name, ignore_permissions=True, force=1)

    return {"interest": interest_name, "message": _("Interest removed")}


@frappe.whitelist(allow_guest=False)
def remove_allocation_request(issue_name):
    if not issue_name:
        frappe.throw(_("Issue name is required"))

    issue = frappe.get_doc("Gift Issue", issue_name)
    if not _can_remove_interest_or_request(issue.get("event") or frappe.db.get_value("Gift", issue.gift, "event")):
        frappe.throw(_("You are not allowed to remove this allocation request"))

    if issue.approval_status not in {"Awaiting Approval", "Rejected"}:
        frappe.throw(_("Only awaiting/rejected allocation requests can be removed"))

    gift_doc = frappe.get_doc("Gift", issue.gift)
    gift_doc.add_timeline_entry(
        kind="allocation_request_removed",
        doctype="Gift Issue",
        docname=issue.name,
        user=frappe.session.user,
        gift_recipient=issue.gift_recipient,
        notes=_("Allocation request removed"),
    )

    issue.status = "Cancelled"
    issue.rejection_reason = _("Allocation request removed")
    issue.flags.skip_timeline_log = True
    try:
        issue.save(ignore_permissions=True)
    finally:
        issue.flags.skip_timeline_log = False

    if issue.from_gift_interest and frappe.db.exists("Gift Interest", issue.from_gift_interest):
        interest_doc = frappe.get_doc("Gift Interest", issue.from_gift_interest)
        interest_doc.converted_to_issue = None
        interest_doc.conversion_date = None
        interest_doc.follow_up_status = "New"
        interest_doc.approval_status = "Pending"
        interest_doc.approved_by = None
        interest_doc.approved_on = None
        interest_doc.flags.ignore_validate = True
        interest_doc.save(ignore_permissions=True)

    _recompute_gift_status_from_issues(issue.gift)
    return {"issue": issue_name, "message": _("Allocation request removed")}


@frappe.whitelist(allow_guest=False)
def approve_gift_issue(issue_name):
    """Approve issue via doctype method."""
    if not issue_name:
        frappe.throw(_("Issue name is required"))

    issue = frappe.get_doc("Gift Issue", issue_name)
    issue.approve_issue()

    return {"issue": issue.name, "message": _("Issue approved")}


@frappe.whitelist(allow_guest=False)
def reject_gift_issue(issue_name, reason):
    """Reject issue via doctype method."""
    if not issue_name:
        frappe.throw(_("Issue name is required"))
    if not reason:
        frappe.throw(_("Rejection reason is required"))

    issue = frappe.get_doc("Gift Issue", issue_name)
    issue.reject_issue(reason)

    return {"issue": issue.name, "message": _("Issue rejected")}


@frappe.whitelist(allow_guest=False)
def send_issue_for_approval_again(issue_name):
    """Move a rejected issue back to Awaiting Approval."""
    if not issue_name:
        frappe.throw(_("Issue name is required"))

    issue = frappe.get_doc("Gift Issue", issue_name)
    issue.send_for_approval_again()
    return {"issue": issue.name, "message": _("Issue sent for approval again")}


@frappe.whitelist(allow_guest=False)
def unissue_gift(issue_name, reason):
    """Unissue gift via doctype method."""
    if not issue_name:
        frappe.throw(_("Issue name is required"))
    if not reason:
        frappe.throw(_("Reason is required"))

    issue = frappe.get_doc("Gift Issue", issue_name)
    issue.unissue(reason)
    return {"issue": issue.name, "message": _("Gift un-issued successfully")}


@frappe.whitelist(allow_guest=False)
def get_gift_history(gift_name):
    """
    Return a clean, pre-filtered gift history list for the given gift.

    This mirrors the exact filtering/deduplication logic performed by the
    GiftDetail frontend (giftHistory useMemo) so that mobile/API consumers
    receive ready-to-display records without re-implementing any filtering.

    Each item in the returned ``history`` list has:
        kind        – one of: gift_created | gift_modified | interest_created |
                      interest_removed | issue_created | issue_approved |
                      issue_delivered | allocation_rejected | allocation_removed |
                      allocation_request_removed | dispatch_details_updated
        event_type  – display category: created | modified | interest |
                      issued | delivered | rejected
        timestamp   – ISO datetime string
        user        – raw user id
        user_full_name – resolved display name
        guest_full_name – resolved guest name
        gift_recipient  – recipient docname (may be None)
        docname     – linked Gift Issue / Gift Interest docname (may be None)
        label       – short human-readable event label (English)
        reason      – rejection/removal reason string (allocation_rejected only)
        changes     – list of {field, from, to} for gift_modified events
        dispatch_changes – list of {field, sub_field, from, to} for dispatch_details_updated
    """
    if not gift_name:
        frappe.throw(_("Gift name is required"))

    if not frappe.db.exists("Gift", gift_name):
        frappe.throw(_("Gift not found"))

    gift_doc = frappe.get_doc("Gift", gift_name)
    event_name = gift_doc.get("event")
    user = frappe.session.user
    roles = set(frappe.get_roles(user))
    has_global = (
        user in {"Administrator"}
        or "System Manager" in roles
        or "Event Manager" in roles
    )
    if not has_global:
        if not event_name or not has_event_access(event_name, user):
            frappe.throw(_("You do not have access to this gift"), frappe.PermissionError)

    import re as _re
    import json as _json

    # ── 1. Fetch raw persisted timeline (same source as bundle) ─────────────
    # Gift Timeline Entry stores: kind, timestamp, entry_doctype, entry_docname,
    # user, user_full_name, gift_recipient, guest_full_name, notes, details_json.
    # Extra fields (changes, approval_status) live inside details_json as JSON.
    try:
        rows = frappe.get_all(
            "Gift Timeline Entry",
            filters={
                "parent": gift_name,
                "parenttype": "Gift",
                "parentfield": "timeline_history",
            },
            fields=[
                "kind", "timestamp",
                "entry_doctype", "entry_docname",
                "user", "user_full_name",
                "gift_recipient", "guest_full_name",
                "notes", "details_json", "creation",
            ],
            order_by="timestamp desc, creation desc",
            ignore_permissions=True,
        )
    except Exception:
        rows = []

    raw_timeline = []
    for row in (rows or []):
        payload = {}
        details_json = row.get("details_json")
        if details_json:
            try:
                payload = _json.loads(details_json) or {}
            except Exception:
                payload = {}

        entry = {
            "kind": row.get("kind") or payload.get("kind"),
            "timestamp": str(row.get("timestamp") or row.get("creation") or payload.get("timestamp") or ""),
            "user": row.get("user") or payload.get("user"),
            "user_full_name": row.get("user_full_name") or payload.get("user_full_name") or row.get("user") or payload.get("user"),
            "doctype": row.get("entry_doctype") or payload.get("doctype"),
            "docname": row.get("entry_docname") or payload.get("docname"),
            "gift_recipient": row.get("gift_recipient") or payload.get("gift_recipient"),
            "guest_full_name": (
                row.get("guest_full_name")
                or payload.get("guest_full_name")
                or row.get("gift_recipient")
                or payload.get("gift_recipient")
            ),
            "notes": row.get("notes") or payload.get("notes"),
            "approval_status": payload.get("approval_status"),
            "changes": payload.get("changes") if isinstance(payload.get("changes"), list) else [],
        }
        raw_timeline.append(entry)

    # Always fetch the computed timeline from get_gift_detail_bundle and merge it
    # in. dispatch_details_updated events are computed from Frappe Version history
    # and are NEVER written to Gift Timeline Entry, so they would be invisible
    # without this merge. For legacy gifts (no persisted rows) this also acts as
    # the full fallback.
    try:
        bundle = get_gift_detail_bundle(gift_name)
        computed_timeline = bundle.get("timeline") or []
    except Exception:
        computed_timeline = []

    if not raw_timeline:
        # Pure fallback — no persisted rows at all
        raw_timeline = list(computed_timeline)
    else:
        # Merge computed entries that are missing from the persisted set.
        # Use the same composite key as the exact-dedup step so nothing is doubled.
        persisted_keys = {
            "{}|{}|{}|{}".format(
                str(r.get("kind") or ""),
                str(r.get("docname") or ""),
                str(r.get("timestamp") or ""),
                str(r.get("notes") or ""),
            )
            for r in raw_timeline
        }
        # For single-event-per-issue kinds (issue_created etc.) also track by
        # kind|docname so computed duplicates don't sneak in.
        single_event_kinds = {
            "issue_created", "issue_approved", "issue_delivered",
            "allocation_rejected", "allocation_removed", "allocation_request_removed",
        }
        persisted_single_keys = {
            "{}|{}".format(str(r.get("kind") or ""), str(r.get("docname") or ""))
            for r in raw_timeline
            if str(r.get("kind") or "") in single_event_kinds
        }
        for cr in computed_timeline:
            kind_cr = str(cr.get("kind") or "")
            # For single-event kinds, skip if we already have one for that docname
            if kind_cr in single_event_kinds:
                sk = "{}|{}".format(kind_cr, str(cr.get("docname") or ""))
                if sk in persisted_single_keys:
                    continue
            ck = "{}|{}|{}|{}".format(
                kind_cr,
                str(cr.get("docname") or ""),
                str(cr.get("timestamp") or ""),
                str(cr.get("notes") or ""),
            )
            if ck not in persisted_keys:
                raw_timeline.append(cr)
                persisted_keys.add(ck)

    # ── 2. Exact-row deduplication (kind|docname|timestamp|notes) ───────────
    seen_exact = set()
    timeline = []
    for row in (raw_timeline or []):
        key = "{}|{}|{}|{}".format(
            str(row.get("kind") or ""),
            str(row.get("docname") or ""),
            str(row.get("timestamp") or ""),
            str(row.get("notes") or ""),
        )
        if key in seen_exact:
            continue
        seen_exact.add(key)
        timeline.append(row)

    # ── 3. Pre-compute which issue docnames are "direct allocations" ─────────
    # A direct allocation is an issue_created row whose approval_status was
    # already "Approved" at creation time (coordinator approved inline, no
    # separate approval step recorded).
    direct_allocation_issue_names = set()
    for row in timeline:
        if str(row.get("kind") or "") != "issue_created":
            continue
        approval = str(row.get("approval_status") or "").lower()
        notes = str(row.get("notes") or "")
        if approval == "approved" or _re.search(r"approval status:\s*approved", notes, _re.IGNORECASE):
            docname = str(row.get("docname") or "").strip()
            if docname:
                direct_allocation_issue_names.add(docname)

    # Build a quick lookup: docname → set of kinds that exist in the timeline.
    # Used for issue_created label logic and issue_approved skip.
    issue_kinds_by_docname: dict = {}
    for row in timeline:
        dn = str(row.get("docname") or "").strip()
        k = str(row.get("kind") or "").strip()
        if dn and k:
            issue_kinds_by_docname.setdefault(dn, set()).add(k)

    # ── 4. Resolve event display names for gift_modified "event" field ───────
    # Collect all event IDs referenced in version changes so we can resolve
    # their human-readable subject in one query.
    event_ids_to_resolve = set()
    for row in timeline:
        if str(row.get("kind") or "") != "gift_modified":
            continue
        raw_changes = row.get("changes")
        if isinstance(raw_changes, str):
            try:
                raw_changes = _json.loads(raw_changes)
            except Exception:
                raw_changes = []
        for c in (raw_changes or []):
            if str(c.get("field") or "") == "event":
                for val in [c.get("from"), c.get("to")]:
                    if val and str(val).strip() not in ("", "-"):
                        event_ids_to_resolve.add(str(val).strip())

    event_name_map = {}
    if event_ids_to_resolve:
        for ev in frappe.get_all(
            "Gift Event",
            filters={"name": ["in", list(event_ids_to_resolve)]},
            fields=["name", "subject"],
        ):
            event_name_map[ev["name"]] = ev.get("subject") or ev["name"]

    # ── 5. Helper: stringify a change value the same way as the frontend ─────
    def _stringify(v):
        if v is None or v == "" or v == " ":
            return "-"
        return str(v)

    def _label_field(field):
        """Convert snake_case field name to Title Case label."""
        if not field:
            return "-"
        return " ".join(word.capitalize() for word in str(field).split("_"))

    # ── 6. Helper: parse dispatch change notes string ────────────────────────
    def _parse_dispatch_changes(summary):
        segments = [s.strip() for s in str(summary or "").split(";") if s.strip()]
        result = []
        current_doc_name = None
        for segment in segments:
            # "Dispatch document added (Photo)" or "Dispatch document added"
            doc_added_match = _re.match(
                r"^Dispatch document added(?:\s*\(([^)]+)\))?$", segment, _re.IGNORECASE
            )
            if doc_added_match:
                label = (doc_added_match.group(1) or "").strip() or "Document"
                result.append({
                    "field": label,
                    "sub_field": None,
                    "from": "-",
                    "to": "Added",
                    "action": "added",
                })
                current_doc_name = None
                continue

            # "Dispatch document removed (Photo)" or "Dispatch document removed"
            doc_removed_match = _re.match(
                r"^Dispatch document removed(?:\s*\(([^)]+)\))?$", segment, _re.IGNORECASE
            )
            if doc_removed_match:
                label = (doc_removed_match.group(1) or "").strip() or "Document"
                result.append({
                    "field": label,
                    "sub_field": None,
                    "from": "Attached",
                    "to": "-",
                    "action": "removed",
                })
                current_doc_name = None
                continue

            # "Document Updated (docname): Field: old -> new"
            doc_update_match = _re.match(r"^Document Updated \(([^)]+)\):\s*(.+)$", segment)
            if doc_update_match:
                current_doc_name = doc_update_match.group(1).strip()
                field_change = doc_update_match.group(2).strip()
                field_match = _re.match(r"^([^:]+):\s*(.*?)\s*->\s*(.*)$", field_change)
                if field_match:
                    result.append({
                        "field": current_doc_name,
                        "sub_field": field_match.group(1).strip(),
                        "from": field_match.group(2).strip() or "-",
                        "to": field_match.group(3).strip() or "-",
                    })
                else:
                    result.append({"field": current_doc_name, "sub_field": None, "from": field_change, "to": "-"})
                continue

            if current_doc_name:
                field_match = _re.match(r"^([^:]+):\s*(.*?)\s*->\s*(.*)$", segment)
                if field_match:
                    result.append({
                        "field": current_doc_name,
                        "sub_field": field_match.group(1).strip(),
                        "from": field_match.group(2).strip() or "-",
                        "to": field_match.group(3).strip() or "-",
                    })
                    continue

            matched = _re.match(r"^([^:]+):\s*(.*?)\s*->\s*(.*)$", segment)
            if matched:
                result.append({
                    "field": matched.group(1).strip(),
                    "sub_field": None,
                    "from": matched.group(2).strip() or "-",
                    "to": matched.group(3).strip() or "-",
                })
            else:
                # Plain text segment (e.g. "Dispatch document added") — no arrow
                result.append({
                    "field": segment,
                    "sub_field": None,
                    "from": "-",
                    "to": "-",
                    "action": "info",
                })
        return result

    # ── 7. Main pass: build clean history ────────────────────────────────────
    single_issue_event_kinds = {
        "issue_created",
        "issue_approved",
        "issue_delivered",
        "allocation_rejected",
        "allocation_removed",
        "allocation_request_removed",
    }
    seen_single_issue_event = set()

    history = []

    for item in timeline:
        kind = str(item.get("kind") or "").strip()
        ts = str(item.get("timestamp") or "").strip()

        if not ts:
            continue

        # ── Per-issue single-event dedup ─────────────────────────────────────
        if kind in single_issue_event_kinds:
            dedupe_key = "{}|{}".format(kind, str(item.get("docname") or ""))
            if dedupe_key in seen_single_issue_event:
                continue
            seen_single_issue_event.add(dedupe_key)

        # Resolve display names
        user_id = str(item.get("user") or "").strip()
        user_full_name = (
            str(item.get("user_full_name") or "").strip()
            or (user_id.split("@")[0] if "@" in user_id else user_id)
            or "Unknown"
        )
        guest_full_name = (
            str(item.get("guest_full_name") or "").strip()
            or str(item.get("gift_recipient") or "").strip()
            or "Unknown"
        )

        base = {
            "kind": kind,
            "timestamp": ts,
            "user": user_id,
            "user_full_name": user_full_name,
            "guest_full_name": guest_full_name,
            "gift_recipient": item.get("gift_recipient"),
            "docname": item.get("docname"),
        }

        # ── issue_created ────────────────────────────────────────────────────
        if kind == "issue_created":
            docname = str(item.get("docname") or "")
            kinds_for_this_issue = issue_kinds_by_docname.get(docname, set())
            has_explicit_approval = "issue_approved" in kinds_for_this_issue
            has_allocation_removed = "allocation_removed" in kinds_for_this_issue
            has_allocation_request_removed = "allocation_request_removed" in kinds_for_this_issue

            approval_status_val = str(item.get("approval_status") or "").lower()
            is_approved_on_create = (
                approval_status_val == "approved"
                or (has_allocation_removed and not has_allocation_request_removed)
            ) and not has_explicit_approval

            is_direct = docname in direct_allocation_issue_names

            if is_direct:
                event_type = "issued"
                label = "Gift Allocated"
            elif is_approved_on_create:
                event_type = "issued"
                label = "Allocation Approved"
            else:
                event_type = "issued"
                label = "Allocation Request Raised"

            history.append({
                **base,
                "event_type": event_type,
                "label": label,
            })
            continue

        # ── issue_approved ───────────────────────────────────────────────────
        if kind == "issue_approved":
            docname = str(item.get("docname") or "")
            if docname in direct_allocation_issue_names:
                # Already captured by issue_created as "Gift Allocated" — skip
                continue
            history.append({
                **base,
                "event_type": "issued",
                "label": "Allocation Approved",
            })
            continue

        # ── issue_delivered ──────────────────────────────────────────────────
        if kind == "issue_delivered":
            history.append({
                **base,
                "event_type": "delivered",
                "label": "Delivered",
            })
            continue

        # ── allocation_rejected ──────────────────────────────────────────────
        if kind == "allocation_rejected":
            raw_reason = str(item.get("notes") or "").strip()
            normalized_reason = _re.sub(r"^(Reason:\s*)+", "", raw_reason, flags=_re.IGNORECASE).strip()
            history.append({
                **base,
                "event_type": "rejected",
                "label": "Allocation Rejected",
                "reason": normalized_reason or raw_reason,
            })
            continue

        # ── allocation_removed ───────────────────────────────────────────────
        if kind == "allocation_removed":
            history.append({
                **base,
                "event_type": "rejected",
                "label": "Allocation Removed",
            })
            continue

        # ── allocation_request_removed ───────────────────────────────────────
        if kind == "allocation_request_removed":
            history.append({
                **base,
                "event_type": "modified",
                "label": "Allocation Request Removed",
            })
            continue

        # ── dispatch_details_updated ─────────────────────────────────────────
        if kind == "dispatch_details_updated":
            raw_notes = str(item.get("notes") or "").strip()
            summary = _re.sub(r"^Dispatch details updated:\s*", "", raw_notes, flags=_re.IGNORECASE).strip()
            dispatch_changes = _parse_dispatch_changes(summary)
            history.append({
                **base,
                "event_type": "modified",
                "label": "Dispatch Details Edited",
                "notes_summary": summary,
                "dispatch_changes": dispatch_changes,
            })
            continue

        # ── gift_created ─────────────────────────────────────────────────────
        if kind == "gift_created":
            history.append({
                **base,
                "event_type": "created",
                "label": "Gift Created",
            })
            continue

        # ── interest_created ─────────────────────────────────────────────────
        if kind == "interest_created":
            history.append({
                **base,
                "event_type": "interest",
                "label": "Interest Recorded",
            })
            continue

        # ── interest_removed ─────────────────────────────────────────────────
        if kind == "interest_removed":
            history.append({
                **base,
                "event_type": "modified",
                "label": "Interest Removed",
            })
            continue

        # ── gift_modified ────────────────────────────────────────────────────
        if kind == "gift_modified":
            raw_changes = item.get("changes")
            if isinstance(raw_changes, str):
                try:
                    raw_changes = _json.loads(raw_changes)
                except Exception:
                    raw_changes = []
            changes = raw_changes if isinstance(raw_changes, list) else []

            # Skip if the only/any change is a status field — frontend skips these
            if any(str(c.get("field") or "") == "status" for c in changes):
                continue

            # Find event and event_name change entries to resolve display names
            event_change = next((c for c in changes if str(c.get("field") or "") == "event"), None)
            event_name_change = next((c for c in changes if str(c.get("field") or "") == "event_name"), None)

            structured_changes = []
            for c in changes:
                field_key = str(c.get("field") or "")
                # Drop event_name — we merge it into the event field below
                if field_key == "event_name":
                    continue

                field_label = _label_field(field_key)
                from_v = _stringify(c.get("from"))
                to_v = _stringify(c.get("to"))

                if field_key == "event":
                    # Resolve from-value: prefer event_name.from > from_name > event_name_map > raw
                    if event_name_change:
                        en_from = _stringify(event_name_change.get("from"))
                        if en_from and en_from != "-":
                            from_v = en_from
                        else:
                            from_v = "-"
                    elif c.get("from_name") and str(c.get("from_name")).strip() not in ("", "-"):
                        from_v = str(c.get("from_name")).strip()
                    elif c.get("from") and str(c.get("from")).strip() not in ("", "-"):
                        from_v = event_name_map.get(str(c.get("from")).strip(), _stringify(c.get("from")))
                    else:
                        from_v = "-"

                    # Resolve to-value: prefer event_name.to > to_name > event_name_map > raw
                    if event_name_change:
                        en_to = _stringify(event_name_change.get("to"))
                        if en_to and en_to != "-":
                            to_v = en_to
                        else:
                            to_v = "-"
                    elif c.get("to_name") and str(c.get("to_name")).strip() not in ("", "-"):
                        to_v = str(c.get("to_name")).strip()
                    elif c.get("to") and str(c.get("to")).strip() not in ("", "-"):
                        to_v = event_name_map.get(str(c.get("to")).strip(), _stringify(c.get("to")))
                    else:
                        to_v = "-"

                structured_changes.append({
                    "field": field_label,
                    "from": from_v,
                    "to": to_v,
                })

            history.append({
                **base,
                "event_type": "modified",
                "label": "Gift Modified",
                "changes": structured_changes,
            })
            continue

        # Unknown kind — skip silently (forward compatibility)

    # ── 8. Sort descending by timestamp ──────────────────────────────────────
    def _sort_ts(item):
        ts = item.get("timestamp")
        if not ts:
            return None
        try:
            return frappe.utils.get_datetime(ts)
        except Exception:
            return None

    history.sort(key=lambda x: (_sort_ts(x) is not None, _sort_ts(x)), reverse=True)

    return {"gift": gift_name, "history": history, "total": len(history)}


@frappe.whitelist(allow_guest=False)
def list_salutations(search=None, limit=50):
    """List Salutation options (from core Salutation doctype)."""
    search = (search or "").strip()
    limit = int(limit or 50)
    filters = {}
    if search:
        filters["salutation"] = ["like", f"%{search}%"]

    rows = frappe.get_all(
        "Salutation",
        filters=filters,
        fields=["name", "salutation"],
        order_by="salutation asc",
        limit_page_length=limit,
        ignore_permissions=True,
    )

    # Frappe Salutation typically uses `name` == `salutation`, but keep both for safety.
    return {
        "salutations": [r.get("salutation") or r.get("name") for r in (rows or []) if (r.get("salutation") or r.get("name"))]
    }


@frappe.whitelist(allow_guest=False)
def bulk_approve_gift_issues(issue_names):
    """Bulk approve multiple gift issues at once.
    
    Args:
        issue_names: List of Gift Issue names to approve
        
    Returns:
        {
            "success": list of approved issue names,
            "failed": list of {issue, error} for failures,
            "message": summary message
        }
    """
    if not issue_names:
        frappe.throw(_("Issue names are required"))
    
    if isinstance(issue_names, str):
        import json
        try:
            issue_names = json.loads(issue_names)
        except Exception:
            frappe.throw(_("Invalid issue_names format"))
    
    if not isinstance(issue_names, list) or len(issue_names) == 0:
        frappe.throw(_("Issue names must be a non-empty list"))
    
    success = []
    failed = []
    
    for issue_name in issue_names:
        try:
            if not frappe.db.exists("Gift Issue", issue_name):
                failed.append({"issue": issue_name, "error": "Gift Issue not found"})
                continue
                
            issue = frappe.get_doc("Gift Issue", issue_name)
            issue.approve_issue()
            success.append(issue_name)
        except Exception as e:
            failed.append({"issue": issue_name, "error": str(e)})
    
    return {
        "success": success,
        "failed": failed,
        "message": _("Approved {0} of {1} issues").format(len(success), len(issue_names))
    }


@frappe.whitelist(allow_guest=False)
def bulk_reject_gift_issues(issue_names, reason):
    """Bulk reject multiple gift issues at once.
    
    Args:
        issue_names: List of Gift Issue names to reject
        reason: Rejection reason (applies to all)
        
    Returns:
        {
            "success": list of rejected issue names,
            "failed": list of {issue, error} for failures,
            "message": summary message
        }
    """
    if not issue_names:
        frappe.throw(_("Issue names are required"))
    
    if not reason:
        frappe.throw(_("Rejection reason is required"))
    
    if isinstance(issue_names, str):
        import json
        try:
            issue_names = json.loads(issue_names)
        except Exception:
            frappe.throw(_("Invalid issue_names format"))
    
    if not isinstance(issue_names, list) or len(issue_names) == 0:
        frappe.throw(_("Issue names must be a non-empty list"))
    
    success = []
    failed = []
    
    for issue_name in issue_names:
        try:
            if not frappe.db.exists("Gift Issue", issue_name):
                failed.append({"issue": issue_name, "error": "Gift Issue not found"})
                continue
                
            issue = frappe.get_doc("Gift Issue", issue_name)
            issue.reject_issue(reason)
            success.append(issue_name)
        except Exception as e:
            failed.append({"issue": issue_name, "error": str(e)})
    
    return {
        "success": success,
        "failed": failed,
        "message": _("Rejected {0} of {1} issues").format(len(success), len(issue_names))
    }


@frappe.whitelist(allow_guest=False)
def clear_all_notifications():
    """Clear all Notification Log entries for the current user in a single database operation.
    
    Returns:
        {
            "deleted_count": number of notifications deleted,
            "message": summary message
        }
    """
    user = frappe.session.user
    
    if not user or user == "Guest":
        frappe.throw(_("User not authenticated"))
    
    # Get all notification names for the current user
    notifications = frappe.get_all(
        "Notification Log",
        filters={"for_user": user},
        fields=["name"],
        limit_page_length=0  # No limit
    )
    
    if not notifications:
        return {"deleted_count": 0, "message": _("No notifications to clear")}
    
    # Delete all notifications in a single transaction using frappe.db.sql for efficiency
    notification_names = [n.name for n in notifications]
    
    # Use parameterized query to prevent SQL injection
    placeholders = ', '.join(['%s'] * len(notification_names))
    
    try:
        # Delete from Notification Log table
        frappe.db.sql(f"""
            DELETE FROM `tabNotification Log`
            WHERE name IN ({placeholders})
        """, tuple(notification_names))
        
        # Also delete any related Notification Settings entries if needed
        frappe.db.commit()
        
        return {
            "deleted_count": len(notification_names),
            "message": _("Cleared {0} notifications").format(len(notification_names))
        }
    except Exception as e:
        frappe.db.rollback()
        frappe.throw(_("Failed to clear notifications: {0}").format(str(e)))

