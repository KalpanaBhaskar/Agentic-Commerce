# RazorAgent Quick Start Instructions (PowerShell)

## 🚀 **Step-by-Step Instructions to Run the Site**

### **Step 1: Navigate to Project Root**
```powershell
cd "C:\Users\Kalpana\Documents\GitHub\agentic_commerce"
```

### **Step 2: Start Both Servers**
```powershell
npm run dev:all
```

**What this does:**
- Starts Express backend server on port 3000
- Starts Vite frontend dev server (on port 5173 or 5174 if 5173 is in use)
- Runs both servers concurrently with automatic restart on file changes

### **Step 3: Open the Application**
```
http://localhost:5173
```
*(Note: If port 5173 is in use, Vite will automatically use 5174 - check the terminal output)*

### **Step 4: Verify Both Servers Are Running**
- Look for "RazorAgent server running on http://localhost:3000" in terminal
- Look for "VITE ready in X ms" and "Local: http://localhost:5173" in terminal
- Both should show green success messages

### **Step 5: Test the Application**
1. **Home Page**: Verify dark mode loads by default
2. **Navigation**: Click "View Catalog" and "Merchant Dashboard" buttons
3. **Chat**: Click "Start Shopping" and test with "I want to buy headphones"
4. **Category Browse**: Click category buttons to test chat pre-fill

---

## 🔧 **Troubleshooting Common Issues**

### **Issue: Port 3000 Already in Use**
**Solution:**
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

### **Issue: Port 5173 Already in Use**
**Solution:** Vite will automatically use the next available port (5174, 5175, etc.) - check terminal output for the actual port

### **Issue: Catalog/Dashboard Not Loading**
**Solution:**
1. Ensure Express server is running on port 3000
2. Check terminal for any error messages
3. Verify Vite proxy is configured correctly
4. Try refreshing the browser page

### **Issue: Server Crashes**
**Solution:**
```powershell
# Stop the current process (Ctrl+C)
# Then restart
npm run dev:all
```

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

## 🎯 **What to Expect**
- **Terminal 1**: Shows Express server logs and Vite dev server logs
- **Browser**: Opens RazorAgent application in dark mode
- **Console**: No errors should appear in browser console

---

## 📞 **Getting Help**
If you encounter issues:
1. Check terminal for error messages
2. Verify Node.js is installed: `node --version`
3. Verify dependencies are installed: Check if `node_modules` folder exists
4. Try fresh install: `rm -rf node_modules client/node_modules && npm install && cd client && npm install`

---

## ✅ **Success Indicators**
- ✅ "RazorAgent server running on http://localhost:3000"
- ✅ "VITE ready in X ms"
- ✅ "Local: http://localhost:5173" (or alternative port)
- ✅ Browser loads dark mode home page
- ✅ All navigation buttons work
- ✅ No console errors in browser