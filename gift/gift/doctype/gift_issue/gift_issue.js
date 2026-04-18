frappe.ui.form.on('Gift Issue', {
    refresh: function(frm) {
        // Add "Create Dispatch" button
        if (!frm.is_new() && !frm.doc.dispatch_reference && 
            frm.doc.status in ['Pending', 'Ready for Dispatch']) {
            
            frm.add_custom_button(__('Create Dispatch'), function() {
                frm.call({
                    method: 'create_dispatch',
                    doc: frm.doc,
                    freeze: true,
                    freeze_message: __('Creating dispatch...'),
                    callback: function(r) {
                        if (r.message) {
                            frm.reload_doc();
                            
                            frappe.confirm(
                                __('Dispatch created successfully!<br>Do you want to view it?'),
                                function() {
                                    frappe.set_route('Form', 'Gift Dispatch', r.message);
                                }
                            );
                        }
                    }
                });
            }, __('Actions')).addClass('btn-primary');
        }
        
        // Add "View Dispatch" button if dispatch exists
        if (frm.doc.dispatch_reference) {
            frm.add_custom_button(__('View Dispatch'), function() {
                frappe.set_route('Form', 'Gift Dispatch', frm.doc.dispatch_reference);
            }, __('Actions'));
        }
    }
});
