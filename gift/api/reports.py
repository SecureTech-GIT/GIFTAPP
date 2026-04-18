# gift/api/reports.py
 
import frappe
from frappe import _
from frappe.utils import cint, get_url, now_datetime, get_datetime_str
import os
import base64
import mimetypes
import csv
from io import StringIO
from gift.gift.event_permissions import get_user_visible_event_names, has_event_access


def format_datetime_for_csv(datetime_obj):
    """
    Format datetime for CSV export in a timezone-aware way.
    Uses ISO format with timezone information to ensure consistency across timezones.
    """
    if not datetime_obj:
        return ""
    
    # Convert to string in ISO format with timezone
    # This ensures the datetime is properly represented for users in any timezone
    return get_datetime_str(datetime_obj)


def format_date_only(datetime_obj):
    """
    Format datetime as date only (YYYY-MM-DD).
    For fields that only need the date portion.
    """
    if not datetime_obj:
        return ""
    
    from frappe.utils import getdate
    dt = getdate(datetime_obj)
    return dt.strftime("%Y-%m-%d")


def format_datetime_minutes(datetime_obj):
    """
    Format datetime with date and time (hours:minutes only).
    Removes seconds and microseconds for cleaner display.
    """
    if not datetime_obj:
        return ""
    
    from frappe.utils import get_datetime
    dt = get_datetime(datetime_obj)
    return dt.strftime("%Y-%m-%d %H:%M")


def _file_url_to_base64_data_uri(file_url: str) -> str:
    if not file_url:
        return ""

    try:
        if file_url.startswith("http://") or file_url.startswith("https://"):
            return ""

        is_private = False
        if file_url.startswith("/private/files/"):
            rel = file_url.replace("/private/files/", "", 1)
            is_private = True
            full_path = frappe.get_site_path("private", "files", rel)
        elif file_url.startswith("/files/"):
            rel = file_url.replace("/files/", "", 1)
            full_path = frappe.get_site_path("public", "files", rel)
        else:
            rel = file_url.lstrip("/")
            full_path = frappe.get_site_path("public", "files", rel)

        if rel.startswith("/") or ".." in rel.replace("\\", "/").split("/"):
            return ""

        if is_private:
            if frappe.session.user == "Guest":
                return ""
            file_docname = frappe.db.get_value("File", {"file_url": file_url}, "name")
            if file_docname and not frappe.has_permission("File", "read", file_docname):
                return ""

        if not os.path.exists(full_path):
            return ""

        with open(full_path, "rb") as f:
            raw = f.read()

        mime, _ = mimetypes.guess_type(full_path)
        if not mime:
            mime = "image/png"

        encoded = base64.b64encode(raw).decode("utf-8")
        return f"data:{mime};base64,{encoded}"
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Report: file_url to base64 failed")
        return ""


# ============================================================================
# 1. GIFT INTEREST REPORT
# ============================================================================

# ... (rest of the code remains the same)

# ============================================================================
# 8. GIFT LOCATION TIMELINE REPORT
# ============================================================================

@frappe.whitelist(allow_guest=False)
def get_gift_location_timeline(gift):
    """Gift Location Timeline - Show complete movement history of a gift"""
    try:
        if not gift:
            frappe.throw(_("Gift ID is required"))

        if not frappe.db.exists("Gift", gift):
            frappe.throw(_("Gift not found"), frappe.DoesNotExistError)

        gift_doc = frappe.get_doc("Gift", gift)
        if not gift_doc.has_permission("read", frappe.session.user):
            frappe.throw(_("You do not have access to this gift"), frappe.PermissionError)

        timeline = frappe.db.get_all(
            "Gift Store",
            filters={"gift": gift},
            fields=[
                "name",
                "gift",
                "transaction_type",
                "from_warehouse",
                "to_warehouse",
                "from_location",
                "to_location",
                "transaction_date",
                "reason",
                "owner",
                "creation",
            ],
            order_by="transaction_date desc, creation desc",
        )

        for entry in timeline:
            for field in ["transaction_date", "creation"]:
                if entry.get(field):
                    entry[field] = format_datetime_minutes(entry[field])

        return {"data": timeline}

    except Exception as e:
        frappe.log_error(f"Error in get_gift_location_timeline: {str(e)}")
        frappe.throw(_("Failed to fetch gift location timeline: {0}").format(str(e)))


# ============================================================================
# 10. ALLOCATION REPORT (APPROVED ISSUES ONLY)
# ============================================================================


@frappe.whitelist(allow_guest=False)
def get_allocation_report(
    page=1,
    limit=100,
    gift=None,
    recipient_name=None,
    event=None,
    from_date=None,
    to_date=None,
    status=None,
    order_by="approved_on",
    sort_order="desc",
):
    """Allocation Report - Approved issues only"""
    try:
        page = cint(page) or 1
        limit = cint(limit) or 100
        start = (page - 1) * limit

        user = frappe.session.user
        roles = set(frappe.get_roles(user))
        has_global = user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles
        allowed_events = None
        if not has_global:
            allowed_events = get_user_visible_event_names(user)
            if not allowed_events:
                return {"data": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}

        conditions = [
            "gi.docstatus != 2",
            "gi.approval_status = 'Approved'",
        ]
        params = {}

        gift_list = [g.strip() for g in gift.split(",") if g.strip()] if gift else []
        if gift_list:
            if len(gift_list) == 1:
                conditions.append("gi.gift = %(gift)s")
                params["gift"] = gift_list[0]
            else:
                conditions.append("gi.gift IN %(gift_list)s")
                params["gift_list"] = tuple(gift_list)

        if recipient_name:
            conditions.append("gi.guest_name LIKE %(recipient_name)s")
            params["recipient_name"] = f"%{recipient_name}%"

        # Parse comma-separated multi-select values
        event_list = [e.strip() for e in event.split(",") if e.strip()] if event else []
        status_list = [s.strip() for s in status.split(",") if s.strip()] if status else []

        if event_list:
            if allowed_events is not None:
                event_list = [e for e in event_list if e in allowed_events]
                if not event_list:
                    return {"data": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}
            if len(event_list) == 1:
                conditions.append("gi.event = %(event)s")
                params["event"] = event_list[0]
            else:
                conditions.append("gi.event IN %(event_list)s")
                params["event_list"] = tuple(event_list)
        elif allowed_events is not None:
            conditions.append("gi.event IN %(allowed_events)s")
            params["allowed_events"] = tuple(allowed_events)

        if status_list:
            if len(status_list) == 1:
                conditions.append("gi.status = %(status)s")
                params["status"] = status_list[0]
            else:
                conditions.append("gi.status IN %(status_list)s")
                params["status_list"] = tuple(status_list)

        if from_date:
            conditions.append("gi.date >= %(from_date)s")
            params["from_date"] = from_date

        if to_date:
            conditions.append("gi.date <= %(to_date)s")
            params["to_date"] = to_date

        where_clause = " AND ".join(conditions)

        count_query = f"""
            SELECT COUNT(*) as total
            FROM `tabGift Issue` gi
            WHERE {where_clause}
        """
        total = frappe.db.sql(count_query, params, as_dict=True)[0]["total"]

        order_direction = "ASC" if (sort_order or "").upper() == "ASC" else "DESC"

        allowed_order_by = {
            "approved_on",
            "date",
            "status",
            "gift",
            "gift_name",
            "category",
            "guest_name",
            "event",
            "event_name",
            "delivery_method",
            "approved_by",
        }
        if order_by not in allowed_order_by:
            order_by = "approved_on"

        data_query = f"""
            SELECT
                gi.name as issue_id,
                gi.date as issue_date,
                gi.gift,
                gi.gift_name,
                g.uae_ring_number as ring_number,
                g.barcode_value as barcode_id,
                gi.category,
                gi.guest_name as guest_name,
                gi.event_name,
                gi.delivery_method,
                gi.status,
                gi.approved_by,
                gi.approved_on
            FROM `tabGift Issue` gi
            LEFT JOIN `tabGift` g ON g.name = gi.gift
            WHERE {where_clause}
            ORDER BY gi.{order_by} {order_direction}
            LIMIT %(limit)s OFFSET %(start)s
        """

        params.update({"limit": limit, "start": start})
        rows = frappe.db.sql(data_query, params, as_dict=True)

        for r in rows:
            # Format issue_date as date only (no time)
            if r.get("issue_date"):
                r["issue_date"] = format_date_only(r["issue_date"])
            # Format approved_on with date and time (hours:minutes only)
            if r.get("approved_on"):
                r["approved_on"] = format_datetime_minutes(r["approved_on"])

        return {
            "data": rows,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit,
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error in get_allocation_report")
        frappe.throw(_("Failed to fetch allocation report: {0}").format(str(e)))


# ============================================================================
# 11. GIFT MOVEMENT REPORT (EVENT HISTORY)
# ============================================================================


@frappe.whitelist(allow_guest=False)
def get_gift_movement_report(
    page=1,
    limit=100,
    gift=None,
    event=None,
    from_date=None,
    to_date=None,
    order_by="moved_on",
    sort_order="desc",
):
    """Gift Movement Report - Gift Event History like"""
    try:
        page = cint(page) or 1
        limit = cint(limit) or 100
        start = (page - 1) * limit

        user = frappe.session.user
        roles = set(frappe.get_roles(user))
        has_global = user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles
        allowed_events = None
        if not has_global:
            allowed_events = get_user_visible_event_names(user)
            if not allowed_events:
                return {"data": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}

        conditions = ["geh.docstatus != 2"]
        params = {}

        gift_list = [g.strip() for g in gift.split(",") if g.strip()] if gift else []
        if gift_list:
            if len(gift_list) == 1:
                conditions.append("geh.parent = %(gift)s")
                params["gift"] = gift_list[0]
            else:
                conditions.append("geh.parent IN %(gift_list)s")
                params["gift_list"] = tuple(gift_list)

        event_list = [e.strip() for e in event.split(",") if e.strip()] if event else []

        if event_list:
            if allowed_events is not None:
                event_list = [e for e in event_list if e in allowed_events]
                if not event_list:
                    return {"data": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}
            if len(event_list) == 1:
                conditions.append("(geh.from_event = %(event)s OR geh.to_event = %(event)s)")
                params["event"] = event_list[0]
            else:
                conditions.append("(geh.from_event IN %(event_list)s OR geh.to_event IN %(event_list)s)")
                params["event_list"] = tuple(event_list)
        elif allowed_events is not None:
            conditions.append("(geh.from_event IN %(allowed_events)s OR geh.to_event IN %(allowed_events)s)")
            params["allowed_events"] = tuple(allowed_events)

        if from_date:
            conditions.append("geh.moved_on >= %(from_date)s")
            params["from_date"] = from_date

        if to_date:
            # Append time to include full day (so same start/end date fetches that day's records)
            conditions.append("geh.moved_on <= %(to_date)s")
            params["to_date"] = to_date + " 23:59:59"

        where_clause = " AND ".join(conditions)

        count_query = f"""
            SELECT COUNT(*) as total
            FROM `tabGift Event History` geh
            WHERE {where_clause}
        """
        total = frappe.db.sql(count_query, params, as_dict=True)[0]["total"]

        order_direction = "ASC" if (sort_order or "").upper() == "ASC" else "DESC"

        allowed_order_by = {
            "moved_on",
            "from_event",
            "to_event",
            "parent",
            "parent_name",
            "category",
            "status",
        }
        if order_by not in allowed_order_by:
            order_by = "moved_on"

        data_query = f"""
            SELECT
                geh.parent as gift,
                g.gift_id as gift_code,
                g.gift_name,
                g.uae_ring_number as ring_number,
                g.barcode_value as barcode_id,
                g.category,
                g.status,
                COALESCE(fe.subject, geh.from_event) as from_event,
                COALESCE(te.subject, geh.to_event) as to_event,
                geh.moved_on,
                geh.moved_by,
                u.full_name as moved_by_name,
                geh.remarks
            FROM `tabGift Event History` geh
            LEFT JOIN `tabGift` g ON g.name = geh.parent
            LEFT JOIN `tabUser` u ON u.name = geh.moved_by
            LEFT JOIN `tabGift Event` fe ON fe.name = geh.from_event
            LEFT JOIN `tabGift Event` te ON te.name = geh.to_event
            WHERE {where_clause}
            ORDER BY geh.{order_by} {order_direction}
            LIMIT %(limit)s OFFSET %(start)s
        """

        params.update({"limit": limit, "start": start})
        rows = frappe.db.sql(data_query, params, as_dict=True)
        for r in rows:
            if r.get("moved_on"):
                r["moved_on"] = format_datetime_minutes(r["moved_on"])

        return {
            "data": rows,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit,
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error in get_gift_movement_report")
        frappe.throw(_("Failed to fetch gift movement report: {0}").format(str(e)))


# ============================================================================
# 12. COLLECTION REPORT (STATUS-WISE)
# ============================================================================


@frappe.whitelist(allow_guest=False)
def get_collection_report(
    page=1,
    limit=100,
    status=None,
    category=None,
    event=None,
    gift_id=None,
    barcode_value=None,
    order_by="modified",
    sort_order="desc",
):
    """Collection Report - Gift report status wise"""
    try:
        page = cint(page) or 1
        limit = cint(limit) or 100
        start = (page - 1) * limit

        user = frappe.session.user
        roles = set(frappe.get_roles(user))
        has_global = user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles
        allowed_events = None
        if not has_global:
            allowed_events = get_user_visible_event_names(user)
            if not allowed_events:
                return {"data": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}

        conditions = ["g.docstatus != 2"]
        params = {}

        event_list = [e.strip() for e in event.split(",") if e.strip()] if event else []
        status_list = [s.strip() for s in status.split(",") if s.strip()] if status else []
        category_list = [c.strip() for c in category.split(",") if c.strip()] if category else []

        if status_list:
            if len(status_list) == 1:
                conditions.append("g.status = %(status)s")
                params["status"] = status_list[0]
            else:
                conditions.append("g.status IN %(status_list)s")
                params["status_list"] = tuple(status_list)

        if category_list:
            if len(category_list) == 1:
                conditions.append("g.category = %(category)s")
                params["category"] = category_list[0]
            else:
                conditions.append("g.category IN %(category_list)s")
                params["category_list"] = tuple(category_list)

        if event_list:
            if allowed_events is not None:
                event_list = [e for e in event_list if e in allowed_events]
                if not event_list:
                    return {"data": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}
            if len(event_list) == 1:
                conditions.append("g.event = %(event)s")
                params["event"] = event_list[0]
            else:
                conditions.append("g.event IN %(event_list)s")
                params["event_list"] = tuple(event_list)
        elif allowed_events is not None:
            conditions.append("g.event IN %(allowed_events)s")
            params["allowed_events"] = tuple(allowed_events)

        if gift_id:
            conditions.append("(g.name LIKE %(gift_id)s OR g.gift_id LIKE %(gift_id)s)")
            params["gift_id"] = f"%{gift_id}%"

        if barcode_value:
            conditions.append("g.barcode_value LIKE %(barcode_value)s")
            params["barcode_value"] = f"%{barcode_value}%"

        where_clause = " AND ".join(conditions)

        count_query = f"""
            SELECT COUNT(*) as total
            FROM `tabGift` g
            WHERE {where_clause}
        """
        total = frappe.db.sql(count_query, params, as_dict=True)[0]["total"]

        order_direction = "ASC" if (sort_order or "").upper() == "ASC" else "DESC"

        allowed_order_by = {
            "modified",
            "creation",
            "status",
            "category",
            "event",
            "gift_id",
            "barcode_value",
        }
        if order_by not in allowed_order_by:
            order_by = "modified"

        data_query = f"""
            SELECT
                g.name as gift,
                g.gift_id as gift_code,
                g.gift_name,
                g.uae_ring_number as ring_number,
                g.barcode_value as barcode_id,
                g.category,
                g.status,
                g.event_name,
                g.barcode,
                g.modified
            FROM `tabGift` g
            WHERE {where_clause}
            ORDER BY g.{order_by} {order_direction}
            LIMIT %(limit)s OFFSET %(start)s
        """

        params.update({"limit": limit, "start": start})
        gifts = frappe.db.sql(data_query, params, as_dict=True)

        for g in gifts:
            if g.get("modified"):
                g["modified"] = format_datetime_minutes(g["modified"])

            # Replace barcode url with base64 image payload for UI rendering
            barcode_url = g.pop("barcode", None)
            g["barcode_image"] = _file_url_to_base64_data_uri(barcode_url)

        return {
            "data": gifts,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit,
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error in get_collection_report")
        frappe.throw(_("Failed to fetch collection report: {0}").format(str(e)))


# ============================================================================
# 9. GIFT RECIPIENT REPORT
# ============================================================================
# ... (rest of the code remains the same)

@frappe.whitelist(allow_guest=False)
def get_gift_recipient_report(
    page=1,
    limit=100,
    recipient_name=None,
    emirates_id=None,
    mobile_number=None,
    order_by="creation",
    sort_order="desc",
):
    """Gift Recipient Report - Master list of all recipients"""
    try:
        page = cint(page) or 1
        limit = cint(limit) or 100
        start = (page - 1) * limit

        user = frappe.session.user
        roles = set(frappe.get_roles(user))
        has_global = user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles
        allowed_events = None
        if not has_global:
            allowed_events = get_user_visible_event_names(user)
            if not allowed_events:
                return {"data": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}

        conditions = ["gr.docstatus != 2"]
        params = {}

        if allowed_events is not None:
            conditions.append("gr.event IN %(allowed_events)s")
            params["allowed_events"] = tuple(allowed_events)

        if recipient_name:
            conditions.append("(gr.owner_full_name LIKE %(recipient_name)s OR gr.coordinator_full_name LIKE %(recipient_name)s)")
            params["recipient_name"] = f"%{recipient_name}%"

        if emirates_id:
            conditions.append("gr.coordinator_emirates_id = %(emirates_id)s")
            params["emirates_id"] = emirates_id

        if mobile_number:
            conditions.append("gr.coordinator_mobile_no LIKE %(mobile_number)s")
            params["mobile_number"] = f"%{mobile_number}%"

        where_clause = " AND ".join(conditions)

        count_query = f"""
            SELECT COUNT(*) as total
            FROM `tabGift Recipient` gr
            WHERE {where_clause}
        """

        total = frappe.db.sql(count_query, params, as_dict=True)[0]["total"]

        order_direction = "ASC" if (sort_order or "").upper() == "ASC" else "DESC"

        allowed_order_by = {
            "creation",
            "modified",
            "owner_full_name",
            "coordinator_full_name",
            "coordinator_emirates_id",
            "coordinator_mobile_no",
        }
        if order_by not in allowed_order_by:
            order_by = "creation"

        data_query = f"""
            SELECT
                gr.name as recipient_id,
                gr.owner_full_name,
                gr.coordinator_full_name,
                gr.coordinator_emirates_id,
                gr.coordinator_mobile_no,
                gr.address,
                gr.person_photo,
                (SELECT COUNT(*) FROM `tabGift Issue` WHERE gift_recipient = gr.name) as total_gifts_issued,
                (SELECT COUNT(*) FROM `tabGift Interest` WHERE gift_recipient = gr.name) as total_interests,
                gr.creation,
                gr.modified
            FROM `tabGift Recipient` gr
            WHERE {where_clause}
            ORDER BY gr.{order_by} {order_direction}
            LIMIT %(limit)s OFFSET %(start)s
        """

        params.update({"limit": limit, "start": start})
        recipients = frappe.db.sql(data_query, params, as_dict=True)

        for recipient in recipients:
            for field in ["creation", "modified"]:
                if recipient.get(field):
                    recipient[field] = format_datetime_minutes(recipient[field])

            if recipient.get("person_photo"):
                recipient["photo_url"] = get_url(recipient["person_photo"])
            else:
                recipient["photo_url"] = None

        if not has_global:
            for recipient in recipients:
                eid = recipient.get("coordinator_emirates_id") or ""
                recipient["coordinator_emirates_id"] = ("***" + eid[-4:]) if len(eid) > 4 else ("***" if eid else None)

        return {
            "data": recipients,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit,
        }

    except Exception as e:
        frappe.log_error(f"Error in get_gift_recipient_report: {str(e)}")
        frappe.throw(_("Failed to fetch gift recipient report: {0}").format(str(e)))

# ============================================================================
# CSV EXPORT UTILITIES
# ============================================================================


def clean_filters(filters: dict) -> dict:
    """Remove frappe-injected and invalid RPC params"""
    blocked_keys = {
        "cmd",
        "_",
        "doctype",
        "name",
        "owner",
        "creation",
        "modified",
        "modified_by",
    }
    return {k: v for k, v in filters.items() if k not in blocked_keys}

def flatten_dict(data, parent_key='', sep='_'):
    """Flatten nested dictionaries for CSV export"""
    items = []
    for k, v in data.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list) and v and isinstance(v[0], dict):
            # For child tables, create comma-separated strings
            items.append((new_key, "; ".join([str(item) for item in v])))
        else:
            items.append((new_key, v))
    return dict(items)

@frappe.whitelist(allow_guest=False)
def export_gift_interest_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        result = get_gift_interest_report(**filters)
        data = result.get("data", [])

        if not data:
            frappe.throw(_("No data to export"))

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        frappe.response.update({
            "filename": f"gift_interest_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
            "result": output.getvalue(), 
        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Gift Interest CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))


@frappe.whitelist(allow_guest=False)
def export_gift_issue_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        data = get_gift_issue_report(**filters).get("data", [])
        if not data:
            frappe.throw(_("No data to export"))

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        frappe.response.update({
            "filename": f"gift_issue_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
             "result": output.getvalue(), 
        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Gift Issue CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))


@frappe.whitelist(allow_guest=False)
def export_gift_dispatch_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        data = get_gift_dispatch_report(**filters).get("data", [])
        if not data:
            frappe.throw(_("No data to export"))

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        frappe.response.update({
            "filename": f"gift_dispatch_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
             "result": output.getvalue(), 
        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Gift Dispatch CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))


@frappe.whitelist(allow_guest=False)
def export_gift_maintenance_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        data = get_gift_maintenance_report(**filters).get("data", [])
        if not data:
            frappe.throw(_("No data to export"))

        rows = []
        for row in data:
            r = row.copy()
            meds = r.pop("medications", [])
            r["medications"] = "; ".join(
                f"{m['medication_name']} ({m['dosage']}, {m['frequency']})"
                for m in meds
            )
            rows.append(r)

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

        frappe.response.update({
            "filename": f"gift_maintenance_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
             "result": output.getvalue(), 
        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Gift Maintenance CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))


@frappe.whitelist(allow_guest=False)
def export_gift_recipient_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        result = get_gift_recipient_report(**filters)
        data = result.get("data", [])

        if not data:
            frappe.throw(_("No data to export"))

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        frappe.response.update({
            "filename": f"gift_recipient_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
             "result": output.getvalue(), 
        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Gift Recipient CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))

@frappe.whitelist(allow_guest=False)
def export_barcode_print_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        result = get_barcode_print_report(**filters)
        data = result.get("data", [])

        if not data:
            frappe.throw(_("No data to export"))

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        frappe.response.update({
            "filename": f"barcode_print_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
             "result": output.getvalue(), 
        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Barcode Print CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))


@frappe.whitelist(allow_guest=False)
def export_pending_delivery_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        result = get_pending_delivery_report(**filters)
        data = result.get("data", [])

        if not data:
            frappe.throw(_("No data to export"))

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        frappe.response.update({
            "filename": f"pending_delivery_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
             "result": output.getvalue(), 

        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Pending Delivery CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))


@frappe.whitelist(allow_guest=False)
def export_allocation_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        data = get_allocation_report(**filters).get("data", [])
        if not data:
            frappe.throw(_("No data to export"))

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        frappe.response.update({
            "filename": f"allocation_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
            "result": output.getvalue(),
        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Allocation CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))


@frappe.whitelist(allow_guest=False)
def export_gift_movement_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        data = get_gift_movement_report(**filters).get("data", [])
        if not data:
            frappe.throw(_("No data to export"))

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        frappe.response.update({
            "filename": f"gift_movement_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
            "result": output.getvalue(),
        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Gift Movement CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))


@frappe.whitelist(allow_guest=False)
def export_collection_to_csv(**filters):
    try:
        filters = clean_filters(filters)
        filters.update({"page": 1, "limit": 999999})

        data = get_collection_report(**filters).get("data", [])
        if not data:
            frappe.throw(_("No data to export"))

        # For CSV export, barcode_image (data URI) is too large/noisy. Remove it.
        rows = []
        for row in data:
            r = row.copy()
            r.pop("barcode_image", None)
            rows.append(r)

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

        frappe.response.update({
            "filename": f"collection_report_{now_datetime().strftime('%Y%m%d_%H%M%S')}.csv",
            "filecontent": output.getvalue(),
            "type": "csv",
            "doctype": "Report",
            "result": output.getvalue(),
        })

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Collection CSV Export")
        frappe.throw(_("Failed to export CSV: {0}").format(e))

