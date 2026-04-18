// Copyright (c) 2025, Aman Boora and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Gift Interest", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('Gift Interest', {
    refresh: function(frm) {
        // Add "Convert to Issue" button
        if (!frm.is_new() && !frm.doc.converted_to_issue && 
            frm.doc.follow_up_status !== 'Converted to Issue' &&
            frm.doc.follow_up_status !== 'Not Interested' &&
            frm.doc.follow_up_status !== 'Lost') {
            
            frm.add_custom_button(__('Convert to Gift Issue'), function() {
                frappe.confirm(
                    __('Are you sure you want to convert this interest to a Gift Issue?<br><br>This will create a Gift Issue for <b>{0}</b> to <b>{1}</b>.', 
                    [frm.doc.gift_name, frm.doc.gift_recipient]),
                    function() {
                        frm.call({
                            method: 'convert_to_issue',
                            doc: frm.doc,
                            freeze: true,
                            freeze_message: __('Creating Gift Issue...'),
                            callback: function(r) {
                                if (r.message) {
                                    frm.reload_doc();
                                    
                                    frappe.confirm(
                                        __('Gift Issue created successfully!<br>Do you want to view it?'),
                                        function() {
                                            frappe.set_route('Form', 'Gift Issue', r.message);
                                        }
                                    );
                                }
                            }
                        });
                    }
                );
            }, __('Actions')).addClass('btn-primary');
        }
        
        // Add "View Issue" button if converted
        if (frm.doc.converted_to_issue) {
            frm.add_custom_button(__('View Gift Issue'), function() {
                frappe.set_route('Form', 'Gift Issue', frm.doc.converted_to_issue);
            }, __('Actions'));
            
            // Show info
            frm.dashboard.add_comment(
                __('This interest was converted to Gift Issue <b>{0}</b> on {1}', 
                [frm.doc.converted_to_issue, frappe.datetime.str_to_user(frm.doc.conversion_date)]),
                'blue',
                true
            );
        }
        
        // Add "View Gift" button
        if (frm.doc.gift) {
            frm.add_custom_button(__('View Gift'), function() {
                frappe.set_route('Form', 'Gift', frm.doc.gift);
            }, __('View'));
        }
        
        // Add "View Recipient" button
        if (frm.doc.gift_recipient) {
            frm.add_custom_button(__('View Recipient'), function() {
                frappe.set_route('Form', 'Gift Recipient', frm.doc.gift_recipient);
            }, __('View'));
        }
        
        // Add "View Event" button
        if (frm.doc.event) {
            frm.add_custom_button(__('View Event'), function() {
                frappe.set_route('Form', 'Gift Event', frm.doc.event);
            }, __('View'));
        }
    },
    
    follow_up_status: function(frm) {
        // Auto-set interest level based on follow-up status
        if (frm.doc.follow_up_status === 'Not Interested') {
            frm.set_value('interest_level', 'Just Browsing');
        } else if (frm.doc.follow_up_status === 'Converted to Issue') {
            frm.set_value('interest_level', 'Reserved');
        }
    }
});
