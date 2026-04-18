frappe.ui.form.on("Gift", {
    onload(frm) {
        frm._category_attrs_loaded = false;
        toggle_barcode_fields(frm);
    },

    refresh(frm) {
        toggle_barcode_fields(frm);
    },

    import_barcode(frm) {
        toggle_barcode_fields(frm);
        
        if (!frm.doc.import_barcode) {
            frm.set_value("barcode_value", "");
        }
    },

    category(frm) {
        // Only load attributes for new documents
        if (!frm.is_new()) return;
        
        // Prevent double-loading
        if (frm._category_attrs_loaded) return;
        
        // Need a category selected
        if (!frm.doc.category) return;

        console.log('Loading attributes for category:', frm.doc.category);
        frm._category_attrs_loaded = true;

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Gift Category",
                name: frm.doc.category
            },
            callback: function(r) {
                if (!r.message) {
                    console.error('No category data returned');
                    return;
                }
                
                console.log('Category data:', r.message);
                
                const attrs = r.message.category_attributes || [];
                
                console.log('Found attributes:', attrs);
                
                if (!attrs.length) {
                    frappe.msgprint('No attributes defined for this category');
                    return;
                }

                // Clear existing attributes - USE CORRECT TABLE NAME
                frm.set_value("table_gvlf", []);

                // Build new attribute rows
                const new_attrs = attrs.map(function(attr) {
                    return {
                        attribute_name: attr.attribute_name,
                        attribute_type: attr.attribute_type || "Text",
                        is_mandatory: attr.is_mandatory || 0,
                        select_options: attr.select_options || "",
                        default_value: attr.default_value || "",
                        display_order: attr.display_order || 0
                    };
                });

                // Set all at once
                frm.set_value("table_gvlf", new_attrs);
                frm.refresh_field("table_gvlf");
                
                frappe.msgprint(`Loaded ${attrs.length} attributes from category`);
            },
            error: function(r) {
                console.error('Error loading category:', r);
                frappe.msgprint('Error loading category attributes');
            }
        });
    },

    validate(frm) {
        validate_mandatory_attributes(frm);
    }
});

function toggle_barcode_fields(frm) {
    const importing = cint(frm.doc.import_barcode);
    const isNew = frm.is_new();
    
    if (frm.fields_dict.barcode) {
        const showBarcode = !isNew || importing;
        frm.set_df_property("barcode", "hidden", !showBarcode);
        frm.set_df_property("barcode", "reqd", 0);
        frm.refresh_field("barcode");
    }

    if (frm.fields_dict.barcode_value) {
        const showValue = (!isNew && frm.doc.barcode_value) || importing;
        frm.set_df_property("barcode_value", "hidden", !showValue);
        frm.set_df_property("barcode_value", "reqd", importing);
        frm.set_df_property("barcode_value", "read_only", !importing);
        frm.refresh_field("barcode_value");
    }
}

function validate_mandatory_attributes(frm) {
    // Use correct table field name
    if (!frm.doc.table_gvlf || !frm.doc.table_gvlf.length) {
        return;
    }

    const missing = [];
    frm.doc.table_gvlf.forEach(function(row) {
        if (row.is_mandatory && !row.default_value) {
            missing.push(row.attribute_name);
        }
    });

    if (missing.length) {
        frappe.msgprint({
            title: 'Mandatory Fields Required',
            indicator: 'red',
            message: `Please fill mandatory attributes: ${missing.join(", ")}`
        });
        frappe.validated = false;
    }
}
