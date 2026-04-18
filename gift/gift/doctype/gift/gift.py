# gift/gift/doctype/gift/gift.py

import frappe
import json
from frappe import _
import io
import base64
from frappe.model.document import Document
from barcode import Code128
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont

from gift.gift.event_permissions import build_event_permission_query, has_event_access, auto_assign_event_to_record

class Gift(Document):
    def validate(self):
        """Validate gift document"""
        
        # Auto-assign event for coordinators if not set
        if self.is_new():
            try:
                auto_assign_event_to_record(self)
            except Exception:
                # Event is optional for Gift; continue when no automatic event can be assigned.
                pass
            if not self.status:
                self.status = "Available"
        
        # Check if gift_id is unique
        if self.gift_id:
            existing = frappe.db.get_value("Gift",
                {"gift_id": self.gift_id, "name": ["!=", self.name]},
                "name"
            )
            if existing:
                frappe.throw(_("Gift Code {0} already exists").format(self.gift_id))
        
        # Validate import barcode requirements
        if self.import_barcode and not self.barcode_value:
            frappe.throw(_("Barcode ID is required when Import Barcode is checked"))
        
        # Check if barcode value is unique if provided
        if self.barcode_value:
            existing = frappe.db.get_value("Gift",
                {"barcode_value": self.barcode_value, "name": ["!=", self.name]},
                "name"
            )
            if existing:
                frappe.throw(_("Barcode ID {0} already exists").format(self.barcode_value))
        
        # Validate mandatory attributes
        self.validate_mandatory_attributes()

        # Regenerate barcode image when barcode_value changes on updates.
        # Previously, barcode image was generated only on insert and only when
        # barcode attachment was empty, so edits to barcode_value would not
        # refresh the barcode image.
        self._ensure_barcode_image_matches_value()

        if getattr(self, "event", None) and not has_event_access(self.event, frappe.session.user):
            frappe.throw(f"You don't have access to event {self.event}")

        # Event category selection is optional; do not block creating/assigning gifts
        # if the event has no categories configured.

    @staticmethod
    def get_permission_query_conditions(user):
        # Event Manager has global visibility
        roles = frappe.get_roles(user)
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return None
        
        cond = build_event_permission_query("Gift", user)
        return cond

    def has_permission(self, ptype=None, user=None):
        if not user:
            user = frappe.session.user

        roles = frappe.get_roles(user)
        if user in {"Administrator"} or "System Manager" in roles or "Event Manager" in roles:
            return True

        if ptype == "delete" and "Event Coordinator" in roles:
            return False

        event_name = getattr(self, "event", None)
        if not event_name:
            # Coordinators cannot access gifts with no event
            if "Event Coordinator" in roles:
                return False
            return True
        return has_event_access(event_name, user)
    
    def validate_mandatory_attributes(self):
        """Validate that all mandatory attributes are filled"""
        # Use correct field name: table_gvlf
        if not self.table_gvlf:
            return
        
        missing = []
        for row in self.table_gvlf:
            if row.is_mandatory and not row.default_value:
                missing.append(row.attribute_name)
        
        if missing:
            frappe.throw(_("Please fill mandatory attributes: {0}").format(", ".join(missing)))

    def after_insert(self):
        """Generate barcode after insert"""
        if not self.barcode_value or not self.barcode:
            self.generate_barcode()

        try:
            self.add_timeline_entry(
                kind="gift_created",
                doctype="Gift",
                docname=self.name,
                user=self.owner or frappe.session.user,
                gift_recipient=getattr(self, "gift_recipient", None),
                notes="Gift record created",
            )
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                "Gift after_insert: Failed creating gift_created timeline entry",
            )

        # Ensure Gift has an initial backend event history row.
        if getattr(self, "event", None) and not getattr(self, "gift_event_history", None):
            try:
                self.append(
                    "gift_event_history",
                    {
                        "from_event": None,
                        "to_event": self.event,
                        "moved_on": frappe.utils.now(),
                        "moved_by": frappe.session.user,
                        "remarks": _("Initial event assignment"),
                    },
                )
                self.flags.skip_gift_modified_timeline = True
                try:
                    self.save(ignore_permissions=True)
                finally:
                    self.flags.skip_gift_modified_timeline = False
            except Exception:
                frappe.log_error(
                    frappe.get_traceback(),
                    "Gift after_insert: Failed creating initial gift_event_history row",
                )

        # Keep Gift Event inventory child table in sync.
        # The authoritative assignment is Gift.event, but the UI/backoffice also expects
        # Gift Event -> event_gifts to reflect assigned gifts.
        if getattr(self, "event", None):
            try:
                ev = frappe.get_doc("Gift Event", self.event)
                exists = any((row.gift == self.name) for row in (ev.event_gifts or []))
                if not exists:
                    ev.append(
                        "event_gifts",
                        {
                            "gift": self.name,
                            "doctype": "Event Gifts",
                            "parenttype": "Gift Event",
                            "parentfield": "event_gifts",
                        },
                    )
                    ev.save(ignore_permissions=True)
            except Exception:
                frappe.log_error(
                    frappe.get_traceback(),
                    "Gift after_insert: Failed syncing Gift Event event_gifts",
                )

    def on_update(self):
        if getattr(self.flags, "in_insert", False):
            return

        if getattr(self.flags, "skip_gift_modified_timeline", False):
            return

        tracked_fields = [
            "gift_name",
            "gift_id",
            "status",
            "event",
            "event_name",
            "category",
            "quantity",
            "description",
            "uae_ring_number",
            "donor",
            "current_location_type",
            "warehouse",
            "storage_location",
            "location_contact_person",
            "location_contact_number",
            "location_address",
            "received_datetime",
            "received_by_name",
            "received_by_contact",
            "barcode_value",
        ]

        try:
            meta_fieldnames = {df.fieldname for df in (self.meta.fields or []) if getattr(df, "fieldname", None)}
            tracked_fields = [f for f in tracked_fields if f in meta_fieldnames]
        except Exception:
            pass

        previous_doc = self.get_doc_before_save()
        if not previous_doc:
            return

        for fieldname in tracked_fields:
            old_value = previous_doc.get(fieldname)
            new_value = self.get(fieldname)

            if old_value == new_value:
                continue

            # Skip timeline logging for event field changes since move_gift_to_event handles event-specific history
            if fieldname == "event":
                continue

            try:
                self.add_timeline_entry(
                    kind="gift_modified",
                    doctype="Gift",
                    docname=self.name,
                    user=frappe.session.user,
                    gift_recipient=getattr(self, "gift_recipient", None),
                    changed_field=fieldname,
                    old_value=old_value,
                    new_value=new_value,
                    notes=f"Field changed: {fieldname}",
                )
            except Exception:
                frappe.log_error(
                    frappe.get_traceback(),
                    f"Gift on_update: Failed creating gift_modified timeline entry for {fieldname}",
                )

    def add_timeline_entry(
        self,
        kind,
        doctype=None,
        docname=None,
        user=None,
        gift_recipient=None,
        guest_full_name=None,
        notes=None,
        **kwargs,
    ):
        user = user or frappe.session.user
        gift_recipient = gift_recipient or getattr(self, "gift_recipient", None)

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
            "doctype": doctype or self.doctype,
            "docname": docname or self.name,
            "user": user,
            "user_full_name": user_full_name,
            "gift_recipient": gift_recipient,
            "guest_full_name": guest_full_name,
            "notes": notes,
        }

        changed_field = kwargs.get("changed_field")
        if kind == "gift_modified":
            if kwargs.get("changes") and isinstance(kwargs.get("changes"), list):
                payload["changes"] = kwargs.get("changes")
            elif changed_field:
                payload["changes"] = [
                    {
                        "field": changed_field,
                        "from": kwargs.get("old_value"),
                        "to": kwargs.get("new_value"),
                    }
                ]

        content = json.dumps(payload, default=str)

        def _insert_timeline_row():
            row_payload = {
                "doctype": "Gift Timeline Entry",
                "parent": self.name,
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
                    try:
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
                                "parent": self.name,
                                "parenttype": "Gift",
                                "parentfield": "timeline_history",
                                "kind": payload.get("kind"),
                                "timestamp": row_payload.get("timestamp"),
                                "entry_doctype": payload.get("doctype"),
                                "entry_docname": payload.get("docname"),
                                "user": payload.get("user"),
                                "user_full_name": payload.get("user_full_name"),
                                "gift_recipient": payload.get("gift_recipient"),
                                "guest_full_name": payload.get("guest_full_name"),
                                "notes": payload.get("notes"),
                                "details_json": content,
                            },
                        )
                    except Exception:
                        frappe.log_error(
                            frappe.get_traceback(),
                            f"Gift add_timeline_entry: Failed inserting timeline row for {self.name}",
                        )

        def _insert_comment():
            try:
                comment_doc = frappe.get_doc(
                    {
                        "doctype": "Comment",
                        "comment_type": "Info",
                        "reference_doctype": "Gift",
                        "reference_name": self.name,
                        "content": content,
                    }
                )
                comment_doc.insert(ignore_permissions=True)
            except Exception:
                frappe.log_error(
                    frappe.get_traceback(),
                    f"Gift add_timeline_entry: Failed inserting comment for {self.name}",
                )

        # Persist timeline immediately so history entries are never lost due to
        # transaction callback behavior differences across execution contexts.
        _insert_timeline_row()
        _insert_comment()

    def generate_barcode(self):
        """Generate unique 8-digit barcode value and create barcode image"""
        try:
            # Generate barcode value if not already set
            if self.import_barcode and self.barcode_value:
                self.barcode_value = str(self.barcode_value)
            elif not self.barcode_value:
                self.barcode_value = self.generate_8_digit_barcode()
            
            # Generate barcode image if not exists
            if not self.barcode:
                self.create_barcode_image()
                # Use db_set to avoid triggering validation again
                self.db_set('barcode', self.barcode, update_modified=False)
                self.db_set('barcode_value', self.barcode_value, update_modified=False)
        except Exception as e:
            frappe.log_error(message=str(e), title="Barcode Generation Error")

    def _ensure_barcode_image_matches_value(self):
        if self.is_new():
            return

        # If barcode_value is removed, also remove barcode image.
        if not self.barcode_value and self.barcode:
            self.barcode = None
            return

        if not self.barcode_value:
            return

        # Normalize type early
        self.barcode_value = str(self.barcode_value)

        previous_value = frappe.db.get_value("Gift", self.name, "barcode_value")
        if previous_value is None:
            return
        previous_value = str(previous_value) if previous_value else previous_value

        if previous_value != self.barcode_value or not self.barcode:
            # Force create a new barcode image and update attachment field.
            # We create a new File row; old file is left as-is to avoid accidental
            # deletion of shared/linked attachments.
            self.create_barcode_image()

    def generate_8_digit_barcode(self):
        """Generate unique 8-digit numeric barcode"""
        import random
        
        max_attempts = 100
        for _ in range(max_attempts):
            barcode = ''.join([str(random.randint(0, 9)) for _ in range(8)])
            existing = frappe.db.get_value("Gift", {"barcode_value": barcode}, "name")
            if not existing:
                return barcode
        
        frappe.throw(_("Unable to generate unique barcode after {0} attempts").format(max_attempts))

    def create_barcode_image(self):
        """Create barcode image with 25mm width and 10mm height"""
        if not self.barcode_value:
            return
        
        try:
            width_pixels = int(25 * 11.811)
            height_pixels = int(10 * 11.811)
            
            code128 = Code128(str(self.barcode_value), writer=ImageWriter())
            barcode_buffer = io.BytesIO()
            
            code128.write(barcode_buffer, options={
                'module_width': 0.3,
                'module_height': 4.5,
                'quiet_zone': 1.0,
                'font_size': 0,
                'text_distance': 0,
                'background': 'white',
                'foreground': 'black',
                'write_text': False
            })
            
            barcode_buffer.seek(0)
            barcode_img = Image.open(barcode_buffer)
            
            final_img = Image.new('RGB', (width_pixels, height_pixels), 'white')
            barcode_height = int(height_pixels * 0.7)
            text_height = height_pixels - barcode_height
            
            barcode_resized = barcode_img.resize((width_pixels, barcode_height), Image.Resampling.LANCZOS)
            final_img.paste(barcode_resized, (0, 0))
            
            draw = ImageDraw.Draw(final_img)
            
            try:
                import platform
                system = platform.system()
                
                if system == "Windows":
                    font_path = "arial.ttf"
                elif system == "Darwin":
                    font_path = "/System/Library/Fonts/Arial.ttf"
                else:
                    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
                
                target_font_size = max(12, int(text_height * 0.6))
                font = ImageFont.truetype(font_path, target_font_size)
            except:
                font = ImageFont.load_default()
            
            text_bbox = draw.textbbox((0, 0), str(self.barcode_value), font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_x = (width_pixels - text_width) // 2
            text_y = barcode_height + (text_height - (text_bbox[3] - text_bbox[1])) // 2
            
            draw.text((text_x, text_y), str(self.barcode_value), fill='black', font=font)
            
            final_buffer = io.BytesIO()
            final_img.save(final_buffer, format='PNG')
            final_buffer.seek(0)
            
            barcode_data = base64.b64encode(final_buffer.getvalue()).decode()
            
            file_doc = frappe.get_doc({
                'doctype': 'File',
                'file_name': f'barcode_{self.name}_{self.barcode_value}.png',
                'content': barcode_data,
                'decode': True,
                'is_private': 0,
                'folder': 'Home/Attachments'
            })
            file_doc.insert(ignore_permissions=True)
            
            self.barcode = file_doc.file_url
            
        except Exception as e:
            frappe.log_error(
                message=f"Error generating barcode: {str(e)}\n{frappe.get_traceback()}", 
                title="Gift Barcode Generation Error"
            )

    def on_trash(self):
        """Cancel related issues, delete interests, then nullify all link fields
        so Frappe's post-on_trash link check passes cleanly."""
        # --- Step 1: Collect all related records while links still exist ---
        issue_rows = frappe.db.sql(
            """SELECT name, status, from_gift_interest
               FROM `tabGift Issue` WHERE gift = %s""",
            (self.name,),
            as_dict=True,
        )
        interest_rows = frappe.db.sql(
            "SELECT name FROM `tabGift Interest` WHERE gift = %s",
            (self.name,),
            as_dict=True,
        )

        # --- Step 2: Cancel non-terminal issues and revert linked interests ---
        for row in issue_rows:
            try:
                if row.status not in {"Cancelled", "Returned", "Delivered"}:
                    frappe.db.set_value(
                        "Gift Issue", row.name,
                        {"status": "Cancelled", "rejection_reason": "Gift record deleted"},
                        update_modified=False,
                    )
                if row.from_gift_interest and frappe.db.exists("Gift Interest", row.from_gift_interest):
                    frappe.db.set_value(
                        "Gift Interest", row.from_gift_interest,
                        {
                            "converted_to_issue": None,
                            "conversion_date": None,
                            "follow_up_status": "New",
                            "approval_status": "Pending",
                            "approved_by": None,
                            "approved_on": None,
                        },
                        update_modified=False,
                    )
            except Exception as e:
                frappe.log_error(f"on_trash Gift: cancel issue {row.name} failed: {e}")

        # --- Step 3: Delete Gift Interests (nullify their back-links first) ---
        for row in interest_rows:
            try:
                frappe.db.sql(
                    "UPDATE `tabGift Issue` SET from_gift_interest = NULL WHERE from_gift_interest = %s",
                    (row.name,)
                )
                frappe.delete_doc("Gift Interest", row.name, ignore_permissions=True, force=True)
            except Exception as e:
                frappe.log_error(f"on_trash Gift: delete interest {row.name} failed: {e}")

        # --- Step 4: Remove from event gifts child table ---
        try:
            frappe.db.sql(
                "DELETE FROM `tabEvent Gifts` WHERE gift = %s",
                (self.name,)
            )
        except Exception as e:
            frappe.log_error(f"on_trash Gift: remove event gifts failed: {e}")

        # --- Step 5: Nullify all remaining link fields so Frappe's link check passes ---
        frappe.db.sql(
            "UPDATE `tabGift Issue` SET gift = NULL WHERE gift = %s",
            (self.name,)
        )
        frappe.db.sql(
            "UPDATE `tabGift Interest` SET gift = NULL WHERE gift = %s",
            (self.name,)
        )
        frappe.db.sql(
            "UPDATE `tabGift Dispatch` SET gift = NULL WHERE gift = %s",
            (self.name,)
        )
        frappe.db.sql(
            "UPDATE `tabGift Maintenance` SET gift = NULL WHERE gift = %s",
            (self.name,)
        )
        frappe.db.sql(
            "UPDATE `tabGift Received` SET gift_created = NULL WHERE gift_created = %s",
            (self.name,)
        )


@frappe.whitelist(allow_guest=False)
def get_gift_details(gift_name):
    """Get gift details with all related data"""
    try:
        gift_doc = frappe.get_doc("Gift", gift_name)

        if not gift_doc.has_permission("read", frappe.session.user):
            frappe.throw(_("You do not have access to this gift"), frappe.PermissionError)
        
        def get_full_url(file_path):
            if not file_path:
                return None
            if file_path.startswith('http'):
                return file_path
            return frappe.utils.get_url() + file_path
        
        # Get category attributes from table_gvlf
        category_attributes = []
        if gift_doc.table_gvlf:
            for attr in gift_doc.table_gvlf:
                category_attributes.append({
                    "attribute_name": attr.attribute_name,
                    "attribute_type": attr.attribute_type,
                    "default_value": attr.default_value,
                    "is_mandatory": attr.is_mandatory,
                    "select_options": attr.select_options,
                    "display_order": attr.display_order
                })
        
        # Get gift images
        gift_images = []
        if gift_doc.gift_images:
            for img in gift_doc.gift_images:
                gift_images.append({
                    "image": get_full_url(img.image)
                })
        
        # Get location history
        location_history = []
        if gift_doc.gift_location_history:
            for loc in gift_doc.gift_location_history:
                location_history.append({
                    "from_warehouse": loc.from_warehouse,
                    "to_warehouse": loc.to_warehouse,
                    "from_location": loc.from_location,
                    "to_location": loc.to_location,
                    "transfer_date": loc.transfer_date,
                    "reason": loc.reason
                })

        # Get event move history
        event_history = []
        if getattr(gift_doc, "gift_event_history", None):
            for row in gift_doc.gift_event_history:
                event_history.append({
                    "from_event": row.from_event,
                    "to_event": row.to_event,
                    "moved_on": row.moved_on,
                    "moved_by": row.moved_by,
                    "remarks": getattr(row, "remarks", None),
                })
        
        gift_data = gift_doc.as_dict()
        gift_data['category_attributes'] = category_attributes
        gift_data['gift_images'] = gift_images
        gift_data['gift_location_history'] = location_history
        gift_data['gift_event_history'] = event_history

        try:
            timeline_resp = get_gift_timeline(gift_name)
            gift_data['timeline'] = (timeline_resp or {}).get('timeline') or []
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                f"Gift API: Failed loading timeline for {gift_name}",
            )
            gift_data['timeline'] = []
        
        # Fix image URLs
        if gift_data.get('barcode'):
            gift_data['barcode'] = get_full_url(gift_data['barcode'])
        if gift_data.get('qr_code_image'):
            gift_data['qr_code_image'] = get_full_url(gift_data['qr_code_image'])
        if gift_data.get('person_photo'):
            gift_data['person_photo'] = get_full_url(gift_data['person_photo'])
        
        return {
            "success": True,
            "data": gift_data
        }
        
    except Exception as e:
        frappe.log_error(message=frappe.get_traceback(), title="Gift API Error")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist(allow_guest=False)
def get_gift_timeline(gift_name):
    timeline = []

    try:
        timeline_rows = []
        try:
            timeline_rows = frappe.get_all(
                "Gift Timeline Entry",
                filters={
                    "parent": gift_name,
                    "parenttype": "Gift",
                    "parentfield": "timeline_history",
                },
                fields=[
                    "kind",
                    "timestamp",
                    "entry_doctype",
                    "entry_docname",
                    "user",
                    "user_full_name",
                    "gift_recipient",
                    "guest_full_name",
                    "notes",
                    "details_json",
                    "creation",
                ],
                order_by="timestamp desc, creation desc",
                ignore_permissions=True,
            )
        except Exception:
            timeline_rows = []

        if timeline_rows:
            for row in timeline_rows:
                payload = None
                details_json = row.get("details_json")
                if details_json:
                    try:
                        payload = json.loads(details_json)
                    except Exception:
                        payload = None

                entry = {
                    "kind": row.get("kind") or (payload or {}).get("kind"),
                    "timestamp": row.get("timestamp")
                    or row.get("creation")
                    or (payload or {}).get("timestamp"),
                    "user": row.get("user") or (payload or {}).get("user"),
                    "user_full_name": row.get("user_full_name")
                    or (payload or {}).get("user_full_name")
                    or row.get("user")
                    or (payload or {}).get("user"),
                    "doctype": row.get("entry_doctype") or (payload or {}).get("doctype"),
                    "docname": row.get("entry_docname") or (payload or {}).get("docname"),
                    "gift_recipient": row.get("gift_recipient")
                    or (payload or {}).get("gift_recipient"),
                    "guest_full_name": row.get("guest_full_name")
                    or (payload or {}).get("guest_full_name")
                    or row.get("gift_recipient")
                    or (payload or {}).get("gift_recipient"),
                    "notes": row.get("notes") or (payload or {}).get("notes"),
                }

                changes = (payload or {}).get("changes")
                if isinstance(changes, list):
                    entry["changes"] = changes

                timeline.append(entry)

            return {"success": True, "timeline": timeline}

        comments = frappe.get_all(
            "Comment",
            filters={
                "reference_doctype": "Gift",
                "reference_name": gift_name,
            },
            fields=["name", "creation", "content"],
            order_by="creation desc",
            ignore_permissions=True,
        )

        parsed_rows = []
        user_ids = set()
        recipient_ids = set()

        for row in comments:
            content = row.get("content")
            try:
                payload = json.loads(content or "")
            except Exception:
                continue

            if not isinstance(payload, dict) or not payload.get("kind"):
                continue

            parsed_rows.append((row, payload))

            if payload.get("user"):
                user_ids.add(payload.get("user"))
            if payload.get("gift_recipient"):
                recipient_ids.add(payload.get("gift_recipient"))

        user_full_names = {}
        if user_ids:
            for user_row in frappe.get_all(
                "User",
                filters={"name": ["in", list(user_ids)]},
                fields=["name", "full_name"],
                ignore_permissions=True,
            ):
                user_full_names[user_row.get("name")] = (
                    user_row.get("full_name") or user_row.get("name")
                )

        recipient_full_names = {}
        if recipient_ids:
            for recipient_row in frappe.get_all(
                "Gift Recipient",
                filters={"name": ["in", list(recipient_ids)]},
                fields=["name", "owner_full_name", "guest_first_name", "guest_last_name"],
                ignore_permissions=True,
            ):
                first = (recipient_row.get("guest_first_name") or "").strip()
                last = (recipient_row.get("guest_last_name") or "").strip()
                recipient_full_names[recipient_row.get("name")] = (
                    recipient_row.get("owner_full_name")
                    or " ".join(part for part in [first, last] if part)
                    or recipient_row.get("name")
                )

        for row, payload in parsed_rows:
            kind = payload.get("kind")
            entry = {
                "kind": kind,
                "timestamp": row.get("creation"),
                "user": payload.get("user"),
                "user_full_name": payload.get("user_full_name")
                or user_full_names.get(payload.get("user"))
                or payload.get("user"),
                "doctype": payload.get("doctype"),
                "docname": payload.get("docname"),
                "gift_recipient": payload.get("gift_recipient"),
                "guest_full_name": payload.get("guest_full_name")
                or recipient_full_names.get(payload.get("gift_recipient"))
                or payload.get("gift_recipient"),
                "notes": payload.get("notes"),
            }

            if kind == "gift_modified":
                changes = payload.get("changes")
                if isinstance(changes, list):
                    entry["changes"] = changes
                elif payload.get("changed_field"):
                    entry["changes"] = [
                        {
                            "field": payload.get("changed_field"),
                            "from": payload.get("old_value"),
                            "to": payload.get("new_value"),
                        }
                    ]
                else:
                    entry["changes"] = []

            timeline.append(entry)

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Gift Timeline API Error for {gift_name}",
        )
        timeline = []

    return {"success": True, "timeline": timeline}
