# -*- coding: utf-8 -*-
# Copyright (c) 2025, ABM Tech and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from gift.gift.event_permissions import get_user_visible_event_names


@frappe.whitelist(allow_guest=False)
def get_stats():
    """
    Get dashboard statistics
    Separates Gift doctype from Received Gift doctype
    """
    
    try:
        user = frappe.session.user
        roles = set(frappe.get_roles(user))
        has_global_visibility = (
            user in {'Administrator'}
            or 'System Manager' in roles
            or 'Event Manager' in roles
        )
        has_event_role = has_global_visibility or ('Event Coordinator' in roles)

        visible_events = get_user_visible_event_names(user) if not has_global_visibility else []
        events_tuple = tuple(visible_events)
        has_events = bool(events_tuple)

        gift_scope_where = "1=1"
        recipient_scope_where = "1=1"
        issue_scope_where = "1=1"
        values = {}

        if not has_event_role:
            gift_scope_where = "1=0"
            recipient_scope_where = "1=0"
            issue_scope_where = "1=0"
        elif not has_global_visibility:
            if has_events:
                gift_scope_where = "(IFNULL(event, '') = '' OR event in %(events)s)"
                recipient_scope_where = "(IFNULL(event, '') = '' OR event in %(events)s)"
                issue_scope_where = "event in %(events)s"
                values["events"] = events_tuple
            else:
                gift_scope_where = "IFNULL(event, '') = ''"
                recipient_scope_where = "IFNULL(event, '') = ''"
                issue_scope_where = "1=0"

        # ========== GIFT DOCTYPE STATS (Inventory) ==========
        total_gifts = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift` WHERE {gift_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        available_gifts = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift` WHERE status = 'Available' AND {gift_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        issued_gifts = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift` WHERE status = 'Issued' AND {gift_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        in_transit_gifts = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift` WHERE status = 'In Transit' AND {gift_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        delivered_gifts = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift` WHERE status = 'Delivered' AND {gift_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        reserved_gifts = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift` WHERE status = 'Reserved' AND {gift_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        
        # ========== RECEIVED GIFT DOCTYPE STATS (Separate) ==========
        total_received_gifts = frappe.db.count('Received Gift')
        
        # ========== RECIPIENT STATS ==========
        total_recipients = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift Recipient` WHERE {recipient_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        
        # ========== CATEGORY STATS ==========
        total_categories = frappe.db.count('Gift Category')
        
        # ========== ISSUE STATS ==========
        total_issues = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift Issue` WHERE {issue_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        pending_issues = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift Issue` WHERE status = 'Pending' AND {issue_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        in_transit_issues = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift Issue` WHERE status = 'In Transit' AND {issue_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        delivered_issues = frappe.db.sql(
            f"SELECT COUNT(*) AS c FROM `tabGift Issue` WHERE status = 'Delivered' AND {issue_scope_where}",
            values,
            as_dict=True,
        )[0].get("c", 0)
        
        # ========== DISPATCH STATS ==========
        if has_global_visibility:
            total_dispatches = frappe.db.count('Gift Dispatch')
            prepared_dispatches = frappe.db.count('Gift Dispatch', {'dispatch_status': 'Prepared'})
            in_transit_dispatches = frappe.db.count('Gift Dispatch', {'dispatch_status': 'In Transit'})
            delivered_dispatches = frappe.db.count('Gift Dispatch', {'dispatch_status': 'Delivered'})
        elif has_events:
            dispatch_values = {"events": events_tuple}
            total_dispatches = frappe.db.sql(
                """
                SELECT COUNT(*) AS c
                FROM `tabGift Dispatch` gd
                INNER JOIN `tabGift Issue` gi ON gi.name = gd.related_gift_issue
                WHERE gi.event in %(events)s
                """,
                dispatch_values,
                as_dict=True,
            )[0].get("c", 0)
            prepared_dispatches = frappe.db.sql(
                """
                SELECT COUNT(*) AS c
                FROM `tabGift Dispatch` gd
                INNER JOIN `tabGift Issue` gi ON gi.name = gd.related_gift_issue
                WHERE gi.event in %(events)s AND gd.dispatch_status = 'Prepared'
                """,
                dispatch_values,
                as_dict=True,
            )[0].get("c", 0)
            in_transit_dispatches = frappe.db.sql(
                """
                SELECT COUNT(*) AS c
                FROM `tabGift Dispatch` gd
                INNER JOIN `tabGift Issue` gi ON gi.name = gd.related_gift_issue
                WHERE gi.event in %(events)s AND gd.dispatch_status = 'In Transit'
                """,
                dispatch_values,
                as_dict=True,
            )[0].get("c", 0)
            delivered_dispatches = frappe.db.sql(
                """
                SELECT COUNT(*) AS c
                FROM `tabGift Dispatch` gd
                INNER JOIN `tabGift Issue` gi ON gi.name = gd.related_gift_issue
                WHERE gi.event in %(events)s AND gd.dispatch_status = 'Delivered'
                """,
                dispatch_values,
                as_dict=True,
            )[0].get("c", 0)
        else:
            total_dispatches = 0
            prepared_dispatches = 0
            in_transit_dispatches = 0
            delivered_dispatches = 0
        
        # ========== EVENT STATS ==========
        if has_global_visibility:
            total_events = frappe.db.count('Gift Event', {'status': ['!=', 'Draft']})
            upcoming_events = frappe.db.count('Gift Event', {
                'starts_on': ['>=', frappe.utils.today()],
                'status': ['!=', 'Draft']
            })
        else:
            total_events = len(visible_events)
            if has_events:
                upcoming_events = frappe.db.sql(
                    """
                    SELECT COUNT(*) AS c
                    FROM `tabGift Event`
                    WHERE name in %(events)s
                    AND IFNULL(status, '') != 'Draft'
                    AND DATE(starts_on) >= %(today)s
                    """,
                    {"events": events_tuple, "today": frappe.utils.today()},
                    as_dict=True,
                )[0].get("c", 0)
            else:
                upcoming_events = 0
        
        # ========== INTEREST STATS ==========
        total_interests = frappe.db.count('Gift Recipient Interest')
        
        return {
            'success': True,
            'data': {
                # Gift Inventory
                'totalGifts': total_gifts,
                'availableGifts': available_gifts,
                'issuedGifts': issued_gifts,
                'inTransitGifts': in_transit_gifts,
                'deliveredGifts': delivered_gifts,
                'reservedGifts': reserved_gifts,
                
                # Received Gifts (Separate)
                'totalReceivedGifts': total_received_gifts,
                
                # Recipients
                'totalRecipients': total_recipients,
                
                # Categories
                'totalCategories': total_categories,
                
                # Issues
                'totalIssues': total_issues,
                'pendingIssues': pending_issues,
                'inTransitIssues': in_transit_issues,
                'deliveredIssues': delivered_issues,
                
                # Dispatches
                'totalDispatches': total_dispatches,
                'preparedDispatches': prepared_dispatches,
                'inTransitDispatches': in_transit_dispatches,
                'deliveredDispatches': delivered_dispatches,
                
                # Events
                'totalEvents': total_events,
                'upcomingEvents': upcoming_events,
                
                # Interests
                'totalInterests': total_interests,
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Dashboard stats error: {str(e)}", "Dashboard API Error")
        return {
            'success': False,
            'error': str(e),
            'data': {
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
                'pendingIssues': 0,
                'inTransitIssues': 0,
                'deliveredIssues': 0,
                'totalDispatches': 0,
                'preparedDispatches': 0,
                'inTransitDispatches': 0,
                'deliveredDispatches': 0,
                'totalEvents': 0,
                'upcomingEvents': 0,
                'totalInterests': 0,
            }
        }


@frappe.whitelist(allow_guest=False)
def get_recent_activity(limit=10):
    """Get recent activity across all doctypes"""
    
    try:
        user = frappe.session.user
        roles = set(frappe.get_roles(user))
        has_global_visibility = (
            user in {'Administrator'}
            or 'System Manager' in roles
            or 'Event Manager' in roles
        )
        allowed_events = None if has_global_visibility else get_user_visible_event_names(user)

        gift_filters = {}
        issue_filters = {}
        dispatch_filters = {}
        if allowed_events is not None:
            gift_filters['event'] = ['in', allowed_events]
            issue_filters['event'] = ['in', allowed_events]
            dispatch_filters['event'] = ['in', allowed_events]

        # Recent Gifts
        recent_gifts = frappe.get_all(
            'Gift',
            filters=gift_filters,
            fields=['name', 'gift_name', 'status', 'category', 'modified'],
            order_by='modified desc',
            limit=limit
        )
        
        # Recent Received Gifts
        recent_received = frappe.get_all(
            'Received Gift',
            fields=['name', 'gift_name', 'given_by', 'received_date', 'modified'],
            order_by='modified desc',
            limit=limit
        )
        
        # Recent Issues
        recent_issues = frappe.get_all(
            'Gift Issue',
            filters=issue_filters,
            fields=['name', 'gift', 'gift_name', 'gift_recipient', 'status', 'date', 'modified'],
            order_by='modified desc',
            limit=limit
        )
        
        # Recent Dispatches
        recent_dispatches = frappe.get_all(
            'Gift Dispatch',
            filters=dispatch_filters,
            fields=['name', 'related_gift_issue', 'gift_name', 'dispatch_status', 'dispatch_date', 'modified'],
            order_by='modified desc',
            limit=limit
        )
        
        return {
            'success': True,
            'data': {
                'recentGifts': recent_gifts,
                'recentReceived': recent_received,
                'recentIssues': recent_issues,
                'recentDispatches': recent_dispatches,
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Recent activity error: {str(e)}", "Dashboard API Error")
        return {
            'success': False,
            'error': str(e)
        }


@frappe.whitelist(allow_guest=False)
def get_status_breakdown():
    """Get detailed breakdown by status for charts"""
    
    try:
        user = frappe.session.user
        roles = set(frappe.get_roles(user))
        has_global_visibility = (
            user in {'Administrator'}
            or 'System Manager' in roles
            or 'Event Manager' in roles
        )
        if not has_global_visibility:
            frappe.throw(_("You do not have permission to view this report"), frappe.PermissionError)

        # Gift status breakdown
        gift_statuses = frappe.db.sql("""
            SELECT status, COUNT(*) as count
            FROM `tabGift`
            GROUP BY status
        """, as_dict=True)
        
        # Issue status breakdown
        issue_statuses = frappe.db.sql("""
            SELECT status, COUNT(*) as count
            FROM `tabGift Issue`
            GROUP BY status
        """, as_dict=True)
        
        # Dispatch status breakdown
        dispatch_statuses = frappe.db.sql("""
            SELECT dispatch_status, COUNT(*) as count
            FROM `tabGift Dispatch`
            GROUP BY dispatch_status
        """, as_dict=True)
        
        # Category breakdown
        category_breakdown = frappe.db.sql("""
            SELECT category, COUNT(*) as count
            FROM `tabGift`
            WHERE category IS NOT NULL
            GROUP BY category
            ORDER BY count DESC
            LIMIT 10
        """, as_dict=True)
        
        return {
            'success': True,
            'data': {
                'giftStatuses': gift_statuses,
                'issueStatuses': issue_statuses,
                'dispatchStatuses': dispatch_statuses,
                'categoryBreakdown': category_breakdown,
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Status breakdown error: {str(e)}", "Dashboard API Error")
        return {
            'success': False,
            'error': str(e)
        }
