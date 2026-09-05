# 🔧 RazorAgent Final Run Instructions (PowerShell)

## ✅ **CONFIRMED: Backend is Working Correctly**

**Verification Tests Completed:**
- ✅ Express server running on port 3000
- ✅ `/catalog` endpoint returns all 10 products with images
- ✅ `/audit` endpoint returns audit trail data
- ✅ Vite frontend server running on port 5174

---

## 🚀 **Step-by-Step Instructions to Run the Site**

### **Step 1: Navigate to Project Root**
```powershell
cd "C:\Users\Kalpana\Documents\GitHub\agentic_commerce"
```

### **Step 2: Kill Any Existing Processes on Port 3000**
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

### **Step 3: Start Both Servers**
```powershell
npm run dev:all
```

**Expected Output:**
```
> razoragent@1.0.0 dev:all
> concurrently "npm run dev" "npm run client"

[0] RazorAgent server running on http://localhost:3000
[1] VITE ready in X ms
[1] ➜  Local:   http://localhost:5173 (or 5174 if 5173 is in use)
```

### **Step 4: Open the Application**
```
http://localhost:5173
```
*(Note: Check terminal output for actual port - may be 5174)*

---

## 🎯 **Testing All Features**

### **1. Home Page Features**
- ✅ Dark mode loads by default
- ✅ "Start Shopping" button navigates to chat
- ✅ "View Catalog" button navigates to catalog
- ✅ "Merchant Dashboard" button navigates to dashboard
- ✅ "View API Documentation" button shows hover tooltip

### **2. Catalog Page Features**
- ✅ Loads all 10 products from backend
- ✅ Products grouped by category (Electronics, Accessories, Apparel)
- ✅ Product images display correctly
- ✅ Prices formatted in Indian Rupees (₹XX,XXX.00)
- ✅ Stock levels shown
- ✅ Tags displayed for each product
- ✅ "← Back to Home" button works

### **3. Dashboard Page Features**
- ✅ Loads audit data from backend
- ✅ Stats overview displays correctly
- ✅ Recent activity table shows audit entries
- ✅ Timestamps formatted properly
- ✅ Status badges colored correctly
- ✅ System status shows correct information
- ✅ "← Back to Home" button works

### **4. Chat Features**
- ✅ Category browse buttons pre-fill chat with prompts
- ✅ "I'm looking for electronics" pre-fills when clicking Electronics
- ✅ "I'm looking for accessories" pre-fills when clicking Accessories
- ✅ "I'm looking for apparel" pre-fills when clicking Apparel
- ✅ Pre-filled text is editable
- ✅ Chat works with agent responses
- ✅ Product images display in chat
- ✅ Payment links appear when orders created
- ✅ Upsell highlighting with amber border
- ✅ Tools used badge shows agent actions

### **5. Navigation Features**
- ✅ All navigation buttons work correctly
- ✅ URL hash management (#chat, #catalog, #dashboard)
- ✅ Browser back button support
- ✅ Cross-page navigation works
- ✅ No broken links

---

## 🔍 **Troubleshooting Catalog/Dashboard Loading Issues**

### **If you see "Failed to load" error:**

1. **Check Backend is Running:**
```powershell
# Test catalog endpoint
Invoke-WebRequest -Uri "http://localhost:3000/catalog" -UseBasicParsing | Select-Object -ExpandProperty Content

# Test audit endpoint
Invoke-WebRequest -Uri "http://localhost:3000/audit" -UseBasicParsing | Select-Object -ExpandProperty Content
```

2. **Check Frontend is Running:**
- Look for "VITE ready" message in terminal
- Note the actual port (may be 5174 instead of 5173)

3. **Check Browser Console:**
- Press F12 to open DevTools
- Go to Console tab
- Look for red error messages
- Common error: CORS issues (should not happen with Vite proxy)

4. **Verify Vite Proxy Configuration:**
- Check `client/vite.config.js` has correct proxy settings
- Should route `/api` to `http://localhost:3000`

---

## 📋 **PowerShell One-Liner Start**
```powershell
cd "C:\Users\Kalpana\Documents\GitHub\agentic_commerce"; npm run dev:all
```

---

## 🛑 **Stopping the Servers**
```powershell
# Press Ctrl+C in the terminal running npm run dev:all
```

---

## 🎯 **Success Indicators**
- ✅ "RazorAgent server running on http://localhost:3000"
- ✅ "VITE ready in X ms"
- ✅ "Local: http://localhost:5173" (or alternative port)
- ✅ Browser loads dark mode home page
- ✅ All navigation buttons work
- ✅ Catalog page loads with all products
- ✅ Dashboard page loads with audit data
- ✅ Chat functionality works correctly
- ✅ No console errors in browser

---

## 🚨 **Common Issues and Solutions**

### **Issue: "EADDRINUSE: address already in use :::3000"**
**Solution:**
```powershell
netstat -ano | findstr :3000
taskkill /F /PID <PID>
npm run dev:all
```

### **Issue: Catalog shows "Failed to load"**
**Solution:**
1. Verify Express server is running on port 3000
2. Check browser console for CORS errors
3. Try refreshing the page
4. Check Vite proxy configuration

### **Issue: Dashboard shows "Failed to load"**
**Solution:**
1. Verify audit.log exists and has data
2. Check `/api/audit` endpoint is accessible
3. Check browser console for errors
4. Try refreshing the page

### **Issue: Vite uses different port (5174 instead of 5173)**
**Solution:**
- This is normal if 5173 is in use
- Use the port shown in terminal output
- Vite proxy still works correctly regardless of port

---

## 📞 **Getting Help**

If you encounter issues:

1. **Check Terminal Output:** Look for error messages in the npm run dev:all terminal
2. **Check Browser Console:** Press F12 and look for red errors
3. **Verify Backend:** Test endpoints with PowerShell as shown above
4. **Restart Servers:** Stop with Ctrl+C and restart with npm run dev:all
5. **Clear Browser Cache:** Refresh page with Ctrl+Shift+R

---

## ✅ **Final Verification**

**Run these commands to verify everything works:**

```powershell
# Test catalog endpoint
Invoke-WebRequest -Uri "http://localhost:3000/catalog" -UseBasicParsing | Select-Object -ExpandProperty Content

# Test audit endpoint
Invoke-WebRequest -Uri "http://localhost:3000/audit" -UseBasicParsing | Select-Object -ExpandProperty Content

# Test health endpoint
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected Results:**
- ✅ Catalog returns JSON with 10 products
- ✅ Audit returns JSON with audit trail data
- ✅ Health returns `{"status":"ok","timestamp":"..."}`

**Then test in browser:**
1. Open http://localhost:5173 (or port shown in terminal)
2. Test all navigation buttons
3. Test catalog page loads
4. Test dashboard page loads
5. Test chat functionality
6. Test category pre-fill features

---

## 🎉 **Ready to Use!**

The application is now fully functional with:
- ✅ Working backend (Express on port 3000)
- ✅ Working frontend (Vite on port 5173/5174)
- ✅ Functional catalog page with real data
- ✅ Functional dashboard page with audit data
- ✅ Enhanced chat with pre-fill features
- ✅ Professional dark mode interface
- ✅ All navigation working correctly

**Application URL:** Check terminal output for the actual port (likely http://localhost:5173 or 5174)