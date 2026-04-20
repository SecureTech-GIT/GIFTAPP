# frappe-bench/apps/gift/gift/api/gift.py

import os
import re
import base64
import mimetypes

import frappe
from frappe import _

from gift.gift.event_permissions import get_user_visible_event_names

@frappe.whitelist(allow_guest=False)
def get_dashboard_counts():
    """
    Get accurate dashboard counts
    Ensures Gift and Gift Received are counted separately
    """
    
    user = frappe.session.user
    roles = set(frappe.get_roles(user))

    has_global_visibility = user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles
    has_event_role = has_global_visibility or "Event Coordinator" in roles

    if not has_event_role:
        return {
            'totalGifts': 0,
            'availableGifts': 0,
            'issuedGifts': 0,
            'inTransitGifts': 0,
            'deliveredGifts': 0,
            'reservedGifts': 0,
            'totalReceivedGifts': 0,
            'totalRecipients': 0,
            'totalCategories': 0,
            'totalIssues': 0,
            'totalDispatches': 0,
            'inTransitDispatches': 0,
        }

    allowed_events = None
    if not has_global_visibility:
        allowed_events = get_user_visible_event_names(user)
        if not allowed_events:
            return {
                'totalGifts': 0,
                'availableGifts': 0,
                'issuedGifts': 0,
                'inTransitGifts': 0,
                'deliveredGifts': 0,
                'reservedGifts': 0,
                'totalReceivedGifts': 0,
                'totalRecipients': 0,
                'totalCategories': 0,
                'totalIssues': 0,
                'totalDispatches': 0,
                'inTransitDispatches': 0,
            }

    gift_filters_base = {}
    recipient_filters_base = {}
    issue_filters_base = {}
    dispatch_filters_base = {}
    if allowed_events is not None:
        gift_filters_base["event"] = ["in", allowed_events]
        recipient_filters_base["event"] = ["in", allowed_events]
        issue_filters_base["event"] = ["in", allowed_events]
        dispatch_filters_base["event"] = ["in", allowed_events]

    # Count from Gift doctype ONLY
    total_gifts = frappe.db.count('Gift', gift_filters_base)
    available_gifts = frappe.db.count('Gift', {**gift_filters_base, 'status': 'Available'})
    issued_gifts = frappe.db.count('Gift', {**gift_filters_base, 'status': 'Issued'})
    in_transit_gifts = frappe.db.count('Gift', {**gift_filters_base, 'status': 'In Transit'})
    delivered_gifts = frappe.db.count('Gift', {**gift_filters_base, 'status': 'Delivered'})
    reserved_gifts = frappe.db.count('Gift', {**gift_filters_base, 'status': 'Reserved'})
    
    # Count from Gift Received doctype (completely separate)
    received_gifts = frappe.db.count('Gift Received')
    
    # Other counts
    recipients = frappe.db.count('Gift Recipient', recipient_filters_base)
    categories = frappe.db.count('Gift Category')
    issues = frappe.db.count('Gift Issue', issue_filters_base)
    dispatches = frappe.db.count('Gift Dispatch', dispatch_filters_base)
    in_transit_dispatches = frappe.db.count('Gift Dispatch', {**dispatch_filters_base, 'dispatch_status': 'In Transit'})
    
    return {
        'totalGifts': total_gifts,
        'availableGifts': available_gifts,
        'issuedGifts': issued_gifts,
        'inTransitGifts': in_transit_gifts,
        'deliveredGifts': delivered_gifts,
        'reservedGifts': reserved_gifts,
        'totalReceivedGifts': received_gifts,
        'totalRecipients': recipients,
        'totalCategories': categories,
        'totalIssues': issues,
        'totalDispatches': dispatches,
        'inTransitDispatches': in_transit_dispatches,
    }


def _inline_html_resources(html):
    """
    Read CSS and image files from the filesystem and embed them directly into the HTML.
    This makes the HTML fully self-contained so wkhtmltopdf needs zero network requests,
    avoiding SSL / connection errors on both localhost and HTTPS production servers.
    """
    bench_path = frappe.utils.get_bench_path()
    site_path = frappe.get_site_path()

    def get_fs_path(url_path):
        path = url_path.split("?")[0].split("#")[0]
        if path.startswith("/assets/"):
            parts = path[len("/assets/"):].split("/", 1)
            if len(parts) == 2:
                app_name, asset_path = parts
                for candidate in [
                    os.path.join(bench_path, "apps", app_name, app_name, "public", asset_path),
                    os.path.join(bench_path, "sites", "assets", app_name, asset_path),
                ]:
                    if os.path.exists(candidate):
                        return candidate
        elif path.startswith("/files/"):
            p = os.path.join(site_path, "public", "files", path[len("/files/"):])
            if os.path.exists(p):
                return p
        elif path.startswith("/private/files/"):
            p = os.path.join(site_path, "private", "files", path[len("/private/files/"):])
            if os.path.exists(p):
                return p
        return None

    # Inline <link rel="stylesheet" href="..."> → <style>...</style>
    def replace_link(m):
        href = m.group(1)
        fp = get_fs_path(href)
        if fp:
            try:
                with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                    return f"<style>{f.read()}</style>"
            except Exception:
                pass
        return m.group(0)

    html = re.sub(
        r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\'][^>]*/?>',
        replace_link, html, flags=re.IGNORECASE,
    )
    html = re.sub(
        r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']stylesheet["\'][^>]*/?>',
        replace_link, html, flags=re.IGNORECASE,
    )

    # Inline src="/assets/..." or src="/files/..." → base64 data URI
    def replace_src(m):
        attr, q, url_path = m.group(1), m.group(2), m.group(3)
        fp = get_fs_path(url_path)
        if fp:
            try:
                mime, _ = mimetypes.guess_type(fp)
                mime = mime or "application/octet-stream"
                with open(fp, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode()
                return f'{attr}={q}data:{mime};base64,{b64}{q}'
            except Exception:
                pass
        return m.group(0)

    html = re.sub(
        r'(src)=(["\'])(/(?:assets|files|private/files)/[^"\']+)\2',
        replace_src, html,
    )

    return html


@frappe.whitelist(allow_guest=False)
def download_certificate(gift_issue_name):
    """
    Download the Delivered Gift Certificate PDF directly.
    This returns the PDF with proper headers for mobile browser download.
    
    Args:
        gift_issue_name: Name of the Gift Issue document
        
    Returns:
        PDF file as response with Content-Disposition: attachment
    """
    try:
        # Verify the Gift Issue exists and user has permission
        if not frappe.db.exists("Gift Issue", gift_issue_name):
            frappe.throw(_("Gift Issue not found"), frappe.DoesNotExistError)
        
        issue_doc = frappe.get_doc("Gift Issue", gift_issue_name)
        
        # Check if the gift is delivered
        gift_status = frappe.db.get_value("Gift", issue_doc.gift, "status")
        if gift_status != "Delivered":
            frappe.throw(_("Certificate is only available for delivered gifts"), frappe.PermissionError)
        
        # Verify user has access to this gift's event
        user = frappe.session.user
        roles = set(frappe.get_roles(user))
        has_global_access = user == "Administrator" or "System Manager" in roles or "Event Manager" in roles
        
        if not has_global_access and issue_doc.event:
            allowed_events = get_user_visible_event_names(user)
            if issue_doc.event not in allowed_events:
                frappe.throw(_("You do not have access to this gift"), frappe.PermissionError)
        
        # Generate the PDF using Frappe's print format
        html = frappe.get_print(
            doctype="Gift Issue",
            name=gift_issue_name,
            print_format="Delivered Gift Certificate",
            no_letterhead=1
        )

        # Inline all CSS and images from filesystem so wkhtmltopdf makes zero network requests.
        # This avoids SslHandshakeFailedError on HTTPS servers and ConnectionRefusedError on localhost.
        html = _inline_html_resources(html)

        # Convert HTML to PDF
        pdf = frappe.utils.pdf.get_pdf(html, options={"enable-local-file-access": ""})
        
        # Set response headers for download
        frappe.local.response.filename = f"Gift_Certificate_{gift_issue_name}.pdf"
        frappe.local.response.filecontent = pdf
        frappe.local.response.type = "pdf"
        
    except Exception as e:
        frappe.log_error(message=str(e), title="Download Certificate Error")
        frappe.throw(_("Failed to generate certificate: {0}").format(str(e)))
