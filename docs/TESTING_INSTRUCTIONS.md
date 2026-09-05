# RazorAgent Enhanced Frontend Testing Instructions

## 🚀 Quick Start
```bash
npm run dev:all
```
This starts both Express server (port 3000) and Vite dev server (port 5173).

## 📋 Comprehensive Test Plan

### 1. Dark Mode Default Test
**Objective:** Verify dark mode is set as default with no toggle buttons

**Steps:**
1. Open http://localhost:5173
2. Verify the application loads in dark mode (dark background, light text)
3. Check that no toggle buttons exist in header
4. Verify all components use dark theme colors

**Expected Results:**
- ✅ Dark mode loads by default
- ✅ No light/dark toggle buttons visible
- ✅ All text is readable with proper contrast
- ✅ All buttons and links use dark mode colors

---

### 2. Home Page Navigation Test
**Objective:** Verify all navigation links work correctly

**Steps:**
1. On home page, click "Start Shopping" button
2. Verify it navigates to chat interface
3. Click "← Back to Home" in chat
4. Verify it returns to home page
5. Click "View Catalog" button
6. Verify it navigates to catalog page
7. Click "← Back to Home" in catalog
8. Verify it returns to home page
9. Click "Merchant Dashboard" button
10. Verify it navigates to dashboard page
11. Click "← Back to Home" in dashboard
12. Verify it returns to home page

**Expected Results:**
- ✅ All navigation buttons work correctly
- ✅ Back buttons return to home page
- ✅ URL hash updates appropriately (#chat, #catalog, #dashboard)
- ✅ Browser back button works correctly

---

### 3. Catalog Page Test
**Objective:** Verify catalog page displays products correctly

**Steps:**
1. Navigate to catalog page
2. Verify page loads without errors
3. Check that all 10 products are displayed
4. Verify products are grouped by category (Electronics, Accessories, Apparel)
5. Click on a product card
6. Verify product details are visible
7. Check product images load correctly
8. Verify price formatting (₹XX,XXX.00)
9. Check stock levels are displayed
10. Verify tags are shown for each product

**Expected Results:**
- ✅ Catalog loads with all products
- ✅ Products grouped by category
- ✅ Product images display correctly
- ✅ Prices formatted in Indian Rupees
- ✅ Stock levels shown
- ✅ Tags displayed properly
- ✅ Responsive layout on different screen sizes

---

### 4. Dashboard Page Test
**Objective:** Verify merchant dashboard displays correct data

**Steps:**
1. Navigate to dashboard page
2. Verify page loads without errors
3. Check that stats overview displays (Total Actions, Orders Created, Payments Captured, Upsells Shown)
4. Verify Recent Activity table shows recent audit entries
5. Check that timestamps are formatted correctly
6. Verify order IDs are displayed (or — if not applicable)
7. Check amounts are formatted correctly
8. Verify status badges have correct colors (green for success, red for failure)
9. Check Agent Performance section displays tool usage
10. Verify System Status shows correct information

**Expected Results:**
- ✅ Dashboard loads with real audit data
- ✅ Stats display correct counts
- ✅ Recent activity table shows proper data
- ✅ Timestamps formatted correctly
- ✅ Status badges colored appropriately
- ✅ Tool usage distribution accurate
- ✅ System status shows correct information

---

### 5. Category Pre-fill Test
**Objective:** Verify category browse buttons pre-fill chat with category prompts

**Steps:**
1. On home page, click "Browse Electronics →"
2. Verify it navigates to chat interface
3. Check that input field is pre-filled with "I'm looking for electronics"
4. Click "Browse Accessories →"
5. Verify input is pre-filled with "I'm looking for accessories"
6. Click "Browse Apparel →"
7. Verify input is pre-filled with "I'm looking for apparel"
8. Test that pre-filled text can be edited
9. Test that pre-filled text can be cleared
10. Send the pre-filled message and verify it works

**Expected Results:**
- ✅ Category buttons navigate to chat
- ✅ Input field pre-filled with correct category
- ✅ Pre-filled text is editable
- ✅ Pre-filled text can be cleared
- ✅ Pre-filled messages work correctly with agent

---

### 6. API Documentation Tooltip Test
**Objective:** Verify API Documentation button shows hover message

**Steps:**
1. On home page, scroll to "For Developers & AI Agents" section
2. Locate "View API Documentation" button
3. Hover over the button
4. Verify tooltip appears with "API Documentation (To be updated...)"
5. Move mouse away
6. Verify tooltip disappears
7. Try clicking the button
8. Verify it navigates to catalog page (placeholder)

**Expected Results:**
- ✅ Tooltip appears on hover
- ✅ Tooltip displays correct message
- ✅ Tooltip disappears when mouse moves away
- ✅ Button functions as expected (navigates to catalog)

---

### 7. Chat Functionality Test
**Objective:** Verify chat works with all features

**Steps:**
1. Navigate to chat interface
2. Type "I want to buy headphones"
3. Click Send
4. Verify loading indicator appears
5. Check that agent responds with product suggestion
6. Verify product image displays in response
7. Check that "Pay Now" button appears if order created
8. Verify upsell message shows amber border if applicable
9. Check that tools used badge shows at bottom
10. Test auto-scroll to latest message

**Expected Results:**
- ✅ Loading indicator appears
- ✅ Agent responds with relevant product
- ✅ Product image displays correctly
- ✅ Payment link button appears
- ✅ Upsell highlighting works
- ✅ Tools used badge shows agent actions
- ✅ Auto-scroll works correctly

---

### 8. Cross-Page Navigation Test
**Objective:** Verify navigation works from all pages

**Steps:**
1. Start from home page
2. Navigate to catalog
3. From catalog, navigate to dashboard
4. From dashboard, navigate to chat
5. From chat, navigate to home
6. From home, navigate directly to chat
7. From chat, navigate to catalog
8. From catalog, navigate to home
9. From home, navigate to dashboard
10. Verify browser back button works at each step

**Expected Results:**
- ✅ All navigation paths work correctly
- ✅ No broken links or navigation errors
- ✅ Browser back button functions properly
- ✅ URL hash updates correctly
- ✅ No navigation loops or issues

---

### 9. Responsive Design Test
**Objective:** Verify UI works on different screen sizes

**Steps:**
1. Test on desktop (1920x1080)
2. Test on tablet (768x1024)
3. Test on mobile (375x667)
4. Verify navigation works on all sizes
5. Check that product cards resize correctly
6. Verify chat input area is usable on mobile
7. Check that dashboard table is scrollable on mobile
8. Verify no horizontal scrolling issues
9. Check that buttons remain clickable on mobile
10. Verify text remains readable on all sizes

**Expected Results:**
- ✅ Responsive layout works on all screen sizes
- ✅ No horizontal scrolling issues
- ✅ Navigation remains accessible
- ✅ Text remains readable
- ✅ Buttons remain clickable
- ✅ Tables are scrollable on mobile

---

### 10. Edge Cases Test
**Objective:** Test various edge cases and error scenarios

**Steps:**
1. Test with empty message (should not send)
2. Test with very long message (should handle gracefully)
3. Test rapid message sending (should queue properly)
4. Test network interruption (should show error)
5. Test server not responding (should show error message)
6. Test with invalid session (should create new one)
7. Test with special characters in message
8. Test with emoji in message
9. Test with numbers in message
10. Test with multiple languages (if supported)

**Expected Results:**
- ✅ Empty messages not sent
- ✅ Long messages handled gracefully
- ✅ Rapid messages queued properly
- ✅ Network errors handled gracefully
- ✅ Server errors show user-friendly messages
- ✅ Invalid sessions create new ones
- ✅ Special characters handled correctly
- ✅ Emoji displayed correctly
- ✅ Numbers handled correctly

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ Dark mode is default with no toggle buttons
- ✅ All navigation links work correctly
- ✅ Catalog page displays all products properly
- ✅ Dashboard page shows real audit data
- ✅ Category buttons pre-fill chat with prompts
- ✅ API Documentation button shows hover tooltip
- ✅ Chat functionality works end-to-end
- ✅ Cross-page navigation works correctly

### UI/UX Requirements
- ✅ Professional, minimalist design
- ✅ High readability with proper contrast
- ✅ Semantic HTML structure
- ✅ Responsive design for all screen sizes
- ✅ Smooth transitions and interactions
- ✅ Clear visual hierarchy
- ✅ Accessible navigation

### Technical Requirements
- ✅ No console errors
- ✅ Fast page loads
- ✅ Proper error handling
- ✅ Clean code structure
- ✅ Proper state management
- ✅ No memory leaks
- ✅ Proper component lifecycle

---

## 🐛 Troubleshooting

### Issue: Catalog page shows error
**Solution:** Ensure Express server is running on port 3000

### Issue: Dashboard shows no data
**Solution:** Ensure audit.log exists and has entries

### Issue: Navigation doesn't work
**Solution:** Check browser console for JavaScript errors

### Issue: Dark mode not default
**Solution:** Check that `document.documentElement.classList.add('dark')` is called in useEffect

### Issue: Category pre-fill not working
**Solution:** Verify that `initialCategory` prop is passed correctly to ChatWidget

---

## 📊 Test Results Template

```
Test Category: [Category Name]
Test Date: [Date]
Tester: [Name]

Test Results:
✅ Dark Mode Default Test - PASSED
✅ Home Page Navigation Test - PASSED
✅ Catalog Page Test - PASSED
✅ Dashboard Page Test - PASSED
✅ Category Pre-fill Test - PASSED
✅ API Documentation Tooltip Test - PASSED
✅ Chat Functionality Test - PASSED
✅ Cross-Page Navigation Test - PASSED
✅ Responsive Design Test - PASSED
✅ Edge Cases Test - PASSED

Overall Status: ALL TESTS PASSED
```

---

## 🚀 Next Steps After Testing

1. If all tests pass: Proceed to commit changes
2. If any test fails: Debug and fix the issue
3. After fixes: Re-run the failing test
4. Document any issues found and resolved
5. Update this document with any additional test cases needed