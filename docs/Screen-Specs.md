# RelocateWise — Screen Specifications

This document outlines the detailed specifications for each screen in the RelocateWise MVP, establishing clear requirements for frontend component architecture, user interactions, validation logic, loading states, and navigation actions.

---

## 1. Landing Screen

### Purpose & User Goals
*   **Purpose**: Introduce RelocateWise and its value proposition.
*   **User Goals**: Understand the product's value and start the questionnaire without friction.

### Components & User Interactions
*   **Hero Section**:
    *   *Headline*: "Find Your Next Home, Powered by Data."
    *   *Sub-headline*: "Answer a 5-minute questionnaire and get objective city recommendations tailored to your budget, climate, and lifestyle."
    *   *CTA Button*: "Start Questionnaire" (Primary action, triggers questionnaire).
*   **Value Props Grid**: Three clean cards highlighting Core Features:
    1.  *Objective Matching*: No sponsor bias, powered strictly by UN/OECD data.
    2.  *Deep Comparisons*: View metrics side-by-side.
    3.  *Privacy First*: No sign-up required, zero persistent tracking.
*   **Cookie Consent Banner**:
    *   Sticky banner appearing at the bottom of the viewport on first visit.
    *   *Buttons*: "Accept All" (Sets non-essential cookie flag to true), "Decline" (Sets non-essential cookie flag to false).
    *   *Links*: "Privacy Policy".
*   **Footer**: Links to "Privacy Policy".

### Validation Rules & Data Requirements
*   No input validation required on this screen.
*   Cookie consent choice must be stored in browser `localStorage` to prevent repeating the prompt.

### States
*   **Success (Default)**: Normal page render.
*   **Loading**: Standard page loading state.

### Navigation Actions
*   Clicking "Start Questionnaire" navigates the user to **Questionnaire Screen (Step 1)**.
*   Clicking "Privacy Policy" in footer navigates to the **Privacy Policy Page**.

---

## 2. Questionnaire Screen (Multi-Step Template)

### Purpose & User Goals
*   **Purpose**: Dynamically guide the user through 7 preference questions.
*   **User Goals**: Input preferences quickly and skip dimensions that are not important.

### Components & User Interactions
*   **Progress Header**:
    *   *Progress Bar*: Fills incrementally (14.2% per step for 7 steps).
    *   *Step Indicator*: Text "Step X of 7".
*   **Question Area**:
    *   *Question Title*: Clear, bold question (e.g., "What is your ideal climate?").
    *   *Instruction Subtext*: Optional helper text (e.g., "Select the temperature profile you feel most comfortable in.").
*   **Selection Grid**:
    *   Grid of clickable visual cards representing choices.
    *   Cards highlight with an active border and background color when selected.
*   **Action Controls**:
    *   *Back Button*: (Disabled on Step 1) Returns to previous step.
    *   *Skip Button*: Moves to next step without selecting.
    *   *Next Button*: Moves to next step. Replaced by **"View Matches"** (Primary CTA styling) on Step 7.

### Validation Rules & Data Requirements
*   No strict validation. Skipping a question is allowed (a default neutral value is recorded for that parameter).
*   State is managed in client-side memory during the quiz.

### States
*   **Success (Default)**: Question and options render immediately.
*   **Transition State**: Soft CSS fade transition when clicking "Next" or "Back" to reduce cognitive jump.

### Navigation Actions
*   "Back" -> Loads previous step.
*   "Next" / "Skip" (Steps 1–6) -> Loads next step.
*   "View Matches" (Step 7) -> Triggers matching algorithm API request and navigates to **Ranked Results Screen**.

---

## 3. Ranked Results Screen

### Purpose & User Goals
*   **Purpose**: Present the top 10 recommended cities.
*   **User Goals**: Compare recommendation scores, review matching rationales, and select cities to compare.

### Components & User Interactions
*   **Results Header**:
    *   *Title*: "Your Top 10 Matches".
    *   *Reset Button*: "Start Over" (Secondary styling, resets session state and quiz).
*   **Top 10 Cards List**: A vertical stack of cards. Each card contains:
    *   *Rank Indicator*: Bold number (1 to 10).
    *   *City Name & Country*: Large text.
    *   *Match Score*: Circular badge displaying "XX% Match" (colored from green to orange depending on score).
    *   *Match Explanation*: Text string: *"Why this fits: matches your preference for [Dimension A] and [Dimension B]."*
    *   *Secondary CTA*: "View Profile" link.
    *   *Comparison Control*: Checkbox labeled "Compare". Checking it adds the city to the shortlist.
*   **Floating Shortlist Bar**:
    *   Sticky overlay anchored at the bottom of the viewport, visible only when shortlist count > 0.
    *   *Shortlist Count*: Displays "X of 3 selected".
    *   *City Chips*: Small badges displaying names of shortlisted cities with an "X" to remove.
    *   *Primary CTA*: "Compare Now" (Disabled if count < 2).
    *   *Secondary Button*: "Clear All" (Empties shortlist).

### Validation Rules & Data Requirements
*   **Shortlist Limit**: Shortlist array is limited to exactly 3 items.
    *   *Rule*: If shortlist count === 3 and user checks a 4th city:
        *   The checkbox remains unchecked.
        *   Display a toast notification: *"You can compare up to 3 cities. Please remove one first."*
*   **Matching Results**: Expects exactly 10 city records from the backend API.

### States
*   **Loading**: Shows a skeleton layout consisting of 10 generic card shapes with a pulsing gradient background.
*   **Empty / Error State**:
    *   If API fails or database is empty, display: *"We couldn't generate matches right now."*
    *   Provide a "Retry" or "Start Over" button.
*   **Success**: Clean rendering of the 10 matched cards and the shortlist bar (if cities are selected).

### Navigation Actions
*   Clicking "View Profile" -> Navigates to **City Profile Screen** for that city.
*   Clicking "Compare Now" on the shortlist bar -> Navigates to **Side-by-Side Comparison Screen**.
*   Clicking "Start Over" -> Clears results and navigates back to **Landing Screen**.

---

## 4. City Profile Screen

### Purpose & User Goals
*   **Purpose**: Provide comprehensive data detail for a specific city.
*   **User Goals**: Deep-dive into city scores, read summary narrative, and shortlist/remove the city.

### Components & User Interactions
*   **Profile Header**:
    *   *Title*: City Name, Country.
    *   *Back Button*: "Back to Results" (Returns user to Results).
    *   *Action Button*: "Add to Comparison" / "Remove from Comparison" (Updates shortlist state).
*   **Qualitative Summary**: A 2–3 sentence description paragraph explaining the city's character.
*   **Metrics Grid**: The 8 dimensions displayed as horizontal progress bars:
    *   *Dimensions*: Climate (Label + numeric range), Cost of Living (1-5 scale), Housing Affordability (1-5 scale), Career/Industry Fit (1-5 scale), Healthcare (1-5 scale), Education (1-5 scale), Community & Lifestyle (1-5 scale), and Military Safety (1-5 scale).
*   **Metadata Footer**: Shows a "Data last updated: YYYY-MM-DD" label.
*   **Floating Shortlist Bar**: Persistent at bottom (matches Results screen behavior) to allow quick comparison.

### Validation Rules & Data Requirements
*   Shortlist checks: Disables the "Add to Comparison" button if shortlist count === 3 and the current city is not already shortlisted. Displays tooltip: *"Shortlist full (max 3)."*

### States
*   **Loading**: Pulsing layout skeletons for the hero title, metrics grid, and summary text.
*   **Error State**: If city ID does not exist, show: *"City profile not found."* with a CTA button "Back to Results".
*   **Success**: Displays all metadata, progress bars, and descriptions.

### Navigation Actions
*   Clicking "Back to Results" -> Returns to the **Ranked Results Screen** (preserving previous questionnaire answers).
*   Clicking "Compare Now" on shortlist bar -> Navigates to **Side-by-Side Comparison Screen**.

---

## 5. Side-by-Side Comparison Screen

### Purpose & User Goals
*   **Purpose**: Direct side-by-side comparison of 2 or 3 selected cities.
*   **User Goals**: Review trade-offs row-by-row and finalize relocation candidate selections.

### Components & User Interactions
*   **Comparison Header**:
    *   *Title*: "City Comparison" (Showing 2 or 3 columns).
    *   *Action Buttons*: "Back to Results", "Clear All" (Resets shortlist and returns to Results).
*   **Comparison Matrix (Table)**:
    *   *Columns*: Header contains City Name, Country, and a "Remove" icon button.
    *   *Rows*: Aligns the 8 dimensions.
    *   *Highlight Cell*: For each row, the cell containing the highest-ranking score is styled with a distinct border and accent color (e.g., bright teal background/border) to signify the "winner" of that dimension.

### Validation Rules & Data Requirements
*   Requires a minimum of 2 cities.
    *   *Rule*: If shortlist count falls below 2 (e.g., user clicks "Remove" on a column, leaving 1 city), the UI automatically redirects the user to the **Ranked Results Screen** with that remaining city still checked in the shortlist.

### States
*   **Loading**: Shows empty column grids with loading animations.
*   **Error State**: If accessed directly with < 2 cities in session, redirects to results.
*   **Success**: Complete table layout.

### Navigation Actions
*   Clicking "Back to Results" -> Navigates to **Ranked Results Screen** (shortlist persists).
*   Clicking "Remove" on a city column -> Updates shortlist state, removes column.
*   Clicking "Clear All" -> Clears shortlist, redirects to **Ranked Results Screen**.
