import frappe

@frappe.whitelist(allow_guest=False)
def get_event_field_options():
    """Get select field options for Gift Event and Event Participants"""
    
    # Get Gift Event meta
    event_meta = frappe.get_meta('Gift Event')
    participant_meta = frappe.get_meta('Event Participants')
    
    def get_field_options(meta, fieldname):
        field = meta.get_field(fieldname)
        if field and field.options:
            return [opt.strip() for opt in field.options.split('\n') if opt.strip()]
        return []
    
    return {
        'event_categories': get_field_options(event_meta, 'event_category'),
        'event_types': get_field_options(event_meta, 'event_type'),
        'event_statuses': get_field_options(event_meta, 'status'),
        'role_types': get_field_options(participant_meta, 'role_type'),
        'invitation_statuses': get_field_options(participant_meta, 'invitation_status')
    }
