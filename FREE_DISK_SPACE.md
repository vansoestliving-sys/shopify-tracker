# How to Free Up Disk Space on Windows

## Quick Wins (Can free 1-5 GB easily)

### 1. Clean Windows Temp Files
```powershell
# Run as Administrator
Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
```

### 2. Use Windows Disk Cleanup
1. Press `Win + R`
2. Type `cleanmgr` and press Enter
3. Select your C: drive
4. Check all boxes
5. Click "Clean up system files"

### 3. Empty Recycle Bin
- Right-click Recycle Bin → Empty Recycle Bin

### 4. Uninstall Unused Programs
- Settings → Apps → Uninstall unused apps

### 5. Clear Browser Cache
- Chrome: Settings → Privacy → Clear browsing data
- Edge: Settings → Privacy → Clear browsing data

### 6. Delete Old Downloads
- Check your Downloads folder
- Delete files you don't need

## Check Current Space

```powershell
Get-PSDrive C | Format-Table Name,@{Name="Free(GB)";Expression={[math]::Round($_.Free/1GB,2)}},@{Name="Used(GB)";Expression={[math]::Round($_.Used/1GB,2)}}
```

## Minimum Required: 1 GB free space

After freeing space, try:
```powershell
npm install
```

