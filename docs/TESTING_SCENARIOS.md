# RazorAgent Testing Scenarios

## 🧪 Comprehensive Test Cases

### **Happy Path Tests**
1. **Basic Product Search**
   - Input: "I want to buy headphones"
   - Expected: Product match, order creation, payment link
   - Verify: Audit log shows `order_created`

2. **Product with Upsells**
   - Input: "I want Sony noise-cancelling headphones"
   - Expected: Product match + upsell suggestions with amber border
   - Verify: Audit log shows `order_created` + `upsell_shown`

3. **Multiple Product Questions**
   - Input: "What keyboards do you have?"
   - Expected: Product suggestions without order creation
   - Verify: No payment link, tools_used shows only `search_catalog`

### **Edge Case Tests**
4. **Non-existent Product**
   - Input: "I want to buy a flying car"
   - Expected: Graceful "we don't carry that" response
   - Verify: No order created, no payment link

5. **Empty Message**
   - Input: "" (empty)
   - Expected: Message not sent, button disabled
   - Verify: No API call made

6. **Ambiguous Query**
   - Input: "I want something blue"
   - Expected: Agent asks for clarification or suggests blue products
   - Verify: Natural language handling

7. **Price Inquiry**
   - Input: "How much are the headphones?"
   - Expected: Price information without order creation
   - Verify: No payment link unless user confirms purchase

8. **Stock Inquiry**
   - Input: "Do you have the Sony headphones in stock?"
   - Expected: Stock information from catalog
   - Verify: Correct stock quantity displayed

### **Error Handling Tests**
9. **Server Down**
   - Scenario: Express server not running
   - Expected: Error message "Sorry, something went wrong"
   - Verify: Graceful degradation

10. **Network Timeout**
    - Scenario: Slow network connection
    - Expected: Loading indicator, eventual timeout or error
    - Verify: UI doesn't freeze

11. **Invalid Session**
    - Scenario: Corrupted session_id
    - Expected: New session created automatically
    - Verify: Chat continues normally

### **Security Tests**
12. **XSS Attempt**
    - Input: "<script>alert('xss')</script>"
    - Expected: Text displayed as-is, not executed
    - Verify: No script execution

13. **SQL Injection Attempt**
    - Input: "'; DROP TABLE users; --"
    - Expected: Treated as normal text query
    - Verify: No database errors (we use flat files anyway)

### **Performance Tests**
14. **Rapid Messages**
    - Scenario: Send multiple messages quickly
    - Expected: Each message processed in order
    - Verify: No race conditions, proper queuing

15. **Long Message**
    - Input: 1000+ character message
    - Expected: Message processed normally
    - Verify: No truncation or errors

### **Accessibility Tests**
16. **Keyboard Navigation**
    - Scenario: Navigate using Tab, Enter
    - Expected: Full keyboard accessibility
    - Verify: All interactive elements reachable

17. **Screen Reader**
    - Scenario: Use with screen reader
    - Expected: Proper ARIA labels, semantic HTML
    - Verify: Announces changes correctly

### **UI/UX Tests**
18. **Dark Mode Toggle**
    - Scenario: Switch between light/dark mode
    - Expected: Smooth theme transition
    - Verify: All components styled correctly

19. **Mobile Responsive**
    - Scenario: Resize to mobile viewport
    - Expected: Responsive layout adjustments
    - Verify: Chat widget usable on small screens

20. **Loading States**
    - Scenario: Various loading scenarios
    - Expected: Clear loading indicators
    - Verify: User knows system is working

## 🎯 Novel Agent Improvement Ideas

### **1. Context-Aware Recommendations**
- **Idea**: Remember user preferences across sessions
- **Implementation**: Store user preferences in localStorage
- **Benefit**: Personalized recommendations based on browsing history

### **2. Comparative Product Analysis**
- **Idea**: When user asks about multiple products, provide comparison table
- **Implementation**: Add `compare_products` tool
- **Benefit**: Better decision support for buyers

### **3. Natural Language Price Negotiation**
- **Idea**: Allow users to ask for discounts or deals
- **Implementation**: Add discount logic with merchant-configured rules
- **Benefit**: More human-like shopping experience

### **4. Multi-Product Cart**
- **Idea**: Build cart functionality instead of single-item orders
- **Implementation**: Add cart management tools
- **Benefit**: More realistic shopping workflow

### **5. Product Image Integration**
- **Idea**: Show product images in chat
- **Implementation**: Add image URLs to catalog, display in chat
- **Benefit**: Visual product confirmation

### **6. Voice Input Support**
- **Idea**: Add speech-to-text for mobile users
- **Implementation**: Web Speech API integration
- **Benefit**: Hands-free shopping experience

### **7. Order History Lookup**
- **Idea**: Allow users to check their previous orders
- **Implementation**: Add `get_order_history` tool
- **Benefit**: Order tracking and reordering capability

### **8. Real-time Inventory Updates**
- **Idea**: Show live stock levels in chat
- **Implementation**: WebSocket integration for inventory
- **Benefit**: Accurate stock information

### **9. Multi-Language Support**
- **Idea**: Support multiple languages for global users
- **Implementation**: Translation API integration
- **Benefit**: Accessibility for non-English speakers

### **10. Smart Search Filters**
- **Idea**: Allow users to filter by price range, category, features
- **Implementation**: Enhanced search with filter parameters
- **Benefit**: More precise product discovery

## 🚀 Priority Implementation

### **High Priority (Current Session)**
1. ✅ Fix merchant dashboard navigation
2. ✅ Create comprehensive home page
3. ✅ Implement proper dark/light mode
4. ✅ Improve ChatWidget styling per expert guidelines

### **Medium Priority (Future Features)**
5. Context-aware recommendations
6. Product image integration
7. Order history lookup
8. Multi-product cart

### **Low Priority (Advanced Features)**
9. Voice input support
10. Multi-language support
11. Real-time inventory updates
12. Smart search filters