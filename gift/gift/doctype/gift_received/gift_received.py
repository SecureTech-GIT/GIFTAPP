# -*- coding: utf-8 -*-
# Copyright (c) 2026, Gift Management and contributors
# For license information, please see license.txt


import frappe
from frappe.model.document import Document
from frappe import _


class GiftReceived(Document):
    def validate(self):
        """Validate before save"""
        # Prevent editing if moved to inventory
        if self.moved_to_inventory and not self.is_new():
            frappe.throw(_("This gift has been moved to main inventory and cannot be edited."))
        
        # Auto-update status
        self.update_status()
        
        # Validate barcode uniqueness
        if self.barcode_value:
            self.validate_barcode_uniqueness()
        
        # Validate mandatory attributes
        self.validate_mandatory_attributes()
    
    def update_status(self):
        """Auto-update status based on fields"""
        if self.moved_to_inventory:
            self.status = "Moved to Inventory"
            return
        
        if self.status == "Rejected":
            return
        
        if self.storage_date and self.warehouse:
            self.status = "Stored"
        else:
            self.status = "Received"
    
    def validate_barcode_uniqueness(self):
        """Check barcode uniqueness across Gift Received and Gift"""
        # Check in Gift Received
        existing = frappe.db.get_value(
            "Gift Received",
            {"barcode_value": self.barcode_value, "name": ["!=", self.name]},
            "name"
        )
        if existing:
            frappe.throw(_("Barcode ID {0} already exists in Gift Received: {1}").format(
                self.barcode_value, existing
            ))
        
        # Check in main Gift inventory
        existing_gift = frappe.db.get_value(
            "Gift",
            {"barcode_value": self.barcode_value},
            "name"
        )
        if existing_gift:
            frappe.throw(_("Barcode ID {0} already exists in Gift inventory: {1}").format(
                self.barcode_value, existing_gift
            ))
    
    def validate_mandatory_attributes(self):
        """Validate that all mandatory attributes are filled"""
        if not self.gift_details:
            return
        
        missing = []
        for row in self.gift_details:
            if row.is_mandatory and not row.attribute_value:
                missing.append(row.attribute_label)
        
        if missing:
            frappe.throw(_("Please fill mandatory attributes: {0}").format(", ".join(missing)))
    
    @frappe.whitelist(allow_guest=False)
    def move_to_main_inventory(self):
        """Move Gift Received to main Gift inventory"""
        if self.moved_to_inventory:
            frappe.throw(_("This gift has already been moved to inventory"))
        
        if self.status == "Rejected":
            frappe.throw(_("Cannot move rejected gifts to inventory"))
        
        # Validate required fields
        if not self.gift_name:
            frappe.throw(_("Gift name is required"))
        
        if not self.category:
            frappe.throw(_("Category is required"))

        if not getattr(self, "event", None):
            frappe.throw(_("Event is required to move gift to main inventory"))
        
        try:
            # Create new Gift document
            gift = frappe.new_doc("Gift")
            
            # Basic Info
            gift.gift_name = self.gift_name
            gift.event = self.event
            gift.category = self.category
            gift.description = self.description or ''
            gift.status = "Available"
            gift.donor = self.donor or ''
            
            # Handle barcode
            if self.barcode_value:
                gift.import_barcode = 1
                gift.barcode_value = self.barcode_value
            
            # Storage Info
            gift.warehouse = self.warehouse
            gift.storage_location = self.storage_location or ''
            gift.storage_date = self.storage_date or frappe.utils.today()
            gift.current_location_type = self.current_location_type or 'Warehouse'
            
            # Copy Gift Details to table_gvlf (category attributes)
            if self.gift_details:
                for detail in self.gift_details:
                    # Skip empty rows
                    if not detail.attribute_label:
                        continue
                    
                    gift.append('table_gvlf', {
                        'attribute_name': detail.attribute_label,
                        'attribute_type': detail.attribute_type or 'Text',
                        'default_value': detail.attribute_value or '',
                        'is_mandatory': detail.is_mandatory or 0,
                        'select_options': detail.select_options or '',
                        'display_order': detail.display_order or 0
                    })
            
            # Copy Images
            if self.gift_images:
                for img in self.gift_images:
                    if img.image:
                        gift.append('gift_images', {
                            'image': img.image
                        })
            
            # Copy Documents
            if self.gift_documents:
                for doc_row in self.gift_documents:
                    if doc_row.document:
                        gift.append('gift_documents', {
                            'document': doc_row.document,
                            'document_name': getattr(doc_row, 'document_name', '')
                        })
            
            # Insert the Gift
            gift.insert(ignore_permissions=True)
            
            # Update Gift Received record
            self.db_set('moved_to_inventory', 1, update_modified=True)
            self.db_set('gift_created', gift.name, update_modified=False)
            self.db_set('status', 'Moved to Inventory', update_modified=False)
            self.db_set('moved_on', frappe.utils.now(), update_modified=False)
            self.db_set('moved_by', frappe.session.user, update_modified=False)
            
            # Add comment
            self.add_comment(
                'Comment',
                _('Moved to main inventory as Gift: {0}').format(gift.name)
            )
            
            frappe.db.commit()
            
            frappe.msgprint(
                _("Gift <b>{0}</b> created successfully!").format(gift.name),
                indicator="green",
                alert=True
            )
            
            return gift.name
            
        except Exception as e:
            frappe.db.rollback()
            error_msg = str(e)
            traceback_msg = frappe.get_traceback()
            frappe.log_error(
                f"Error: {error_msg}\n\nTraceback:\n{traceback_msg}", 
                "Move to Inventory Error"
            )
            frappe.throw(_("Failed to move gift to inventory: {0}").format(error_msg))



@frappe.whitelist(allow_guest=False)
def get_category_attributes(category):
    """Get category attributes for populating gift_details table"""
    if not category:
        return []
    
    try:
        category_doc = frappe.get_doc("Gift Category", category)
        
        attributes = []
        if category_doc.category_attributes:
            for attr in category_doc.category_attributes:
                attributes.append({
                    'attribute_label': attr.attribute_name,
                    'attribute_type': attr.attribute_type,
                    'is_mandatory': attr.is_mandatory,
                    'select_options': attr.select_options,
                    'default_value': attr.default_value,
                    'display_order': attr.display_order
                })
        
        return attributes
    except Exception as e:
        frappe.log_error(message=str(e), title="Error loading category attributes")
        return []
@frappe.whitelist(allow_guest=False)
def get_form_options():
    """Get all dropdown options for Gift Received form"""
    try:
        # Get occasions from field options
        occasions = frappe.get_meta("Gift Received").get_field("occasion_received").options.split("\n")
        
        # Get statuses
        statuses = frappe.get_meta("Gift Received").get_field("status").options.split("\n")
        
        # Get location types
        location_types = frappe.get_meta("Gift Received").get_field("current_location_type").options.split("\n")
        
        # Get donor types
        donor_types = frappe.get_meta("Gift Received").get_field("donor_type").options.split("\n")
        
        # Get transport methods
        transport_methods = frappe.get_meta("Gift Received").get_field("transport_method").options.split("\n")
        
        return {
            "success": True,
            "data": {
                "occasions": [o for o in occasions if o],
                "statuses": [s for s in statuses if s],
                "location_types": [l for l in location_types if l],
                "donor_types": [d for d in donor_types if d],
                "transport_methods": [t for t in transport_methods if t]
            }
        }
    except Exception as e:
        frappe.log_error(message=str(e), title="Get Form Options Error")
        return {
            "success": False,
            "error": str(e)
        }
