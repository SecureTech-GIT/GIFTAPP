// Copyright (c) 2026, Gift Management and contributors
// For license information, please see license.txt

frappe.ui.form.on("Gift Received", {
    onload(frm) {
        frm._category_attrs_loaded = false;
    },

    refresh(frm) {
        // Make form read-only if moved to inventory
        if (frm.doc.moved_to_inventory) {
            frm.set_read_only();
            frm.disable_save();
            
            // Show alert banner
            if (frm.doc.gift_created) {
                frm.dashboard.add_comment(
                    __('This gift has been moved to main inventory as <b>{0}</b> and cannot be edited.', 
                    [frm.doc.gift_created]), 
                    'blue', 
                    true
                );
                
                // Add button to view created gift
                frm.add_custom_button(__('View Gift in Inventory'), function() {
                    frappe.set_route('Form', 'Gift', frm.doc.gift_created);
                }, __('Actions'));
            }
        }
        
        // Add "Move to Inventory" button - NO docstatus check needed (non-submittable)
        if (!frm.doc.moved_to_inventory && frm.doc.status !== 'Rejected' && !frm.is_new()) {
            frm.add_custom_button(__('Move to Main Inventory'), function() {
                frappe.confirm(
                    __('Are you sure you want to move this gift to main inventory?<br><br><b>This will:</b><ul><li>Create a new Gift record</li><li>Generate barcode</li><li>Make this document read-only</li></ul>'),
                    function() {
                        frappe.call({
                            method: 'move_to_main_inventory',
                            doc: frm.doc,
                            freeze: true,
                            freeze_message: __('Moving to inventory...'),
                            callback: function(r) {
                                if (r.message) {
                                    frm.reload_doc();
                                    
                                    // Ask to view new gift
                                    frappe.confirm(
                                        __('Gift {0} created successfully!<br><br>Do you want to view it?', [r.message]),
                                        function() {
                                            frappe.set_route('Form', 'Gift', r.message);
                                        }
                                    );
                                }
                            },
                            error: function(r) {
                                frappe.msgprint({
                                    title: __('Error'),
                                    indicator: 'red',
                                    message: r.message || __('Failed to move gift to inventory')
                                });
                            }
                        });
                    }
                );
            }, __('Actions')).addClass('btn-primary');
        }
    },

    category(frm) {
        // Only load for new documents or if category changed
        if (frm.is_new() || !frm._category_attrs_loaded) {
            load_category_attributes(frm);
        }
    },

    validate(frm) {
        // Validate mandatory attributes
        validate_mandatory_attributes(frm);
    },

    status(frm) {
        // Clear rejection reason if status is not Rejected
        if (frm.doc.status !== 'Rejected' && frm.doc.rejection_reason) {
            frm.set_value('rejection_reason', '');
        }
    },

    barcode_value(frm) {
        // Auto-uppercase barcode
        if (frm.doc.barcode_value) {
            frm.set_value('barcode_value', frm.doc.barcode_value.toUpperCase());
        }
    }
});

function load_category_attributes(frm) {
    if (!frm.doc.category) return;
    
    console.log('Loading attributes for category:', frm.doc.category);
    frm._category_attrs_loaded = true;

    frappe.call({
        method: "gift.gift.doctype.gift_received.gift_received.get_category_attributes",
        args: {
            category: frm.doc.category
        },
        callback: function(r) {
            if (!r.message || !r.message.length) {
                frappe.msgprint(__('No attributes defined for this category'));
                return;
            }
            
            console.log('Loaded attributes:', r.message);
            
            // Clear existing
            frm.set_value("gift_details", []);
            
            // Add new attributes
            r.message.forEach(function(attr) {
                let row = frm.add_child('gift_details');
                row.attribute_label = attr.attribute_label;
                row.attribute_value = attr.default_value || '';
                row.attribute_type = attr.attribute_type;
                row.is_mandatory = attr.is_mandatory;
                row.select_options = attr.select_options;
                row.display_order = attr.display_order;
            });
            
            frm.refresh_field('gift_details');
            
            frappe.show_alert({
                message: __('Loaded {0} attributes from category', [r.message.length]),
                indicator: 'green'
            }, 3);
        },
        error: function(r) {
            console.error('Error loading category attributes:', r);
            frappe.msgprint(__('Error loading category attributes'));
        }
    });
}

function validate_mandatory_attributes(frm) {
    if (!frm.doc.gift_details || !frm.doc.gift_details.length) {
        return;
    }

    const missing = [];
    frm.doc.gift_details.forEach(function(row) {
        if (row.is_mandatory && !row.attribute_value) {
            missing.push(row.attribute_label);
        }
    });

    if (missing.length) {
        frappe.msgprint({
            title: __('Mandatory Fields Required'),
            indicator: 'red',
            message: __('Please fill mandatory attributes: {0}', [missing.join(", ")])
        });
        frappe.validated = false;
    }
}
