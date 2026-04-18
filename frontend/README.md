# Gift Management System - User Operations Guide

## Executive Summary

The Gift Management System is an enterprise platform for managing the complete lifecycle of high-value gifts and special items in official, diplomatic, and corporate settings. This guide provides operational workflows, role-based permissions, and step-by-step instructions for system users.

---

## Part 1: System Architecture & Roles

### Understanding the System Structure

The Gift Management System consists of five core interconnected modules that work together in a sequential workflow:

```
Gift Category → Gift → Gift Issue → Maintenance → Reports
    (Define)     (Store)  (Handover)  (Service)    (Analyze)
```

**Supporting Module: Gift Receipts**
Gift Receipts are a separate, optional module used only when receiving gifts from external sources (royal courts, embassies, donors, vendors). They help document the origin of items and can automatically create Gift records, but are NOT part of the mandatory internal workflow.

**Key Principle:** The system maintains a complete audit trail from gift creation through final delivery, ensuring accountability and transparency.

---

### User Roles & Permissions

#### System Manager (Admin Role)

Complete system access with configuration and reporting capabilities.

**Full Access To:**

- Gift Categories (define types and attributes)
- All Gifts (create, edit, delete, archive)
- Gift Recipients (manage VIP profiles)
- Gift Receipts (optional: document externally received gifts)
- Gift Issues (create and submit)
- Gift Interests (manage and convert)
- Maintenance (schedule and track service)
- Reports (view analytics and export)
- Configuration (language, users, system settings)
- User Management (create accounts, assign roles)

**Restrictions:** None. Full system control.

#### Event Manager (Operational Role)

Day-to-day operational access for gift handling during events.

**Access To:**

- Dashboard (limited metrics: available gifts, recent issues)
- Gifts (view inventory, create, limited editing)
- Gift Recipients (full access for coordination)
- Gift Receipts (optional: create when receiving external gifts)
- Gift Issues (create and submit)
- Gift Interests (view, create, manage)

**NO Access To:**

- Gift Categories (prevents accidental system structure changes)
- Maintenance (long-term asset care is admin-only)
- Reports (analytics restricted to management)
- User Management (prevents unauthorized account creation)

---

## Part 2: Core Module Workflows

### Module 1: Gift Categories – Defining Gift Types

**Purpose:** Categories define what kinds of gifts your organization handles and which information must be captured for each type.

**Who Uses It:** Primarily System Managers during initial setup and when adding new gift classes.

**Core Concept:**
Each category acts as a template. When you select a category, it automatically loads the relevant fields (attributes) that must be filled. This ensures consistent data entry and makes items searchable and comparable.

**Example Categories (Template Structure):**

| Category                   | Attributes                                                                        | Use Case                                                             |
| -------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Luxury Watches**   | Brand, Model, Serial Number, Metal Type, Warranty Period                          | Capturing details needed to identify and authenticate timepieces     |
| **Arabian Horses**   | Horse Name, Breed, Age, Color, Passport Number, Vaccination Status                | Tracking living animals including health and breeding documentation  |
| **Luxury Vehicles**  | Make, Model, Year, VIN, Engine Type                                               | Documenting automotive gifts with full specifications                |
| **Falcons**          | Falcon Name, Species, Age, Ring Number, Training Level                            | Tracking trained hunting birds with performance and training records |
| **Art & Sculptures** | Artist Name, Title, Year Created, Medium, Dimensions, Certificate of Authenticity | Managing valuable artwork with provenance documentation              |
| **Jewelry**          | Type (Necklace, Ring, etc.), Metal, Gemstones, Weight, Certificate Number         | Recording precious items with material and certification details     |

**System Manager Workflow: Creating a New Category**

1. Navigate to **Categories** section in sidebar
2. Click **New Category** button
3. Enter **Category Name** (e.g., "Yachts")
4. Enter **Description** (purpose and use, e.g., "Luxury vessels for diplomatic gifting")
5. Add **Category Attributes** by clicking **Add Row** for each attribute:
   - **Attribute Name:** Field label (e.g., "Length (meters)")
   - **Attribute Type:** Choose from Text, Number, Date, Select, Checkbox, etc.
   - **Is Mandatory:** Check if this field must be filled
   - **Select Options:** If type is "Select", enter options separated by line breaks
   - **Display Order:** Number determining field position on forms
6. Click **Save**

**Best Practices:**

- Keep categories focused (one type of item per category)
- Make attributes mandatory only when truly essential
- Order attributes logically (general info first, specifics later)
- Use Select fields for standardized options (colors, materials, etc.)
- Use Text fields for variable data (names, serial numbers)

---

### Module 2: Gift Recipients – VIP & Coordinator Profiles

**Purpose:** Store information about individuals and entities who may receive gifts, including both official contact and operational coordination details.

**Who Uses It:** Event Managers and Admins create and maintain recipient records.

**Why Separate Official & Coordinator Contacts:**
The VIP (Owner) may have formal protocols and limited direct contact, while the Coordinator is the operational contact who handles logistics, delivery confirmation, and follow-up.

**Key Information Captured:**

| Information Type                  | Purpose                   | Example                                          |
| --------------------------------- | ------------------------- | ------------------------------------------------ |
| **Recipient Name**          | Display name              | "Ambassador John Smith"                          |
| **Owner Full Name**         | Official/formal name      | "Mr. John Robert Smith"                          |
| **Recipient Type**          | Classification            | VIP, Diplomat, Government Official, Royal Family |
| **Contact Number**          | Direct phone              | "+971-50-2345678"                                |
| **Email Address**           | Official communication    | "john.smith@embassy.us"                          |
| **Address**                 | Official residence/office | "US Embassy, Abu Dhabi, UAE"                     |
| **Emirates ID**             | Identification            | Passport or ID number                            |
| **Coordinator Full Name**   | Day-to-day contact        | "Sarah Johnson"                                  |
| **Coordinator Mobile No.**  | Field support phone       | "+971-50-9999992"                                |
| **Coordinator Emirates ID** | ID for logistics          | Optional but helpful                             |
| **Person Photo**            | Visual identification     | Portrait or official photo                       |

**Event Manager Workflow: Adding a New Recipient**

1. Navigate to **Recipients** in sidebar
2. Click **New Recipient** button
3. Enter **Owner Full Name** (mandatory)
4. Enter **Coordinator Full Name** (mandatory)
5. Enter **Coordinator Mobile No.** (mandatory)
6. Enter optional details (Recipient Name, Type, Contact Number, Email, Address, IDs, Photo)
7. Click **Save**

**Best Practices:**

- Always fill mandatory fields before saving
- Keep coordinator contact updated
- Use consistent naming conventions
- Store photos for high-level VIPs
- Review recipient data quarterly

---

### Module 3: Gifts – Inventory Management (Core Module)

**Purpose:** Central repository of all gift items. Gifts can be created directly or automatically from Gift Receipts, and their status changes as they move through workflows.

**Who Uses It:** All roles view and interact with gifts; Admins create directly; Event Managers create via receipts or direct entry.

**Gift Lifecycle:**

```
Available (in inventory, ready to issue)
    ↓
Issued (given to recipient, locked in history)
    ↓
Maintenance (undergoing service, temporarily unavailable)
```

**Core Gift Fields:**

| Field                           | Type    | Purpose                                              |
| ------------------------------- | ------- | ---------------------------------------------------- |
| **Gift Name**             | Text    | Unique identifier (e.g., "Rolex Daytona Platinum")   |
| **Category**              | Link    | Gift type; auto-loads attribute fields               |
| **Status**                | Select  | Available, Issued, Maintenance, Archived             |
| **Barcode**               | Text    | Scan code for quick lookup                           |
| **Warehouse**             | Link    | Storage location                                     |
| **Current Location Type** | Select  | Warehouse, Farm, Training Center, Event Venue, Other |
| **Storage Date**          | Date    | When catalogued                                      |
| **Condition**             | Select  | New, Excellent, Good, Fair, Poor                     |
| **Gift Details**          | Table   | Dynamic attributes based on category                 |
| **Images Gallery**        | Gallery | Photos for visual identification                     |
| **Notes**                 | Text    | Internal remarks, special handling notes             |

**Admin Workflow: Creating a Gift Directly (Main Entry Point)**

1. Navigate to **Gifts** in sidebar
2. Click **New Gift** button
3. Enter **Gift Name**
4. Select **Category** (attribute fields auto-load)
5. Fill all **Gift Detail** attributes relevant to the category
6. Upload **photos** if available
7. Select **Warehouse** (storage location)
8. Set **Status** to "Available" (ready to issue)
9. Set **Condition** (New, Excellent, etc.)
10. Enter **Storage Date** (today)
11. Click **Save**

**Event Manager Workflow: Viewing Available Gifts**

1. Navigate to **Gifts** in sidebar
2. The system shows a list of all gifts
3. To find specific items:
   - Use **Search box** at top (search by name, barcode, ID)
   - Use **Filters** (Status = "Available", Category = "Luxury Watches", etc.)
4. Click on any gift to see full details:
   - All attribute values
   - Photos
   - Current location and condition
   - Historical timeline of issues
5. Leave without changes (gift details are typically only edited by Admin)

**Best Practices:**

- Always assign a clear, descriptive name
- Ensure all mandatory attributes are filled
- Upload high-quality photos from multiple angles
- Keep status current (don't forget to mark as "Issued" after handover)
- Document any special requirements (temperature control, fragile, etc.) in notes

---

### Module 4: Gift Issues – Recording Gift Handovers

**Purpose:** Document the actual handover of a gift to a recipient. Submitting an issue marks the gift as "Issued" and creates a permanent record of who received what, when, and why.

**Who Uses It:** Event Managers create and submit issues during and immediately after events. Admin can view history and reports.

**Why This Matters:**
Issues create accountability. They show the complete chain of custody, linking gifts to recipients with dates, reasons, and delivery methods. This is critical for compliance, follow-up, and future event planning.

**Key Information:**

| Field                     | Purpose                     | Example                                        |
| ------------------------- | --------------------------- | ---------------------------------------------- |
| **Gift**            | Which item (Available only) | "Rolex Daytona Platinum"                       |
| **Recipient**       | Who receives it             | "Ambassador John Smith"                        |
| **Date**            | Handover date               | "2026-01-15"                                   |
| **Reason**          | Why given                   | "State Visit Gift", "Diplomatic Relations"     |
| **Status**          | Delivery state              | Draft → Dispatched → In Transit → Delivered |
| **Delivery Method** | How handed over             | Hand Delivery, Courier, Special Transport      |
| **Tracking Number** | For courier                 | "EMR-ABC123456"                                |
| **Gift Recipient**  | Coordinator info            | Auto-populated from recipient record           |

**Event Manager Workflow: Issuing a Gift to a VIP**

**Scenario:** During a state visit, you hand over a Rolex watch to an ambassador.

1. Navigate to **Issues** in sidebar
2. Click **New Issue** button
3. Click on **Gift** field and **search** for the gift:
   - System shows ONLY "Available" gifts
   - Example: Search "Rolex" → select "Rolex Daytona Platinum"
4. Click on **Recipient** field and **search** for the VIP:
   - Example: Search "John Smith" → select "Ambassador John Smith"
   - System auto-populates **Gift Recipient** child table with coordinator details
5. Enter **Date** (date of handover, typically today)
6. Enter **Reason** (why the gift is being given):
   - Examples: "State Visit Gift", "Diplomatic Relations", "Appreciation Gift", "Corporate Event"
7. Set **Status** (delivery state):
   - "Draft" → still planning
   - "Dispatched" → sent via courier
   - "In Transit" → on the way
   - "Delivered" → physically handed over
8. Enter **Delivery Method** (Hand Delivery, Courier, Special Transport)
9. If using Courier, enter **Tracking Number**
10. Click **Submit** (finalizes the issue):
    - Issue becomes locked/read-only
    - Gift status changes from "Available" → "Issued"
    - Gift no longer appears in available inventory
    - Issue is recorded in permanent history with full audit trail

**Critical:** Once submitted, the issue and gift status cannot be easily changed. Verify all details before submitting.

**Best Practices:**

- Fill all mandatory fields (Gift, Recipient)
- Document the Reason clearly for future reference
- Update Status as delivery progresses
- Use Tracking Number for courier deliveries
- Submit only when delivery is confirmed
- Review before submitting; changes after submission require admin intervention

---

### Module 5: Gift Interests – Planning Future Gifts

**Purpose:** Track requests or preferences for future gifts before they are procured or issued. Use for event planning, procurement, and follow-up.

**Who Uses It:** Event Managers create and manage interests; Admin uses for forecasting and analytics.

**Why This Matters:**
Interests allow you to plan ahead. Record what a VIP is interested in, budget constraints, and occasion. Later, when you procure or allocate a gift, convert the interest to an actual issue.

**Key Information:**

| Field                      | Purpose             | Example                                            |
| -------------------------- | ------------------- | -------------------------------------------------- |
| **Recipient**        | For whom            | "Princess Sarah Al Nahyan"                         |
| **Interest Date**    | When recorded       | "2026-01-10"                                       |
| **Gift Type**        | Preference          | "Luxury Watches", "Art & Sculptures"               |
| **Estimated Budget** | Cost limit          | "150000" (in AED)                                  |
| **Occasion**         | When needed         | "Birthday", "Office Decoration", "Corporate Event" |
| **Status**           | Progress            | New → Contacted → Converted → Not Interested    |
| **Priority**         | Urgency             | High, Medium, Low                                  |
| **Notes**            | Details/preferences | "Prefers Rolex or Patek Philippe"                  |

**Event Manager Workflow: Recording a Gift Interest**

1. Navigate to **Interests** in sidebar
2. Click **New Interest** button
3. Select **Recipient** (search by name)
4. Enter **Interest Date** (today)
5. Enter **Gift Type** (preference)
6. Set **Estimated Budget**
7. Enter **Occasion**
8. Set **Priority** (High, Medium, Low)
9. Enter **Notes** (optional preferences)
10. Click **Save**

**Workflow: Tracking Interest Progress**

1. Navigate to **Interests** in sidebar
2. Find the interest you created
3. As actions happen, update **Status**:
   - **"New"** → Just recorded, no action yet
   - **"Contacted"** → Reached out to supplier; in discussion
   - **"Converted to Issue"** → Gift procured and issued to recipient
   - **"Not Interested"** → VIP declined or interest no longer valid
   - **"Lost"** → Opportunity passed, not pursued further

**Best Practices:**

- Create interests well in advance of needed dates
- Set realistic budgets based on gift type
- Review High-priority interests monthly
- Convert interests to issues when gifts are ready
- Mark old interests as "Lost" or "Not Interested" to keep list clean
- Use notes to capture specific preferences or constraints

---

### Module 6: Maintenance – Long-Term Asset Care (Admin Only)

**Purpose:** Schedule and track servicing, repairs, and inspections for gifts requiring ongoing care (vehicles, animals, art, jewelry).

**Who Uses It:** Primarily Admins who manage long-term asset health. Event Managers cannot see or create maintenance records.

**Why Restricted:**
Maintenance scheduling is strategic and long-term. Event Managers focus on operational gift flow; Admins ensure assets remain in good condition for future use.

**Types of Maintenance:**

| Type                      | For                       | Example                                          |
| ------------------------- | ------------------------- | ------------------------------------------------ |
| **Routine Checkup** | Vehicles, Animals, Art    | Annual servicing, health check                   |
| **Repair**          | Vehicles, Art, Jewelry    | Engine service, canvas restoration, clasp repair |
| **Veterinary Care** | Animals (horses, falcons) | Vaccination, dental, hoof care                   |
| **Restoration**     | Art, Jewelry, Antiques    | Cleaning, conservation, structural repair        |

**Admin Workflow: Scheduling Maintenance**

1. Navigate to **Maintenance** in sidebar
2. Click **New Maintenance** button
3. Select **Gift** (which item needs service)
4. Select **Maintenance Type**
5. Enter **Scheduled Date**, **Service Provider**, **Cost**, **Notes**
6. Click **Save**

**After Service Completion:**

1. Open the maintenance record
2. Set **Status** to "Completed"
3. Enter **Actual Date** and **Actual Cost**
4. Add **Service Report**
5. Click **Save**

The system then automatically updates the Gift's condition and availability status if needed.

---

### Module 7: Reports – Analytics & Compliance (Admin Only)

**Purpose:** Generate insights and evidence for compliance, auditing, and strategic planning.

**Who Uses It:** Admins and senior management for reporting, budgeting, and compliance.

**Available Reports:**

**Gift Inventory by Category**

- Shows count and estimated value of gifts by type
- Helps understand portfolio composition
- Identifies gaps in inventory

**Issues by Recipient**

- Lists all gifts given to each VIP
- Tracks gift frequency and patterns
- Useful for relationship management

**Warehouse Utilization**

- Stock levels by storage location
- Identifies overcrowding or underutilization
- Informs expansion needs

**Maintenance History**

- Service records for all gifts
- Shows costs and downtime
- Predicts future maintenance needs

**Admin Workflow: Accessing Reports**

1. Navigate to **Reports** in sidebar
2. Select desired report type
3. Apply filters (date range, category, recipient, etc.)
4. View interactive report on screen
5. Click **Export** to download as CSV or PDF

**Best Practices:**

- Run reports monthly for oversight
- Export quarterly reports for compliance
- Share recipient reports before VIP visits
- Use maintenance reports for budgeting

---

## Part 3: Supporting Module

### Gift Receipts – Recording Externally Received Gifts (Optional/Supporting Module)

**Purpose:** Document gifts received from external sources (royal courts, embassies, auction houses, manufacturers, donors) and optionally create corresponding gift inventory records automatically.

**Important:** Gift Receipts are NOT part of the core workflow. They are used only when your organization receives gifts from outside parties. Most internal operations start directly at the Gift module.

**Who Uses It:** Event Managers and Admins when receiving gifts from external sources.

**Why Separate from Core Workflow:**
Not all gifts come from external sources. Many gifts are:

- Purchased directly by the organization
- Already in inventory from previous years
- Transferred from other departments
- Created as direct Gift entries

Gift Receipts are specifically for documenting the origin, transport, and condition of items arriving from outside the organization.

**Key Information Captured:**

| Field                       | Purpose               | Example                                  |
| --------------------------- | --------------------- | ---------------------------------------- |
| **Received From**     | Gift source           | "Royal Court of Saudi Arabia"            |
| **Source Contact**    | Sender info           | "+966-11-4012345"                        |
| **Receipt Date**      | When received         | "2026-01-10 14:30"                       |
| **Receipt Status**    | Approval state        | Draft → Pending → Approved → Rejected |
| **Transport Method**  | How transported       | Air, Land, Sea                           |
| **Transport Company** | Logistics provider    | "Emirates Sky Cargo"                     |
| **Create New Gift**   | Auto-create inventory | Toggle ON/OFF                            |
| **Gift Name**         | Item identifier       | "Rolex Daytona Platinum"                 |
| **Category**          | Gift type             | "Luxury Watches"                         |
| **Condition**         | Receipt state         | New, Excellent, Good, Fair, Poor         |
| **Warehouse**         | Storage location      | "Main Gift Warehouse - Dubai"            |

**Event Manager Workflow: Receiving a Gift from External Source**

**Scenario:** Your organization receives a Rolex watch from a visiting delegation.

1. Navigate to **Gift Receipts** in sidebar
2. Click **New Receipt** button
3. Enter **Received From** (e.g., "Royal Court of Saudi Arabia")
4. Enter **Source Contact**
5. Set **Receipt Status** to "Draft"
6. Enter **Transport Method** and **Transport Company**
7. **Toggle "Create New Gift" ON** (to auto-create inventory record)
8. Enter **Gift Name** (e.g., "Rolex Daytona Platinum")
9. Select **Category** (e.g., "Luxury Watches")
   - System displays all attribute fields for that category
10. Fill **Attribute Values** (Brand, Model, Serial Number, Metal Type)
11. Upload **photos**
12. Select **Warehouse**
13. Set **Condition**
14. Click **Save**
    - If "Create New Gift" is ON, system automatically creates a Gift record
    - Gift appears in **Gifts** module with status "Available"
15. Admin reviews and changes **Receipt Status** to "Approved"

**When to Use Gift Receipts:**

- Royal family sends a gift to your organization
- Embassy donates items for your inventory
- External vendor delivers purchased items
- Auction house delivers acquired pieces
- Diplomatic gifts received at official events

**When NOT to Use Gift Receipts:**

- Creating gifts from existing internal inventory
- Manually entering historical gift data
- Transferring gifts between your own warehouses
- Recording gifts purchased directly (can create Gift directly instead)

**Best Practices:**

- Use Gift Receipts only for externally sourced items
- Upload clear photos showing condition upon receipt
- Document any damage or special requirements in notes
- Keep transport information for insurance purposes
- Approve receipts promptly to make gifts available for issuance

---

## Part 4: Complete Workflows by Scenario

### Scenario 1: Preparing for a State Visit (3-Week Timeline)

**Week 1: Planning**

1. Receive list of visiting VIPs
2. For each VIP:
   - Search **Recipients** module; create if not exist
   - Create **Gift Interest** with:
     - Preferred gift type
     - Budget
     - Occasion (State Visit)
     - Priority (High)

**Week 2: Procurement**

1. Admin reviews high-priority interests
2. Check available inventory in **Gifts** module
3. If sourcing externally:
   - Create **Gift Receipt** when gifts arrive from external vendors
   - Auto-create **Gift** records
   - Assign to designated warehouse
4. If sourcing internally:
   - Create **Gift** records directly
   - No need for Gift Receipt
5. Verify gifts match interests and specifications

**Week 3: Event Week**

1. Event Manager reviews available gifts in **Gifts** module
2. For each VIP handover:
   - Create **Gift Issue**
   - Select gift and recipient
   - Set Status to "Delivered"
   - Submit to lock in record
3. Photograph each handover for documentation
4. Update interests to "Converted to Issue"

**Post-Event:**

1. Admin runs **Issues by Recipient** report
2. Confirms all handovers documented
3. Archives or updates interests
4. Collects feedback from VIPs if needed

---

### Scenario 2: Receiving a High-Value Donation from External Party

**Step 1: Initial Receipt (Using Gift Receipt Module)**

1. Event Manager creates **Gift Receipt**:
   - Received From: (donor/entity)
   - Source Contact: (donor info)
   - Transport details
   - Photos of item and condition
2. Selects appropriate **Category**
3. Fills all category **attributes** (authenticity, certifications, etc.)
4. Toggles "Create New Gift" ON
5. Saves receipt as "Pending Approval"

**Step 2: Admin Inspection & Approval**

1. Admin reviews receipt and photos
2. May request additional documentation or inspection
3. Approves receipt → Auto-creates **Gift** record
4. Gift appears in **Gifts** module with status "Available"

**Step 3: Storing & Documenting**

1. Gift is automatically assigned to specified **warehouse**
2. Admin reviews and adds any additional notes
3. Sets **Maintenance schedule** if needed (especially for animals, art)

**Step 4: Utilizing**

1. Gift is now in inventory for future use
2. Appears in **Inventory Reports**
3. Can be issued to any VIP (via **Gift Issue**)
4. Can be maintained if required

---

### Scenario 3: Organizing a Corporate Event with Internal Inventory

**Planning Phase:**

1. Event Manager creates **Gift Interests** for multiple recipients:
   - Budget: 50,000 AED per person
   - Occasion: Corporate Event
   - Priority: Medium
2. Decides on gift types (e.g., premium watches, jewelry, art)

**Inventory Check Phase:**

1. Admin reviews interests and checks **Gifts** module for available inventory
2. Filters by Status = "Available" and relevant categories
3. Identifies which gifts can be used from existing stock

**Procurement Phase (if needed):**

1. If existing inventory insufficient:
   - For external purchases: Create **Gift Receipts** when items arrive
   - For direct entry: Create **Gifts** directly without receipts
2. Organize selected gifts by recipient

**Execution Phase:**

1. Day before event: Prepare gifts in order
2. At event:
   - Event Manager creates **Gift Issue** for each handover
   - Links gift to recipient
   - Records delivery method and time
   - Submits to finalize
3. Coordinator confirms receipt with VIP

**Follow-up Phase:**

1. Admin runs **Issues by Recipient** report
2. Confirms all distributions
3. Sends thank-you follow-ups
4. Updates records with feedback
5. Marks interests as "Converted"

---

### Scenario 4: Direct Gift Entry (No External Receipt)

**When:** Organization purchases gifts directly or adds existing items to inventory.

**Process:**

1. Admin navigates to **Gifts** module
2. Clicks **New Gift**
3. Enters all required information:
   - Gift Name
   - Category (attributes auto-load)
   - All category-specific attributes
   - Photos
   - Warehouse location
   - Condition
4. Sets Status to "Available"
5. Saves

**Result:** Gift enters inventory immediately without going through Gift Receipt module.

**Use Cases:**

- Direct purchases from known suppliers
- Adding historical inventory to the system
- Transferring gifts from other departments
- Recording pre-owned organizational assets

---

## Part 5: Language Support – English & Arabic

### How Language Switching Works

The system supports **English** and **Arabic** with automatic right-to-left (RTL) layout.

**Where Translation Happens:**

1. **Backend (Database):** All DocType labels, field names, and dropdown options are translated
2. **Frontend (User Interface):** UI elements, buttons, and messages are translated via i18n

**Using the Language Toggle:**

1. Locate **Language Switcher** in sidebar (shows "EN" or "AR")
2. Click to toggle
3. System automatically:
   - Switches all field labels to selected language
   - Changes layout from left-to-right (English) to right-to-left (Arabic)
   - Reloads UI elements and messages
   - Maintains your current position and unsaved data

**Example Translations:**

| English    | العربية      |
| ---------- | ------------------- |
| Gifts      | الهدايا      |
| Categories | الفئات        |
| Recipients | المستلمون  |
| Receipts   | الإيصالات  |
| Issues     | الإصدارات  |
| Create New | إنشاء جديد |
| Available  | متاح            |
| Issued     | مُصدَّر      |
| Status     | الحالة        |
| Save       | حفظ              |
| Submit     | إرسال          |
| Edit       | تعديل          |
| Delete     | حذف              |

**When to Use Each Language:**

- **English:** Internal documentation, international stakeholders, technical discussions
- **Arabic:** Event staff, local VIPs, protocol interactions, Arabic-speaking teams

**Admin Task: Managing Translations**

If adding new fields or doctypes:

1. New fields created in English
2. Run translation export:
   ```
   bench --site your-site get-untranslated ar gift
   ```
3. Translate new fields to Arabic in the exported file
4. Import translations back:
   ```
   bench --site your-site update-translations
   ```
5. Refresh browser to see updates

**Best Practices:**

- Test both languages during implementation
- Ensure all field labels are clear in both languages
- Have native Arabic speakers review translations
- Test RTL layout on mobile devices
- Brief staff on where the language toggle is located

---

## Part 6: User Management & Access Control

### Creating User Accounts (System Manager Only)

**Why Controlled:** Only System Managers can create accounts to prevent unauthorized access.

**System Manager Workflow: Creating a New User**

1. Navigate to **Setup** → **Users**
2. Click **New User**
3. Enter **Email Address** (unique identifier; used for login)
4. Enter **Full Name** (for display)
5. Set **Password** (temporary; user changes on first login)
   - Recommend 10+ characters with mix of types
6. Set **Department** (optional but helpful)
7. Under **Roles**, click **Add Row**
8. Select **Role**:
   - **System Manager** → Full system access (for IT/Admin staff)
   - **Event Manager** → Operational access only (for event staff)
9. Click **Save**

System then:

- Creates the account
- Sends invitation email to the new user
- User sets personal password on first login

**Ongoing User Management:**

| Task                      | Action                                                   |
| ------------------------- | -------------------------------------------------------- |
| **Reset Password**  | User clicks "Forgot Password"; system sends reset link   |
| **Change Role**     | System Manager edits user record, changes role, saves    |
| **Disable Account** | System Manager marks user as "Disabled"; login prevented |
| **Delete Account**  | System Manager deletes user (permanent; removes access)  |

**Best Practices:**

- Don't share default passwords; use email invitations
- Change temporary passwords on first login
- Review user access quarterly
- Archive rather than delete for compliance
- Provide brief training when creating new account

---

## Part 7: Data Quality & System Best Practices

### Mandatory Fields (System Will Block Save if Empty)

**Gift Category:**

- Category Name

**Gift:**

- Gift Name
- Category

**Gift Recipient:**

- Owner Full Name
- Coordinator Full Name
- Coordinator Mobile No.

**Gift Receipt (when used):**

- Received From

**Gift Issue:**

- Gift (must be in "Available" status)
- Recipient

**Gift Interest:**

- Recipient
- Gift Type

### Data Entry Best Practices

1. **Consistent Naming:**

   - Use formal names for owners: "Sheikh Mohammed bin Rashid" not "Mohammed"
   - Use descriptive gift names: "Rolex Daytona Platinum" not "watch"
   - Avoid abbreviations unless universal
2. **Complete Attributes:**

   - Fill all mandatory category attributes (marked with red asterisk)
   - Mandatory attributes make gifts searchable and identifiable
   - Don't leave required fields blank
3. **Upload Quality Photos:**

   - For jewelry, art, and high-value items: essential
   - For vehicles and animals: front, side, detail views
   - High resolution (1080p minimum)
   - Clear, well-lit images
4. **Keep Coordinator Contacts Current:**

   - Review quarterly
   - Update immediately if staff changes
   - This information is used during active events
5. **Document Reasons & Notes:**

   - "State Visit Gift" vs. just "Gift"
   - "Diplomatic relations" helps future analysis
   - Special handling notes (fragile, temperature-sensitive, etc.)
6. **Archive, Don't Delete:**

   - Interests: Mark as "Lost" or "Not Interested" instead of deleting
   - Gifts: Move to "Archived" status instead of deleting
   - Maintains audit trail and compliance records

### System Validation Rules

The system enforces these rules automatically:

| Rule                                   | Purpose                             | Example                                       |
| -------------------------------------- | ----------------------------------- | --------------------------------------------- |
| Can't issue a gift twice               | Prevents duplicate issues           | Gift marked "Issued" can't be selected again  |
| Can't issue if status ≠ Available     | Ensures only ready gifts are issued | "Maintenance" or "Archived" gifts unavailable |
| Must select valid gift & recipient     | Prevents incomplete records         | Both fields required in Issue                 |
| Attributes auto-load based on category | Ensures consistency                 | Select "Jewelry" → Weight field appears      |
| No future issue dates (usually)        | Prevents backdating manipulation    | System blocks issues dated in future          |

---

## Part 8: Troubleshooting & Support

### Common Issues & Solutions

| Issue                                      | Likely Cause                     | Solution                                                                            |
| ------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------- |
| "Can't see Maintenance or Reports"         | Role is Event Manager, not Admin | Ask System Manager to grant permissions or access data differently                  |
| "Category attributes not appearing"        | Wrong category selected          | Go back, select correct category; attributes auto-load                              |
| "Can't issue this gift"                    | Gift status is not "Available"   | Check Gifts module; may be already issued, in maintenance, or archived              |
| "Coordinator details not showing in issue" | Recipient record incomplete      | Open recipient, fill Coordinator Full Name & Mobile, save, retry                    |
| "Language not switching properly"          | Browser cache stale              | Clear cookies/cache, refresh page, try again                                        |
| "Can't create new category"                | Role is Event Manager, not Admin | Ask System Manager to create categories                                             |
| "Search not finding recipients"            | Partial match issue              | Try searching by first name only, or coordinator name                               |
| "System is slow when loading gifts"        | Large inventory, old browser     | Try a newer browser, clear cache, contact IT                                        |
| "Should I use Gift Receipt?"               | Unsure about workflow            | Use Gift Receipt ONLY for externally received gifts; otherwise create Gift directly |

### Getting Support

**For Permission Issues:**

- Contact your System Manager
- Describe what you're trying to do
- Request role elevation if needed

**For Data Issues:**

- Check if mandatory fields are filled
- Review error message carefully; usually indicates solution
- Contact your System Manager if unsure

**For Technical Issues:**

- Browser console (F12 key) may show specific errors
- Clear browser cache and cookies
- Try a different browser
- Contact IT/development team with error details

---

## Part 9: System Configuration (System Manager Reference)

### Required Initial Setup

Before the system can be fully used, a System Manager must complete:

1. **Create Gift Categories:**

   - Define all gift types your organization uses
   - Add relevant attributes for each category
   - Provide clear descriptions and naming
2. **Set Up Warehouse Locations:**

   - Create Warehouse records for each storage facility
   - Examples: Main Warehouse, Secure Vault, Animal Facility, Climate-Controlled Storage
   - Assign to gifts during creation
3. **Create User Accounts:**

   - Set up Event Manager accounts for operational staff
   - Document credentials securely
   - Brief users on their roles and permissions
4. **Import Initial Data (Optional):**

   - Load existing gift inventory via Gifts module (direct entry)
   - Import recipient database if available
   - Convert past issues into historical records
   - Note: Historical externally-received gifts can be entered as Gift Receipts for full documentation
5. **Configure Language Support:**

   - Verify English interface is correct
   - Add Arabic translations for all fields
   - Test language toggle in both directions
6. **Set User Dashboard:**

   - Customize dashboard metrics for each role
   - Event Managers see: Available Gifts, Recent Issues, Upcoming Interests
   - Admins see: All metrics, system health, usage trends

---

## Part 10: Compliance & Audit Considerations

### Audit Trail & Record Keeping

The system maintains automatic audit records:

1. **Every transaction is logged:**

   - Who created/modified record
   - What data changed
   - When it was changed
   - Timestamp with precision
2. **Gift chain of custody:**

   - Gift Receipt (optional) → shows source and condition when received externally
   - Gift → shows inventory status
   - Gift Issue → shows delivery to recipient
   - Complete chain from creation/receipt to recipient
3. **Compliance ready:**

   - All records retained for audit
   - Reports exportable for compliance review
   - Historical data preserved (archived records not deleted)

### Required Documentation

Maintain records for:

1. **Gift Receipts (when applicable):** Source, transport, condition, date
2. **Gifts:** All category attributes, photos, condition, location
3. **Gift Issues:** Recipient, date, reason, delivery method
4. **Maintenance:** Service dates, costs, condition changes
5. **Communications:** Thank-you notes, follow-ups, feedback

All stored in the system with searchable history.

---

## Part 11: Quick Reference Checklists

### Event Preparation Checklist (Event Manager)

- [ ] List all VIPs attending
- [ ] Create Gift Interests for each VIP (budget, preference, occasion)
- [ ] Check available inventory in Gifts module
- [ ] Plan procurement for any gaps
- [ ] Verify all Recipient records are complete (coordinator info)
- [ ] Arrange gift storage and display
- [ ] Assign staff to gift handover duties
- [ ] Brief staff on gift details and protocols
- [ ] Test language toggle if event is bilingual

### Gift Receipt Checklist (Event Manager) - Only for External Gifts

- [ ] Confirm gift is from external source (not internal inventory)
- [ ] Source information complete
- [ ] Category selected
- [ ] All mandatory attributes filled
- [ ] Photos uploaded (high quality)
- [ ] Condition documented
- [ ] Warehouse assigned
- [ ] "Create New Gift" toggle ON (if creating inventory record)
- [ ] Receipt Status set to Draft initially
- [ ] Saved and awaiting admin approval

### Direct Gift Entry Checklist (Admin/Event Manager) - For Internal Gifts

- [ ] Gift Name clear and descriptive
- [ ] Category selected (attributes auto-load)
- [ ] All mandatory category attributes filled
- [ ] Photos uploaded (high quality, multiple angles)
- [ ] Warehouse assigned
- [ ] Condition documented
- [ ] Status set to "Available"
- [ ] Storage Date entered
- [ ] Special handling notes added (if applicable)
- [ ] Saved successfully

### Gift Issue Checklist (Event Manager)

- [ ] Gift selected (Available status confirmed)
- [ ] Recipient selected
- [ ] Date entered
- [ ] Reason documented clearly
- [ ] Delivery method selected
- [ ] Status set appropriately (Delivered for immediate handover)
- [ ] Tracking number entered (if using courier)
- [ ] All details verified
- [ ] **Submit** to finalize (not just Save)

### System Manager Setup Checklist

- [ ] Categories created with attributes
- [ ] Warehouses established
- [ ] Initial users created
- [ ] Roles assigned
- [ ] Language translations completed
- [ ] Dashboard configured
- [ ] Sample data loaded for testing
- [ ] Documentation shared with team
- [ ] Staff training completed (including when to use Gift Receipts vs. direct Gift entry)
- [ ] System backup configured

---

## Conclusion

The Gift Management System provides end-to-end visibility and control over gift operations from creation/receipt through delivery and maintenance.

### Core Workflow Summary:

1. **Define** gift types with Categories
2. **Create** gifts in inventory (directly or via Gift Receipts for external sources)
3. **Issue** gifts to recipients with full documentation
4. **Maintain** gifts requiring ongoing care
5. **Report** on all activities for compliance and analytics

### Key Distinction:

- **Gift Receipts** = Optional supporting module for documenting gifts received from external parties
- **Core Workflow** = Gift → Gift Issue → Maintenance → Reports

Clear role separation (System Manager vs. Event Manager) ensures operational efficiency while maintaining security and oversight.

**Best Practice:** Use Gift Receipts only when documenting externally-received items. For all other cases, create Gifts directly to streamline your workflow.

---

**Document Version:** 3.0
**Last Updated:** January 6, 2026
**System:** Gift Management Platform v1.0
**Target Audience:** System Administrators & Event Managers

**Contact:** Aman Boora, Alfastack Solution Private Limited
